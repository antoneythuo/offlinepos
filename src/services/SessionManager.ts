import type { SessionUser } from '../types/index'

/**
 * SessionManager — in-memory singleton that holds the currently authenticated
 * user for the Electron main process.
 *
 * IPC handlers call `SessionManager.getSession()` to read the active user and
 * `SessionManager.setSession()` / `clearSession()` when the user logs in or out.
 *
 * This is intentionally a plain singleton (not a class instance) so that all
 * modules share the same reference without dependency injection.
 */
class SessionManager {
  private currentSession: SessionUser | null = null

  /**
   * Store the authenticated user as the active session.
   */
  setSession(user: SessionUser): void {
    this.currentSession = user
  }

  /**
   * Return the currently active session, or `null` if no user is logged in.
   */
  getSession(): SessionUser | null {
    return this.currentSession
  }

  /**
   * Clear the active session (called on logout or session timeout).
   */
  clearSession(): void {
    this.currentSession = null
  }
}

// Export a single shared instance for the entire main process.
export const sessionManager = new SessionManager()

// Also export the class for testing purposes (allows creating isolated instances).
export { SessionManager }
