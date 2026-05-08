// Z Report generation and management
// Implements: Requirements 27.1–27.4

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import withTransaction from '../db/withTransaction'
import { AuditService } from './AuditService'
import { ConflictError } from '../errors'
import type { ZReport } from '../types/index'

// ─── Payload / Result types ───────────────────────────────────────────────────

export interface GenerateZReportPayload {
  date: string // YYYY-MM-DD format
  generatedBy: number
  actualCash?: number
}

// ─── ZReportService ───────────────────────────────────────────────────────────

export class ZReportService {
  private readonly db: Knex
  private readonly audit: AuditService

  /**
   * @param knexInstance  Optional Knex instance injected for testing.
   * @param audit         Optional AuditService injected for testing.
   */
  constructor(knexInstance?: Knex, audit?: AuditService) {
    this.db = knexInstance ?? knexDefault
    this.audit = audit ?? new AuditService(knexInstance ?? knexDefault)
  }

  // ─── generate ─────────────────────────────────────────────────────────────────

  /**
   * Generate a Z Report for a specific date.
   *
   * Steps:
   *  1. Check if a Z report already exists for the given date — if so, throw ConflictError.
   *  2. Aggregate from the `transactions` table for the given date:
   *     - total_sales (sum of grand_total for completed and credit transactions)
   *     - total_refunds (sum of total_refund from return_transactions)
   *     - total_discounts (sum of discount_amount)
   *     - total_tax (sum of tax_amount)
   *  3. Aggregate payment methods from `transaction_payments`:
   *     - cash_sales, card_sales, mobile_money_sales
   *  4. Aggregate credit payments made on that date from `credit_payments`:
   *     - cash_credit_payments (for expected_cash calculation)
   *  5. Aggregate expenses for that date from `expenses`:
   *     - total_expenses
   *     - cash_expenses (for expected_cash calculation)
   *  6. Get the opening float from the `shifts` table for that date.
   *  7. Compute expected_cash = opening_float + cash_sales + cash_credit_payments - cash_refunds - cash_expenses.
   *  8. Compute variance = actual_cash - expected_cash (if actual_cash is provided).
   *  9. Insert a `z_reports` record with all aggregated data.
   * 10. Write an audit log entry.
   * 11. Return the created z_report record.
   *
   * Requirements 27.1–27.4
   */
  async generate(payload: GenerateZReportPayload): Promise<ZReport> {
    const { date, generatedBy, actualCash } = payload

    // Step 1: Check for duplicate Z report (Requirement 27.3)
    const existing = await this.db('z_reports')
      .select('id')
      .where('report_date', date)
      .first() as { id: number } | undefined

    if (existing) {
      throw new ConflictError(
        `A Z Report for date ${date} already exists. Cannot generate duplicate Z Report.`
      )
    }

    let zReportId: number
    let reportData: ZReport

    await withTransaction(async (trx) => {
      // Step 2: Aggregate transactions for the date
      // Get all transactions created on the given date
      const transactionAgg = await trx('transactions')
        .select(
          trx.raw('COALESCE(SUM(grand_total), 0) as total_sales'),
          trx.raw('COALESCE(SUM(discount_amount), 0) as total_discounts'),
          trx.raw('COALESCE(SUM(tax_amount), 0) as total_tax')
        )
        .whereRaw('DATE(created_at) = ?', [date])
        .whereIn('status', ['completed', 'credit'])
        .first() as {
          total_sales: number
          total_discounts: number
          total_tax: number
        }

      const totalSales = Number(transactionAgg.total_sales)
      const totalDiscounts = Number(transactionAgg.total_discounts)
      const totalTax = Number(transactionAgg.total_tax)

      // Step 2b: Aggregate refunds for the date
      const refundAgg = await trx('return_transactions')
        .select(trx.raw('COALESCE(SUM(total_refund), 0) as total_refunds'))
        .whereRaw('DATE(created_at) = ?', [date])
        .first() as { total_refunds: number }

      const totalRefunds = Number(refundAgg.total_refunds)

      // Step 3: Aggregate payment methods from transaction_payments
      // Join with transactions to filter by date
      const paymentAgg = await trx('transaction_payments as tp')
        .join('transactions as t', 'tp.transaction_id', 't.id')
        .select(
          trx.raw("COALESCE(SUM(CASE WHEN tp.method = 'cash' THEN tp.amount ELSE 0 END), 0) as cash_sales"),
          trx.raw("COALESCE(SUM(CASE WHEN tp.method = 'card' THEN tp.amount ELSE 0 END), 0) as card_sales"),
          trx.raw("COALESCE(SUM(CASE WHEN tp.method = 'mobile_money' THEN tp.amount ELSE 0 END), 0) as mobile_money_sales")
        )
        .whereRaw('DATE(t.created_at) = ?', [date])
        .first() as {
          cash_sales: number
          card_sales: number
          mobile_money_sales: number
        }

      const cashSales = Number(paymentAgg.cash_sales)
      const cardSales = Number(paymentAgg.card_sales)
      const mobileMoneySales = Number(paymentAgg.mobile_money_sales)

      // Step 4: Aggregate credit payments made on that date
      const creditPaymentAgg = await trx('credit_payments')
        .select(
          trx.raw("COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0) as cash_credit_payments")
        )
        .whereRaw('DATE(created_at) = ?', [date])
        .first() as { cash_credit_payments: number }

      const cashCreditPayments = Number(creditPaymentAgg.cash_credit_payments)

      // Step 4b: Get cash refunds from return_transactions
      const cashRefundAgg = await trx('return_transactions')
        .select(
          trx.raw("COALESCE(SUM(CASE WHEN refund_method = 'cash' THEN total_refund ELSE 0 END), 0) as cash_refunds")
        )
        .whereRaw('DATE(created_at) = ?', [date])
        .first() as { cash_refunds: number }

      const cashRefunds = Number(cashRefundAgg.cash_refunds)

      // Step 5: Aggregate expenses for that date
      const expenseAgg = await trx('expenses')
        .select(trx.raw('COALESCE(SUM(amount), 0) as total_expenses'))
        .whereRaw('DATE(expense_date) = ?', [date])
        .first() as { total_expenses: number }

      const totalExpenses = Number(expenseAgg.total_expenses)

      // For now, assume all expenses are cash expenses (no payment method tracking in expenses table)
      const cashExpenses = totalExpenses

      // Step 6: Get the opening float from the shifts table for that date
      const shift = await trx('shifts')
        .select('opening_float')
        .whereRaw('DATE(opened_at) = ?', [date])
        .first() as { opening_float: number } | undefined

      const openingFloat = shift ? Number(shift.opening_float) : 0

      // Step 7: Compute expected_cash (Requirement 26.3, 27.1)
      // expected_cash = opening_float + cash_sales + cash_credit_payments - cash_refunds - cash_expenses
      const expectedCash = openingFloat + cashSales + cashCreditPayments - cashRefunds - cashExpenses

      // Step 8: Compute variance (if actual_cash is provided)
      const variance = actualCash !== undefined ? actualCash - expectedCash : null

      // Build the full report_data JSON snapshot
      const fullReportData = {
        date,
        total_sales: totalSales,
        total_refunds: totalRefunds,
        total_discounts: totalDiscounts,
        total_tax: totalTax,
        total_expenses: totalExpenses,
        cash_sales: cashSales,
        card_sales: cardSales,
        mobile_money_sales: mobileMoneySales,
        cash_credit_payments: cashCreditPayments,
        cash_refunds: cashRefunds,
        cash_expenses: cashExpenses,
        opening_float: openingFloat,
        expected_cash: expectedCash,
        actual_cash: actualCash ?? null,
        variance: variance,
        generated_by: generatedBy,
        generated_at: new Date().toISOString(),
      }

      // Step 9: Insert z_reports record
      const [insertedId] = await trx('z_reports').insert({
        report_date: date,
        generated_by: generatedBy,
        total_sales: totalSales,
        total_refunds: totalRefunds,
        total_discounts: totalDiscounts,
        total_tax: totalTax,
        total_expenses: totalExpenses,
        cash_sales: cashSales,
        card_sales: cardSales,
        mobile_money_sales: mobileMoneySales,
        opening_float: openingFloat,
        expected_cash: expectedCash,
        actual_cash: actualCash ?? null,
        variance: variance,
        report_data: JSON.stringify(fullReportData),
      })
      zReportId = insertedId

      // Fetch the created record to return
      const createdReport = await trx('z_reports')
        .select('*')
        .where('id', zReportId)
        .first() as {
          id: number
          report_date: string
          generated_by: number
          total_sales: number
          total_refunds: number
          total_discounts: number
          total_tax: number
          total_expenses: number
          cash_sales: number
          card_sales: number
          mobile_money_sales: number
          opening_float: number
          expected_cash: number
          actual_cash: number | null
          variance: number | null
          report_data: string | object
          created_at: string
        }

      reportData = {
        id: createdReport.id,
        reportDate: createdReport.report_date,
        generatedBy: createdReport.generated_by,
        totalSales: Number(createdReport.total_sales),
        totalRefunds: Number(createdReport.total_refunds),
        totalDiscounts: Number(createdReport.total_discounts),
        totalTax: Number(createdReport.total_tax),
        totalExpenses: Number(createdReport.total_expenses),
        cashSales: Number(createdReport.cash_sales),
        cardSales: Number(createdReport.card_sales),
        mobileMoneySales: Number(createdReport.mobile_money_sales),
        openingFloat: Number(createdReport.opening_float),
        expectedCash: Number(createdReport.expected_cash),
        actualCash: createdReport.actual_cash !== null ? Number(createdReport.actual_cash) : undefined,
        variance: createdReport.variance !== null ? Number(createdReport.variance) : undefined,
        reportData:
          typeof createdReport.report_data === 'string'
            ? JSON.parse(createdReport.report_data)
            : createdReport.report_data,
        createdAt: createdReport.created_at,
      }
    }, this.db)

    // Step 10: Write audit log (fire-and-forget, Requirement 27.1)
    this.audit.log({
      userId: generatedBy,
      action: 'z_report_generate',
      entityType: 'z_report',
      entityId: zReportId!,
      afterState: {
        report_date: date,
        total_sales: reportData!.totalSales,
        expected_cash: reportData!.expectedCash,
        actual_cash: actualCash ?? null,
        variance: reportData!.variance ?? null,
      },
    })

    // Step 11: Return the created z_report record
    return reportData!
  }

