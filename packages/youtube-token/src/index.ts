import puppeteer, {
  type Browser,
  type HTTPRequest,
  type Page,
} from '@cloudflare/puppeteer';
import { BG } from 'bgutils-js';

type TokenPayload = {
  expiresAt: string;
  poToken: string;
  visitorData: string;
};

type PlayerRequestPayload = {
  context?: { client?: { visitorData?: string } };
  serviceIntegrityDimensions?: { poToken?: string };
  [key: string]: unknown;
};

type TokenWatcher = { cancel: () => void; promise: Promise<TokenPayload> };

const CACHE_TTL_SECONDS = 60 * 60;
const PLAYER_REQUEST_TIMEOUT_MS = 15_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env).catch((error: unknown) =>
      json(
        { error: error instanceof Error ? error.message : String(error) },
        500
      )
    );
  },
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname !== '/token') {
    return json({ error: 'Not found' }, 404);
  }

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const videoId = url.searchParams.get('videoId')?.trim();
  if (!videoId) {
    return json({ error: 'Missing videoId query parameter.' }, 400);
  }

  const cacheKey = `web-player:${videoId}`;

  const cached = await env.PO_TOKEN_KV.get<TokenPayload>(cacheKey, 'json');
  if (cached) return json(cached);

  const { success } = await env.TOKEN_MINT_RATE_LIMITER.limit({
    key: 'token-mint',
  });
  if (!success) return json({ error: 'Token mint rate limit exceeded.' }, 429);

  const token = await mintToken(videoId, env);

  await env.PO_TOKEN_KV.put(cacheKey, JSON.stringify(token), {
    expirationTtl: CACHE_TTL_SECONDS,
  });

  return json(token);
}

async function mintToken(videoId: string, env: Env): Promise<TokenPayload> {
  console.log('Get a new token for videoId', videoId);
  const browser = await getBrowser(env);
  const page = await browser.newPage();

  try {
    const tokenWatcher = watchForPlayerToken(page);

    await page.setViewport({ height: 720, width: 1280 });
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
      waitUntil: 'domcontentloaded',
    });
    await dismissConsent(page);
    await page
      .locator('.ytp-large-play-button, video, body')
      .click()
      .catch(() => undefined);
    await page.evaluate(() => {
      const video = document.querySelector('video');
      void video?.play?.();
    });

    const pageToken = await waitForTokenFromPage(page);
    if (pageToken) {
      tokenWatcher.cancel();
      return pageToken;
    }

    try {
      return await tokenWatcher.promise;
    } catch (error) {
      const diagnostics = await getPageDiagnostics(page).catch(
        (diagnosticError: unknown) => ({
          diagnosticError:
            diagnosticError instanceof Error
              ? diagnosticError.message
              : String(diagnosticError),
        })
      );
      const diagnosticToken = tokenFromDiagnostics(diagnostics);
      if (diagnosticToken) return diagnosticToken;

      throw new Error(
        `${error instanceof Error ? error.message : String(error)} Diagnostics: ${JSON.stringify(diagnostics)}`
      );
    }
  } finally {
    await page.close().catch(() => undefined);
    browser.disconnect();
  }
}

async function waitForTokenFromPage(page: Page): Promise<TokenPayload | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = await readTokenFromPage(page).catch(() => null);
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return null;
}

function tokenFromDiagnostics(
  diagnostics: Record<string, unknown>
): TokenPayload | null {
  const getVal = (val: unknown) => (typeof val === 'string' ? val : undefined);
  const visitorData =
    getVal(diagnostics.visitorDataFromSearch) ??
    getVal(diagnostics.innertubeVisitorData) ??
    getVal(diagnostics.visitorDataFromGet);

  if (!visitorData?.trim()) return null;

  return {
    expiresAt: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
    poToken: BG.PoToken.generateColdStartToken(visitorData),
    visitorData,
  };
}

async function getBrowser(env: Env): Promise<Browser> {
  const idleSessions = (await puppeteer.sessions(env.BROWSER)).filter(
    (s) => !s.connectionId
  );
  if (idleSessions.length) {
    return puppeteer.connect(env.BROWSER, idleSessions[0].sessionId);
  }
  return puppeteer.launch(env.BROWSER, {
    keep_alive: 600_000,
  });
}

async function dismissConsent(page: Page): Promise<void> {
  for (const selector of [
    'button[aria-label="Accept all"]',
    'button[aria-label="Reject all"]',
    'form[action*="consent"] button',
  ]) {
    const element = await page.$(selector);
    if (!element) continue;

    await element.click().catch(() => undefined);
    return;
  }
}

