import type { PlaylistMetadata, PlaylistTrack } from '../types';
import { getFirstNonEmptyString } from '../utils';
import type { FetchOptions, ProviderOptions } from './Providers';

export class BandcampProvider implements ProviderOptions {
  public readonly provider = 'bandcamp';
  public readonly displayName = 'Bandcamp';

  public matchesUrl(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    return (
      ((hostname === 'bandcamp.com' ||
        hostname === 'www.bandcamp.com' ||
        hostname.endsWith('.bandcamp.com')) &&
        [
          /^\/album\/[^/]+(?:\/)?$/i,
          /^\/track\/[^/]+(?:\/)?$/i,
          /^\/[^/]+\/album\/[^/]+(?:\/)?$/i,
          /^\/[^/]+\/playlist\/[^/]+(?:\/)?$/i,
        ].some((pattern) => pattern.test(pathname))) ||
      (hostname === 'daily.bandcamp.com' &&
        [/^\/lists\/[^/]+(?:\/)?$/i].some((pattern) => pattern.test(pathname)))
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
        `Bandcamp playlist request failed with status ${response.status}.`
      );
    }

    return this.parsePlaylistHtml(await response.text(), url);
  }

  public parsePlaylistHtml(html: string, sourceUrl: string): PlaylistMetadata {
    if (sourceUrl.includes('://daily.bandcamp.com/')) {
      return this.parseDailyHtml(html, sourceUrl);
    }

    if (sourceUrl.includes('/track/')) {
      return this.parseTrackHtml(html, sourceUrl);
    }

    if (sourceUrl.includes('/album/')) {
      return this.parseAlbumHtml(html, sourceUrl);
    }

    const payload = this.extractPayload(html);
    const appData = payload.appData;
    const collectionArtworkUrl = this.getImageUrl(appData?.imageId);
    const tracks = (appData?.tracks ?? [])
      .map((track) => this.normalizeTrack(track, collectionArtworkUrl))
      .filter((track): track is PlaylistTrack => track !== null);

    if (!appData?.playlistId || !appData.title) {
      throw new Error('Could not find Bandcamp playlist metadata in the page.');
    }

    if (tracks.length === 0) {
      throw new Error('No tracks were found in the Bandcamp playlist.');
    }

    return {
      id: String(appData.playlistId),
      title: appData.title.trim(),
      owner: appData.curator?.name?.trim() || undefined,
      artworkUrl: collectionArtworkUrl,
      provider: 'bandcamp',
      sourceUrl,
      tracks,
    };
  }

  private parseAlbumHtml(html: string, sourceUrl: string): PlaylistMetadata {
    const album = this.extractAlbumSchema(html);
    const collectionArtworkUrl =
      album.albumRelease?.[0]?.image?.[0]?.trim() ||
      album.image?.trim() ||
      undefined;
    const tracks = (album.track?.itemListElement ?? [])
      .map((track) => this.normalizeAlbumTrack(track, collectionArtworkUrl))
      .filter((track): track is PlaylistTrack => track !== null);
    const albumId = this.extractSchemaPropertyValue(
      album.albumRelease?.[0]?.additionalProperty,
      'item_id'
    );

    if (!albumId || !album.name) {
      throw new Error('Could not find Bandcamp album metadata in the page.');
    }

    if (tracks.length === 0) {
      throw new Error('No tracks were found in the Bandcamp album.');
    }

    return {
      id: albumId,
      title: album.name.trim(),
      owner: album.byArtist?.name?.trim() || album.publisher?.name?.trim(),
      artworkUrl: collectionArtworkUrl,
      provider: 'bandcamp',
      sourceUrl,
      tracks,
    };
  }

  private parseDailyHtml(html: string, sourceUrl: string): PlaylistMetadata {
    const title = this.extractDailyTitle(html);
    const collectionArtworkUrl = this.extractDailyArtworkUrl(html);
    const tracks = this.extractDailyPlayerInfos(html)
      .map((playerInfo) =>
        this.normalizeDailyTrack(playerInfo, collectionArtworkUrl)
      )
      .filter((track): track is PlaylistTrack => track !== null);

    if (!title) {
      throw new Error(
        'Could not find Bandcamp Daily playlist metadata in the page.'
      );
    }

    if (tracks.length === 0) {
      throw new Error(
        'No playable tracks were found in the Bandcamp Daily article.'
      );
    }

    return {
      id: sourceUrl,
      title,
      owner: 'Bandcamp Daily',
      artworkUrl: collectionArtworkUrl,
      provider: 'bandcamp',
      sourceUrl,
      tracks,
    };
  }

  public parseTrackHtml(html: string, sourceUrl: string): PlaylistMetadata {
    const track = this.extractTrackSchema(html);
    const trackId =
      this.extractSchemaPropertyValue(track.additionalProperty, 'track_id') ||
      this.extractSchemaPropertyValue(
        track.inAlbum?.albumRelease?.[0]?.additionalProperty,
        'item_id'
      );
    const title = track.name?.trim();
    const artist =
      track.byArtist?.name?.trim() ||
      track.publisher?.name?.trim() ||
      undefined;
    const artworkUrl = getFirstNonEmptyString(
      Array.isArray(track.image) ? track.image[0] : track.image,
      track.inAlbum?.albumRelease?.[0]?.image?.[0]
    );

    if (!trackId || !title || !artist) {
      throw new Error('Could not find Bandcamp track metadata in the page.');
    }

    const normalizedTrack: PlaylistTrack = {
      id: trackId,
      title,
      artists: [artist],
      album: track.inAlbum?.name?.trim() || undefined,
      artworkUrl,
      durationMs: this.parseIsoDurationMs(track.duration),
      sourceUrl:
        track.mainEntityOfPage?.trim() || track['@id']?.trim() || sourceUrl,
    };

    return {
      id: normalizedTrack.id,
      title: normalizedTrack.title,
      owner: artist,
      artworkUrl: normalizedTrack.artworkUrl,
      provider: 'bandcamp',
      sourceUrl: normalizedTrack.sourceUrl || sourceUrl,
      tracks: [normalizedTrack],
    };
  }

  private extractPayload(html: string): BandcampPlaylistBlob {
    const match = html.match(/data-blob="([^"]*appData[^"]*)"/);

    if (!match?.[1]) {
      throw new Error('Could not find Bandcamp playlist data in the page.');
    }

    return JSON.parse(
      this.decodeHtmlEntities(match[1])
    ) as BandcampPlaylistBlob;
  }

  private extractDailyPlayerInfos(html: string): BandcampDailyPlayerInfo[] {
    const match = html.match(/data-player-infos="([^"]+)"/);

    if (!match?.[1]) {
      throw new Error('Could not find Bandcamp Daily player data in the page.');
    }

    return JSON.parse(
      this.decodeHtmlEntities(match[1])
    ) as BandcampDailyPlayerInfo[];
  }

  private extractDailyTitle(html: string): string | undefined {
    const match = html.match(
      /<meta\s+property="og:title"\s+content="([^"]+)"/i
    );
    return this.decodeHtmlEntities(match?.[1] ?? '').trim() || undefined;
  }

  private extractDailyArtworkUrl(html: string): string | undefined {
    const match = html.match(
      /<meta\s+property="og:image"\s+content="([^"]+)"/i
    );
    return this.decodeHtmlEntities(match?.[1] ?? '').trim() || undefined;
  }

  private extractAlbumSchema(html: string): BandcampAlbumSchema {
    const matches = Array.from(
      html.matchAll(
        /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g
      )
    );
    const schema = matches
      .map((match) => JSON.parse(match[1]) as Record<string, unknown>)
      .find((entry) => entry['@type'] === 'MusicAlbum');

    if (!schema) {
      throw new Error('Could not find Bandcamp album data in the page.');
    }

    return schema as BandcampAlbumSchema;
  }

  private extractTrackSchema(html: string): BandcampTrackSchema {
    const matches = Array.from(
      html.matchAll(
        /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g
      )
    );
    const schema = matches
      .map((match) => JSON.parse(match[1]) as Record<string, unknown>)
      .find((entry) => entry['@type'] === 'MusicRecording');

    if (!schema) {
      throw new Error('Could not find Bandcamp track data in the page.');
    }

    return schema as BandcampTrackSchema;
  }

  private normalizeDailyTrack(
    playerInfo: BandcampDailyPlayerInfo,
    collectionArtworkUrl?: string
  ): PlaylistTrack | null {
    const featuredTrack = playerInfo.tracklist?.find(
      (track) => track.track_number === playerInfo.featured_track_number
    );

    if (!featuredTrack) {
      return null;
    }

    const title = featuredTrack.track_title?.trim();
    const artist = featuredTrack.artist?.trim() || playerInfo.band_name?.trim();

    if (!title || !artist) {
      return null;
    }

    return {
      id: String(featuredTrack.track_id ?? playerInfo.player_id ?? title),
      title,
      artists: [artist],
      album: playerInfo.title?.trim() || undefined,
      artworkUrl: getFirstNonEmptyString(
        this.getImageUrl(featuredTrack.art_id ?? playerInfo.art_id),
        collectionArtworkUrl
      ),
      durationMs:
        typeof featuredTrack.audio_track_duration === 'number' &&
        Number.isFinite(featuredTrack.audio_track_duration)
          ? Math.round(featuredTrack.audio_track_duration * 1000)
          : undefined,
      sourceUrl: playerInfo.tralbum_url?.trim() || undefined,
    };
  }

  private normalizeAlbumTrack(
    track: {
      item?: {
        '@id'?: string;
        additionalProperty?: Array<{
          name?: string;
          value?: number | string;
        }>;
        duration?: string;
        mainEntityOfPage?: string;
        name?: string;
      };
    },
    collectionArtworkUrl?: string
  ): PlaylistTrack | null {
    const title = track.item?.name?.trim();
    const trackId = this.extractSchemaPropertyValue(
      track.item?.additionalProperty,
      'track_id'
    );

    if (!title || !trackId) {
      return null;
    }

    return {
      id: trackId,
      title,
      artists: [],
      artworkUrl: collectionArtworkUrl,
      durationMs: this.parseIsoDurationMs(track.item?.duration),
      sourceUrl:
        track.item?.mainEntityOfPage?.trim() || track.item?.['@id']?.trim(),
    };
  }

  private normalizeTrack(
    track: BandcampTrack,
    collectionArtworkUrl?: string
  ): PlaylistTrack | null {
    const title = track.title?.trim();
    const artist = track.artistName?.trim();

    if (!title || !artist) {
      return null;
    }

    return {
      id: String(track.id ?? `${artist}-${title}`),
      title,
      artists: [artist],
      album: track.album?.title?.trim() || undefined,
      artworkUrl: getFirstNonEmptyString(
        this.getImageUrl(track.artId),
        collectionArtworkUrl
      ),
      durationMs:
        typeof track.duration === 'number' && Number.isFinite(track.duration)
          ? Math.round(track.duration * 1000)
          : undefined,
      sourceUrl: track.url?.trim() || undefined,
    };
  }

  private getImageUrl(imageId?: number): string | undefined {
    if (!Number.isFinite(imageId)) {
      return undefined;
    }

    return `https://f4.bcbits.com/img/${String(imageId).padStart(10, '0')}_71.jpg`;
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
        String.fromCodePoint(Number.parseInt(hex, 16))
      )
      .replace(/&#(\d+);/g, (_, decimal) =>
        String.fromCodePoint(Number.parseInt(decimal, 10))
      );
  }

  private extractSchemaPropertyValue(
    properties:
      | Array<{
          name?: string;
          value?: number | string;
        }>
      | undefined,
    name: string
  ): string | undefined {
    const value = properties?.find((property) => property.name === name)?.value;
    return typeof value === 'number' || typeof value === 'string'
      ? String(value)
      : undefined;
  }

  private parseIsoDurationMs(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const match = value.match(
      /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i
    );

    if (!match) {
      return undefined;
    }

    const days = Number.parseFloat(match[1] || '0');
    const hours = Number.parseFloat(match[2] || '0');
    const minutes = Number.parseFloat(match[3] || '0');
    const seconds = Number.parseFloat(match[4] || '0');
    return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  }
}

