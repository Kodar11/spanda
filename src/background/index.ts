import {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
  getState,
  setState,
} from '@/lib/storage'
import {
  cancelResumeTimer,
  scheduleResumeTimer,
} from '@/lib/timers'
import { getComputedStatus, getWhitelistedNonMusicTabs } from '@/lib/status'
import {
  findTabByUrl,
  isMusicTab,
  isYouTubeUrl,
  queryAudibleTabs,
} from '@/lib/tabs'
import { queryVideoStatus } from '@/lib/video'
import type {
  ExtensionMessage,
  ExtensionResponse,
  ExtensionSettings,
  MusicTab,
  VideoStatus,
} from '@/types'

/**
 * Background service worker for spandan.
 *
 * Responsibilities:
 * - Restore the saved music tab after browser restart.
 * - Listen for audible-tab changes and pause/resume the music tab.
 * - Respect user-initiated pause/mute and manual-pause state.
 * - Apply resume delays and fade durations from settings.
 * - Enforce the website whitelist.
 * - Report rich status to the popup.
 */

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[spandan] extension installed')

  const existing = await getSettings()
  await setSettings({ ...DEFAULT_SETTINGS, ...existing })
})

chrome.runtime.onStartup.addListener(async () => {
  console.log('[spandan] browser started')
  await restoreMusicTab()
})

// ---------------------------------------------------------------------------
// Tab event listeners
// ---------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const state = await getState()

  if (isMusicTab(tabId, state.musicTab)) {
    if (tab.url && !isYouTubeUrl(tab.url)) {
      console.log('[spandan] music tab left YouTube, clearing')
      await clearMusicTab()
      return
    }

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

  // Polling is the primary mechanism for detecting audible changes.
  // We still trigger an evaluation on navigation so SPA route changes are
  // handled promptly.
  if (changeInfo.url) {
    await evaluatePlayback()
  }
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState()

  if (isMusicTab(tabId, state.musicTab)) {
    console.log('[spandan] music tab closed, clearing')
    await clearMusicTab()
  } else {
    await evaluatePlayback()
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return

  const newSettings = changes.settings.newValue as ExtensionSettings
  const oldSettings = changes.settings.oldValue as ExtensionSettings | undefined

  if (!newSettings.enabled) {
    stopAllAutomation()
    return
  }

  // If the resume delay changed while we were waiting to resume, restart the
  // timer with the new value so the user sees the updated delay immediately.
  if (
    oldSettings &&
    newSettings.resumeDelayMs !== oldSettings.resumeDelayMs
  ) {
    cancelResumeTimer()
    setState({ waitingToResumeUntil: null })
      .then(() => evaluatePlayback())
      .catch(() => {})
    return
  }

  evaluatePlayback().catch(() => {})
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
        console.log('[spandan] music tab content script ready')
        await evaluatePlayback()
      }
      return { ok: true }
    }

    case 'USER_PAUSED':
    case 'USER_MUTED':
    case 'USER_PLAYED':
    case 'USER_UNMUTED':
      // Legacy individual events are kept for compatibility but are now
      // superseded by USER_STATE_CHANGED, which is debounced and carries the
      // full aggregate state.
      return { ok: true }

    case 'USER_STATE_CHANGED':
      await handleUserStateChanged(sender.tab?.id, message.payload)
      return { ok: true }

    default:
      return { ok: false, payload: 'unknown message type' }
  }
}

async function handleGetStatus(): Promise<ExtensionResponse> {
  const [settings, state] = await Promise.all([getSettings(), getState()])
  const status = await getComputedStatus(settings, state)
  return { ok: true, payload: status }
}

async function handleSetMusicTab(
  musicTab: MusicTab,
): Promise<ExtensionResponse> {
  console.log('[spandan] set music tab request', musicTab)

  if (!isYouTubeUrl(musicTab.url)) {
    return {
      ok: false,
      payload: 'Only YouTube tabs can be set as the music tab.',
    }
  }

  // Query the actual video state so we don't trigger an unwanted fade-in
  // when the user selects a tab that is already playing.
  const videoStatus = await queryVideoStatus(musicTab.tabId)
  console.log('[spandan] initial video status for music tab', videoStatus)

  await setState({
    musicTab,
    isPlaying: videoStatus.isPlaying,
    manuallyPaused: !videoStatus.isPlaying && videoStatus.isMuted,
    waitingToResumeUntil: null,
  })
  await evaluatePlayback()

  return { ok: true, payload: musicTab }
}

