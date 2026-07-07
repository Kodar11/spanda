import type { ExtensionSettings, ExtensionState } from '@/types'

/**
 * Typed chrome.storage.local helper.
 *
 * All settings and runtime state are stored under single keys so the rest of
 * the codebase does not need to know the underlying storage layout.
 *
 * Phase 2 will call these helpers from the popup, options page, and background
 * service worker to read/write settings and the current music tab state.
 */

const SETTINGS_KEY = 'settings'
const STATE_KEY = 'state'

/** Default user settings. */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  resumeDelayMs: 3000,
  fadeDurationMs: 500,
  whitelist: [],
}

/** Default runtime state. */
export const DEFAULT_STATE: ExtensionState = {
  musicTab: null,
  isPlaying: false,
  manuallyPaused: false,
  waitingToResumeUntil: null,
}

/**
 * Read the full settings object, merging with defaults so callers never have to
 * handle undefined values.
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] ?? {}) }
}

/**
 * Merge partial settings into the existing stored object.
 */
export async function setSettings(
  partial: Partial<ExtensionSettings>,
): Promise<void> {
  const current = await getSettings()
  await chrome.storage.local.set({
    [SETTINGS_KEY]: { ...current, ...partial },
  })
}

/**
 * Read the full runtime state object, merging with defaults.
 */
export async function getState(): Promise<ExtensionState> {
  const result = await chrome.storage.local.get(STATE_KEY)
  return { ...DEFAULT_STATE, ...(result[STATE_KEY] ?? {}) }
}

/**
 * Merge partial state into the existing stored object.
 */
export async function setState(partial: Partial<ExtensionState>): Promise<void> {
  const current = await getState()
  await chrome.storage.local.set({ [STATE_KEY]: { ...current, ...partial } })
}
