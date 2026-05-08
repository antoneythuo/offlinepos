import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeMode } from '../../../src/types'

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

/**
 * Theme store — manages dark/light mode.
 * Persisted to localStorage so the preference survives app restarts.
 * Requirement 30.1: dark/light mode switchable from settings
 * Requirement 30.5: theme change applies immediately without restart
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',

      setTheme: (theme) => set({ theme }),

      toggleTheme: () => {
        const { theme } = get()
        set({ theme: theme === 'light' ? 'dark' : 'light' })
      }
    }),
    {
      name: 'pos-theme'
    }
  )
)
