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

  test('parseCliArgs accepts network options', () => {
    expect(
      parseCliArgs([
        '--proxy',
        'https://user:pass@dc.oxylabs.io:8000',
        '--yt-cookie',
        'SID=abc; HSID=def',
        '--yt-user-agent',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0',
      ])
    ).toEqual({
      audioFormat: 'mp3',
      audioQuality: 'best',
      downloadParallelism: 10,
      proxy: 'https://user:pass@dc.oxylabs.io:8000/',
      ytCookie: 'SID=abc; HSID=def',
      ytUserAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0',
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

  test('parseCliArgs rejects invalid proxy urls', () => {
    expect(() => {
      parseCliArgs(['--proxy', 'socks5://localhost:1080']);
    }).toThrow('--proxy must be a valid http:// or https:// URL.');
  });

  test('parseCliArgs prints help and exits', () => {
    const stdoutWrite = mock(() => true);
    const exitMock = mock((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    });

    process.stdout.write = stdoutWrite as typeof process.stdout.write;
    process.exit = exitMock as typeof process.exit;

    expect(() => {
      parseCliArgs(['--help']);
    }).toThrow('exit:0');
    expect(stdoutWrite).toHaveBeenCalled();
  });

  test('parseCliArgs prints version and exits', () => {
    const stdoutWrite = mock(() => true);
    const exitMock = mock((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    });

    process.stdout.write = stdoutWrite as typeof process.stdout.write;
    process.exit = exitMock as typeof process.exit;

    expect(() => {
      parseCliArgs(['--version']);
    }).toThrow('exit:0');
    expect(stdoutWrite).toHaveBeenCalledWith(
      expect.stringMatching(/\d+\.\d+\.\d+/)
    );
  });

  test('parseCliArgs rejects unexpected arguments', () => {
    expect(() => {
      parseCliArgs([
        'https://open.spotify.com/playlist/example',
        'unexpected-token',
      ]);
    }).toThrow(
      'Unexpected argument "unexpected-token". Please use one of these:'
    );
  });
});
