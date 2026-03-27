import { execFile } from 'node:child_process';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { ensureFfmpegExecutable } from './ffmpeg';
import type { PlaylistTrack } from './types';

const execFileAsync = promisify(execFile);
const METADATA_TEMP_DIR_PREFIX = '.mdl-metadata-';

export async function writeTrackMetadata(params: {
  filePath: string;
  track: PlaylistTrack;
  signal?: AbortSignal;
}): Promise<void> {
  const { filePath, track, signal } = params;
  const ffmpegPath = await ensureFfmpegExecutable();
  const tempDir = await mkdtemp(
    path.join(path.dirname(filePath), METADATA_TEMP_DIR_PREFIX)
  );
  const outputPath = path.join(tempDir, path.basename(filePath));
  let coverPath = track.artworkUrl
    ? path.join(tempDir, getArtworkFileName(track.artworkUrl))
    : null;

  try {
    if (coverPath && track.artworkUrl) {
      try {
        await downloadArtwork(track.artworkUrl, coverPath, signal);
      } catch {
        coverPath = null;
      }
    }

    const args = [
      '-y',
      '-i',
      filePath,
      ...(coverPath ? ['-i', coverPath] : []),
      '-map',
      '0:a',
      ...(coverPath ? ['-map', '1:v'] : []),
      '-c',
      'copy',
      '-id3v2_version',
      '3',
      ...buildMetadataArgs(track, Boolean(coverPath)),
      outputPath,
    ];

    await execFileAsync(ffmpegPath, args, {
      maxBuffer: 1024 * 1024 * 8,
      signal,
    });

    await rename(outputPath, filePath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function buildMetadataArgs(
  track: PlaylistTrack,
  hasArtwork: boolean
): string[] {
  const metadataArgs = [
    '-metadata',
    `title=${track.title}`,
    '-metadata',
    `artist=${track.artists.join(', ')}`,
  ];

  if (track.album) {
    metadataArgs.push('-metadata', `album=${track.album}`);
  }

  if (hasArtwork) {
    metadataArgs.push(
      '-metadata:s:v',
      'title=Album cover',
      '-metadata:s:v',
      'comment=Cover (front)',
      '-disposition:v:0',
      'attached_pic'
    );
  }

  return metadataArgs;
}

async function downloadArtwork(
  artworkUrl: string,
  destinationPath: string,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(artworkUrl, { signal });

  if (!response.ok) {
    throw new Error(`Failed to download artwork (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(destinationPath, Buffer.from(arrayBuffer));
}

function getArtworkFileName(artworkUrl: string): string {
  const extension = path.extname(new URL(artworkUrl).pathname) || '.jpg';
  return `cover${extension}`;
}
