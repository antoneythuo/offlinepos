import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Knex } from 'knex'
import { ZReportService } from '../../../src/services/ZReportService'
import { AuditService } from '../../../src/services/AuditService'
import { ConflictError } from '../../../src/errors'
import type { GenerateZReportPayload } from '../../../src/services/ZReportService'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_DATE = '2024-01-15'
const GENERATED_BY = 1

const BASE_PAYLOAD: GenerateZReportPayload = {
  date: TEST_DATE,
  generatedBy: GENERATED_BY,
  actualCash: 1500,
}

// Aggregation results returned by mock DB queries
const TRANSACTION_AGG = {
  total_sales: '1200.0000',
  total_discounts: '50.0000',
  total_tax: '100.0000',
}

const REFUND_AGG = { total_refunds: '80.0000' }

const PAYMENT_AGG = {
  cash_sales: '700.0000',
  card_sales: '300.0000',
  mobile_money_sales: '200.0000',
}

const CREDIT_PAYMENT_AGG = { cash_credit_payments: '100.0000' }

const CASH_REFUND_AGG = { cash_refunds: '30.0000' }

const EXPENSE_AGG = { total_expenses: '120.0000' }

const SHIFT_ROW = { opening_float: '500.0000' }

// expected_cash = 500 + 700 + 100 - 30 - 120 = 1150
const EXPECTED_CASH = 1150

const INSERTED_Z_REPORT_ROW = {
  id: 1,
  report_date: TEST_DATE,
  generated_by: GENERATED_BY,
  total_sales: '1200.0000',
  total_refunds: '80.0000',
  total_discounts: '50.0000',
  total_tax: '100.0000',
  total_expenses: '120.0000',
  cash_sales: '700.0000',
  card_sales: '300.0000',
  mobile_money_sales: '200.0000',
  opening_float: '500.0000',
  expected_cash: String(EXPECTED_CASH) + '.0000',
  actual_cash: '1500.0000',
  variance: '350.0000', // 1500 - 1150
  report_data: JSON.stringify({ date: TEST_DATE }),
  created_at: '2024-01-15T12:00:00.000Z',
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeMockAudit(): AuditService {
  return { log: vi.fn() } as unknown as AuditService
}

/**
 * Creates a mock Knex instance for ZReportService tests.
 */
function makeMockKnex(overrides: {
  existingZReport?: object | null
  insertedId?: number
  createdReportRow?: object | null
  transactionAgg?: object
  refundAgg?: object
  paymentAgg?: object
  creditPaymentAgg?: object
  cashRefundAgg?: object
  expenseAgg?: object
  shiftRow?: object | null
  listRows?: object[]
} = {}): Knex {
  const {
    existingZReport = null,
    insertedId = 1,
    createdReportRow = INSERTED_Z_REPORT_ROW,
    transactionAgg = TRANSACTION_AGG,
    refundAgg = REFUND_AGG,
    paymentAgg = PAYMENT_AGG,
    creditPaymentAgg = CREDIT_PAYMENT_AGG,
    cashRefundAgg = CASH_REFUND_AGG,
    expenseAgg = EXPENSE_AGG,
    shiftRow = SHIFT_ROW,
    listRows = [INSERTED_Z_REPORT_ROW],
  } = overrides

  // Builder for z_reports duplicate check (outer db call)
  const zReportsDuplicateBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(existingZReport),
    orderBy: vi.fn().mockResolvedValue(listRows),
  }

  // Builder for z_reports insert (inside transaction)
  const zReportsInsertBuilder = {
    insert: vi.fn().mockResolvedValue([insertedId]),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(createdReportRow),
  }

  // Aggregation query builder factory — returns a builder that resolves to the given agg result
  const makeAggBuilder = (result: object) => ({
    select: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    whereRaw: vi.fn().mockReturnThis(),
    whereIn: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(result),
  })

  // Shift builder
  const shiftBuilder = {
    select: vi.fn().mockReturnThis(),
    whereRaw: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(shiftRow),
  }

  // Track call count to distinguish between different queries on the same table
  let transactionCallCount = 0
  let returnTransactionCallCount = 0
  let creditPaymentCallCount = 0

  // The trx object used inside withTransaction callback
  // trx.raw is used for COALESCE/CASE WHEN expressions — return a passthrough object
  const trx = vi.fn((table: string) => {
    if (table === 'transactions') {
      transactionCallCount++
      if (transactionCallCount === 1) {
        // First call: aggregate totals
        return makeAggBuilder(transactionAgg)
      }
      // Subsequent calls: shouldn't happen in normal flow
      return makeAggBuilder(transactionAgg)
    }
    if (table === 'return_transactions') {
      returnTransactionCallCount++
      if (returnTransactionCallCount === 1) {
        return makeAggBuilder(refundAgg)
      }
      // Second call: cash refunds
      return makeAggBuilder(cashRefundAgg)
    }
    if (table === 'transaction_payments as tp') {
      return makeAggBuilder(paymentAgg)
    }
    if (table === 'credit_payments') {
      return makeAggBuilder(creditPaymentAgg)
    }
    if (table === 'expenses') {
      return makeAggBuilder(expenseAgg)
    }
    if (table === 'shifts') {
      return shiftBuilder
    }
    if (table === 'z_reports') {
      return zReportsInsertBuilder
    }
    return {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockResolvedValue([1]),
    }
  }) as unknown as Knex.Transaction

  // Add trx.raw method — returns the SQL string as-is (passthrough for mocking)
  ;(trx as unknown as { raw: (sql: string) => string }).raw = vi.fn((sql: string) => sql as unknown as ReturnType<Knex.Raw>)

  // The outer knex instance
  const mockKnex = vi.fn((table: string) => {
    if (table === 'z_reports') return zReportsDuplicateBuilder
    return {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    }
  }) as unknown as Knex

  // Mock transaction() to call the callback with trx
  ;(mockKnex as unknown as { transaction: unknown }).transaction = vi.fn(
    async (cb: (trx: Knex.Transaction) => Promise<unknown>) => cb(trx)
  )

  return mockKnex
}

