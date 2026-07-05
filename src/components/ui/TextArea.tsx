import type { TextareaHTMLAttributes } from 'react'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function TextArea({ label, className = '', ...props }: TextAreaProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-slate-200">{label}</label>
      )}
      <textarea
        className={`w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none ${className}`}
        {...props}
      />
    </div>
  )
}
