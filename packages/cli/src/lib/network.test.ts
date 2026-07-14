import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  configureNetwork,
  getYouTubePoToken,
  getYouTubeSessionOptions,
} from './network';

const defaultFetch = globalThis.fetch;

afterEach(() => {
  configureNetwork({});
  globalThis.fetch = defaultFetch;
  mock.restore();
});

describe('network', () => {
  test('fetches YouTube PO tokens from the default worker', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        'https://mdl-youtube-token.canari.workers.dev/token?videoId=abc123'
      );

      return new Response(
        JSON.stringify({
          poToken: 'po-token-123',
          visitorData: 'visitor-data-123',
        })
      );
    });

    configureNetwork({});
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(getYouTubePoToken('abc123')).resolves.toEqual({
      poToken: 'po-token-123',
      visitorData: 'visitor-data-123',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      getYouTubeSessionOptions({
        poToken: 'po-token-123',
        visitorData: 'visitor-data-123',
      })
    ).toMatchObject({
      visitor_data: 'visitor-data-123',
    });
  });

  test('rejects token responses without visitor data', async () => {
    globalThis.fetch = mock(
      async () => new Response(JSON.stringify({ poToken: 'po-token-123' }))
    ) as unknown as typeof fetch;

    await expect(getYouTubePoToken('abc123')).rejects.toThrow(
      'YouTube token provider did not return visitor data.'
    );
  });
});