  // ─── list ─────────────────────────────────────────────────────────────────────

  /**
   * List all Z Reports, ordered by date descending.
   *
   * Requirements 27.4
   */
  async list(): Promise<ZReport[]> {
    const rows = await this.db('z_reports')
      .select('*')
      .orderBy('report_date', 'desc') as Array<{
        id: number
        report_date: string
        generated_by: number
        total_sales: number
        total_refunds: number
        total_discounts: number
        total_tax: number
        total_expenses: number
        cash_sales: number
        card_sales: number
        mobile_money_sales: number
        opening_float: number
        expected_cash: number
        actual_cash: number | null
        variance: number | null
        report_data: string | object
        created_at: string
      }>

    return rows.map((row) => ({
      id: row.id,
      reportDate: row.report_date,
      generatedBy: row.generated_by,
      totalSales: Number(row.total_sales),
      totalRefunds: Number(row.total_refunds),
      totalDiscounts: Number(row.total_discounts),
      totalTax: Number(row.total_tax),
      totalExpenses: Number(row.total_expenses),
      cashSales: Number(row.cash_sales),
      cardSales: Number(row.card_sales),
      mobileMoneySales: Number(row.mobile_money_sales),
      openingFloat: Number(row.opening_float),
      expectedCash: Number(row.expected_cash),
      actualCash: row.actual_cash !== null ? Number(row.actual_cash) : undefined,
      variance: row.variance !== null ? Number(row.variance) : undefined,
      reportData:
        typeof row.report_data === 'string'
          ? JSON.parse(row.report_data)
          : row.report_data,
      createdAt: row.created_at,
    }))
  }

