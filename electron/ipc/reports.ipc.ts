// IPC handlers for reporting operations
// Channels: reports:daily, reports:weekly, reports:monthly, reports:topProducts,
//           reports:lowStock, reports:creditOutstanding, reports:profitLoss,
//           reports:taxSummary, reports:export:pdf, reports:export:csv
//
// Z Report handlers (zreport:generate, zreport:list, zreport:print) are in
// zreport.ipc.ts and registered separately via registerZReportHandlers().
//
// Requirements 23.1–23.6, 24.1–24.5

import { dialog } from 'electron'
import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { reportService } from '../../src/services/ReportService'
import { pdfExportService } from '../../src/services/PdfExportService'
import { CsvExportService } from '../../src/services/CsvExportService'
import type {
  DailySalesSummary,
  WeeklySalesSummary,
  MonthlySalesSummary,
  TopSellingProduct,
  LowStockProduct,
  CreditOutstandingEntry,
  ProfitLossReport,
  TaxSummaryReport,
  DateRange,
} from '../../src/services/ReportService'
import type { ReportData, PdfExportResult } from '../../src/services/PdfExportService'
import type { CrossBranchSummary } from '../../src/types'

// ─── Payload shapes ───────────────────────────────────────────────────────────

interface DailyPayload  { date: string }
interface WeeklyPayload { weekStart: string }
interface MonthlyPayload { month: number; year: number }
interface TopProductsPayload { dateRange: DateRange; limit?: number }
interface PdfExportPayload { report: ReportData; filePath?: string }
interface CsvExportPayload { type: string; dateRange?: DateRange; filePath?: string }

// ─── Helper: get business name from settings ──────────────────────────────────

