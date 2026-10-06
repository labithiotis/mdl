# Testing

## Shared rules

- Prefer behaviour tests through public interfaces.
- Mock system boundaries rather than your own modules, unless the seam is external or non-deterministic. Do not mock the
  module under test.
- Keep unit and integration tests off the real network, except for explicitly documented local infrastructure.
- Preserve meaningful assertions. Fix the implementation or mocks instead of weakening tests to make them pass.
- When the repository has `.agents/skills/test-summary/SKILL.md`, use it for test behaviour summaries.

## Picking a seam

- Use unit tests for pure logic.
- Use integration tests for request, data, and persistence flows.
- Use E2E for critical UI journeys that cannot be proven lower in the stack.

## Project tooling and conventions

Use Bun test. Use the existing MSW setup for fetch and HTTP mocking.

- `bun checks` runs lint, type checks, and `test:unit` for the CLI and YouTube-token workspaces.
- Run `bun run test:e2e` separately for the CLI/provider integration suite.
- Run `bun run test:youtube-smoke` explicitly for the live YouTube smoke tests; keep them out of local checks.
