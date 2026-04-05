type RenderedApp = {
  frames: string[];
  lastFrame: () => string | undefined;
};

const DEFAULT_TIMEOUT_MS = process.env.CI ? 90_000 : 240_000;

export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${description}.`);
}

export async function waitForValue<T>(
  getter: () => T | null | Promise<T | null>,
  description: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await getter();
    if (value !== null) {
      return value;
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${description}.`);
}

export async function waitForDownloadedFileOrThrow(params: {
  app: RenderedApp;
  description: string;
  findDownloadedFile: () => Promise<string | null>;
  timeoutMs?: number;
}): Promise<string> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const downloadedFile = await params.findDownloadedFile();

    if (downloadedFile) {
      return downloadedFile;
    }

    const latestFrame = getLatestFrame(params.app);

    if (isErrorFrame(latestFrame)) {
      throw new Error(
        `The app exited with an error while waiting for ${params.description}.\n\n${formatRecentFrames(params.app.frames)}`
      );
    }

    if (isFinishedFrame(latestFrame)) {
      throw new Error(
        `The app finished before ${params.description} was created.\n\n${formatRecentFrames(params.app.frames)}`
      );
    }

    await sleep(250);
  }

  throw new Error(
    `Timed out waiting for ${params.description}.\n\n${formatRecentFrames(params.app.frames)}`
  );
}

export function getLatestFrame(app: RenderedApp): string {
  return app.lastFrame() ?? app.frames.at(-1) ?? '(no app output captured)';
}

export function isFinishedFrame(frame: string): boolean {
  return frame.includes('Finished');
}

export function isErrorFrame(frame: string): boolean {
  return (
    frame.includes('Error') && frame.includes('The process will exit shortly.')
  );
}

export function formatRecentFrames(
  frames: string[],
  recentFrameCount = 3
): string {
  const recentFrames = frames.slice(-recentFrameCount);

  if (recentFrames.length === 0) {
    return 'Recent output:\n(no app output captured)';
  }

  return `Recent output:\n${recentFrames.join('\n\n---\n\n')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
