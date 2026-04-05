import { describe, expect, test } from 'bun:test';
import { runCli } from './utils';

describe('cli-flags', () => {
  test('prints help without requiring ffmpeg', async () => {
    const cliResult = await runCli(['--help']);

    expect(cliResult.exitCode).toBe(0);
    expect(cliResult.stdout).toContain('Usage:');
    expect(cliResult.stdout).toContain('mdl [playlist-or-album-url]');
  });

  test('prints version without requiring ffmpeg', async () => {
    const cliResult = await runCli(['--version']);

    expect(cliResult.exitCode).toBe(0);
    expect(cliResult.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('fails fast on invalid flag usage', async () => {
    const cliResult = await runCli(['--output']);

    expect(cliResult.exitCode).not.toBe(0);
    expect(cliResult.combinedOutput).toContain('Missing value for --output.');
  });
});
