# Contributing

## Setup

1. Install Node.js 24+ and `bun`.
2. Install dependencies:

```bash
bun install
```

3. Start the CLI in development mode:

```bash
cd packages/cli
bun dev
```

## Local checks

Run the same checks expected in pull requests before opening one:

```bash
bun lint
bun typecheck
bun test
```

Run `bun test:youtube-smoke` separately to download and validate media.

## Pull requests

Keep pull requests focused and include:

- A short description of the user-visible change
- Any setup or environment assumptions
- Tests or a clear explanation when tests are not practical

If your change affects CLI behavior, update `README.md` as part of the same pull request.
