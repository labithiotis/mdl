import { afterEach, describe, expect, mock, test } from 'bun:test';

type MockContributor = {
  name?: string;
  toString?: () => string;
};

const mockCreate = mock();

mock.module('youtubei.js', () => ({
  Innertube: {
    create: mockCreate,
  },
}));

describe('youtube-music', () => {
  afterEach(() => {
    mockCreate.mockReset();
  });

  test('provider fetch parses playlist items across continuations', async () => {
    const firstTrackArtists: MockContributor[] = [
      { name: 'Artist One' },
      { toString: () => 'Artist Guest' },
    ];

    const continuationPage = {
      getContinuation: mock(),
      has_continuation: false,
      header: {
        thumbnail: { contents: [{ url: 'https://i.ytimg.com/playlist.jpg' }] },
        title: { toString: () => 'Focus Mix' },
      },
      items: [
        {
          id: 'video-2',
          item_type: 'video',
          title: { toString: () => 'Second Song' },
          artists: [{ name: 'Artist Two' }],
          album: { toString: () => 'Second Album' },
          duration: { toString: () => '4:05' },
          thumbnail: { contents: [{ url: 'https://i.ytimg.com/track-2.jpg' }] },
        },
      ],
    };
    const firstPage = {
      getContinuation: mock().mockResolvedValue(continuationPage),
      has_continuation: true,
      items: [
        {
          id: 'video-1',
          item_type: 'video',
          title: { toString: () => 'First Song' },
          artists: firstTrackArtists,
          album: { toString: () => 'First Album' },
          duration: { toString: () => '3:30' },
        },
        {
          id: 'shelf-item',
          item_type: 'artist',
          title: { toString: () => 'Ignore Me' },
          artists: [{ name: 'Nope' }],
        },
      ],
    };

    mockCreate.mockResolvedValue({
      music: {
        getAlbum: mock(),
        getPlaylist: mock().mockResolvedValue(firstPage),
      },
    });

    const { YouTubeMusicProvider } = await import('./YouTubeMusic');
    const playlist = await new YouTubeMusicProvider().fetch(
      'https://music.youtube.com/playlist?list=PL_TEST',
      {}
    );

    expect(playlist.provider).toBe('youtube-music');
    expect(playlist.id).toBe('PL_TEST');
    expect(playlist.title).toBe('Focus Mix');
    expect(playlist.artworkUrl).toBe('https://i.ytimg.com/playlist.jpg');
    expect(playlist.sourceUrl).toBe(
      'https://music.youtube.com/playlist?list=PL_TEST'
    );
    expect(playlist.tracks).toEqual([
      {
        id: 'video-1',
        title: 'First Song',
        artists: ['Artist One', 'Artist Guest'],
        album: 'First Album',
        artworkUrl: 'https://i.ytimg.com/playlist.jpg',
        durationMs: 210000,
        sourceUrl: 'https://music.youtube.com/watch?v=video-1&list=PL_TEST',
      },
      {
        id: 'video-2',
        title: 'Second Song',
        artists: ['Artist Two'],
        album: 'Second Album',
        artworkUrl: 'https://i.ytimg.com/track-2.jpg',
        durationMs: 245000,
        sourceUrl: 'https://music.youtube.com/watch?v=video-2&list=PL_TEST',
      },
    ]);
  });

  test('provider fetch falls back to authors when artists are absent', async () => {
    const authorsOnlyContributors: MockContributor[] = [
      { name: 'Author One' },
      { toString: () => 'Guest Two' },
    ];

    mockCreate.mockResolvedValue({
      music: {
        getAlbum: mock(),
        getPlaylist: mock().mockResolvedValue({
          getContinuation: mock(),
          has_continuation: false,
          header: {
            thumbnail: {
              contents: [{ url: 'https://i.ytimg.com/authors-playlist.jpg' }],
            },
            title: { toString: () => 'Authors Mix' },
          },
          items: [
            {
              id: 'authors-track-1',
              item_type: 'video',
              title: { toString: () => 'Authors Song' },
              authors: authorsOnlyContributors,
              duration: { toString: () => '3:11' },
            },
          ],
        }),
      },
    });

    const { YouTubeMusicProvider } = await import('./YouTubeMusic');
    const playlist = await new YouTubeMusicProvider().fetch(
      'https://music.youtube.com/playlist?list=PL_AUTHORS_ONLY',
      {}
    );

    expect(playlist.tracks).toEqual([
      {
        id: 'authors-track-1',
        title: 'Authors Song',
        artists: ['Author One', 'Guest Two'],
        album: undefined,
        artworkUrl: 'https://i.ytimg.com/authors-playlist.jpg',
        durationMs: 191000,
        sourceUrl:
          'https://music.youtube.com/watch?v=authors-track-1&list=PL_AUTHORS_ONLY',
      },
    ]);
  });

  test('provider fetch parses album pages from browse urls', async () => {
    mockCreate.mockResolvedValue({
      music: {
        getAlbum: mock().mockResolvedValue({
          contents: [
            {
              id: 'album-track-1',
              item_type: 'video',
              title: { toString: () => 'Album Song' },
              artists: [{ name: 'Album Artist' }],
              album: { toString: () => 'Album Name' },
              duration: { toString: () => '1:02:03' },
            },
          ],
          header: {
            thumbnail: { contents: [{ url: 'https://i.ytimg.com/album.jpg' }] },
            title: { toString: () => 'Album Name' },
          },
          url: 'https://music.youtube.com/playlist?list=OLAK5uy_album_test',
        }),
        getPlaylist: mock(),
      },
    });

    const { YouTubeMusicProvider } = await import('./YouTubeMusic');
    const playlist = await new YouTubeMusicProvider().fetch(
      'https://music.youtube.com/browse/MPREb_test_album_id',
      {}
    );

    expect(playlist.provider).toBe('youtube-music');
    expect(playlist.id).toBe('MPREb_test_album_id');
    expect(playlist.title).toBe('Album Name');
    expect(playlist.artworkUrl).toBe('https://i.ytimg.com/album.jpg');
    expect(playlist.sourceUrl).toBe(
      'https://music.youtube.com/playlist?list=OLAK5uy_album_test'
    );
    expect(playlist.tracks).toEqual([
      {
        id: 'album-track-1',
        title: 'Album Song',
        artists: ['Album Artist'],
        album: 'Album Name',
        artworkUrl: 'https://i.ytimg.com/album.jpg',
        durationMs: 3723000,
        sourceUrl:
          'https://music.youtube.com/watch?v=album-track-1&list=OLAK5uy_album_test',
      },
    ]);
  });
});
