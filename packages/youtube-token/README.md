# YouTube Token Worker

HTTP PO token provider for the CLI.

```sh
bun run --filter '@mdl/youtube-token' dev
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

Tokens are cached in KV for one hour per video ID. Cache misses are limited per
installation and IP over hourly, daily, and weekly UTC windows to protect the
Browser Rendering quota.

The worker first bootstraps matching visitor data from YouTube and returns a
cold-start token. Cloudflare Browser Rendering is retained as a fallback for
the full BotGuard flow when session bootstrap is unavailable.
