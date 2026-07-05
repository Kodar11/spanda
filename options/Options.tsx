import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TextArea } from '@/components/ui/TextArea'
import { getSettings, setSettings } from '@/lib/storage'
import type { ExtensionSettings } from '@/types'

/**
 * Options / Settings page for spanda.
 *
 * Phase 1 stores the values with the typed storage helper. Phase 2 will use
 * these settings when orchestrating resume delays, fades, and whitelist checks.
 */
function Options() {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(setSettingsState)
  }, [])

  const update = (partial: Partial<ExtensionSettings>) => {
    if (!settings) return
    setSettingsState({ ...settings, ...partial })
    setSaved(false)
  }

  const handleSave = async () => {
    if (!settings) return
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
        <h1 className="mb-2 text-2xl font-bold text-cyan-300">spanda Settings</h1>
        <p className="mb-6 text-sm text-slate-400">
          Configure how spanda pauses and resumes your background music.
        </p>

        <div className="space-y-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <section>
            <Input
              label="Resume Delay (ms)"
              type="number"
              min={0}
              step={100}
              value={settings.resumeDelayMs}
              onChange={(event) =>
                update({ resumeDelayMs: Number(event.target.value) })
              }
            />
            <p className="mt-1 text-xs text-slate-400">
              Time to wait before resuming music after another tab stops
              producing audio.
            </p>
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
          </section>

          <section>
            <TextArea
              label="Website Whitelist"
              rows={6}
              value={settings.whitelist.join('\n')}
              onChange={(event) =>
                update({
                  whitelist: event.target.value.split('\n').filter(Boolean),
                })
              }
              placeholder="https://www.youtube.com/*&#10;https://open.spotify.com/*"
            />
            <p className="mt-1 text-xs text-slate-400">
              One URL pattern per line. Leave empty to allow all websites.
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
