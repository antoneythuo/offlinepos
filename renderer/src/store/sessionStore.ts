import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SessionUser } from '../../../src/types'

interface SessionState {
  currentUser: SessionUser | null
  lastActivity: number

  // Actions
  setUser: (user: SessionUser) => void
  clearUser: () => void
  updateActivity: () => void
  hasPermission: (permission: string) => boolean
}

/**
 * Session store — manages the currently authenticated user.
 * Persisted to sessionStorage so it survives renderer reloads but not app restarts.
 * Requirement 22.5: user must authenticate before accessing the system
 * Requirement 22.7: session timeout returns to login screen
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      lastActivity: Date.now(),

      setUser: (user) =>
        set({
          currentUser: user,
          lastActivity: Date.now()
        }),

      clearUser: () =>
        set({
          currentUser: null,
          lastActivity: Date.now()
        }),

      updateActivity: () => set({ lastActivity: Date.now() }),

      hasPermission: (permission) => {
        const { currentUser } = get()
        if (!currentUser) return false
        return currentUser.permissions[permission] === true
      }
    }),
    {
      name: 'pos-session',
      storage: {
        getItem: (name) => {
          const value = sessionStorage.getItem(name)
          return value ? JSON.parse(value) : null
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => sessionStorage.removeItem(name)
      }
    }
  )
)
