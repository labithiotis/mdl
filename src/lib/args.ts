import { Either, Schema } from 'effect';
import packageJson from '../../package.json' with { type: 'json' };
import { CliArgumentError, decodeUnknownEither } from './utils';

export const AUDIO_FORMATS = ['mp3', 'm4a', 'opus', 'flac', 'wav'] as const;
export const AUDIO_QUALITIES = [
  'best',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '128K',
  '192K',
  '256K',
  '320K',
] as const;

export type AudioFormat = (typeof AUDIO_FORMATS)[number];
export type AudioQuality = (typeof AUDIO_QUALITIES)[number];

export type DownloadCliOptions = {
  audioFormat: AudioFormat;
  audioQuality: AudioQuality;
};

export type CliOptions = DownloadCliOptions & {
  downloadParallelism: number;
  outputDir?: string;
  url?: string;
};

const DEFAULT_DOWNLOAD_PARALLELISM = 10;
const DEFAULT_AUDIO_FORMAT: AudioFormat = 'mp3';
const DEFAULT_AUDIO_QUALITY: AudioQuality = 'best';
const audioFormatSchema = Schema.Literal(...AUDIO_FORMATS);
const audioQualitySchema = Schema.Literal(...AUDIO_QUALITIES);

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    audioFormat: DEFAULT_AUDIO_FORMAT,
    audioQuality: DEFAULT_AUDIO_QUALITY,
    downloadParallelism: DEFAULT_DOWNLOAD_PARALLELISM,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }

    if (token === '--version' || token === '-v') {
      printVersion();
      process.exit(0);
    }

    if (token === '--output' || token === '-o') {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error('Missing value for --output.');
      }

      options.outputDir = nextValue;
      index += 1;
      continue;
    }

    if (token === '--parallel' || token === '-p') {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error('Missing value for --parallel.');
      }

      options.downloadParallelism = parsePositiveIntegerArg(
        nextValue,
        '--parallel'
      );
      index += 1;
      continue;
    }

    if (token === '--format' || token === '-f') {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error('Missing value for --format.');
      }

      options.audioFormat = parseAudioFormatArg(nextValue, '--format');
      index += 1;
      continue;
    }

    if (token === '--bitrate' || token === '-b') {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error('Missing value for --bitrate.');
      }

      options.audioQuality = parseAudioQualityArg(
        normalizeAudioQualityArg(nextValue),
        '--bitrate'
      );
      index += 1;
      continue;
    }

    if (!options.url) {
      options.url = token;
      continue;
    }

    throw new Error(`Unexpected argument: ${token}`);
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(`mdl (MusicDownLoader)

Interactive playlist and album downloader for streaming collections -> YouTube audio.

Usage:
  mdl [playlist-or-album-url] [--output <dir>] [--parallel <count>] [--format <type>]

Options:
  -o, --output       Base output directory. Playlist files are stored in a subfolder.
  -p, --parallel     Number of tracks to download in parallel. Default: ${DEFAULT_DOWNLOAD_PARALLELISM}.
  -f, --format       Output audio format. One of: ${AUDIO_FORMATS.join(', ')}. Default: ${DEFAULT_AUDIO_FORMAT}.
  -b, --bitrate      Output audio quality. Use best, 0-10 VBR, or ${AUDIO_QUALITIES.filter((quality) => quality.endsWith('K')).join(', ')}. Default: ${DEFAULT_AUDIO_QUALITY}.
  -h, --help         Show this help message.
  -v, --version      Show the current version.

Providers:
  Spotify, Apple Music, Amazon Music, YouTube Music, SoundCloud, Bandcamp, Qobuz, Deezer, and Tidal.
  Audio downloads currently come from YouTube.
`);
}

function printVersion(): void {
  process.stdout.write(`${packageJson.version}\n`);
}

function parsePositiveIntegerArg(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (
    !Number.isInteger(parsed) ||
    Number.isNaN(parsed) ||
    parsed <= 0 ||
    parsed.toString() !== value
  ) {
    throw new CliArgumentError({
      message: `${flagName} must be a positive integer.`,
    });
  }

  return parsed;
}

function parseAudioFormatArg(value: string, flagName: string): AudioFormat {
  const result = decodeUnknownEither(audioFormatSchema, value);

  if (Either.isRight(result)) {
    return result.right;
  }

  throw new CliArgumentError({
    message: `${flagName} must be one of: ${AUDIO_FORMATS.join(', ')}.`,
  });
}

function parseAudioQualityArg(value: string, flagName: string): AudioQuality {
  const result = decodeUnknownEither(audioQualitySchema, value);

  if (Either.isRight(result)) {
    return result.right;
  }

  throw new CliArgumentError({
    message: `${flagName} must be one of: ${AUDIO_QUALITIES.join(', ')}.`,
  });
}

function normalizeAudioQualityArg(value: string): string {
  if (/^\d+k$/i.test(value)) {
    return `${value.slice(0, -1)}K`;
  }

  return value;
}
