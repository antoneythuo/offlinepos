import React, { useState, useEffect, useRef } from 'react'

/**
 * ConnectionStatusIndicator — polls `db:ping` every 10 seconds and renders a
 * coloured dot with a tooltip indicating the current database connection state.
 *
 * - Green dot  → database is reachable
 * - Red dot    → database is unreachable or the ping failed
 *
 * The first poll fires immediately on mount so the indicator is never in an
 * unknown state for more than a moment.
 *
 * Requirements: 32.2
 */

const POLL_INTERVAL_MS = 10_000

type ConnectionState = 'connected' | 'disconnected' | 'unknown'

function useDbConnectionStatus(): ConnectionState {
  const [status, setStatus] = useState<ConnectionState>('unknown')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = async (): Promise<void> => {
    try {
      if (!window.api) {
        setStatus('disconnected')
        return
      }
      const result = await window.api.invoke<{ success: boolean; data?: { ok: boolean } }>(
        'db:ping'
      )
      // The IPC envelope wraps the response in { success, data }
      const ok =
        result &&
        typeof result === 'object' &&
        'success' in result
          ? (result as { success: boolean; data?: { ok: boolean } }).success &&
            (result as { success: boolean; data?: { ok: boolean } }).data?.ok === true
          : false
      setStatus(ok ? 'connected' : 'disconnected')
    } catch {
      setStatus('disconnected')
    }
  }

  useEffect(() => {
    // Fire immediately on mount
    void poll()

    intervalRef.current = setInterval(() => {
      void poll()
    }, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return status
}

export function ConnectionStatusIndicator(): React.ReactElement {
  const status = useDbConnectionStatus()

  const isConnected = status === 'connected'
  const isUnknown = status === 'unknown'

  const dotColor = isUnknown
    ? 'bg-gray-400 dark:bg-gray-500'
    : isConnected
      ? 'bg-green-500'
      : 'bg-red-500'

  const label = isUnknown
    ? 'Checking database connection…'
    : isConnected
      ? 'Database connected'
      : 'Database disconnected'

  return (
    <div
      className="flex items-center gap-1.5 select-none"
      title={label}
      aria-label={label}
      role="status"
    >
      {/* Pulsing ring for connected state to draw attention when first connected */}
      <span className="relative flex h-3 w-3">
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
        )}
        <span
          className={[
            'relative inline-flex rounded-full h-3 w-3',
            dotColor,
          ].join(' ')}
        />
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
        {isUnknown ? 'DB…' : isConnected ? 'DB' : 'DB'}
      </span>
    </div>
  )
}

export default ConnectionStatusIndicator
