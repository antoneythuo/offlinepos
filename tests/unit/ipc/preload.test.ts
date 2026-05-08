/**
 * Unit tests for the IPC infrastructure introduced in Task 4:
 *
 *  1. Preload API shape  — invoke, on, off are functions
 *  2. apiCall            — unwraps a successful IpcResult<T>
 *  3. apiCall            — throws on a failed IpcResult
 *
 * The tests run in Vitest's Node environment, so `window` and Electron APIs
 * are not available.  We test the logic directly by:
 *   - Verifying the shape of the contextBridge object that preload.ts would
 *     expose (by constructing an equivalent object inline).
 *   - Importing and exercising `apiCall` after injecting a mock `window.api`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { IpcResult } from '../../../src/types/index'

// ─── 1. Preload API shape ─────────────────────────────────────────────────────
//
// We cannot import preload.ts directly (it calls contextBridge at module
// scope, which requires Electron).  Instead we verify the shape of the object
// that would be passed to exposeInMainWorld — this mirrors the actual
// implementation in electron/preload.ts.

describe('preload contextBridge API shape', () => {
  // Construct the same object that preload.ts passes to exposeInMainWorld.
  const mockIpcRenderer = {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  }

  const api = {
    invoke: <T>(channel: string, payload?: unknown): Promise<T> => {
      return mockIpcRenderer.invoke(channel, payload)
    },
    on: (channel: string, callback: (...args: unknown[]) => void): void => {
      mockIpcRenderer.on(channel, (_event: unknown, ...args: unknown[]) => callback(...args))
    },
    off: (channel: string, callback: (...args: unknown[]) => void): void => {
      mockIpcRenderer.removeListener(channel, callback)
    },
  }

  it('exposes an invoke function', () => {
    expect(typeof api.invoke).toBe('function')
  })

  it('exposes an on function', () => {
    expect(typeof api.on).toBe('function')
  })

  it('exposes an off function', () => {
    expect(typeof api.off).toBe('function')
  })

  it('invoke delegates to ipcRenderer.invoke with channel and payload', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true, data: 42 })
    await api.invoke('test:channel', { foo: 'bar' })
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('test:channel', { foo: 'bar' })
  })

  it('on registers a listener via ipcRenderer.on', () => {
    const cb = vi.fn()
    api.on('session:expired', cb)
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('session:expired', expect.any(Function))
  })

  it('off removes a listener via ipcRenderer.removeListener', () => {
    const cb = vi.fn()
    api.off('session:expired', cb)
    expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('session:expired', cb)
  })
})

// ─── 2 & 3. apiCall — IpcResult unwrapping ───────────────────────────────────
//
// apiCall lives in renderer/src/hooks/useApi.ts and calls window.api.invoke.
// We inject a mock window.api before each test and restore it after.

describe('apiCall', () => {
  // We need to set up window.api in the Node test environment.
  // Vitest runs in Node, so `globalThis.window` is undefined by default.
  // We attach a mock directly to globalThis.

  let originalWindow: typeof globalThis.window

  beforeEach(() => {
    // Save whatever was there (likely undefined in Node)
    originalWindow = (globalThis as unknown as { window: typeof globalThis.window }).window
  })

  afterEach(() => {
    // Restore
    ;(globalThis as unknown as { window: typeof globalThis.window }).window = originalWindow
  })

  function setWindowApi(invoke: (channel: string, payload?: unknown) => Promise<unknown>) {
    ;(globalThis as unknown as { window: { api: { invoke: typeof invoke } } }).window = {
      api: { invoke },
    }
  }

  it('returns the unwrapped data when IpcResult.success is true', async () => {
    const successResult: IpcResult<{ id: number }> = { success: true, data: { id: 99 } }
    setWindowApi(async () => successResult)

    // Dynamic import so window mock is in place before the module resolves
    const { apiCall } = await import('../../../renderer/src/hooks/useApi')
    const result = await apiCall<{ id: number }>('some:channel')

    expect(result).toEqual({ id: 99 })
  })

  it('throws an Error with the server message when IpcResult.success is false', async () => {
    const errorResult: IpcResult<never> = {
      success: false,
      error: 'Not authorised',
      code: 'AUTH_FAILED',
    }
    setWindowApi(async () => errorResult)

    const { apiCall } = await import('../../../renderer/src/hooks/useApi')

    await expect(apiCall('some:channel')).rejects.toThrow('Not authorised')
  })

  it('attaches the error code to the thrown Error', async () => {
    const errorResult: IpcResult<never> = {
      success: false,
      error: 'Not authorised',
      code: 'AUTH_FAILED',
    }
    setWindowApi(async () => errorResult)

    const { apiCall } = await import('../../../renderer/src/hooks/useApi')

    let caught: (Error & { code?: string }) | null = null
    try {
      await apiCall('some:channel')
    } catch (err) {
      caught = err as Error & { code?: string }
    }

    expect(caught).not.toBeNull()
    expect(caught?.code).toBe('AUTH_FAILED')
  })

  it('forwards the payload to window.api.invoke', async () => {
    const invokeMock = vi.fn().mockResolvedValue({ success: true, data: null })
    setWindowApi(invokeMock)

    const { apiCall } = await import('../../../renderer/src/hooks/useApi')
    await apiCall('auth:login', { username: 'admin', pin: '1234' })

    expect(invokeMock).toHaveBeenCalledWith('auth:login', { username: 'admin', pin: '1234' })
  })
})
