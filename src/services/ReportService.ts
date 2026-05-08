// Sales, inventory, and financial reporting
// Implements: Requirements 23.1–23.6, 24.1–24.5, 31.2

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import type { CrossBranchSummary } from '../types'

// ─── Report data types ────────────────────────────────────────────────────────

export interface DailySalesSummary {
  date: string
  totalTransactions: number
  totalRevenue: number
  totalDiscounts: number
  totalTax: number
  totalRefunds: number
  netSales: number
  cashSales: number
  cardSales: number
  mobileMoneySales: number
}

export interface WeeklySalesSummary {
  weekStart: string
  weekEnd: string
  days: DailySalesSummary[]
  totalRevenue: number
  totalTransactions: number
  totalDiscounts: number
  totalTax: number
  totalRefunds: number
  netSales: number
}

export interface MonthlySalesSummary {
  month: number
  year: number
  days: DailySalesSummary[]
  totalRevenue: number
  totalTransactions: number
  totalDiscounts: number
  totalTax: number
  totalRefunds: number
  netSales: number
}

export interface TopSellingProduct {
  productId: number
  productName: string
  sku: string
  totalQuantitySold: number
  totalRevenue: number
  rank: number
}

export interface LowStockProduct {
  productId: number
  productName: string
  sku: string
  categoryName: string
  quantityOnHand: number
  reorderPoint: number
  deficit: number
}

export interface CreditOutstandingEntry {
  customerId: number
  customerName: string
  customerPhone?: string
  totalOutstanding: number
  oldestDueDate: string
  openTransactionCount: number
}

export interface ProfitLossReport {
  dateFrom: string
  dateTo: string
  totalRevenue: number
  totalCogs: number
  grossProfit: number
  grossMarginPercent: number
  totalExpenses: number
  netProfit: number
}

export interface TaxRateSummary {
  taxRate: number
  taxableSales: number
  taxCollected: number
}

export interface TaxSummaryReport {
  dateFrom: string
  dateTo: string
  totalTaxableSales: number
  totalTaxCollected: number
  breakdown: TaxRateSummary[]
}

export interface DateRange {
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}

// ─── ReportService ────────────────────────────────────────────────────────────

export class ReportService {
  private readonly db: Knex

  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  // ─── Daily Sales ─────────────────────────────────────────────────────────────

  /**
   * Generate a daily sales summary for a specific date.
   * Requirements 23.1, 16.1
   */
  async dailySales(date: string): Promise<DailySalesSummary> {
    // Aggregate transactions for the date
    const txAgg = await this.db('transactions')
      .select(
        this.db.raw('COUNT(*) as total_transactions'),
        this.db.raw('COALESCE(SUM(grand_total), 0) as total_revenue'),
        this.db.raw('COALESCE(SUM(discount_amount), 0) as total_discounts'),
        this.db.raw('COALESCE(SUM(tax_amount), 0) as total_tax')
      )
      .whereRaw('DATE(created_at) = ?', [date])
      .whereIn('status', ['completed', 'credit'])
      .first() as {
        total_transactions: number
        total_revenue: number
        total_discounts: number
        total_tax: number
      }

    // Aggregate refunds
    const refundAgg = await this.db('return_transactions')
      .select(this.db.raw('COALESCE(SUM(total_refund), 0) as total_refunds'))
      .whereRaw('DATE(created_at) = ?', [date])
      .first() as { total_refunds: number }

    // Aggregate payment methods
    const payAgg = await this.db('transaction_payments as tp')
      .join('transactions as t', 'tp.transaction_id', 't.id')
      .select(
        this.db.raw("COALESCE(SUM(CASE WHEN tp.method = 'cash' THEN tp.amount ELSE 0 END), 0) as cash_sales"),
        this.db.raw("COALESCE(SUM(CASE WHEN tp.method = 'card' THEN tp.amount ELSE 0 END), 0) as card_sales"),
        this.db.raw("COALESCE(SUM(CASE WHEN tp.method = 'mobile_money' THEN tp.amount ELSE 0 END), 0) as mobile_money_sales")
      )
      .whereRaw('DATE(t.created_at) = ?', [date])
      .first() as {
        cash_sales: number
        card_sales: number
        mobile_money_sales: number
      }

    const totalRevenue = Number(txAgg.total_revenue)
    const totalRefunds = Number(refundAgg.total_refunds)

    return {
      date,
      totalTransactions: Number(txAgg.total_transactions),
      totalRevenue,
      totalDiscounts: Number(txAgg.total_discounts),
      totalTax: Number(txAgg.total_tax),
      totalRefunds,
      netSales: totalRevenue - totalRefunds,
      cashSales: Number(payAgg.cash_sales),
      cardSales: Number(payAgg.card_sales),
      mobileMoneySales: Number(payAgg.mobile_money_sales),
    }
  }

