## Code style

- Prefer functional and declarative patterns.
- "AHA (Avoid Hasty Abstractions) and KISS (Keep It Simple, Stupid). Prefer duplication over premature abstraction; prefer simple, direct code over clever indirection. Don't extract one- or two-line helpers, inline them.
- Use `function` for top-level declarations; use arrow functions for callbacks and inline expressions.
- Avoid enums; prefer unions, maps, or objects.
- Keep inline comments rare and concise.

## Types

- Prefer `type` over `interface`, except for class contracts.
- Default to mutable types. Use `readonly` only for exported types consumers shouldn't mutate, or for frozen config.
- Prefix Zod schemas with `z` (e.g., `zUser`) so the inferred type can take the clean name: `type User = z.infer<typeof zUser>`.

## Imports & exports

- Use named exports.
- Follow Biome import ordering.
- Use relative imports within one directory. Use `~` aliases for deeper `src/` imports.
- Route files do not use default exports.

## Project conventions

- Use `void` only when intentionally discarding a non-void result.
- Prefer descriptive but compact names. Shorten long suffixes like `Opts` or `Args` when the full name gets noisy.
- If a config option has a safe default, omit it.