async function getBusinessName(): Promise<string> {
  const { default: knex } = await import('../../src/db/knex')
  const row = await knex('settings')
    .select('value')
    .where('key_name', 'businessName')
    .first() as { value: string } | undefined
  return row?.value ?? 'Business'
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerReportHandlers(): void {
  /**
   * reports:daily
   * Generate a daily sales summary for a specific date.
   * Payload:  { date: string }  (YYYY-MM-DD)
   * Response: IpcResult<DailySalesSummary>
   * Requirements 23.1, 16.1
   */
  registerHandler<DailySalesSummary>('reports:daily', async (payload) => {
    requirePermission('reports')
    const { date } = payload as DailyPayload
    return reportService.dailySales(date)
  })

  /**
   * reports:weekly
   * Generate a weekly sales summary starting from weekStart.
   * Payload:  { weekStart: string }  (YYYY-MM-DD, Monday of the week)
   * Response: IpcResult<WeeklySalesSummary>
   * Requirements 23.2
   */
  registerHandler<WeeklySalesSummary>('reports:weekly', async (payload) => {
    requirePermission('reports')
    const { weekStart } = payload as WeeklyPayload
    return reportService.weeklySales(weekStart)
  })

  /**
   * reports:monthly
   * Generate a monthly sales summary for a given month and year.
   * Payload:  { month: number, year: number }
   * Response: IpcResult<MonthlySalesSummary>
   * Requirements 23.3
   */
  registerHandler<MonthlySalesSummary>('reports:monthly', async (payload) => {
    requirePermission('reports')
    const { month, year } = payload as MonthlyPayload
    return reportService.monthlySales(month, year)
  })

  /**
   * reports:topProducts
   * Generate a top selling products report for a date range.
   * Payload:  { dateRange: DateRange, limit?: number }
   * Response: IpcResult<TopSellingProduct[]>
   * Requirements 23.4
   */
  registerHandler<TopSellingProduct[]>('reports:topProducts', async (payload) => {
    requirePermission('reports')
    const { dateRange, limit } = payload as TopProductsPayload
    return reportService.topSellingProducts(dateRange, limit)
  })

  /**
   * reports:lowStock
   * List all products at or below their reorder point.
   * Payload:  (none)
   * Response: IpcResult<LowStockProduct[]>
   * Requirements 4.3, 24.1
   */
  registerHandler<LowStockProduct[]>('reports:lowStock', async () => {
    requirePermission('reports')
    return reportService.lowStockReport()
  })

  /**
   * reports:creditOutstanding
   * List all customers with open credit balances.
   * Payload:  (none)
   * Response: IpcResult<CreditOutstandingEntry[]>
   * Requirements 24.2
   */
  registerHandler<CreditOutstandingEntry[]>('reports:creditOutstanding', async () => {
    requirePermission('reports')
    return reportService.creditOutstandingReport()
  })

  /**
   * reports:profitLoss
   * Generate a profit/loss report for a date range.
   * Payload:  { dateRange: DateRange }
   * Response: IpcResult<ProfitLossReport>
   * Requirements 24.4
   */
  registerHandler<ProfitLossReport>('reports:profitLoss', async (payload) => {
    requirePermission('reports')
    const p = payload as { dateRange?: DateRange; dateFrom?: string; dateTo?: string }
    const dateRange: DateRange = p.dateRange ?? { from: p.dateFrom ?? '', to: p.dateTo ?? '' }
    return reportService.profitLoss(dateRange)
  })

  registerHandler<TaxSummaryReport>('reports:taxSummary', async (payload) => {
    requirePermission('reports')
    const p = payload as { dateRange?: DateRange; dateFrom?: string; dateTo?: string }
    const dateRange: DateRange = p.dateRange ?? { from: p.dateFrom ?? '', to: p.dateTo ?? '' }
    return reportService.taxSummary(dateRange)
  })

  /**
   * reports:export:pdf
   *
   * Export any report type to a PDF file using Puppeteer.
   * If `filePath` is not provided in the payload, opens a native Save dialog
   * so the user can choose where to save the file.
   *
   * Payload:  { report: ReportData, filePath?: string }
   * Response: IpcResult<PdfExportResult>
   * Requirements 23.6, 24.5
   */
  registerHandler<PdfExportResult>('reports:export:pdf', async (payload) => {
    requirePermission('reports')

    const { report, filePath: providedPath } = payload as PdfExportPayload

    // Determine the save path — use provided path or prompt the user
    let savePath = providedPath
    if (!savePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Report as PDF',
        defaultPath: `report-${Date.now()}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      })

      if (result.canceled || !result.filePath) {
        throw new Error('PDF export cancelled by user')
      }
      savePath = result.filePath
    }

    const businessName = await getBusinessName()
    return pdfExportService.exportToPdf(report, savePath, businessName)
  })

  /**
   * reports:export:csv
   *
   * Export report data to a CSV file.
   * Uses the existing CsvExportService for product exports; for other report
   * types, generates a flat CSV from the report data.
   *
   * Payload:  { type: string, dateRange?: DateRange, filePath?: string }
   * Response: IpcResult<{ filePath: string }>
   * Requirements 23.6
   */
  registerHandler<{ filePath: string }>('reports:export:csv', async (payload) => {
    requirePermission('reports')

    const { type, dateRange, filePath: providedPath } = payload as CsvExportPayload

    // Determine the save path
    let savePath = providedPath
    if (!savePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Report as CSV',
        defaultPath: `${type}-report-${Date.now()}.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      })

      if (result.canceled || !result.filePath) {
        throw new Error('CSV export cancelled by user')
      }
      savePath = result.filePath
    }

    // For inventory/product exports, delegate to CsvExportService
    if (type === 'inventory' || type === 'products') {
      const csvExportService = new CsvExportService()
      await csvExportService.exportProducts(savePath)
      return { filePath: savePath }
    }

    // For other report types, fetch data and write a generic CSV
    const { writeFile } = await import('fs/promises')
    const Papa = await import('papaparse')

    let rows: Record<string, unknown>[] = []

    if (type === 'daily' && dateRange) {
      const data = await reportService.dailySales(dateRange.from)
      rows = [data as unknown as Record<string, unknown>]
    } else if (type === 'topProducts' && dateRange) {
      rows = (await reportService.topSellingProducts(dateRange)) as unknown as Record<string, unknown>[]
    } else if (type === 'lowStock') {
      rows = (await reportService.lowStockReport()) as unknown as Record<string, unknown>[]
    } else if (type === 'creditOutstanding') {
      rows = (await reportService.creditOutstandingReport()) as unknown as Record<string, unknown>[]
    } else if (type === 'profitLoss' && dateRange) {
      const data = await reportService.profitLoss(dateRange)
      rows = [data as unknown as Record<string, unknown>]
    } else if (type === 'taxSummary' && dateRange) {
      const data = await reportService.taxSummary(dateRange)
      rows = data.breakdown as unknown as Record<string, unknown>[]
    }

    const csv = Papa.default.unparse(rows)
    await writeFile(savePath, csv, 'utf-8')

    return { filePath: savePath }
  })

  /**
   * reports:crossBranch
   *
   * Generate a consolidated cross-branch sales summary for a date range.
   * Returns one row per branch (plus a null-branch row for unassigned transactions).
   * Restricted to Administrator role — enforced here via requirePermission('reports').
   *
   * Payload:  { dateRange: DateRange }
   * Response: IpcResult<CrossBranchSummary[]>
   * Requirements 31.2
   */
  registerHandler<CrossBranchSummary[]>('reports:crossBranch', async (payload) => {
    requirePermission('reports')
    const { dateRange } = payload as { dateRange: DateRange }
    return reportService.crossBranchSummary(dateRange)
  })
}
