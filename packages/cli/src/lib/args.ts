import { Command, CommanderError, Option } from 'commander';
import { Either, Schema } from 'effect';
import packageJson from '../../package.json' with { type: 'json' };
import { PROVIDERS } from './schemas';
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
  proxy?: string;
  trackCount?: number;
  url?: string;
  ytCookie?: string;
  ytUserAgent?: string;
};

type ParsedCommanderOptions = {
  bitrate: AudioQuality;
  count?: number;
  format: AudioFormat;
  output?: string;
  parallel: number;
  proxy?: string;
  ytCookie?: string;
  ytUserAgent?: string;
};

const DEFAULT_DOWNLOAD_PARALLELISM = 10;
const DEFAULT_AUDIO_FORMAT: AudioFormat = 'mp3';
const DEFAULT_AUDIO_QUALITY: AudioQuality = 'best';
const audioFormatSchema = Schema.Literal(...AUDIO_FORMATS);
const audioQualitySchema = Schema.Literal(...AUDIO_QUALITIES);

export function parseCliArgs(argv: string[]): CliOptions {
  const program = createCliProgram();

  try {
    program.parse(argv, { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (
        error.code === 'commander.helpDisplayed' ||
        error.code === 'commander.version'
      ) {
        process.exit(0);
      }

      throw normalizeCommanderError(program, error, argv);
    }

    throw error;
  }

  const options = program.opts<ParsedCommanderOptions>();
  const [url] = program.processedArgs as Array<string | undefined>;

  return {
    audioFormat: options.format,
    audioQuality: options.bitrate,
    downloadParallelism: options.parallel,
    ...(options.output ? { outputDir: options.output } : {}),
    ...(options.proxy ? { proxy: options.proxy } : {}),
    ...(typeof options.count === 'number' ? { trackCount: options.count } : {}),
    ...(url ? { url } : {}),
    ...(options.ytCookie ? { ytCookie: options.ytCookie } : {}),
    ...(options.ytUserAgent ? { ytUserAgent: options.ytUserAgent } : {}),
  };
}

function createCliProgram(): Command {
  return new Command()
    .name('mdl')
    .description(
      'Interactive playlist and album downloader for streaming collections -> YouTube audio.'
    )
    .usage('[playlist-or-album-url] [options]')
    .helpOption('-h, --help', 'Show this help message.')
    .version(packageJson.version, '-v, --version', 'Show the current version.')
    .argument('[playlist-or-album-url]', 'Playlist or album URL.')
    .addOption(
      new Option(
        '-o, --output <dir>',
        'Base output directory. Playlist files are stored in a subfolder.'
      )
    )
    .addOption(
      new Option(
        '-p, --parallel <count>',
        `Number of tracks to download in parallel. Default: ${DEFAULT_DOWNLOAD_PARALLELISM}.`
      )
        .default(DEFAULT_DOWNLOAD_PARALLELISM)
        .argParser((value: string) =>
          parsePositiveIntegerArg(value, '--parallel')
        )
    )
    .addOption(
      new Option(
        '-c, --count <count>',
        'Maximum number of tracks to download from the collection.'
      ).argParser((value: string) => parsePositiveIntegerArg(value, '--count'))
    )
    .addOption(
      new Option(
        '-f, --format <type>',
        `Output audio format. One of: ${AUDIO_FORMATS.join(', ')}. Default: ${DEFAULT_AUDIO_FORMAT}.`
      )
        .default(DEFAULT_AUDIO_FORMAT)
        .argParser((value: string) => parseAudioFormatArg(value, '--format'))
    )
    .addOption(
      new Option(
        '-b, --bitrate <quality>',
        `Output audio quality. Use best, 0-10 VBR, or ${AUDIO_QUALITIES.filter((quality) => quality.endsWith('K')).join(', ')}. Default: ${DEFAULT_AUDIO_QUALITY}.`
      )
        .default(DEFAULT_AUDIO_QUALITY)
        .argParser((value: string) =>
          parseAudioQualityArg(normalizeAudioQualityArg(value), '--bitrate')
        )
    )
    .addOption(
      new Option(
        '--proxy <url>',
        'HTTPS/HTTP proxy URL used for provider fetches and YouTube requests.'
      ).argParser((value: string) => parseProxyArg(value))
    )
    .addOption(
      new Option(
        '--yt-cookie <cookie>',
        'YouTube Cookie used for YouTube requests.'
      )
    )
    .addOption(
      new Option(
        '--yt-user-agent <value>',
        'YouTube User-Agent header used for YouTube requests.'
      )
    )
    .addHelpText('before', 'mdl (MusicDownLoader)\n\n')
    .addHelpText(
      'after',
      `\nProviders:\n  ${PROVIDERS.join(', ')}.\n  Audio downloads currently come from YouTube.\n`
    )
    .exitOverride()
    .configureOutput({
      writeOut: (str: string) => process.stdout.write(str),
      writeErr: () => undefined,
    });
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

function normalizeCommanderError(
  program: Command,
  error: CommanderError,
  argv: string[]
): Error {
  if (error.code === 'commander.excessArguments') {
    const positionalArgs = argv.filter((token) => !token.startsWith('-'));
    const unexpectedArg = positionalArgs[1];
    return new CliArgumentError({
      message: formatUnexpectedArgumentMessage(
        program,
        unexpectedArg ?? error.message
      ),
    });
  }

  if (error.code === 'commander.unknownOption') {
    const unexpectedToken = argv.find((token) => token.startsWith('-'));
    return new CliArgumentError({
      message: formatUnexpectedArgumentMessage(
        program,
        unexpectedToken ?? error.message
      ),
    });
  }

  if (error.code === 'commander.invalidArgument') {
    return new CliArgumentError({
      message: error.message.replace(/^error: /, ''),
    });
  }

  if (error.code === 'commander.optionMissingArgument') {
    const matchedFlags = error.message.match(
      /option '([^']+)' argument missing/
    );
    const normalizedFlag =
      matchedFlags?.[1]
        ?.split(',')
        .map((value) => value.trim().split(' ')[0])
        .find((value) => value.startsWith('--')) ??
      matchedFlags?.[1]
        ?.split(',')
        .map((value) => value.trim().split(' ')[0])[0] ??
      '--option';

    return new CliArgumentError({
      message: `Missing value for ${normalizedFlag}.`,
    });
  }

  return new Error(error.message.replace(/^error: /, ''));
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

function formatUnexpectedArgumentMessage(
  program: Command,
  argument: string
): string {
  const help = program.createHelp();
  const supportedArgs = [
    ...program.registeredArguments.map((registeredArgument) =>
      help.argumentTerm(registeredArgument)
    ),
    ...help.visibleOptions(program).map((option) => help.optionTerm(option)),
  ]
    .map((value) => `  ${value}`)
    .join('\n');

  return `Unexpected argument "${argument}". Please use one of these:\n${supportedArgs}`;
}

function normalizeAudioQualityArg(value: string): string {
  if (/^\d+k$/i.test(value)) {
    return `${value.slice(0, -1)}K`;
  }

  return value;
}

function parseProxyArg(value: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new CliArgumentError({
      message: '--proxy must be a valid http:// or https:// URL.',
    });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new CliArgumentError({
      message: '--proxy must be a valid http:// or https:// URL.',
    });
  }

  return parsedUrl.toString();
}
