import { describe, expect, mock, test } from 'bun:test';

mock.module('cloudflare:workers', () => ({ DurableObject: class {} }));

const { consumeRateLimit, getWindowStart } = await import('./rateLimit');

describe('token rate limits', () => {
  test('uses fixed UTC hour, day, and Monday-based week windows', () => {
    const now = Date.parse('2026-07-14T15:32:10.000Z');

    expect(new Date(getWindowStart('hour', now)).toISOString()).toBe('2026-07-14T15:00:00.000Z');
    expect(new Date(getWindowStart('day', now)).toISOString()).toBe('2026-07-14T00:00:00.000Z');
    expect(new Date(getWindowStart('week', now)).toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  test('rejects a request when its hourly limit is exhausted', () => {
    const now = Date.parse('2026-07-14T15:59:30.000Z');
    const startsAt = getWindowStart('hour', now);
    const { result } = consumeRateLimit(
      {
        hour: { count: 600, startsAt },
        day: { count: 600, startsAt: getWindowStart('day', now) },
        week: { count: 600, startsAt: getWindowStart('week', now) },
      },
      { hour: 600, day: 2_000, week: 8_000 },
      now
    );

    expect(result).toEqual({
      success: false,
      window: 'hour',
      retryAfter: 30,
    });
  });

  test('resets expired windows and increments current counters', () => {
    const now = Date.parse('2026-07-14T16:00:00.000Z');
    const { result, state } = consumeRateLimit(
      {
        hour: {
          count: 600,
          startsAt: Date.parse('2026-07-14T15:00:00.000Z'),
        },
        day: { count: 10, startsAt: getWindowStart('day', now) },
        week: { count: 20, startsAt: getWindowStart('week', now) },
      },
      { hour: 600, day: 2_000, week: 8_000 },
      now
    );

    expect(result).toEqual({ success: true });
    expect(state.hour.count).toBe(1);
    expect(state.day.count).toBe(11);
    expect(state.week.count).toBe(21);
  });
});
