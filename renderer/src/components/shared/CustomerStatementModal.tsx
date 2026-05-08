// CustomerStatementModal — Task 26.5
// Requirements: 20.6
//
// Date range picker that fetches and renders a printable statement of all
// credit transactions and payments for a customer.
// - Date range picker (from/to)
// - Shows all credit transactions and payments in the range
// - Print button (window.print())
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useEffect, useState } from 'react'
import type { CreditPayment, Customer, IpcResult, Transaction } from '../../../../src/types'

export interface CustomerStatementModalProps {
  customer: Customer
  onClose: () => void
}

interface StatementData {
  transactions: Transaction[]
  payments: CreditPayment[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function thirtyDaysAgoStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

const inputCls = `
  min-h-[44px] px-3 py-2 rounded-lg text-sm
  bg-white dark:bg-gray-700
  border border-gray-300 dark:border-gray-600
  text-gray-900 dark:text-gray-100
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
`

export default function CustomerStatementModal({ customer, onClose }: CustomerStatementModalProps) {
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgoStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [data, setData] = useState<StatementData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function fetchStatement() {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.invoke<IpcResult<StatementData>>('credit:statement', {
        customerId: customer.id,
        dateFrom,
        dateTo,
      })
      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error)
      }
    } catch {
      setError('Failed to load statement. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on mount
  useEffect(() => { fetchStatement() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute totals
  const totalCredit = data?.transactions.reduce((s, t) => s + t.grandTotal, 0) ?? 0
  const totalPaid = data?.payments.reduce((s, p) => s + p.amount, 0) ?? 0
  const totalOutstanding = totalCredit - totalPaid

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customer statement"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="
        bg-white dark:bg-gray-800 rounded-xl shadow-2xl
        border border-gray-200 dark:border-gray-700
        w-full max-w-3xl max-h-[90vh] flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0 print:hidden">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Customer Statement</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{customer.name}</p>
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

        {/* Date range controls */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="stmt-from" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
              <input
                id="stmt-from"
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="stmt-to" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
              <input
                id="stmt-to"
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={fetchStatement}
              disabled={loading}
              className="
                min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
                bg-blue-600 hover:bg-blue-700 text-white
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                disabled:opacity-50 transition-colors
              "
            >
              {loading ? 'Loading…' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Statement content */}
        <div className="flex-1 overflow-y-auto px-6 py-4" id="statement-content">
          {/* Print header (visible only when printing) */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Customer Statement</h1>
            <p className="text-gray-600 mt-1">
              <strong>{customer.name}</strong>
              {customer.phone && ` · ${customer.phone}`}
              {customer.email && ` · ${customer.email}`}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Period: {formatDate(dateFrom)} – {formatDate(dateTo)}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-32">
              <span className="text-sm text-gray-400 dark:text-gray-500">Loading statement…</span>
            </div>
          )}

          {!loading && data && (
            <div className="space-y-6">
              {/* Credit Transactions */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                  Credit Transactions
                </h3>
                {data.transactions.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">No credit transactions in this period.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Ref</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Due Date</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 text-right">Amount</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 text-right">Balance</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data.transactions.map((tx) => (
                          <tr key={tx.id} className="bg-white dark:bg-gray-800">
                            <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{tx.transactionRef}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(tx.createdAt)}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {tx.creditDueDate ? formatDate(tx.creditDueDate) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 font-medium">{formatAmount(tx.grandTotal)}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              <span className={tx.creditBalance && tx.creditBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                {formatAmount(tx.creditBalance ?? 0)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`
                                inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                                ${(tx.creditBalance ?? 1) === 0
                                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                }
                              `}>
                                {(tx.creditBalance ?? 1) === 0 ? 'Settled' : 'Open'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Payments */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                  Payments Received
                </h3>
                {data.payments.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">No payments recorded in this period.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Method</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 text-right">Amount</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 text-right">Balance After</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data.payments.map((pmt) => (
                          <tr key={pmt.id} className="bg-white dark:bg-gray-800">
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(pmt.createdAt)}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 capitalize">
                              {pmt.method.replace('_', ' ')}
                            </td>
                            <td className="px-3 py-2 text-right text-green-600 dark:text-green-400 font-medium">{formatAmount(pmt.amount)}</td>
                            <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{formatAmount(pmt.balanceAfterPayment)}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{pmt.note ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Summary */}
              <section className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Summary</h3>
                </div>
                <div className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Credit Extended</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatAmount(totalCredit)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Payments Received</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">{formatAmount(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Outstanding Balance</span>
                    <span className={`text-sm font-bold ${
                      totalOutstanding > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {formatAmount(Math.max(0, totalOutstanding))}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {!loading && !data && !error && (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-400 dark:text-gray-500">Select a date range and click Generate.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="
              min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              hover:bg-gray-200 dark:hover:bg-gray-600
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
              transition-colors
            "
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data || loading}
            className="
              inline-flex items-center gap-2
              min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
              bg-blue-600 hover:bg-blue-700 text-white
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              disabled:opacity-50 transition-colors
            "
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Print Statement
          </button>
        </div>
      </div>
    </div>
  )
}
