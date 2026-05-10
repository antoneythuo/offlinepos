// StockAdjustmentModal — Task 25.3
// Requirements: 6.1–6.4
//
// Records a stock adjustment (damaged, lost, returned, correction).
// If the adjustment would result in negative stock, shows a confirmation
// dialog before proceeding (Req 6.3).

import React, { useEffect, useRef, useState } from 'react'
import type { IpcResult, Product } from '../../../../src/types'
import { useSessionStore } from '../../store/sessionStore'

export interface StockAdjustmentModalProps {
  product: Product
  onClose: () => void
  onSaved: () => void
}

type AdjustmentType = 'damaged' | 'lost' | 'returned' | 'correction'

const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string; description: string }[] = [
  { value: 'damaged', label: 'Damaged', description: 'Items damaged and removed from stock' },
  { value: 'lost', label: 'Lost / Stolen', description: 'Items lost or stolen' },
  { value: 'returned', label: 'Returned', description: 'Items returned to stock' },
  { value: 'correction', label: 'Correction', description: 'Manual stock count correction' },
]

const inputCls = `
  w-full min-h-[44px] px-3 py-2 rounded-lg text-sm
  bg-white dark:bg-gray-700
  border border-gray-300 dark:border-gray-600
  text-gray-900 dark:text-gray-100
  placeholder-gray-400 dark:placeholder-gray-500
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
  disabled:opacity-50
`

export default function StockAdjustmentModal({ product, onClose, onSaved }: StockAdjustmentModalProps) {
  const currentUser = useSessionStore((s) => s.currentUser)
  const quantityRef = useRef<HTMLInputElement>(null)

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('correction')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ quantity?: string; reason?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    quantityRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirm) setShowConfirm(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, showConfirm])

  function validate(): boolean {
    const errs: { quantity?: string; reason?: string } = {}
    const qty = parseFloat(quantity)
    if (!quantity.trim() || isNaN(qty)) {
      errs.quantity = 'Quantity is required'
    }
    // reason is optional
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function doAdjust(force = false) {
    setSaving(true)
    setSubmitError(null)
    try {
      const result = await window.api.invoke<IpcResult<{ requiresConfirmation?: boolean }>>(
        'inventory:adjust',
        {
          productId: product.id,
          type: adjustmentType,
          quantity: parseFloat(quantity),
          reason: reason.trim(),
          userId: currentUser?.id,
          forceNegative: force,
        }
      )

      if (result.success) {
        if (result.data.requiresConfirmation && !force) {
          // Backend says this would go negative — ask user to confirm
          setShowConfirm(true)
          setSaving(false)
          return
        }
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    doAdjust(false)
  }

  const projectedQty = product.quantityOnHand + (parseFloat(quantity) || 0)
  const willGoNegative = projectedQty < 0

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Adjust stock"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget && !showConfirm) onClose() }}
      >
        <div className="
          bg-white dark:bg-gray-800 rounded-xl shadow-2xl
          border border-gray-200 dark:border-gray-700
          w-full max-w-md flex flex-col
        ">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Adjust Stock</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {product.name}
                <span className="ml-2 font-mono text-xs">{product.sku}</span>
              </p>
            </div>
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

          {/* Current stock info */}
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Current stock</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {Number(product.quantityOnHand).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="px-6 py-4 space-y-4">
            {submitError && (
              <div role="alert" className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
                {submitError}
              </div>
            )}

            {/* Adjustment type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Adjustment Type <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ADJUSTMENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setAdjustmentType(t.value)}
                    aria-pressed={adjustmentType === t.value}
                    className={`
                      min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-left
                      border transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                      ${adjustmentType === t.value
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="adj-qty" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quantity <span className="text-red-500" aria-hidden="true">*</span>
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 font-normal">(positive to add, negative to remove)</span>
              </label>
              <input
                ref={quantityRef}
                id="adj-qty"
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value)
                  setErrors((prev) => ({ ...prev, quantity: undefined }))
                }}
                placeholder="e.g. -5 or 10"
                className={inputCls}
                aria-invalid={!!errors.quantity}
                aria-describedby={errors.quantity ? 'adj-qty-err' : undefined}
              />
              {errors.quantity && <p id="adj-qty-err" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.quantity}</p>}
              {quantity && !isNaN(parseFloat(quantity)) && (
                <p className={`mt-1 text-xs ${willGoNegative ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  New stock: {projectedQty.toLocaleString()}
                  {willGoNegative && ' ⚠ Will go negative'}
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label htmlFor="adj-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason
              </label>
              <textarea
                id="adj-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setErrors((prev) => ({ ...prev, reason: undefined }))
                }}
                placeholder="Describe the reason for this adjustment…"
                className={`${inputCls} resize-none`}
                aria-invalid={!!errors.reason}
                aria-describedby={errors.reason ? 'adj-reason-err' : undefined}
              />
              {errors.reason && <p id="adj-reason-err" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.reason}</p>}
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
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
              {saving ? 'Saving…' : 'Save Adjustment'}
            </button>
          </div>
        </div>
      </div>

      {/* Negative stock confirmation dialog (Req 6.3) */}
      {showConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm negative stock"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <div className="
            bg-white dark:bg-gray-800 rounded-xl shadow-2xl
            border border-orange-200 dark:border-orange-700
            w-full max-w-sm p-6
          ">
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Negative Stock Warning
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  This adjustment will result in a negative stock quantity ({projectedQty.toLocaleString()}).
                  Do you want to proceed anyway?
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="
                  min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
                  bg-gray-100 dark:bg-gray-700
                  text-gray-700 dark:text-gray-300
                  hover:bg-gray-200 dark:hover:bg-gray-600
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
                  transition-colors
                "
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirm(false); doAdjust(true) }}
                className="
                  min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
                  bg-orange-600 hover:bg-orange-700
                  text-white
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500
                  transition-colors
                "
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
