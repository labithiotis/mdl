import { describe, expect, test } from 'bun:test';
import { AppleMusicProvider } from './AppleMusic';

const provider = new AppleMusicProvider();

const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
  <body>
    <script type="application/json" id="serialized-server-data">{"data":[{"id":"playlist-detail-header - pl.test","title":"New Music Daily","subtitleLinks":[{"title":"Apple Music"}],"artwork":{"dictionary":{"url":"https://is1-ssl.mzstatic.com/image/thumb/Features/v4/test/{w}x{h}SC.DN01.{f}"}},"contentDescriptor":{"kind":"playlist","identifiers":{"storeAdamID":"pl.test"},"url":"https://music.apple.com/us/playlist/new-music-daily/pl.test"}},{"id":"track-lockup - pl.test - 1868862384","title":"SWIM","artistName":"BTS","duration":159008,"artwork":{"dictionary":{"url":"https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/test/{w}x{h}bb.{f}"}},"tertiaryLinks":[{"title":"ARIRANG"}],"contentDescriptor":{"kind":"song","identifiers":{"storeAdamID":"1868862384"},"url":"https://music.apple.com/us/album/swim/1868862375?i=1868862384"}},{"id":"track-lockup - pl.test - 1871085694","title":"Click Clack Symphony. (feat. Hans Zimmer)","artistName":"RAYE","duration":301674,"artwork":{"dictionary":{"url":"https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/test-2/{w}x{h}bb.{f}"}},"tertiaryLinks":[{"title":"Album Name"}],"contentDescriptor":{"kind":"song","identifiers":{"storeAdamID":"1871085694"},"url":"https://music.apple.com/us/album/click-clack-symphony-feat-hans-zimmer/1871085677?i=1871085694"}}],"userTokenHash":""}</script>
  </body>
</html>
`;

describe('apple-music', () => {
  test('parses Apple Music playlist metadata from serialized page data', () => {
    const playlist = provider.parsePlaylistHtml(
      FIXTURE_HTML,
      'https://music.apple.com/us/playlist/new-music-daily/pl.test'
    );

    expect(playlist.provider).toBe('apple-music');
    expect(playlist.id).toBe('pl.test');
    expect(playlist.title).toBe('New Music Daily');
    expect(playlist.owner).toBe('Apple Music');
    expect(playlist.artworkUrl).toBe(
      'https://is1-ssl.mzstatic.com/image/thumb/Features/v4/test/1200x1200SC.DN01.jpg'
    );
    expect(playlist.tracks).toHaveLength(2);
    expect(playlist.tracks[0]).toEqual({
      id: '1868862384',
      title: 'SWIM',
      artists: ['BTS'],
      album: 'ARIRANG',
      artworkUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/test/1200x1200bb.jpg',
      durationMs: 159008,
      sourceUrl:
        'https://music.apple.com/us/album/swim/1868862375?i=1868862384',
    });
  });

  test('parses Apple Music album metadata from serialized page data', () => {
    const html = `
<!DOCTYPE html>
<html>
  <body>
    <script type="application/json" id="serialized-server-data">{"data":[{"id":"album-detail-header - 1440837083","title":"Whenever You Need Somebody","subtitleLinks":[{"title":"Rick Astley"}],"artwork":{"dictionary":{"url":"https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/album/{w}x{h}bb.{f}"}},"contentDescriptor":{"kind":"album","identifiers":{"storeAdamID":"1440837083"},"url":"https://music.apple.com/us/album/whenever-you-need-somebody/1440837083"}},{"id":"track-lockup - 1440837083 - 1440837084","title":"Never Gonna Give You Up","artistName":"Rick Astley","duration":213000,"artwork":{"dictionary":{"url":"https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/track/{w}x{h}bb.{f}"}},"tertiaryLinks":[{"title":"Whenever You Need Somebody"}],"contentDescriptor":{"kind":"song","identifiers":{"storeAdamID":"1440837084"},"url":"https://music.apple.com/us/album/never-gonna-give-you-up/1440837083?i=1440837084"}}],"userTokenHash":""}</script>
  </body>
</html>
`;

    const playlist = provider.parsePlaylistHtml(
      html,
      'https://music.apple.com/us/album/whenever-you-need-somebody/1440837083'
    );

    expect(playlist.id).toBe('1440837083');
    expect(playlist.title).toBe('Whenever You Need Somebody');
    expect(playlist.owner).toBe('Rick Astley');
    expect(playlist.tracks[0]).toEqual({
      id: '1440837084',
      title: 'Never Gonna Give You Up',
      artists: ['Rick Astley'],
      album: 'Whenever You Need Somebody',
      artworkUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/track/1200x1200bb.jpg',
      durationMs: 213000,
      sourceUrl:
        'https://music.apple.com/us/album/never-gonna-give-you-up/1440837083?i=1440837084',
    });
  });

  test('falls back to collection artwork when Apple Music track artwork is missing', () => {
    const html = `
<!DOCTYPE html>
<html>
  <body>
    <script type="application/json" id="serialized-server-data">{"data":[{"id":"playlist-detail-header - pl.test","title":"New Music Daily","subtitleLinks":[{"title":"Apple Music"}],"artwork":{"dictionary":{"url":"https://is1-ssl.mzstatic.com/image/thumb/Features/v4/test/{w}x{h}SC.DN01.{f}"}},"contentDescriptor":{"kind":"playlist","identifiers":{"storeAdamID":"pl.test"},"url":"https://music.apple.com/us/playlist/new-music-daily/pl.test"}},{"id":"track-lockup - pl.test - 1868862384","title":"SWIM","artistName":"BTS","duration":159008,"tertiaryLinks":[{"title":"ARIRANG"}],"contentDescriptor":{"kind":"song","identifiers":{"storeAdamID":"1868862384"},"url":"https://music.apple.com/us/album/swim/1868862375?i=1868862384"}}],"userTokenHash":""}</script>
  </body>
</html>
`;

    const playlist = provider.parsePlaylistHtml(
      html,
      'https://music.apple.com/us/playlist/new-music-daily/pl.test'
    );

    expect(playlist.tracks[0]?.artworkUrl).toBe(
      'https://is1-ssl.mzstatic.com/image/thumb/Features/v4/test/1200x1200SC.DN01.jpg'
    );
  });
});