async function getPageDiagnostics(
  page: Page
): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    function findStringValue(value: unknown, key: string): string | undefined {
      if (!value || typeof value !== 'object') return undefined;

      if (
        key in value &&
        typeof (value as Record<string, unknown>)[key] === 'string'
      ) {
        return (value as Record<string, string>)[key];
      }

      for (const child of Object.values(value)) {
        const result = findStringValue(child, key);
        if (result) return result;
      }

      return undefined;
    }

    const globalScope = window as typeof window & {
      ytcfg?: { data_?: unknown; get?: (key: string) => unknown };
      ytInitialPlayerResponse?: unknown;
    };

    return {
      bodyText: document.body?.innerText?.slice(0, 500) ?? '',
      hasYtcfg: Boolean(globalScope.ytcfg),
      hasYtcfgData: Boolean(globalScope.ytcfg?.data_),
      hasInitialPlayerResponse: Boolean(globalScope.ytInitialPlayerResponse),
      href: location.href,
      innertubeVisitorData: findStringValue(
        globalScope.ytcfg?.get?.('INNERTUBE_CONTEXT'),
        'visitorData'
      ),
      performanceUrls: performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('youtube') || name.includes('google'))
        .slice(-20),
      title: document.title,
      visitorDataFromGet:
        typeof globalScope.ytcfg?.get?.('VISITOR_DATA') === 'string'
          ? globalScope.ytcfg.get('VISITOR_DATA')
          : null,
      visitorDataFromSearch:
        findStringValue(globalScope.ytcfg?.data_, 'VISITOR_DATA') ??
        findStringValue(globalScope.ytcfg?.data_, 'visitorData') ??
        null,
      ytcfgKeys:
        globalScope.ytcfg?.data_ && typeof globalScope.ytcfg.data_ === 'object'
          ? Object.keys(
              globalScope.ytcfg.data_ as Record<string, unknown>
            ).slice(0, 30)
          : [],
    };
  });
}

async function readTokenFromPage(page: Page): Promise<TokenPayload | null> {
  const token = await page.evaluate(() => {
    type BrowserTokenPayload = {
      poToken?: string;
      visitorData?: string;
    };

    function findStringValue(value: unknown, key: string): string | undefined {
      if (!value || typeof value !== 'object') return undefined;

      if (
        key in value &&
        typeof (value as Record<string, unknown>)[key] === 'string'
      ) {
        return (value as Record<string, string>)[key];
      }

      for (const child of Object.values(value)) {
        const result = findStringValue(child, key);
        if (result) return result;
      }

      return undefined;
    }

    const globalScope = window as typeof window & {
      ytcfg?: { data_?: unknown; get?: (key: string) => unknown };
      ytInitialPlayerResponse?: unknown;
    };
    const ytcfgData =
      globalScope.ytcfg?.data_ ??
      globalScope.ytcfg?.get?.('INNERTUBE_CONTEXT') ??
      null;
    const innertubeContext = globalScope.ytcfg?.get?.('INNERTUBE_CONTEXT');
    const playerResponse = globalScope.ytInitialPlayerResponse ?? null;
    const visitorDataFromConfig = globalScope.ytcfg?.get?.('VISITOR_DATA');
    const visitorData =
      (typeof visitorDataFromConfig === 'string'
        ? visitorDataFromConfig
        : undefined) ??
      findStringValue(ytcfgData, 'VISITOR_DATA') ??
      findStringValue(ytcfgData, 'visitorData') ??
      findStringValue(innertubeContext, 'visitorData') ??
      findStringValue(playerResponse, 'visitorData');
    const payload: BrowserTokenPayload = {
      poToken: findStringValue(playerResponse, 'poToken'),
      visitorData,
    };

    return payload.poToken && payload.visitorData ? payload : null;
  });

  if (!token?.visitorData) return null;

  const poToken =
    token.poToken ?? BG.PoToken.generateColdStartToken(token.visitorData);

  return {
    expiresAt: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
    poToken,
    visitorData: token.visitorData,
  };
}

function watchForPlayerToken(page: Page): TokenWatcher {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let isSettled = false;
  let requestHandler: ((request: HTTPRequest) => void) | undefined;

  const promise = new Promise<TokenPayload>((resolve, reject) => {
    const seenPlayerRequests: string[] = [];
    timeout = setTimeout(() => {
      if (requestHandler) page.off('request', requestHandler);
      isSettled = true;
      reject(
        new Error(
          `Timed out waiting for YouTube player PO token. Saw ${seenPlayerRequests.length} player request(s): ${seenPlayerRequests.join('; ')}`
        )
      );
    }, PLAYER_REQUEST_TIMEOUT_MS);

    requestHandler = (request: HTTPRequest): void => {
      if (!request.url().includes('/youtubei/v1/player')) return;

      const payload = parsePlayerRequestPayload(request.postData() ?? null);
      const poToken =
        payload?.serviceIntegrityDimensions?.poToken ??
        findStringValue(payload, 'poToken');
      const visitorData =
        payload?.context?.client?.visitorData ??
        findStringValue(payload, 'visitorData');

      seenPlayerRequests.push(
        JSON.stringify({
          hasPoToken: Boolean(poToken),
          hasVisitorData: Boolean(visitorData),
          keys: payload ? Object.keys(payload).slice(0, 8) : [],
        })
      );

      if (!poToken || !visitorData) return;

      clearTimeout(timeout);
      if (requestHandler) page.off('request', requestHandler);
      isSettled = true;
      resolve({
        expiresAt: new Date(
          Date.now() + CACHE_TTL_SECONDS * 1000
        ).toISOString(),
        poToken,
        visitorData,
      });
    };

    page.on('request', requestHandler);
  });

  return {
    cancel: () => {
      if (isSettled) return;
      isSettled = true;
      if (timeout) clearTimeout(timeout);
      if (requestHandler) page.off('request', requestHandler);
    },
    promise,
  };
}

function findStringValue(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;

  if (
    key in value &&
    typeof (value as Record<string, unknown>)[key] === 'string'
  ) {
    return (value as Record<string, string>)[key];
  }

  for (const child of Object.values(value)) {
    const result = findStringValue(child, key);
    if (result) return result;
  }

  return undefined;
}

function parsePlayerRequestPayload(
  value: string | null
): PlayerRequestPayload | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as PlayerRequestPayload;
  } catch {
    return null;
  }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}
