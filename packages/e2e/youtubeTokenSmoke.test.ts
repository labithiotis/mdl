import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { runCli } from './utils';

const execFileAsync = promisify(execFile);
const SMOKE_TEST_ALBUM_URL = 'https://music.youtube.com/browse/MPREb_j3iQdYVF98Q';
const MINIMUM_AUDIO_BYTES = 16 * 1024;

test('downloads and validates the first YouTube Music track', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mdl-youtube-smoke-'));

  try {
    const cliResult = await runCli(['--output', directory, '--count', '1', SMOKE_TEST_ALBUM_URL], {
      timeoutMs: 119_000,
    });
    const audioPath = await findFirstAudioFile(directory);

    expect(audioPath, cliResult.combinedOutput).toBeTruthy();
    expect((await stat(audioPath as string)).size).toBeGreaterThan(MINIMUM_AUDIO_BYTES);

    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=codec_type:format=duration',
        '-of',
        'json',
        audioPath as string,
      ],
      { timeout: 10_000 }
    );
    const probe = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string }>;
    };

    expect(probe.streams?.[0]?.codec_type).toBe('audio');
    expect(Number(probe.format?.duration)).toBeGreaterThan(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function findFirstAudioFile(directory: string): Promise<string | null> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nestedFile = await findFirstAudioFile(entryPath);
      if (nestedFile) return nestedFile;
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.mp3')) return entryPath;
  }

  return null;
}
