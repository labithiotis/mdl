import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { Effect } from 'effect';
import sanitizeFilename from 'sanitize-filename';
import type { AudioFormat, AudioQuality } from './args';
import { loadManifest, MANIFEST_FILE_NAME, saveManifest } from './manifest';
import { writeTrackMetadata } from './metadata';
import type {
  ManifestTrack,
  PlaylistMetadata,
  PlaylistTrack,
  SyncManifest,
  SyncProgress,
  SyncStage,
  SyncSummary,
} from './types';
import { formatEffectError, runEffectWithRetry, TrackSyncError } from './utils';
import { downloadTrackAudio, searchYoutubeTrackCandidates } from './youtube';

const SEARCH_STAGE_DURATION_MS = 45_000;
const TRACK_RETRY_DELAY_MS = 300;
const TRACK_RETRY_COUNT = 2;

const TRACK_STAGE_RANGES = {
  initializing: [1, 5],
  searching: [5, 45],
  downloading: [45, 90],
  metadata: [90, 96],
  manifest: [96, 99],
} as const;

export async function syncPlaylist(params: {
  audioFormat?: AudioFormat;
  audioQuality?: AudioQuality;
  downloadParallelism?: number;
  playlist: PlaylistMetadata;
  outputRootDir: string;
  onProgress?: (progress: SyncProgress) => void;
  signal?: AbortSignal;
}): Promise<SyncSummary> {
  const {
    audioFormat,
    audioQuality,
    downloadParallelism = 5,
    playlist,
    outputRootDir,
    onProgress,
    signal,
  } = params;
  const playlistDir = await resolvePlaylistDirectory(outputRootDir, playlist);
  const existingManifest = await loadManifest(playlistDir);
  let manifest: SyncManifest = existingManifest ?? {
    version: 1,
    provider: playlist.provider,
    playlistId: playlist.id,
    playlistTitle: playlist.title,
    playlistUrl: playlist.sourceUrl,
    generatedAt: new Date().toISOString(),
    tracks: [],
  };
  const existingTracks = new Map(
    manifest.tracks.map((track) => [track.sourceTrackId, track])
  );
  const failed: SyncSummary['failed'] = [];
  let downloaded = 0;
  let skipped = 0;
  let manifestSaveQueue = Promise.resolve();

  onProgress?.({
    current: 0,
    total: playlist.tracks.length,
    completed: 0,
    downloaded,
    skipped,
    failed: failed.length,
    workerCount: downloadParallelism,
    playlistDir,
    progress: 0,
    stage: 'checking-manifest',
    message: existingManifest
      ? `Loaded existing manifest with ${manifest.tracks.length} tracked files`
      : `Creating a new manifest in ${MANIFEST_FILE_NAME}. Downloading up to ${downloadParallelism} tracks in parallel`,
  });

  await mapWithConcurrency(
    playlist.tracks,
    downloadParallelism,
    async (track, index, workerId) => {
      signal?.throwIfAborted();
      const trackIndex = index + 1;
      const emitTrackProgress = (
        overrides: Partial<SyncProgress> &
          Pick<SyncProgress, 'message' | 'stage'>
      ) => {
        const progress =
          overrides.progress ?? progressForStage(overrides.stage);

        onProgress?.({
          current: trackIndex,
          total: playlist.tracks.length,
          completed: downloaded + skipped + failed.length,
          downloaded,
          skipped,
          failed: failed.length,
          trackIndex,
          workerCount: downloadParallelism,
          workerId,
          playlistDir,
          progress,
          track,
          ...overrides,
        });
      };

      emitTrackProgress({
        progress: trackProgressForRatio(...TRACK_STAGE_RANGES.initializing, 0),
        stage: 'initializing',
        message: 'Preparing track',
      });

      const existingTrack = existingTracks.get(track.id);
      if (
        existingTrack &&
        (await fileExists(path.join(playlistDir, existingTrack.relativePath)))
      ) {
        skipped += 1;
        emitTrackProgress({
          progress: 100,
          stage: 'skipped',
          message: 'Already downloaded',
        });
        return;
      }

      try {
        const completedTrack = await Effect.runPromise(
          runEffectWithRetry({
            baseDelayMs: TRACK_RETRY_DELAY_MS,
            maxRetries: TRACK_RETRY_COUNT,
            effect: Effect.gen(function* () {
              yield* Effect.sync(() => signal?.throwIfAborted());
              const youtubeMatches = yield* runEffectWithRetry({
                baseDelayMs: TRACK_RETRY_DELAY_MS,
                maxRetries: TRACK_RETRY_COUNT,
                effect: Effect.tryPromise({
                  try: () =>
                    withEstimatedStageProgress({
                      durationMs: SEARCH_STAGE_DURATION_MS,
                      endPercent: TRACK_STAGE_RANGES.searching[1],
                      onProgress: (progress) => {
                        emitTrackProgress({
                          progress,
                          stage: 'searching-youtube',
                          message: 'Searching YouTube',
                        });
                      },
                      startPercent: TRACK_STAGE_RANGES.searching[0],
                      task: () => searchYoutubeTrackCandidates(track),
                    }),
                  catch: (error) =>
                    toTrackSyncError(track, 'searching-youtube', error),
                }),
                onRetry: (attempt, error) => {
                  emitTrackProgress({
                    progress: TRACK_STAGE_RANGES.searching[0],
                    stage: 'searching-youtube',
                    message: formatRetryMessage(
                      'Searching YouTube',
                      attempt,
                      error
                    ),
                  });
                },
              });
              let lastDownloadError: TrackSyncError | null = null;

              for (const candidate of youtubeMatches) {
                yield* Effect.sync(() => signal?.throwIfAborted());
                const downloadMessage = 'Downloading track';
                emitTrackProgress({
                  progress: TRACK_STAGE_RANGES.downloading[0],
                  stage: 'downloading-audio',
                  downloadPercent: 0,
                  youtubeUrl: candidate.url,
                  message: downloadMessage,
                });

                const downloadResult = yield* Effect.either(
                  runEffectWithRetry({
                    baseDelayMs: TRACK_RETRY_DELAY_MS,
                    maxRetries: TRACK_RETRY_COUNT,
                    effect: Effect.tryPromise({
                      try: () =>
                        downloadTrackAudio({
                          audioFormat,
                          audioQuality,
                          destinationDir: playlistDir,
                          index: index + 1,
                          onProgress: (downloadProgress) => {
                            emitTrackProgress({
                              progress: trackProgressForRatio(
                                ...TRACK_STAGE_RANGES.downloading,
                                percentToRatio(downloadProgress.percent)
                              ),
                              downloadPercent: clampPercent(
                                downloadProgress.percent ?? 0
                              ),
                              stage: 'downloading-audio',
                              youtubeUrl: candidate.url,
                              message: downloadMessage,
                            });
                          },
                          track,
                          youtubeUrl: candidate.url,
                          signal,
                        }),
                      catch: (error) =>
                        toTrackSyncError(track, 'downloading-audio', error),
                    }),
                    onRetry: (attempt, error) => {
                      emitTrackProgress({
                        progress: TRACK_STAGE_RANGES.downloading[0],
                        stage: 'downloading-audio',
                        youtubeUrl: candidate.url,
                        message: formatRetryMessage(
                          downloadMessage,
                          attempt,
                          error
                        ),
                      });
                    },
                    shouldRetry: (error) =>
                      !isSkippableYouTubeCandidateError(error),
                  })
                );

                if (downloadResult._tag === 'Right') {
                  const file = downloadResult.right;
                  yield* Effect.sync(() => signal?.throwIfAborted());
                  emitTrackProgress({
                    progress: TRACK_STAGE_RANGES.metadata[0],
                    stage: 'writing-metadata',
                    youtubeUrl: candidate.url,
                    message: 'Embedding metadata',
                  });
                  yield* runEffectWithRetry({
                    baseDelayMs: TRACK_RETRY_DELAY_MS,
                    maxRetries: TRACK_RETRY_COUNT,
                    effect: Effect.tryPromise({
                      try: () =>
                        writeTrackMetadata({
                          filePath: path.join(playlistDir, file.relativePath),
                          track,
                          signal,
                        }),
                      catch: (error) =>
                        toTrackSyncError(track, 'writing-metadata', error),
                    }),
                    onRetry: (attempt, error) => {
                      emitTrackProgress({
                        progress: TRACK_STAGE_RANGES.metadata[0],
                        stage: 'writing-metadata',
                        youtubeUrl: candidate.url,
                        message: formatRetryMessage(
                          'Embedding metadata',
                          attempt,
                          error
                        ),
                      });
                    },
                  });
                  const manifestTrack = toManifestTrack(track, candidate, file);
                  emitTrackProgress({
                    progress: TRACK_STAGE_RANGES.manifest[0],
                    stage: 'writing-manifest',
                    fileName: file.fileName,
                    youtubeUrl: candidate.url,
                    message: 'Writing manifest',
                  });
                  manifestSaveQueue = manifestSaveQueue.then(async () => {
                    manifest = upsertManifestTrack(manifest, manifestTrack);
                    manifest = {
                      ...manifest,
                      generatedAt: new Date().toISOString(),
                    };
                    await saveManifest(playlistDir, manifest);
                  });
                  yield* Effect.tryPromise({
                    try: () => manifestSaveQueue,
                    catch: (error) =>
                      toTrackSyncError(track, 'writing-manifest', error),
                  });

                  return {
                    file,
                    youtubeMatch: candidate,
                  };
                }

                lastDownloadError = downloadResult.left;
                if (isSkippableYouTubeCandidateError(lastDownloadError)) {
                  continue;
                }

                yield* Effect.fail(downloadResult.left);
              }

              return yield* Effect.fail(
                lastDownloadError ??
                  new TrackSyncError({
                    reason: 'All YouTube candidates failed.',
                    stage: 'downloading-audio',
                    trackTitle: getTrackLabel(track),
                  })
              );
            }),
            onRetry: (attempt, error) => {
              emitTrackProgress({
                stage: 'initializing',
                message: formatTrackRetryMessage(attempt, error),
              });
            },
            shouldRetry: isRetryableTrackFetchError,
          })
        );
        downloaded += 1;
        const fileStats = await stat(
          path.join(playlistDir, completedTrack.file.relativePath)
        );
        emitTrackProgress({
          progress: 100,
          stage: 'completed',
          fileName: completedTrack.file.fileName,
          fileSizeLabel: formatFileSize(fileStats.size),
          youtubeUrl: completedTrack.youtubeMatch.url,
          message: completedTrack.file.fileName,
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }

        const reason = formatEffectError(error);
        failed.push({ track, reason });
        emitTrackProgress({
          progress: 100,
          stage: 'failed',
          message: reason,
        });
      }
    }
  );

  manifest = {
    ...manifest,
    generatedAt: new Date().toISOString(),
  };
  const manifestPath = await saveManifest(playlistDir, manifest);

  return {
    downloaded,
    skipped,
    failed,
    playlistDir,
    manifestPath,
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  values: readonly TInput[],
  concurrency: number,
  mapper: (value: TInput, index: number, workerId: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(values.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async (_, workerId) => {
      while (cursor < values.length) {
        const currentIndex = cursor;
        cursor += 1;
        results[currentIndex] = await mapper(
          values[currentIndex],
          currentIndex,
          workerId
        );
      }
    }
  );

  await Promise.all(workers);
  return results;
}

function progressForStage(stage: SyncStage): number {
  switch (stage) {
    case 'initializing':
      return TRACK_STAGE_RANGES.initializing[0];
    case 'searching-youtube':
      return TRACK_STAGE_RANGES.searching[0];
    case 'downloading-audio':
      return TRACK_STAGE_RANGES.downloading[0];
    case 'writing-metadata':
      return TRACK_STAGE_RANGES.metadata[0];
    case 'writing-manifest':
      return TRACK_STAGE_RANGES.manifest[0];
    case 'completed':
    case 'skipped':
    case 'failed':
      return 100;
    case 'checking-manifest':
      return 0;
    default:
      return 0;
  }
}

async function resolvePlaylistDirectory(
  outputRootDir: string,
  playlist: PlaylistMetadata
): Promise<string> {
  const preferredDir = path.resolve(
    outputRootDir,
    buildPlaylistFolderName(playlist)
  );
  const preferredManifest = await loadManifest(preferredDir);
  if (manifestMatchesPlaylist(preferredManifest, playlist)) {
    return preferredDir;
  }

  const legacyDir = path.resolve(
    outputRootDir,
    sanitizeFilename(playlist.title) || playlist.id
  );
  const legacyManifest = await loadManifest(legacyDir);
  if (manifestMatchesPlaylist(legacyManifest, playlist)) {
    return legacyDir;
  }

  return preferredDir;
}

function buildPlaylistFolderName(playlist: PlaylistMetadata): string {
  return sanitizeFilename(playlist.title) || 'playlist';
}

function manifestMatchesPlaylist(
  manifest: SyncManifest | null,
  playlist: PlaylistMetadata
): boolean {
  if (!manifest) {
    return false;
  }

  return (
    manifest.playlistId === playlist.id &&
    manifest.provider === playlist.provider &&
    manifest.playlistUrl === playlist.sourceUrl
  );
}

async function withEstimatedStageProgress<T>(params: {
  durationMs: number;
  endPercent: number;
  onProgress: (percent: number) => void;
  startPercent: number;
  task: () => Promise<T>;
}): Promise<T> {
  const startedAt = Date.now();
  params.onProgress(params.startPercent);

  const timer = setInterval(() => {
    const elapsedRatio = Math.min(
      (Date.now() - startedAt) / params.durationMs,
      1
    );
    const easedRatio = easeOutProgress(elapsedRatio);
    params.onProgress(
      trackProgressForRatio(params.startPercent, params.endPercent, easedRatio)
    );
  }, 250);

  try {
    const result = await params.task();
    params.onProgress(params.endPercent);
    return result;
  } finally {
    clearInterval(timer);
  }
}

function trackProgressForRatio(
  startPercent: number,
  endPercent: number,
  ratio: number
): number {
  return clampPercent(
    startPercent + (endPercent - startPercent) * Math.max(0, Math.min(ratio, 1))
  );
}

function percentToRatio(percent?: number): number {
  if (typeof percent !== 'number' || Number.isNaN(percent)) {
    return 0;
  }

  return Math.max(0, Math.min(percent, 100)) / 100;
}

function clampPercent(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 102.4) / 10)}kb`;
  }

  return `${Math.round((sizeBytes / (1024 * 1024)) * 10) / 10}mb`;
}

function easeOutProgress(ratio: number): number {
  return 1 - (1 - Math.max(0, Math.min(ratio, 1))) ** 2;
}

function upsertManifestTrack(
  manifest: SyncManifest,
  track: ManifestTrack
): SyncManifest {
  const existingIndex = manifest.tracks.findIndex(
    (entry) => entry.sourceTrackId === track.sourceTrackId
  );

  if (existingIndex >= 0) {
    return {
      ...manifest,
      tracks: manifest.tracks.map((entry, index) =>
        index === existingIndex ? track : entry
      ),
    };
  }

  return {
    ...manifest,
    tracks: [...manifest.tracks, track],
  };
}

function toManifestTrack(
  track: PlaylistTrack,
  youtubeMatch: { id: string; url: string },
  file: { fileName: string; relativePath: string }
): ManifestTrack {
  return {
    sourceTrackId: track.id,
    title: track.title,
    artists: track.artists,
    album: track.album,
    artworkUrl: track.artworkUrl,
    sourceUrl: track.sourceUrl,
    youtubeUrl: youtubeMatch.url,
    youtubeId: youtubeMatch.id,
    fileName: file.fileName,
    relativePath: file.relativePath,
    downloadedAt: new Date().toISOString(),
  };
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isSkippableYouTubeCandidateError(error: unknown): boolean {
  const message = formatEffectError(error).toLowerCase();

  return (
    message.includes('video is not available') ||
    message.includes('video is login required') ||
    message.includes('login required') ||
    message.includes('private video') ||
    message.includes('sign in to confirm your age') ||
    message.includes('playback on other websites has been disabled') ||
    message.includes('members-only')
  );
}

function toTrackSyncError(
  track: PlaylistTrack,
  stage: SyncStage,
  error: unknown
): TrackSyncError {
  return new TrackSyncError({
    reason: formatUnknownError(error),
    stage,
    trackTitle: getTrackLabel(track),
  });
}

function formatRetryMessage(
  prefix: string,
  attempt: number,
  error: unknown
): string {
  return `${prefix} retry ${attempt}/${TRACK_RETRY_COUNT}: ${formatEffectError(error)}`;
}

function formatTrackRetryMessage(attempt: number, error: unknown): string {
  return `Retrying track ${attempt}/${TRACK_RETRY_COUNT}: ${formatEffectError(error)}`;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getTrackLabel(track: PlaylistTrack): string {
  return `${track.artists.join(', ')} - ${track.title}`;
}

function isRetryableTrackFetchError(error: unknown): boolean {
  if (!(error instanceof TrackSyncError)) {
    return false;
  }

  return error.reason.toLowerCase().includes('fetch failed');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
