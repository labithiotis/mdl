import { ProxyAgent, fetch as undiciFetch } from 'undici';

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
  console.log('=======> Using proxy', options.proxy);
  globalThis.fetch = createProxyFetch(proxyAgent);
}

export function getYouTubeSessionOptions(): {
  cookie?: string;
  fetch: typeof fetch;
  po_token?: string;
  user_agent?: string;
} {
  return {
    cookie: currentNetworkOptions.ytCookie,
    fetch: globalThis.fetch.bind(globalThis),
    user_agent: currentNetworkOptions.ytUserAgent,
  };
}

function createProxyFetch(agent: ProxyAgent): typeof fetch {
  return (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) =>
    undiciFetch(
      input as never,
      {
        ...(init ?? {}),
        dispatcher: agent,
      } as never
    )) as unknown as typeof fetch;
}
