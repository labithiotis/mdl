import type { RateLimitResult, RateLimits } from './rateLimit';
import { mintToken, type TokenPayload } from './tokenMint';

const CACHE_TTL_SECONDS = 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const installationLimits: RateLimits = { hour: 600, day: 2_000, week: 8_000 };
const ipLimits: RateLimits = { hour: 1_200, day: 5_000, week: 20_000 };

export async function handleTokenRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== '/token') {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const videoId = url.searchParams.get('videoId')?.trim();
  if (!videoId) {
    return Response.json({ error: 'Missing videoId query parameter.' }, { status: 400 });
  }

  const rateLimitResponse = await enforceRateLimits(request, env);
  if (rateLimitResponse) return rateLimitResponse;

  const cacheKey = `web-player:${videoId}`;
  const cached = await env.PO_TOKEN_KV.get<TokenPayload>(cacheKey, 'json');
  if (cached) return Response.json(cached, { headers: { 'cache-control': 'no-store' } });

  const token = await mintToken(videoId, env);
  await env.PO_TOKEN_KV.put(cacheKey, JSON.stringify(token), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
  return Response.json(token, { headers: { 'cache-control': 'no-store' } });
}

async function enforceRateLimits(request: Request, env: Env): Promise<Response | null> {
  const installationId = request.headers.get('x-mdl-installation-id')?.trim();
  if (!installationId || !UUID_PATTERN.test(installationId)) {
    return Response.json(
      {
        error: {
          code: 'invalid_installation_id',
          message: 'Missing or invalid MDL installation ID.',
        },
      },
      { status: 400 }
    );
  }

  const ipAddress = request.headers.get('cf-connecting-ip')?.trim() || 'unknown';
  const [installationResult, ipResult] = await Promise.all([
    checkRateLimit(env, `installation:${installationId.toLowerCase()}`, installationLimits),
    checkRateLimit(env, `ip:${ipAddress}`, ipLimits),
  ]);

  if (!installationResult.success) {
    return createRateLimitResponse(installationResult, 'installation');
  }
  return ipResult.success ? null : createRateLimitResponse(ipResult, 'ip');
}

async function checkRateLimit(env: Env, identifier: string, limits: RateLimits): Promise<RateLimitResult> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identifier));
  const id = env.TOKEN_RATE_LIMITER.idFromName(
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  );
  const response = await env.TOKEN_RATE_LIMITER.get(id).fetch('https://rate-limit.local/check', {
    method: 'POST',
    body: JSON.stringify(limits),
  });
  return response.json<RateLimitResult>();
}

function createRateLimitResponse(
  result: Exclude<RateLimitResult, { success: true }>,
  scope: 'installation' | 'ip'
): Response {
  const period = { hour: 'hourly', day: 'daily', week: 'weekly' }[result.window];
  return Response.json(
    {
      error: {
        code: `po_token_${period}_limit`,
        message: `You hit the ${period} limit for YouTube download tokens.`,
        retryAfter: result.retryAfter,
        scope,
      },
    },
    {
      status: 429,
      headers: {
        'cache-control': 'no-store',
        'retry-after': String(result.retryAfter),
      },
    }
  );
}
