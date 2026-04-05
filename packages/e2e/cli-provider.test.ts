import { describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCli } from './utils';

const PROVIDER_TEST_TIMEOUT_MS = 60_000;

type Provider =
  | 'spotify'
  | 'apple-music'
  | 'amazon-music'
  | 'soundcloud'
  | 'bandcamp'
  | 'deezer'
  | 'qobuz'
  | 'tidal'
  | 'youtube-music';

const ALBUM_EXAMPLES: Record<Provider, string> = {
  spotify: 'https://open.spotify.com/album/6eUW0wxWtzkFdaEFsTJto6',
  'apple-music':
    'https://music.apple.com/us/album/the-boys-of-dungeon-lane/1887402919',
  'amazon-music': 'https://music.amazon.com/albums/B0FQCR86CK',
  soundcloud:
    'https://soundcloud.com/soundcloud-amped/sets/the-dive-new-rock-now',
  bandcamp: 'https://marcellaandherlovers.bandcamp.com/album/live-from-memphis',
  deezer: 'https://www.deezer.com/us/album/302127',
  qobuz: 'https://www.qobuz.com/us-en/album/discovery-daft-punk/0724384960650',
  tidal: 'https://tidal.com/album/102948177',
  'youtube-music': 'https://music.youtube.com/browse/MPREb_j3iQdYVF98Q',
};

const TRACK_EXAMPLES: Record<Provider, string> = {
  spotify: 'https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8',
  'apple-music':
    'https://music.apple.com/us/album/days-we-left-behind/1887402919?i=1887403088',
  'amazon-music':
    'https://music.amazon.com/albums/B0FQCR86CK?do=play&trackAsin=B0FQDGK37H',
  soundcloud: 'https://soundcloud.com/lovebunii/virgilio',
  bandcamp: 'https://munterfel.bandcamp.com/track/dancinginjuly',
  deezer: 'https://www.deezer.com/track/3703817902',
  qobuz: 'https://open.qobuz.com/track/13176083',
  tidal: 'https://tidal.com/browse/track/495402660',
  'youtube-music':
    'https://music.youtube.com/watch?v=hLQl3WQQoQ0&list=RDCLAK5uy_nHSqCJjDrW9HBhCNdF6tWPdnOMngOv0wA',
};

describe('cli-provider-smoke', () => {
  for (const [provider, url] of Object.entries(ALBUM_EXAMPLES)) {
    test(
      `downloads audio for album url from ${provider}`,
      async () => {
        await runProviderSmokeTest(provider, url, 'album');
      },
      PROVIDER_TEST_TIMEOUT_MS
    );
  }

  for (const [provider, url] of Object.entries(TRACK_EXAMPLES)) {
    test(
      `downloads audio for track url from ${provider}`,
      async () => {
        await runProviderSmokeTest(provider, url, 'track');
      },
      PROVIDER_TEST_TIMEOUT_MS
    );
  }
});

async function runProviderSmokeTest(
  provider: string,
  url: string,
  exampleKind: 'album' | 'track'
): Promise<void> {
  const outputRoot = await mkdtemp(
    path.join(os.tmpdir(), `mdl-e2e-${provider}-`)
  );

  try {
    const cliResult = await runCli([
      '--output',
      outputRoot,
      '--parallel',
      '1',
      '--count',
      '1',
      '--format',
      'mp3',
      url,
    ]);

    expect(
      cliResult.exitCode,
      `${provider} ${exampleKind} CLI run failed\n\n${cliResult.combinedOutput}`
    ).toBe(0);

    const firstDownloadedFile = await findFirstDownloadedFile(outputRoot);

    expect(
      firstDownloadedFile,
      `${provider} ${exampleKind} did not produce an mp3 file\n\n${cliResult.combinedOutput}`
    ).toBeTruthy();
    expect(path.extname(firstDownloadedFile ?? '')).toBe('.mp3');
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
}

async function findFirstDownloadedFile(
  rootDir: string
): Promise<string | null> {
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
      if (nestedMatch) {
        return nestedMatch;
      }

      continue;
    }

    if (entry.isFile() && (await isMatch(entry.name, entryPath))) {
      return entryPath;
    }
  }

  return null;
}
