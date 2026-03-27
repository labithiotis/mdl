import { Effect, type Either, ParseResult, Schedule, Schema } from 'effect';

const DEFAULT_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_RETRY_COUNT = 2;

export class CliArgumentError extends Schema.TaggedError<CliArgumentError>()(
  'CliArgumentError',
  { message: Schema.String }
) {}

export class ManifestDecodeError extends Schema.TaggedError<ManifestDecodeError>()(
  'ManifestDecodeError',
  { message: Schema.String }
) {}

export class TrackSyncError extends Schema.TaggedError<TrackSyncError>()(
  'TrackSyncError',
  { reason: Schema.String, stage: Schema.String, trackTitle: Schema.String }
) {}

export function decodeUnknownEither<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: unknown
): Either.Either<A, ParseResult.ParseError> {
  return Schema.decodeUnknownEither(schema)(value);
}

export function decodeUnknownSync<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: unknown
): A {
  return Schema.decodeUnknownSync(schema)(value);
}

export function formatSchemaParseError(error: ParseResult.ParseError): string {
  return error.message.replace(/\s+/g, ' ').trim();
}

export function formatEffectError(error: unknown): string {
  if (error instanceof TrackSyncError) {
    return `Failed ${formatTrackStage(error.stage)} for ${error.trackTitle}: ${error.reason}`;
  }

  if (error instanceof ManifestDecodeError) {
    return `Invalid manifest data: ${error.message}`;
  }

  if (error instanceof CliArgumentError) {
    return error.message;
  }

  if (ParseResult.isParseError(error)) {
    return formatSchemaParseError(error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function makeRetrySchedule(options?: {
  baseDelayMs?: number;
  maxRetries?: number;
}) {
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const maxRetries = options?.maxRetries ?? DEFAULT_RETRY_COUNT;

  return Schedule.exponential(`${baseDelayMs} millis`).pipe(
    Schedule.compose(Schedule.recurs(maxRetries)),
    Schedule.jittered
  );
}

export function runEffectWithRetry<A, E, R>(params: {
  effect: Effect.Effect<A, E, R>;
  baseDelayMs?: number;
  maxRetries?: number;
  onRetry?: (attempt: number, error: E) => void;
  shouldRetry?: (error: E) => boolean;
}): Effect.Effect<A, E, R> {
  let attempt = 0;
  const shouldRetry = params.shouldRetry ?? (() => true);
  const schedule = makeRetrySchedule({
    baseDelayMs: params.baseDelayMs,
    maxRetries: params.maxRetries,
  }).pipe(
    Schedule.tapInput((error: E) =>
      Effect.sync(() => {
        attempt += 1;
        params.onRetry?.(attempt, error);
      })
    )
  );

  return params.effect.pipe(
    Effect.retry({
      schedule,
      while: shouldRetry,
    })
  );
}

export function getFirstNonEmptyString(
  ...strings: Array<string | null | undefined>
): string | undefined {
  return strings.find((str) => str?.trim())?.trim();
}

function formatTrackStage(stage: string): string {
  switch (stage) {
    case 'downloading-audio':
      return 'downloading audio';
    case 'searching-youtube':
      return 'searching YouTube';
    case 'writing-metadata':
      return 'writing metadata';
    case 'writing-manifest':
      return 'writing manifest';
    default:
      return stage.replaceAll('-', ' ');
  }
}
