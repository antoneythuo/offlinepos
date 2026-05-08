// ZReportPage — Task 27.4
// Requirements: 27.1–27.4
//
// - Date picker (defaults to today)
// - "Generate Z Report" button
// - Cash count entry (actual cash in drawer)
// - Shows expected cash, actual cash, variance
// - Print button
// - History table of past Z reports
// Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useCallback, useEffect, useState } from 'react'
import { useSessionStore } from '../store/sessionStore'
import type { IpcResult, ZReport } from '../../../src/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateTime(s: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, highlight, negative,
}: {
  label: string
  value: string
  highlight?: boolean
  negative?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${
      highlight
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-bold ${
        negative
          ? 'text-red-600 dark:text-red-400'
          : highlight
          ? 'text-blue-700 dark:text-blue-300'
          : 'text-gray-900 dark:text-gray-100'
      }`}>{value}</span>
    </div>
  )
}

// ─── Z Report detail panel ────────────────────────────────────────────────────

function ZReportDetail({
  report,
  onPrint,
  printing,
}: {
  report: ZReport
  onPrint: (id: number) => void
  printing: boolean
}) {
  const variance = report.variance ?? 0
  const varianceNegative = variance < 0

  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total Sales" value={fmt(report.totalSales)} highlight />
        <SummaryCard label="Cash Sales" value={fmt(report.cashSales)} />
        <SummaryCard label="Card Sales" value={fmt(report.cardSales)} />
        <SummaryCard label="Mobile Money" value={fmt(report.mobileMoneySales)} />
        <SummaryCard label="Total Refunds" value={fmt(report.totalRefunds)} />
        <SummaryCard label="Total Discounts" value={fmt(report.totalDiscounts)} />
        <SummaryCard label="Total Tax" value={fmt(report.totalTax)} />
        <SummaryCard label="Total Expenses" value={fmt(report.totalExpenses)} />
      </div>

      {/* Cash reconciliation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cash Reconciliation</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Opening Float" value={fmt(report.openingFloat)} />
          <SummaryCard label="Expected Cash" value={fmt(report.expectedCash)} />
          {report.actualCash !== undefined && (
            <SummaryCard label="Actual Cash" value={fmt(report.actualCash)} highlight />
          )}
          {report.variance !== undefined && (
            <SummaryCard
              label="Variance"
              value={(varianceNegative ? '-' : '+') + fmt(Math.abs(variance))}
              negative={varianceNegative}
            />
          )}
        </div>
      </div>

      {/* Print button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onPrint(report.id)}
          disabled={printing}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 transition-colors"
          aria-label="Print Z Report"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          {printing ? 'Printing…' : 'Print Z Report'}
        </button>
      </div>
    </div>
  )
}

// ─── Main ZReportPage ─────────────────────────────────────────────────────────

export default function ZReportPage(): React.ReactElement {
  const { currentUser } = useSessionStore()

  // ── Generate form state ──────────────────────────────────────────────────
  const [date, setDate] = useState(today())
  const [actualCash, setActualCash] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [currentReport, setCurrentReport] = useState<ZReport | null>(null)

  // ── History state ────────────────────────────────────────────────────────
  const [history, setHistory] = useState<ZReport[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // ── Print state ──────────────────────────────────────────────────────────
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  // ── Load history ─────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await window.api.invoke<IpcResult<ZReport[]>>('zreport:list', {})
      if (res.success) setHistory(res.data)
      else setHistoryError(res.error)
    } catch {
      setHistoryError('Failed to load Z report history.')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { void loadHistory() }, [loadHistory])

  // ── Generate Z Report ────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!currentUser) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const payload: { date: string; generatedBy: number; actualCash?: number } = {
        date,
        generatedBy: currentUser.id,
      }
      const cashVal = parseFloat(actualCash)
      if (!isNaN(cashVal) && actualCash.trim() !== '') {
        payload.actualCash = cashVal
      }
      const res = await window.api.invoke<IpcResult<ZReport>>('zreport:generate', payload)
      if (res.success) {
        setCurrentReport(res.data)
        void loadHistory()
      } else {
        setGenerateError(res.error)
      }
    } catch {
      setGenerateError('Failed to generate Z Report.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Print Z Report ───────────────────────────────────────────────────────
  async function handlePrint(zReportId: number) {
    setPrinting(true)
    setPrintError(null)
    try {
      const res = await window.api.invoke<IpcResult<{ queued: boolean }>>('zreport:print', { zReportId })
      if (!res.success) setPrintError(res.error)
    } catch {
      setPrintError('Print failed.')
    } finally {
      setPrinting(false)
    }
  }

  // ── Select from history ──────────────────────────────────────────────────
  function handleSelectHistory(report: ZReport) {
    setCurrentReport(report)
    setDate(report.reportDate)
    setActualCash(report.actualCash !== undefined ? String(report.actualCash) : '')
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Z Report — End of Day</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Generate and review end-of-day Z reports
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

        {/* ── Generate form ─────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Generate Z Report</h2>

          <div className="flex flex-wrap items-end gap-4">
            {/* Date picker */}
            <div className="flex flex-col gap-1">
              <label htmlFor="zreport-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Report Date
              </label>
              <input
                id="zreport-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actual cash entry */}
            <div className="flex flex-col gap-1">
              <label htmlFor="actual-cash" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Actual Cash in Drawer
              </label>
              <input
                id="actual-cash"
                type="number"
                min={0}
                step="0.01"
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                placeholder="0.00"
                className="min-h-[44px] w-40 px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Generate button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !date}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                  Generate Z Report
                </>
              )}
            </button>
          </div>

          {generateError && (
            <div role="alert" className="mt-3 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {generateError}
            </div>
          )}
        </section>

        {/* ── Current / selected report ─────────────────────────────────── */}
        {currentReport && (
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Z Report — {fmtDate(currentReport.reportDate)}
              </h2>
              {printError && (
                <span className="text-xs text-red-600 dark:text-red-400">{printError}</span>
              )}
            </div>
            <ZReportDetail report={currentReport} onPrint={handlePrint} printing={printing} />
          </section>
        )}

        {/* ── History table ─────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Z Report History</h2>
            <button
              type="button"
              onClick={loadHistory}
              className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
              aria-label="Refresh history"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>

          {historyLoading && (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">Loading history…</span>
            </div>
          )}
          {!historyLoading && historyError && (
            <div role="alert" className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {historyError}
            </div>
          )}
          {!historyLoading && !historyError && history.length === 0 && (
            <div className="flex items-center justify-center h-24">
              <p className="text-sm text-gray-400 dark:text-gray-500">No Z reports generated yet.</p>
            </div>
          )}
          {!historyLoading && !historyError && history.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Total Sales</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Expected Cash</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Actual Cash</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Variance</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Generated</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {history.map(r => {
                    const v = r.variance ?? 0
                    const isSelected = currentReport?.id === r.id
                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{fmtDate(r.reportDate)}</td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{fmt(r.totalSales)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{fmt(r.expectedCash)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {r.actualCash !== undefined ? fmt(r.actualCash) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${
                          v < 0 ? 'text-red-600 dark:text-red-400' : v > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {r.variance !== undefined ? ((v >= 0 ? '+' : '') + fmt(v)) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{fmtDateTime(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSelectHistory(r)}
                              title="View report"
                              aria-label="View report"
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrint(r.id)}
                              disabled={printing}
                              title="Print report"
                              aria-label="Print report"
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
