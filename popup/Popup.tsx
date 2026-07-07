import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { getComputedStatus } from '@/lib/status'
import {
  DEFAULT_SETTINGS,
  getSettings,
  getState,
  setSettings,
} from '@/lib/storage'
import type {
  ExtensionResponse,
  ExtensionSettings,
  MusicTab,
  PlaybackStatus,
  StatusPayload,
} from '@/types'

interface UiState {
  settings: ExtensionSettings
  status: PlaybackStatus
  reason: string
  musicTab: MusicTab | null
  waitingSeconds: number | null
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

async function loadInitialStatus(): Promise<UiState> {
  try {
    const [settings, state] = await Promise.all([getSettings(), getState()])
    const status = await getComputedStatus(settings, state)

    return {
      settings,
      status: status.status,
      reason: status.reason,
      musicTab: status.musicTab,
      waitingSeconds: status.waitingSeconds,
      error: null,
    }
  } catch (error) {
    console.error('[spandan] popup failed to load status', error)

    const settings = await getSettings().catch(() => DEFAULT_SETTINGS)

    return {
      settings,
      status: 'no_music_tab',
      reason: 'Extension worker is not responding',
      musicTab: null,
      waitingSeconds: null,
      error:
        'Extension worker is not responding. Try reloading the extension from brave://extensions.',
    }
  }
}

/**
 * Popup UI for spandan.
 *
 * Displays the extension enabled state, the current music tab, and a rich
 * status indicator with the reason for the current playback state.
 */
function Popup() {
  const [uiState, setUiState] = useState<UiState | null>(null)

  useEffect(() => {
    let cancelled = false
    loadInitialStatus().then((state) => {
      if (!cancelled) setUiState(state)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Live countdown when waiting to resume.
  useEffect(() => {
    if (uiState?.status !== 'waiting' || uiState.waitingSeconds === null)
      return

    const interval = setInterval(() => {
      setUiState((current) => {
        if (!current || current.waitingSeconds === null || current.waitingSeconds <= 1) {
          clearInterval(interval)
          refreshStatus()
          return current
        }
        return {
          ...current,
          waitingSeconds: current.waitingSeconds - 1,
        }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [uiState?.status, uiState?.waitingSeconds])

  async function refreshStatus() {
    setUiState((current) => (current ? { ...current, error: null } : current))

    try {
      const response = await sendMessageWithTimeout<ExtensionResponse>({
        type: 'GET_STATUS',
      })

      if (response.ok && response.payload) {
        const payload = response.payload as StatusPayload
        setUiState((current) =>
          current
            ? {
                ...current,
                status: payload.status,
                reason: payload.reason,
                musicTab: payload.musicTab,
                waitingSeconds: payload.waitingSeconds,
                error: null,
              }
            : current,
        )
      }
    } catch (err) {
      console.error('[spandan] popup refresh failed', err)
      setUiState((current) =>
        current
          ? {
              ...current,
              error:
                'Extension worker is not responding. Try reloading the extension.',
            }
          : current,
      )
    }
  }

  const handleToggle = async (next: boolean) => {
    setUiState((current) =>
      current
        ? {
            ...current,
            settings: { ...current.settings, enabled: next },
            error: null,
          }
        : current,
    )
    await setSettings({ enabled: next })
    await refreshStatus()
  }

  const handleSetMusicTab = async () => {
    setUiState((current) => (current ? { ...current, error: null } : current))
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab?.id || !tab.url) {
      setUiState((current) =>
        current
          ? { ...current, error: 'Could not identify the current tab.' }
          : current,
      )
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
        setUiState((current) =>
          current
            ? {
                ...current,
                error: String(response.payload ?? 'Failed to set music tab.'),
              }
            : current,
        )
      } else {
        await refreshStatus()
      }
    } catch (err) {
      console.error('[spandan] set music tab failed', err)
      setUiState((current) =>
        current
          ? {
              ...current,
              error:
                'Extension worker is not responding. Try reloading the extension.',
            }
          : current,
      )
    }
  }

  const renderStatusLabel = (status: PlaybackStatus): string => {
    switch (status) {
      case 'disabled':
        return 'Extension disabled'
      case 'no_music_tab':
        return 'No music tab selected'
      case 'playing':
        return 'Music playing'
      case 'paused':
        return 'Music paused'
      case 'waiting':
        return 'Waiting to resume'
      case 'manual_pause':
        return 'Auto-management paused'
      default:
        return 'Unknown'
    }
  }

  if (!uiState) {
    return (
      <div className="flex h-40 w-80 items-center justify-center bg-slate-950 p-4 text-white">
        <p className="text-sm text-slate-400">Loading spandan...</p>
      </div>
    )
  }

  return (
    <div className="w-80 space-y-4 bg-slate-950 p-4 text-white">
      <header>
        <h1 className="text-lg font-bold text-cyan-300">spandan</h1>
        <p className="text-xs text-slate-400">a background music extension</p>
      </header>

      {uiState.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-300">{uiState.error}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-sm">
            <span className="font-medium text-cyan-200">
              {renderStatusLabel(uiState.status)}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-400">{uiState.reason}</p>
          {uiState.status === 'waiting' && uiState.waitingSeconds !== null && (
            <p className="mt-1 text-xs text-cyan-300">
              Resuming in {uiState.waitingSeconds}s
            </p>
          )}
          {uiState.musicTab && (
            <p
              className="mt-2 truncate text-xs text-slate-500"
              title={uiState.musicTab.url}
            >
              {uiState.musicTab.title}
            </p>
          )}
        </div>
      )}

      <Toggle
        label={uiState.settings.enabled ? 'Enabled' : 'Disabled'}
        checked={uiState.settings.enabled}
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
