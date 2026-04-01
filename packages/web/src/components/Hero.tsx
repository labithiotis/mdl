export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-24 md:pb-20 md:pt-36">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="animate-fade-in-up animation-delay-100 text-5xl font-extrabold tracking-tight md:text-7xl">
          <span className="bg-gradient-to-r from-zinc-100 via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Download music
          </span>
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            from your terminal
          </span>
        </h1>

        <p className="animate-fade-in-up animation-delay-200 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
          Paste a URL from any major streaming service. mdl resolves the
          metadata, finds the audio on YouTube, and downloads your tracks
          locally. No API keys needed.
        </p>

        <div className="animate-fade-in-up animation-delay-300 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#install"
            className="group relative inline-flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-500 hover:shadow-violet-500/30"
          >
            Get started
            <svg
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </a>
          <a
            href="https://github.com/labithiotis/mdl"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-7 py-3.5 text-sm font-semibold text-zinc-200 transition-all hover:border-zinc-600 hover:bg-zinc-700/50"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