// ─── ZReportService.generate tests ───────────────────────────────────────────

describe('ZReportService.generate', () => {
  describe('successful generation', () => {
    it('returns a ZReport with the correct id and date', async () => {
      const mockKnex = makeMockKnex()
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      const result = await service.generate(BASE_PAYLOAD)

      expect(result.id).toBe(1)
      expect(result.reportDate).toBe(TEST_DATE)
      expect(result.generatedBy).toBe(GENERATED_BY)
    })

    it('returns correct aggregated totals', async () => {
      const mockKnex = makeMockKnex()
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      const result = await service.generate(BASE_PAYLOAD)

      expect(result.totalSales).toBe(1200)
      expect(result.totalRefunds).toBe(80)
      expect(result.totalDiscounts).toBe(50)
      expect(result.totalTax).toBe(100)
      expect(result.totalExpenses).toBe(120)
    })

    it('returns correct payment method breakdown', async () => {
      const mockKnex = makeMockKnex()
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      const result = await service.generate(BASE_PAYLOAD)

      expect(result.cashSales).toBe(700)
      expect(result.cardSales).toBe(300)
      expect(result.mobileMoneySales).toBe(200)
    })

    it('returns correct opening float from shifts', async () => {
      const mockKnex = makeMockKnex()
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      const result = await service.generate(BASE_PAYLOAD)

      expect(result.openingFloat).toBe(500)
    })

    it('returns the actual_cash when provided', async () => {
      const mockKnex = makeMockKnex()
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      const result = await service.generate(BASE_PAYLOAD)

      expect(result.actualCash).toBe(1500)
    })

    it('returns undefined actualCash when not provided', async () => {
      const mockKnex = makeMockKnex({
        createdReportRow: { ...INSERTED_Z_REPORT_ROW, actual_cash: null, variance: null },
      })
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      const result = await service.generate({ date: TEST_DATE, generatedBy: GENERATED_BY })

      expect(result.actualCash).toBeUndefined()
      expect(result.variance).toBeUndefined()
    })

    it('returns reportData as a parsed object', async () => {
      const mockKnex = makeMockKnex()
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      const result = await service.generate(BASE_PAYLOAD)

      expect(result.reportData).toBeTypeOf('object')
      expect(result.reportData).not.toBeNull()
    })

    it('writes an audit log entry after generation', async () => {
      const mockKnex = makeMockKnex()
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      await service.generate(BASE_PAYLOAD)

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: GENERATED_BY,
          action: 'z_report_generate',
          entityType: 'z_report',
          entityId: 1,
        })
      )
    })
  })

  describe('duplicate prevention', () => {
    it('throws ConflictError when a Z report already exists for the date', async () => {
      const mockKnex = makeMockKnex({ existingZReport: { id: 99 } })
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      await expect(service.generate(BASE_PAYLOAD)).rejects.toThrow(ConflictError)
    })

    it('error message mentions the date', async () => {
      const mockKnex = makeMockKnex({ existingZReport: { id: 99 } })
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      await expect(service.generate(BASE_PAYLOAD)).rejects.toThrow(TEST_DATE)
    })

    it('does not insert any records when duplicate exists', async () => {
      const mockKnex = makeMockKnex({ existingZReport: { id: 99 } })
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      await expect(service.generate(BASE_PAYLOAD)).rejects.toThrow(ConflictError)

      // transaction() should not have been called
      expect(
        (mockKnex as unknown as { transaction: ReturnType<typeof vi.fn> }).transaction
      ).not.toHaveBeenCalled()
    })

    it('does not write audit log when duplicate exists', async () => {
      const mockKnex = makeMockKnex({ existingZReport: { id: 99 } })
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      await expect(service.generate(BASE_PAYLOAD)).rejects.toThrow(ConflictError)

      expect(audit.log).not.toHaveBeenCalled()
    })
  })

  describe('opening float fallback', () => {
    it('uses 0 as opening float when no shift exists for the date', async () => {
      const mockKnex = makeMockKnex({
        shiftRow: null,
        createdReportRow: {
          ...INSERTED_Z_REPORT_ROW,
          opening_float: '0.0000',
          expected_cash: '750.0000', // 0 + 700 + 100 - 30 - 120
        },
      })
      const audit = makeMockAudit()
      const service = new ZReportService(mockKnex, audit)

      const result = await service.generate(BASE_PAYLOAD)

      expect(result.openingFloat).toBe(0)
    })
  })
})

