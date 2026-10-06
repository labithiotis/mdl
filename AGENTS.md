# MDL

Env vars via Varlock (+ GCP Secret Manager).

ALWAYS USE `./docs/WHITTLE.md`.

Run `bun checks` before code change handoffs.
Treat validated env var types as accurate. Do not add null checks for required strings.
New dependencies use the latest compatible release; pin exact versions.
Use Conventional Commits for commit messages. Keep the subject under ~70 chars; add a body only when the why matters.
Use a 120 print width for code and documentation, unless the existing formatter configuration requires otherwise.
Use MCPProxy for MCP connections when it is available. Use T3 Code (`t3-code`) MCP tools directly, bypassing MCPProxy.
Use Git worktrees for isolated work; never clone a repo unless the user explicitly directs you to.
Reuse dev servers; stop only those you started this session by recorded PID; never `pkill`/`killall` or name/port kills.

## Routing

Load the smallest relevant doc set for the task:

- Open `./docs/PULL_REQUEST.md` when creating or reviewing PRs.
- Open `./docs/TYPESCRIPT.md` when editing TypeScript or JavaScript files.
- Open `./docs/TESTING.md` when editing tests, mocks, or test infrastructure.
- Open `./docs/GH_WORKFLOW.md` when editing `.github/workflows/*`.
- Open `./docs/SHELL.md` when editing shell scripts or `run` files.

## Naming

- `camelCase` for directories, files, and the default fallback.
- `PascalCase` for React components and class constructor files.
- `UPPER_SNAKE_CASE` for markdown files.
- Preserve framework-required filenames.
- Branch names use optional user initials, a ticket ID when available, and a short 3-4 word description.
  Never use AI model or framework names in branch names.

## Comments

- Do not add comments by default.
- Only explain non-obvious rules or constraints that code and types cannot make clear.
- Never narrate or restate the code. Keep necessary comments brief. When unsure, omit them.
- Remove outdated comments as part of the change you are making.
- PR/commit narration belongs in the PR body, not the source.