  // ─── getByDate ────────────────────────────────────────────────────────────────

  /**
   * Get a Z Report by date.
   *
   * Requirements 27.4
   */
  async getByDate(date: string): Promise<ZReport | null> {
    const row = await this.db('z_reports')
      .select('*')
      .where('report_date', date)
      .first() as {
        id: number
        report_date: string
        generated_by: number
        total_sales: number
        total_refunds: number
        total_discounts: number
        total_tax: number
        total_expenses: number
        cash_sales: number
        card_sales: number
        mobile_money_sales: number
        opening_float: number
        expected_cash: number
        actual_cash: number | null
        variance: number | null
        report_data: string | object
        created_at: string
      } | undefined

    if (!row) {
      return null
    }

    return {
      id: row.id,
      reportDate: row.report_date,
      generatedBy: row.generated_by,
      totalSales: Number(row.total_sales),
      totalRefunds: Number(row.total_refunds),
      totalDiscounts: Number(row.total_discounts),
      totalTax: Number(row.total_tax),
      totalExpenses: Number(row.total_expenses),
      cashSales: Number(row.cash_sales),
      cardSales: Number(row.card_sales),
      mobileMoneySales: Number(row.mobile_money_sales),
      openingFloat: Number(row.opening_float),
      expectedCash: Number(row.expected_cash),
      actualCash: row.actual_cash !== null ? Number(row.actual_cash) : undefined,
      variance: row.variance !== null ? Number(row.variance) : undefined,
      reportData:
        typeof row.report_data === 'string'
          ? JSON.parse(row.report_data)
          : row.report_data,
      createdAt: row.created_at,
    }
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const zReportService = new ZReportService()
