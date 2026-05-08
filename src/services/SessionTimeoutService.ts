import type { SessionManager } from './SessionManager'

// ─── Injectable timer functions (for testability) ─────────────────────────────

export interface TimerFunctions {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeout: (id: ReturnType<typeof setTimeout> | undefined) => void
}

const defaultTimers: TimerFunctions = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
}

// ─── SessionTimeoutService ────────────────────────────────────────────────────

/**
 * Manages an idle-timeout timer for the active user session.
 *
 * Usage:
 *   1. Call `start(idleMinutes, onExpired)` after a successful login.
 *   2. Call `resetTimer()` on every user activity event (key press, mouse move, IPC call).
 *   3. Call `stop()` on explicit logout.
 *
 * The `onExpired` callback is responsible for clearing the session and notifying
 * the renderer. In production this callback:
 *   - calls `sessionManager.clearSession()`
 *   - calls `BrowserWindow.getAllWindows()[0].webContents.send('session:expired')`
 *
 * Accepting `onExpired` as a callback (rather than importing BrowserWindow directly)
 * keeps this service free of Electron dependencies and fully unit-testable.
 */
export class SessionTimeoutService {
  private timerId: ReturnType<typeof setTimeout> | undefined = undefined
  private idleMs: number = 0
  private onExpired: (() => void) | null = null
  private readonly timers: TimerFunctions

  /**
   * @param timers  Optional timer functions injected for testing.
   *                Defaults to the real `setTimeout` / `clearTimeout`.
   */
  constructor(timers: TimerFunctions = defaultTimers) {
    this.timers = timers
  }

  /**
   * Start the idle timer.
   *
   * If a timer is already running it is cancelled and restarted with the new
   * parameters. This allows reconfiguring the timeout without an explicit stop.
   *
   * @param idleMinutes  Number of idle minutes before the session expires.
   *                     Must be a positive number.
   * @param onExpired    Callback invoked when the idle period elapses.
   */
  start(idleMinutes: number, onExpired: () => void): void {
    this.stop()
    this.idleMs = idleMinutes * 60 * 1000
    this.onExpired = onExpired
    this.scheduleTimer()
  }

  /**
   * Reset the idle countdown.
   *
   * Call this whenever the user performs any activity (key press, mouse move,
   * IPC invocation, etc.) to push the expiry deadline forward.
   *
   * Has no effect if the timer has not been started.
   */
  resetTimer(): void {
    if (this.onExpired === null) return
    this.timers.clearTimeout(this.timerId)
    this.scheduleTimer()
  }

  /**
   * Stop the idle timer and clear all internal state.
   *
   * Call this on explicit logout so the timer does not fire after the user
   * has already been logged out.
   */
  stop(): void {
    this.timers.clearTimeout(this.timerId)
    this.timerId = undefined
    this.idleMs = 0
    this.onExpired = null
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private scheduleTimer(): void {
    this.timerId = this.timers.setTimeout(() => {
      if (this.onExpired) {
        this.onExpired()
      }
      // Clear internal state after expiry so the service is in a clean state.
      this.timerId = undefined
      this.onExpired = null
    }, this.idleMs)
  }
}

// ─── Factory helper for production use ───────────────────────────────────────

/**
 * Build the `onExpired` callback used in the Electron main process.
 *
 * Importing `BrowserWindow` here (rather than inside `SessionTimeoutService`)
 * keeps the service itself free of Electron dependencies.
 *
 * @param sm  The shared `SessionManager` singleton.
 * @param sendEvent  Optional override for the IPC send call (injected in tests).
 *                   Defaults to `BrowserWindow.getAllWindows()[0]?.webContents.send(...)`.
 */
export function buildOnExpiredCallback(
  sm: SessionManager,
  sendEvent?: (channel: string) => void
): () => void {
  return () => {
    sm.clearSession()

    if (sendEvent) {
      sendEvent('session:expired')
    } else {
      // Lazy-require BrowserWindow so this module can be imported in tests
      // without Electron being present.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { BrowserWindow } = require('electron') as typeof import('electron')
      const win = BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('session:expired')
      }
    }
  }
}

// ─── Shared singleton ─────────────────────────────────────────────────────────

export const sessionTimeoutService = new SessionTimeoutService()
