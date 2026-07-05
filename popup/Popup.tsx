import { use, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { DEFAULT_SETTINGS, getSettings, setSettings } from '@/lib/storage'
import type { ExtensionResponse, ExtensionSettings, MusicTab } from '@/types'

interface StatusPayload {
  enabled: boolean
  musicTab: MusicTab | null
  isPlaying: boolean
  isNonMusicAudible: boolean
}

interface InitialStatus {
  settings: ExtensionSettings
  musicTab: MusicTab | null
  isPlaying: boolean
  isNonMusicAudible: boolean
  error: string | null
}

const WORKER_TIMEOUT_MS = 2000

function sendMessageWithTimeout<T>(
  message: unknown,
  timeoutMs = WORKER_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Extension worker did not respond in time'))
    }, timeoutMs)

    chrome.runtime
      .sendMessage(message)
      .then((response) => {
        clearTimeout(timer)
        resolve(response as T)
      })
      .catch((error: unknown) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function loadInitialStatus(): Promise<InitialStatus> {
  try {
    const [settings, response] = await Promise.race([
      Promise.all([
        getSettings(),
        sendMessageWithTimeout<ExtensionResponse>({ type: 'GET_STATUS' }),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Extension worker timeout')),
          WORKER_TIMEOUT_MS,
        ),
      ),
    ])

    const payload = response.ok ? (response.payload as StatusPayload) : null

    return {
      settings,
      musicTab: payload?.musicTab ?? null,
      isPlaying: payload?.isPlaying ?? false,
      isNonMusicAudible: payload?.isNonMusicAudible ?? false,
      error: null,
    }
  } catch (error) {
    console.error('[spanda] popup failed to load status', error)

    // Even if the worker is unreachable, try to read settings from storage
    // so the popup isn't completely blank.
    const settings = await getSettings().catch(() => DEFAULT_SETTINGS)

    return {
      settings,
      musicTab: null,
      isPlaying: false,
      isNonMusicAudible: false,
      error:
        'Extension worker is not responding. Try reloading the extension from brave://extensions.',
    }
  }
}

/**
 * Popup UI for spanda.
 *
 * Displays the extension enabled state, the current music tab, and whether
 * playback is currently paused by another audible tab. The popup communicates
 * with the background service worker so the status is always live.
 */
function Popup() {
  // Create a fresh promise on every popup mount. A 2-second timeout prevents
  // the popup from getting stuck if the background service worker is slow or
  // unresponsive.
  const initial = use(useState(() => loadInitialStatus())[0])

  const [enabled, setEnabled] = useState(initial.settings.enabled)
  const [musicTab, setMusicTab] = useState<MusicTab | null>(initial.musicTab)
  const [isPlaying, setIsPlaying] = useState(initial.isPlaying)
  const [isNonMusicAudible, setIsNonMusicAudible] = useState(
    initial.isNonMusicAudible,
  )
  const [error, setError] = useState<string | null>(initial.error)

  async function refreshStatus() {
    setError(null)

    try {
      const response = await sendMessageWithTimeout<ExtensionResponse>({
        type: 'GET_STATUS',
      })

      if (response.ok && response.payload) {
        const payload = response.payload as StatusPayload
        setMusicTab(payload.musicTab)
        setIsPlaying(payload.isPlaying)
        setIsNonMusicAudible(payload.isNonMusicAudible)
      }
    } catch (err) {
      console.error('[spanda] popup refresh failed', err)
      setError(
        'Extension worker is not responding. Try reloading the extension.',
      )
    }
  }

  const handleToggle = async (next: boolean) => {
    setEnabled(next)
    setError(null)
    await setSettings({ enabled: next })
    await refreshStatus()
  }

  const handleSetMusicTab = async () => {
    setError(null)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab?.id || !tab.url) {
      setError('Could not identify the current tab.')
      return
    }

    try {
      const response = await sendMessageWithTimeout<ExtensionResponse>({
        type: 'SET_MUSIC_TAB',
        payload: {
          tabId: tab.id,
          url: tab.url,
          title: tab.title || tab.url,
        },
      })

      if (!response.ok) {
        setError(String(response.payload ?? 'Failed to set music tab.'))
      } else {
        await refreshStatus()
      }
    } catch (err) {
      console.error('[spanda] set music tab failed', err)
      setError(
        'Extension worker is not responding. Try reloading the extension.',
      )
    }
  }

  const renderStatus = () => {
    if (!musicTab) return 'No music tab selected'
    if (isNonMusicAudible) return 'Paused — another tab is playing audio'
    return isPlaying ? 'Playing' : 'Paused'
  }

  return (
    <div className="w-80 space-y-4 bg-slate-950 p-4 text-white">
      <header>
        <h1 className="text-lg font-bold text-cyan-300">spanda</h1>
        <p className="text-xs text-slate-400">a background music extension</p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-sm">
            Status:{' '}
            <span className="font-medium text-cyan-200">{renderStatus()}</span>
          </p>
          {musicTab && (
            <p
              className="mt-1 truncate text-xs text-slate-400"
              title={musicTab.url}
            >
              {musicTab.title}
            </p>
          )}
        </div>
      )}

      <Toggle
        label={enabled ? 'Enabled' : 'Disabled'}
        checked={enabled}
        onChange={handleToggle}
      />

      <Button className="w-full" onClick={handleSetMusicTab}>
        Set Current Tab as Music Tab
      </Button>

      <button
        type="button"
        onClick={() => chrome.runtime.openOptionsPage()}
        className="block w-full text-center text-xs text-slate-400 hover:text-cyan-300"
      >
        Open Settings
      </button>
    </div>
  )
}

export default Popup
