// PaymentPanel — cash tendered < total → credit sale with customer selector

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useCartStore } from '../../store/cartStore'
import { useSessionStore } from '../../store/sessionStore'
import type { CreateSalePayload, Customer, IpcResult, PaymentEntry, SaleResult } from '../../../../src/types'

type TabId = 'cash' | 'card' | 'mobile_money' | 'split'

interface SplitAmounts { cash: string; card: string; mobile_money: string }
interface PaymentPanelProps { onSaleComplete?: (result: SaleResult) => void; focusSignal?: number }

function formatCurrency(n: number): string {
  return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function parseAmount(raw: string): number {
  const n = parseFloat(raw)
  return isNaN(n) || n < 0 ? 0 : n
}

function TabButton({ id, label, active, onClick }: { id: TabId; label: string; active: boolean; onClick: (id: TabId) => void }) {
  return (
    <button type="button" onClick={() => onClick(id)}
      className={['flex-1 min-h-[44px] text-xs font-semibold rounded-md transition-colors',
        active ? 'bg-primary-600 text-white shadow-sm'
               : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      ].join(' ')}>
      {label}
    </button>
  )
}

function AmountInput({ label, value, onChange, autoFocus, inputRef }: {
  label: string; value: string; onChange: (v: string) => void
  autoFocus?: boolean; inputRef?: React.RefObject<HTMLInputElement>
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <input ref={inputRef} type="number" min="0" step="0.01" value={value}
        onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus}
        className="w-full min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        placeholder="0.00" />
    </div>
  )
}

