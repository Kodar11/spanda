import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Headphones,
  ListFilter,
  Music2,
  RotateCcw,
  Shield,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Logo } from '@/components/ui/Logo'
import { Slider } from '@/components/ui/Slider'
import { TextArea } from '@/components/ui/TextArea'
import { Toggle } from '@/components/ui/Toggle'
import { DEFAULT_SETTINGS, getSettings, setSettings } from '@/lib/storage'
import type { ExtensionSettings } from '@/types'

const MIN_RESUME_DELAY_MS = 2000
const MAX_RESUME_DELAY_MS = 10000
const MIN_FADE_DURATION_MS = 0
const MAX_FADE_DURATION_MS = 2000

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--spandan-radius-sm)] bg-cyan-400/10 text-cyan-300">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  )
}

export default function Options() {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    getSettings().then(setSettingsState)
  }, [])

  const whitelistChips = useMemo(() => {
    if (!settings) return []
    return settings.whitelist.filter(Boolean)
  }, [settings])

  const update = (partial: Partial<ExtensionSettings>) => {
    if (!settings) return
    setSettingsState({ ...settings, ...partial })
    setSaved(false)
    setErrors({})
  }

  const validate = (): boolean => {
    if (!settings) return false

    const nextErrors: Record<string, string> = {}

    if (
      settings.resumeDelayMs < MIN_RESUME_DELAY_MS ||
      settings.resumeDelayMs > MAX_RESUME_DELAY_MS
    ) {
      nextErrors.resumeDelayMs = `Resume delay must be between ${MIN_RESUME_DELAY_MS / 1000}s and ${MAX_RESUME_DELAY_MS / 1000}s.`
    }

    if (
      settings.fadeDurationMs < MIN_FADE_DURATION_MS ||
      settings.fadeDurationMs > MAX_FADE_DURATION_MS
    ) {
      nextErrors.fadeDurationMs = `Fade duration must be between ${MIN_FADE_DURATION_MS / 1000}s and ${MAX_FADE_DURATION_MS / 1000}s.`
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = async () => {
    if (!settings || !validate()) return
    await setSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    if (!confirm('Reset all settings to defaults?')) return
    await setSettings(DEFAULT_SETTINGS)
    setSettingsState(DEFAULT_SETTINGS)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--spandan-bg)] text-white">
        <Logo size={32} className="animate-pulse-soft" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--spandan-bg)] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl animate-fade-in">
        <header className="mb-8 flex items-center gap-4">
          <Logo size={40} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Spandan
            </h1>
            <p className="text-sm text-slate-500">
              Adaptive background music for deep focus
            </p>
          </div>
        </header>

        <div className="space-y-5">
          <Card variant="elevated">
            <SectionHeader
              icon={Shield}
              title="General"
              description="Enable or disable the extension"
            />
            <Toggle
              label="Enable Spandan"
              description="Automatically pause and resume background music"
              checked={settings.enabled}
              onChange={(checked) => update({ enabled: checked })}
            />
          </Card>

          <Card variant="elevated">
            <SectionHeader
              icon={SlidersHorizontal}
              title="Playback"
              description="Fine-tune how music pauses and resumes"
            />
            <div className="space-y-6">
              <Slider
                label="Resume Delay"
                value={settings.resumeDelayMs}
                min={MIN_RESUME_DELAY_MS}
                max={MAX_RESUME_DELAY_MS}
                step={100}
                unit="ms"
                onChange={(value) => update({ resumeDelayMs: value })}
              />
              {errors.resumeDelayMs && (
                <p className="text-xs text-rose-300">{errors.resumeDelayMs}</p>
              )}

              <Slider
                label="Fade Duration"
                value={settings.fadeDurationMs}
                min={MIN_FADE_DURATION_MS}
                max={MAX_FADE_DURATION_MS}
                step={50}
                unit="ms"
                onChange={(value) => update({ fadeDurationMs: value })}
              />
              {errors.fadeDurationMs && (
                <p className="text-xs text-rose-300">
                  {errors.fadeDurationMs}
                </p>
              )}
            </div>
          </Card>

          <Card variant="elevated">
            <SectionHeader
              icon={ListFilter}
              title="Detection"
              description="Choose which sites can pause your music"
            />
            <TextArea
              label="Website Whitelist"
              hint="One website per line. Leave empty to allow all sites. Subdomains match automatically."
              rows={6}
              value={settings.whitelist.join('\n')}
              onChange={(event) =>
                update({
                  whitelist: event.target.value.split('\n').filter(Boolean),
                })
              }
              placeholder={`youtube.com
udemy.com
coursera.com
netflix.com`}
            />
            {whitelistChips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {whitelistChips.map((site) => (
                  <Chip
                    key={site}
                    label={site}
                    onRemove={() =>
                      update({
                        whitelist: settings.whitelist.filter((s) => s !== site),
                      })
                    }
                  />
                ))}
              </div>
            )}
          </Card>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} className="min-w-[120px]">
              {saved ? (
                <>
                  <Check size={16} />
                  Saved
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
            <Button variant="secondary" onClick={handleReset}>
              <RotateCcw size={14} />
              Reset
            </Button>
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <Music2 size={13} />
              Smart pause
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones size={13} />
              Deep focus
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
