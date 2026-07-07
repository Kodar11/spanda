import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TextArea } from '@/components/ui/TextArea'
import { getSettings, setSettings } from '@/lib/storage'
import type { ExtensionSettings } from '@/types'

const MIN_RESUME_DELAY_MS = 2000
const MAX_RESUME_DELAY_MS = 10000

/**
 * Options / Settings page for spandan.
 *
 * Allows the user to configure resume delay, fade duration, and the website
 * whitelist. Validation prevents saving invalid values.
 */
function Options() {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    getSettings().then(setSettingsState)
  }, [])

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

    if (settings.fadeDurationMs < 0) {
      nextErrors.fadeDurationMs = 'Fade duration cannot be negative.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = async () => {
    if (!settings || !validate()) return
    await setSettings(settings)
    setSaved(true)
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-white">
        Loading settings...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold text-cyan-300">spandan Settings</h1>
        <p className="mb-6 text-sm text-slate-400">
          Configure how spandan pauses and resumes your background music.
        </p>

        <div className="space-y-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <section>
            <Input
              label="Resume Delay (ms)"
              type="number"
              min={MIN_RESUME_DELAY_MS}
              max={MAX_RESUME_DELAY_MS}
              step={100}
              value={settings.resumeDelayMs}
              onChange={(event) =>
                update({ resumeDelayMs: Number(event.target.value) })
              }
            />
            <p className="mt-1 text-xs text-slate-400">
              Time to wait before resuming music after another tab stops
              producing audio. Allowed range:{' '}
              {MIN_RESUME_DELAY_MS / 1000}–{MAX_RESUME_DELAY_MS / 1000} seconds.
            </p>
            {errors.resumeDelayMs && (
              <p className="mt-1 text-xs text-red-300">{errors.resumeDelayMs}</p>
            )}
          </section>

          <section>
            <Input
              label="Fade Duration (ms)"
              type="number"
              min={0}
              step={50}
              value={settings.fadeDurationMs}
              onChange={(event) =>
                update({ fadeDurationMs: Number(event.target.value) })
              }
            />
            <p className="mt-1 text-xs text-slate-400">
              Length of the fade in/out effect applied to the music tab.
            </p>
            {errors.fadeDurationMs && (
              <p className="mt-1 text-xs text-red-300">{errors.fadeDurationMs}</p>
            )}
          </section>

          <section>
            <TextArea
              label="Website Whitelist"
              rows={8}
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
            <p className="mt-1 text-xs text-slate-400">
              One website per line. Only audio from these sites will pause your
              music. Leave empty to allow all websites. Subdomains are matched
              automatically (e.g., <code>youtube.com</code> also matches{' '}
              <code>www.youtube.com</code> and <code>music.youtube.com</code>).
            </p>
          </section>

          <div className="flex items-center gap-4">
            <Button onClick={handleSave}>Save Settings</Button>
            {saved && (
              <span className="text-sm font-medium text-green-400">Saved!</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Options
