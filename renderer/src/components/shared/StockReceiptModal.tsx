// StockReceiptModal — Task 25.4
// Requirements: 7.1–7.5
//
// Records a stock receipt from a supplier with multi-item line entry.
// Each line has: product selector, quantity, cost price, update-cost toggle.

import React, { useEffect, useRef, useState } from 'react'
import type { IpcResult, Product, Supplier } from '../../../../src/types'
import { useSessionStore } from '../../store/sessionStore'

export interface StockReceiptModalProps {
  onClose: () => void
  onSaved: () => void
}

interface LineItem {
  id: number
  productId: string
  quantity: string
  costPrice: string
  updateCost: boolean
}

let lineCounter = 0
function newLine(): LineItem {
  return { id: ++lineCounter, productId: '', quantity: '', costPrice: '', updateCost: false }
}

const inputCls = `
  min-h-[44px] px-3 py-2 rounded-lg text-sm
  bg-white dark:bg-gray-700
  border border-gray-300 dark:border-gray-600
  text-gray-900 dark:text-gray-100
  placeholder-gray-400 dark:placeholder-gray-500
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
  disabled:opacity-50
`

export default function StockReceiptModal({ onClose, onSaved }: StockReceiptModalProps) {
  const currentUser = useSessionStore((s) => s.currentUser)
  const firstRef = useRef<HTMLSelectElement>(null)

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.invoke<IpcResult<Supplier[]>>('inventory:supplier:list', {}).then((r) => {
      if (r.success) setSuppliers(r.data.filter((s) => s.isActive))
    }).catch(() => {})

    window.api.invoke<IpcResult<Product[]>>('inventory:product:search', { query: '' }).then((r) => {
      if (r.success) setProducts(r.data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function updateLine<K extends keyof LineItem>(id: number, key: K, value: LineItem[K]) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [key]: value } : l))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[`line-${id}-${key}`]
      return next
    })
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()])
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!supplierId) errs.supplierId = 'Supplier is required'
    if (!receiptDate) errs.receiptDate = 'Receipt date is required'
    if (lines.length === 0) errs.lines = 'At least one item is required'

    lines.forEach((line) => {
      if (!line.productId) errs[`line-${line.id}-productId`] = 'Select a product'
      const qty = parseFloat(line.quantity)
      if (!line.quantity || isNaN(qty) || qty <= 0) errs[`line-${line.id}-quantity`] = 'Enter quantity > 0'
      const cost = parseFloat(line.costPrice)
      if (!line.costPrice || isNaN(cost) || cost < 0) errs[`line-${line.id}-costPrice`] = 'Enter cost ≥ 0'
    })

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSubmitError(null)

    try {
      const result = await window.api.invoke<IpcResult<void>>('inventory:receipt:create', {
        supplierId: Number(supplierId),
        receivedBy: currentUser?.id,
        receiptDate,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({
          productId: Number(l.productId),
          quantity: parseFloat(l.quantity),
          costPrice: parseFloat(l.costPrice),
          updateCost: l.updateCost,
        })),
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
      aria-label="Record stock receipt"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="
        bg-white dark:bg-gray-800 rounded-xl shadow-2xl
        border border-gray-200 dark:border-gray-700
        w-full max-w-3xl max-h-[90vh] flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Record Stock Receipt</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="
              min-w-[44px] min-h-[44px] flex items-center justify-center
              rounded-lg text-gray-400 dark:text-gray-500
              hover:bg-gray-100 dark:hover:bg-gray-700
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              transition-colors
            "
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {submitError && (
            <div role="alert" className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Supplier */}
            <div>
              <label htmlFor="sr-supplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supplier <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <select
                ref={firstRef}
                id="sr-supplier"
                value={supplierId}
                onChange={(e) => { setSupplierId(e.target.value); setErrors((p) => ({ ...p, supplierId: '' })) }}
                className={`${inputCls} w-full`}
                aria-invalid={!!errors.supplierId}
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {errors.supplierId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.supplierId}</p>}
            </div>

            {/* Receipt Date */}
            <div>
              <label htmlFor="sr-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Receipt Date <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="sr-date"
                type="date"
                value={receiptDate}
                onChange={(e) => { setReceiptDate(e.target.value); setErrors((p) => ({ ...p, receiptDate: '' })) }}
                className={`${inputCls} w-full`}
                aria-invalid={!!errors.receiptDate}
              />
              {errors.receiptDate && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.receiptDate}</p>}
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label htmlFor="sr-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                id="sr-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this delivery…"
                className={`${inputCls} w-full resize-none`}
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Items <span className="text-red-500" aria-hidden="true">*</span>
              </h3>
              <button
                type="button"
                onClick={addLine}
                className="
                  inline-flex items-center gap-1.5
                  min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium
                  bg-blue-50 dark:bg-blue-900/30
                  text-blue-700 dark:text-blue-300
                  border border-blue-200 dark:border-blue-700
                  hover:bg-blue-100 dark:hover:bg-blue-900/50
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                  transition-colors
                "
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Item
              </button>
            </div>

            {errors.lines && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{errors.lines}</p>}

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div
                  key={line.id}
                  className="
                    p-3 rounded-lg border border-gray-200 dark:border-gray-700
                    bg-gray-50 dark:bg-gray-700/30
                  "
                >
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-3 text-xs text-gray-400 dark:text-gray-500 w-5 text-right">
                      {idx + 1}.
                    </span>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-2">
                      {/* Product */}
                      <div>
                        <label htmlFor={`sr-prod-${line.id}`} className="sr-only">Product</label>
                        <select
                          id={`sr-prod-${line.id}`}
                          value={line.productId}
                          onChange={(e) => updateLine(line.id, 'productId', e.target.value)}
                          className={`${inputCls} w-full`}
                          aria-invalid={!!errors[`line-${line.id}-productId`]}
                        >
                          <option value="">Select product…</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                        {errors[`line-${line.id}-productId`] && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors[`line-${line.id}-productId`]}</p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div>
                        <label htmlFor={`sr-qty-${line.id}`} className="sr-only">Quantity</label>
                        <input
                          id={`sr-qty-${line.id}`}
                          type="number"
                          min="0.001"
                          step="any"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className={`${inputCls} w-full`}
                          aria-invalid={!!errors[`line-${line.id}-quantity`]}
                        />
                        {errors[`line-${line.id}-quantity`] && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors[`line-${line.id}-quantity`]}</p>
                        )}
                      </div>

                      {/* Cost Price */}
                      <div>
                        <label htmlFor={`sr-cost-${line.id}`} className="sr-only">Cost Price</label>
                        <input
                          id={`sr-cost-${line.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.costPrice}
                          onChange={(e) => updateLine(line.id, 'costPrice', e.target.value)}
                          placeholder="Cost price"
                          className={`${inputCls} w-full`}
                          aria-invalid={!!errors[`line-${line.id}-costPrice`]}
                        />
                        {errors[`line-${line.id}-costPrice`] && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{errors[`line-${line.id}-costPrice`]}</p>
                        )}
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length === 1}
                      aria-label={`Remove item ${idx + 1}`}
                      className="
                        shrink-0 mt-1 min-w-[44px] min-h-[44px] flex items-center justify-center
                        rounded-lg text-red-400 dark:text-red-500
                        hover:bg-red-50 dark:hover:bg-red-900/30
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500
                        disabled:opacity-30 disabled:cursor-not-allowed
                        transition-colors
                      "
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Update cost toggle */}
                  <div className="mt-2 ml-7 flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={line.updateCost}
                      onClick={() => updateLine(line.id, 'updateCost', !line.updateCost)}
                      className={`
                        relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                        transition-colors duration-200 ease-in-out
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                        ${line.updateCost ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}
                      `}
                    >
                      <span
                        className={`
                          pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow
                          transform transition duration-200 ease-in-out
                          ${line.updateCost ? 'translate-x-4' : 'translate-x-0'}
                        `}
                      />
                    </button>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Update product cost price</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="
              min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              hover:bg-gray-200 dark:hover:bg-gray-600
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
              disabled:opacity-50 transition-colors
            "
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="
              min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
              bg-blue-600 hover:bg-blue-700
              text-white
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              disabled:opacity-50 transition-colors
            "
          >
            {saving ? 'Saving…' : 'Record Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}
