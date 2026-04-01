const DEMO_GIF_URL =
  'https://github.com/user-attachments/assets/796efc3b-9512-4d1c-9377-c51b89aa9437';

export function Demo() {
  return (
    <section id="demo" className="relative px-6 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="animate-fade-in-up text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            See it in action
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            A fully interactive terminal experience with real-time progress
          </p>
        </div>

        <div className="animate-fade-in-up animation-delay-200 mt-12">
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 font-mono text-xs text-zinc-500">
                mdl ~ terminal
              </span>
            </div>

            <div className="relative aspect-video bg-zinc-950">
              <img
                src={DEMO_GIF_URL}
                alt="mdl CLI demo showing music download from Spotify"
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
