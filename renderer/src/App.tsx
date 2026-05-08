import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useSessionStore } from './store/sessionStore'
import ThemeProvider from './components/shared/ThemeProvider'
import AppShell from './components/shared/AppShell'
import PermissionGuard from './components/shared/PermissionGuard'
import AccessDeniedPage from './pages/AccessDeniedPage'
import LoginScreen from './pages/LoginScreen'

// Page stubs — to be fully implemented in Tasks 24–29
import SalesPage from './pages/SalesPage'
import InventoryPage from './pages/InventoryPage'
import CustomersPage from './pages/CustomersPage'
import CreditPage from './pages/CreditPage'
import ReportsPage from './pages/ReportsPage'
import ZReportPage from './pages/ZReportPage'
import ExpensesPage from './pages/ExpensesPage'
import SettingsPage from './pages/SettingsPage'
import AuditLogPage from './pages/AuditLogPage'

/**
 * Root application component.
 *
 * ThemeProvider wraps everything and keeps the `dark` class on <html> in sync
 * with the Zustand themeStore (Req 30.1, 30.5).
 *
 * Routing strategy:
 *   - Unauthenticated users see only the LoginScreen (and /access-denied).
 *   - Authenticated users are wrapped in AppShell which provides the sidebar
 *     and top bar. Page content is rendered via <Outlet />.
 *   - Route-level PermissionGuards redirect to /access-denied for restricted
 *     pages (Req 22.3, 22.4).
 *
 * Permission keys (from roles.permissions JSON):
 *   "reports"   — Manager and Administrator only (Req 22.3)
 *   "inventory" — Stock_Controller, Manager, Administrator (Req 22.3)
 *   "audit"     — Administrator only (Req 22.3, 28.3)
 *   "users"     — Administrator only (Req 22.3)
 */
function App(): React.ReactElement {
  const { currentUser } = useSessionStore()

  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          {currentUser ? (
            // ── Authenticated routes ────────────────────────────────────────
            <Routes>
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/sales" replace />} />
              <Route path="/login" element={<Navigate to="/sales" replace />} />

              {/* Access Denied — always reachable so guards can redirect here */}
              <Route path="/access-denied" element={<AccessDeniedPage />} />

              {/* All authenticated pages share the AppShell layout */}
              <Route element={<AppShell />}>
                {/* ── Open to all authenticated users ── */}
                <Route path="/sales"     element={<SalesPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/credit"    element={<CreditPage />} />
                <Route path="/expenses"  element={<ExpensesPage />} />
                <Route path="/settings"  element={<SettingsPage />} />

                {/* ── Inventory: Stock_Controller, Manager, Administrator (Req 22.3) ── */}
                <Route
                  path="/inventory/*"
                  element={
                    <PermissionGuard permission="inventory">
                      <InventoryPage />
                    </PermissionGuard>
                  }
                />

                {/* ── Reports: Manager and Administrator only (Req 22.3) ── */}
                <Route
                  path="/reports"
                  element={
                    <PermissionGuard permission="reports">
                      <ReportsPage />
                    </PermissionGuard>
                  }
                />
                <Route
                  path="/reports/zreport"
                  element={
                    <PermissionGuard permission="reports">
                      <ZReportPage />
                    </PermissionGuard>
                  }
                />

                {/* ── Audit Log: Administrator only (Req 22.3, 28.3) ── */}
                <Route
                  path="/audit/*"
                  element={
                    <PermissionGuard permission="audit">
                      <AuditLogPage />
                    </PermissionGuard>
                  }
                />

                {/* ── User management: Administrator only (Req 22.3) ── */}
                <Route
                  path="/users/*"
                  element={
                    <PermissionGuard permission="users">
                      <div className="flex items-center justify-center h-full">
                        <p className="text-lg text-gray-500 dark:text-gray-400">
                          User Management — Task 28
                        </p>
                      </div>
                    </PermissionGuard>
                  }
                />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/sales" replace />} />
            </Routes>
          ) : (
            // ── Unauthenticated routes ──────────────────────────────────────
            <Routes>
              <Route path="/access-denied" element={<AccessDeniedPage />} />
              <Route path="/login"         element={<LoginScreen />} />
              {/* Redirect everything else to login */}
              <Route path="*"              element={<Navigate to="/login" replace />} />
            </Routes>
          )}
        </div>
      </Router>
    </ThemeProvider>
  )
}

export default App
