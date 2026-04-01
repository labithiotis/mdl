import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { SpotifyProvider } from './Spotify';

const provider = new SpotifyProvider();

afterEach(() => {
  mock.restore();
});

describe('spotify', () => {
  test('parses Spotify track metadata from embed page data', () => {
    const html = `
<!DOCTYPE html>
<html>
  <body>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"state":{"data":{"entity":{"type":"track","name":"Kookaburra Sits","uri":"spotify:track:1eJdXVLxLoMWu1TkaeSL18","id":"1eJdXVLxLoMWu1TkaeSL18","title":"Kookaburra Sits","artists":[{"name":"ABC Kids","uri":"spotify:artist:6l7J2uM3bM2BCh0tIPhWx8"}],"duration":57720,"visualIdentity":{"image":[{"url":"https://image-cdn-fa.spotifycdn.com/image/track-art"}]}}}}}}}</script>
  </body>
</html>
`;

    const playlist = provider.parseCollectionHtml(
      html,
      'https://open.spotify.com/track/1eJdXVLxLoMWu1TkaeSL18'
    );

    expect(playlist.id).toBe('1eJdXVLxLoMWu1TkaeSL18');
    expect(playlist.title).toBe('Kookaburra Sits');
    expect(playlist.owner).toBe('ABC Kids');
    expect(playlist.artworkUrl).toBe(
      'https://image-cdn-fa.spotifycdn.com/image/track-art'
    );
    expect(playlist.tracks).toEqual([
      {
        id: '1eJdXVLxLoMWu1TkaeSL18',
        title: 'Kookaburra Sits',
        artists: ['ABC Kids'],
        album: undefined,
        artworkUrl: 'https://image-cdn-fa.spotifycdn.com/image/track-art',
        durationMs: 57720,
        sourceUrl: 'https://open.spotify.com/track/1eJdXVLxLoMWu1TkaeSL18',
      },
    ]);
  });

  test('parses Spotify album metadata from embed page data', () => {
    const html = `
<!DOCTYPE html>
<html>
  <body>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"state":{"data":{"entity":{"type":"album","name":"Whenever You Need Somebody","uri":"spotify:album:6eUW0wxWtzkFdaEFsTJto6","id":"6eUW0wxWtzkFdaEFsTJto6","title":"Whenever You Need Somebody","subtitle":"Rick Astley","trackList":[{"uri":"spotify:track:4PTG3Z6ehGkBFwjybzWkR8","title":"Never Gonna Give You Up","subtitle":"Rick Astley","duration":213573}],"visualIdentity":{"image":[{"url":"https://i.scdn.co/image/album-art"}]}}}}}}}</script>
  </body>
</html>
`;

    const playlist = provider.parseCollectionHtml(
      html,
      'https://open.spotify.com/album/6eUW0wxWtzkFdaEFsTJto6'
    );

    expect(playlist.id).toBe('6eUW0wxWtzkFdaEFsTJto6');
    expect(playlist.title).toBe('Whenever You Need Somebody');
    expect(playlist.owner).toBe('Rick Astley');
    expect(playlist.artworkUrl).toBe('https://i.scdn.co/image/album-art');
    expect(playlist.tracks[0]).toEqual({
      id: '4PTG3Z6ehGkBFwjybzWkR8',
      title: 'Never Gonna Give You Up',
      artists: ['Rick Astley'],
      album: 'Whenever You Need Somebody',
      artworkUrl: 'https://i.scdn.co/image/album-art',
      durationMs: 213573,
      sourceUrl: 'https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8',
    });
  });

  test('falls back from track artwork to playlist artwork on Spotify playlists', () => {
    const html = `
<!DOCTYPE html>
<html>
  <body>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"state":{"data":{"entity":{"type":"playlist","name":"Pop Mix","uri":"spotify:playlist:37i9dQZF1E37peeAkY9IZs","id":"37i9dQZF1E37peeAkY9IZs","title":"Pop Mix","subtitle":"Spotify","coverArt":{"sources":[{"url":"https://i.scdn.co/image/playlist-art"}]},"trackList":[{"uri":"spotify:track:4o6BgsqLIBViaGVbx5rbRk","title":"You Make My Dreams (Come True)","subtitle":"Daryl Hall & John Oates","duration":190626}]}}}}}}</script>
  </body>
</html>
`;

    const playlist = provider.parseCollectionHtml(
      html,
      'https://open.spotify.com/playlist/37i9dQZF1E37peeAkY9IZs'
    );

    expect(playlist.artworkUrl).toBe('https://i.scdn.co/image/playlist-art');
    expect(playlist.tracks[0]?.artworkUrl).toBe(
      'https://i.scdn.co/image/playlist-art'
    );
  });

  test('enriches playlist tracks with track page artwork and album metadata', async () => {
    spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          `
<!DOCTYPE html>
<html>
  <body>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"state":{"data":{"entity":{"type":"playlist","name":"Pop Mix","uri":"spotify:playlist:37i9dQZF1E37peeAkY9IZs","id":"37i9dQZF1E37peeAkY9IZs","title":"Pop Mix","subtitle":"Spotify","coverArt":{"sources":[{"url":"https://i.scdn.co/image/playlist-art"}]},"trackList":[{"uri":"spotify:track:4o6BgsqLIBViaGVbx5rbRk","title":"You Make My Dreams (Come True)","subtitle":"Daryl Hall & John Oates","duration":190626}]}}}}}}</script>
  </body>
</html>
`,
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          `
<!DOCTYPE html>
<html>
  <head>
    <meta property="og:description" content="Daryl Hall &amp; John Oates · H2O · Song · 1980"/>
    <meta property="og:image" content="https://i.scdn.co/image/track-art"/>
    <meta name="music:album" content="https://open.spotify.com/album/10-track-album"/>
  </head>
</html>
`,
          { status: 200 }
        )
      );

    const playlist = await provider.fetch(
      'https://open.spotify.com/playlist/37i9dQZF1E37peeAkY9IZs',
      {}
    );

    expect(playlist.artworkUrl).toBe('https://i.scdn.co/image/playlist-art');
    expect(playlist.tracks[0]).toEqual({
      id: '4o6BgsqLIBViaGVbx5rbRk',
      title: 'You Make My Dreams (Come True)',
      artists: ['Daryl Hall & John Oates'],
      album: 'H2O',
      artworkUrl: 'https://i.scdn.co/image/track-art',
      durationMs: 190626,
      sourceUrl: 'https://open.spotify.com/track/4o6BgsqLIBViaGVbx5rbRk',
    });
  });

  test('fetches a Spotify track URL as a single-track playlist', async () => {
    spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          `
<!DOCTYPE html>
<html>
  <body>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"state":{"data":{"entity":{"type":"track","name":"Kookaburra Sits","uri":"spotify:track:1eJdXVLxLoMWu1TkaeSL18","id":"1eJdXVLxLoMWu1TkaeSL18","title":"Kookaburra Sits","artists":[{"name":"ABC Kids","uri":"spotify:artist:6l7J2uM3bM2BCh0tIPhWx8"}],"duration":57720,"visualIdentity":{"image":[{"url":"https://image-cdn-fa.spotifycdn.com/image/track-art"}]}}}}}}}</script>
  </body>
</html>
`,
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          `
<!DOCTYPE html>
<html>
  <head>
    <meta property="og:description" content="ABC Kids · Australia&#x27;s Favourite Nursery Rhymes · Song · 2004"/>
    <meta property="og:image" content="https://i.scdn.co/image/track-art-enriched"/>
  </head>
</html>
`,
          { status: 200 }
        )
      );

    const playlist = await provider.fetch(
      'https://open.spotify.com/track/1eJdXVLxLoMWu1TkaeSL18',
      {}
    );

    expect(playlist).toEqual({
      id: '1eJdXVLxLoMWu1TkaeSL18',
      title: 'Kookaburra Sits',
      owner: 'ABC Kids',
      artworkUrl: 'https://image-cdn-fa.spotifycdn.com/image/track-art',
      provider: 'spotify',
      sourceUrl: 'https://open.spotify.com/track/1eJdXVLxLoMWu1TkaeSL18',
      tracks: [
        {
          id: '1eJdXVLxLoMWu1TkaeSL18',
          title: 'Kookaburra Sits',
          artists: ['ABC Kids'],
          album: "Australia's Favourite Nursery Rhymes",
          artworkUrl: 'https://i.scdn.co/image/track-art-enriched',
          durationMs: 57720,
          sourceUrl: 'https://open.spotify.com/track/1eJdXVLxLoMWu1TkaeSL18',
        },
      ],
    });
  });

  test('keeps playlist-level artwork and title when track page enrichment fails', async () => {
    spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          `
<!DOCTYPE html>
<html>
  <body>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"state":{"data":{"entity":{"type":"playlist","name":"Pop Mix","uri":"spotify:playlist:37i9dQZF1E37peeAkY9IZs","id":"37i9dQZF1E37peeAkY9IZs","title":"Pop Mix","subtitle":"Spotify","coverArt":{"sources":[{"url":"https://i.scdn.co/image/playlist-art"}]},"trackList":[{"uri":"spotify:track:4o6BgsqLIBViaGVbx5rbRk","title":"You Make My Dreams (Come True)","subtitle":"Daryl Hall & John Oates","duration":190626}]}}}}}}</script>
  </body>
</html>
`,
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response('no metadata', { status: 500 }));

    const playlist = await provider.fetch(
      'https://open.spotify.com/playlist/37i9dQZF1E37peeAkY9IZs',
      {}
    );

    expect(playlist.tracks[0]).toEqual({
      id: '4o6BgsqLIBViaGVbx5rbRk',
      title: 'You Make My Dreams (Come True)',
      artists: ['Daryl Hall & John Oates'],
      album: 'Pop Mix',
      artworkUrl: 'https://i.scdn.co/image/playlist-art',
      durationMs: 190626,
      sourceUrl: 'https://open.spotify.com/track/4o6BgsqLIBViaGVbx5rbRk',
    });
  });
});
