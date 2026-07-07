import type { PlaybackStatus } from '@/types'

interface StatusBadgeProps {
  status: PlaybackStatus
  label: string
}

const statusConfig: Record<
  PlaybackStatus,
  { dot: string; glow: string; text: string }
> = {
  disabled: {
    dot: 'bg-slate-500',
    glow: 'bg-slate-500/20',
    text: 'text-slate-400',
  },
  no_music_tab: {
    dot: 'bg-slate-500',
    glow: 'bg-slate-500/20',
    text: 'text-slate-400',
  },
  playing: {
    dot: 'bg-emerald-400',
    glow: 'bg-emerald-400/25',
    text: 'text-emerald-300',
  },
  paused: {
    dot: 'bg-rose-400',
    glow: 'bg-rose-400/25',
    text: 'text-rose-300',
  },
  waiting: {
    dot: 'bg-amber-400',
    glow: 'bg-amber-400/25',
    text: 'text-amber-300',
  },
  manual_pause: {
    dot: 'bg-indigo-400',
    glow: 'bg-indigo-400/25',
    text: 'text-indigo-300',
  },
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${config.dot}`}
        />
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.dot}`}
        />
      </span>
      <span className={`text-sm font-semibold ${config.text}`}>{label}</span>
    </div>
  )
}
