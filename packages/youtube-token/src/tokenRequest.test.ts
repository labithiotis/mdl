import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { RateLimitResult } from './rateLimit';

const { handleTokenRequest } = await import('./tokenRequest');
const installationId = '123e4567-e89b-42d3-a456-426614174000';

afterEach(() => {
  mock.clearAllMocks();
});

describe('token requests', () => {
  test('rejects invalid video IDs before rate-limit or KV access', async () => {
    const env = createEnv();

    const response = await handleTokenRequest(request('https://worker.test/token?videoId=not-a-video-id'), env);

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({ error: 'Missing or invalid videoId query parameter.' });
    expect(env.PO_TOKEN_KV.get).not.toHaveBeenCalled();
    expect(env.TOKEN_RATE_LIMITER.get).not.toHaveBeenCalled();
  });

  test('returns a cached token after both quotas succeed', async () => {
    const env = createEnv({
      cached: {
        expiresAt: '2026-07-16T12:00:00.000Z',
        poToken: 'cached-token',
        visitorData: 'cached-visitor',
      },
    });

    const response = await handleTokenRequest(request('https://worker.test/token?videoId=dQw4w9WgXcQ'), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ poToken: 'cached-token' });
    expect(env.TOKEN_RATE_LIMITER.get).toHaveBeenCalledTimes(2);
  });

  test('does not consume the IP quota after an installation limit rejection', async () => {
    const env = createEnv({
      rateLimitResults: [{ retryAfter: 60, success: false as const, window: 'hour' as const }],
    });

    const response = await handleTokenRequest(request('https://worker.test/token?videoId=dQw4w9WgXcQ'), env);

    expect(response.status).toBe(429);
    expect(env.TOKEN_RATE_LIMITER.get).toHaveBeenCalledTimes(1);
  });
});

function request(url: string): Request {
  return new Request(url, {
    headers: {
      'cf-connecting-ip': '192.0.2.1',
      'x-mdl-installation-id': installationId,
    },
  });
}

function createEnv(options: { cached?: unknown; rateLimitResults?: RateLimitResult[] } = {}): Env {
  const results: RateLimitResult[] = options.rateLimitResults ?? [{ success: true }];
  let resultIndex = 0;
  const get = mock(() => ({
    fetch: mock(async () => Response.json(results[Math.min(resultIndex++, results.length - 1)])),
  }));

  return {
    PO_TOKEN_KV: {
      get: mock(async () => options.cached ?? null),
      put: mock(async () => undefined),
    },
    TOKEN_RATE_LIMITER: {
      get,
      idFromName: (name: string) => name,
    },
  } as unknown as Env;
}
