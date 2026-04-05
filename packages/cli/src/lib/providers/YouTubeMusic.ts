import { Innertube } from 'youtubei.js';
import { getYouTubeSessionOptions } from '../network';
import { playlistMetadataSchema } from '../schemas';
import type { PlaylistMetadata, PlaylistTrack } from '../types';
import { decodeUnknownSync, getFirstNonEmptyString } from '../utils';
import type { FetchOptions, ProviderOptions } from './Providers';

export class YouTubeMusicProvider implements ProviderOptions {
  public readonly provider = 'youtube-music';
  public readonly displayName = 'YouTube Music';
  private youtubeClientPromise: Promise<Innertube> | null = null;

  public matchesUrl(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    return (
      ['music.youtube.com', 'www.youtube.com', 'youtube.com'].includes(
        url.hostname.toLowerCase()
      ) &&
      (([/^\/playlist$/i].some((pattern) => pattern.test(pathname)) &&
        Boolean(url.searchParams.get('list'))) ||
        (/^\/watch$/i.test(pathname) && Boolean(url.searchParams.get('v'))) ||
        [
          /^\/browse\/(?:MPRE|FEmusic_library_privately_owned_release)[A-Za-z0-9_-]+$/i,
        ].some((pattern) => pattern.test(pathname)))
    );
  }

  public async fetch(
    url: string,
    _options: FetchOptions
  ): Promise<PlaylistMetadata> {
    const client = await this.getClient();
    const albumId = this.extractAlbumId(url);
    const videoId = this.extractVideoId(url);

    if (albumId) {
      const album = await client.music.getAlbum(albumId);
      const header = album.header as YTMusicHeader | undefined;
      const playlistId = this.extractPlaylistId(album.url ?? url);
      const collectionArtworkUrl =
        header?.thumbnail?.contents?.[0]?.url?.trim() || undefined;
      const tracks = album.contents
        .map((item, index) =>
          this.normalizeTrack(
            item as YTMusicListItem,
            index,
            playlistId,
            collectionArtworkUrl
          )
        )
        .filter((track): track is PlaylistTrack => track !== null);

      if (tracks.length === 0) {
        throw new Error('No tracks were found in the YouTube Music album.');
      }

      return decodeUnknownSync(playlistMetadataSchema, {
        id: albumId,
        title: header?.title?.toString?.().trim() || 'YouTube Music Album',
        artworkUrl: collectionArtworkUrl,
        provider: 'youtube-music',
        sourceUrl: album.url || url,
        tracks,
      });
    }

    if (videoId) {
      return this.fetchTrack(client, url, videoId);
    }

    const playlistId = this.extractPlaylistId(url);
    const { header, items } = await this.fetchPlaylistItems(client, playlistId);
    const tracks = items
      .map((item, index) =>
        this.normalizeTrack(
          item as YTMusicListItem,
          index,
          playlistId,
          header?.thumbnail?.contents?.[0]?.url?.trim() || undefined
        )
      )
      .filter((track): track is PlaylistTrack => track !== null);

    if (tracks.length === 0) {
      throw new Error('No tracks were found in the YouTube Music playlist.');
    }

    return decodeUnknownSync(playlistMetadataSchema, {
      id: playlistId,
      title: header?.title?.toString?.().trim() || 'YouTube Music Playlist',
      artworkUrl: header?.thumbnail?.contents?.[0]?.url?.trim() || undefined,
      provider: 'youtube-music',
      sourceUrl: url,
      tracks,
    });
  }

  private async fetchTrack(
    client: Innertube,
    sourceUrl: string,
    videoId: string
  ): Promise<PlaylistMetadata> {
    const playlistId = this.tryExtractPlaylistId(sourceUrl);

    if (playlistId) {
      const { header, items } = await this.fetchPlaylistItems(
        client,
        playlistId
      );
      const track = items
        .map((item, index) =>
          this.normalizeTrack(
            item as YTMusicListItem,
            index,
            playlistId,
            header?.thumbnail?.contents?.[0]?.url?.trim() || undefined
          )
        )
        .find((candidate) => candidate?.id === videoId);

      if (!track) {
        throw new Error(
          'Could not find the YouTube Music track in the playlist.'
        );
      }

      return decodeUnknownSync(playlistMetadataSchema, {
        id: track.id,
        title: track.title,
        owner: track.artists[0],
        artworkUrl: track.artworkUrl,
        provider: 'youtube-music',
        sourceUrl: track.sourceUrl || sourceUrl,
        tracks: [track],
      });
    }

    const info = await client.music.getInfo(videoId);
    const title = info.basic_info?.title?.trim();
    const artist = info.basic_info?.author?.trim();

    if (!title || !artist || !info.basic_info?.id) {
      throw new Error('Could not find YouTube Music track metadata.');
    }

    const track: PlaylistTrack = {
      id: info.basic_info.id,
      title,
      artists: [artist],
      artworkUrl: info.basic_info.thumbnail?.[0]?.url?.trim() || undefined,
      durationMs:
        typeof info.basic_info.duration === 'number'
          ? info.basic_info.duration * 1000
          : undefined,
      sourceUrl: info.basic_info.url_canonical?.trim() || sourceUrl,
    };

    return decodeUnknownSync(playlistMetadataSchema, {
      id: track.id,
      title: track.title,
      owner: artist,
      artworkUrl: track.artworkUrl,
      provider: 'youtube-music',
      sourceUrl: track.sourceUrl || sourceUrl,
      tracks: [track],
    });
  }

