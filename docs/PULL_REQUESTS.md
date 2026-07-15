# Pull Requests

## Size

Keep PRs small. Soft target: **<= 200 lines net diff, <= 10 files** (lockfile + generated artifacts excluded). **Hard split** if the planned slice heads past **1,000 lines or 35 files**: break the deliverable into smaller PRs that ship one at a time. Reviewer fatigue sets in around 400 lines; if the review needs more than one sitting, the PR is too big.

If the work does not naturally split, the slice goal is too big. Re-plan instead of pushing through. Mechanical-only PRs (renames, dependency bumps, generated-file regen, doc moves) can go larger; flag that in the title or first line.

## Task Chunking

Plan in the smallest shippable units. When breaking down work, prefer one concern per branch: multiple small PRs over one bundle. Use sequential PRs where logic requires order; use parallel PRs where slices are independent.
