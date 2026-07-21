import { getInstallationId } from './installation';

export type PoTokenOptions = {
  installationId?: string;
  usePoToken?: boolean;
};

export type YouTubePoToken = {
  expiresAt?: string;
  poToken: string;
  visitorData?: string;
};

const providerUrl = process.env.MDL_YOUTUBE_TOKEN_PROVIDER_URL ?? 'https://mdl-youtube-token.canari.workers.dev/token';

let options: PoTokenOptions = {};
let warningHandler: ((message: string) => void) | null = null;
let rateLimited = false;
let hasWarnedRateLimit = false;

export function configurePoToken(nextOptions: PoTokenOptions): void {
  options = { ...nextOptions };
  rateLimited = false;
  hasWarnedRateLimit = false;
}

export function setPoTokenWarningHandler(handler: ((message: string) => void) | null): void {
  warningHandler = handler;
}

export async function getYouTubePoToken(videoId: string, signal?: AbortSignal): Promise<YouTubePoToken | undefined> {
  if (options.usePoToken === false || rateLimited) return undefined;

  const url = new URL(providerUrl);
  url.searchParams.set('videoId', videoId);
  const installationId = options.installationId ?? (await getInstallationId());
  const response = await fetch(url, {
    signal,
    headers: { 'x-mdl-installation-id': installationId },
  });
  if (response.ok) return parseYouTubePoToken(await response.json());

  if (response.status !== 429) {
    throw new Error(`YouTube token provider failed (${response.status}): ${await response.text()}`);
  }

  rateLimited = true;
  if (!hasWarnedRateLimit) {
    hasWarnedRateLimit = true;
    warningHandler?.(
      `${await getRateLimitMessage(response)} MDL will continue without one; some YouTube downloads may fail.`
    );
  }
  return undefined;
}

async function getRateLimitMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: unknown } };
    return typeof payload.error?.message === 'string'
      ? payload.error.message
      : 'You hit the limit for YouTube download tokens.';
  } catch {
    return 'You hit the limit for YouTube download tokens.';
  }
}

function parseYouTubePoToken(value: unknown): YouTubePoToken {
  if (!value || typeof value !== 'object') {
    throw new Error('YouTube token provider returned an invalid payload.');
  }
  const payload = value as Partial<YouTubePoToken>;
  if (typeof payload.poToken !== 'string' || !payload.poToken.trim()) {
    throw new Error('YouTube token provider did not return a PO token.');
  }
  if (typeof payload.visitorData !== 'string' || !payload.visitorData.trim()) {
    throw new Error('YouTube token provider did not return visitor data.');
  }
  return {
    poToken: payload.poToken,
    visitorData: payload.visitorData,
    ...(typeof payload.expiresAt === 'string' ? { expiresAt: payload.expiresAt } : {}),
  };
}
