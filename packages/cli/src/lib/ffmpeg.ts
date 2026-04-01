import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function ensureFfmpegExecutable(): Promise<string> {
  const ffmpegPath = await findBinaryPath('ffmpeg');

  if (!ffmpegPath) {
    throw new Error(
      'ffmpeg is required but was not found on PATH. Install ffmpeg and try again.'
    );
  }

  return ffmpegPath;
}

async function findBinaryPath(binaryName: string): Promise<string | null> {
  const pathEntries = (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean);
  const commonEntries =
    process.platform === 'darwin'
      ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
      : ['/usr/local/bin', '/usr/bin', '/bin'];

  for (const candidate of new Set(
    [...pathEntries, ...commonEntries].map((entry) =>
      path.join(entry, binaryName)
    )
  )) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  try {
    const result = await execFileAsync('which', [binaryName]);
    const resolvedPath = result.stdout.trim();
    return resolvedPath || null;
  } catch {
    return null;
  }
}
