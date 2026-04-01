import type { PlaylistMetadata, PlaylistTrack } from '../types';
import { getFirstNonEmptyString } from '../utils';
import type { FetchOptions, ProviderOptions } from './Providers';

const SPOTIFY_TRACK_ENRICHMENT_CONCURRENCY = 5;

export class SpotifyProvider implements ProviderOptions {
  public readonly provider = 'spotify';
  public readonly displayName = 'Spotify';
  public readonly shortLinkHosts = [
    'spotify.link',
    'spotify.app.link',
  ] as const;

  public matchesUrl(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    return (
      url.hostname.toLowerCase() === 'open.spotify.com' &&
      [
        /^\/album\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/playlist\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/track\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/intl-[a-z]{2}\/album\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/intl-[a-z]{2}\/track\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/user\/[^/]+\/playlist\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/intl-[a-z]{2}\/playlist\/[A-Za-z0-9]+(?:\/)?$/i,
      ].some((pattern) => pattern.test(pathname))
    );
  }

  public async fetch(
    url: string,
    _options: FetchOptions
  ): Promise<PlaylistMetadata> {
    const collectionKind = this.getCollectionKind(url);
    const embedUrl = this.createEmbedUrl(url);
    const response = await fetch(embedUrl, {
      headers: { 'user-agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      throw new Error(`Spotify request failed with status ${response.status}.`);
    }

    const playlist = this.parseCollectionHtml(await response.text(), url);

    if (collectionKind === 'playlist') {
      return this.enrichPlaylistTracks(playlist);
    }

    if (collectionKind === 'track') {
      return this.enrichTrackCollection(playlist);
    }

    return playlist;
  }

  public parseCollectionHtml(
    html: string,
    sourceUrl: string
  ): PlaylistMetadata {
    const entity = this.extractEntity(html);
    const collectionKind = this.getCollectionKind(sourceUrl);
    const owner = this.getEntityOwner(entity);
    const title =
      entity.title?.trim() ||
      entity.name?.trim() ||
      this.getFallbackCollectionTitle(collectionKind);
    const artworkUrl = getFirstNonEmptyString(
      entity.coverArt?.sources?.[0]?.url,
      entity.visualIdentity?.image?.[0]?.url
    );
    const tracks =
      collectionKind === 'track'
        ? this.normalizeTrackCollection(entity, artworkUrl)
        : (entity.trackList ?? [])
            .map((track) => this.normalizeTrack(track, title, artworkUrl))
            .filter((track): track is PlaylistTrack => track !== null);

    if (tracks.length === 0) {
      throw new Error(`No tracks were found in the Spotify ${collectionKind}.`);
    }

    return {
      id:
        entity.id?.trim() ||
        this.extractId(entity.uri, collectionKind) ||
        this.extractId(sourceUrl, collectionKind) ||
        `${collectionKind}-${Date.now()}`,
      title,
      owner,
      artworkUrl,
      provider: 'spotify',
      sourceUrl,
      tracks,
    };
  }

  private extractEntity(html: string): SpotifyEntity {
    const payloadMatch = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );

    if (!payloadMatch?.[1]) {
      throw new Error('Could not find Spotify collection data in the page.');
    }

    const payload = JSON.parse(payloadMatch[1]) as SpotifyEmbedPayload;
    const entity = payload.props?.pageProps?.state?.data?.entity;

    if (!entity?.type || !entity.title) {
      throw new Error('Could not parse Spotify collection data from the page.');
    }

    return entity;
  }

  private normalizeTrackCollection(
    entity: SpotifyEntity,
    collectionArtworkUrl?: string
  ): PlaylistTrack[] {
    const title = entity.title?.trim() || entity.name?.trim();
    const artists = entity.artists
      ?.map((artist) => artist.name?.trim())
      .filter((artist): artist is string => Boolean(artist));
    const id =
      entity.id?.trim() || this.extractId(entity.uri, 'track') || undefined;

    if (!title || !artists?.length || !id) {
      return [];
    }

    return [
      {
        id,
        title,
        artists,
        album: undefined,
        artworkUrl: collectionArtworkUrl,
        durationMs:
          typeof entity.duration === 'number' ? entity.duration : undefined,
        sourceUrl: this.getTrackUrl(entity.uri) ?? this.getTrackUrl(id),
      },
    ];
  }

  private normalizeTrack(
    track: SpotifyTrackItem,
    collectionTitle: string,
    collectionArtworkUrl?: string
  ): PlaylistTrack | null {
    const title = track.title?.trim();
    const artists = track.subtitle
      ?.split(',')
      .map((artist) => artist.trim())
      .filter(Boolean);

    if (!title || !artists?.length) {
      return null;
    }

    return {
      id: this.extractId(track.uri, 'track') ?? `${artists.join(',')}-${title}`,
      title,
      artists,
      album: collectionTitle,
      artworkUrl: collectionArtworkUrl,
      durationMs:
        typeof track.duration === 'number' ? track.duration : undefined,
      sourceUrl: this.getTrackUrl(track.uri),
    };
  }

  private async enrichPlaylistTracks(
    playlist: PlaylistMetadata
  ): Promise<PlaylistMetadata> {
    const trackPageMetadataByUrl = new Map<
      string,
      Promise<SpotifyTrackPageMetadata | null>
    >();
    const tracks = await this.mapWithConcurrency(
      playlist.tracks,
      SPOTIFY_TRACK_ENRICHMENT_CONCURRENCY,
      async (track) => {
        if (!track.sourceUrl) {
          return track;
        }

        const trackMetadataPromise =
          trackPageMetadataByUrl.get(track.sourceUrl) ??
          this.fetchTrackPageMetadata(track.sourceUrl);

        if (!trackPageMetadataByUrl.has(track.sourceUrl)) {
          trackPageMetadataByUrl.set(track.sourceUrl, trackMetadataPromise);
        }

        const trackMetadata = await trackMetadataPromise;

        if (!trackMetadata?.album && !trackMetadata?.artworkUrl) {
          return track;
        }

        return {
          ...track,
          album: trackMetadata.album ?? track.album,
          artworkUrl: trackMetadata.artworkUrl ?? track.artworkUrl,
        };
      }
    );

    return {
      ...playlist,
      tracks,
    };
  }

  private async enrichTrackCollection(
    playlist: PlaylistMetadata
  ): Promise<PlaylistMetadata> {
    const [track] = playlist.tracks;

    if (!track?.sourceUrl) {
      return playlist;
    }

    const trackMetadata = await this.fetchTrackPageMetadata(track.sourceUrl);

    if (!trackMetadata?.album && !trackMetadata?.artworkUrl) {
      return playlist;
    }

    return {
      ...playlist,
      tracks: [
        {
          ...track,
          album: trackMetadata.album ?? track.album,
          artworkUrl: trackMetadata.artworkUrl ?? track.artworkUrl,
        },
      ],
    };
  }

  private async fetchTrackPageMetadata(
    trackUrl: string
  ): Promise<SpotifyTrackPageMetadata | null> {
    try {
      const response = await fetch(trackUrl, {
        headers: { 'user-agent': 'Mozilla/5.0' },
      });

      if (!response.ok) {
        return null;
      }

      return this.parseTrackPageHtml(await response.text());
    } catch {
      return null;
    }
  }

  private parseTrackPageHtml(html: string): SpotifyTrackPageMetadata {
    const metaEntries = Array.from(
      html.matchAll(
        /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/g
      )
    );
    const metadata = new Map(
      metaEntries.map((match) => [match[1], this.decodeHtmlEntities(match[2])])
    );
    const description = getFirstNonEmptyString(
      metadata.get('og:description'),
      metadata.get('twitter:description')
    );

    return {
      album: this.parseAlbumFromDescription(description),
      artworkUrl: getFirstNonEmptyString(
        metadata.get('og:image'),
        metadata.get('twitter:image')
      ),
    };
  }

  private parseAlbumFromDescription(
    description: string | undefined
  ): string | undefined {
    if (!description) {
      return undefined;
    }

    const descriptionSegments = description
      .split(' · ')
      .map((segment) => segment.trim())
      .filter(Boolean);
    const songSegmentIndex = descriptionSegments.findIndex(
      (segment) => segment.toLowerCase() === 'song'
    );

    if (songSegmentIndex < 2) {
      return undefined;
    }

    return descriptionSegments[songSegmentIndex - 1];
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#x27;', "'")
      .replaceAll('&#39;', "'");
  }

  private async mapWithConcurrency<Value, Result>(
    values: readonly Value[],
    concurrency: number,
    mapper: (value: Value, index: number) => Promise<Result>
  ): Promise<Result[]> {
    const results = new Array<Result>(values.length);
    let nextIndex = 0;

    async function runWorker() {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(
          values[currentIndex],
          currentIndex
        );
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, values.length) }, () =>
        runWorker()
      )
    );

    return results;
  }

  private createEmbedUrl(sourceUrl: string): string {
    const collectionKind = this.getCollectionKind(sourceUrl);
    const collectionId = this.extractId(sourceUrl, collectionKind);

    if (!collectionId) {
      throw new Error(
        'Could not determine the Spotify collection id from the URL.'
      );
    }

    return `https://open.spotify.com/embed/${collectionKind}/${collectionId}`;
  }

  private extractId(
    value: string | undefined,
    entity: SpotifyCollectionKind
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    const match = value.match(
      new RegExp(`(?:${entity}/|spotify:${entity}:)([A-Za-z0-9]+)`)
    );
    return match?.[1];
  }

  private getTrackUrl(uri?: string): string | undefined {
    const trackId = this.extractId(uri, 'track') ?? uri?.trim();
    return trackId ? `https://open.spotify.com/track/${trackId}` : undefined;
  }

  private getCollectionKind(sourceUrl: string): SpotifyCollectionKind {
    const pathname = new URL(sourceUrl).pathname;

    if (pathname.includes('/album/')) {
      return 'album';
    }

    if (pathname.includes('/track/')) {
      return 'track';
    }

    return 'playlist';
  }

  private getEntityOwner(entity: SpotifyEntity): string | undefined {
    const artistNames = entity.artists
      ?.map((artist) => artist.name?.trim())
      .filter((artist): artist is string => Boolean(artist));

    return getFirstNonEmptyString(
      entity.subtitle?.trim(),
      artistNames?.join(', ')
    );
  }

  private getFallbackCollectionTitle(
    collectionKind: SpotifyCollectionKind
  ): string {
    const collectionTypeLabelByKind: Record<SpotifyCollectionKind, string> = {
      album: 'Album',
      playlist: 'Playlist',
      track: 'Track',
    };

    return `Spotify ${collectionTypeLabelByKind[collectionKind]}`;
  }
}

type SpotifyCollectionKind = 'album' | 'playlist' | 'track';

type SpotifyEmbedPayload = {
  props?: {
    pageProps?: {
      state?: {
        data?: {
          entity?: SpotifyEntity;
        };
      };
    };
  };
};

type SpotifyEntity = {
  artists?: Array<{
    name?: string;
    uri?: string;
  }>;
  coverArt?: {
    sources?: Array<{
      url?: string;
    }>;
  };
  duration?: number;
  id?: string;
  name?: string;
  subtitle?: string;
  title?: string;
  trackList?: SpotifyTrackItem[];
  type?: SpotifyCollectionKind;
  uri?: string;
  visualIdentity?: {
    image?: Array<{
      url?: string;
    }>;
  };
};

type SpotifyTrackItem = {
  duration?: number;
  subtitle?: string;
  title?: string;
  uri?: string;
};

type SpotifyTrackPageMetadata = {
  album?: string;
  artworkUrl?: string;
};
