// ReportsPage — Tasks 27.1, 27.2, 27.3
// Requirements: 16.1–16.3, 23.1–23.6, 24.1–24.5

import React, { useCallback, useEffect, useState } from 'react'
import type { IpcResult } from '../../../src/types'

interface DailySalesSummary {
  date: string; totalTransactions: number; totalRevenue: number; totalDiscounts: number
  totalTax: number; totalRefunds: number; netSales: number
  cashSales: number; cardSales: number; mobileMoneySales: number
}
interface WeeklySalesSummary {
  weekStart: string; weekEnd: string; days: DailySalesSummary[]
  totalRevenue: number; totalTransactions: number; totalDiscounts: number
  totalTax: number; totalRefunds: number; netSales: number
}
interface MonthlySalesSummary {
  month: number; year: number; days: DailySalesSummary[]
  totalRevenue: number; totalTransactions: number; totalDiscounts: number
  totalTax: number; totalRefunds: number; netSales: number
}
interface TopSellingProduct { productId: number; productName: string; sku: string; totalQuantitySold: number; totalRevenue: number; rank: number }
interface LowStockProduct { productId: number; productName: string; sku: string; categoryName: string; quantityOnHand: number; reorderPoint: number; deficit: number }
interface CreditOutstandingEntry { customerId: number; customerName: string; totalOutstanding: number; oldestDueDate: string; openTransactionCount: number }
interface ProfitLossReport { dateFrom: string; dateTo: string; totalRevenue: number; totalCogs: number; grossProfit: number; grossMarginPercent: number; totalExpenses: number; netProfit: number }
interface TaxSummaryReport { dateFrom: string; dateTo: string; totalTaxableSales: number; totalTaxCollected: number; breakdown: { taxRate: number; taxableSales: number; taxCollected: number }[] }
interface ExpenseItem { id: number; categoryName: string; amount: number; expenseDate: string; description?: string }

function today(): string { return new Date().toISOString().split('T')[0] }
function thisMonday(): string { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d.toISOString().split('T')[0] }
function fmt(n: number): string { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(s: string): string { if (!s) return '—'; return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }

type ReportType = 'daily' | 'weekly' | 'monthly' | 'topProducts' | 'lowStock' | 'creditOutstanding' | 'profitLoss' | 'taxSummary' | 'expenses'
const SIDEBAR_ITEMS: { id: ReportType; label: string }[] = [
  { id: 'daily', label: 'Daily Sales' }, { id: 'weekly', label: 'Weekly Sales' }, { id: 'monthly', label: 'Monthly Sales' },
  { id: 'topProducts', label: 'Top Products' }, { id: 'lowStock', label: 'Low Stock' }, { id: 'creditOutstanding', label: 'Credit Outstanding' },
  { id: 'profitLoss', label: 'Profit / Loss' }, { id: 'taxSummary', label: 'Tax Summary' }, { id: 'expenses', label: 'Expense Report' },
]

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
      {sub && <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>}
    </div>
  )
}
function LoadingState() { return <div className="flex items-center justify-center h-40"><span className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">Loading report…</span></div> }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex flex-col items-center justify-center h-40 gap-3"><p className="text-sm text-red-600 dark:text-red-400">{message}</p><button type="button" onClick={onRetry} className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 focus:outline-none transition-colors">Retry</button></div>
}
function EmptyState({ message }: { message: string }) { return <div className="flex items-center justify-center h-40"><p className="text-sm text-gray-400 dark:text-gray-500">{message}</p></div> }

