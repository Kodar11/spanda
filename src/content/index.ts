import type {
  ExtensionMessage,
  ExtensionResponse,
  VideoStatus,
} from '@/types'

/**
 * Content script injected into every page matched by manifest.json.
 *
 * On YouTube pages it controls the HTML5 <video> element(s). It supports:
 * - Direct PLAY / PAUSE
 * - FADE_IN_PLAY / FADE_OUT_PAUSE with configurable durations
 * - Detection of user-initiated pause / play / mute events
 *
 * Using the existing <video> element(s) means playback resumes from the exact
 * timestamp where it was paused.
 */

const YOUTUBE_HOSTS = [
  'youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
]

function isYouTubePage(): boolean {
  return YOUTUBE_HOSTS.some((host) => window.location.hostname.includes(host))
}

function getVideoElements(): HTMLVideoElement[] {
  return Array.from(document.querySelectorAll('video'))
}

function getVideoStatus(videos: HTMLVideoElement[]): VideoStatus {
  const isPlaying = videos.some((video) => !video.paused)
  const isMuted = videos.every(
    (video) => video.muted || video.volume === 0 || video.paused,
  )
  return { isPlaying, isMuted }
}

// Flags used to distinguish extension-initiated media changes from user
// actions, so the extension never fights the user.
let extensionPaused = false
let extensionPlayed = false
let extensionFading = false

// Stores each video's volume before a fade-out, so fade-in can restore it.
const originalVolumes = new Map<HTMLVideoElement, number>()

let userStateDebounceTimer: ReturnType<typeof setTimeout> | null = null
const USER_STATE_DEBOUNCE_MS = 100

function notifyBackground(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // The service worker may be temporarily unavailable.
  })
}

function debouncedNotifyUserState(): void {
  if (userStateDebounceTimer) {
    clearTimeout(userStateDebounceTimer)
  }

  userStateDebounceTimer = setTimeout(() => {
    userStateDebounceTimer = null

    // If an extension action started while we were debouncing, skip the
    // notification so we don't report extension-initiated state as user state.
    if (isExtensionInitiated()) {
      console.log('[spandan] skipping user state notification: extension active')
      return
    }

    const videos = getVideoElements()
    const status = getVideoStatus(videos)
    console.log('[spandan] debounced user state', status)
    notifyBackground({ type: 'USER_STATE_CHANGED', payload: status })
  }, USER_STATE_DEBOUNCE_MS)
}

function isExtensionInitiated(): boolean {
  return extensionPaused || extensionPlayed || extensionFading
}

function attachMediaListeners(video: HTMLVideoElement): void {
  if (video.dataset.spandanListenersAttached === 'true') return
  video.dataset.spandanListenersAttached = 'true'

  const handleUserMediaEvent = (): void => {
    if (isExtensionInitiated()) return
    debouncedNotifyUserState()
  }

  video.addEventListener('pause', handleUserMediaEvent)
  video.addEventListener('play', handleUserMediaEvent)
  video.addEventListener('volumechange', handleUserMediaEvent)
}

