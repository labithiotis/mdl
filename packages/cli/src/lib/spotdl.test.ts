import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadSpotdlManifest } from './spotdl';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe('spotdl', () => {
  test('loadSpotdlManifest returns null when no .spotdl file is present', async () => {
    const directory = await createTemporaryDirectory();

    const manifest = await loadSpotdlManifest(directory);

    expect(manifest).toBeNull();
  });

  test('loadSpotdlManifest extracts the playlist url and title from the sync query', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(
      path.join(directory, 'Kids Dance Warm Up.spotdl'),
      JSON.stringify({
        type: 'sync',
        query: ['https://open.spotify.com/playlist/2zLOKKbeMZ6mRznJTbI2ql?si=e13829d468a944d4'],
        songs: [
          {
            name: "Better When I'm Dancin'",
            song_id: '5k5fWendNngd89O8JKoE8L',
            url: 'https://open.spotify.com/track/5k5fWendNngd89O8JKoE8L',
            list_name: 'Kids Dance Warm Up',
            list_url: 'https://open.spotify.com/playlist/2zLOKKbeMZ6mRznJTbI2ql?si=e13829d468a944d4',
          },
        ],
      })
    );

    const manifest = await loadSpotdlManifest(directory);

    expect(manifest).toEqual(
      expect.objectContaining({
        provider: 'spotify',
        playlistId: '2zLOKKbeMZ6mRznJTbI2ql',
        playlistTitle: 'Kids Dance Warm Up',
        playlistUrl: 'https://open.spotify.com/playlist/2zLOKKbeMZ6mRznJTbI2ql?si=e13829d468a944d4',
        tracks: [],
      })
    );
  });

  test('loadSpotdlManifest falls back to the first song list_url when query is missing', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(
      path.join(directory, 'playlist.spotdl'),
      JSON.stringify({
        songs: [
          {
            list_name: 'Fallback Playlist',
            list_url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
          },
        ],
      })
    );

    const manifest = await loadSpotdlManifest(directory);

    expect(manifest?.playlistUrl).toBe('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    expect(manifest?.playlistId).toBe('37i9dQZF1DXcBWIGoYBM5M');
  });

  test('loadSpotdlManifest returns null when the save file has no usable url', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(path.join(directory, 'empty.spotdl'), JSON.stringify({ songs: [] }));

    const manifest = await loadSpotdlManifest(directory);

    expect(manifest).toBeNull();
  });

  test('loadSpotdlManifest returns null when the save file is invalid JSON', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(path.join(directory, 'broken.spotdl'), '{invalid json');

    const manifest = await loadSpotdlManifest(directory);

    expect(manifest).toBeNull();
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mdl-spotdl-test-'));
  temporaryDirectories.push(directory);
  await mkdir(directory, { recursive: true });
  return directory;
}
