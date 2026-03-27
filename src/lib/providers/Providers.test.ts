import { describe, expect, test } from 'bun:test';
import { detectProvider, validateProviderUrl } from './Providers';

describe('providers', () => {
  test('detects direct playlist and album URLs for every recognized provider', () => {
    expect(
      detectProvider('https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2')
    ).toBe('spotify');
    expect(
      detectProvider('https://open.spotify.com/album/6eUW0wxWtzkFdaEFsTJto6')
    ).toBe('spotify');
    expect(
      detectProvider(
        'https://music.apple.com/us/playlist/pure-focus/pl.92e04ee75ed64804b9df468b5f45a161'
      )
    ).toBe('apple-music');
    expect(
      detectProvider(
        'https://music.apple.com/us/album/whenever-you-need-somebody/1440837083'
      )
    ).toBe('apple-music');
    expect(
      detectProvider(
        'https://music.amazon.com/playlists/B01M11SBC8?marketplaceId=ATVPDKIKX0DER&musicTerritory=US'
      )
    ).toBe('amazon-music');
    expect(detectProvider('https://music.amazon.com/albums/B09DS56JYZ')).toBe(
      'amazon-music'
    );
    expect(
      detectProvider(
        'https://music.youtube.com/playlist?list=OLAK5uy_kL1MLS8vRizOS0jZ7MaqNVkcZ6LL3Us8Q'
      )
    ).toBe('youtube-music');
    expect(
      detectProvider('https://music.youtube.com/browse/MPREb_m1loWbE9n9I')
    ).toBe('youtube-music');
    expect(
      detectProvider(
        'https://m.soundcloud.com/user-420319049/sets/sets-on-sets'
      )
    ).toBe('soundcloud');
    expect(
      detectProvider('https://bandcamp.com/folkmylife_blog/playlist/folkmylife')
    ).toBe('bandcamp');
    expect(
      detectProvider(
        'https://marcellaandherlovers.bandcamp.com/album/live-from-memphis'
      )
    ).toBe('bandcamp');
    expect(
      detectProvider(
        'https://daily.bandcamp.com/lists/cajun-creole-accordion-music-guide'
      )
    ).toBe('bandcamp');
    expect(
      detectProvider(
        'https://www.qobuz.com/us-en/playlists/hi-res-masters-80s-pop/17743902'
      )
    ).toBe('qobuz');
    expect(
      detectProvider(
        'https://www.qobuz.com/us-en/album/discovery-daft-punk/0724384960650'
      )
    ).toBe('qobuz');
    expect(
      detectProvider('https://www.deezer.com/us/playlist/1234567890')
    ).toBe('deezer');
    expect(detectProvider('https://www.deezer.com/us/album/302127')).toBe(
      'deezer'
    );
    expect(
      detectProvider(
        'https://tidal.com/playlist/36ea71a8-445e-41a4-82ab-6628c581535d'
      )
    ).toBe('tidal');
    expect(detectProvider('https://tidal.com/album/102948177')).toBe('tidal');
  });

  test('rejects malformed URLs and non-provider URLs', async () => {
    await expect(validateProviderUrl('google.com/example')).rejects.toThrow(
      /Invalid URL/
    );
    await expect(
      validateProviderUrl('https://google.com/example')
    ).rejects.toThrow(/Unsupported music URL/);
    await expect(
      validateProviderUrl('https://music.apple.com/us/music-video/example/123')
    ).rejects.toThrow(/Unsupported music URL/);
    await expect(
      validateProviderUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')
    ).rejects.toThrow(/Unsupported music URL/);
    await expect(
      validateProviderUrl('https://soundcloud.com/artist/track-name')
    ).rejects.toThrow(/Unsupported music URL/);
    await expect(
      validateProviderUrl('https://bandcamp.com/artist/track/example')
    ).rejects.toThrow(/Unsupported music URL/);
  });

  test('normalizes direct playlist URLs by removing query strings and hashes', async () => {
    const result = await validateProviderUrl(
      'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2?si=123#foo'
    );

    expect(result.provider).toBe('spotify');
    expect(result.normalizedUrl).toBe(
      'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2'
    );
  });

  test('normalizes YouTube Music playlist URLs while preserving the list parameter', async () => {
    const result = await validateProviderUrl(
      'https://music.youtube.com/playlist?list=RDCLAK5uy_nHSqCJjDrW9HBhCNdF6tWPdnOMngOv0wA&playnext=1&si=D5Aj97tJAaxyFE4c#foo'
    );

    expect(result.provider).toBe('youtube-music');
    expect(result.normalizedUrl).toBe(
      'https://music.youtube.com/playlist?list=RDCLAK5uy_nHSqCJjDrW9HBhCNdF6tWPdnOMngOv0wA'
    );
  });

  test('resolves short links for supported providers before validation', async () => {
    const resolveUrl = async (url: string): Promise<string> => {
      switch (url) {
        case 'https://spotify.link/playlist':
          return 'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2?si=abc';
        case 'https://apple.co/focus':
          return 'https://music.apple.com/ca/playlist/focus/pl.f8be40e575584f8e9b0eb12e37c759b8';
        case 'https://amzn.to/mix':
          return 'https://music.amazon.com/user-playlists/0a1b2c3d4e5f6g7h8i9j0k';
        case 'https://on.soundcloud.com/sets':
          return 'https://soundcloud.com/user-420319049/sets/sets-on-sets';
        case 'https://deezer.page.link/chill':
          return 'https://www.deezer.com/playlist/1234567890?utm_campaign=share';
        default:
          throw new Error(`Unexpected short URL: ${url}`);
      }
    };

    const spotify = await validateProviderUrl('https://spotify.link/playlist', {
      resolveUrl,
    });
    const appleMusic = await validateProviderUrl('https://apple.co/focus', {
      resolveUrl,
    });
    const amazonMusic = await validateProviderUrl('https://amzn.to/mix', {
      resolveUrl,
    });
    const soundcloud = await validateProviderUrl(
      'https://on.soundcloud.com/sets',
      {
        resolveUrl,
      }
    );
    const deezer = await validateProviderUrl('https://deezer.page.link/chill', {
      resolveUrl,
    });

    expect([
      spotify.provider,
      appleMusic.provider,
      amazonMusic.provider,
      soundcloud.provider,
      deezer.provider,
    ]).toEqual([
      'spotify',
      'apple-music',
      'amazon-music',
      'soundcloud',
      'deezer',
    ]);
    expect(spotify.normalizedUrl).toBe(
      'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2'
    );
  });

  test('fails when a short link resolves to the wrong provider or non-playlist URL', async () => {
    await expect(
      validateProviderUrl('https://apple.co/not-a-playlist', {
        resolveUrl: async () =>
          'https://music.apple.com/us/music-video/example/123456789',
      })
    ).rejects.toThrow(/Could not resolve the Apple Music short link/);

    await expect(
      validateProviderUrl('https://spotify.link/wrong-provider', {
        resolveUrl: async () => 'https://www.deezer.com/playlist/1234567890',
      })
    ).rejects.toThrow(/Could not resolve the Spotify short link/);
  });
});
