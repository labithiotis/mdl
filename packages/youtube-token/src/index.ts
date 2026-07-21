import { TokenRateLimiter } from './rateLimit';
import { handleTokenRequest } from './tokenRequest';

export { TokenRateLimiter };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleTokenRequest(request, env).catch((error: unknown) => {
      console.error(error);
      return Response.json(
        { error: { code: 'internal_error', message: 'Unable to generate a token.' } },
        { status: 500 }
      );
    });
  },
};
