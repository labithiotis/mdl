Use `./docs/CAVEMAN.md` for thinking and responses.
Env vars via Varlock (+ GCP Secret Manager).
New dependencies use the latest compatible release; the repo pins exact versions.
Use Conventional Commits for branches and commits. Subject under ~70 chars; body only when the why matters.

## Routing

Load the smallest relevant doc set for the task:

- Open `./docs/TYPESCRIPT.md` only when editing TypeScript or JavaScript files.
- Open `./docs/TESTING.md` only when editing tests, mocks, or test infra.
- Open `./docs/SHELL.md` only when editing shell scripts or `run` files.
- Open `./docs/GH_WORKFLOWS.md` only when editing `.github/workflows/*`.

## Naming

- `camelCase` for directories, files, and the default fallback.
- `PascalCase` for React components and class constructor files.
- `UPPER_SNAKE_CASE` for markdown files.
- Preserve framework-required route filenames.
