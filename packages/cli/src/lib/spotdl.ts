import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SyncManifest } from './types';
import { getFirstNonEmptyString } from './utils';

export const SPOTDL_FILE_EXTENSION = '.spotdl';

type SpotdlSong = {
  album_id?: string;
  list_name?: string;
  list_url?: string;
  song_id?: string;
  url?: string;
};

type SpotdlSaveFile = {
  query?: string[];
  songs?: SpotdlSong[];
};

export async function loadSpotdlManifest(directory: string): Promise<SyncManifest | null> {
  const spotdlPath = await findSpotdlFile(directory);
  if (!spotdlPath) {
    return null;
  }

  try {
    const content = await readFile(spotdlPath, 'utf8');
    return parseSpotdlSaveFile(JSON.parse(content));
  } catch {
    return null;
  }
}

async function findSpotdlFile(directory: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return null;
  }

  const fileName = entries.find((entry) => entry.toLowerCase().endsWith(SPOTDL_FILE_EXTENSION));
  return fileName ? path.join(directory, fileName) : null;
}

function parseSpotdlSaveFile(value: unknown): SyncManifest | null {
  const saveFile = value as Partial<SpotdlSaveFile>;
  const firstSong = saveFile.songs?.[0];
  const playlistUrl = getFirstNonEmptyString(saveFile.query?.[0], firstSong?.list_url, firstSong?.url);

  if (!playlistUrl) {
    return null;
  }

  const playlistId = getFirstNonEmptyString(extractSpotifyId(playlistUrl), firstSong?.album_id, firstSong?.song_id);
  if (!playlistId) {
    return null;
  }

  return {
    version: 1,
    provider: 'spotify',
    playlistId,
    playlistTitle: getFirstNonEmptyString(firstSong?.list_name) ?? 'Spotify playlist',
    playlistUrl,
    generatedAt: new Date().toISOString(),
    tracks: [],
  };
}

function extractSpotifyId(url: string): string | undefined {
  return url.match(/\/(?:playlist|album|track)\/([A-Za-z0-9]+)/)?.[1];
}
