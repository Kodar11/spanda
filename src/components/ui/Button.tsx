import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[var(--spandan-radius-sm)] px-4 py-2.5 text-sm font-semibold transition-all duration-150 spandan-focus disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'

  const styles = {
    primary:
      'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-900/30 hover:shadow-cyan-900/50 hover:brightness-110',
    secondary:
      'border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white',
    ghost:
      'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]',
  }

  return (
    <button
      type="button"
      className={`${base} ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
