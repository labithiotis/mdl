# YouTube Token Worker

HTTP PO token provider for the CLI.

```sh
bun run --filter '@mdl/youtube-token-worker' dev
```

The CLI calls:

```text
GET /token?videoId=<youtube-video-id>
```

Responses use the shape expected by `mdl`:

```json
{
  "poToken": "...",
  "visitorData": "...",
  "expiresAt": "2026-06-11T12:00:00.000Z"
}
```

Tokens are cached in KV for up to one hour per video ID. Cache misses are
limited to 30 token mints per minute in each Cloudflare location to protect the
Browser Rendering quota.

Important: this uses Cloudflare Browser Rendering via `@cloudflare/puppeteer`,
not plain Worker JavaScript. The browser binding is required because YouTube's
BotGuard flow is expected to run inside a real browser page context. The worker
reuses a browser across warm requests and opens one page per token mint.
