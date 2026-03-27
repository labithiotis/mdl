import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { render } from 'ink-testing-library';
import { describe, expect, test } from 'bun:test';
import { MANIFEST_FILE_NAME } from '../src/lib/manifest';
import type { SyncManifest } from '../src/lib/types';
import { App } from '../src/ui/app';
import { waitFor } from './utils';

const PLAYLIST_URL =
  'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2';
const INPUT_PROMPT_TEXT = 'Paste a music URL and press Enter';

describe('cli-playlist-download', () => {
  test(
    'downloads the single-track playlist',
    async () => {
      const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'mdl-e2e-'));
      const app = render(
        <App
          audioFormat="mp3"
          audioQuality="best"
          downloadParallelism={5}
          initialOutputDir={outputRoot}
        />
      );

      try {
        await waitFor(
          () => Boolean(app.lastFrame()?.includes(INPUT_PROMPT_TEXT)),
          'interactive prompt to render'
        );

        app.stdin.write(PLAYLIST_URL);

        await waitFor(
          () => Boolean(app.lastFrame()?.includes(PLAYLIST_URL)),
          'typed playlist URL to appear in the input'
        );

        app.stdin.write('\r');

        await waitFor(
          () => !Boolean(app.lastFrame()?.includes(INPUT_PROMPT_TEXT)),
          'app to leave the input screen after submit'
        );

        await waitFor(
          () =>
            app.frames.some(
              (frame) =>
                frame.includes('Finished') && frame.includes('Downloaded')
            ),
          'finished screen to render'
        );

        const playlistDirs = await readdir(outputRoot, { withFileTypes: true });
        const [playlistDirEntry] = playlistDirs.filter((entry) =>
          entry.isDirectory()
        );

        expect(
          playlistDirEntry,
          'expected a playlist directory to be created'
        ).toBeTruthy();

        const playlistDir = path.join(outputRoot, playlistDirEntry.name);
        const manifestPath = path.join(playlistDir, MANIFEST_FILE_NAME);
        const manifest = JSON.parse(
          await readFile(manifestPath, 'utf8')
        ) as SyncManifest;
        const downloadedFiles = (await readdir(playlistDir)).filter((fileName) =>
          fileName.endsWith('.mp3')
        );

        expect(manifest.playlistId).toBe('5GAMKM0kDTvEMk244CL9n2');
        expect(manifest.tracks).toHaveLength(1);
        expect(downloadedFiles).toHaveLength(1);
        expect(manifest.tracks[0]?.fileName).toBe(downloadedFiles[0]);

        const fileStats = await stat(path.join(playlistDir, downloadedFiles[0]));
        expect(
          fileStats.size > 0,
          'expected the downloaded audio file to be non-empty'
        ).toBe(true);
        expect(manifest.tracks[0]?.title).toBe('Never Gonna Give You Up');
        expect(manifest.tracks[0]?.artists).toEqual(['Rick Astley']);
      } finally {
        app.unmount();
        await rm(outputRoot, { recursive: true, force: true });
      }
    },
    300_000
  );
});