function ExportButtons({ reportType, data, disabled }: { reportType: string; data: unknown; disabled?: boolean }) {
  const [csvLoading, setCsvLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const btnCls = "inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
  return (
    <div className="flex items-center gap-2">
      {exportError && <span className="text-xs text-red-600 dark:text-red-400">{exportError}</span>}
      <button type="button" disabled={disabled || csvLoading} aria-label="Export CSV" className={btnCls}
        onClick={async () => { setCsvLoading(true); setExportError(null); try { const r = await window.api.invoke<IpcResult<void>>('reports:export:csv', { reportType, data }); if (!r.success) setExportError(r.error) } catch { setExportError('CSV export failed.') } finally { setCsvLoading(false) } }}>
        {csvLoading ? 'Exporting…' : 'Export CSV'}
      </button>
      <button type="button" disabled={disabled || pdfLoading} aria-label="Export PDF" className={btnCls}
        onClick={async () => { setPdfLoading(true); setExportError(null); try { const r = await window.api.invoke<IpcResult<void>>('reports:export:pdf', { reportType, data }); if (!r.success) setExportError(r.error) } catch { setExportError('PDF export failed.') } finally { setPdfLoading(false) } }}>
        {pdfLoading ? 'Exporting…' : 'Export PDF'}
      </button>
    </div>
  )
}

const inputCls = "min-h-[44px] px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
const loadBtnCls = "min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"

function DailySalesViewer() {
  const [date, setDate] = useState(today())
  const [data, setData] = useState<DailySalesSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await window.api.invoke<IpcResult<DailySalesSummary>>('reports:daily', { date }); if (r.success) setData(r.data); else setError(r.error) } catch { setError('Failed to load.') } finally { setLoading(false) } }, [date])
  useEffect(() => { void load() }, [load])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="daily-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
          <input id="daily-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          <button type="button" onClick={load} className={loadBtnCls}>Load</button>
        </div>
        <ExportButtons reportType="daily" data={data} disabled={!data} />
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <SummaryCard label="Transactions" value={String(data.totalTransactions)} />
          <SummaryCard label="Total Revenue" value={fmt(data.totalRevenue)} />
          <SummaryCard label="Net Sales" value={fmt(data.netSales)} />
          <SummaryCard label="Total Tax" value={fmt(data.totalTax)} />
          <SummaryCard label="Discounts" value={fmt(data.totalDiscounts)} />
          <SummaryCard label="Refunds" value={fmt(data.totalRefunds)} />
          <SummaryCard label="Cash Sales" value={fmt(data.cashSales)} />
          <SummaryCard label="Card Sales" value={fmt(data.cardSales)} />
          <SummaryCard label="Mobile Money" value={fmt(data.mobileMoneySales)} />
        </div>
      )}
    </div>
  )
}

