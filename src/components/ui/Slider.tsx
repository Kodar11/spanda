interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-200">{label}</label>
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium text-cyan-300">
          {value}
          {unit}
        </span>
      </div>
      <div className="relative h-5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="spandan-focus absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none bg-transparent"
          aria-label={label}
        />
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-slate-700/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
