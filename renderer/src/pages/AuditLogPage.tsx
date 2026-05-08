// AuditLogPage — Task 29.1
// Requirements: 28.3, 28.4
//
// Administrator-only page showing a filterable audit log table with a
// detail drawer that displays before/after JSON snapshots.
//
// Filters: user ID, action type, date range (from/to)
// Table columns: Timestamp, User ID, Action, Entity Type, Entity ID, IP Address
// Detail drawer: full entry details + pretty-printed before/after JSON
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { AuditLog, IpcResult } from '../../../src/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonthIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

// Common action types for the filter dropdown
const KNOWN_ACTIONS = [
  'login',
  'logout',
  'sale_created',
  'sale_refunded',
  'stock_adjusted',
  'stock_received',
  'credit_created',
  'credit_paid',
  'expense_created',
  'expense_deleted',
  'product_created',
  'product_updated',
  'product_deleted',
  'user_created',
  'user_updated',
  'z_report_generated',
]

// ─── Shared UI classes ────────────────────────────────────────────────────────

const inputCls = `
  min-h-[44px] px-3 py-2 rounded-lg text-sm
  bg-white dark:bg-gray-700
  border border-gray-300 dark:border-gray-600
  text-gray-900 dark:text-gray-100
  placeholder-gray-400 dark:placeholder-gray-500
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
`

// ─── Action badge ─────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }): React.ReactElement {
  const colorMap: Record<string, string> = {
    login:              'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    logout:             'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    sale_created:       'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    sale_refunded:      'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
    stock_adjusted:     'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
    stock_received:     'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
    credit_created:     'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
    credit_paid:        'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
    expense_created:    'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    expense_deleted:    'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    product_created:    'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
    product_updated:    'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
    product_deleted:    'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    user_created:       'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    user_updated:       'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    z_report_generated: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  }
  const cls = colorMap[action] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      {action}
    </span>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

interface DetailDrawerProps {
  entry: AuditLog
  onClose: () => void
}

function DetailDrawer({ entry, onClose }: DetailDrawerProps): React.ReactElement {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Focus close button on open; trap Escape to close
  useEffect(() => {
    closeRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Audit log entry details"
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-lg bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Audit Entry Details</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Meta fields */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Entry Information
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">ID</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">{entry.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Timestamp</dt>
                <dd className="text-gray-900 dark:text-gray-100">{formatDateTime(entry.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">User ID</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">
                  {entry.userId ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">IP Address</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">
                  {entry.ipAddress ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Action</dt>
                <dd><ActionBadge action={entry.action} /></dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Entity Type</dt>
                <dd className="text-gray-900 dark:text-gray-100">{entry.entityType}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Entity ID</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">
                  {entry.entityId ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                </dd>
              </div>
            </dl>
          </section>

          {/* Before state */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Before State
            </h3>
            {entry.beforeState ? (
              <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200 max-h-64 overflow-y-auto">
                {prettyJson(entry.beforeState)}
              </pre>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No before state recorded.</p>
            )}
          </section>

          {/* After state */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              After State
            </h3>
            {entry.afterState ? (
              <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200 max-h-64 overflow-y-auto">
                {prettyJson(entry.afterState)}
              </pre>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No after state recorded.</p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 transition-colors"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuditLogPage(): React.ReactElement {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState(firstOfMonthIso())
  const [dateTo, setDateTo] = useState(todayIso())

  // Detail drawer
  const [selectedEntry, setSelectedEntry] = useState<AuditLog | null>(null)

  // ── Fetch logs ─────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {}
      if (userId.trim()) payload.userId = parseInt(userId.trim(), 10)
      if (action) payload.action = action
      if (dateFrom) payload.dateFrom = dateFrom
      if (dateTo) payload.dateTo = dateTo

      const result = await window.api.invoke<IpcResult<AuditLog[]>>('audit:list', payload)
      if (result.success) {
        setLogs(result.data)
      } else {
        setError(result.error)
        setLogs([])
      }
    } catch {
      setError('Failed to load audit logs.')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [userId, action, dateFrom, dateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // ── Handle row click ───────────────────────────────────────────────────
  const handleRowClick = (entry: AuditLog) => {
    setSelectedEntry(entry)
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Read-only record of all significant system actions (Req 28.3, 28.4)
            </p>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            aria-label="Refresh audit log"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 transition-colors"
          >
            <svg
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3">
          {/* User ID filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="audit-userid" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              User ID
            </label>
            <input
              id="audit-userid"
              type="number"
              min="1"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Any user"
              className={`${inputCls} w-28`}
            />
          </div>

          {/* Action type filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="audit-action" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Action
            </label>
            <select
              id="audit-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className={`${inputCls} pr-8 min-w-[160px]`}
            >
              <option value="">All actions</option>
              {KNOWN_ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label htmlFor="audit-from" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              From
            </label>
            <input
              id="audit-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label htmlFor="audit-to" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              To
            </label>
            <input
              id="audit-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="shrink-0 mx-6 mt-3 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300"
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-gray-400 dark:text-gray-500">Loading audit logs…</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500">No audit log entries found for the selected filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Timestamp
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      User ID
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Action
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Entity Type
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Entity ID
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      IP Address
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-center">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(log)}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for audit entry ${log.id}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleRowClick(log)
                        }
                      }}
                    >
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-mono text-xs">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-mono text-xs">
                        {log.userId ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {log.entityType}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-mono text-xs">
                        {log.entityId ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono text-xs">
                        {log.ipAddress ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRowClick(log) }}
                          aria-label={`View details for entry ${log.id}`}
                          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Row count summary */}
            <div className="mt-3 flex justify-end">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {logs.length} entr{logs.length !== 1 ? 'ies' : 'y'} found
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {selectedEntry && (
        <DetailDrawer
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  )
}
