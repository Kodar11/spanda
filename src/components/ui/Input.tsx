import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
}

export function Input({ label, hint, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-200">
          {label}
        </label>
      )}
      <input
        className={`w-full rounded-[var(--spandan-radius-sm)] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-500 transition-colors hover:border-white/15 focus:border-cyan-400/60 focus:bg-white/[0.05] focus:outline-none ${className}`}
        {...props}
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