async function handleUserStateChanged(
  tabId: number | undefined,
  status: VideoStatus,
): Promise<void> {
  if (!tabId) return
  const state = await getState()
  if (!isMusicTab(tabId, state.musicTab)) return

  console.log('[spandan] USER_STATE_CHANGED received', status, {
    previousManuallyPaused: state.manuallyPaused,
  })

  const userIsActivelyListening = status.isPlaying && !status.isMuted

  if (userIsActivelyListening) {
    if (state.manuallyPaused) {
      console.log('[spandan] user resumed music, clearing manual pause')
    }
    // User resumed the music (play or unmute). Re-enable auto-management and
    // let evaluatePlayback decide whether to fade out again immediately.
    await setState({ manuallyPaused: false, isPlaying: true })
    await evaluatePlayback()
  } else {
    if (!state.manuallyPaused) {
      console.log('[spandan] user paused/muted music, suspending auto-management')
    }
    // User paused or muted the music. Suspend auto-management until they
    // explicitly resume.
    cancelResumeTimer()
    await setState({
      isPlaying: false,
      manuallyPaused: true,
      waitingToResumeUntil: null,
    })
  }
}

// ---------------------------------------------------------------------------
// Music tab management
// ---------------------------------------------------------------------------

async function clearMusicTab(): Promise<void> {
  stopAllAutomation()
  await setState({
    musicTab: null,
    isPlaying: false,
    manuallyPaused: false,
    waitingToResumeUntil: null,
  })
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
    console.log('[spandan] saved music tab not found on startup, clearing')
    await clearMusicTab()
  }
}

function stopAllAutomation(): void {
  cancelResumeTimer()
  stopPolling()
}

// ---------------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Play/pause orchestration
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1000
let pollTimer: ReturnType<typeof setInterval> | null = null

async function evaluatePlayback(): Promise<void> {
  const [settings, state] = await Promise.all([getSettings(), getState()])

  if (!settings.enabled) {
    stopAllAutomation()
    return
  }

  if (!state.musicTab?.tabId) {
    stopAllAutomation()
    return
  }

  const [audibleTabs, videoStatus] = await Promise.all([
    queryAudibleTabs(),
    queryVideoStatus(state.musicTab.tabId),
  ])

  const nonMusicAudibleTabs = getWhitelistedNonMusicTabs(
    audibleTabs,
    state.musicTab,
    settings.whitelist,
  )

  console.log('[spandan] evaluatePlayback', {
    nonMusic: nonMusicAudibleTabs.map((t) => ({ id: t.id, title: t.title })),
    videoStatus,
    cachedIsPlaying: state.isPlaying,
    manuallyPaused: state.manuallyPaused,
    waitingUntil: state.waitingToResumeUntil,
  })

  if (nonMusicAudibleTabs.length > 0) {
    await handleNonMusicPlaying(settings, state, videoStatus)
  } else {
    await handleSilence(settings, state, videoStatus)
  }

  updatePolling(settings.enabled, state.musicTab)
}

async function handleNonMusicPlaying(
  settings: ExtensionSettings,
  state: Awaited<ReturnType<typeof getState>>,
  videoStatus: VideoStatus,
): Promise<void> {
  if (!state.musicTab?.tabId) return

  // Cancel any pending resume and clear the waiting flag.
  cancelResumeTimer()
  if (state.waitingToResumeUntil) {
    await setState({ waitingToResumeUntil: null })
  }

  if (state.manuallyPaused) {
    // Music is paused by the user; don't fight them.
    return
  }

  // Always trust the actual video element over the cached state.
  if (videoStatus.isPlaying) {
    const ok = await sendCommand(state.musicTab.tabId, 'FADE_OUT_PAUSE', {
      durationMs: settings.fadeDurationMs,
    })
    if (ok) {
      await setState({ isPlaying: false })
    }
  }
}

