import type { TextareaHTMLAttributes } from 'react'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
}

export function TextArea({
  label,
  hint,
  className = '',
  ...props
}: TextAreaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-200">
          {label}
        </label>
      )}
      <textarea
        className={`w-full resize-y rounded-[var(--spandan-radius-sm)] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-500 transition-colors hover:border-white/15 focus:border-cyan-400/60 focus:bg-white/[0.05] focus:outline-none ${className}`}
        {...props}
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
