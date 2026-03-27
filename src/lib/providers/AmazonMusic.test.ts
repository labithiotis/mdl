import { describe, expect, test } from 'bun:test';
import { AmazonMusicProvider } from './AmazonMusic';

const provider = new AmazonMusicProvider();

describe('amazon-music', () => {
  test('parses Amazon Music playlist metadata from crawler-facing HTML', () => {
    const html = `
  <html>
    <head>
      <meta property="og:title" content="Your all-access playlist">
      <meta property="og:description" content="Playlist by emjai00916">
      <meta property="og:image" content="https://m.media-amazon.com/images/I/example.jpg">
      <meta property="music:song" content="https://music.amazon.com/user-playlists/test?do=play&amp;trackAsin=B09DS24Z6F">
      <meta property="music:song" content="https://music.amazon.com/user-playlists/test?do=play&amp;trackAsin=B08T74NL63">
    </head>
  </html>
  `;

    expect(provider.parsePlaylistHtml(html)).toEqual({
      artworkUrl: 'https://m.media-amazon.com/images/I/example.jpg',
      owner: 'emjai00916',
      title: 'Your all-access playlist',
      trackAsins: ['B09DS24Z6F', 'B08T74NL63'],
    });
  });

  test('parses Amazon Music album metadata from crawler-facing HTML', () => {
    const html = `
  <html>
    <head>
      <meta property="og:title" content="Whenever You Need Somebody">
      <meta property="og:image" content="https://m.media-amazon.com/images/I/album.jpg">
      <meta property="music:song" content="https://music.amazon.com/albums/B09DS56JYZ?trackAsin&#x3D;B09DS24Z6F">
      <meta property="music:song" content="https://music.amazon.com/albums/B09DS56JYZ?trackAsin&#x3D;B08T74NL63">
    </head>
  </html>
  `;

    expect(provider.parsePlaylistHtml(html)).toEqual({
      artworkUrl: 'https://m.media-amazon.com/images/I/album.jpg',
      owner: undefined,
      title: 'Whenever You Need Somebody',
      trackAsins: ['B09DS24Z6F', 'B08T74NL63'],
    });
  });

  test('parses Amazon Music track metadata from crawler-facing HTML', () => {
    const html = `
  <html>
    <head>
      <meta property="og:title" content="Antarctica [Explicit]">
      <meta property="og:image" content="https://m.media-amazon.com/images/I/track.jpg">
      <meta property="al:web:url" content="https://music.amazon.com/albums/B09DS56JYZ?trackAsin&#x3D;B09DS24Z6F">
      <meta property="music:album" content="https://music.amazon.com/albums/B09DS56JYZ">
      <meta property="music:musician" content="https://music.amazon.com/artists/B01HG4E4LI">
      <meta property="music:duration" content="126">
    </head>
  </html>
  `;

    expect(provider.parseTrackHtml(html)).toEqual({
      albumUrl: 'https://music.amazon.com/albums/B09DS56JYZ',
      artistUrl: 'https://music.amazon.com/artists/B01HG4E4LI',
      artworkUrl: 'https://m.media-amazon.com/images/I/track.jpg',
      durationMs: 126000,
      sourceUrl:
        'https://music.amazon.com/albums/B09DS56JYZ?trackAsin=B09DS24Z6F',
      title: 'Antarctica [Explicit]',
    });
  });
});
