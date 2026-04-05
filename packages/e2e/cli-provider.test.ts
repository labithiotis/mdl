import { describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cleanOutput, runCli } from './utils';

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
    test(`"${provider}" downloads tracks from album url`, async () => {
      await runProviderSmokeTest(provider, url, 'album');
    });
  }

  for (const [provider, url] of Object.entries(TRACK_EXAMPLES)) {
    test(`"${provider}" downloads audio for track url`, async () => {
      await runProviderSmokeTest(provider, url, 'track');
    });
  }
});

async function runProviderSmokeTest(
  provider: string,
  url: string,
  exampleKind: 'album' | 'track'
): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), `mdl-e2e-${provider}-`));

  try {
    const cliResult = await runCli(buildCliArgs(dir, url));
    const downloadedFiles = await listDownloadedFiles(dir);
    const firstDownloadedFile = await findFirstDownloadedFile(dir);

    expect(
      firstDownloadedFile,
      buildFailureSummary({
        cliResult,
        downloadedFiles,
        exampleKind,
        provider,
        reason: 'CLI completed without producing a non-empty mp3 file.',
        url,
      })
    ).toBeTruthy();

    expect(path.extname(firstDownloadedFile ?? '')).toBe('.mp3');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function findFirstDownloadedFile(
  directory: string
): Promise<string | null> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nestedMatch = await findFirstDownloadedFile(entryPath);
      if (nestedMatch) {
        return nestedMatch;
      }

      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.mp3')) {
      const fileStats = await stat(entryPath);
      if (fileStats.size > 0) {
        return entryPath;
      }
    }
  }

  return null;
}

async function listDownloadedFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const discoveredFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listDownloadedFiles(entryPath);
      }

      return [entryPath];
    })
  );

  return discoveredFiles.flat().sort();
}

function buildCliArgs(directory: string, url: string): string[] {
  const args = ['--output', directory, '--count', '1'];

  if (process.env.MDL_E2E_PROXY) {
    args.push('--proxy', process.env.MDL_E2E_PROXY);
  }

  if (process.env.MDL_E2E_YT_COOKIE) {
    args.push('--yt-cookie', process.env.MDL_E2E_YT_COOKIE);
  }

  if (process.env.MDL_E2E_YT_USER_AGENT) {
    args.push('--yt-user-agent', process.env.MDL_E2E_YT_USER_AGENT);
  }

  args.push(url);
  return args;
}

function buildFailureSummary(input: {
  cliResult: Awaited<ReturnType<typeof runCli>>;
  downloadedFiles?: string[];
  exampleKind: 'album' | 'track';
  provider: string;
  reason: string;
  url: string;
}): string {
  const summaryLines = [
    `${input.provider} ${input.exampleKind} smoke test failed`,
    `Reason: ${input.reason}`,
    `URL: ${input.url}`,
  ];

  if (input.downloadedFiles) {
    summaryLines.push(
      `Downloaded files: ${input.downloadedFiles.length > 0 ? input.downloadedFiles.join(', ') : '(none)'}`
    );
  }

  const outputPreview = cleanOutput(input.cliResult.combinedOutput);

  if (outputPreview) {
    summaryLines.push('CLI output:');
    summaryLines.push(outputPreview);
  }

  return summaryLines.join('\n');
}
