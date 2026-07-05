/**
 * Shared TypeScript types for the spanda extension.
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
 * User-configurable settings persisted in chrome.storage.local.
 *
 * Phase 2 reads `enabled` to decide whether to auto-pause/resume.
 * `resumeDelayMs` and `fadeDurationMs` are wired into storage but intentionally
 * not used yet (they are reserved for Phase 3).
 */
export interface ExtensionSettings {
  /** Master on/off switch for the extension. */
  enabled: boolean

  /**
   * How long to wait (in milliseconds) before resuming the music tab after the
   * foreground tab stops producing audio.
   */
  resumeDelayMs: number

  /**
   * How long a fade in/out should last (in milliseconds).
   * Phase 3 will use this to smoothly adjust media volume.
   */
  fadeDurationMs: number

  /**
   * URL patterns where the extension is allowed to run.
   * An empty array means "all URLs".
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

  /** Whether the music tab is believed to be playing. */
  isPlaying: boolean
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
  | { type: 'GET_VIDEO_STATUS' }
  | { type: 'CONTENT_READY' }

/**
 * Response shape returned by the background service worker and content script
 * for most messages.
 */
export interface ExtensionResponse {
  ok: boolean
  payload?: unknown
}
