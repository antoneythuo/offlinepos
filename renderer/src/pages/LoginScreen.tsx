import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/sessionStore'
import type { SessionUser, IpcResult } from '../../../src/types'

/**
 * LoginScreen — authenticates the user via username + PIN.
 *
 * Flow:
 *   1. User enters username and PIN.
 *   2. On submit, calls `window.api.invoke('auth:login', { username, pin })`.
 *   3. On success, stores the returned SessionUser in Zustand sessionStore
 *      and navigates to /sales.
 *   4. On error, displays the error message returned by the IPC handler.
 *
 * Requirements:
 *   22.5 — require authentication before accessing the system
 *   22.6 — login event written to audit_log (handled by auth.ipc.ts)
 *   30.1 — dark/light mode support
 *   30.3 — minimum 44×44px touch targets
 */
function LoginScreen(): React.ReactElement {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { setUser } = useSessionStore()
  const navigate = useNavigate()
  const pinRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username.trim()) {
      setError('Please enter your username.')
      return
    }
    if (!pin.trim()) {
      setError('Please enter your PIN.')
      pinRef.current?.focus()
      return
    }

    setLoading(true)
    try {
      const result = await window.api.invoke<IpcResult<SessionUser>>('auth:login', {
        username: username.trim(),
        pin,
      })

      if (result.success) {
        setUser(result.data)
        navigate('/sales', { replace: true })
      } else {
        setError(result.error ?? 'Login failed. Please check your credentials.')
        setPin('')
        pinRef.current?.focus()
      }
    } catch {
      setError('Unable to connect to the authentication service. Please restart the application.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            POS System
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Sign in to continue
          </p>
        </div>

        {/* Card */}
        <div className="card">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    pinRef.current?.focus()
                  }
                }}
                disabled={loading}
                placeholder="Enter your username"
                className="input"
              />
            </div>

            {/* PIN */}
            <div>
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                PIN
              </label>
              <input
                id="pin"
                ref={pinRef}
                type="password"
                autoComplete="current-password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={loading}
                placeholder="Enter your PIN"
                className="input tracking-widest"
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 mt-0.5 shrink-0 text-red-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-600">
          Offline POS System — all data stored locally
        </p>
      </div>
    </div>
  )
}

export default LoginScreen
