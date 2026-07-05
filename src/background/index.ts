import {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
  getState,
  setState,
} from '@/lib/storage'
import {
  findTabByUrl,
  isMusicTab,
  isYouTubeUrl,
  queryAudibleTabs,
} from '@/lib/tabs'
import type {
  ExtensionMessage,
  ExtensionResponse,
  ExtensionSettings,
  MusicTab,
} from '@/types'

/**
 * Background service worker for spanda.
 *
 * Responsibilities:
 * - Restore the saved music tab after browser restart (by URL matching).
 * - Listen for audible-tab changes via chrome.tabs.onUpdated/onRemoved.
 * - Decide when to pause/resume the music tab based on other audible tabs.
 * - Route messages from the popup and content scripts.
 *
 * Phase 3 additions will be:
 * - resumeDelayMs handling (delay before resuming)
 * - fadeDurationMs handling (fade volume before play/pause)
 * - user-initiated pause/mute detection
 */

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[spanda] extension installed')

  const existing = await getSettings()
  await setSettings({ ...DEFAULT_SETTINGS, ...existing })
})

chrome.runtime.onStartup.addListener(async () => {
  console.log('[spanda] browser started')
  await restoreMusicTab()
})

// ---------------------------------------------------------------------------
// Tab event listeners (event-driven audible detection)
// ---------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const state = await getState()

  if (isMusicTab(tabId, state.musicTab)) {
    // If the music tab navigated away from YouTube, clear it.
    if (tab.url && !isYouTubeUrl(tab.url)) {
      console.log('[spanda] music tab left YouTube, clearing')
      await clearMusicTab()
      return
    }

    // Keep stored metadata in sync when the music tab navigates between
    // YouTube pages. This makes restart restoration more accurate.
    if (changeInfo.url && tab.url && state.musicTab) {
      await setState({
        musicTab: {
          tabId,
          url: tab.url,
          title: tab.title || state.musicTab.title,
        },
      })
    }
  }

  // Re-evaluate whenever a tab starts or stops producing audio.
  if (changeInfo.audible !== undefined) {
    console.log(
      `[spanda] tab ${tabId} audible changed to ${changeInfo.audible}`,
    )
    await evaluatePlayback()
  }
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState()

  if (isMusicTab(tabId, state.musicTab)) {
    console.log('[spanda] music tab closed, clearing')
    await clearMusicTab()
  } else {
    await evaluatePlayback()
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return

  const newSettings = changes.settings.newValue as ExtensionSettings

  if (newSettings.enabled) {
    evaluatePlayback().catch(() => {})
  } else {
    stopPolling()
  }
})

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender,
    sendResponse: (response: ExtensionResponse) => void,
  ) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({ ok: false, payload: String(error) })
      })

    return true
  },
)

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'PING':
      return { ok: true, payload: 'pong' }

    case 'GET_STATUS':
      return handleGetStatus()

    case 'SET_MUSIC_TAB':
      return handleSetMusicTab(message.payload)

    case 'CONTENT_READY': {
      const state = await getState()
      if (sender.tab?.id && isMusicTab(sender.tab.id, state.musicTab)) {
        console.log('[spanda] music tab content script ready')
        await evaluatePlayback()
      }
      return { ok: true }
    }

    default:
      return { ok: false, payload: 'unknown message type' }
  }
}

async function handleGetStatus(): Promise<ExtensionResponse> {
  const [settings, state] = await Promise.all([getSettings(), getState()])
  const audibleTabs = await queryAudibleTabs()

  const nonMusicAudibleTabs = audibleTabs.filter(
    (tab) => tab.id !== undefined && !isMusicTab(tab.id, state.musicTab),
  )

  return {
    ok: true,
    payload: {
      enabled: settings.enabled,
      musicTab: state.musicTab,
      isPlaying: state.isPlaying,
      isNonMusicAudible: nonMusicAudibleTabs.length > 0,
    },
  }
}

async function handleSetMusicTab(
  musicTab: MusicTab,
): Promise<ExtensionResponse> {
  console.log('[spanda] set music tab request', musicTab)

  if (!isYouTubeUrl(musicTab.url)) {
    return {
      ok: false,
      payload: 'Only YouTube tabs can be set as the music tab.',
    }
  }

  await setState({ musicTab, isPlaying: false })
  await evaluatePlayback()

  return { ok: true, payload: musicTab }
}

// ---------------------------------------------------------------------------
// Music tab management
// ---------------------------------------------------------------------------

async function clearMusicTab(): Promise<void> {
  await setState({ musicTab: null, isPlaying: false })
  stopPolling()
}

