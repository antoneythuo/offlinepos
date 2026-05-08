// CreditPaymentModal — Task 26.4
// Requirements: 20.1–20.5
//
// Record a credit payment for a specific open credit transaction.
// - Amount input with real-time remaining balance display (Req 20.2)
// - Payment method selector: cash, card, mobile_money
// - Note field
// - Validation: amount must not exceed outstanding balance (Req 20.3)
// - Calls `credit:pay` IPC
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useEffect, useRef, useState } from 'react'
import type { CreditBalance, IpcResult, RecordCreditPaymentPayload, Transaction } from '../../../../src/types'
import { useSessionStore } from '../../store/sessionStore'

export interface CreditPaymentModalProps {
  /** The open credit transaction to pay against */
  transaction: Transaction
  onClose: () => void
  /** Called after a successful payment with the updated balance */
  onPaid: (balance: CreditBalance) => void
}

type PaymentMethod = 'cash' | 'card' | 'mobile_money'

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile_money: 'Mobile Money',
}

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

export default function CreditPaymentModal({ transaction, onClose, onPaid }: CreditPaymentModalProps) {
  const { currentUser } = useSessionStore()
  const amountRef = useRef<HTMLInputElement>(null)

  const outstanding = transaction.creditBalance ?? transaction.grandTotal

  const [amountStr, setAmountStr] = useState<string>(formatAmount(outstanding))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Derived: remaining after this payment
  const enteredAmount = parseFloat(amountStr) || 0
  const remaining = Math.max(0, outstanding - enteredAmount)

  // Focus amount on mount
  useEffect(() => {
    amountRef.current?.focus()
    amountRef.current?.select()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function validateAmount(): boolean {
    const val = parseFloat(amountStr)
    if (isNaN(val) || val <= 0) {
      setAmountError('Enter a payment amount greater than 0')
      return false
    }
    if (val > outstanding) {
      setAmountError(`Amount cannot exceed outstanding balance of ${formatAmount(outstanding)}`)
      return false
    }
    setAmountError(null)
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateAmount()) return
    if (!currentUser) {
      setSubmitError('No active session. Please log in again.')
      return
    }

    setSaving(true)
    setSubmitError(null)

    const payload: RecordCreditPaymentPayload = {
      creditTransactionId: transaction.id,
      amount: parseFloat(amountStr),
      method,
      note: note.trim() || undefined,
      cashierId: currentUser.id,
    }

    try {
      const result = await window.api.invoke<IpcResult<CreditBalance>>('credit:pay', payload)
      if (result.success) {
        onPaid(result.data)
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
      aria-label="Record credit payment"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="
        bg-white dark:bg-gray-800 rounded-xl shadow-2xl
        border border-gray-200 dark:border-gray-700
        w-full max-w-md flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Record Payment</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {transaction.transactionRef}
              {transaction.customerName ? ` · ${transaction.customerName}` : ''}
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

        {/* Outstanding balance summary */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3">
            <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">Outstanding Balance</span>
            <span className="text-lg font-bold text-amber-900 dark:text-amber-200">{formatAmount(outstanding)}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="px-6 pb-4 flex flex-col gap-4">
          {submitError && (
            <div role="alert" className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          {/* Amount */}
          <div>
            <label htmlFor="cp-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Payment Amount <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              ref={amountRef}
              id="cp-amount"
              type="number"
              min="0.01"
              step="0.01"
              max={outstanding}
              value={amountStr}
              onChange={(e) => {
                setAmountStr(e.target.value)
                setAmountError(null)
              }}
              onBlur={validateAmount}
              className={inputCls}
              aria-invalid={!!amountError}
              aria-describedby={amountError ? 'cp-amount-err' : undefined}
            />
            {amountError && (
              <p id="cp-amount-err" className="mt-1 text-xs text-red-600 dark:text-red-400">{amountError}</p>
            )}
          </div>

          {/* Real-time remaining balance (Req 20.2) */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 px-4 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">Remaining after payment</span>
            <span className={`text-base font-semibold ${
              remaining === 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-900 dark:text-gray-100'
            }`}>
              {formatAmount(remaining)}
              {remaining === 0 && (
                <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-400">Settled ✓</span>
              )}
            </span>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Method <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="flex gap-2" role="group" aria-label="Payment method">
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                  className={`
                    flex-1 min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium
                    border transition-colors
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                    ${method === m
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label htmlFor="cp-note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              id="cp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Partial payment via M-Pesa"
              rows={2}
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
              bg-green-600 hover:bg-green-700
              text-white
              focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500
              disabled:opacity-50 transition-colors
            "
          >
            {saving ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
