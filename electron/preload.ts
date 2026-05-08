import { contextBridge, ipcRenderer } from 'electron'

/**
 * Expose a typed API to the renderer process via contextBridge.
 * The renderer accesses this as `window.api`.
 *
 * Security: only whitelisted methods are exposed — the renderer never
 * gets a reference to ipcRenderer itself.
 */
contextBridge.exposeInMainWorld('api', {
  /**
   * Invoke an IPC channel and receive a typed result.
   * All channels return `IpcResult<T>` envelopes from the main process.
   */
  invoke: <T>(channel: string, payload?: unknown): Promise<T> => {
    return ipcRenderer.invoke(channel, payload)
  },

  /**
   * Subscribe to events pushed from the main process to the renderer
   * (e.g. `session:expired`).
   */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },

  /**
   * Remove a specific listener previously registered with `on`.
   */
  off: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, callback)
  },
})
