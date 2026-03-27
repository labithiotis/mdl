import type { PlaylistMetadata, PlaylistTrack } from '../types';
import { getFirstNonEmptyString } from '../utils';
import type { FetchOptions, ProviderOptions } from './Providers';

export class AppleMusicProvider implements ProviderOptions {
  public readonly provider = 'apple-music';
  public readonly displayName = 'Apple Music';
  public readonly shortLinkHosts = ['apple.co'] as const;

  public matchesUrl(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    return (
      ['music.apple.com', 'geo.music.apple.com'].includes(
        url.hostname.toLowerCase()
      ) &&
      [
        /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?album\/[^/]+\/\d+(?:\/)?$/i,
        /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/[^/]+\/pl\.[A-Za-z0-9.]+(?:\/)?$/i,
      ].some((pattern) => pattern.test(pathname))
    );
  }

  public async fetch(
    url: string,
    _options: FetchOptions
  ): Promise<PlaylistMetadata> {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Apple Music request failed with status ${response.status}.`
      );
    }

    return this.parsePlaylistHtml(await response.text(), url);
  }

  public parsePlaylistHtml(html: string, sourceUrl: string): PlaylistMetadata {
    const serializedData = this.extractSerializedServerData(html);
    const playlistHeader = this.findPlaylistHeader(serializedData);
    const collectionArtworkUrl = this.normalizeArtworkUrl(
      playlistHeader?.artwork
    );
    const tracks = this.findTrackItems(serializedData).map((track) =>
      this.normalizeTrack(track, collectionArtworkUrl)
    );

    if (!playlistHeader) {
      throw new Error(
        'Could not find Apple Music collection metadata in the page.'
      );
    }

    if (tracks.length === 0) {
      throw new Error('No tracks were found in the Apple Music collection.');
    }

    const isAlbum = playlistHeader.contentDescriptor?.kind === 'album';
    return {
      id:
        playlistHeader.contentDescriptor?.identifiers?.storeAdamID ??
        `${isAlbum ? 'album' : 'playlist'}-${Date.now()}`,
      title:
        playlistHeader.title?.trim() ||
        `Apple Music ${isAlbum ? 'Album' : 'Playlist'}`,
      owner: playlistHeader.subtitleLinks?.[0]?.title?.trim() || undefined,
      artworkUrl: collectionArtworkUrl,
      provider: 'apple-music',
      sourceUrl: playlistHeader.contentDescriptor?.url?.trim() || sourceUrl,
      tracks,
    };
  }

  private extractSerializedServerData(html: string): AppleMusicSerializedData {
    const match = html.match(
      /<script type="application\/json" id="serialized-server-data">([\s\S]*?)<\/script>/
    );

    if (!match?.[1]) {
      throw new Error(
        'Could not find serialized Apple Music collection data in the page.'
      );
    }

    return JSON.parse(match[1]) as AppleMusicSerializedData;
  }

  private findPlaylistHeader(
    value: AppleMusicSerializedData
  ): AppleMusicPlaylistHeader | null {
    return this.findFirst(
      value,
      (candidate): candidate is AppleMusicPlaylistHeader => {
        return (
          this.isObject(candidate) &&
          this.hasContentDescriptorKind(candidate, 'album', 'playlist') &&
          typeof candidate.title === 'string'
        );
      }
    );
  }

  private findTrackItems(
    value: AppleMusicSerializedData
  ): AppleMusicTrackItem[] {
    const tracks: AppleMusicTrackItem[] = [];

    this.walk(value, (candidate) => {
      if (
        this.isObject(candidate) &&
        this.hasContentDescriptorKind(candidate, 'song') &&
        typeof candidate.title === 'string' &&
        typeof candidate.artistName === 'string'
      ) {
        tracks.push(candidate);
      }
    });

    return this.dedupeTracks(tracks);
  }

  private normalizeTrack(
    track: AppleMusicTrackItem,
    collectionArtworkUrl?: string
  ): PlaylistTrack {
    return {
      id:
        track.contentDescriptor?.identifiers?.storeAdamID ??
        `${track.artistName}-${track.title}`,
      title: track.title?.trim() || 'Unknown title',
      artists: [track.artistName?.trim() || 'Unknown artist'],
      album: track.tertiaryLinks?.[0]?.title?.trim() || undefined,
      artworkUrl: getFirstNonEmptyString(
        this.normalizeArtworkUrl(track.artwork),
        collectionArtworkUrl
      ),
      durationMs:
        typeof track.duration === 'number' && Number.isFinite(track.duration)
          ? track.duration
          : undefined,
      sourceUrl: track.contentDescriptor?.url?.trim() || undefined,
    };
  }

  private normalizeArtworkUrl(artwork?: AppleMusicArtwork): string | undefined {
    const template = artwork?.dictionary?.url?.trim();
    if (!template) {
      return undefined;
    }

    return template
      .replace('{w}', '1200')
      .replace('{h}', '1200')
      .replace('{f}', 'jpg');
  }

  private dedupeTracks(tracks: AppleMusicTrackItem[]): AppleMusicTrackItem[] {
    const seen = new Set<string>();
    const deduped: AppleMusicTrackItem[] = [];

    for (const track of tracks) {
      const id = track.contentDescriptor?.identifiers?.storeAdamID;
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      deduped.push(track);
    }

    return deduped;
  }

  private findFirst<T>(
    value: unknown,
    predicate: (candidate: T | Record<string, unknown>) => candidate is T
  ): T | null {
    let found: T | null = null;

    this.walk(value, (candidate) => {
      if (found || !this.isObject(candidate)) {
        return;
      }

      if (predicate(candidate)) {
        found = candidate;
      }
    });

    return found;
  }

  private walk(value: unknown, visitor: (candidate: unknown) => void): void {
    visitor(value);

    if (Array.isArray(value)) {
      for (const entry of value) {
        this.walk(entry, visitor);
      }
      return;
    }

    if (!this.isObject(value)) {
      return;
    }

    for (const entry of Object.values(value)) {
      this.walk(entry, visitor);
    }
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private hasContentDescriptorKind(
    value: Record<string, unknown>,
    ...kinds: Array<'album' | 'playlist' | 'song'>
  ): boolean {
    const contentDescriptor = value.contentDescriptor;
    return (
      this.isObject(contentDescriptor) &&
      typeof contentDescriptor.kind === 'string' &&
      kinds.includes(contentDescriptor.kind as 'album' | 'playlist' | 'song')
    );
  }
}

type AppleMusicSerializedData = {
  data?: unknown[];
};

type AppleMusicArtwork = {
  dictionary?: {
    url?: string;
  };
};

type AppleMusicPlaylistHeader = {
  artwork?: AppleMusicArtwork;
  contentDescriptor?: {
    identifiers?: {
      storeAdamID?: string;
    };
    kind?: string;
    url?: string;
  };
  subtitleLinks?: Array<{
    title?: string;
  }>;
  title?: string;
};

type AppleMusicTrackItem = {
  artistName?: string;
  artwork?: AppleMusicArtwork;
  composer?: string;
  contentDescriptor?: {
    identifiers?: {
      storeAdamID?: string;
    };
    kind?: string;
    url?: string;
  };
  duration?: number;
  tertiaryLinks?: Array<{
    title?: string;
  }>;
  title?: string;
};
