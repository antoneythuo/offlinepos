// CustomersPage — Task 26.1
// Requirements: 21.1–21.5
//
// Customer management page with:
//   - Debounced search input (300ms) calling `customers:list`
//   - Table: Name, Phone, Email, Credit Limit, Outstanding Debt, Actions
//   - Actions: Edit, Delete (with confirmation, reject if open credit), View History, View Credit
//   - "Add Customer" button → CustomerFormModal (create mode)
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Customer, IpcResult, Transaction } from '../../../src/types'
import CustomerFormModal from '../components/shared/CustomerFormModal'
import CustomerStatementModal from '../components/shared/CustomerStatementModal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

interface DeleteConfirmProps {
  customerName: string
  onConfirm: () => void
  onCancel: () => void
}
function DeleteConfirm({ customerName, onConfirm, onCancel }: DeleteConfirmProps): React.ReactElement {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm delete"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete customer?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          <span className="font-medium text-gray-900 dark:text-gray-100">{customerName}</span>
          {' '}will be permanently removed. This cannot be undone.
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

// ─── Purchase History Modal ───────────────────────────────────────────────────

interface HistoryModalProps {
  customer: Customer
  onClose: () => void
}
function HistoryModal({ customer, onClose }: HistoryModalProps): React.ReactElement {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    window.api
      .invoke<IpcResult<Transaction[]>>('customers:history', { customerId: customer.id })
      .then((r) => {
        if (r.success) setTransactions(r.data)
        else setError(r.error)
      })
      .catch(() => setError('Failed to load history.'))
      .finally(() => setLoading(false))
  }, [customer.id])

  return (
    <div role="dialog" aria-modal="true" aria-label="Purchase history"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Purchase History</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{customer.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Loading…</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!loading && !error && transactions.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No purchase history found.</p>
          )}
          {!loading && transactions.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Ref</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 text-right">Total</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="bg-white dark:bg-gray-800">
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{tx.transactionRef}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 font-medium">{formatAmount(tx.grandTotal)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize
                          ${tx.status === 'completed' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : tx.status === 'credit' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          : tx.status === 'refunded' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button type="button" onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 transition-colors">
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
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors ${className}`}>
      {children}
    </button>
  )
}

// ─── Debt cell — loads outstanding debt per customer ─────────────────────────

interface DebtCellProps { customerId: number }
function DebtCell({ customerId }: DebtCellProps): React.ReactElement {
  const [debt, setDebt] = useState<number | null>(null)
  useEffect(() => {
    window.api
      .invoke<IpcResult<{ outstandingDebt: number; creditLimit: number }>>('customers:debt', { customerId })
      .then((r) => { if (r.success) setDebt(r.data.outstandingDebt) })
      .catch(() => {})
  }, [customerId])
  if (debt === null) return <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
  return (
    <span className={`font-medium ${debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
      {formatAmount(debt)}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomersPage(): React.ReactElement {
  const navigate = useNavigate()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null)
  const [statementTarget, setStatementTarget] = useState<Customer | null>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch customers ──────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async (searchQuery: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.invoke<IpcResult<Customer[]>>('customers:list', {
        query: searchQuery,
      })
      if (result.success) {
        setCustomers(result.data)
      } else {
        setError(result.error)
        setCustomers([])
      }
    } catch {
      setError('Failed to load customers.')
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Debounced search ─────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchCustomers(query)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, fetchCustomers])

  // ── Delete customer ──────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    try {
      const result = await window.api.invoke<IpcResult<void>>('customers:delete', { id: deleteTarget.id })
      if (result.success) {
        setDeleteTarget(null)
        fetchCustomers(query)
      } else {
        setDeleteError(result.error)
        setDeleteTarget(null)
      }
    } catch {
      setDeleteError('Failed to delete customer.')
      setDeleteTarget(null)
    }
  }

  const handleModalSaved = () => {
    setShowAddModal(false)
    setEditTarget(null)
    fetchCustomers(query)
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Customers</h1>
          <button type="button" onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Customer
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search customers" />
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

      {/* ── Customer table ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-gray-400 dark:text-gray-500">Loading customers…</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {query ? 'No customers match your search.' : 'No customers yet.'}
            </p>
            {!query && (
              <button type="button" onClick={() => setShowAddModal(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Add your first customer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Phone</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Email</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-right">Credit Limit</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-right">Outstanding Debt</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {customers.map((customer) => (
                  <tr key={customer.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium max-w-[180px]">
                      <span className="line-clamp-1">{customer.name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{customer.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[180px]">
                      <span className="line-clamp-1">{customer.email ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                      {formatAmount(customer.creditLimit)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <DebtCell customerId={customer.id} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Edit */}
                        <ActionBtn onClick={() => setEditTarget(customer)} title="Edit customer"
                          className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </ActionBtn>
                        {/* View History */}
                        <ActionBtn onClick={() => setHistoryTarget(customer)} title="View purchase history"
                          className="text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </ActionBtn>
                        {/* View Credit */}
                        <ActionBtn onClick={() => navigate(`/credit?customerId=${customer.id}`)} title="View credit"
                          className="text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                          </svg>
                        </ActionBtn>
                        {/* Statement */}
                        <ActionBtn onClick={() => setStatementTarget(customer)} title="View statement"
                          className="text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </ActionBtn>
                        {/* Delete */}
                        <ActionBtn onClick={() => { setDeleteTarget(customer); setDeleteError(null) }} title="Delete customer"
                          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirm
          customerName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {showAddModal && (
        <CustomerFormModal customer={null} onClose={() => setShowAddModal(false)} onSaved={handleModalSaved} />
      )}
      {editTarget && (
        <CustomerFormModal customer={editTarget} onClose={() => setEditTarget(null)} onSaved={handleModalSaved} />
      )}
      {historyTarget && (
        <HistoryModal customer={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
      {statementTarget && (
        <CustomerStatementModal customer={statementTarget} onClose={() => setStatementTarget(null)} />
      )}
    </div>
  )
}
