import { DurableObject } from 'cloudflare:workers';

export type RateLimitWindow = 'hour' | 'day' | 'week';

export type RateLimitState = Record<RateLimitWindow, { count: number; startsAt: number }>;

export type RateLimitResult = { success: true } | { retryAfter: number; success: false; window: RateLimitWindow };

export type RateLimits = Record<RateLimitWindow, number>;

export class TokenRateLimiter extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const limits = (await request.json()) as RateLimits;
    const now = Date.now();
    const result = await this.ctx.storage.transaction(async (storage) => {
      const current = await storage.get<RateLimitState>('limits');
      const { result, state } = consumeRateLimit(current, limits, now);
      if (result.success) await storage.put('limits', state);
      return result;
    });
    return Response.json(result);
  }
}

export function consumeRateLimit(
  current: RateLimitState | undefined,
  limits: RateLimits,
  now: number
): { result: RateLimitResult; state: RateLimitState } {
  const state = {
    hour: currentWindow(current?.hour, 'hour', now),
    day: currentWindow(current?.day, 'day', now),
    week: currentWindow(current?.week, 'week', now),
  };

  for (const window of ['hour', 'day', 'week'] as const) {
    if (state[window].count >= limits[window]) {
      return {
        state,
        result: {
          success: false,
          window,
          retryAfter: Math.max(
            1,
            Math.ceil(
              (state[window].startsAt + { hour: 3_600_000, day: 86_400_000, week: 604_800_000 }[window] - now) / 1_000
            )
          ),
        },
      };
    }
  }

  for (const window of ['hour', 'day', 'week'] as const) {
    state[window].count += 1;
  }
  return { state, result: { success: true } };
}

export function getWindowStart(window: RateLimitWindow, now: number): number {
  const date = new Date(now);
  date.setUTCMinutes(0, 0, 0);
  if (window === 'hour') return date.getTime();

  date.setUTCHours(0);
  if (window === 'day') return date.getTime();

  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.getTime();
}

function currentWindow(
  current: RateLimitState[RateLimitWindow] | undefined,
  window: RateLimitWindow,
  now: number
): RateLimitState[RateLimitWindow] {
  const startsAt = getWindowStart(window, now);
  return current?.startsAt === startsAt ? current : { count: 0, startsAt };
}
