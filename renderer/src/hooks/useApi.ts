import { useCallback } from 'react'
import type { IpcResult } from '../../../src/types/index'

/**
 * apiCall — calls `window.api.invoke`, unwraps the `IpcResult<T>` envelope
 * returned by the main process, and throws a typed `Error` when the
 * operation failed.
 *
 * This is the low-level primitive used by `useApiCall` and can also be
 * called directly in non-hook contexts (e.g. React Query `queryFn`).
 *
 * @param channel  IPC channel name (e.g. `'auth:login'`)
 * @param payload  Optional payload forwarded to the main-process handler
 * @returns        The unwrapped `data` value on success
 * @throws         `Error` with the server-provided message on failure
 */
export async function apiCall<T>(channel: string, payload?: unknown): Promise<T> {
  const result = await window.api.invoke<IpcResult<T>>(channel, payload)

  if (!result.success) {
    const err = new Error(result.error) as Error & { code: string }
    err.code = result.code
    throw err
  }

  return result.data
}

/**
 * useApiCall — React hook that returns a stable `apiCall` reference.
 *
 * Wrap your React Query `queryFn` / `mutationFn` with this hook so that
 * IPC errors surface as thrown exceptions that React Query can catch and
 * expose via `error` state.
 *
 * @example
 * ```tsx
 * const call = useApiCall()
 *
 * const { data } = useQuery({
 *   queryKey: ['auth:session'],
 *   queryFn: () => call<SessionUser>('auth:session'),
 * })
 *
 * const mutation = useMutation({
 *   mutationFn: (payload: LoginPayload) => call<SessionUser>('auth:login', payload),
 * })
 * ```
 */
export function useApiCall() {
  return useCallback(
    <T>(channel: string, payload?: unknown): Promise<T> => apiCall<T>(channel, payload),
    []
  )
}
