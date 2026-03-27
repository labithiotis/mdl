import type { PlaylistMetadata, PlaylistTrack } from '../types';
import { getFirstNonEmptyString } from '../utils';
import type { FetchOptions, ProviderOptions } from './Providers';

const TIDAL_GRAPHQL_URL = 'https://gqlapi.tidal.com/';

export class TidalProvider implements ProviderOptions {
  public readonly provider = 'tidal';
  public readonly displayName = 'Tidal';

  public matchesUrl(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    return (
      ['tidal.com', 'listen.tidal.com'].includes(url.hostname.toLowerCase()) &&
      [
        /^\/browse\/album\/\d+(?:\/)?$/i,
        /^\/browse\/playlist\/[0-9a-f-]+(?:\/)?$/i,
        /^\/album\/\d+(?:\/)?$/i,
        /^\/playlist\/[0-9a-f-]+(?:\/)?$/i,
      ].some((pattern) => pattern.test(pathname))
    );
  }

  public async fetch(
    url: string,
    options: FetchOptions
  ): Promise<PlaylistMetadata> {
    const { signal } = options;
    const collectionKind = this.getCollectionKind(url);

    if (collectionKind === 'album') {
      return this.fetchAlbum(url, signal);
    }

    const playlistId = this.extractCollectionId(url);
    const [html, tracksPayload] = await Promise.all([
      this.fetchPlaylistHtml(url, signal),
      this.fetchPlaylistTracks(playlistId, signal),
    ]);

    const metadata = this.parsePlaylistHtml(html, url);
    const collectionArtworkUrl = metadata.artworkUrl;
    const tracks = (tracksPayload.data?.playlistTracks?.items ?? [])
      .map((track) => this.normalizeTrack(track, collectionArtworkUrl))
      .filter((track): track is PlaylistTrack => track !== null);

    if (tracks.length === 0) {
      throw new Error('No tracks were found in the Tidal playlist.');
    }

    return {
      id: playlistId,
      title: metadata.title,
      owner: metadata.owner,
      artworkUrl: metadata.artworkUrl,
      provider: 'tidal',
      sourceUrl: metadata.sourceUrl,
      tracks,
    };
  }

  public parsePlaylistHtml(
    html: string,
    sourceUrl: string
  ): Omit<PlaylistMetadata, 'id' | 'provider' | 'tracks'> {
    const title = this.extractMetaContent(html, 'property', 'og:title')?.trim();

    if (!title) {
      throw new Error('Could not find Tidal playlist metadata in the page.');
    }

    return {
      title,
      owner: this.extractOwner(html),
      artworkUrl: this.normalizeAssetUrl(
        this.extractMetaContent(html, 'property', 'og:image')?.trim()
      ),
      sourceUrl:
        this.extractMetaContent(html, 'property', 'og:url')?.trim() ||
        sourceUrl,
    };
  }

  private async fetchAlbum(
    sourceUrl: string,
    signal?: AbortSignal
  ): Promise<PlaylistMetadata> {
    const albumId = Number.parseInt(this.extractCollectionId(sourceUrl), 10);
    const payload = await this.fetchAlbumData(albumId, signal);
    const album = payload.data?.album;
    const collectionArtworkUrl = this.normalizeAssetUrl(
      album?.image?.original ||
        album?.image?.large ||
        album?.image?.medium ||
        album?.image?.small ||
        album?.image?.xsmall ||
        undefined
    );
    const tracks = (album?.tracks ?? [])
      .map((track) => this.normalizeTrack(track, collectionArtworkUrl))
      .filter((track): track is PlaylistTrack => track !== null);

    if (!album?.title) {
      throw new Error('Could not find Tidal album metadata in the response.');
    }

    if (tracks.length === 0) {
      throw new Error('No tracks were found in the Tidal album.');
    }

    return {
      id: String(album.id ?? albumId),
      title: album.title.trim(),
      owner: album.artists?.[0]?.name?.trim() || undefined,
      artworkUrl: collectionArtworkUrl,
      provider: 'tidal',
      sourceUrl,
      tracks,
    };
  }

  private async fetchPlaylistHtml(
    sourceUrl: string,
    signal?: AbortSignal
  ): Promise<string> {
    const response = await fetch(sourceUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Tidal playlist request failed with status ${response.status}.`
      );
    }

    return response.text();
  }

  private async fetchPlaylistTracks(
    playlistId: string,
    signal?: AbortSignal
  ): Promise<TidalPlaylistTracksResponse> {
    const response = await fetch(TIDAL_GRAPHQL_URL, {
      body: JSON.stringify({
        query: `
        query ($playlistId: String!) {
          playlistTracks(uuid: $playlistId) {
            items {
              album { title }
              artists { name }
              duration
              id
              image { original large medium small xsmall }
              title
            }
          }
        }
      `,
        variables: {
          playlistId,
        },
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Tidal track request failed with status ${response.status}.`
      );
    }

