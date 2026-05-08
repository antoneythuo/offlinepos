// PDF export service using Puppeteer
// Renders report data to HTML and prints to PDF via headless Chromium.
// Implements: Requirements 23.6, 24.5

import { writeFile } from 'fs/promises'
import type {
  DailySalesSummary,
  WeeklySalesSummary,
  MonthlySalesSummary,
  TopSellingProduct,
  LowStockProduct,
  CreditOutstandingEntry,
  ProfitLossReport,
  TaxSummaryReport,
} from './ReportService'
import type { ZReport } from '../types/index'

// ─── Union type for all supported report data ─────────────────────────────────

export type ReportData =
  | { type: 'daily'; data: DailySalesSummary }
  | { type: 'weekly'; data: WeeklySalesSummary }
  | { type: 'monthly'; data: MonthlySalesSummary }
  | { type: 'topProducts'; data: TopSellingProduct[] }
  | { type: 'lowStock'; data: LowStockProduct[] }
  | { type: 'creditOutstanding'; data: CreditOutstandingEntry[] }
  | { type: 'profitLoss'; data: ProfitLossReport }
  | { type: 'taxSummary'; data: TaxSummaryReport }
  | { type: 'zReport'; data: ZReport }

export interface PdfExportResult {
  filePath: string
}

// ─── Currency formatter ───────────────────────────────────────────────────────

