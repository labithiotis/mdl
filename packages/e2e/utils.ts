import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Timeout the CLI before tests timeout to get error
const CLI_TIMEOUT_MS = 59_000;

const CLI_ENTRY_PATH = fileURLToPath(
  new URL('../cli/src/cli.tsx', import.meta.url)
);

export type CliRunResult = {
  command: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  combinedOutput: string;
  durationMs: number;
};

export class CliRunError extends Error {
  result: CliRunResult;

  constructor(message: string, result: CliRunResult) {
    super(message);
    this.name = 'CliRunError';
    this.result = result;
  }
}

export async function runCli(
  args: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    rejectOnNonZeroExit?: boolean;
  }
): Promise<CliRunResult> {
  const cwd =
    options?.cwd ?? path.resolve(path.dirname(CLI_ENTRY_PATH), '../../..');
  const command = ['bun', 'run', CLI_ENTRY_PATH, ...args];
  const startedAt = Date.now();
  const child = spawn('bun', ['run', CLI_ENTRY_PATH, ...args], {
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

  const result = {
    command,
    cwd,
    exitCode,
    stdout,
    stderr,
    combinedOutput: [stdout, stderr].filter(Boolean).join('\n'),
    durationMs: Date.now() - startedAt,
  };

  if ((options?.rejectOnNonZeroExit ?? true) && exitCode !== 0) {
    throw new CliRunError(buildCliRunErrorMessage(result), result);
  }

  return result;
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

function buildCliRunErrorMessage(result: CliRunResult): string {
  const summaryLines = [
    'CLI process exited with a non-zero status.',
    `Command: ${result.command.join(' ')}`,
    `CWD: ${result.cwd}`,
    `Exit code: ${result.exitCode ?? 'null'}`,
    `Duration: ${result.durationMs}ms`,
  ];

  const outputPreview = cleanOutput(result.combinedOutput);

  if (outputPreview) {
    summaryLines.push('CLI output:');
    summaryLines.push(outputPreview);
  }

  return summaryLines.join('\n');
}

export function cleanOutput(string: string): string {
  const ansiPattern = new RegExp(
    `${String.fromCharCode(0x1b)}\\[[0-9;?]*[ -/]*[@-~]`,
    'g'
  );
  return string.replace(ansiPattern, '').replace(/\r/g, '').trim();
}
