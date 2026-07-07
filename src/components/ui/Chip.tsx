import { X } from 'lucide-react'

interface ChipProps {
  label: string
  onRemove?: () => void
}

export function Chip({ label, onRemove }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-200 ring-1 ring-inset ring-cyan-400/20">
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 text-cyan-400/70 transition-colors hover:bg-cyan-400/20 hover:text-cyan-200"
          aria-label={`Remove ${label}`}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </span>
  )
}