  // ─── Weekly Sales ─────────────────────────────────────────────────────────────

  /**
   * Generate a weekly sales summary starting from weekStart (YYYY-MM-DD).
   * Requirements 23.2
   */
  async weeklySales(weekStart: string): Promise<WeeklySalesSummary> {
    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const weekEnd = end.toISOString().split('T')[0]

    // Build daily summaries for each day in the week
    const days: DailySalesSummary[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const daily = await this.dailySales(dateStr)
      days.push(daily)
    }

    const totalRevenue = days.reduce((s, d) => s + d.totalRevenue, 0)
    const totalRefunds = days.reduce((s, d) => s + d.totalRefunds, 0)

    return {
      weekStart,
      weekEnd,
      days,
      totalRevenue,
      totalTransactions: days.reduce((s, d) => s + d.totalTransactions, 0),
      totalDiscounts: days.reduce((s, d) => s + d.totalDiscounts, 0),
      totalTax: days.reduce((s, d) => s + d.totalTax, 0),
      totalRefunds,
      netSales: totalRevenue - totalRefunds,
    }
  }

  // ─── Monthly Sales ────────────────────────────────────────────────────────────

  /**
   * Generate a monthly sales summary for a given month and year.
   * Requirements 23.3
   */
  async monthlySales(month: number, year: number): Promise<MonthlySalesSummary> {
    // Get number of days in the month
    const daysInMonth = new Date(year, month, 0).getDate()

    const days: DailySalesSummary[] = []
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const daily = await this.dailySales(dateStr)
      days.push(daily)
    }

    const totalRevenue = days.reduce((s, d) => s + d.totalRevenue, 0)
    const totalRefunds = days.reduce((s, d) => s + d.totalRefunds, 0)

