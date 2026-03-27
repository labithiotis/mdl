import type { Schema } from 'effect';
import type {
  manifestTrackSchema,
  playlistMetadataSchema,
  playlistTrackSchema,
  providerSchema,
  syncManifestSchema,
} from './schemas';

export type Provider = Schema.Schema.Type<typeof providerSchema>;

export type PlaylistTrack = Schema.Schema.Type<typeof playlistTrackSchema>;

export type PlaylistMetadata = Schema.Schema.Type<
  typeof playlistMetadataSchema
>;

export type ManifestTrack = Schema.Schema.Type<typeof manifestTrackSchema>;

export type SyncManifest = Schema.Schema.Type<typeof syncManifestSchema>;

export type SyncSummary = {
  downloaded: number;
  skipped: number;
  failed: Array<{
    track: PlaylistTrack;
    reason: string;
  }>;
  playlistDir: string;
  manifestPath: string;
};

export type SyncStage =
  | 'initializing'
  | 'checking-manifest'
  | 'searching-youtube'
  | 'downloading-audio'
  | 'writing-metadata'
  | 'writing-manifest'
  | 'skipped'
  | 'failed'
  | 'completed';

export type SyncProgress = {
  current: number;
  total: number;
  completed: number;
  downloaded: number;
  skipped: number;
  failed: number;
  trackIndex?: number;
  workerCount?: number;
  workerId?: number;
  playlistDir: string;
  progress?: number;
  downloadPercent?: number;
  stage: SyncStage;
  track?: PlaylistTrack;
  message: string;
  fileName?: string;
  fileSizeLabel?: string;
  youtubeUrl?: string;
};
