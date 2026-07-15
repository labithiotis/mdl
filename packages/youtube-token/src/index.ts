import { TokenRateLimiter } from './rateLimit';
import { handleTokenRequest } from './tokenRequest';

export { TokenRateLimiter };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleTokenRequest(request, env).catch((error: unknown) => {
      console.error(error);
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    });
  },
};
