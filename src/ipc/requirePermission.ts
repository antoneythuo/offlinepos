import { sessionManager } from '../services/SessionManager'
import { AuthorizationError } from '../errors'

/**
 * requireAuth — asserts that a session is currently active.
 *
 * Throws `AuthorizationError` if no user is logged in.
 * Use this as a lightweight guard for any IPC handler that requires
 * authentication but does not need a specific permission check.
 *
 * @throws {AuthorizationError} when no session is active
 */
export function requireAuth(): void {
  const session = sessionManager.getSession()
  if (!session) {
    throw new AuthorizationError('No active session. Please log in.')
  }
}

/**
 * requirePermission — asserts that the active session has the given permission.
 *
 * Steps:
 *  1. Read the active session from `SessionManager`.
 *  2. Throw `AuthorizationError` if there is no active session.
 *  3. Throw `AuthorizationError` if the session's `permissions` object does
 *     not contain the requested permission key set to `true`.
 *
 * @param permission  The permission key to check (e.g. `"reports"`, `"inventory"`).
 * @throws {AuthorizationError} when no session is active or the permission is absent.
 *
 * @example
 * // Inside an IPC handler:
 * ipcMain.handle('reports:daily', async (_event, payload) => {
 *   requirePermission('reports')   // throws if user lacks 'reports'
 *   return reportService.dailySales(payload.date)
 * })
 */
export function requirePermission(permission: string): void {
  const session = sessionManager.getSession()

  if (!session) {
    throw new AuthorizationError('No active session. Please log in.')
  }

  if (session.permissions[permission] !== true) {
    throw new AuthorizationError(
      `Access denied. Required permission: "${permission}"`
    )
  }
}
