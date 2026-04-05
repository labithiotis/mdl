import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_TIMEOUT_MS = 60_000;
const CLI_ENTRY_PATH = fileURLToPath(
  new URL('../cli/src/cli.tsx', import.meta.url)
);

export async function runCli(
  args: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string | undefined>;
  }
): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
  combinedOutput: string;
}> {
  const cwd =
    options?.cwd ?? path.resolve(path.dirname(CLI_ENTRY_PATH), '../../..');
  const child = spawn(process.execPath, ['run', CLI_ENTRY_PATH, ...args], {
    cwd,
    env: {
      ...process.env,
      ...options?.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    const output = chunk.toString();
    stdout += output;
  });

  child.stderr.on('data', (chunk) => {
    const output = chunk.toString();
    stderr += output;
  });

  const exitCode = await waitForProcessExit(child, CLI_TIMEOUT_MS);

  return {
    exitCode,
    stdout,
    stderr,
    combinedOutput: [stdout, stderr].filter(Boolean).join('\n'),
  };
}

async function waitForProcessExit(
  child: ReturnType<typeof spawn>,
  timeoutMs?: number
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out waiting for CLI process to exit.`));
    }, timeoutMs ?? CLI_TIMEOUT_MS);

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once('close', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}