    return {
      month,
      year,
      days,
      totalRevenue,
      totalTransactions: days.reduce((s, d) => s + d.totalTransactions, 0),
      totalDiscounts: days.reduce((s, d) => s + d.totalDiscounts, 0),
      totalTax: days.reduce((s, d) => s + d.totalTax, 0),
      totalRefunds,
      netSales: totalRevenue - totalRefunds,
    }
  }

  // ─── Top Selling Products ─────────────────────────────────────────────────────

  /**
   * Generate a top selling products report for a date range.
   * Requirements 23.4
   */
  async topSellingProducts(dateRange: DateRange, limit = 20): Promise<TopSellingProduct[]> {
    const rows = await this.db('transaction_items as ti')
      .join('transactions as t', 'ti.transaction_id', 't.id')
      .select(
        'ti.product_id as productId',
        'ti.product_name as productName',
        'ti.sku',
        this.db.raw('SUM(ti.quantity) as total_quantity_sold'),
        this.db.raw('SUM(ti.line_total) as total_revenue')
      )
      .whereRaw('DATE(t.created_at) BETWEEN ? AND ?', [dateRange.from, dateRange.to])
      .whereIn('t.status', ['completed', 'credit'])
      .groupBy('ti.product_id', 'ti.product_name', 'ti.sku')
      .orderBy('total_quantity_sold', 'desc')
      .limit(limit) as Array<{
        productId: number
        productName: string
        sku: string
        total_quantity_sold: number
        total_revenue: number
      }>

    return rows.map((row, index) => ({
      productId: Number(row.productId),
      productName: row.productName,
      sku: row.sku,
      totalQuantitySold: Number(row.total_quantity_sold),
      totalRevenue: Number(row.total_revenue),
      rank: index + 1,
    }))
  }

  // ─── Low Stock Report ─────────────────────────────────────────────────────────

  /**
   * List all products at or below their reorder point.
   * Requirements 4.3, 24.1
   */
  async lowStockReport(): Promise<LowStockProduct[]> {
    const rows = await this.db('products as p')
      .join('categories as c', 'p.category_id', 'c.id')
      .select(
        'p.id as productId',
        'p.name as productName',
        'p.sku',
        'c.name as categoryName',
        'p.quantity_on_hand as quantityOnHand',
        'p.reorder_point as reorderPoint'
      )
      .whereRaw('p.quantity_on_hand <= p.reorder_point')
      .where('p.is_active', true)
      .orderBy('p.quantity_on_hand', 'asc') as Array<{
        productId: number
        productName: string
        sku: string
        categoryName: string
        quantityOnHand: number
        reorderPoint: number
      }>

    return rows.map((row) => ({
      productId: Number(row.productId),
      productName: row.productName,
      sku: row.sku,
      categoryName: row.categoryName,
      quantityOnHand: Number(row.quantityOnHand),
      reorderPoint: Number(row.reorderPoint),
      deficit: Number(row.reorderPoint) - Number(row.quantityOnHand),
    }))
  }

  // ─── Credit Outstanding Report ────────────────────────────────────────────────

  /**
   * List all customers with open credit balances.
   * Requirements 24.2
   */
  async creditOutstandingReport(): Promise<CreditOutstandingEntry[]> {
    const rows = await this.db('transactions as t')
      .join('customers as c', 't.customer_id', 'c.id')
      .select(
        'c.id as customerId',
        'c.name as customerName',
        'c.phone as customerPhone',
        this.db.raw('SUM(t.credit_balance) as total_outstanding'),
        this.db.raw('MIN(t.credit_due_date) as oldest_due_date'),
        this.db.raw('COUNT(t.id) as open_transaction_count')
      )
      .where('t.status', 'credit')
      .whereRaw('t.credit_balance > 0')
      .groupBy('c.id', 'c.name', 'c.phone')
      .orderBy('total_outstanding', 'desc') as Array<{
        customerId: number
        customerName: string
        customerPhone?: string
        total_outstanding: number
        oldest_due_date: string
        open_transaction_count: number
      }>

    return rows.map((row) => ({
      customerId: Number(row.customerId),
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      totalOutstanding: Number(row.total_outstanding),
      oldestDueDate: row.oldest_due_date,
      openTransactionCount: Number(row.open_transaction_count),
    }))
  }

  // ─── Profit / Loss Report ─────────────────────────────────────────────────────

  /**
   * Generate a profit/loss report for a date range.
   * Requirements 24.4
   */
  async profitLoss(dateRange: DateRange): Promise<ProfitLossReport> {
    // Revenue from completed/credit transactions
    const revenueAgg = await this.db('transactions')
      .select(this.db.raw('COALESCE(SUM(grand_total), 0) as total_revenue'))
      .whereRaw('DATE(created_at) BETWEEN ? AND ?', [dateRange.from, dateRange.to])
      .whereIn('status', ['completed', 'credit'])
      .first() as { total_revenue: number }

    // COGS: sum of (cost_price × quantity) for sold items
    const cogsAgg = await this.db('transaction_items as ti')
      .join('transactions as t', 'ti.transaction_id', 't.id')
      .join('products as p', 'ti.product_id', 'p.id')
      .select(this.db.raw('COALESCE(SUM(p.cost_price * ti.quantity), 0) as total_cogs'))
      .whereRaw('DATE(t.created_at) BETWEEN ? AND ?', [dateRange.from, dateRange.to])
      .whereIn('t.status', ['completed', 'credit'])
      .first() as { total_cogs: number }

    // Total expenses
    const expenseAgg = await this.db('expenses')
      .select(this.db.raw('COALESCE(SUM(amount), 0) as total_expenses'))
      .whereRaw('DATE(expense_date) BETWEEN ? AND ?', [dateRange.from, dateRange.to])
      .first() as { total_expenses: number }

    const totalRevenue = Number(revenueAgg.total_revenue)
    const totalCogs = Number(cogsAgg.total_cogs)
    const grossProfit = totalRevenue - totalCogs
    const totalExpenses = Number(expenseAgg.total_expenses)
    const netProfit = grossProfit - totalExpenses
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    return {
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
      totalExpenses,
      netProfit,
    }
  }

  // ─── Tax Summary Report ───────────────────────────────────────────────────────

  /**
   * Generate a tax/VAT summary report grouped by tax rate.
   * Requirements 24.5
   */
  async taxSummary(dateRange: DateRange): Promise<TaxSummaryReport> {
    const rows = await this.db('transaction_items as ti')
      .join('transactions as t', 'ti.transaction_id', 't.id')
      .select(
        'ti.tax_rate as taxRate',
        this.db.raw('SUM(ti.line_total) as taxable_sales'),
        this.db.raw('SUM(ti.tax_amount) as tax_collected')
      )
      .whereRaw('DATE(t.created_at) BETWEEN ? AND ?', [dateRange.from, dateRange.to])
      .whereIn('t.status', ['completed', 'credit'])
      .where('ti.tax_rate', '>', 0)
      .groupBy('ti.tax_rate')
      .orderBy('ti.tax_rate', 'asc') as Array<{
        taxRate: number
        taxable_sales: number
        tax_collected: number
      }>

    const breakdown: TaxRateSummary[] = rows.map((row) => ({
      taxRate: Number(row.taxRate),
      taxableSales: Number(row.taxable_sales),
      taxCollected: Number(row.tax_collected),
    }))

    return {
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      totalTaxableSales: breakdown.reduce((s, r) => s + r.taxableSales, 0),
      totalTaxCollected: breakdown.reduce((s, r) => s + r.taxCollected, 0),
      breakdown,
    }
  }

  // ─── Cross-Branch Summary ─────────────────────────────────────────────────────

  /**
   * Generate a consolidated cross-branch sales summary for a date range.
   *
   * Groups transactions by branch_id (left-joining branches.name).
   * Includes a row for null branch_id (unassigned) when such transactions exist.
   * Intended for Administrator role only — permission is enforced at the IPC level.
   *
   * Requirements 31.2
   */
  async crossBranchSummary(dateRange: DateRange): Promise<CrossBranchSummary[]> {
    // Aggregate completed/credit transactions grouped by branch_id
    const txRows = await this.db('transactions as t')
      .leftJoin('branches as b', 't.branch_id', 'b.id')
      .select(
        't.branch_id as branchId',
        'b.name as branchName',
        this.db.raw('COUNT(t.id) as total_transactions'),
        this.db.raw('COALESCE(SUM(t.grand_total), 0) as total_revenue')
      )
      .whereRaw('DATE(t.created_at) BETWEEN ? AND ?', [dateRange.from, dateRange.to])
      .whereIn('t.status', ['completed', 'credit'])
      .groupBy('t.branch_id', 'b.name') as Array<{
        branchId: number | null
        branchName: string | null
        total_transactions: number
        total_revenue: number
      }>

    // Aggregate refunds grouped by branch_id (via original transaction)
    const refundRows = await this.db('return_transactions as rt')
      .join('transactions as t', 'rt.original_transaction_id', 't.id')
      .select(
        't.branch_id as branchId',
        this.db.raw('COALESCE(SUM(rt.total_refund), 0) as total_refunds')
      )
      .whereRaw('DATE(rt.created_at) BETWEEN ? AND ?', [dateRange.from, dateRange.to])
      .groupBy('t.branch_id') as Array<{
        branchId: number | null
        total_refunds: number
      }>

    // Build a lookup map: branchId (or 'null') → total_refunds
    const refundMap = new Map<string, number>()
    for (const row of refundRows) {
      const key = row.branchId === null ? 'null' : String(row.branchId)
      refundMap.set(key, Number(row.total_refunds))
    }

    return txRows.map((row) => {
      const key = row.branchId === null ? 'null' : String(row.branchId)
      const totalRevenue = Number(row.total_revenue)
      const totalRefunds = refundMap.get(key) ?? 0
      return {
        branchId: row.branchId === null ? null : Number(row.branchId),
        branchName: row.branchName ?? null,
        totalTransactions: Number(row.total_transactions),
        totalRevenue,
        totalRefunds,
        netSales: totalRevenue - totalRefunds,
      }
    })
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const reportService = new ReportService()
