import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.16),_transparent_32%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-8">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-cyan-200">
            Counter Demo
          </div>

          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Clean counter UI
            </h1>
            <p className="mx-auto max-w-md text-sm leading-6 text-slate-300 sm:text-base">
              A simple counter powered by React state and styled entirely with Tailwind CSS.
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center gap-6">
            <div className="flex h-32 w-32 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 shadow-inner shadow-black/40 sm:h-36 sm:w-36">
              <span className="text-5xl font-semibold tracking-tight text-cyan-300 sm:text-6xl">
                {count}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCount((currentCount) => currentCount + 1)}
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Increase count
            </button>

            <p className="text-sm text-slate-400">
              Click the button to increment the counter.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
