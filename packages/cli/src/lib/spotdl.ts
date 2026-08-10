import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Either } from 'effect';
import { detectProvider } from './providers/Providers';
import { spotdlMetadataFileSchema, spotdlSaveFileSchema } from './schemas';
import type { SyncManifest } from './types';
import { decodeUnknownEither, getFirstNonEmptyString } from './utils';

const SPOTDL_FILE_EXTENSION = '.spotdl';

export async function loadSpotdlManifest(directory: string): Promise<SyncManifest | null> {
  const spotdlPaths = await findSpotdlFiles(directory);

  for (const spotdlPath of spotdlPaths) {
    try {
      const content = await readFile(spotdlPath, 'utf8');
      const manifest = parseSpotdlSaveFile(JSON.parse(content));
      if (manifest) {
        return manifest;
      }
    } catch {}
  }

  return null;
}

async function findSpotdlFiles(directory: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.toLowerCase().endsWith(SPOTDL_FILE_EXTENSION))
    .sort()
    .map((fileName) => path.join(directory, fileName));
}

function parseSpotdlSaveFile(value: unknown): SyncManifest | null {
  const saveFileResult = decodeUnknownEither(spotdlSaveFileSchema, value);
  if (Either.isRight(saveFileResult)) {
    return parseSpotdlCollection(saveFileResult.right.songs, saveFileResult.right.query);
  }

  const metadataFileResult = decodeUnknownEither(spotdlMetadataFileSchema, value);
  return Either.isRight(metadataFileResult) ? parseSpotdlCollection(metadataFileResult.right, []) : null;
}

function parseSpotdlCollection(
  songs: ReadonlyArray<{ list_name: string | null; list_url: string | null }>,
  query: ReadonlyArray<string>
): SyncManifest | null {
  const firstSong = songs[0];
  const collection = [firstSong?.list_url, query[0]]
    .map(parseSpotifyCollection)
    .find((candidate) => candidate !== null);

  if (!collection) {
    return null;
  }

  return {
    version: 1,
    provider: 'spotify',
    playlistId: collection.id,
    playlistTitle: getFirstNonEmptyString(firstSong?.list_name) ?? 'Spotify playlist',
    playlistUrl: collection.url,
    generatedAt: new Date().toISOString(),
    tracks: [],
  };
}

function parseSpotifyCollection(value: string | null | undefined): { id: string; url: string } | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  const uriMatch = trimmedValue.match(/^spotify:(playlist|album|track):([A-Za-z0-9]+)$/i);
  if (uriMatch) {
    return {
      id: uriMatch[2],
      url: `https://open.spotify.com/${uriMatch[1].toLowerCase()}/${uriMatch[2]}`,
    };
  }

  if (detectProvider(trimmedValue) !== 'spotify') {
    return null;
  }

  const url = new URL(trimmedValue);
  const pathMatch = url.pathname.match(/\/(playlist|album|track)\/([A-Za-z0-9]+)\/?$/i);
  return pathMatch ? { id: pathMatch[2], url: trimmedValue } : null;
}
