Use bun's test runner across the repo.

- Prefer behavior tests through public interfaces.
- Mock system boundaries, not your own modules, unless the seam is truly external or non-deterministic.
- No real network in tests.

## Tooling

- Use MSW for fetch and HTTP mocking.

## Picking a seam

- Use unit tests for pure logic.
- Use integration tests for request, data, and persistence flows.
- Use E2E only for critical UI journeys that cannot be proven lower in the stack.
