import { useEffect, useState } from 'react'
import {
  Headphones,
  Music2,
  Settings,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Logo } from '@/components/ui/Logo'
import { StatusBadge } from '@/components/ui/StatusBadge'
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

function statusLabel(status: PlaybackStatus): string {
  switch (status) {
    case 'disabled':
      return 'Extension disabled'
    case 'no_music_tab':
      return 'No music tab'
    case 'playing':
      return 'Music playing'
    case 'paused':
      return 'Music paused'
    case 'waiting':
      return 'Waiting to resume'
    case 'manual_pause':
      return 'Auto-pause off'
    default:
      return 'Unknown'
  }
}

function statusIcon(status: PlaybackStatus) {
  switch (status) {
    case 'playing':
      return <Music2 size={18} className="text-emerald-300" />
    case 'waiting':
      return <Volume2 size={18} className="text-amber-300" />
    case 'paused':
    case 'manual_pause':
      return <Headphones size={18} className="text-slate-400" />
    default:
      return <Logo size={18} />
  }
}

export default function Popup() {
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

  useEffect(() => {
    if (uiState?.status !== 'waiting' || uiState.waitingSeconds === null)
      return

    const interval = setInterval(() => {
      setUiState((current) => {
        if (
          !current ||
          current.waitingSeconds === null ||
          current.waitingSeconds <= 1
        ) {
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

  if (!uiState) {
    return (
      <div className="flex h-44 w-80 items-center justify-center bg-[var(--spandan-bg)] p-4 text-white">
        <Logo size={28} className="animate-pulse-soft" />
      </div>
    )
  }

  const label = statusLabel(uiState.status)

  return (
    <div className="w-80 animate-fade-in bg-[var(--spandan-bg)] p-4 text-white">
      <header className="mb-4 flex items-center gap-3">
        <Logo size={28} />
        <div>
          <h1 className="text-base font-bold leading-tight tracking-tight text-white">
            Spandan
          </h1>
          <p className="text-[11px] leading-tight text-slate-500">
            Adaptive music for deep focus
          </p>
        </div>
      </header>

      {uiState.error ? (
        <Card className="mb-4 border-rose-500/20 bg-rose-500/10">
          <p className="text-sm text-rose-300">{uiState.error}</p>
        </Card>
      ) : (
        <Card variant="glass" className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {statusIcon(uiState.status)}
              <StatusBadge status={uiState.status} label={label} />
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-300">{uiState.reason}</p>

          {uiState.status === 'waiting' && uiState.waitingSeconds !== null && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                <span>Resuming</span>
                <span className="font-medium text-amber-300">
                  {uiState.waitingSeconds}s
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-1000 ease-linear"
                  style={{
                    width: `${Math.max(
                      5,
                      (uiState.waitingSeconds / (uiState.settings.resumeDelayMs / 1000)) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {uiState.musicTab && (
            <div className="mt-3 flex items-center gap-2 rounded-[var(--spandan-radius-sm)] bg-white/[0.03] px-2.5 py-2">
              <Music2 size={14} className="shrink-0 text-slate-500" />
              <p
                className="truncate text-xs text-slate-400"
                title={uiState.musicTab.url}
              >
                {uiState.musicTab.title}
              </p>
            </div>
          )}
        </Card>
      )}

      <Card className="mb-3">
        <Toggle
          label="Enable Spandan"
          description="Automatically manage background music"
          checked={uiState.settings.enabled}
          onChange={handleToggle}
        />
      </Card>

      <Button className="w-full" onClick={handleSetMusicTab}>
        <Music2 size={16} />
        Set Current Tab as Music Tab
      </Button>

      <button
        type="button"
        onClick={() => chrome.runtime.openOptionsPage()}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--spandan-radius-sm)] py-2 text-xs font-medium text-slate-500 transition-colors hover:text-cyan-300"
      >
        <Settings size={13} />
        Open Settings
      </button>
    </div>
  )
}
