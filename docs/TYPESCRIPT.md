# TypeScript

Repository conventions below take precedence where the framework or tooling requires them.

## Code style

- Prefer functional and declarative patterns.
- Follow AHA and KISS. Prefer duplication over premature abstraction and simple, direct code over clever indirection.
- Never create one- or two-line helpers unless extraction reduces complexity by at least 5x.
- Never wrap another function just to rename it or forward its arguments. Call it directly.
- Use `function` for top-level declarations and arrow functions for callbacks and inline expressions.
- Prefer unions, maps, or objects over enums.
- Prefer descriptive but compact names. Shorten suffixes such as `Opts` or `Args` only when the full name gets noisy.
- Omit config options that already have a safe default.
- Return or handle results explicitly instead of using the `void` operator.

## Code comments

- Do not add comments by default.
- Only explain non-obvious rules or constraints that code and types cannot make clear.
- Never narrate or restate the code. Keep necessary comments brief. When unsure, omit them.

## Types

- Prefer `type` over `interface`, except for class contracts.
- Default to mutable types. Use `readonly` for exported types consumers should not mutate or for frozen config.
- When using Zod, prefix schemas with `z`, for example `zUser`, so the inferred type can use the clean name.
- Use the source name of a schema or type at call sites. Rename at the source instead of aliasing or re-exporting it.
- Let TypeScript infer types when an annotation adds no information.
- Avoid type assertions when the type system can express the relationship.

## Imports and exports

- Prefer named exports. Preserve default exports required by the framework or an established app contract.
- Follow the repository's formatter and import ordering.
- Use relative imports within one directory and existing path aliases for deeper source imports.

## Project conventions

- Keep code in the relevant CLI, web, E2E, or YouTube-token workspace.
- Follow each workspace's existing import paths and exports. Preserve framework-required exports.
