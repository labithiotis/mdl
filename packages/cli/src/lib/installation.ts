import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type InstallationConfig = {
  installationId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let installationIdPromise: Promise<string> | null = null;

export function getInstallationId(): Promise<string> {
  installationIdPromise ??= loadInstallationId(getConfigDirectory());
  return installationIdPromise;
}

export async function loadInstallationId(configDirectory: string): Promise<string> {
  const configPath = path.join(configDirectory, 'config.json');
  const existingInstallationId = await readInstallationId(configPath);
  if (existingInstallationId) return existingInstallationId;

  const installationId = crypto.randomUUID().toLowerCase();
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });

  try {
    await writeInstallationId(configPath, installationId, 'wx');
  } catch (error) {
    if (!isFileExistsError(error)) throw error;

    const winningInstallationId = await waitForInstallationId(configPath);
    if (winningInstallationId) return winningInstallationId;
    await writeInstallationId(configPath, installationId, 'w');
  }

  return installationId;
}

async function waitForInstallationId(configPath: string): Promise<string | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const installationId = await readInstallationId(configPath);
    if (installationId) return installationId;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

async function readInstallationId(configPath: string): Promise<string | null> {
  try {
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Partial<InstallationConfig>;
    return typeof config.installationId === 'string' && UUID_PATTERN.test(config.installationId)
      ? config.installationId.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

function writeInstallationId(configPath: string, installationId: string, flag: 'w' | 'wx'): Promise<void> {
  return writeFile(configPath, `${JSON.stringify({ installationId }, null, 2)}\n`, { flag, mode: 0o600 });
}

function isFileExistsError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EEXIST';
}

function getConfigDirectory(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'mdl');
  }

  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'mdl');
  }

  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'mdl');
}
