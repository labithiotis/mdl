import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadManifest, MANIFEST_FILE_NAME } from './manifest';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe('manifest', () => {
  test('loadManifest returns null when the manifest JSON is invalid', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(path.join(directory, MANIFEST_FILE_NAME), '{invalid json');

    const manifest = await loadManifest(directory);

    expect(manifest).toBeNull();
  });

  test('loadManifest returns null when the manifest shape is invalid', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(
      path.join(directory, MANIFEST_FILE_NAME),
      `${JSON.stringify({ version: 1, tracks: 'bad' })}\n`
    );

    const manifest = await loadManifest(directory);

    expect(manifest).toBeNull();
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mdl-manifest-test-'));
  temporaryDirectories.push(directory);
  await mkdir(directory, { recursive: true });
  return directory;
}
