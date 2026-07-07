import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import Popup from './Popup'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div className="w-80 bg-slate-950 p-4 text-sm text-white">
          <p>Loading spandan...</p>
          <p className="mt-1 text-xs text-slate-400">
            This should only take a moment.
          </p>
        </div>
      }
    >
      <Popup />
    </Suspense>
  </StrictMode>,
)