type BandcampPlaylistBlob = {
  appData?: {
    curator?: {
      name?: string;
    };
    imageId?: number;
    playlistId?: number;
    title?: string;
    tracks?: BandcampTrack[];
  };
};

type BandcampTrack = {
  album?: {
    title?: string;
  };
  artId?: number;
  artistName?: string;
  duration?: number;
  id?: number;
  title?: string;
  url?: string;
};

type BandcampDailyPlayerInfo = {
  art_id?: number;
  band_name?: string;
  featured_track_number?: number;
  player_id?: string;
  title?: string;
  tracklist?: BandcampDailyTrack[];
  tralbum_url?: string;
};

type BandcampDailyTrack = {
  artist?: string;
  art_id?: number;
  audio_track_duration?: number;
  track_id?: number;
  track_number?: number;
  track_title?: string;
};

type BandcampAlbumSchema = {
  '@id'?: string;
  albumRelease?: Array<{
    additionalProperty?: Array<{
      name?: string;
      value?: number | string;
    }>;
    image?: string[];
  }>;
  byArtist?: {
    name?: string;
  };
  image?: string;
  name?: string;
  publisher?: {
    name?: string;
  };
  track?: {
    itemListElement?: Array<{
      item?: {
        '@id'?: string;
        additionalProperty?: Array<{
          name?: string;
          value?: number | string;
        }>;
        duration?: string;
        mainEntityOfPage?: string;
        name?: string;
      };
    }>;
  };
};

type BandcampTrackSchema = {
  '@id'?: string;
  additionalProperty?: Array<{
    name?: string;
    value?: number | string;
  }>;
  byArtist?: {
    name?: string;
  };
  duration?: string;
  image?: string | string[];
  inAlbum?: {
    albumRelease?: Array<{
      additionalProperty?: Array<{
        name?: string;
        value?: number | string;
      }>;
      image?: string[];
    }>;
    name?: string;
  };
  mainEntityOfPage?: string;
  name?: string;
  publisher?: {
    name?: string;
  };
};
