import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Either } from 'effect';
import { syncManifestSchema } from './schemas';
import type { SyncManifest } from './types';
import {
  decodeUnknownEither,
  formatSchemaParseError,
  ManifestDecodeError,
} from './utils';

export const MANIFEST_FILE_NAME = '.mdl.json';

export async function loadManifest(
  directory: string
): Promise<SyncManifest | null> {
  const manifestPath = path.join(directory, MANIFEST_FILE_NAME);

  try {
    await access(manifestPath);
  } catch {
    return null;
  }

  try {
    const content = await readFile(manifestPath, 'utf8');
    return normalizeManifest(JSON.parse(content));
  } catch {
    return null;
  }
}

export async function saveManifest(
  directory: string,
  manifest: SyncManifest
): Promise<string> {
  await mkdir(directory, { recursive: true });

  const manifestPath = path.join(directory, MANIFEST_FILE_NAME);
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  return manifestPath;
}

function normalizeManifest(value: unknown): SyncManifest {
  const manifestResult = decodeUnknownEither(syncManifestSchema, value);
  if (Either.isLeft(manifestResult)) {
    throw new ManifestDecodeError({
      message: formatSchemaParseError(manifestResult.left),
    });
  }

  return manifestResult.right;
}
