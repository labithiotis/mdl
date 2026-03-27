import type { PlaylistMetadata, PlaylistTrack } from '../types';
import { getFirstNonEmptyString } from '../utils';
import type { FetchOptions, ProviderOptions } from './Providers';

const AMAZON_BOT_USER_AGENT =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

export class AmazonMusicProvider implements ProviderOptions {
  public readonly provider = 'amazon-music';
  public readonly displayName = 'Amazon Music';
  public readonly shortLinkHosts = ['amzn.to'] as const;
  private readonly artistNameCache = new Map<string, string>();
  private readonly albumTitleCache = new Map<string, string>();

  public matchesUrl(url: URL): boolean {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    return (
      /^music\.amazon\.[a-z.]+$/i.test(url.hostname) &&
      [
        /^\/albums\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/user-playlists\/[A-Za-z0-9]+(?:\/)?$/i,
        /^\/playlists\/[A-Za-z0-9]+(?:\/)?$/i,
      ].some((pattern) => pattern.test(pathname))
    );
  }

  public async fetch(
    url: string,
    options: FetchOptions
  ): Promise<PlaylistMetadata> {
    const { signal } = options;
    const collectionKind = this.getCollectionKind(url);
    const html = await this.fetchHtml(url, signal);
    const playlist = this.parsePlaylistHtml(html);

    const tracks = await this.mapWithConcurrency<string, PlaylistTrack | null>(
      playlist.trackAsins,
      4,
      async (asin) => {
        const trackHtml = await this.fetchHtml(
          `${url}?do=play&trackAsin=${asin}`,
          signal
        );
        const trackPage = this.parseTrackHtml(trackHtml);
        const artist = trackPage.artistUrl
          ? await this.getCachedName(
              this.artistNameCache,
              trackPage.artistUrl,
              signal
            )
          : undefined;
        const albumTitle = trackPage.albumUrl
          ? await this.getCachedName(
              this.albumTitleCache,
              trackPage.albumUrl,
              signal
            )
          : undefined;

        if (!trackPage.title || !artist) {
          return null;
        }

        return {
          id: asin,
          title: trackPage.title,
          artists: [artist],
          album: albumTitle,
          artworkUrl: getFirstNonEmptyString(
            trackPage.artworkUrl,
            playlist.artworkUrl
          ),
          durationMs: trackPage.durationMs,
          sourceUrl: trackPage.sourceUrl,
        };
      }
    );

    const normalizedTracks = tracks.filter((track) => track !== null);

    if (normalizedTracks.length === 0) {
      throw new Error(
        `No tracks were found in the Amazon Music ${collectionKind}.`
      );
    }

    return {
      id: this.extractPlaylistId(url),
      title:
        playlist.title ||
        `Amazon Music ${collectionKind === 'album' ? 'Album' : 'Playlist'}`,
      owner: playlist.owner,
      artworkUrl: playlist.artworkUrl,
      provider: 'amazon-music',
      sourceUrl: url,
      tracks: normalizedTracks,
    };
  }

  public parsePlaylistHtml(html: string): AmazonPlaylistPageData {
    const title = this.extractMetaProperty(html, 'og:title');
    const description = this.extractMetaProperty(html, 'og:description');
    const ownerMatch = description?.match(/^Playlist by (.+)$/i);
    const trackAsins = Array.from(
      html.matchAll(/trackAsin(?:&#x3D;|=|&amp;trackAsin=)([A-Z0-9]{10})/g),
      (match) => match[1]
    );

    if (!title || trackAsins.length === 0) {
      throw new Error(
        'Could not find Amazon Music collection metadata in the page.'
      );
    }

    return {
      artworkUrl: this.extractMetaProperty(html, 'og:image'),
      owner: ownerMatch?.[1]?.trim() || undefined,
      title,
      trackAsins,
    };
  }

  public parseTrackHtml(html: string): AmazonTrackPageData {
    const sourceUrl = this.decodeHtmlAttribute(
      this.extractMetaProperty(html, 'al:web:url') || ''
    );
    const duration = this.extractMetaProperty(html, 'music:duration');

    return {
      albumUrl: this.decodeHtmlAttribute(
        this.extractMetaProperty(html, 'music:album') || ''
      ),
      artistUrl: this.decodeHtmlAttribute(
        this.extractMetaProperty(html, 'music:musician') || ''
      ),
      artworkUrl: this.extractMetaProperty(html, 'og:image'),
      durationMs:
        duration && Number.isFinite(Number(duration))
          ? Math.round(Number(duration) * 1000)
          : undefined,
      sourceUrl: sourceUrl || undefined,
      title: this.extractMetaProperty(html, 'og:title'),
    };
  }

  private async getCachedName(
    cache: Map<string, string>,
    url: string,
    signal?: AbortSignal
  ): Promise<string | undefined> {
    const normalizedUrl = url.trim();

    if (cache.has(normalizedUrl)) {
      return cache.get(normalizedUrl);
    }

    const html = await this.fetchHtml(normalizedUrl, signal);
    const name = this.extractMetaProperty(html, 'og:title')
      ?.split(' – ')[0]
      ?.trim();

    if (name) {
      cache.set(normalizedUrl, name);
    }

    return name;
  }

  private async fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'user-agent': AMAZON_BOT_USER_AGENT,
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Amazon Music request failed with status ${response.status}.`
      );
    }

    return response.text();
  }

  private extractPlaylistId(sourceUrl: string): string {
    const parsedUrl = new URL(sourceUrl);
    const match = parsedUrl.pathname.match(
      /\/(?:albums|user-playlists|playlists)\/([A-Za-z0-9]+)/i
    );

    if (!match?.[1]) {
      throw new Error(
        'Could not determine the Amazon Music collection id from the URL.'
      );
    }

    return match[1];
  }

  private getCollectionKind(sourceUrl: string): 'album' | 'playlist' {
    return new URL(sourceUrl).pathname.includes('/albums/')
      ? 'album'
      : 'playlist';
  }

  private extractMetaProperty(
    html: string,
    property: string
  ): string | undefined {
    const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(
      new RegExp(
        `<meta\\s+property="${escapedProperty}"\\s+content="([^"]*)"`,
        'i'
      )
    );

    return match?.[1] ? this.decodeHtmlAttribute(match[1]).trim() : undefined;
  }

  private decodeHtmlAttribute(value: string): string {
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

  private async mapWithConcurrency<TInput, TOutput>(
    values: TInput[],
    concurrency: number,
    mapper: (value: TInput, index: number) => Promise<TOutput>
  ): Promise<TOutput[]> {
    const results = new Array<TOutput>(values.length);
    let cursor = 0;

    const workers = Array.from(
      { length: Math.min(concurrency, values.length) },
      async () => {
        while (cursor < values.length) {
          const currentIndex = cursor;
          cursor += 1;
          results[currentIndex] = await mapper(
            values[currentIndex],
            currentIndex
          );
        }
      }
    );

    await Promise.all(workers);
    return results;
  }
}

type AmazonPlaylistPageData = {
  artworkUrl?: string;
  owner?: string;
  title?: string;
  trackAsins: string[];
};

type AmazonTrackPageData = {
  albumUrl?: string;
  artistUrl?: string;
  artworkUrl?: string;
  durationMs?: number;
  sourceUrl?: string;
  title?: string;
};
