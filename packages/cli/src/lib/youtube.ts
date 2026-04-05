import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import sanitizeFilename from 'sanitize-filename';
import { Innertube, Log } from 'youtubei.js';
import type { AudioFormat, AudioQuality } from './args';
import { ensureFfmpegExecutable } from './ffmpeg';
import type { PlaylistTrack } from './types';

type VideoMatch = {
  id: string;
  title: string;
  author?: string;
  url: string;
  seconds?: number;
};

type SearchResult = {
  videos: VideoMatch[];
};

type YouTubeSearchResult = {
  author?: { name?: string };
  duration?: { text?: string };
  id?: string;
  title?: { toString?: () => string };
  type?: string;
};

type YouTubeAudioStream = {
  contentLength?: number;
  format: 'mp4' | 'webm';
  mimeType: string;
  stream: ReadableStream<Uint8Array>;
};

type NodeReadableStream = import('node:stream/web').ReadableStream<Uint8Array>;

export type DownloadProgress = {
  currentSpeed?: string;
  eta?: string;
  percent?: number;
  totalSize?: string;
};

const execFileAsync = promisify(execFile);
const YOUTUBE_SEARCH_RESULT_COUNT = 5;
const YOUTUBE_DOWNLOAD_CLIENTS = ['ANDROID', 'MWEB', 'WEB'] as const;
let youtubeClientPromise: Promise<Innertube> | null = null;

Log.setLevel(Log.Level.ERROR);

export async function searchYoutubeTrack(
  track: PlaylistTrack
): Promise<VideoMatch> {
  const [candidate] = await searchYoutubeTrackCandidates(track);

  if (!candidate) {
    throw new Error(
      `No YouTube match found for ${track.artists.join(', ')} - ${track.title}.`
    );
  }

  return candidate;
}

export async function searchYoutubeTrackCandidates(
  track: PlaylistTrack
): Promise<VideoMatch[]> {
  const query = `${track.artists.join(', ')} - ${track.title} audio`;
  const result = await searchYouTube(query);
  const candidates = result.videos
    .filter((video) => video.id && video.url)
    .sort((left, right) => scoreVideo(track, right) - scoreVideo(track, left));

  if (candidates.length === 0) {
    throw new Error(
      `No YouTube match found for ${track.artists.join(', ')} - ${track.title}.`
    );
  }

  return candidates;
}

export async function downloadTrackAudio(params: {
  audioFormat?: AudioFormat;
  audioQuality?: AudioQuality;
  destinationDir: string;
  index: number;
  onProgress?: (progress: DownloadProgress) => void;
  track: PlaylistTrack;
  youtubeUrl: string;
  signal?: AbortSignal;
}): Promise<{ fileName: string; relativePath: string }> {
  const {
    audioFormat = 'mp3',
    audioQuality = 'best',
    destinationDir,
    index,
    onProgress,
    track,
    youtubeUrl,
    signal,
  } = params;
  const baseName = `${String(index).padStart(2, '0')} - ${sanitizeFilename(`${track.artists.join(', ')} - ${track.title}`) || `track-${index}`}`;
  const fileName = `${baseName}.${audioFormat}`;
  const finalPath = path.join(destinationDir, fileName);

  await mkdir(destinationDir, { recursive: true });
  await downloadWithYoutubeJs({
    audioFormat,
    audioQuality,
    destinationPath: finalPath,
    onProgress,
    youtubeUrl,
    signal,
  });

  return {
    fileName,
    relativePath: fileName,
  };
}

async function searchYouTube(query: string): Promise<SearchResult> {
  const client = await getYouTubeClient();
  const search = await client.search(query);
  const videos = search.results
    .map((item: unknown) => normalizeSearchResult(item as YouTubeSearchResult))
    .filter((item: VideoMatch | null): item is VideoMatch => item !== null)
    .slice(0, YOUTUBE_SEARCH_RESULT_COUNT);

  return { videos };
}

function normalizeSearchResult(result: YouTubeSearchResult): VideoMatch | null {
  if (result.type !== 'Video' || !result.id) {
    return null;
  }

  const title = result.title?.toString?.().trim();
  if (!title) {
    return null;
  }

  return {
    id: result.id,
    title,
    author: result.author?.name?.trim(),
    url: `https://www.youtube.com/watch?v=${result.id}`,
    seconds: parseDurationSeconds(result.duration?.text),
  };
}

