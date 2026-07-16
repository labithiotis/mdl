import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { SessionOptions } from 'youtubei.js';
import type { YouTubePoToken } from './poToken';

export type NetworkOptions = {
  proxy?: string;
  ytCookie?: string;
  ytUserAgent?: string;
};

const defaultFetch = globalThis.fetch.bind(globalThis);

let currentNetworkOptions: NetworkOptions = {};
let proxyAgent: ProxyAgent | null = null;

export function configureNetwork(options: NetworkOptions): void {
  currentNetworkOptions = { ...options };

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
