import { useState } from 'react';

interface InstallMethod {
  readonly label: string;
  readonly command: string;
  readonly description: string;
}

const INSTALL_METHODS: readonly InstallMethod[] = [
  {
    label: 'npx',
    command: 'npx @mdlx/cli',
    description: 'Run directly with npx - no install needed',
  },
  {
    label: 'bun',
    command: 'bunx @mdlx/cli',
    description: 'Run directly with bun',
  },
  {
    label: 'npm',
    command: 'npm install -g @mdlx/cli',
    description: 'Install globally with npm',
  },
  {
    label: 'Binary',
    command: 'curl -fsSL https://github.com/labithiotis/mdl/releases/latest',
    description: 'Download pre-built binary from GitHub Releases',
  },
] as const;

const USAGE_EXAMPLES = [
  { command: 'mdl', description: 'Interactive mode - paste URL when prompted' },
  {
    command: 'mdl "https://open.spotify.com/playlist/..."',
    description: 'Download a Spotify playlist',
  },
  {
    command: 'mdl "url" --output ./music --parallel 5',
    description: 'Custom output dir & concurrency',
  },
  {
    command: 'mdl "url" --format m4a --bitrate 192K',
    description: 'Choose format and quality',
  },
] as const;

export function Install() {
  const [activeMethod, setActiveMethod] = useState(0);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const method = INSTALL_METHODS[activeMethod];
    if (!method) return;
    navigator.clipboard.writeText(method.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const currentMethod = INSTALL_METHODS[activeMethod];

  return (
    <section id="install" className="relative px-6 py-20 md:py-28">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Get started in seconds
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Requires{' '}
            <a
              href="https://ffmpeg.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 underline underline-offset-2 hover:text-violet-300"
            >
              ffmpeg
            </a>{' '}
            installed on your system
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex border-b border-zinc-800">
            {INSTALL_METHODS.map((method, index) => (
              <button
                key={method.label}
                type="button"
                onClick={() => setActiveMethod(index)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeMethod === index
                    ? 'bg-zinc-800/80 text-violet-400'
                    : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300'
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            <p className="mb-4 text-sm text-zinc-400">
              {currentMethod?.description}
            </p>
            <div className="group relative flex items-center rounded-xl bg-zinc-950 px-5 py-4">
              <code className="flex-1 font-mono text-sm text-green-400 sm:text-base">
                <span className="text-zinc-600">$ </span>
                {currentMethod?.command}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="ml-4 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2 text-zinc-400 opacity-0 transition-all hover:border-zinc-600 hover:text-zinc-200 group-hover:opacity-100"
                aria-label="Copy command"
              >
                {copied ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h3 className="mb-6 text-center text-xl font-semibold text-zinc-200">
            Usage examples
          </h3>
          <div className="space-y-3">
            {USAGE_EXAMPLES.map((example) => (
              <div
                key={example.command}
                className="flex flex-col gap-2 rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <code className="shrink-0 font-mono text-sm text-emerald-400">
                  $ {example.command}
                </code>
                <span className="text-sm text-zinc-500">
                  {example.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
