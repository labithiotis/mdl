import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadInstallationId } from './installation';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe('installation ID', () => {
  test('creates and reuses a UUID', async () => {
    const directory = await createTemporaryDirectory();
    const installationId = await loadInstallationId(directory);

    expect(installationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(await loadInstallationId(directory)).toBe(installationId);
    expect(JSON.parse(await readFile(path.join(directory, 'config.json'), 'utf8'))).toEqual({ installationId });
  });

  test('replaces malformed configuration', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(path.join(directory, 'config.json'), '{broken');

    await expect(loadInstallationId(directory)).resolves.toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('shares one UUID across concurrent first-run processes', async () => {
    const directory = await createTemporaryDirectory();
    const installationIds = await Promise.all(Array.from({ length: 10 }, () => loadInstallationId(directory)));

    expect(new Set(installationIds).size).toBe(1);
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mdl-installation-'));
  temporaryDirectories.push(directory);
  return directory;
}
