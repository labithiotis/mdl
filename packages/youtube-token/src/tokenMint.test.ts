import { afterEach, describe, expect, mock, test } from 'bun:test';

const generateColdStartToken = mock(() => 'cold-start-token');

mock.module('@cloudflare/puppeteer', () => ({ default: {} }));
mock.module('bgutils-js', () => ({ BG: { PoToken: { generateColdStartToken } } }));

const { mintToken } = await import('./tokenMint');
const defaultFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = defaultFetch;
  mock.clearAllMocks();
});

describe('token minting', () => {
  test('uses the bounded cold-start bootstrap before Browser Run', async () => {
    const data: unknown[] = [];
    data[0] = [];
    (data[0] as unknown[])[2] = [];
    ((data[0] as unknown[])[2] as unknown[])[0] = [];
    (((data[0] as unknown[])[2] as unknown[])[0] as unknown[])[0] = [];
    ((((data[0] as unknown[])[2] as unknown[])[0] as unknown[])[0] as unknown[])[13] = 'visitor-data';
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(`)]}'${JSON.stringify(data)}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(mintToken('dQw4w9WgXcQ', {} as Env)).resolves.toMatchObject({
      poToken: 'cold-start-token',
      visitorData: 'visitor-data',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateColdStartToken).toHaveBeenCalledTimes(1);
  });
});
