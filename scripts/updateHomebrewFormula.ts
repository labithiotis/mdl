#!/usr/bin/env bun

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type FormulaTargetKey =
  | 'macosArm64'
  | 'macosX64'
  | 'linuxArm64'
  | 'linuxX64';

type FormulaConfig = {
  formulaPath: string;
  githubRepository: string;
  sha256ByTarget: Record<FormulaTargetKey, string>;
  version: string;
};

type AssetTarget = {
  cliName: string;
  cpuBlock: 'on_arm' | 'on_intel';
  osBlock: 'on_macos' | 'on_linux';
  suffix: string;
  targetKey: FormulaTargetKey;
};

const assetTargets: AssetTarget[] = [
  {
    cliName: 'macos-arm64',
    cpuBlock: 'on_arm',
    suffix: 'macos-arm64',
    targetKey: 'macosArm64',
    osBlock: 'on_macos',
  },
  {
    cliName: 'macos-x64',
    cpuBlock: 'on_intel',
    suffix: 'macos-x64',
    targetKey: 'macosX64',
    osBlock: 'on_macos',
  },
  {
    cliName: 'linux-arm64',
    cpuBlock: 'on_arm',
    suffix: 'linux-arm64',
    targetKey: 'linuxArm64',
    osBlock: 'on_linux',
  },
  {
    cliName: 'linux-x64',
    cpuBlock: 'on_intel',
    suffix: 'linux-x64',
    targetKey: 'linuxX64',
    osBlock: 'on_linux',
  },
];

export function renderFormula(config: FormulaConfig): string {
  validateConfig(config);

  const blocks = ['on_macos', 'on_linux']
    .map((osBlock) =>
      renderOsBlock(config, osBlock as AssetTarget['osBlock'])
    )
    .join('\n\n');

  return `class Mdl < Formula
  desc "Interactive CLI for syncing music locally via YouTube"
  homepage "https://github.com/${config.githubRepository}"
  version "${config.version}"
  license "MIT"

${blocks}

  depends_on "ffmpeg"

  def install
    bin.install "mdl"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/mdl --version")
  end
end
`;
}

function renderOsBlock(
  config: FormulaConfig,
  osBlock: AssetTarget['osBlock']
): string {
  const targets = assetTargets.filter((target) => target.osBlock === osBlock);

  return [
    `  ${osBlock} do`,
    ...targets.map((target) => renderTargetBlock(config, target)),
    '  end',
  ].join('\n\n');
}

function renderTargetBlock(
  config: FormulaConfig,
  target: AssetTarget
): string {
  const sha256 = config.sha256ByTarget[target.targetKey];

  return [
    `    ${target.cpuBlock} do`,
    `      url "${buildAssetUrl(config, target.suffix)}"`,
    `      sha256 "${sha256}"`,
    '    end',
  ].join('\n');
}

function buildAssetUrl(config: FormulaConfig, suffix: string): string {
  return `https://github.com/${config.githubRepository}/releases/download/v${config.version}/mdl-v${config.version}-${suffix}.tar.gz`;
}

function validateConfig(config: FormulaConfig): void {
  const requiredValues = [
    ['formulaPath', config.formulaPath],
    ['githubRepository', config.githubRepository],
    ['version', config.version],
  ] as const;

  for (const [name, value] of requiredValues) {
    if (typeof value !== 'string' || value.length === 0)
      throw new Error(`Missing required argument: ${name}`);
  }

  for (const target of assetTargets) {
    const sha256 = config.sha256ByTarget[target.targetKey];

    if (!isSha256(sha256))
      throw new Error(
        `Missing required checksum for ${target.cliName}: ${String(sha256)}`
      );
  }
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function parseCliArgs(argv: string[]): FormulaConfig {
  const values: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (!flag?.startsWith('--'))
      throw new Error(`Unexpected argument: ${String(flag)}`);

    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for ${flag}`);

    values[flag.slice(2)] = value;
  }

  return {
    formulaPath: values.formula,
    githubRepository: values['github-repository'],
    sha256ByTarget: {
      linuxArm64: values['linux-arm64-sha'],
      linuxX64: values['linux-x64-sha'],
      macosArm64: values['macos-arm64-sha'],
      macosX64: values['macos-x64-sha'],
    },
    version: values.version,
  };
}

async function main(): Promise<void> {
  const config = parseCliArgs(process.argv.slice(2));
  const formula = renderFormula(config);
  const directoryPath = path.dirname(config.formulaPath);

  await mkdir(directoryPath, { recursive: true });
  await writeFile(config.formulaPath, formula);
}

if (import.meta.main) {
  await main();
}