function observeNewVideos(): void {
  const observer = new MutationObserver(() => {
    getVideoElements().forEach(attachMediaListeners)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

if (isYouTubePage()) {
  console.log('[spandan] content script active on YouTube', window.location.href)

  getVideoElements().forEach(attachMediaListeners)
  observeNewVideos()

  notifyBackground({ type: 'CONTENT_READY' })
}

// ---------------------------------------------------------------------------
// Volume fading
// ---------------------------------------------------------------------------

function fadeVolume(
  video: HTMLVideoElement,
  from: number,
  to: number,
  durationMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    // Use setTimeout instead of requestAnimationFrame so the fade completes
    // even when the tab is in the background (rAF is paused/throttled).
    const STEP_MS = 16
    const MAX_DURATION_MS = durationMs * 1.5 + 500

    function step(): void {
      const elapsed = performance.now() - start
      const progress = Math.min(elapsed / durationMs, 1)
      video.volume = from + (to - from) * progress

      if (progress < 1 && elapsed < MAX_DURATION_MS) {
        setTimeout(step, STEP_MS)
      } else {
        if (progress >= 1) {
          video.volume = to
        }
        resolve()
      }
    }

    setTimeout(step, 0)
  })
}

async function fadeOutAndPause(
  videos: HTMLVideoElement[],
  durationMs: number,
): Promise<void> {
  extensionFading = true
  extensionPaused = true
  console.log('[spandan] fadeOutAndPause start', videos.length, 'video(s)')

  try {
    videos.forEach((video) => {
      originalVolumes.set(video, video.volume)
    })

    await Promise.all(
      videos.map((video) => fadeVolume(video, video.volume, 0, durationMs)),
    )

    videos.forEach((video) => video.pause())
    console.log('[spandan] fadeOutAndPause complete')
  } finally {
    // Restore original volume so a manual resume isn't silent.
    videos.forEach((video) => {
      const target = originalVolumes.get(video)
      if (target !== undefined) {
        video.volume = target
      }
    })

    setTimeout(() => {
      extensionFading = false
      extensionPaused = false
    }, 100)
  }
}

async function fadeInAndPlay(
  videos: HTMLVideoElement[],
  durationMs: number,
): Promise<void> {
  extensionFading = true
  extensionPlayed = true
  console.log('[spandan] fadeInAndPlay start', videos.length, 'video(s)')

  try {
    videos.forEach((video) => {
      const target = originalVolumes.get(video) ?? video.volume
      originalVolumes.set(video, target)
      video.volume = 0
    })

    await Promise.all(videos.map((video) => video.play().catch(() => {})))

    await Promise.all(
      videos.map((video) => {
        const target = originalVolumes.get(video) ?? 1
        return fadeVolume(video, 0, target, durationMs)
      }),
    )
    console.log('[spandan] fadeInAndPlay complete')
  } finally {
    setTimeout(() => {
      extensionFading = false
      extensionPlayed = false
    }, 100)
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: ExtensionResponse) => void,
  ) => {
    console.log('[spandan] CONTENT MESSAGE RECEIVED', {
      location: window.location.href,
      message,
    })

    if (!isYouTubePage()) {
      console.log('[spandan] rejecting message: not a YouTube page', window.location.href)
      sendResponse({ ok: false, payload: 'not a YouTube page' })
      return true
    }

    const videos = getVideoElements()
    videos.forEach(attachMediaListeners)

    console.log('[spandan] videos found', videos.length)

    if (videos.length === 0) {
      sendResponse({ ok: false, payload: 'video element not ready' })
      return true
    }

    switch (message.type) {
      case 'PLAY': {
        console.log('[spandan] PLAY requested for', videos.length, 'video(s)')
        extensionPlayed = true
        Promise.all(videos.map((video) => video.play().catch(() => {})))
          .then(() => {
            const status = getVideoStatus(videos)
            console.log('[spandan] after PLAY, isPlaying =', status.isPlaying)
            sendResponse({ ok: true, payload: status })
          })
          .catch((error: unknown) =>
            sendResponse({ ok: false, payload: String(error) }),
          )
          .finally(() => {
            setTimeout(() => {
              extensionPlayed = false
            }, 50)
          })
        return true
      }

      case 'PAUSE': {
        console.log('[spandan] PAUSE requested for', videos.length, 'video(s)')
        extensionPaused = true
        videos.forEach((video) => video.pause())
        const status = getVideoStatus(videos)
        console.log('[spandan] after PAUSE, isPlaying =', status.isPlaying)
        sendResponse({ ok: true, payload: status })
        setTimeout(() => {
          extensionPaused = false
        }, 50)
        return true
      }

      case 'FADE_OUT_PAUSE': {
        const fadeOutDuration =
          (message.payload as { durationMs: number }).durationMs ?? 500
        console.log(
          '[spandan] FADE_OUT_PAUSE requested, duration =',
          fadeOutDuration,
        )
        fadeOutAndPause(videos, fadeOutDuration)
          .then(() => {
            const status = getVideoStatus(videos)
            console.log('[spandan] after FADE_OUT_PAUSE, isPlaying =', status.isPlaying)
            sendResponse({ ok: true, payload: status })
          })
          .catch((error: unknown) =>
            sendResponse({ ok: false, payload: String(error) }),
          )
        return true
      }

      case 'FADE_IN_PLAY': {
        const fadeInDuration =
          (message.payload as { durationMs: number }).durationMs ?? 500
        console.log(
          '[spandan] FADE_IN_PLAY requested, duration =',
          fadeInDuration,
        )
        fadeInAndPlay(videos, fadeInDuration)
          .then(() => {
            const status = getVideoStatus(videos)
            console.log('[spandan] after FADE_IN_PLAY, isPlaying =', status.isPlaying)
            sendResponse({ ok: true, payload: status })
          })
          .catch((error: unknown) =>
            sendResponse({ ok: false, payload: String(error) }),
          )
        return true
      }

      case 'GET_VIDEO_STATUS': {
        const status = getVideoStatus(videos)
        console.log('[spandan] GET_VIDEO_STATUS', status)
        sendResponse({ ok: true, payload: status })
        return true
      }

      default:
        console.log('[spandan] unknown message type', message.type)
        sendResponse({ ok: false, payload: 'unknown message type' })
        return true
    }
  },
)
