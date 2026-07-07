/**
 * Resume-delay timer manager.
 *
 * The service worker can be terminated by the browser at any time, so timers
 * are kept in-memory only. If the worker is killed, the next audible event or
 * poll will re-trigger evaluation and restart the timer if needed.
 */

export type TimerCallback = () => void

let resumeTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Schedule a one-shot callback after the given delay.
 *
 * Cancels any previously scheduled resume timer.
 */
export function scheduleResumeTimer(
  callback: TimerCallback,
  delayMs: number,
): void {
  cancelResumeTimer()
  resumeTimer = setTimeout(() => {
    resumeTimer = null
    callback()
  }, delayMs)
}

/**
 * Cancel any pending resume timer.
 */
export function cancelResumeTimer(): void {
  if (resumeTimer) {
    clearTimeout(resumeTimer)
    resumeTimer = null
  }
}

/**
 * Returns true if a resume timer is currently active.
 */
export function hasResumeTimer(): boolean {
  return resumeTimer !== null
}
