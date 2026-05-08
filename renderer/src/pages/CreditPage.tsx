// CreditPage — Task 26.3
// Requirements: 19.1–19.5, 20.1–20.6
//
// Shows open credit transactions. Can be viewed:
//   - As a global list of all open credit transactions (default)
//   - Filtered to a specific customer (via URL query param ?customerId=N)
//
// For each transaction: customer name, date, amount, balance, due date
// "Record Payment" button per transaction → CreditPaymentModal
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { CreditBalance, Customer, IpcResult, ReceiptLineItem, Transaction } from '../../../src/types'
import CreditPaymentModal from '../components/shared/CreditPaymentModal'
import CustomerStatementModal from '../components/shared/CustomerStatementModal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function isOverdue(tx: Transaction): boolean {
  if (!tx.creditDueDate) return false
  return new Date(tx.creditDueDate) < new Date()
}

function isDueSoon(tx: Transaction): boolean {
  if (!tx.creditDueDate) return false
  const due = new Date(tx.creditDueDate)
  const now = new Date()
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 3
}

// ─── Credit Transaction Detail Modal ─────────────────────────────────────────

interface CreditDetailModalProps {
  transaction: Transaction
  onClose: () => void
}

function CreditDetailModal({ transaction, onClose }: CreditDetailModalProps): React.ReactElement {
  const [items, setItems] = useState<ReceiptLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    window.api.invoke<IpcResult<ReceiptLineItem[]>>('sales:transaction:items', { transactionId: transaction.id })
      .then((r) => {
        if (r.success) setItems(r.data)
        else setError(r.error)
      })
      .catch(() => setError('Failed to load items.'))
      .finally(() => setLoading(false))
  }, [transaction.id])

  const handlePrint = async () => {
    const content = document.getElementById('credit-receipt-content')?.innerHTML ?? ''
    if (!content) return
    try {
      await window.api.invoke('print:html', { html: content })
    } catch {
      // silently ignore — user may have cancelled
    }
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div role="dialog" aria-modal="true" aria-label="Credit transaction detail"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs max-h-[90vh] flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Credit Details</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{transaction.transactionRef}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Receipt content */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white">
          <div id="credit-receipt-content"
            style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#000', padding: '12px 14px' }}>

            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', marginBottom: '2px' }}>Sequence Lounge</p>
            <p style={{ textAlign: 'center', fontSize: '10px', marginBottom: '4px' }}>CREDIT SALE RECEIPT</p>
            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Ref #</span><span style={{ fontWeight: 'bold' }}>{transaction.transactionRef}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Date</span><span>{new Date(transaction.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            {transaction.customerName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Customer</span><span style={{ fontWeight: 'bold' }}>{transaction.customerName}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Balance Due</span><span style={{ fontWeight: 'bold' }}>{fmt(transaction.creditBalance ?? transaction.grandTotal)}</span>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
            <p style={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>ITEMS</p>

            {loading && <p style={{ fontSize: '10px', color: '#666' }}>Loading…</p>}
            {error && <p style={{ fontSize: '10px', color: 'red' }}>{error}</p>}
            {!loading && items.map((item, i) => (
              <div key={i} style={{ marginBottom: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', flex: 1, paddingRight: '8px' }}>{item.productName}</span>
                  <span style={{ fontWeight: 'bold' }}>{fmt(item.lineTotal)}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#555' }}>
                  {item.quantity} × {fmt(item.unitPrice)}
                </div>
              </div>
            ))}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', margin: '3px 0' }}>
              <span>TOTAL</span><span>{fmt(transaction.grandTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Paid</span><span>{fmt(transaction.grandTotal - (transaction.creditBalance ?? transaction.grandTotal))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#c00', margin: '2px 0' }}>
              <span>BALANCE DUE</span><span>{fmt(transaction.creditBalance ?? transaction.grandTotal)}</span>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0 3px' }} />
            <p style={{ textAlign: 'center', fontSize: '10px' }}>Thank you for your business!</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button type="button" onClick={handlePrint} disabled={loading}
            className="flex-1 min-h-[44px] rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 min-h-[44px] rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Action button helper ─────────────────────────────────────────────────────

interface ActionBtnProps {
  onClick: () => void
  title: string
  className?: string
  children: React.ReactNode
}
function ActionBtn({ onClick, title, className = '', children }: ActionBtnProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`
        inline-flex items-center justify-center gap-1.5
        min-w-[44px] min-h-[44px] px-3 rounded-lg
        text-sm font-medium
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        transition-colors
        ${className}
      `}
    >
      {children}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreditPage(): React.ReactElement {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customerIdParam = searchParams.get('customerId')
  const customerIdFilter = customerIdParam ? Number(customerIdParam) : null

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [paymentTarget, setPaymentTarget] = useState<Transaction | null>(null)
  const [statementTarget, setStatementTarget] = useState<Customer | null>(null)
  const [detailTarget, setDetailTarget] = useState<Transaction | null>(null)

  // Search / filter
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load customer info if filtered ──────────────────────────────────────
  useEffect(() => {
    if (!customerIdFilter) { setCustomer(null); return }
    window.api
      .invoke<IpcResult<{ outstandingDebt: number; creditLimit: number }>>('customers:debt', {
        customerId: customerIdFilter,
      })
      .catch(() => {})
    // Also try to get customer name from the transactions list
  }, [customerIdFilter])

  // ── Fetch open credit transactions ───────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let result: IpcResult<Transaction[]>
      if (customerIdFilter) {
        result = await window.api.invoke<IpcResult<Transaction[]>>('credit:listOpen', {
          customerId: customerIdFilter,
        })
      } else {
        // Global open credit list — use customerId: 0 or omit to get all
        result = await window.api.invoke<IpcResult<Transaction[]>>('credit:listOpen', {})
      }
      if (result.success) {
        setTransactions(result.data)
        // Derive customer name from first transaction if filtered
        if (customerIdFilter && result.data.length > 0 && result.data[0].customerName) {
          setCustomer({
            id: customerIdFilter,
            name: result.data[0].customerName,
            creditLimit: 0,
            isActive: true,
            createdAt: '',
            updatedAt: '',
          })
        }
      } else {
        setError(result.error)
      }
    } catch {
      setError('Failed to load credit transactions.')
    } finally {
      setLoading(false)
    }
  }, [customerIdFilter])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  // ── Client-side search filter ────────────────────────────────────────────
  const filtered = query.trim()
    ? transactions.filter((tx) => {
        const q = query.toLowerCase()
        return (
          tx.transactionRef.toLowerCase().includes(q) ||
          (tx.customerName ?? '').toLowerCase().includes(q)
        )
      })
    : transactions

  // ── Debounced search ─────────────────────────────────────────────────────
  function handleQueryChange(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {}, 300)
  }

  // ── After payment recorded ───────────────────────────────────────────────
  function handlePaid(balance: CreditBalance) {
    setPaymentTarget(null)
    if (balance.status === 'settled') {
      // Remove settled transaction from the open list
      setTransactions((prev) => prev.filter((tx) => tx.id !== balance.transactionId))
    } else {
      // Update the outstanding balance
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === balance.transactionId
            ? { ...tx, creditBalance: balance.outstandingBalance }
            : tx
        )
      )
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="
        shrink-0 px-6 py-4
        bg-white dark:bg-gray-800
        border-b border-gray-200 dark:border-gray-700
      ">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {customerIdFilter && (
              <button
                type="button"
                onClick={() => navigate('/credit')}
                aria-label="Back to all credit"
                className="
                  min-w-[44px] min-h-[44px] flex items-center justify-center
                  rounded-lg text-gray-500 dark:text-gray-400
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                  transition-colors
                "
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {customerIdFilter && customer ? `${customer.name} — Credit` : 'Open Credit'}
              </h1>
              {customerIdFilter && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Showing open credit transactions for this customer
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Statement button (per-customer only) */}
            {customerIdFilter && customer && (
              <button
                type="button"
                onClick={() => setStatementTarget(customer)}
                className="
                  inline-flex items-center gap-2
                  min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
                  bg-white dark:bg-gray-700
                  border border-gray-300 dark:border-gray-600
                  text-gray-700 dark:text-gray-300
                  hover:bg-gray-50 dark:hover:bg-gray-600
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                  transition-colors
                "
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Statement
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mt-3">
          <div className="relative max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by ref or customer…"
              className="
                w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg text-sm
                bg-gray-50 dark:bg-gray-700
                border border-gray-300 dark:border-gray-600
                text-gray-900 dark:text-gray-100
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              "
              aria-label="Search credit transactions"
            />
          </div>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div role="alert" className="shrink-0 mx-6 mt-3 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Transactions table ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-gray-400 dark:text-gray-500">Loading credit transactions…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {query ? 'No matching transactions found.' : 'No open credit transactions.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  {!customerIdFilter && (
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Customer</th>
                  )}
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Ref</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-right">Amount</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-right">Balance</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Due Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((tx) => {
                  const overdue = isOverdue(tx)
                  const dueSoon = !overdue && isDueSoon(tx)
                  return (
                    <tr
                      key={tx.id}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      {/* Customer (global view only) */}
                      {!customerIdFilter && (
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                          {tx.customerName ?? '—'}
                        </td>
                      )}

                      {/* Ref */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {tx.transactionRef}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                        {formatAmount(tx.grandTotal)}
                      </td>

                      {/* Balance */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {formatAmount(tx.creditBalance ?? tx.grandTotal)}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.creditDueDate ? (
                          <span className={`inline-flex items-center gap-1 text-sm ${
                            overdue
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : dueSoon
                              ? 'text-amber-600 dark:text-amber-400 font-medium'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {overdue && (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                              </svg>
                            )}
                            {formatDate(tx.creditDueDate)}
                            {overdue && <span className="text-xs">(Overdue)</span>}
                            {dueSoon && <span className="text-xs">(Due soon)</span>}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {/* View items */}
                          <ActionBtn
                            onClick={() => setDetailTarget(tx)}
                            title="View items & print"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            View
                          </ActionBtn>
                          {/* Pay */}
                          <ActionBtn
                            onClick={() => setPaymentTarget(tx)}
                            title="Record payment"
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                            </svg>
                            Pay
                          </ActionBtn>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {detailTarget && (
        <CreditDetailModal
          transaction={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {paymentTarget && (
        <CreditPaymentModal
          transaction={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onPaid={handlePaid}
        />
      )}

      {statementTarget && (
        <CustomerStatementModal
          customer={statementTarget}
          onClose={() => setStatementTarget(null)}
        />
      )}
    </div>
  )
}
