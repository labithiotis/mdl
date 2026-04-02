import { Demo } from './components/Demo';
import { Features } from './components/Features';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Install } from './components/Install';
import { Providers } from './components/Providers';

export function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-violet-950 selection:text-violet-50">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl animate-pulse-glow" />
        <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-fuchsia-600/8 blur-3xl animate-pulse-glow animation-delay-200" />
        <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-indigo-600/8 blur-3xl animate-pulse-glow animation-delay-400" />
      </div>

      <Header />
      <main>
        <Hero />
        <Demo />
        <Providers />
        <Features />
        <Install />
      </main>
      <Footer />
    </div>
  );
}
