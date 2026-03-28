import { playlistMetadataSchema } from '../schemas';
import type { PlaylistMetadata, PlaylistTrack } from '../types';
import { decodeUnknownSync, getFirstNonEmptyString } from '../utils';
import type { FetchOptions, ProviderOptions } from './Providers';

export class SoundCloudProvider implements ProviderOptions {
  public readonly provider = 'soundcloud';
  public readonly displayName = 'SoundCloud';
  public readonly shortLinkHosts = ['on.soundcloud.com', 'snd.sc'] as const;

  public matchesUrl(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const segments = pathname.split('/').filter(Boolean);

    return (
      ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(
        url.hostname.toLowerCase()
      ) &&
      [
        /^\/[^/]+\/sets\/[^/]+(?:\/)?$/i,
        /^\/discover\/sets\/[^/]+(?:\/)?$/i,
        /^\/[^/]+\/[^/]+(?:\/)?$/i,
      ].some((pattern) => pattern.test(pathname)) &&
      !(segments.length === 2 && segments[0] === 'discover') &&
      !(segments.length === 2 && segments[1] === 'sets')
    );
  }

  public async fetch(
    url: string,
    _options: FetchOptions
  ): Promise<PlaylistMetadata> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `SoundCloud playlist request failed with status ${response.status}.`
      );
    }

    const html = await response.text();
    return this.isTrackUrl(url)
      ? this.parseTrackHtml(html, url)
      : this.parsePlaylistHtml(html, url);
  }

  public parsePlaylistHtml(html: string, sourceUrl: string): PlaylistMetadata {
    const hydration = this.extractHydration(html);
    const playlist = hydration.find((item) => item.hydratable === 'playlist')
      ?.data as SoundCloudPlaylist | undefined;

    if (!playlist?.id || !playlist.title) {
      throw new Error(
        'Could not find SoundCloud playlist metadata in the page.'
      );
    }

    const collectionArtworkUrl = playlist.artwork_url?.trim() || undefined;
    const tracks = (playlist.tracks ?? [])
      .map((track, index) =>
        this.normalizeTrack(track, index, collectionArtworkUrl)
      )
      .filter((track): track is PlaylistTrack => track !== null);

    if (tracks.length === 0) {
      throw new Error('No tracks were found in the SoundCloud playlist.');
    }

    return decodeUnknownSync(playlistMetadataSchema, {
      id: String(playlist.id),
      title: playlist.title.trim(),
      owner: playlist.user?.username?.trim() || undefined,
      artworkUrl: collectionArtworkUrl,
      provider: 'soundcloud',
      sourceUrl: playlist.permalink_url?.trim() || sourceUrl,
      tracks,
    });
  }

  public parseTrackHtml(html: string, sourceUrl: string): PlaylistMetadata {
    const hydration = this.extractHydration(html);
    const track = hydration.find((item) => item.hydratable === 'sound')?.data as
      | SoundCloudTrack
      | undefined;

    if (!track?.id || !track.title) {
      throw new Error('Could not find SoundCloud track metadata in the page.');
    }

    const normalizedTrack = this.normalizeTrack(track, 0, undefined);

    if (!normalizedTrack) {
      throw new Error('Could not normalize the SoundCloud track metadata.');
    }

    return decodeUnknownSync(playlistMetadataSchema, {
      id: String(track.id),
      title: normalizedTrack.title,
      owner: normalizedTrack.artists[0],
      artworkUrl: normalizedTrack.artworkUrl,
      provider: 'soundcloud',
      sourceUrl: normalizedTrack.sourceUrl || sourceUrl,
      tracks: [normalizedTrack],
    });
  }

  private extractHydration(html: string): SoundCloudHydrationItem[] {
    const match = html.match(
      /window\.__sc_hydration\s*=\s*(\[.*?\]);<\/script>/s
    );

    if (!match?.[1]) {
      throw new Error('Could not find SoundCloud hydration data in the page.');
    }

    return JSON.parse(match[1]) as SoundCloudHydrationItem[];
  }

  private normalizeTrack(
    track: SoundCloudTrack,
    _index: number,
    collectionArtworkUrl?: string
  ): PlaylistTrack | null {
    const title = track.title?.trim();
    const artist =
      track.publisher_metadata?.artist?.trim() || track.user?.username?.trim();

    if (!track.id || !title || !artist) {
      return null;
    }

    return {
      id: String(track.id),
      title,
      artists: [artist],
      album: track.publisher_metadata?.album_title?.trim() || undefined,
      artworkUrl: getFirstNonEmptyString(
        track.artwork_url,
        collectionArtworkUrl
      ),
      durationMs:
        typeof track.duration === 'number' && Number.isFinite(track.duration)
          ? Math.round(track.duration)
          : undefined,
      sourceUrl: track.permalink_url?.trim() || undefined,
    };
  }

  private isTrackUrl(sourceUrl: string): boolean {
    return !new URL(sourceUrl).pathname.includes('/sets/');
  }
}

type SoundCloudHydrationItem = {
  hydratable?: string;
  data?: unknown;
};

type SoundCloudPlaylist = {
  artwork_url?: string | null;
  id?: number;
  permalink_url?: string;
  title?: string;
  tracks?: SoundCloudTrack[];
  user?: {
    username?: string;
  } | null;
};

type SoundCloudTrack = {
  artwork_url?: string | null;
  duration?: number;
  id?: number;
  permalink_url?: string;
  publisher_metadata?: {
    album_title?: string;
    artist?: string;
  } | null;
  title?: string;
  user?: {
    username?: string;
  } | null;
};
