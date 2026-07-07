import type { ExtensionResponse, VideoStatus } from '@/types'

/**
 * Query the actual playback state of the video element(s) in a tab.
 *
 * Uses chrome.scripting.executeScript as the primary mechanism because it works
 * even when the content script has not finished injecting yet. Falls back to
 * the content script message channel if executeScript is unavailable.
 */
export async function queryVideoStatus(tabId: number): Promise<VideoStatus> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const videos = Array.from(document.querySelectorAll('video'))
        const isPlaying = videos.some((video) => !video.paused)
        const isMuted = videos.every(
          (video) => video.muted || video.volume === 0 || video.paused,
        )
        return { isPlaying, isMuted }
      },
    })

    const status = result?.result as VideoStatus | undefined
    if (status) {
      console.log('[spandan] queryVideoStatus via executeScript', status)
      return status
    }
  } catch (error) {
    console.warn(
      '[spandan] executeScript failed, falling back to message',
      error,
    )
  }

  // Fall back to the content script message channel.
  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      type: 'GET_VIDEO_STATUS',
    })) as ExtensionResponse
    const status = response.ok
      ? (response.payload as VideoStatus | undefined)
      : undefined
    if (status) {
      console.log('[spandan] queryVideoStatus via message', status)
      return status
    }
  } catch (error) {
    console.warn('[spandan] message query failed', error)
  }

  // Final fallback: assume paused but not manually paused.
  console.log('[spandan] queryVideoStatus fallback: paused')
  return { isPlaying: false, isMuted: false }
}