  private normalizeTrack(
    item: YTMusicListItem,
    _index: number,
    playlistId: string,
    collectionArtworkUrl?: string
  ): PlaylistTrack | null {
    if (item.item_type !== 'video') {
      return null;
    }

    const title = item.title?.toString?.().trim();
    const artists = this.extractContributorNames(item.artists, item.authors);

    if (!item.id || !title || artists.length === 0) {
      return null;
    }

    return {
      id: item.id,
      title,
      artists,
      album: item.album?.toString?.().trim() || undefined,
      artworkUrl: getFirstNonEmptyString(
        item.thumbnail?.contents?.[0]?.url,
        collectionArtworkUrl
      ),
      durationMs: this.parseDurationMs(item.duration?.toString?.()),
      sourceUrl: `https://music.youtube.com/watch?v=${item.id}&list=${playlistId}`,
    };
  }

  private extractContributorNames(
    artists?: YTMusicContributor[],
    authors?: YTMusicContributor[]
  ): string[] {
    const contributors = artists?.length ? artists : (authors ?? []);

    return contributors
      .map((contributor) =>
        typeof contributor === 'object' && 'name' in contributor
          ? contributor.name?.trim()
          : contributor?.toString?.().trim()
      )
      .filter((name): name is string => Boolean(name));
  }

  private extractPlaylistId(sourceUrl: string): string {
    const playlistId = this.tryExtractPlaylistId(sourceUrl);

    if (!playlistId) {
      throw new Error(
        'Could not determine the YouTube Music playlist id from the URL.'
      );
    }

    return playlistId;
  }

  private tryExtractPlaylistId(sourceUrl: string): string | null {
    return new URL(sourceUrl).searchParams.get('list')?.trim() || null;
  }

  private extractVideoId(sourceUrl: string): string | null {
    const parsedUrl = new URL(sourceUrl);
    if (!/^\/watch$/i.test(parsedUrl.pathname)) {
      return null;
    }

    return parsedUrl.searchParams.get('v')?.trim() || null;
  }

  private extractAlbumId(sourceUrl: string): string | null {
    const match = new URL(sourceUrl).pathname.match(
      /\/browse\/((?:MPRE|FEmusic_library_privately_owned_release)[A-Za-z0-9_-]+)/i
    );

    return match?.[1] ?? null;
  }

  private parseDurationMs(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parts = value
      .split(':')
      .map((part) => Number.parseInt(part, 10))
      .filter((part) => Number.isFinite(part));

    if (parts.length < 2 || parts.length > 3) {
      return undefined;
    }

    const [hours, minutes, seconds] =
      parts.length === 3 ? parts : [0, parts[0], parts[1]];

    return ((hours * 60 + minutes) * 60 + seconds) * 1000;
  }

  private async getClient(): Promise<Innertube> {
    this.youtubeClientPromise ??= Innertube.create(getYouTubeSessionOptions());
    return this.youtubeClientPromise;
  }

  private async fetchPlaylistItems(
    client: Innertube,
    playlistId: string
  ): Promise<{ header: YTMusicHeader | undefined; items: unknown[] }> {
    let page = await client.music.getPlaylist(playlistId);
    const items = [...page.items];

    while (page.has_continuation) {
      page = await page.getContinuation();
      items.push(...page.items);
    }

    return {
      header: page.header as YTMusicHeader | undefined,
      items,
    };
  }
}

type YTMusicListItem = {
  id?: string;
  album?: { toString?: () => string };
  artists?: YTMusicContributor[];
  authors?: YTMusicContributor[];
  duration?: { toString?: () => string };
  item_type?: string;
  thumbnail?: {
    contents?: Array<{
      url?: string;
    }>;
  };
  title?: { toString?: () => string };
};

type YTMusicContributor = { name?: string } | { toString?: () => string };

type YTMusicHeader = {
  thumbnail?: {
    contents?: Array<{
      url?: string;
    }>;
  };
  title?: { toString?: () => string };
};