export default function PaymentPanel({ onSaleComplete, focusSignal }: PaymentPanelProps): React.ReactElement {
  const { items, summary, receiptDiscount, clearCart } = useCartStore()
  const currentUser = useSessionStore((s) => s.currentUser)
  const grandTotal = summary.grandTotal

  const [activeTab, setActiveTab] = useState<TabId>('cash')
  const [cashAmount, setCashAmount] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [mobileAmount, setMobileAmount] = useState('')
  const [splitAmounts, setSplitAmounts] = useState<SplitAmounts>({ cash: '', card: '', mobile_money: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ipcError, setIpcError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const primaryInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    window.api.invoke<IpcResult<Customer[]>>('customers:list', { query: '' })
      .then((r) => { if (r.success) setCustomers(r.data) }).catch(() => {})
  }, [])

  useEffect(() => {
    setIpcError(null); setValidationError(null)
    if (activeTab === 'card') setCardAmount(grandTotal > 0 ? grandTotal.toFixed(2) : '')
    else if (activeTab === 'mobile_money') setMobileAmount(grandTotal > 0 ? grandTotal.toFixed(2) : '')
    else if (activeTab === 'cash') setCashAmount('')
  }, [activeTab, grandTotal])

  useEffect(() => {
    if (!focusSignal) return
    primaryInputRef.current?.focus()
  }, [focusSignal])

  const totalEntered = useCallback((): number => {
    if (activeTab === 'cash') return parseAmount(cashAmount)
    if (activeTab === 'card') return parseAmount(cardAmount)
    if (activeTab === 'mobile_money') return parseAmount(mobileAmount)
    return parseAmount(splitAmounts.cash) + parseAmount(splitAmounts.card) + parseAmount(splitAmounts.mobile_money)
  }, [activeTab, cashAmount, cardAmount, mobileAmount, splitAmounts])

  const entered = totalEntered()
  const changeDue = activeTab === 'cash' ? Math.max(0, entered - grandTotal) : 0
  const remaining = Math.max(0, grandTotal - entered)
  const isCartEmpty = items.length === 0
  const isCreditSale = activeTab === 'cash' && grandTotal > 0 && entered >= 0 && entered < grandTotal
  const canComplete = !isCartEmpty && grandTotal > 0 && (entered >= grandTotal || isCreditSale)

  function buildPayments(): PaymentEntry[] {
    if (activeTab === 'cash') return [{ method: 'cash', amount: parseAmount(cashAmount) }]
    if (activeTab === 'card') return [{ method: 'card', amount: parseAmount(cardAmount) }]
    if (activeTab === 'mobile_money') return [{ method: 'mobile_money', amount: parseAmount(mobileAmount) }]
    const p: PaymentEntry[] = []
    const ca = parseAmount(splitAmounts.cash), cd = parseAmount(splitAmounts.card), mm = parseAmount(splitAmounts.mobile_money)
    if (ca > 0) p.push({ method: 'cash', amount: ca })
    if (cd > 0) p.push({ method: 'card', amount: cd })
    if (mm > 0) p.push({ method: 'mobile_money', amount: mm })
    return p
  }

  async function handleCompleteSale() {
    setIpcError(null); setValidationError(null)
    if (isCartEmpty) { setValidationError('Cart is empty.'); return }
    if (!currentUser) { setValidationError('No active session.'); return }
    if (isCreditSale && !selectedCustomerId) {
      setValidationError('Select a customer to register this as a credit sale.')
      return
    }
    const payload: CreateSalePayload = {
      cartItems: items, payments: buildPayments(),
      discountType: receiptDiscount.type, discountValue: receiptDiscount.value,
      isCredit: isCreditSale,
      customerId: isCreditSale ? Number(selectedCustomerId) : undefined,
      cashierId: currentUser.id,
    }
    setIsSubmitting(true)
    try {
      const result = await window.api.invoke<IpcResult<SaleResult>>('sales:create', payload)
      if (result.success) {
        clearCart(); setCashAmount(''); setCardAmount(''); setMobileAmount('')
        setSplitAmounts({ cash: '', card: '', mobile_money: '' })
        setActiveTab('cash'); setSelectedCustomerId(''); setCustomerQuery('')
        onSaleComplete?.(result.data)
      } else {
        setIpcError(result.error ?? 'Sale failed.')
      }
    } catch (err) {
      setIpcError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredCustomers = customerQuery.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(customerQuery.toLowerCase()) || (c.phone ?? '').includes(customerQuery))
    : customers

  const tabs: { id: TabId; label: string }[] = [
    { id: 'cash', label: 'Cash' }, { id: 'card', label: 'Card' },
    { id: 'mobile_money', label: 'M-Money' }, { id: 'split', label: 'Split' },
  ]

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Payment</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">Total Due</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-primary-600 dark:text-primary-400 tabular-nums">{formatCurrency(grandTotal)}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
        <div className="flex gap-1">
          {tabs.map((t) => <TabButton key={t.id} id={t.id} label={t.label} active={activeTab === t.id} onClick={setActiveTab} />)}
        </div>

        {activeTab === 'cash' && (
          <div className="flex flex-col gap-3">
            <AmountInput label="Cash Tendered" value={cashAmount} onChange={setCashAmount} autoFocus inputRef={primaryInputRef} />
            {entered > 0 && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{isCreditSale ? 'Credit Balance' : 'Change Due'}</span>
                <span className={['text-base font-bold tabular-nums',
                  isCreditSale ? 'text-amber-600 dark:text-amber-400'
                  : changeDue > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'].join(' ')}>
                  {isCreditSale ? formatCurrency(remaining) : formatCurrency(changeDue)}
                </span>
              </div>
            )}
            {isCreditSale && (
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Credit Sale — assign to customer</p>
                <input type="text" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search customer…"
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">Select customer…</option>
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {activeTab === 'card' && <AmountInput label="Card Amount" value={cardAmount} onChange={setCardAmount} autoFocus inputRef={primaryInputRef} />}
        {activeTab === 'mobile_money' && <AmountInput label="Mobile Money Amount" value={mobileAmount} onChange={setMobileAmount} autoFocus inputRef={primaryInputRef} />}

        {activeTab === 'split' && (
          <div className="flex flex-col gap-3">
            <AmountInput label="Cash" value={splitAmounts.cash} onChange={(v) => setSplitAmounts((p) => ({ ...p, cash: v }))} autoFocus inputRef={primaryInputRef} />
            <AmountInput label="Card" value={splitAmounts.card} onChange={(v) => setSplitAmounts((p) => ({ ...p, card: v }))} />
            <AmountInput label="Mobile Money" value={splitAmounts.mobile_money} onChange={(v) => setSplitAmounts((p) => ({ ...p, mobile_money: v }))} />
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 flex flex-col gap-1">
              <div className="flex justify-between"><span className="text-xs text-gray-500">Total Entered</span><span className="text-sm font-semibold tabular-nums">{formatCurrency(entered)}</span></div>
              <div className="flex justify-between"><span className="text-xs text-gray-500">Remaining</span><span className={['text-sm font-semibold tabular-nums', remaining > 0 ? 'text-red-500' : 'text-green-600'].join(' ')}>{formatCurrency(remaining)}</span></div>
            </div>
          </div>
        )}

        {(activeTab === 'card' || activeTab === 'mobile_money') && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">Remaining</span>
            <span className={['text-sm font-semibold tabular-nums', remaining > 0 ? 'text-red-500' : 'text-green-600'].join(' ')}>{formatCurrency(remaining)}</span>
          </div>
        )}

        {validationError && (
          <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-3 py-2">
            <p className="text-xs font-medium text-red-700 dark:text-red-300">{validationError}</p>
          </div>
        )}
        {ipcError && (
          <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-3 py-2">
            <p className="text-xs font-medium text-red-700 dark:text-red-300">{ipcError}</p>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <button type="button" onClick={handleCompleteSale} disabled={!canComplete || isSubmitting}
          className={['w-full min-h-[44px] rounded-lg text-sm font-semibold transition-colors',
            !canComplete || isSubmitting ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            : isCreditSale ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : 'bg-primary-600 hover:bg-primary-700 text-white'].join(' ')}>
          {isSubmitting ? 'Processing…' : isCreditSale ? 'Register Credit Sale' : 'Complete Sale'}
        </button>
      </div>
    </div>
  )
}