    const payload = (await response.json()) as TidalPlaylistTracksResponse;
    const errorMessage = payload.errors?.find(
      (error) => error.message
    )?.message;

    if (errorMessage) {
      throw new Error(`Tidal track request failed: ${errorMessage}`);
    }

    return payload;
  }

  private async fetchAlbumData(
    albumId: number,
    signal?: AbortSignal
  ): Promise<TidalAlbumResponse> {
    const response = await fetch(TIDAL_GRAPHQL_URL, {
      body: JSON.stringify({
        query: `
        query ($albumId: BigInt!) {
          album(id: $albumId) {
            id
            title
            artists { name }
            image { original large medium small xsmall }
            tracks {
              album { title }
              artists { name }
              duration
              id
              image { original large medium small xsmall }
              title
            }
          }
        }
      `,
        variables: {
          albumId,
        },
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Tidal album request failed with status ${response.status}.`
      );
    }

    const payload = (await response.json()) as TidalAlbumResponse;
    const errorMessage = payload.errors?.find(
      (error) => error.message
    )?.message;

    if (errorMessage) {
      throw new Error(`Tidal album request failed: ${errorMessage}`);
    }

    return payload;
  }

  private normalizeTrack(
    track: TidalTrackItem,
    collectionArtworkUrl?: string
  ): PlaylistTrack | null {
    const title = track.title?.trim();
    const artists = (track.artists ?? [])
      .map((artist) => artist.name?.trim())
      .filter((artist): artist is string => Boolean(artist));

    if (!title || artists.length === 0) {
      return null;
    }

    return {
      id: String(track.id ?? `${artists.join(',')}-${title}`),
      title,
      artists,
      album: track.album?.title?.trim() || undefined,
      artworkUrl: getFirstNonEmptyString(
        this.normalizeAssetUrl(
          track.image?.original ||
            track.image?.large ||
            track.image?.medium ||
            track.image?.small ||
            track.image?.xsmall ||
            undefined
        ),
        collectionArtworkUrl
      ),
      durationMs:
        typeof track.duration === 'number' && Number.isFinite(track.duration)
          ? Math.round(track.duration * 1000)
          : undefined,
      sourceUrl: track.id
        ? `https://tidal.com/browse/track/${track.id}`
        : undefined,
    };
  }

  private extractOwner(html: string): string | undefined {
    const description =
      this.extractMetaContent(html, 'property', 'og:description')?.trim() ||
      this.extractMetaContent(html, 'name', 'description')?.trim();

    if (!description) {
      return undefined;
    }

    const match = description.match(/^Playlist by (.+)$/i);
    return match?.[1]?.trim() || undefined;
  }

  private extractMetaContent(
    html: string,
    attribute: 'name' | 'property',
    key: string
  ): string | undefined {
    const escapedKey = this.escapeRegExp(key);
    const pattern = new RegExp(
      `<meta[^>]+${attribute}=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    );

    return pattern.exec(html)?.[1];
  }

  private normalizeAssetUrl(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }

    return trimmed;
  }

  private extractCollectionId(sourceUrl: string): string {
    const parsedUrl = new URL(sourceUrl);
    const match = parsedUrl.pathname.match(
      /\/(?:album|playlist)\/([0-9a-z-]+)/i
    );

    if (!match?.[1]) {
      throw new Error(
        'Could not determine the Tidal collection id from the URL.'
      );
    }

    return match[1];
  }

  private getCollectionKind(sourceUrl: string): 'album' | 'playlist' {
    return new URL(sourceUrl).pathname.includes('/album/')
      ? 'album'
      : 'playlist';
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

type TidalPlaylistTracksResponse = {
  data?: {
    playlistTracks?: {
      items?: TidalTrackItem[];
    };
  };
  errors?: Array<{
    message?: string;
  }>;
};

type TidalTrackItem = {
  album?: {
    title?: string;
  };
  artists?: Array<{
    name?: string;
  }>;
  duration?: number;
  id?: number;
  image?: {
    original?: string | null;
    large?: string | null;
    medium?: string | null;
    small?: string | null;
    xsmall?: string | null;
  };
  title?: string;
};

type TidalAlbumResponse = {
  data?: {
    album?: {
      artists?: Array<{
        name?: string;
      }>;
      id?: number;
      image?: {
        original?: string | null;
        large?: string | null;
        medium?: string | null;
        small?: string | null;
        xsmall?: string | null;
      };
      title?: string;
      tracks?: TidalTrackItem[];
    } | null;
  };
  errors?: Array<{
    message?: string;
  }>;
};
