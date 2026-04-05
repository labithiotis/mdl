import { describe, expect, test } from 'bun:test';
import { CliRunError, runCli } from './utils';

describe('cli-flags', () => {
  test('prints help without requiring ffmpeg', async () => {
    const cliResult = await runCli(['--help']);

    expect(cliResult.stdout).toContain('Usage:');
    expect(cliResult.stdout).toContain('mdl [playlist-or-album-url]');
  });

  test('prints version without requiring ffmpeg', async () => {
    const cliResult = await runCli(['--version']);

    expect(cliResult.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('fails fast on invalid flag usage', async () => {
    try {
      await runCli(['--output']);
    } catch (error) {
      expect(error).toBeInstanceOf(CliRunError);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Missing value for --output.');
      return;
    }

    throw new Error('Expected runCli to reject for invalid flag usage.');
  });
});
