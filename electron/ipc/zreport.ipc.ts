// IPC handlers for Z Report operations
// Channels: zreport:generate, zreport:list, zreport:print
//
// Requirements 27.1–27.4

import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { zReportService } from '../../src/services/ZReportService'
import { receiptService } from '../../src/services/ReceiptService'
import type { ZReport, ReceiptData, PaymentEntry } from '../../src/types/index'
import type { GenerateZReportPayload } from '../../src/services/ZReportService'

// ─── Payload shapes ───────────────────────────────────────────────────────────

interface ZReportPrintPayload {
  /** ID of the Z report to print. Provide either this or `date`. */
  zReportId?: number
  /** Date (YYYY-MM-DD) of the Z report to print. Provide either this or `zReportId`. */
  date?: string
}

// ─── Z Report receipt formatter ───────────────────────────────────────────────

/**
 * Format a ZReport as a ReceiptData object suitable for printing on a
 * thermal receipt printer via ReceiptService.printReceipt().
 *
 * Because a Z Report is not a sales transaction, we build a synthetic
 * ReceiptData where each summary figure is represented as a line item.
 */
function formatZReportAsReceipt(report: ZReport, businessName: string): ReceiptData {
  const now = new Date(report.createdAt)

  // Build line items representing the Z report summary sections
  const items: ReceiptData['items'] = [
    {
      productName: 'Total Sales',
      sku: '',
      quantity: 1,
      unitPrice: report.totalSales,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.totalSales,
    },
    {
      productName: '  Cash Sales',
      sku: '',
      quantity: 1,
      unitPrice: report.cashSales,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.cashSales,
    },
    {
      productName: '  Card Sales',
      sku: '',
      quantity: 1,
      unitPrice: report.cardSales,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.cardSales,
    },
    {
      productName: '  Mobile Money',
      sku: '',
      quantity: 1,
      unitPrice: report.mobileMoneySales,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.mobileMoneySales,
    },
    {
      productName: 'Total Refunds',
      sku: '',
      quantity: 1,
      unitPrice: report.totalRefunds,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.totalRefunds,
    },
    {
      productName: 'Total Discounts',
      sku: '',
      quantity: 1,
      unitPrice: report.totalDiscounts,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.totalDiscounts,
    },
    {
      productName: 'Total Tax Collected',
      sku: '',
      quantity: 1,
      unitPrice: report.totalTax,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.totalTax,
    },
    {
      productName: 'Total Expenses',
      sku: '',
      quantity: 1,
      unitPrice: report.totalExpenses,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.totalExpenses,
    },
    {
      productName: 'Opening Float',
      sku: '',
      quantity: 1,
      unitPrice: report.openingFloat,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.openingFloat,
    },
    {
      productName: 'Expected Cash',
      sku: '',
      quantity: 1,
      unitPrice: report.expectedCash,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.expectedCash,
    },
  ]

  // Append actual cash and variance when the report has been reconciled
  if (report.actualCash !== undefined) {
    items.push({
      productName: 'Actual Cash',
      sku: '',
      quantity: 1,
      unitPrice: report.actualCash,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.actualCash,
    })
  }

  if (report.variance !== undefined) {
    items.push({
      productName: 'Variance',
      sku: '',
      quantity: 1,
      unitPrice: report.variance,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: report.variance,
    })
  }

  // Net cash position: use actual cash when available, otherwise expected cash
  const netCash = report.actualCash ?? report.expectedCash

  const payments: PaymentEntry[] = [{ method: 'cash', amount: netCash }]

  return {
    transactionRef: `Z-${report.reportDate}`,
    dateTime: now.toISOString(),
    cashierName: `Report #${report.id}`,
    items,
    subtotal: report.totalSales,
    discountAmount: report.totalDiscounts,
    taxAmount: report.totalTax,
    grandTotal: netCash,
    payments,
    changeAmount: 0,
    businessName,
    receiptHeader: `*** Z REPORT — ${report.reportDate} ***`,
    receiptFooter: 'End of Day Report',
    isDuplicate: false,
  }
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerZReportHandlers(): void {
  /**
   * zreport:generate
   *
   * Generates an end-of-day Z Report for the given date. Aggregates all
   * transactions, payments, refunds, expenses, and shift data for that date.
   * Prevents duplicate Z reports for the same date (ConflictError is returned
   * as a failed IpcResult unless the Administrator explicitly overrides).
   *
   * Requires "reports" permission (Manager or Administrator).
   *
   * Payload:  GenerateZReportPayload { date: string, generatedBy: number, actualCash?: number }
   * Response: IpcResult<ZReport>
   *
   * Requirements 27.1–27.3
   */
  registerHandler<ZReport>('zreport:generate', async (payload) => {
    requirePermission('reports')
    return zReportService.generate(payload as GenerateZReportPayload)
  })

  /**
   * zreport:list
   *
   * Returns all past Z Reports ordered by report date descending.
   * Accessible to Manager and Administrator roles.
   *
   * Payload:  (none)
   * Response: IpcResult<ZReport[]>
   *
   * Requirements 27.4
   */
  registerHandler<ZReport[]>('zreport:list', async () => {
    requirePermission('reports')
    return zReportService.list()
  })

  /**
   * zreport:print
   *
   * Prints a Z Report to the configured thermal receipt printer.
   * Formats the Z report data as a structured receipt and sends ESC/POS
   * commands via ReceiptService.printReceipt().
   *
   * If the printer is unavailable, returns { queued: true } without failing
   * so the UI can show a "Print when ready" option (Requirement 15.5).
   *
   * Requires "reports" permission (Manager or Administrator).
   *
   * Payload:  ZReportPrintPayload — provide either `zReportId` or `date`
   * Response: IpcResult<{ queued: boolean }>
   *
   * Requirements 27.2
   */
  registerHandler<{ queued: boolean }>('zreport:print', async (payload) => {
    requirePermission('reports')

    const { zReportId, date } = (payload ?? {}) as ZReportPrintPayload

    let report: ZReport | null = null

    if (zReportId !== undefined) {
      // Fetch by ID — scan the full list since ZReportService exposes list() and getByDate()
      const allReports = await zReportService.list()
      report = allReports.find((r) => r.id === zReportId) ?? null
    } else if (date !== undefined) {
      report = await zReportService.getByDate(date)
    }

    if (!report) {
      throw new Error(
        zReportId !== undefined
          ? `Z Report with id ${zReportId} not found`
          : `Z Report for date ${date ?? 'unknown'} not found`
      )
    }

    // Retrieve the business name from settings for the receipt header
    const { default: knex } = await import('../../src/db/knex')
    const settingRow = await knex('settings')
      .select('value')
      .where('key_name', 'businessName')
      .first() as { value: string } | undefined

    const businessName = settingRow?.value ?? 'Business'

    // Format the Z report as a receipt and send to the printer
    const receiptData: ReceiptData = formatZReportAsReceipt(report, businessName)
    return receiptService.printReceipt(receiptData)
  })
}
