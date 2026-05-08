import React, { useEffect } from 'react'
import { useThemeStore } from '../../store/themeStore'

interface ThemeProviderProps {
  children: React.ReactNode
}

/**
 * ThemeProvider — synchronises the Zustand theme state with the `dark` class
 * on the `<html>` element so TailwindCSS's `darkMode: 'class'` strategy works.
 *
 * This component wraps the entire app and re-runs the effect whenever the
 * theme changes, applying the new class immediately without a page reload.
 *
 * Requirements:
 *   30.1 — dark/light mode switchable from settings
 *   30.5 — theme change applies immediately without requiring a restart
 */
function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  const { theme } = useThemeStore()

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [theme])

  return <>{children}</>
}

export default ThemeProvider
