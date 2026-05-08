import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../../store/sessionStore'
import { useThemeStore } from '../../store/themeStore'
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator'

// ─── SVG Icon Components ─────────────────────────────────────────────────────

function IconSales(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function IconInventory(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function IconCustomers(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconCredit(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function IconReports(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconExpenses(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function IconSettings(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconLogout(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconSun(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function IconMoon(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// ─── Navigation items definition ─────────────────────────────────────────────

interface NavItem {
  label: string
  path: string
  icon: React.ReactElement
  /** Permission key required to see this item. Undefined = visible to all authenticated users. */
  permission?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Sales',      path: '/sales',           icon: <IconSales /> },
  { label: 'Inventory',  path: '/inventory',        icon: <IconInventory />,  permission: 'inventory_view' },
  { label: 'Customers',  path: '/customers',        icon: <IconCustomers />,  permission: 'customers' },
  { label: 'Credit',     path: '/credit',           icon: <IconCredit />,     permission: 'credit_view' },
  { label: 'Reports',    path: '/reports',          icon: <IconReports />,    permission: 'reports' },
  { label: 'Z Report',   path: '/reports/zreport',  icon: <IconReports />,    permission: 'reports' },
  { label: 'Expenses',   path: '/expenses',         icon: <IconExpenses />,   permission: 'expenses' },
  { label: 'Settings',   path: '/settings',         icon: <IconSettings />,   permission: 'settings' },
]

// ─── Live clock hook ──────────────────────────────────────────────────────────

function useClock(): string {
  const [time, setTime] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return time
}

// ─── AppShell component ───────────────────────────────────────────────────────

/**
 * AppShell — the main authenticated layout.
 *
 * Renders a fixed sidebar with permission-filtered navigation links and a top
 * bar showing the current user's full name, role, a live clock, a theme toggle,
 * and a logout button. Page content is rendered via <Outlet />.
 *
 * Requirements:
 *   22.3 — hide nav items the user lacks permission for
 *   22.4 — access denied redirect (handled by PermissionGuard on routes)
 *   22.7 — logout clears session and returns to login
 *   30.1 — dark/light mode support
 *   30.2 — renders correctly at 1024px+
 *   30.5 — theme change applies immediately
 */
function AppShell(): React.ReactElement {
  const { currentUser, clearUser, hasPermission } = useSessionStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const clock = useClock()

  const handleLogout = async () => {
    try {
      if (window.api) {
        await window.api.invoke('auth:logout', {})
      }
    } catch {
      // Proceed with client-side logout even if IPC fails
    } finally {
      clearUser()
      navigate('/login', { replace: true })
    }
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="flex flex-col w-56 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        {/* Logo / brand */}
        <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <span className="text-lg font-bold text-primary-600 dark:text-primary-400 tracking-tight">
            POS System
          </span>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                  'min-h-[44px]',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
                ].join(' ')
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer — user info */}
        <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {currentUser?.fullName ?? '—'}
          </div>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
            {currentUser?.roleName ?? '—'}
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between h-16 px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
          {/* Left: user info */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                {currentUser?.fullName ?? '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                {currentUser?.roleName ?? '—'}
              </p>
            </div>
          </div>

          {/* Right: clock, connection status, theme toggle, logout */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-gray-600 dark:text-gray-300 tabular-nums select-none">
              {clock}
            </span>

            {/* DB connection status — Req 32.2 */}
            <ConnectionStatusIndicator />

            {/* Theme toggle — Req 30.1, 30.5 */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-150"
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>

            {/* Logout — Req 22.7 */}
            <button
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="flex items-center gap-2 px-3 h-11 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150"
            >
              <IconLogout />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppShell
