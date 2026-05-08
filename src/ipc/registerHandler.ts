import { ipcMain } from 'electron'
import type { IpcResult } from '../types/index'

/**
 * registerHandler — wraps an IPC handler in the standard `IpcResult<T>` envelope.
 *
 * On success the handler's resolved value is returned as:
 *   `{ success: true, data: T }`
 *
 * On any thrown error the envelope is:
 *   `{ success: false, error: string, code: string }`
 *
 * The `code` field is taken from the error's own `.code` property when present
 * (e.g. `AuthenticationError.code === 'AUTH_FAILED'`), otherwise it falls back
 * to `'INTERNAL_ERROR'`.
 *
 * @param channel  The IPC channel name (e.g. `'auth:login'`).
 * @param handler  An async function that receives the raw payload and returns T.
 */
export function registerHandler<T>(
  channel: string,
  handler: (payload: unknown) => Promise<T>
): void {
  ipcMain.handle(channel, async (_event, payload: unknown): Promise<IpcResult<T>> => {
    try {
      const data = await handler(payload)
      return { success: true, data }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred'
      const code =
        (err as { code?: string }).code ?? 'INTERNAL_ERROR'
      return { success: false, error: message, code }
    }
  })
}
