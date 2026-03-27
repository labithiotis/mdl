import type { PlaylistMetadata, Provider } from '../types';
import { AmazonMusicProvider } from './AmazonMusic';
import { AppleMusicProvider } from './AppleMusic';
import { BandcampProvider } from './Bandcamp';
import { DeezerProvider } from './Deezer';
import { QobuzProvider } from './Qobuz';
import { SoundCloudProvider } from './SoundCloud';
import { SpotifyProvider } from './Spotify';
import { TidalProvider } from './Tidal';
import { YouTubeMusicProvider } from './YouTubeMusic';

export type FetchOptions = {
  signal?: AbortSignal;
};

export interface ProviderOptions {
  readonly provider: Provider;
  readonly displayName: string;
  readonly shortLinkHosts?: readonly string[];
  matchesUrl(url: URL): boolean;
  fetch(url: string, options: FetchOptions): Promise<PlaylistMetadata>;
}

type ProviderMatch = {
  provider: Provider;
  normalizedUrl: string;
};

type UrlResolver = (url: string) => Promise<string>;

const providerList: ProviderOptions[] = [
  new SpotifyProvider(),
  new AppleMusicProvider(),
  new AmazonMusicProvider(),
  new YouTubeMusicProvider(),
  new SoundCloudProvider(),
  new BandcampProvider(),
  new QobuzProvider(),
  new DeezerProvider(),
  new TidalProvider(),
];

export const providers: Record<Provider, ProviderOptions> = Object.fromEntries(
  providerList.map((providerOption) => [
    providerOption.provider,
    providerOption,
  ])
) as Record<Provider, ProviderOptions>;

export const PROVIDER_OPTIONS = providerList;

export const RECOGNIZED_PROVIDERS: Provider[] = PROVIDER_OPTIONS.map(
  ({ provider }) => provider
);

export function getProvider(provider: Provider): ProviderOptions {
  return providers[provider];
}

export function formatProviderName(provider: Provider): string {
  return providers[provider]?.displayName ?? 'Spotify';
}

export function detectProvider(url: string): Provider | 'unknown' {
  const parsedUrl = tryParseHttpUrl(url);
  if (!parsedUrl) {
    return 'unknown';
  }

  return (
    detectDirectProvider(parsedUrl)?.provider ??
    detectShortLinkProvider(parsedUrl) ??
    'unknown'
  );
}

export function getProviderUrlValidationError(rawUrl: string): string | null {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return 'Enter a music URL.';
  }

  const parsedUrl = tryParseHttpUrl(trimmedUrl);
  if (!parsedUrl) {
    return 'Invalid URL. Provide a full http:// or https:// music URL.';
  }

  if (detectDirectProvider(parsedUrl) || detectShortLinkProvider(parsedUrl)) {
    return null;
  }

  return `Unsupported music URL. Recognized providers: ${RECOGNIZED_PROVIDERS.map(formatProviderName).join(', ')}.`;
}

export async function validateProviderUrl(
  rawUrl: string,
  options?: { resolveUrl?: UrlResolver }
): Promise<ProviderMatch> {
  const validationError = getProviderUrlValidationError(rawUrl);
  if (validationError) {
    throw new Error(validationError);
  }

  const parsedUrl = tryParseHttpUrl(rawUrl);
  if (!parsedUrl) {
    throw new Error(
      'Invalid URL. Provide a full http:// or https:// music URL.'
    );
  }

  const directMatch = detectDirectProvider(parsedUrl);
  if (directMatch) {
    return directMatch;
  }

  const shortLinkProvider = detectShortLinkProvider(parsedUrl);
  if (!shortLinkProvider) {
    throw new Error(
      `Unsupported music URL. Recognized providers: ${RECOGNIZED_PROVIDERS.map(formatProviderName).join(', ')}.`
    );
  }

  const resolveUrl = options?.resolveUrl ?? defaultResolveUrl;
  const resolvedUrl = await resolveUrl(parsedUrl.toString());
  const resolvedParsedUrl = tryParseHttpUrl(resolvedUrl);

  if (!resolvedParsedUrl) {
    throw new Error(
      `Could not resolve the ${formatProviderName(shortLinkProvider)} short link to a valid music URL.`
    );
  }

  const resolvedMatch = detectDirectProvider(resolvedParsedUrl);
  if (!resolvedMatch || resolvedMatch.provider !== shortLinkProvider) {
    throw new Error(
      `Could not resolve the ${formatProviderName(shortLinkProvider)} short link to a supported music URL.`
    );
  }

  return resolvedMatch;
}

function detectDirectProvider(url: URL): ProviderMatch | null {
  const providerOption = PROVIDER_OPTIONS.find((option) =>
    option.matchesUrl(url)
  );

  if (!providerOption) {
    return null;
  }

  return {
    provider: providerOption.provider,
    normalizedUrl: normalizeProviderUrl(url, providerOption.provider),
  };
}

function detectShortLinkProvider(url: URL): Provider | null {
  const hostname = url.hostname.toLowerCase();

  return (
    PROVIDER_OPTIONS.find((option) => option.shortLinkHosts?.includes(hostname))
      ?.provider ?? null
  );
}

function tryParseHttpUrl(value: string): URL | null {
  try {
    const parsedUrl = new URL(value.trim());
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
}

function stripQueryAndHash(url: URL): string {
  const normalized = new URL(url.toString());
  normalized.search = '';
  normalized.hash = '';
  return normalized.toString();
}

function normalizeProviderUrl(url: URL, provider: Provider): string {
  if (provider !== 'youtube-music') {
    return stripQueryAndHash(url);
  }

  const normalized = new URL(url.toString());
  const listId = normalized.searchParams.get('list')?.trim();

  normalized.search = '';
  normalized.hash = '';

  if (listId) {
    normalized.searchParams.set('list', listId);
  }

  return normalized.toString();
}

async function defaultResolveUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'user-agent': 'mdl/0.1' },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(
      `Short link request failed with status ${response.status}.`
    );
  }

  if (response.url && response.url !== url) {
    return response.url;
  }

  const body = await response.text();
  const bodyUrl = extractHttpUrl(body);
  return bodyUrl ?? response.url ?? url;
}

function extractHttpUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s"'<>]+/i);
  return match?.[0] ?? null;
}
