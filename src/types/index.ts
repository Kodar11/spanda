/**
 * Shared TypeScript types for the spandan extension.
 *
 * These types are used by the popup, options page, background service worker,
 * and content script so every part of the extension agrees on the shape of
 * persisted settings and runtime state.
 */

/**
 * Information stored about the user's chosen background-music tab.
 *
 * We store URL and title (not just the tab ID) so we can try to re-attach to
 * the same tab after a browser restart, when tab IDs are reset.
 */
export interface MusicTab {
  tabId: number
  url: string
  title: string
}

/**
 * High-level playback status reported to the popup.
 */
export type PlaybackStatus =
  | 'disabled'
  | 'no_music_tab'
  | 'playing'
  | 'paused'
  | 'waiting'
  | 'manual_pause'

/**
 * User-configurable settings persisted in chrome.storage.local.
 */
export interface ExtensionSettings {
  /** Master on/off switch for the extension. */
  enabled: boolean

  /**
   * How long to wait (in milliseconds) before resuming the music tab after the
   * foreground tab stops producing audio. Allowed range: 2000–10000 ms.
   */
  resumeDelayMs: number

  /**
   * How long a fade in/out should last (in milliseconds).
   */
  fadeDurationMs: number

  /**
   * Hostnames that are allowed to pause the music tab (e.g., "youtube.com",
   * "udemy.com"). An empty array means "all websites".
   */
  whitelist: string[]
}

/**
 * Transient runtime state persisted in chrome.storage.local.
 *
 * This is separate from user settings because it changes as the user browses
 * (e.g., which tab is currently designated as the music tab).
 */
export interface ExtensionState {
  /** The tab the user has designated as the background music tab. */
  musicTab: MusicTab | null

  /**
   * Cached playback state used for UI only. The actual video element is the
   * source of truth; this value is updated after successful commands.
   */
  isPlaying: boolean

  /**
   * Set to true when the user manually pauses or mutes the music tab. The
   * extension will not auto-resume until the user manually plays/unmutes.
   */
  manuallyPaused: boolean

  /**
   * Timestamp (ms since epoch) when the music tab is scheduled to resume. Null
   * when no resume timer is active.
   */
  waitingToResumeUntil: number | null
}

/**
 * Aggregate state of the video element(s) reported by the content script.
 */
export interface VideoStatus {
  isPlaying: boolean
  isMuted: boolean
}

/**
 * Message types passed between the extension contexts.
 */
export type ExtensionMessage =
  | { type: 'PING' }
  | { type: 'GET_STATUS' }
  | { type: 'SET_MUSIC_TAB'; payload: MusicTab }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | {
      type: 'FADE_IN_PLAY'
      payload: { durationMs: number }
    }
  | {
      type: 'FADE_OUT_PAUSE'
      payload: { durationMs: number }
    }
  | { type: 'GET_VIDEO_STATUS' }
  | { type: 'CONTENT_READY' }
  | { type: 'USER_PAUSED' }
  | { type: 'USER_PLAYED' }
  | { type: 'USER_MUTED' }
  | { type: 'USER_UNMUTED' }
  | { type: 'USER_STATE_CHANGED'; payload: VideoStatus }

/**
 * Response shape returned by the background service worker and content script
 * for most messages.
 */
export interface ExtensionResponse {
  ok: boolean
  payload?: unknown
}

/**
 * Status payload returned by GET_STATUS.
 */
export interface StatusPayload {
  enabled: boolean
  musicTab: MusicTab | null
  status: PlaybackStatus
  reason: string
  waitingSeconds: number | null
}