async function restoreMusicTab(): Promise<void> {
  const state = await getState()
  if (!state.musicTab) return

  const tab = await findTabByUrl(state.musicTab.url)
  if (tab?.id) {
    await setState({
      musicTab: {
        tabId: tab.id,
        url: tab.url || state.musicTab.url,
        title: tab.title || state.musicTab.title,
      },
    })
    await evaluatePlayback()
  } else {
    // The saved tab is no longer open; keep the metadata but clear the
    // stale tab ID so the popup shows "No music tab selected".
    console.log('[spanda] saved music tab not found on startup, clearing')
    await setState({ musicTab: null })
  }
}

// ---------------------------------------------------------------------------
// Play/pause orchestration
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000
let pollTimer: ReturnType<typeof setInterval> | null = null

async function evaluatePlayback(): Promise<void> {
  const [settings, state] = await Promise.all([getSettings(), getState()])

  if (!settings.enabled) {
    console.log('[spanda] extension disabled, skipping evaluation')
    stopPolling()
    return
  }

  if (!state.musicTab?.tabId) {
    console.log('[spanda] no music tab, skipping evaluation')
    stopPolling()
    return
  }

  const audibleTabs = await queryAudibleTabs()
  const nonMusicAudibleTabs = audibleTabs.filter(
    (tab) => tab.id !== undefined && !isMusicTab(tab.id, state.musicTab),
  )

  console.log('[spanda] audible tabs', {
    all: audibleTabs.map((t) => ({ id: t.id, title: t.title })),
    nonMusic: nonMusicAudibleTabs.map((t) => ({ id: t.id, title: t.title })),
    currentIsPlaying: state.isPlaying,
  })

  // Always issue the command that matches the desired state. The commands are
  // idempotent on the <video> element, so this is safe even if our stored
  // `isPlaying` state is out of sync with reality.
  const shouldPlay = nonMusicAudibleTabs.length === 0
  await setDesiredPlayback(state.musicTab.tabId, shouldPlay)

  // Keep polling active whenever a music tab is set. This ensures commands
  // are retried if the content script wasn't ready, and it catches any
  // audible transitions the event API misses.
  updatePolling(settings.enabled, state.musicTab)
}

async function setDesiredPlayback(
  tabId: number,
  shouldPlay: boolean,
): Promise<void> {
  const command = shouldPlay ? 'PLAY' : 'PAUSE'
  console.log(`[spanda] sending ${command} to music tab`, tabId)

  const success = await sendCommand(tabId, command)
  if (success) {
    await setState({ isPlaying: shouldPlay })
  }
}

function updatePolling(enabled: boolean, musicTab: MusicTab | null): void {
  if (enabled && musicTab?.tabId) {
    startPolling()
  } else {
    stopPolling()
  }
}

function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    evaluatePlayback().catch(() => {
      // Silently ignore polling errors; the next event will recover.
    })
  }, POLL_INTERVAL_MS)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function sendCommand(
  tabId: number,
  command: 'PLAY' | 'PAUSE' | 'GET_VIDEO_STATUS',
): Promise<boolean> {
  console.log(`[spanda] sendCommand START ${command} -> tab ${tabId}`)

  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      type: command,
    })) as ExtensionResponse

    console.log(`[spanda] sendCommand RESPONSE ${command} -> tab ${tabId}:`, response)

    if (response?.ok) {
      console.log(`[spanda] ${command} succeeded on tab ${tabId}`)
      return true
    }

    console.warn(
      `[spanda] ${command} rejected on tab ${tabId}:`,
      response?.payload,
    )
  } catch (error) {
    console.warn(`[spanda] sendCommand ERROR ${command} -> tab ${tabId}:`, error)
  }

  // Retry once after a short delay. This handles the common case where the
  // content script hasn't finished injecting or the page is still loading.
  console.log(`[spanda] sendCommand RETRY ${command} -> tab ${tabId} in 500ms`)
  await delay(500)

  try {
    const retryResponse = (await chrome.tabs.sendMessage(tabId, {
      type: command,
    })) as ExtensionResponse

    console.log(`[spanda] sendCommand RETRY RESPONSE ${command} -> tab ${tabId}:`, retryResponse)

    if (retryResponse?.ok) {
      console.log(`[spanda] ${command} retry succeeded on tab ${tabId}`)
      return true
    }

    console.warn(
      `[spanda] ${command} retry rejected on tab ${tabId}:`,
      retryResponse?.payload,
    )
  } catch (retryError) {
    console.warn(
      `[spanda] ${command} retry failed on tab ${tabId}`,
      retryError,
    )
  }

  console.log(`[spanda] sendCommand FAILED ${command} -> tab ${tabId}`)
  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
