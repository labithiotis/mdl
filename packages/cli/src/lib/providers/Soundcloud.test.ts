import { describe, expect, test } from 'bun:test';
import { SoundCloudProvider } from './SoundCloud';

const provider = new SoundCloudProvider();

describe('soundcloud', () => {
  test('parses SoundCloud playlist hydration data into playlist metadata', () => {
    const html = `
<!DOCTYPE html>
<html>
  <body>
    <script>window.__sc_hydration = [{"hydratable":"playlist","data":{"id":445566,"title":"Focus Flow","artwork_url":"https://i1.sndcdn.com/artworks-playlist.jpg","permalink_url":"https://soundcloud.com/dj-test/sets/focus-flow","user":{"username":"DJ Test"},"tracks":[{"id":11,"title":"First Cut","duration":213123,"artwork_url":"https://i1.sndcdn.com/artworks-track.jpg","permalink_url":"https://soundcloud.com/artist-one/first-cut","publisher_metadata":{"artist":"Artist One","album_title":"Album One"}},{"id":12,"title":"Second Cut","duration":180000,"artwork_url":null,"permalink_url":"https://soundcloud.com/uploader/second-cut","user":{"username":"Uploader Two"}}]}}];</script>
  </body>
</html>
`;

    const playlist = provider.parsePlaylistHtml(
      html,
      'https://soundcloud.com/dj-test/sets/focus-flow'
    );

    expect(playlist.provider).toBe('soundcloud');
    expect(playlist.id).toBe('445566');
    expect(playlist.title).toBe('Focus Flow');
    expect(playlist.owner).toBe('DJ Test');
    expect(playlist.artworkUrl).toBe(
      'https://i1.sndcdn.com/artworks-playlist.jpg'
    );
    expect(playlist.sourceUrl).toBe(
      'https://soundcloud.com/dj-test/sets/focus-flow'
    );
    expect(playlist.tracks).toEqual([
      {
        id: '11',
        title: 'First Cut',
        artists: ['Artist One'],
        album: 'Album One',
        artworkUrl: 'https://i1.sndcdn.com/artworks-track.jpg',
        durationMs: 213123,
        sourceUrl: 'https://soundcloud.com/artist-one/first-cut',
      },
      {
        id: '12',
        title: 'Second Cut',
        artists: ['Uploader Two'],
        album: undefined,
        artworkUrl: 'https://i1.sndcdn.com/artworks-playlist.jpg',
        durationMs: 180000,
        sourceUrl: 'https://soundcloud.com/uploader/second-cut',
      },
    ]);
  });
});
