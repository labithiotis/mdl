import { Schema } from 'effect';

export const PROVIDERS = [
  'spotify',
  'apple-music',
  'amazon-music',
  'youtube-music',
  'soundcloud',
  'bandcamp',
  'qobuz',
  'deezer',
  'tidal',
] as const;

export const providerSchema = Schema.Literal(...PROVIDERS);

export const playlistTrackSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  artists: Schema.Array(Schema.String),
  album: Schema.optional(Schema.String),
  artworkUrl: Schema.optional(Schema.String),
  durationMs: Schema.optional(Schema.Number),
  sourceUrl: Schema.optional(Schema.String),
});

export const playlistMetadataSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  owner: Schema.optional(Schema.String),
  artworkUrl: Schema.optional(Schema.String),
  provider: providerSchema,
  sourceUrl: Schema.String,
  tracks: Schema.Array(playlistTrackSchema),
});

export const manifestTrackSchema = Schema.Struct({
  sourceTrackId: Schema.String,
  title: Schema.String,
  artists: Schema.Array(Schema.String),
  album: Schema.optional(Schema.String),
  artworkUrl: Schema.optional(Schema.String),
  sourceUrl: Schema.optional(Schema.String),
  youtubeUrl: Schema.String,
  youtubeId: Schema.String,
  fileName: Schema.String,
  relativePath: Schema.String,
  downloadedAt: Schema.String,
});

export const syncManifestSchema = Schema.Struct({
  version: Schema.Literal(1),
  provider: providerSchema,
  playlistId: Schema.String,
  playlistTitle: Schema.String,
  playlistUrl: Schema.String,
  generatedAt: Schema.String,
  tracks: Schema.Array(manifestTrackSchema),
});
