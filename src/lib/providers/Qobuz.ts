import type { PlaylistMetadata, PlaylistTrack } from '../types';
import { getFirstNonEmptyString } from '../utils';
import type { FetchOptions, ProviderOptions } from './Providers';

const QOBUZ_MAIN_JS_URL = 'https://open.qobuz.com/resources/2.2.2/js/main.js';

export class QobuzProvider implements ProviderOptions {
  public readonly provider = 'qobuz';
  public readonly displayName = 'Qobuz';
  public readonly shortLinkHosts = ['open.qobuz.com'] as const;
  private cachedAppId: string | null = null;

  public matchesUrl(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    return (
      [
        'open.qobuz.com',
        'play.qobuz.com',
        'www.qobuz.com',
        'qobuz.com',
      ].includes(url.hostname.toLowerCase()) &&
      [
        /^\/album\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/playlist\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/track\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/[a-z]{2}-[a-z]{2}\/album\/[^/]+\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/[a-z]{2}-[a-z]{2}\/playlists\/[^/]+\/[A-Za-z0-9]+(?:\/)?$/i,
      ].some((pattern) => pattern.test(pathname))
    );
  }

  public async fetch(
    url: string,
    options: FetchOptions
  ): Promise<PlaylistMetadata> {
    const { signal } = options;
    const collectionKind = this.getCollectionKind(url);
    const collectionId = this.extractCollectionId(url);
    const appId = await this.resolveAppId(signal);
    if (collectionKind === 'track') {
      return this.fetchTrack(url, collectionId, appId, signal);
    }
    const payload =
      collectionKind === 'album'
        ? await this.fetchAlbumPayload(collectionId, appId, signal)
        : await this.fetchPlaylistPayload(collectionId, appId, signal);
    const collectionArtworkUrl = getFirstNonEmptyString(
      payload.images300?.[0],
      payload.image?.large,
      payload.image?.small,
      payload.image?.thumbnail
    );
    const tracks = (payload.tracks?.items ?? [])
      .map((track) => this.normalizeTrack(track, collectionArtworkUrl))
      .filter((track): track is PlaylistTrack => track !== null);

    if (tracks.length === 0) {
      throw new Error(`No tracks were found in the Qobuz ${collectionKind}.`);
    }

    return {
      id: String(payload.id ?? collectionId),
      title:
        payload.name?.trim() ||
        `Qobuz ${collectionKind === 'album' ? 'Album' : 'Playlist'}`,
      owner:
        payload.owner?.name?.trim() ||
        payload.artist?.name?.trim() ||
        undefined,
      artworkUrl: collectionArtworkUrl,
      provider: 'qobuz',
      sourceUrl: payload.url?.trim() || url,
      tracks,
    };
  }

  private async fetchTrack(
    sourceUrl: string,
    trackId: string,
    appId: string,
    signal?: AbortSignal
  ): Promise<PlaylistMetadata> {
    const payload = await this.fetchTrackPayload(trackId, appId, signal);
    const track = this.normalizeTrack(payload);

    if (!track) {
      throw new Error('No track was found in the Qobuz response.');
    }

    return {
      id: track.id,
      title: track.title,
      owner: track.artists[0],
      artworkUrl: track.artworkUrl,
      provider: 'qobuz',
      sourceUrl: track.sourceUrl || sourceUrl,
      tracks: [track],
    };
  }

  private normalizeTrack(
    track: QobuzTrackItem,
    collectionArtworkUrl?: string
  ): PlaylistTrack | null {
    const title = track.title?.trim();
    const artist = track.performer?.name?.trim();

    if (!title || !artist) {
      return null;
    }

    return {
      id: String(track.id ?? `${artist}-${title}`),
      title,
      artists: [artist],
      album: track.album?.title?.trim() || undefined,
      artworkUrl: getFirstNonEmptyString(
        track.album?.image?.large,
        track.album?.image?.small,
        track.album?.image?.thumbnail,
        collectionArtworkUrl
      ),
      durationMs:
        typeof track.duration === 'number' && Number.isFinite(track.duration)
          ? Math.round(track.duration * 1000)
          : undefined,
      sourceUrl: track.id
        ? `https://open.qobuz.com/track/${track.id}`
        : undefined,
    };
  }

