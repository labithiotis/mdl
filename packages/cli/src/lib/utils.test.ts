import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import {
  formatEffectError,
  ManifestDecodeError,
  makeRetrySchedule,
  runEffectWithRetry,
  TrackSyncError,
} from './utils';

describe('utils', () => {
  test('formatEffectError renders track sync errors with stage context', () => {
    const error = new TrackSyncError({
      stage: 'downloading-audio',
      trackTitle: 'Never Gonna Give You Up',
      reason: 'ffmpeg exited with code 1.',
    });

    expect(formatEffectError(error)).toBe(
      'Failed downloading audio for Never Gonna Give You Up: ffmpeg exited with code 1.'
    );
  });

  test('formatEffectError renders manifest decode errors cleanly', () => {
    const error = new ManifestDecodeError({
      message: 'tracks is missing',
    });

    expect(formatEffectError(error)).toBe(
      'Invalid manifest data: tracks is missing'
    );
  });

  test('makeRetrySchedule retries before surfacing the final failure', async () => {
    let attempts = 0;

    const rejection = expect(
      Effect.runPromise(
        Effect.fail('network timeout').pipe(
          Effect.tapError(() => {
            attempts += 1;
            return Effect.void;
          }),
          Effect.retry(makeRetrySchedule({ maxRetries: 2, baseDelayMs: 1 }))
        )
      )
    ).rejects.toMatchObject({
      message: 'network timeout',
    });

    await rejection;
    expect(attempts).toBe(3);
  });

  test('runEffectWithRetry reports retry attempts for progress updates', async () => {
    const attempts: number[] = [];
    let failures = 0;

    const program = Effect.runPromise(
      runEffectWithRetry({
        baseDelayMs: 1,
        effect: Effect.suspend(() => {
          failures += 1;
          return failures < 3
            ? Effect.fail('temporary network failure')
            : Effect.succeed('ok');
        }),
        onRetry: (attempt, error) => {
          attempts.push(attempt);
          expect(error).toBe('temporary network failure');
        },
        shouldRetry: () => true,
      })
    );

    await expect(program).resolves.toBe('ok');
    expect(attempts).toEqual([1, 2]);
  });
});