// ─── ZReportService.list tests ────────────────────────────────────────────────

describe('ZReportService.list', () => {
  it('returns an array of ZReport objects', async () => {
    const mockKnex = makeMockKnex({ listRows: [INSERTED_Z_REPORT_ROW] })
    const audit = makeMockAudit()
    const service = new ZReportService(mockKnex, audit)

    const result = await service.list()

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
    expect(result[0].reportDate).toBe(TEST_DATE)
  })

  it('returns an empty array when no Z reports exist', async () => {
    const mockKnex = makeMockKnex({ listRows: [] })
    const audit = makeMockAudit()
    const service = new ZReportService(mockKnex, audit)

    const result = await service.list()

    expect(result).toHaveLength(0)
  })
})

// ─── ZReportService.getByDate tests ──────────────────────────────────────────

describe('ZReportService.getByDate', () => {
  it('returns null when no Z report exists for the date', async () => {
    const mockKnex = vi.fn((table: string) => {
      if (table === 'z_reports') {
        return {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(undefined),
          orderBy: vi.fn().mockResolvedValue([]),
        }
      }
      return {}
    }) as unknown as Knex
    ;(mockKnex as unknown as { transaction: unknown }).transaction = vi.fn()

    const audit = makeMockAudit()
    const service = new ZReportService(mockKnex, audit)

    const result = await service.getByDate('2024-12-31')

    expect(result).toBeNull()
  })

  it('returns a ZReport when one exists for the date', async () => {
    const mockKnex = vi.fn((table: string) => {
      if (table === 'z_reports') {
        return {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(INSERTED_Z_REPORT_ROW),
          orderBy: vi.fn().mockResolvedValue([INSERTED_Z_REPORT_ROW]),
        }
      }
      return {}
    }) as unknown as Knex
    ;(mockKnex as unknown as { transaction: unknown }).transaction = vi.fn()

    const audit = makeMockAudit()
    const service = new ZReportService(mockKnex, audit)

    const result = await service.getByDate(TEST_DATE)

    expect(result).not.toBeNull()
    expect(result!.id).toBe(1)
    expect(result!.reportDate).toBe(TEST_DATE)
  })
})