  private async fetchPlaylistPayload(
    playlistId: string,
    appId: string,
    signal?: AbortSignal
  ): Promise<QobuzPlaylistResponse> {
    const url = new URL('https://www.qobuz.com/api.json/0.2/playlist/get');
    url.searchParams.set('playlist_id', playlistId);
    url.searchParams.set('app_id', appId);
    url.searchParams.set('extra', 'tracks');
    url.searchParams.set('limit', '500');

    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Qobuz request failed with status ${response.status}.`);
    }

    return (await response.json()) as QobuzPlaylistResponse;
  }

  private async fetchAlbumPayload(
    albumId: string,
    appId: string,
    signal?: AbortSignal
  ): Promise<QobuzPlaylistResponse> {
    const url = new URL('https://www.qobuz.com/api.json/0.2/album/get');
    url.searchParams.set('album_id', albumId);
    url.searchParams.set('app_id', appId);

    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Qobuz request failed with status ${response.status}.`);
    }

    return (await response.json()) as QobuzPlaylistResponse;
  }

  private async fetchTrackPayload(
    trackId: string,
    appId: string,
    signal?: AbortSignal
  ): Promise<QobuzTrackItem> {
    const url = new URL('https://www.qobuz.com/api.json/0.2/track/get');
    url.searchParams.set('track_id', trackId);
    url.searchParams.set('app_id', appId);

    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Qobuz request failed with status ${response.status}.`);
    }

    return (await response.json()) as QobuzTrackItem;
  }

  private async resolveAppId(signal?: AbortSignal): Promise<string> {
    if (this.cachedAppId) {
      return this.cachedAppId;
    }

    const response = await fetch(QOBUZ_MAIN_JS_URL, {
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Qobuz app config request failed with status ${response.status}.`
      );
    }

    const source = await response.text();
    const match =
      source.match(/qobuzapi=\{app_id:"(\d+)"/) ??
      source.match(/APP_ID:"(\d+)"/);

    if (!match?.[1]) {
      throw new Error('Could not determine the Qobuz app id.');
    }

    this.cachedAppId = match[1];
    return this.cachedAppId;
  }

  private extractCollectionId(sourceUrl: string): string {
    const parsedUrl = new URL(sourceUrl);
    const match = parsedUrl.pathname.match(
      /\/(?:track|album|playlist|[a-z]{2}-[a-z]{2}\/album\/[^/]+|[a-z]{2}-[a-z]{2}\/playlists\/[^/]+)\/([A-Za-z0-9]+)\/?$/i
    );

    if (!match?.[1]) {
      throw new Error(
        'Could not determine the Qobuz collection id from the URL.'
      );
    }

    return match[1];
  }

  private getCollectionKind(sourceUrl: string): 'album' | 'playlist' | 'track' {
    const pathname = new URL(sourceUrl).pathname;

    if (pathname.includes('/album/')) {
      return 'album';
    }

    if (pathname.includes('/track/')) {
      return 'track';
    }

    return 'playlist';
  }
}

type QobuzPlaylistResponse = {
  artist?: {
    name?: string;
  };
  id?: number;
  image?: {
    large?: string;
    small?: string;
    thumbnail?: string;
  };
  images300?: string[];
  name?: string;
  owner?: {
    name?: string;
  };
  tracks?: {
    items?: QobuzTrackItem[];
    total?: number;
  };
  url?: string;
};

type QobuzTrackItem = {
  album?: {
    image?: {
      large?: string;
      small?: string;
      thumbnail?: string;
    };
    title?: string;
  };
  duration?: number;
  id?: number;
  performer?: {
    name?: string;
  };
  title?: string;
};
