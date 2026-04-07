#!/usr/bin/env node

import path from 'node:path';
import { render } from 'ink';
import { parseCliArgs } from './lib/args';
import { ensureFfmpegExecutable } from './lib/ffmpeg';
import { loadManifest } from './lib/manifest';
import { configureNetwork } from './lib/network';
import { CliArgumentError, formatEffectError } from './lib/utils';
import { App } from './ui/app';

try {
  await ensureFfmpegExecutable();

  const args = parseCliArgs(process.argv.slice(2));
  configureNetwork({
    proxy: args.proxy,
    ytCookie: args.ytCookie,
    ytUserAgent: args.ytUserAgent,
  });
  const dir = path.resolve(
    process.env.INIT_CWD ?? process.env.PWD ?? process.cwd()
  );
  const manifest = !args.url ? await loadManifest(dir) : null;
  const outputDir = path.resolve(args.outputDir ?? dir);

  render(
    <App
      manifest={manifest}
      initialUrl={args.url}
      outputDir={outputDir}
      audioFormat={args.audioFormat}
      audioQuality={args.audioQuality}
      downloadParallelism={args.downloadParallelism}
      trackCount={args.trackCount}
    />
  );
} catch (error) {
  process.stderr.write(`${formatEffectError(error)}\n`);
  process.exit(error instanceof CliArgumentError ? 0 : 1);
}
