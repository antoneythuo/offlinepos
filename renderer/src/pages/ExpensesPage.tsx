// ExpensesPage — Task 28.1
// Requirements: 25.1–25.5
//
// Expense tracking page with:
//   - Date range filter (from/to) + category filter dropdown
//   - Expense table: Date, Category, Description, Amount, Actions (Delete)
//   - "Add Expense" button → ExpenseFormModal
//   - Total expenses summary
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useCallback, useEffect, useState } from 'react'
import type { Expense, ExpenseCategory, IpcResult } from '../../../src/types'
import ExpenseFormModal from '../components/shared/ExpenseFormModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonthIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}
function DeleteConfirm({ onConfirm, onCancel }: DeleteConfirmProps): React.ReactElement {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm delete"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete expense?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          This expense record will be permanently removed. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExpensesPage(): React.ReactElement {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [dateFrom, setDateFrom] = useState(firstOfMonthIso())
  const [dateTo, setDateTo] = useState(todayIso())
  const [categoryId, setCategoryId] = useState<string>('')

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Load categories once ─────────────────────────────────────────────────
  useEffect(() => {
    window.api
      .invoke<IpcResult<ExpenseCategory[]>>('expenses:categories:list', {})
      .then((r) => { if (r.success) setCategories(r.data) })
      .catch(() => {})
  }, [])

  // ── Fetch expenses ───────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {}
      if (dateFrom) payload.dateFrom = dateFrom
      if (dateTo) payload.dateTo = dateTo
      if (categoryId) payload.categoryId = parseInt(categoryId, 10)

      const result = await window.api.invoke<IpcResult<Expense[]>>('expenses:list', payload)
      if (result.success) {
        setExpenses(result.data)
      } else {
        setError(result.error)
        setExpenses([])
      }
    } catch {
      setError('Failed to load expenses.')
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, categoryId])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // ── Delete expense ───────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    try {
      const result = await window.api.invoke<IpcResult<void>>('expenses:delete', { id: deleteTarget.id })
      if (result.success) {
        setDeleteTarget(null)
        fetchExpenses()
      } else {
        setDeleteError(result.error)
        setDeleteTarget(null)
      }
    } catch {
      setDeleteError('Failed to delete expense.')
      setDeleteTarget(null)
    }
  }

  // ── Total ────────────────────────────────────────────────────────────────
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  const inputCls = `
    min-h-[44px] px-3 py-2 rounded-lg text-sm
    bg-white dark:bg-gray-700
    border border-gray-300 dark:border-gray-600
    text-gray-900 dark:text-gray-100
    placeholder-gray-400 dark:placeholder-gray-500
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
  `

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Expenses</h1>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Expense
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="exp-from" className="text-xs font-medium text-gray-600 dark:text-gray-400">From</label>
            <input
              id="exp-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="exp-to" className="text-xs font-medium text-gray-600 dark:text-gray-400">To</label>
            <input
              id="exp-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="exp-cat" className="text-xs font-medium text-gray-600 dark:text-gray-400">Category</label>
            <select
              id="exp-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`${inputCls} pr-8`}
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Error banners ─────────────────────────────────────────────────── */}
      {error && (
        <div role="alert" className="shrink-0 mx-6 mt-3 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {deleteError && (
        <div role="alert" className="shrink-0 mx-6 mt-3 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
          {deleteError}
          <button type="button" onClick={() => setDeleteError(null)} className="ml-3 underline hover:no-underline">Dismiss</button>
        </div>
      )}

      {/* ── Expense table ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-gray-400 dark:text-gray-500">Loading expenses…</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-sm text-gray-400 dark:text-gray-500">No expenses found for the selected filters.</p>
            <button type="button" onClick={() => setShowAddModal(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Add your first expense
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Category</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Description</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-right">Amount</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDate(expense.expenseDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {expense.categoryName ?? `Category ${expense.categoryId}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[280px]">
                        <span className="line-clamp-2">{expense.description ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatAmount(expense.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(expense)}
                          title="Delete expense"
                          aria-label="Delete expense"
                          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total summary */}
            <div className="mt-4 flex justify-end">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-6 py-3 shadow-sm">
                <div className="flex items-center gap-6">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total:</span>
                    <span className="text-base font-bold text-gray-900 dark:text-gray-100">{formatAmount(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirm
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {showAddModal && (
        <ExpenseFormModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchExpenses() }}
        />
      )}
    </div>
  )
}
