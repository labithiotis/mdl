# Pull requests

## Size

If a PR exceeds 2,000 lines or 50 files, suggest smaller PRs that each ship one concern. Mechanical changes such as
renames, dependency updates, generated files, and doc moves can be larger.

## Task chunking

Plan the smallest shippable functional units. Prefer one concern per branch. Use sequential PRs when changes depend on
each other and parallel PRs when they are independent.

## Description

Write the PR description with `./docs/WHITTLE.md`: short sentences, plain words, one idea per sentence, so a non-native
reader follows it on the first read.

Focus only on what the PR delivers. Describe:

- What is new.
- What changed from before.
- What was removed.
- Any breaking changes.
- Important caveats, limitations, evals, or migration notes.

Anything reviewers need to know about the resulting behaviour.

Use headings only when they improve readability. For larger PRs, prefer What changed, Breaking changes, Evals, and Notes
as needed.

Do not include testing details, test results, validation steps, implementation process, outcomes, future work, follow-up
lists, created by X or teammate names.

Keep the body limited to changes in this PR.