function fmt(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── HTML template helpers ────────────────────────────────────────────────────

/** Shared inline CSS for all report PDFs */
const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    padding: 32px 40px;
    line-height: 1.5;
  }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; color: #111; }
  h2 { font-size: 14px; font-weight: 600; margin: 20px 0 8px; color: #333; }
  .subtitle { font-size: 12px; color: #555; margin-bottom: 24px; }
  .meta { display: flex; gap: 32px; margin-bottom: 24px; }
  .meta-item { display: flex; flex-direction: column; }
  .meta-label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.05em; }
  .meta-value { font-size: 14px; font-weight: 600; color: #111; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th {
    background: #f0f0f0;
    text-align: left;
    padding: 8px 10px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #555;
    border-bottom: 2px solid #ddd;
  }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #fafafa; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .summary-box {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .summary-card {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px 16px;
    background: #fafafa;
  }
  .summary-card .label { font-size: 10px; text-transform: uppercase; color: #888; }
  .summary-card .value { font-size: 16px; font-weight: 700; color: #111; margin-top: 2px; }
  .badge-low { color: #c0392b; font-weight: 600; }
  .badge-ok  { color: #27ae60; }
  .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; }
  @media print { body { padding: 0; } }
`

function wrapHtml(title: string, businessName: string, body: string): string {
  const generated = new Date().toLocaleString()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <h1>${businessName}</h1>
  <div class="subtitle">${title}</div>
  ${body}
  <div class="footer">Generated on ${generated}</div>
</body>
</html>`
}

function summaryCard(label: string, value: string): string {
  return `<div class="summary-card"><div class="label">${label}</div><div class="value">${value}</div></div>`
}

// ─── Per-report HTML generators ───────────────────────────────────────────────

function renderDaily(data: DailySalesSummary): string {
  return `
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Date</span><span class="meta-value">${data.date}</span></div>
    </div>
    <div class="summary-box">
      ${summaryCard('Total Transactions', String(data.totalTransactions))}
      ${summaryCard('Total Revenue', fmt(data.totalRevenue))}
      ${summaryCard('Net Sales', fmt(data.netSales))}
      ${summaryCard('Total Discounts', fmt(data.totalDiscounts))}
      ${summaryCard('Total Tax', fmt(data.totalTax))}
      ${summaryCard('Total Refunds', fmt(data.totalRefunds))}
    </div>
    <h2>Payment Method Breakdown</h2>
    <table>
      <thead><tr><th>Method</th><th class="text-right">Amount</th></tr></thead>
      <tbody>
        <tr><td>Cash</td><td class="text-right">${fmt(data.cashSales)}</td></tr>
        <tr><td>Card</td><td class="text-right">${fmt(data.cardSales)}</td></tr>
        <tr><td>Mobile Money</td><td class="text-right">${fmt(data.mobileMoneySales)}</td></tr>
      </tbody>
    </table>`
}

function renderWeekly(data: WeeklySalesSummary): string {
  const rows = data.days.map((d) =>
    `<tr>
      <td>${d.date}</td>
      <td class="text-right">${d.totalTransactions}</td>
      <td class="text-right">${fmt(d.totalRevenue)}</td>
      <td class="text-right">${fmt(d.totalDiscounts)}</td>
      <td class="text-right">${fmt(d.totalTax)}</td>
      <td class="text-right">${fmt(d.totalRefunds)}</td>
      <td class="text-right">${fmt(d.netSales)}</td>
    </tr>`
  ).join('')

  return `
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Week</span><span class="meta-value">${data.weekStart} – ${data.weekEnd}</span></div>
    </div>
    <div class="summary-box">
      ${summaryCard('Total Revenue', fmt(data.totalRevenue))}
      ${summaryCard('Net Sales', fmt(data.netSales))}
      ${summaryCard('Total Transactions', String(data.totalTransactions))}
    </div>
    <h2>Daily Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th><th class="text-right">Txns</th><th class="text-right">Revenue</th>
          <th class="text-right">Discounts</th><th class="text-right">Tax</th>
          <th class="text-right">Refunds</th><th class="text-right">Net Sales</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

function renderMonthly(data: MonthlySalesSummary): string {
  const monthName = new Date(data.year, data.month - 1, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const rows = data.days
    .filter((d) => d.totalTransactions > 0)
    .map((d) =>
      `<tr>
        <td>${d.date}</td>
        <td class="text-right">${d.totalTransactions}</td>
        <td class="text-right">${fmt(d.totalRevenue)}</td>
        <td class="text-right">${fmt(d.totalDiscounts)}</td>
        <td class="text-right">${fmt(d.totalTax)}</td>
        <td class="text-right">${fmt(d.totalRefunds)}</td>
        <td class="text-right">${fmt(d.netSales)}</td>
      </tr>`
    ).join('')

  return `
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Month</span><span class="meta-value">${monthName}</span></div>
    </div>
    <div class="summary-box">
      ${summaryCard('Total Revenue', fmt(data.totalRevenue))}
      ${summaryCard('Net Sales', fmt(data.netSales))}
      ${summaryCard('Total Transactions', String(data.totalTransactions))}
    </div>
    <h2>Daily Breakdown (active days only)</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th><th class="text-right">Txns</th><th class="text-right">Revenue</th>
          <th class="text-right">Discounts</th><th class="text-right">Tax</th>
          <th class="text-right">Refunds</th><th class="text-right">Net Sales</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7" class="text-center">No transactions this month</td></tr>'}</tbody>
    </table>`
}

function renderTopProducts(data: TopSellingProduct[]): string {
  const rows = data.map((p) =>
    `<tr>
      <td class="text-center">${p.rank}</td>
      <td>${p.productName}</td>
      <td>${p.sku}</td>
      <td class="text-right">${fmt(p.totalQuantitySold)}</td>
      <td class="text-right">${fmt(p.totalRevenue)}</td>
    </tr>`
  ).join('')

  return `
    <h2>Top Selling Products</h2>
    <table>
      <thead>
        <tr>
          <th class="text-center">#</th><th>Product</th><th>SKU</th>
          <th class="text-right">Qty Sold</th><th class="text-right">Revenue</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5" class="text-center">No data</td></tr>'}</tbody>
    </table>`
}

function renderLowStock(data: LowStockProduct[]): string {
  const rows = data.map((p) =>
    `<tr>
      <td>${p.productName}</td>
      <td>${p.sku}</td>
      <td>${p.categoryName}</td>
      <td class="text-right ${p.quantityOnHand <= 0 ? 'badge-low' : ''}">${fmt(p.quantityOnHand)}</td>
      <td class="text-right">${fmt(p.reorderPoint)}</td>
      <td class="text-right badge-low">${fmt(p.deficit)}</td>
    </tr>`
  ).join('')

  return `
    <div class="summary-box" style="grid-template-columns: repeat(2,1fr)">
      ${summaryCard('Products Below Reorder Point', String(data.length))}
      ${summaryCard('Total Deficit Units', fmt(data.reduce((s, p) => s + p.deficit, 0)))}
    </div>
    <h2>Low Stock Products</h2>
    <table>
      <thead>
        <tr>
          <th>Product</th><th>SKU</th><th>Category</th>
          <th class="text-right">On Hand</th><th class="text-right">Reorder Point</th>
          <th class="text-right">Deficit</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6" class="text-center">All products are adequately stocked</td></tr>'}</tbody>
    </table>`
}

function renderCreditOutstanding(data: CreditOutstandingEntry[]): string {
  const totalOutstanding = data.reduce((s, c) => s + c.totalOutstanding, 0)
  const rows = data.map((c) =>
    `<tr>
      <td>${c.customerName}</td>
      <td>${c.customerPhone ?? '—'}</td>
      <td class="text-right">${c.openTransactionCount}</td>
      <td class="text-right badge-low">${fmt(c.totalOutstanding)}</td>
      <td>${c.oldestDueDate ?? '—'}</td>
    </tr>`
  ).join('')

  return `
    <div class="summary-box" style="grid-template-columns: repeat(2,1fr)">
      ${summaryCard('Customers with Open Credit', String(data.length))}
      ${summaryCard('Total Outstanding', fmt(totalOutstanding))}
    </div>
    <h2>Credit Outstanding by Customer</h2>
    <table>
      <thead>
        <tr>
          <th>Customer</th><th>Phone</th><th class="text-right">Open Txns</th>
          <th class="text-right">Outstanding</th><th>Oldest Due Date</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5" class="text-center">No outstanding credit</td></tr>'}</tbody>
    </table>`
}

function renderProfitLoss(data: ProfitLossReport): string {
  return `
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Period</span><span class="meta-value">${data.dateFrom} – ${data.dateTo}</span></div>
    </div>
    <div class="summary-box">
      ${summaryCard('Total Revenue', fmt(data.totalRevenue))}
      ${summaryCard('Total COGS', fmt(data.totalCogs))}
      ${summaryCard('Gross Profit', fmt(data.grossProfit))}
      ${summaryCard('Gross Margin', data.grossMarginPercent.toFixed(1) + '%')}
      ${summaryCard('Total Expenses', fmt(data.totalExpenses))}
      ${summaryCard('Net Profit', fmt(data.netProfit))}
    </div>
    <h2>Profit &amp; Loss Summary</h2>
    <table>
      <thead><tr><th>Line Item</th><th class="text-right">Amount</th></tr></thead>
      <tbody>
        <tr><td>Total Revenue</td><td class="text-right">${fmt(data.totalRevenue)}</td></tr>
        <tr><td>Cost of Goods Sold (COGS)</td><td class="text-right">(${fmt(data.totalCogs)})</td></tr>
        <tr><td><strong>Gross Profit</strong></td><td class="text-right"><strong>${fmt(data.grossProfit)}</strong></td></tr>
        <tr><td>Total Expenses</td><td class="text-right">(${fmt(data.totalExpenses)})</td></tr>
        <tr><td><strong>Net Profit</strong></td><td class="text-right"><strong>${fmt(data.netProfit)}</strong></td></tr>
      </tbody>
    </table>`
}

function renderTaxSummary(data: TaxSummaryReport): string {
  const rows = data.breakdown.map((r) =>
    `<tr>
      <td class="text-right">${r.taxRate.toFixed(2)}%</td>
      <td class="text-right">${fmt(r.taxableSales)}</td>
      <td class="text-right">${fmt(r.taxCollected)}</td>
    </tr>`
  ).join('')

  return `
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Period</span><span class="meta-value">${data.dateFrom} – ${data.dateTo}</span></div>
    </div>
    <div class="summary-box" style="grid-template-columns: repeat(2,1fr)">
      ${summaryCard('Total Taxable Sales', fmt(data.totalTaxableSales))}
      ${summaryCard('Total Tax Collected', fmt(data.totalTaxCollected))}
    </div>
    <h2>Tax Breakdown by Rate</h2>
    <table>
      <thead>
        <tr>
          <th class="text-right">Tax Rate</th>
          <th class="text-right">Taxable Sales</th>
          <th class="text-right">Tax Collected</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="3" class="text-center">No taxable sales in this period</td></tr>'}</tbody>
    </table>`
}

function renderZReport(data: ZReport): string {
  return `
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Report Date</span><span class="meta-value">${data.reportDate}</span></div>
    </div>
    <div class="summary-box">
      ${summaryCard('Total Sales', fmt(data.totalSales))}
      ${summaryCard('Total Refunds', fmt(data.totalRefunds))}
      ${summaryCard('Total Discounts', fmt(data.totalDiscounts))}
      ${summaryCard('Total Tax', fmt(data.totalTax))}
      ${summaryCard('Total Expenses', fmt(data.totalExpenses))}
      ${summaryCard('Net Cash Position', fmt(data.actualCash ?? data.expectedCash))}
    </div>
    <h2>Sales by Payment Method</h2>
    <table>
      <thead><tr><th>Method</th><th class="text-right">Amount</th></tr></thead>
      <tbody>
        <tr><td>Cash</td><td class="text-right">${fmt(data.cashSales)}</td></tr>
        <tr><td>Card</td><td class="text-right">${fmt(data.cardSales)}</td></tr>
        <tr><td>Mobile Money</td><td class="text-right">${fmt(data.mobileMoneySales)}</td></tr>
      </tbody>
    </table>
    <h2>Cash Drawer Reconciliation</h2>
    <table>
      <thead><tr><th>Item</th><th class="text-right">Amount</th></tr></thead>
      <tbody>
        <tr><td>Opening Float</td><td class="text-right">${fmt(data.openingFloat)}</td></tr>
        <tr><td>Expected Cash</td><td class="text-right">${fmt(data.expectedCash)}</td></tr>
        ${data.actualCash !== undefined ? `<tr><td>Actual Cash</td><td class="text-right">${fmt(data.actualCash)}</td></tr>` : ''}
        ${data.variance !== undefined ? `<tr><td>Variance</td><td class="text-right ${data.variance < 0 ? 'badge-low' : 'badge-ok'}">${fmt(data.variance)}</td></tr>` : ''}
      </tbody>
    </table>`
}

// ─── Main HTML builder ────────────────────────────────────────────────────────

function buildReportTitle(report: ReportData): string {
  switch (report.type) {
    case 'daily':        return `Daily Sales Report — ${report.data.date}`
    case 'weekly':       return `Weekly Sales Report — ${report.data.weekStart} to ${report.data.weekEnd}`
    case 'monthly':      return `Monthly Sales Report — ${new Date(report.data.year, report.data.month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}`
    case 'topProducts':  return 'Top Selling Products Report'
    case 'lowStock':     return 'Low Stock Report'
    case 'creditOutstanding': return 'Credit Outstanding Report'
    case 'profitLoss':   return `Profit & Loss Report — ${report.data.dateFrom} to ${report.data.dateTo}`
    case 'taxSummary':   return `Tax / VAT Summary — ${report.data.dateFrom} to ${report.data.dateTo}`
    case 'zReport':      return `Z Report — ${report.data.reportDate}`
  }
}

function buildReportBody(report: ReportData): string {
  switch (report.type) {
    case 'daily':             return renderDaily(report.data)
    case 'weekly':            return renderWeekly(report.data)
    case 'monthly':           return renderMonthly(report.data)
    case 'topProducts':       return renderTopProducts(report.data)
    case 'lowStock':          return renderLowStock(report.data)
    case 'creditOutstanding': return renderCreditOutstanding(report.data)
    case 'profitLoss':        return renderProfitLoss(report.data)
    case 'taxSummary':        return renderTaxSummary(report.data)
    case 'zReport':           return renderZReport(report.data)
  }
}

/**
 * Build a complete, self-contained HTML string for the given report.
 * Exported for testing purposes.
 */
export function buildReportHtml(report: ReportData, businessName: string): string {
  const title = buildReportTitle(report)
  const body = buildReportBody(report)
  return wrapHtml(title, businessName, body)
}

// ─── PdfExportService ─────────────────────────────────────────────────────────

export class PdfExportService {
  /**
   * Export a report to PDF at the given file path.
   *
   * Uses Puppeteer to launch headless Chromium, load the generated HTML,
   * and print to PDF with A4 paper size and sensible margins.
   *
   * @param report       The report data (typed union — any supported report type).
   * @param filePath     Absolute path where the PDF should be saved.
   * @param businessName Business name shown in the report header.
   * @returns            `{ filePath }` on success.
   */
  async exportToPdf(
    report: ReportData,
    filePath: string,
    businessName = 'Business'
  ): Promise<PdfExportResult> {
    // Dynamic import so Puppeteer is only loaded when actually needed
    // (avoids slowing down the main process startup).
    const puppeteer = await import('puppeteer')

    const html = buildReportHtml(report, businessName)

    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })

    try {
      const page = await browser.newPage()

      // Load the HTML directly — no network round-trip needed
      await page.setContent(html, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm',
        },
      })

      await writeFile(filePath, pdfBuffer)
    } finally {
      await browser.close()
    }

    return { filePath }
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const pdfExportService = new PdfExportService()
