import { describe, expect, test } from 'bun:test';
import { TidalProvider } from './Tidal';

const provider = new TidalProvider();

describe('tidal', () => {
  test('parses Tidal playlist metadata from public page HTML', () => {
    const html = `
  <html>
    <head>
      <meta property="og:title" content="Pop Hits">
      <meta property="og:description" content="Playlist - Pop Hits - 50 items">
      <meta property="og:image" content="//resources.tidal.com/images/example/1080x1080.jpg">
      <meta property="og:url" content="https://tidal.com/playlist/36ea71a8-445e-41a4-82ab-6628c581535d">
    </head>
  </html>
  `;

    expect(
      provider.parsePlaylistHtml(
        html,
        'https://tidal.com/playlist/36ea71a8-445e-41a4-82ab-6628c581535d'
      )
    ).toEqual({
      title: 'Pop Hits',
      owner: undefined,
      artworkUrl: 'https://resources.tidal.com/images/example/1080x1080.jpg',
      sourceUrl:
        'https://tidal.com/playlist/36ea71a8-445e-41a4-82ab-6628c581535d',
    });
  });

  test('parses Tidal album metadata from public page HTML', () => {
    const html = `
  <html>
    <head>
      <meta property="og:title" content="Weezer (Teal Album)">
      <meta property="og:image" content="//resources.tidal.com/images/example/1080x1080.jpg">
      <meta property="og:url" content="https://tidal.com/album/102948177">
    </head>
  </html>
  `;

    expect(
      provider.parsePlaylistHtml(html, 'https://tidal.com/album/102948177')
    ).toEqual({
      title: 'Weezer (Teal Album)',
      owner: undefined,
      artworkUrl: 'https://resources.tidal.com/images/example/1080x1080.jpg',
      sourceUrl: 'https://tidal.com/album/102948177',
    });
  });
});
