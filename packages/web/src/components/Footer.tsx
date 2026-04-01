const GITHUB_URL = 'https://github.com/labithiotis/mdl';

export function Footer() {
  return (
    <footer className="border-t border-zinc-800/50 px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="h-7 w-7"
          />
          <span className="font-mono text-sm text-zinc-500">
            mdl &mdash; Music Downloader CLI
          </span>
        </div>

        <div className="flex items-center gap-6">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            GitHub
          </a>
          <a
            href={`${GITHUB_URL}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Releases
          </a>
          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Issues
          </a>
          <a
            href="https://www.npmjs.com/package/mdlx-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            npm
          </a>
        </div>

        <p className="text-sm text-zinc-600">MIT License</p>
      </div>
    </footer>
  );
}
