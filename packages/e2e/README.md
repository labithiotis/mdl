# E2E Tests

These tests will run fully e2e test on CLI, it will perform actual downloads a verify files. 

Run `bun run test:youtube-smoke` from the repository root to download the
first track of a YouTube Music album and verify that `ffprobe` detects a
non-empty audio stream with a positive duration.

> ⚠️ These tests do not work in CI, the youtube APIs will get blocked. We may be able to work around them using PO Token (Proof of Origin Token) but that requires a server to generate token per Video ID.