function scoreVideo(track: PlaylistTrack, video: VideoMatch): number {
  let score = 0;
  const haystack = `${video.title} ${video.author ?? ''}`.toLowerCase();

  if (haystack.includes(track.title.toLowerCase())) score += 5;

  for (const artist of track.artists) {
    if (haystack.includes(artist.toLowerCase())) {
      score += 3;
    }
  }

  if (!haystack.includes('live')) score += 1;
  if (!haystack.includes('cover')) score += 1;

  if (
    typeof track.durationMs === 'number' &&
    typeof video.seconds === 'number'
  ) {
    const delta = Math.abs(track.durationMs / 1000 - video.seconds);
    score += Math.max(0, 10 - delta / 5);
  }

  return score;
}

async function downloadWithYoutubeJs(options: {
  audioFormat: AudioFormat;
  audioQuality: AudioQuality;
  destinationPath: string;
  onProgress?: (progress: DownloadProgress) => void;
  youtubeUrl: string;
  signal?: AbortSignal;
}): Promise<void> {
  const ffmpegPath = await ensureFfmpegExecutable();
  const stream = await resolveAudioStream(
    options.youtubeUrl,
    options.audioFormat
  );
  const args = buildFfmpegArgs({
    audioFormat: options.audioFormat,
    audioQuality: options.audioQuality,
    destinationPath: options.destinationPath,
    inputFormat: stream.format,
  });
  const child = execFile(ffmpegPath, args, {
    signal: options.signal,
    windowsHide: true,
  });
  const inputStream = Readable.fromWeb(
    stream.stream as unknown as NodeReadableStream
  );

  if (!child.stdin) {
    inputStream.destroy();
    throw new Error('ffmpeg stdin was not available for audio piping.');
  }

  let stderr = '';
  const progressParser = createFfmpegProgressParser((progress) => {
    options.onProgress?.({
      currentSpeed: progress.currentSpeed,
      eta: progress.eta,
      percent:
        typeof stream.contentLength === 'number' && stream.contentLength > 0
          ? Math.min(
              100,
              (progress.totalSizeBytes / stream.contentLength) * 100
            )
          : undefined,
      totalSize:
        formatBytes(stream.contentLength) ||
        formatBytes(progress.totalSizeBytes),
    });
  });

  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    progressParser(text);
  });

  const processPromise = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}.`));
    });
  });

  try {
    await Promise.all([pipeline(inputStream, child.stdin), processPromise]);
  } catch (error) {
    inputStream.destroy();
    child.kill('SIGKILL');
    throw error;
  }
}

async function resolveAudioStream(
  youtubeUrl: string,
  audioFormat: AudioFormat
): Promise<YouTubeAudioStream> {
  const videoId = extractYouTubeVideoId(youtubeUrl);
  const client = await getYouTubeClient();
  const requestedContainer = getRequestedContainer(audioFormat);
  let lastError: unknown = null;

  for (const requestClient of YOUTUBE_DOWNLOAD_CLIENTS) {
    const requestOptions = {
      client: requestClient,
      type: 'audio' as const,
      format: requestedContainer,
    };

    try {
      return await resolveAudioStreamForClient({
        client,
        requestOptions,
        requestedContainer,
        videoId,
      });
    } catch (error) {
      if (!isRetryableYouTubeClientError(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw (
    lastError ??
    new Error(`Unable to resolve an audio stream for ${youtubeUrl}.`)
  );
}

export function getRequestedContainer(
  audioFormat: AudioFormat
): 'mp4' | 'webm' {
  return audioFormat === 'opus' ? 'webm' : 'mp4';
}

export function isStreamingDataUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Streaming data not available');
}

export function isRetryableYouTubeClientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  return (
    isStreamingDataUnavailableError(error) ||
    normalizedMessage.includes('login required')
  );
}

async function resolveAudioStreamForClient(params: {
  client: Innertube;
  requestOptions: {
    client: (typeof YOUTUBE_DOWNLOAD_CLIENTS)[number];
    type: 'audio';
    format: 'mp4' | 'webm';
  };
  requestedContainer: 'mp4' | 'webm';
  videoId: string;
}): Promise<YouTubeAudioStream> {
  try {
    const selected = await params.client.getStreamingData(
      params.videoId,
      params.requestOptions
    );
    const downloadStream = await params.client.download(
      params.videoId,
      params.requestOptions
    );
    const mimeType = String(selected.mime_type);
    const format = mimeType.includes('webm') ? 'webm' : 'mp4';

    return {
      contentLength:
        typeof selected.content_length === 'number'
          ? selected.content_length
          : undefined,
      format,
      mimeType,
      stream: downloadStream,
    };
  } catch (error) {
    if (!isStreamingDataUnavailableError(error)) {
      throw error;
    }

    // Some videos no longer expose decipherable streaming metadata for the
    // chosen client, but download() can still provide a readable audio stream.
    const downloadStream = await params.client.download(
      params.videoId,
      params.requestOptions
    );

    return {
      contentLength: undefined,
      format: params.requestedContainer,
      mimeType:
        params.requestedContainer === 'webm' ? 'audio/webm' : 'audio/mp4',
      stream: downloadStream,
    };
  }
}

function buildFfmpegArgs(params: {
  audioFormat: AudioFormat;
  audioQuality: AudioQuality;
  destinationPath: string;
  inputFormat: 'mp4' | 'webm';
}): string[] {
  const args = [
    '-y',
    '-v',
    'error',
    '-nostats',
    '-progress',
    'pipe:2',
    '-f',
    params.inputFormat,
    '-i',
    'pipe:0',
    '-vn',
  ];

  if (params.audioQuality !== 'best') {
    if (/^\d+K$/i.test(params.audioQuality)) {
      args.push('-b:a', params.audioQuality);
    } else if (
      /^\d+$/.test(params.audioQuality) &&
      params.audioFormat === 'mp3'
    ) {
      args.push('-q:a', params.audioQuality);
    }
  }

  switch (params.audioFormat) {
    case 'm4a':
      args.push('-c:a', 'aac');
      break;
    case 'opus':
      args.push('-c:a', 'libopus');
      break;
    case 'flac':
      args.push('-c:a', 'flac');
      break;
    case 'wav':
      args.push('-c:a', 'pcm_s16le');
      break;
    default:
      args.push('-c:a', 'libmp3lame');
      break;
  }

  args.push(params.destinationPath);
  return args;
}

type FfmpegProgress = {
  currentSpeed?: string;
  eta?: string;
  totalSizeBytes: number;
};

function createFfmpegProgressParser(
  onProgress: (progress: FfmpegProgress) => void
): (chunk: string) => void {
  let buffer = '';
  const currentProgress: FfmpegProgress = { totalSizeBytes: 0 };

  return (chunk: string) => {
    buffer += chunk;

    while (buffer.includes('\n')) {
      const newlineIndex = buffer.indexOf('\n');
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      const [key, value] = line.split('=');
      if (!key || value === undefined) {
        continue;
      }

      if (key === 'total_size') {
        const totalSizeBytes = Number.parseInt(value, 10);
        if (Number.isFinite(totalSizeBytes)) {
          currentProgress.totalSizeBytes = totalSizeBytes;
        }
      } else if (key === 'speed') {
        currentProgress.currentSpeed = value === 'N/A' ? undefined : value;
      } else if (key === 'progress') {
        onProgress(currentProgress);
      }
    }
  };
}

function extractYouTubeVideoId(url: string): string {
  const parsedUrl = new URL(url);
  const videoId = parsedUrl.searchParams.get('v')?.trim();

  if (videoId) {
    return videoId;
  }

  if (parsedUrl.hostname === 'youtu.be') {
    const shortId = parsedUrl.pathname.replace(/^\/+/, '').trim();
    if (shortId) {
      return shortId;
    }
  }

  throw new Error(`Invalid YouTube URL: ${url}`);
}

function parseDurationSeconds(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parts = value
    .split(':')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

  if (parts.length < 2 || parts.length > 3) {
    return undefined;
  }

  const [hours, minutes, seconds] =
    parts.length === 3 ? parts : [0, parts[0], parts[1]];

  return (hours * 60 + minutes) * 60 + seconds;
}

function formatBytes(value?: number): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${Math.round(size * 10) / 10} ${units[unitIndex]}`;
}

async function getYouTubeClient(): Promise<Innertube> {
  youtubeClientPromise ??= Innertube.create();
  return youtubeClientPromise;
}

export async function ensureYouTubeDownloadPrerequisites(): Promise<void> {
  await execFileAsync(await ensureFfmpegExecutable(), ['-version']);
}
