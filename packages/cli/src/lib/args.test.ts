import { afterEach, describe, expect, mock, test } from 'bun:test';
import { parseCliArgs } from './args';

afterEach(() => {
  mock.restore();
});

describe('args', () => {
  test('parseCliArgs defaults track download parallelism to 10', () => {
    expect(parseCliArgs([])).toEqual({
      audioFormat: 'mp3',
      audioQuality: 'best',
      downloadParallelism: 10,
    });
  });

  test('parseCliArgs accepts the parallel flag', () => {
    expect(
      parseCliArgs([
        'https://open.spotify.com/playlist/example',
        '--parallel',
        '7',
        '--count',
        '3',
        '--output',
        './music',
      ])
    ).toEqual({
      audioFormat: 'mp3',
      audioQuality: 'best',
      downloadParallelism: 7,
      trackCount: 3,
      outputDir: './music',
      url: 'https://open.spotify.com/playlist/example',
    });
  });

  test('parseCliArgs accepts download options', () => {
    expect(parseCliArgs(['--format', 'm4a', '--bitrate', '192k'])).toEqual({
      audioFormat: 'm4a',
      audioQuality: '192K',
      downloadParallelism: 10,
    });
  });

  test('parseCliArgs rejects unsupported formats', () => {
    expect(() => {
      parseCliArgs(['--format', 'aac']);
    }).toThrow('--format must be one of: mp3, m4a, opus, flac, wav.');
  });

  test('parseCliArgs rejects non-positive parallel values', () => {
    expect(() => {
      parseCliArgs(['--parallel', '0']);
    }).toThrow('--parallel must be a positive integer.');
  });

  test('parseCliArgs rejects non-positive count values', () => {
    expect(() => {
      parseCliArgs(['--count', '0']);
    }).toThrow('--count must be a positive integer.');
  });
});
