import type { PlaylistMetadata, PlaylistTrack } from '../types';
import { getFirstNonEmptyString } from '../utils';
import type { FetchOptions, ProviderOptions } from './Providers';

export class DeezerProvider implements ProviderOptions {
  public readonly provider = 'deezer';
  public readonly displayName = 'Deezer';
  public readonly shortLinkHosts = [
    'deezer.page.link',
    'link.deezer.com',
  ] as const;

  public matchesUrl(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    return (
      ['deezer.com', 'www.deezer.com'].includes(url.hostname.toLowerCase()) &&
      [
        /^\/album\/\d+(?:\/)?$/i,
        /^\/playlist\/\d+(?:\/)?$/i,
        /^\/track\/\d+(?:\/)?$/i,
        /^\/[a-z]{2}(?:-[a-z]{2})?\/album\/\d+(?:\/)?$/i,
        /^\/[a-z]{2}(?:-[a-z]{2})?\/playlist\/\d+(?:\/)?$/i,
        /^\/[a-z]{2}(?:-[a-z]{2})?\/track\/\d+(?:\/)?$/i,
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
    const endpoint = `https://api.deezer.com/${collectionKind}/${collectionId}`;

    if (collectionKind === 'track') {
      return this.fetchTrack(url, endpoint, signal);
    }

    const collectionResponse = await this.fetchJson<
      DeezerPlaylistResponse & { tracks?: DeezerTrackResponse }
    >(endpoint, signal);
    const tracks =
      collectionKind === 'album'
        ? (collectionResponse.tracks?.data ?? [])
        : await this.fetchAllTracks(`${endpoint}/tracks?limit=100`, signal);
    const collectionArtworkUrl =
      collectionResponse.picture_xl?.trim() || undefined;

    const normalizedTracks = tracks
      .map((track) => this.normalizeTrack(track, collectionArtworkUrl))
      .filter((track): track is PlaylistTrack => track !== null);

    if (normalizedTracks.length === 0) {
      throw new Error(`No tracks were found in the Deezer ${collectionKind}.`);
    }

    return {
      id: String(collectionResponse.id ?? collectionId),
      title:
        collectionResponse.title?.trim() ||
        `Deezer ${collectionKind === 'album' ? 'Album' : 'Playlist'}`,
      owner:
        collectionResponse.creator?.name?.trim() ||
        collectionResponse.artist?.name?.trim() ||
        undefined,
      artworkUrl: collectionArtworkUrl,
      provider: 'deezer',
      sourceUrl: collectionResponse.link?.trim() || url,
      tracks: normalizedTracks,
    };
  }

  private async fetchTrack(
    sourceUrl: string,
    endpoint: string,
    signal?: AbortSignal
  ): Promise<PlaylistMetadata> {
    const trackResponse = await this.fetchJson<DeezerTrackItem>(
      endpoint,
      signal
    );
    const track = this.normalizeTrack(trackResponse);

    if (!track) {
      throw new Error('No track was found in the Deezer response.');
    }

    return {
      id: track.id,
      title: track.title,
      owner: track.artists[0],
      artworkUrl: track.artworkUrl,
      provider: 'deezer',
      sourceUrl: track.sourceUrl || sourceUrl,
      tracks: [track],
    };
  }

  private normalizeTrack(
    track: DeezerTrackItem,
    collectionArtworkUrl?: string
  ): PlaylistTrack | null {
    const title = track.title?.trim();
    const artist = track.artist?.name?.trim();

    if (!title || !artist) {
      return null;
    }

    return {
      id: String(track.id ?? `${artist}-${title}`),
      title,
      artists: [artist],
      album: track.album?.title?.trim() || undefined,
      artworkUrl: getFirstNonEmptyString(
        track.album?.cover_xl,
        collectionArtworkUrl
      ),
      durationMs:
        typeof track.duration === 'number' && Number.isFinite(track.duration)
          ? Math.round(track.duration * 1000)
          : undefined,
      sourceUrl: track.link?.trim() || undefined,
    };
  }

  private async fetchAllTracks(
    nextUrl: string,
    signal?: AbortSignal
  ): Promise<DeezerTrackItem[]> {
    const tracks: DeezerTrackItem[] = [];
    let cursor: string | undefined = nextUrl;

    while (cursor) {
      const response: DeezerTrackResponse =
        await this.fetchJson<DeezerTrackResponse>(cursor, signal);
      tracks.push(...(response.data ?? []));
      cursor = response.next?.trim() || undefined;
    }

    return tracks;
  }

  private async fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Deezer request failed with status ${response.status}.`);
    }

    return (await response.json()) as T;
  }

  private extractCollectionId(sourceUrl: string): string {
    const parsedUrl = new URL(sourceUrl);
    const match = parsedUrl.pathname.match(
      /\/(?:album|playlist|track)\/(\d+)/i
    );

    if (!match?.[1]) {
      throw new Error(
        'Could not determine the Deezer collection id from the URL.'
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

type DeezerPlaylistResponse = {
  artist?: {
    name?: string;
  };
  creator?: {
    name?: string;
  };
  id?: number;
  link?: string;
  picture_xl?: string;
  title?: string;
};

type DeezerTrackResponse = {
  data?: DeezerTrackItem[];
  next?: string;
};

type DeezerTrackItem = {
  album?: {
    cover_xl?: string;
    title?: string;
  };
  artist?: {
    name?: string;
  };
  duration?: number;
  id?: number;
  link?: string;
  title?: string;
};
