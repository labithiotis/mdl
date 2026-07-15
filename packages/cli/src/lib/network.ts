import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { SessionOptions } from 'youtubei.js';
import { getInstallationId } from './installation';

export type NetworkOptions = {
  installationId?: string;
  proxy?: string;
  usePoToken?: boolean;
  ytCookie?: string;
  ytUserAgent?: string;
};

export type YouTubePoToken = {
  expiresAt?: string;
  poToken: string;
  visitorData?: string;
};

const defaultFetch = globalThis.fetch.bind(globalThis);
const YOUTUBE_PO_TOKEN_PROVIDER_URL =
  process.env.MDL_YOUTUBE_TOKEN_PROVIDER_URL ?? 'https://mdl-youtube-token.canari.workers.dev/token';

let currentNetworkOptions: NetworkOptions = {};
let proxyAgent: ProxyAgent | null = null;
let poTokenWarningHandler: ((message: string) => void) | null = null;
let isPoTokenRateLimited = false;
let hasWarnedPoTokenRateLimit = false;

export function configureNetwork(options: NetworkOptions): void {
  currentNetworkOptions = { ...options };
  isPoTokenRateLimited = false;
  hasWarnedPoTokenRateLimit = false;

  if (proxyAgent) {
    proxyAgent.close();
    proxyAgent = null;
  }

  if (!options.proxy) {
    globalThis.fetch = defaultFetch;
    return;
  }

  proxyAgent = new ProxyAgent(options.proxy);
  globalThis.fetch = createProxyFetch(proxyAgent);
}

export function setPoTokenWarningHandler(handler: ((message: string) => void) | null): void {
  poTokenWarningHandler = handler;
}

export function getYouTubeSessionOptions(poToken?: YouTubePoToken): Partial<SessionOptions> {
  return {
    cookie: currentNetworkOptions.ytCookie,
    user_agent: currentNetworkOptions.ytUserAgent,
    visitor_data: poToken?.visitorData,
    po_token: poToken?.poToken,
    fetch: globalThis.fetch.bind(globalThis),
  };
}

export function getYouTubeSessionCacheKey(poToken?: YouTubePoToken): string {
  return JSON.stringify({
    cookie: currentNetworkOptions.ytCookie,
    userAgent: currentNetworkOptions.ytUserAgent,
    poToken: poToken?.poToken,
    visitorData: poToken?.visitorData,
  });
}

export async function getYouTubePoToken(videoId: string, signal?: AbortSignal): Promise<YouTubePoToken | undefined> {
  if (currentNetworkOptions.usePoToken === false || isPoTokenRateLimited) {
    return undefined;
  }

  const url = new URL(YOUTUBE_PO_TOKEN_PROVIDER_URL);
  url.searchParams.set('videoId', videoId);
  const installationId = currentNetworkOptions.installationId ?? (await getInstallationId());
  const response = await fetch(url, {
    signal,
    headers: { 'x-mdl-installation-id': installationId },
  });

  if (!response.ok) {
    if (response.status === 429) {
      const message = await getRateLimitMessage(response);
      isPoTokenRateLimited = true;
      if (!hasWarnedPoTokenRateLimit) {
        hasWarnedPoTokenRateLimit = true;
        poTokenWarningHandler?.(`${message} MDL will continue without one; some YouTube downloads may fail.`);
      }
      return undefined;
    }

    throw new Error(`YouTube token provider failed (${response.status}): ${await response.text()}`);
  }

  return parseYouTubePoToken(await response.json());
}

async function getRateLimitMessage(response: Response): Promise<string> {
  const fallback = 'You hit the limit for YouTube download tokens.';

  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
    };
    return typeof payload.error?.message === 'string' ? payload.error.message : fallback;
  } catch {
    return fallback;
  }
}

function createProxyFetch(agent: ProxyAgent): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    undiciFetch(
      input as never,
      {
        ...(init ?? {}),
        dispatcher: agent,
      } as never
    )) as unknown as typeof fetch;
}

function parseYouTubePoToken(value: unknown): YouTubePoToken {
  if (!value || typeof value !== 'object') {
    throw new Error('YouTube token provider returned an invalid payload.');
  }

  const payload = value as Partial<YouTubePoToken>;

  if (typeof payload.poToken !== 'string' || payload.poToken.trim().length === 0) {
    throw new Error('YouTube token provider did not return a PO token.');
  }

  if (typeof payload.visitorData !== 'string' || payload.visitorData.trim().length === 0) {
    throw new Error('YouTube token provider did not return visitor data.');
  }

  return {
    poToken: payload.poToken,
    visitorData: payload.visitorData,
    ...(typeof payload.expiresAt === 'string' ? { expiresAt: payload.expiresAt } : {}),
  };
}
