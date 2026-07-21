import { afterEach, describe, expect, mock, test } from 'bun:test';
import { configureNetwork, getYouTubeSessionOptions } from './network';
import { configurePoToken, getYouTubePoToken, setPoTokenWarningHandler } from './poToken';

const defaultFetch = globalThis.fetch;
const installationId = '123e4567-e89b-42d3-a456-426614174000';

afterEach(() => {
  configureNetwork({});
  configurePoToken({});
  globalThis.fetch = defaultFetch;
  mock.restore();
});

describe('network', () => {
  test('fetches YouTube PO tokens from the default worker', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://mdl-youtube-token.canari.workers.dev/token?videoId=abc123');
      expect(new Headers(init?.headers).get('x-mdl-installation-id')).toMatch(/^[0-9a-f-]{36}$/i);

      return new Response(
        JSON.stringify({
          poToken: 'po-token-123',
          visitorData: 'visitor-data-123',
        })
      );
    });

    configureNetwork({});
    configurePoToken({ installationId });
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
    configureNetwork({});
    configurePoToken({ installationId });
    globalThis.fetch = mock(
      async () => new Response(JSON.stringify({ poToken: 'po-token-123' }))
    ) as unknown as typeof fetch;

    await expect(getYouTubePoToken('abc123')).rejects.toThrow('YouTube token provider did not return visitor data.');
  });

  test('does not request a token when disabled', async () => {
    const fetchMock = mock(async () => new Response());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureNetwork({});
    configurePoToken({ installationId, usePoToken: false });

    await expect(getYouTubePoToken('abc123')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('warns once and stops requesting tokens after a rate limit', async () => {
    const warningHandler = mock(() => undefined);
    const fetchMock = mock(async () =>
      Response.json(
        {
          error: {
            message: 'You hit the daily limit for YouTube download tokens.',
          },
        },
        { status: 429 }
      )
    );
    setPoTokenWarningHandler(warningHandler);
    configureNetwork({});
    configurePoToken({ installationId });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(getYouTubePoToken('abc123')).resolves.toBeUndefined();
    await expect(getYouTubePoToken('def456')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warningHandler).toHaveBeenCalledTimes(1);
    expect(warningHandler).toHaveBeenCalledWith(
      'You hit the daily limit for YouTube download tokens. MDL will continue without one; some YouTube downloads may fail.'
    );
    setPoTokenWarningHandler(null);
  });

  test('warns only once when parallel requests are rate limited', async () => {
    const warningHandler = mock(() => undefined);
    const fetchMock = mock(async () => Response.json({ error: { message: 'Daily limit reached.' } }, { status: 429 }));
    setPoTokenWarningHandler(warningHandler);
    configureNetwork({});
    configurePoToken({ installationId });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await Promise.all([getYouTubePoToken('abc123'), getYouTubePoToken('def456'), getYouTubePoToken('ghi789')]);

    expect(warningHandler).toHaveBeenCalledTimes(1);
    setPoTokenWarningHandler(null);
  });
});
