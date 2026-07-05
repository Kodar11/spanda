import type { ExtensionMessage, ExtensionResponse } from '@/types'

/**
 * Content script injected into every page matched by manifest.json.
 *
 * On YouTube pages it controls the HTML5 <video> element(s) and responds to
 * PLAY/PAUSE/GET_VIDEO_STATUS commands from the background service worker.
 * Using the existing <video> element(s) means playback resumes from the exact
 * timestamp where it was paused.
 *
 * Phase 3 will add fade in/out by animating video.volume before and after
 * these commands.
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

function getVideoStatus(videos: HTMLVideoElement[]): { isPlaying: boolean } {
  return { isPlaying: videos.some((video) => !video.paused) }
}

if (isYouTubePage()) {
  console.log('[spanda] content script active on YouTube', window.location.href)

  // Notify the background worker that this tab has a fresh content script.
  // The worker will re-evaluate playback and send PLAY/PAUSE if needed.
  chrome.runtime
    .sendMessage({ type: 'CONTENT_READY' })
    .catch(() => {
      // The service worker may be temporarily unavailable; the next audible
      // event will trigger a re-evaluation anyway.
    })
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: ExtensionResponse) => void,
  ) => {
    console.log('[spanda] CONTENT MESSAGE RECEIVED', message)

    if (!isYouTubePage()) {
      console.log('[spanda] ignoring message, not a YouTube page')
      sendResponse({ ok: false, payload: 'not a YouTube page' })
      return true
    }

    const videos = getVideoElements()
    console.log('[spanda] videos found', videos.length)

    if (videos.length === 0) {
      console.log('[spanda] no video element found')
      sendResponse({ ok: false, payload: 'video element not ready' })
      return true
    }

    switch (message.type) {
      case 'PLAY': {
        console.log('[spanda] PLAY requested for', videos.length, 'video(s)')
        console.log(
          '[spanda] before PLAY, isPlaying =',
          getVideoStatus(videos).isPlaying,
        )
        Promise.all(videos.map((video) => video.play().catch(() => {})))
          .then(() => {
            const status = getVideoStatus(videos)
            console.log('[spanda] after PLAY, isPlaying =', status.isPlaying)
            sendResponse({ ok: true, payload: status })
          })
          .catch((error: unknown) =>
            sendResponse({ ok: false, payload: String(error) }),
          )
        return true
      }

      case 'PAUSE': {
        console.log('[spanda] PAUSE requested for', videos.length, 'video(s)')
        console.log(
          '[spanda] before PAUSE, paused =',
          videos.map((v) => v.paused),
        )
        videos.forEach((video) => video.pause())
        const status = getVideoStatus(videos)
        console.log('[spanda] after PAUSE, paused =', videos.map((v) => v.paused))
        console.log('[spanda] after PAUSE, isPlaying =', status.isPlaying)
        sendResponse({ ok: true, payload: status })
        return true
      }

      case 'GET_VIDEO_STATUS': {
        const status = getVideoStatus(videos)
        console.log('[spanda] GET_VIDEO_STATUS', status)
        sendResponse({ ok: true, payload: status })
        return true
      }

      default:
        console.log('[spanda] unknown message type', message.type)
        sendResponse({ ok: false, payload: 'unknown message type' })
        return true
    }
  },
)
