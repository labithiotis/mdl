export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = 240_000
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
  timeoutMs = 240_000
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
