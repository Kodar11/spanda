interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <label className="group flex cursor-pointer items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-slate-100">{label}</span>
        {description && (
          <span className="text-xs text-slate-500">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 spandan-focus ${
          checked
            ? 'bg-gradient-to-r from-cyan-500 to-indigo-500'
            : 'bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  )
}
