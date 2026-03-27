import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { render } from 'ink-testing-library';
import { describe, expect, test } from 'bun:test';
import { App } from '../src/ui/app';
import { waitFor, waitForValue } from './utils';
import { Provider } from '../src/lib/types';

const EXAMPLES: Record<Provider, string> = {
  'spotify': 'https://open.spotify.com/album/6eUW0wxWtzkFdaEFsTJto6',
  'apple-music': 'https://music.apple.com/us/playlist/new-music-daily/pl.2b0e6e332fdf4b7a91164da3162127b5',
  'amazon-music': 'https://music.amazon.com/playlists/B01M11SBC8',
  'soundcloud': 'https://soundcloud.com/soundcloud-amped/sets/the-dive-new-rock-now',
  'bandcamp': 'https://bandcamp.com/sergemedoff/playlist/leipzig-de-rockpop-mix',
  'deezer': 'https://link.deezer.com/s/32LXyVEY8jkF9wlGiSwa1',
  'qobuz': 'https://www.qobuz.com/us-en/playlists/hi-res-masters-jazz-essentials/5104639',
  'tidal': 'https://tidal.com/playlist/36ea71a8-445e-41a4-82ab-6628c581535d',
  'youtube-music': 'https://music.youtube.com/playlist?list=RDCLAK5uy_nHSqCJjDrW9HBhCNdF6tWPdnOMngOv0wA&playnext=1&si=D5Aj97tJAaxyFE4c',
};

describe('cli-provider-smoke', () => {
  for (const [provider, url] of Object.entries(EXAMPLES)) {
    test(
      `downloads the first track for ${provider}`,
      async () => {
        const outputRoot = await mkdtemp(
          path.join(os.tmpdir(), `mdl-e2e-${provider}-`)
        );
        const app = render(
          <App
            audioFormat="mp3"
            audioQuality="best"
            downloadParallelism={1}
            initialOutputDir={outputRoot}
            initialUrl={url}
          />
        );

        try {
          await waitFor(
            () => hasAnyFrame(app.frames, 'Playlist') && hasAnyFrame(app.frames, 'Tracks'),
            `${provider} sync screen`
          );

          const firstDownloadedFile = await waitForValue(
            () => findFirstDownloadedFile(outputRoot),
            `${provider} first downloaded audio file`
          );

          expect(path.extname(firstDownloadedFile)).toBe('.mp3');
        } finally {
          app.unmount();
          await rm(outputRoot, { recursive: true, force: true });
        }
      },
      300_000
    );
  }
});

async function findFirstDownloadedFile(rootDir: string): Promise<string | null> {
  return findFirstMatchingFile(rootDir, async (fileName, filePath) => {
    if (!fileName.endsWith('.mp3')) {
      return false;
    }

    const fileStats = await stat(filePath);
    return fileStats.size > 0;
  });
}

async function findFirstMatchingFile(
  directory: string,
  isMatch: (fileName: string, filePath: string) => boolean | Promise<boolean>
): Promise<string | null> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nestedMatch = await findFirstMatchingFile(entryPath, isMatch);
      if (nestedMatch) return nestedMatch;
      continue;
    }

    if (entry.isFile() && (await isMatch(entry.name, entryPath))) {
      return entryPath;
    }
  }

  return null;
}

function hasAnyFrame(frames: string[], text: string): boolean {
  return frames.some((frame) => frame.includes(text));
}