async function handleSilence(
  settings: ExtensionSettings,
  state: Awaited<ReturnType<typeof getState>>,
  videoStatus: VideoStatus,
): Promise<void> {
  if (!state.musicTab?.tabId) return

  if (state.manuallyPaused) {
    return
  }

  // If the video is already playing, nothing to do.
  if (videoStatus.isPlaying) {
    if (!state.isPlaying) {
      await setState({ isPlaying: true })
    }
    return
  }

  // If we were waiting and the timer should have fired while the worker was
  // away, resume immediately rather than starting a new delay.
  if (state.waitingToResumeUntil) {
    if (state.waitingToResumeUntil > Date.now()) {
      return
    }

    console.log('[spandan] resume timer expired while worker was inactive')
    await setState({ waitingToResumeUntil: null })
    const ok = await sendCommand(state.musicTab.tabId, 'FADE_IN_PLAY', {
      durationMs: settings.fadeDurationMs,
    })
    if (ok) {
      await setState({ isPlaying: true })
    }
    return
  }

  // Start the resume delay timer.
  const resumeAt = Date.now() + settings.resumeDelayMs
  await setState({ waitingToResumeUntil: resumeAt })

  scheduleResumeTimer(async () => {
    await setState({ waitingToResumeUntil: null })

    const currentSettings = await getSettings()
    const currentState = await getState()

    if (
      !currentSettings.enabled ||
      !currentState.musicTab?.tabId ||
      currentState.manuallyPaused
    ) {
      return
    }

    const currentVideoStatus = await queryVideoStatus(currentState.musicTab.tabId)
    if (!currentVideoStatus.isPlaying) {
      const ok = await sendCommand(
        currentState.musicTab.tabId,
        'FADE_IN_PLAY',
        {
          durationMs: currentSettings.fadeDurationMs,
        },
      )
      if (ok) {
        await setState({ isPlaying: true })
      }
    }

    await evaluatePlayback()
  }, settings.resumeDelayMs)
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
    evaluatePlayback().catch(() => {})
  }, POLL_INTERVAL_MS)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ---------------------------------------------------------------------------
// Messaging helpers
// ---------------------------------------------------------------------------

async function sendCommand(
  tabId: number,
  command: 'PLAY' | 'PAUSE' | 'FADE_IN_PLAY' | 'FADE_OUT_PAUSE' | 'GET_VIDEO_STATUS',
  payload?: unknown,
): Promise<boolean> {
  const message = payload === undefined
    ? { type: command }
    : { type: command, payload }

  console.log(`[spandan] sendCommand START ${command} -> tab ${tabId}`, payload)

  try {
    const response = (await chrome.tabs.sendMessage(tabId, message)) as ExtensionResponse
    console.log(`[spandan] sendCommand RESPONSE ${command} -> tab ${tabId}:`, response)

    if (response?.ok) {
      console.log(`[spandan] ${command} succeeded on tab ${tabId}`)
      return true
    }

    console.warn(`[spandan] ${command} rejected on tab ${tabId}:`, response?.payload)
  } catch (error) {
    console.warn(`[spandan] sendCommand ERROR ${command} -> tab ${tabId}:`, error)
  }

  console.log(`[spandan] sendCommand RETRY ${command} -> tab ${tabId} in 500ms`)
  await delay(500)

  try {
    const retryResponse = (await chrome.tabs.sendMessage(tabId, message)) as ExtensionResponse
    console.log(`[spandan] sendCommand RETRY RESPONSE ${command} -> tab ${tabId}:`, retryResponse)

    if (retryResponse?.ok) {
      console.log(`[spandan] ${command} retry succeeded on tab ${tabId}`)
      return true
    }

    console.warn(`[spandan] ${command} retry rejected on tab ${tabId}:`, retryResponse?.payload)
  } catch (retryError) {
    console.warn(`[spandan] ${command} retry failed on tab ${tabId}`, retryError)
  }

  console.log(`[spandan] sendCommand FAILED ${command} -> tab ${tabId}`)
  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
