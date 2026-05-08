import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Knex } from 'knex'
import { StockAdjustmentService } from '../../../src/services/StockAdjustmentService'
import { AuditService } from '../../../src/services/AuditService'
import { NotFoundError } from '../../../src/errors'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PRODUCT_ROW = {
  id: 1,
  name: 'Test Product',
  quantity_on_hand: 50,
}

const BASE_PAYLOAD = {
  productId: 1,
  type: 'correction' as const,
  quantity: 10,
  reason: 'Recount',
  userId: 42,
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a mock Knex instance that:
 * - Returns `productRow` for `products` SELECT queries
 * - Captures UPDATE and INSERT calls
 * - Supports `.transaction()` by calling the callback with itself
 */
function makeMockKnex(productRow: typeof PRODUCT_ROW | null = PRODUCT_ROW): {
  mockKnex: Knex
  updateSpy: ReturnType<typeof vi.fn>
  insertSpy: ReturnType<typeof vi.fn>
  transactionCallback: (() => Promise<unknown>) | null
} {
  const updateSpy = vi.fn().mockResolvedValue(1)
  const insertSpy = vi.fn().mockResolvedValue([1])

  // Builder returned for products table queries
  const productsSelectBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(productRow ?? undefined),
    update: updateSpy,
    increment: vi.fn().mockResolvedValue(1),
  }

  // The transaction trx object mirrors the knex interface
  const trxProducts = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(productRow ?? undefined),
    update: updateSpy,
    increment: vi.fn().mockResolvedValue(1),
  }

  const trxAdjustments = {
    insert: insertSpy,
  }

  const trx = vi.fn((table: string) => {
    if (table === 'products') return trxProducts
    if (table === 'stock_adjustments') return trxAdjustments
    return { insert: vi.fn(), update: vi.fn(), where: vi.fn().mockReturnThis() }
  }) as unknown as Knex.Transaction

  const mockKnex = vi.fn((table: string) => {
    if (table === 'products') return productsSelectBuilder
    if (table === 'stock_adjustments') return { insert: insertSpy }
    return { insert: vi.fn(), update: vi.fn(), where: vi.fn().mockReturnThis() }
  }) as unknown as Knex

  // Mock the .transaction() method to call the callback with the trx object
  ;(mockKnex as unknown as { transaction: unknown }).transaction = vi.fn(
    async (cb: (trx: Knex.Transaction) => Promise<unknown>) => {
      return cb(trx)
    }
  )

  return { mockKnex, updateSpy, insertSpy, transactionCallback: null }
}

function makeMockAudit(): AuditService {
  return { log: vi.fn() } as unknown as AuditService
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StockAdjustmentService.adjust', () => {
  describe('positive quantity — adds stock', () => {
    it('returns requiresConfirmation=false and the new quantity', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      const result = await service.adjust({ ...BASE_PAYLOAD, quantity: 10 })

      expect(result.requiresConfirmation).toBe(false)
      expect(result.newQuantity).toBe(60) // 50 + 10
    })

    it('updates quantity_on_hand to currentQty + quantity', async () => {
      const { mockKnex, updateSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      await service.adjust({ ...BASE_PAYLOAD, quantity: 5 })

      expect(updateSpy).toHaveBeenCalledWith({ quantity_on_hand: 55 })
    })
  })

  describe('negative quantity that would go below zero', () => {
    it('returns requiresConfirmation=true without modifying the database', async () => {
      const { mockKnex, updateSpy, insertSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      // quantity_on_hand is 50; removing 60 would give -10
      const result = await service.adjust({ ...BASE_PAYLOAD, quantity: -60 })

      expect(result.requiresConfirmation).toBe(true)
      expect(result.newQuantity).toBeUndefined()
      // DB must NOT have been touched
      expect(updateSpy).not.toHaveBeenCalled()
      expect(insertSpy).not.toHaveBeenCalled()
    })

    it('does not write an audit log when returning requiresConfirmation', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      await service.adjust({ ...BASE_PAYLOAD, quantity: -100 })

      expect(audit.log).not.toHaveBeenCalled()
    })
  })

  describe('forceNegative=true — allows negative stock', () => {
    it('applies the adjustment even when result would be negative', async () => {
      const { mockKnex, updateSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      const result = await service.adjust({
        ...BASE_PAYLOAD,
        quantity: -60,
        forceNegative: true,
      })

      expect(result.requiresConfirmation).toBe(false)
      expect(result.newQuantity).toBe(-10) // 50 - 60
      expect(updateSpy).toHaveBeenCalledWith({ quantity_on_hand: -10 })
    })

    it('inserts a stock_adjustments record when forceNegative is true', async () => {
      const { mockKnex, insertSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      await service.adjust({ ...BASE_PAYLOAD, quantity: -60, forceNegative: true })

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 1,
          adjusted_by: 42,
          type: 'correction',
          quantity: -60,
          reason: 'Recount',
        })
      )
    })
  })

  describe('audit log', () => {
    it('writes an audit log entry after a successful adjustment', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      await service.adjust(BASE_PAYLOAD)

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 42,
          action: 'stock_adjustment',
          entityType: 'product',
          entityId: 1,
        })
      )
    })

    it('includes before and after state in the audit entry', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      await service.adjust({ ...BASE_PAYLOAD, quantity: 10 })

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeState: { quantity_on_hand: 50 },
          afterState: expect.objectContaining({ quantity_on_hand: 60 }),
        })
      )
    })
  })

  describe('transaction usage', () => {
    it('wraps the update and insert inside a Knex transaction', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      await service.adjust(BASE_PAYLOAD)

      // The transaction method should have been called once
      const txFn = (mockKnex as unknown as { transaction: { mock: { calls: unknown[] } } }).transaction
      expect(txFn.mock.calls).toHaveLength(1)
    })
  })

  describe('error cases', () => {
    it('throws NotFoundError when the product does not exist', async () => {
      const { mockKnex } = makeMockKnex(null)
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      await expect(service.adjust(BASE_PAYLOAD)).rejects.toThrow(NotFoundError)
    })

    it('throws NotFoundError with the product id in the message', async () => {
      const { mockKnex } = makeMockKnex(null)
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      await expect(service.adjust({ ...BASE_PAYLOAD, productId: 999 })).rejects.toThrow(
        'Product with id 999 not found'
      )
    })
  })

  describe('exact-zero boundary', () => {
    it('allows adjustment that brings quantity exactly to zero without confirmation', async () => {
      const { mockKnex, updateSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new StockAdjustmentService(mockKnex, audit)

      // 50 - 50 = 0, should NOT require confirmation
      const result = await service.adjust({ ...BASE_PAYLOAD, quantity: -50 })

      expect(result.requiresConfirmation).toBe(false)
      expect(result.newQuantity).toBe(0)
      expect(updateSpy).toHaveBeenCalledWith({ quantity_on_hand: 0 })
    })
  })
})