function WeeklySalesViewer() {
  const [weekStart, setWeekStart] = useState(thisMonday())
  const [data, setData] = useState<WeeklySalesSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await window.api.invoke<IpcResult<WeeklySalesSummary>>('reports:weekly', { weekStart }); if (r.success) setData(r.data); else setError(r.error) } catch { setError('Failed to load.') } finally { setLoading(false) } }, [weekStart])
  useEffect(() => { void load() }, [load])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="week-start" className="text-sm font-medium text-gray-700 dark:text-gray-300">Week starting</label>
          <input id="week-start" type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className={inputCls} />
          <button type="button" onClick={load} className={loadBtnCls}>Load</button>
        </div>
        <ExportButtons reportType="weekly" data={data} disabled={!data} />
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SummaryCard label="Total Revenue" value={fmt(data.totalRevenue)} sub={`${fmtDate(data.weekStart)} – ${fmtDate(data.weekEnd)}`} />
            <SummaryCard label="Transactions" value={String(data.totalTransactions)} />
            <SummaryCard label="Net Sales" value={fmt(data.netSales)} />
            <SummaryCard label="Total Tax" value={fmt(data.totalTax)} />
            <SummaryCard label="Discounts" value={fmt(data.totalDiscounts)} />
            <SummaryCard label="Refunds" value={fmt(data.totalRefunds)} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Day</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Transactions</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Revenue</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Net Sales</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.days.map(day => (
                  <tr key={day.date} className="bg-white dark:bg-gray-800 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{fmtDate(day.date)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{day.totalTransactions}</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{fmt(day.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{fmt(day.netSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function MonthlySalesViewer() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<MonthlySalesSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await window.api.invoke<IpcResult<MonthlySalesSummary>>('reports:monthly', { month, year }); if (r.success) setData(r.data); else setError(r.error) } catch { setError('Failed to load.') } finally { setLoading(false) } }, [month, year])
  useEffect(() => { void load() }, [load])
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={inputCls} aria-label="Month">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2099} className={`${inputCls} w-24`} aria-label="Year" />
          <button type="button" onClick={load} className={loadBtnCls}>Load</button>
        </div>
        <ExportButtons reportType="monthly" data={data} disabled={!data} />
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SummaryCard label="Total Revenue" value={fmt(data.totalRevenue)} sub={`${MONTHS[data.month - 1]} ${data.year}`} />
            <SummaryCard label="Transactions" value={String(data.totalTransactions)} />
            <SummaryCard label="Net Sales" value={fmt(data.netSales)} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Transactions</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Revenue</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Net Sales</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.days.filter(d => d.totalTransactions > 0).map(day => (
                  <tr key={day.date} className="bg-white dark:bg-gray-800 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{fmtDate(day.date)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{day.totalTransactions}</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{fmt(day.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{fmt(day.netSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function TopProductsViewer() {
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [dateTo, setDateTo] = useState(today())
  const [limit, setLimit] = useState(20)
  const [data, setData] = useState<TopSellingProduct[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await window.api.invoke<IpcResult<TopSellingProduct[]>>('reports:topProducts', { dateRange: { from: dateFrom, to: dateTo }, limit }); if (r.success) setData(r.data); else setError(r.error) } catch { setError('Failed to load.') } finally { setLoading(false) } }, [dateFrom, dateTo, limit])
  useEffect(() => { void load() }, [load])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} className={inputCls} aria-label="Limit">
            {[10, 20, 50].map(n => <option key={n} value={n}>Top {n}</option>)}
          </select>
          <button type="button" onClick={load} className={loadBtnCls}>Load</button>
        </div>
        <ExportButtons reportType="topProducts" data={data} disabled={!data} />
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && data.length === 0 && <EmptyState message="No sales data for this period." />}
      {!loading && !error && data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm text-left">
            <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 w-10">#</th>
              <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Product</th>
              <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Qty Sold</th>
              <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Revenue</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.map(p => (
                <tr key={p.productId} className="bg-white dark:bg-gray-800 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{p.rank}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{p.productName}</td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{fmt(p.totalQuantitySold)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{fmt(p.totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LowStockViewer() {
  const [data, setData] = useState<LowStockProduct[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await window.api.invoke<IpcResult<LowStockProduct[]>>('reports:lowStock', {}); if (r.success) setData(r.data); else setError(r.error) } catch { setError('Failed to load.') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={load} className={loadBtnCls}>Refresh</button>
        <ExportButtons reportType="lowStock" data={data} disabled={!data} />
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && data.length === 0 && <EmptyState message="No products below reorder point." />}
      {!loading && !error && data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm text-left">
            <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Product</th>
              <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Category</th>
              <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">On Hand</th>
              <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Reorder Pt</th>
              <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Deficit</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.map(p => (
                <tr key={p.productId} className="bg-white dark:bg-gray-800 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{p.productName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.categoryName}</td>
                  <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-semibold">{fmt(p.quantityOnHand)}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{fmt(p.reorderPoint)}</td>
                  <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-semibold">{fmt(p.deficit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CreditOutstandingViewer() {
  const [data, setData] = useState<CreditOutstandingEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await window.api.invoke<IpcResult<CreditOutstandingEntry[]>>('reports:creditOutstanding', {}); if (r.success) setData(r.data); else setError(r.error) } catch { setError('Failed to load.') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const total = data?.reduce((s, e) => s + e.totalOutstanding, 0) ?? 0
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={load} className={loadBtnCls}>Refresh</button>
        <ExportButtons reportType="creditOutstanding" data={data} disabled={!data} />
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && data.length === 0 && <EmptyState message="No outstanding credit." />}
      {!loading && !error && data && data.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="Total Outstanding" value={fmt(total)} />
            <SummaryCard label="Customers with Credit" value={String(data.length)} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Outstanding</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Oldest Due</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Open Txns</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.map(e => (
                  <tr key={e.customerId} className="bg-white dark:bg-gray-800 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{e.customerName}</td>
                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-semibold">{fmt(e.totalOutstanding)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.oldestDueDate ? fmtDate(e.oldestDueDate) : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{e.openTransactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function ProfitLossViewer() {
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState<ProfitLossReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await window.api.invoke<IpcResult<ProfitLossReport>>('reports:profitLoss', { dateFrom, dateTo }); if (r.success) setData(r.data); else setError(r.error) } catch { setError('Failed to load.') } finally { setLoading(false) } }, [dateFrom, dateTo])
  useEffect(() => { void load() }, [load])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          <button type="button" onClick={load} className={loadBtnCls}>Load</button>
        </div>
        <ExportButtons reportType="profitLoss" data={data} disabled={!data} />
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SummaryCard label="Total Revenue" value={fmt(data.totalRevenue)} />
          <SummaryCard label="Cost of Goods" value={fmt(data.totalCogs)} />
          <SummaryCard label="Gross Profit" value={fmt(data.grossProfit)} sub={`${data.grossMarginPercent.toFixed(1)}% margin`} />
          <SummaryCard label="Total Expenses" value={fmt(data.totalExpenses)} />
          <SummaryCard label="Net Profit" value={fmt(data.netProfit)} />
        </div>
      )}
    </div>
  )
}

function TaxSummaryViewer() {
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState<TaxSummaryReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await window.api.invoke<IpcResult<TaxSummaryReport>>('reports:taxSummary', { dateFrom, dateTo }); if (r.success) setData(r.data); else setError(r.error) } catch { setError('Failed to load.') } finally { setLoading(false) } }, [dateFrom, dateTo])
  useEffect(() => { void load() }, [load])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          <button type="button" onClick={load} className={loadBtnCls}>Load</button>
        </div>
        <ExportButtons reportType="taxSummary" data={data} disabled={!data} />
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="Total Taxable Sales" value={fmt(data.totalTaxableSales)} />
            <SummaryCard label="Total Tax Collected" value={fmt(data.totalTaxCollected)} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Tax Rate</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Taxable Sales</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Tax Collected</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.breakdown.map(b => (
                  <tr key={b.taxRate} className="bg-white dark:bg-gray-800 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{b.taxRate}%</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{fmt(b.taxableSales)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{fmt(b.taxCollected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function ExpensesViewer() {
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState<ExpenseItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await window.api.invoke<IpcResult<ExpenseItem[]>>('expenses:list', { dateFrom, dateTo }); if (r.success) setData(r.data); else setError(r.error) } catch { setError('Failed to load.') } finally { setLoading(false) } }, [dateFrom, dateTo])
  useEffect(() => { void load() }, [load])
  const total = data?.reduce((s, e) => s + e.amount, 0) ?? 0
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          <button type="button" onClick={load} className={loadBtnCls}>Load</button>
        </div>
        <ExportButtons reportType="expenses" data={data} disabled={!data} />
      </div>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && data.length === 0 && <EmptyState message="No expenses in this period." />}
      {!loading && !error && data && data.length > 0 && (
        <>
          <SummaryCard label="Total Expenses" value={fmt(total)} />
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Description</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Amount</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.map(e => (
                  <tr key={e.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(e.expenseDate)}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{e.categoryName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const VIEWERS: Record<ReportType, React.ReactElement> = {
  daily: <DailySalesViewer />,
  weekly: <WeeklySalesViewer />,
  monthly: <MonthlySalesViewer />,
  topProducts: <TopProductsViewer />,
  lowStock: <LowStockViewer />,
  creditOutstanding: <CreditOutstandingViewer />,
  profitLoss: <ProfitLossViewer />,
  taxSummary: <TaxSummaryViewer />,
  expenses: <ExpensesViewer />,
}

const VIEWER_TITLES: Record<ReportType, string> = {
  daily: 'Daily Sales Report', weekly: 'Weekly Sales Report', monthly: 'Monthly Sales Report',
  topProducts: 'Top Selling Products', lowStock: 'Low Stock Report', creditOutstanding: 'Credit Outstanding',
  profitLoss: 'Profit / Loss Report', taxSummary: 'Tax Summary', expenses: 'Expense Report',
}

export default function ReportsPage(): React.ReactElement {
  const [selected, setSelected] = useState<ReportType>('daily')
  return (
    <div className="flex h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="px-3 py-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-2 mb-2">Reports</p>
          <nav className="space-y-1">
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={[
                  'w-full text-left flex items-center px-3 py-2.5 rounded-lg text-sm font-medium min-h-[44px] transition-colors',
                  selected === item.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>
      {/* Viewer panel */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">{VIEWER_TITLES[selected]}</h1>
        {VIEWERS[selected]}
      </div>
    </div>
  )
}
