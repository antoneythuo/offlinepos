// ExpenseFormModal — Task 28.2
// Requirements: 25.1–25.5
//
// Modal for creating a new expense.
// Fields: category (from expenses:categories:list), amount, date (defaults today), description
// Calls `expenses:create` IPC on submit.
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useEffect, useRef, useState } from 'react'
import type { Expense, ExpenseCategory, IpcResult } from '../../../../src/types'

export interface ExpenseFormModalProps {
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  categoryId: string
  amount: string
  expenseDate: string
  description: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm(): FormState {
  return { categoryId: '', amount: '', expenseDate: todayIso(), description: '' }
}

// ─── Field helpers ────────────────────────────────────────────────────────────

interface LabelProps { htmlFor: string; children: React.ReactNode; required?: boolean }
function Label({ htmlFor, children, required }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
    </label>
  )
}

const inputCls = `
  w-full min-h-[44px] px-3 py-2 rounded-lg text-sm
  bg-white dark:bg-gray-700
  border border-gray-300 dark:border-gray-600
  text-gray-900 dark:text-gray-100
  placeholder-gray-400 dark:placeholder-gray-500
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
  disabled:opacity-50
`

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExpenseFormModal({ onClose, onSaved }: ExpenseFormModalProps) {
  const firstInputRef = useRef<HTMLSelectElement>(null)

  const [form, setForm] = useState<FormState>(emptyForm)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Load categories on mount
  useEffect(() => {
    window.api
      .invoke<IpcResult<ExpenseCategory[]>>('expenses:categories:list', {})
      .then((r) => {
        if (r.success) setCategories(r.data)
      })
      .catch(() => {})
      .finally(() => setLoadingCats(false))
  }, [])

  // Focus first field on mount
  useEffect(() => { firstInputRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.categoryId) errs.categoryId = 'Category is required'
    const amt = parseFloat(form.amount)
    if (!form.amount || isNaN(amt) || amt <= 0) errs.amount = 'Amount must be greater than 0'
    if (!form.expenseDate) errs.expenseDate = 'Date is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSubmitError(null)

    try {
      const result = await window.api.invoke<IpcResult<Expense>>('expenses:create', {
        categoryId: parseInt(form.categoryId, 10),
        amount: parseFloat(form.amount),
        expenseDate: form.expenseDate,
        description: form.description.trim() || undefined,
      })

      if (result.success) {
        onSaved()
      } else {
        setSubmitError(result.error)
      }
    } catch {
      setSubmitError('An unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add expense"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Expense</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate className="px-6 py-4 flex flex-col gap-4">
          {submitError && (
            <div role="alert" className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          {/* Category */}
          <div>
            <Label htmlFor="ef-category" required>Category</Label>
            <select
              ref={firstInputRef}
              id="ef-category"
              value={form.categoryId}
              onChange={(e) => setField('categoryId', e.target.value)}
              disabled={loadingCats}
              className={inputCls}
              aria-invalid={!!errors.categoryId}
              aria-describedby={errors.categoryId ? 'ef-category-err' : undefined}
            >
              <option value="">{loadingCats ? 'Loading…' : 'Select category…'}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
              ))}
            </select>
            {errors.categoryId && (
              <p id="ef-category-err" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.categoryId}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="ef-amount" required>Amount</Label>
            <input
              id="ef-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setField('amount', e.target.value)}
              placeholder="0.00"
              className={inputCls}
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? 'ef-amount-err' : undefined}
            />
            {errors.amount && (
              <p id="ef-amount-err" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.amount}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <Label htmlFor="ef-date" required>Date</Label>
            <input
              id="ef-date"
              type="date"
              value={form.expenseDate}
              onChange={(e) => setField('expenseDate', e.target.value)}
              className={inputCls}
              aria-invalid={!!errors.expenseDate}
              aria-describedby={errors.expenseDate ? 'ef-date-err' : undefined}
            />
            {errors.expenseDate && (
              <p id="ef-date-err" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.expenseDate}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="ef-desc">Description</Label>
            <textarea
              id="ef-desc"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Optional notes about this expense…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
