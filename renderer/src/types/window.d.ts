/**
 * TypeScript ambient declaration for the contextBridge API exposed by
 * electron/preload.ts.  This gives the renderer full type-safety when
 * calling `window.api.*`.
 */
interface Window {
  api: {
    /**
     * Invoke an IPC channel in the main process and receive the unwrapped
     * result.  The main process wraps every response in an `IpcResult<T>`
     * envelope; `apiCall` (see hooks/useApi.ts) unwraps it before returning.
     */
    invoke<T>(channel: string, payload?: unknown): Promise<T>

    /**
     * Subscribe to events pushed from the main process (e.g. `session:expired`).
     */
    on(channel: string, callback: (...args: unknown[]) => void): void

    /**
     * Remove a specific listener previously registered with `on`.
     */
    off(channel: string, callback: (...args: unknown[]) => void): void
  }
}
