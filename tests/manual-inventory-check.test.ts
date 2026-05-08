// Manual test scenario for Task 9 checkpoint
// Verifies quantity_on_hand updates correctly through the inventory layer
// Uses mock Knex instances (same pattern as other unit tests) — no live DB required

import { describe, it, expect, vi } from 'vitest'
import type { Knex } from 'knex'
import { StockAdjustmentService } from '../src/services/StockAdjustmentService'
import { StockReceiptService } from '../src/services/StockReceiptService'
import { AuditService } from '../src/services/AuditService'

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeMockAudit(): AuditService {
  return { log: vi.fn() } as unknown as AuditService
}

/**
 * Creates a stateful mock Knex that tracks quantity_on_hand in memory.
 * This lets us simulate a sequence of operations and verify the final quantity.
 */
function makeStatefulMockKnex(initialQty: number): {
  mockKnex: Knex
  getQuantity: () => number
} {
  let quantity = initialQty

  const makeProductBuilder = () => ({
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockImplementation(() => Promise.resolve({ id: 1, name: 'Test Product', quantity_on_hand: quantity })),
    update: vi.fn().mockImplementation((data: { quantity_on_hand?: number; cost_price?: number }) => {
      if (data.quantity_on_hand !== undefined) quantity = data.quantity_on_hand
      return Promise.resolve(1)
    }),
    increment: vi.fn().mockImplementation((col: string, val: number) => {
      if (col === 'quantity_on_hand') quantity += val
      return Promise.resolve(1)
    }),
  })

  const makeInsertBuilder = () => ({
    insert: vi.fn().mockResolvedValue([1]),
  })

  const makeTrx = () => {
    const trxFn = vi.fn((table: string) => {
      if (table === 'products') return makeProductBuilder()
      return makeInsertBuilder()
    }) as unknown as Knex.Transaction
    return trxFn
  }

  const mockKnex = vi.fn((table: string) => {
    if (table === 'products') return makeProductBuilder()
    return makeInsertBuilder()
  }) as unknown as Knex

  ;(mockKnex as unknown as { transaction: unknown }).transaction = vi.fn(
    async (cb: (trx: Knex.Transaction) => Promise<unknown>) => {
      return cb(makeTrx())
    }
  )

  return {
    mockKnex,
    getQuantity: () => quantity,
  }
}

// ─── Manual Scenario Tests ────────────────────────────────────────────────────

describe('Manual Inventory Check — quantity_on_hand updates correctly', () => {
  it('scenario: receive stock → positive adjustment → negative adjustment → verify arithmetic', async () => {
    // Start with quantity = 0
    const { mockKnex, getQuantity } = makeStatefulMockKnex(0)
    const audit = makeMockAudit()

    const adjustmentService = new StockAdjustmentService(mockKnex, audit)

    // Step 1: Positive adjustment to simulate initial stock entry (+100)
    const step1 = await adjustmentService.adjust({
      productId: 1,
      adjustedBy: 1,
      type: 'correction',
      quantity: 100,
      reason: 'Initial stock entry',
    })
    expect(step1.requiresConfirmation).toBe(false)
    expect(step1.newQuantity).toBe(100)
    expect(getQuantity()).toBe(100)

    // Step 2: Positive adjustment — found extra stock (+20)
    const step2 = await adjustmentService.adjust({
      productId: 1,
      adjustedBy: 1,
      type: 'correction',
      quantity: 20,
      reason: 'Found extra stock during audit',
    })
    expect(step2.requiresConfirmation).toBe(false)
    expect(step2.newQuantity).toBe(120)
    expect(getQuantity()).toBe(120)

    // Step 3: Negative adjustment — damaged goods (-15)
    const step3 = await adjustmentService.adjust({
      productId: 1,
      adjustedBy: 1,
      type: 'damaged',
      quantity: -15,
      reason: 'Water damage',
    })
    expect(step3.requiresConfirmation).toBe(false)
    expect(step3.newQuantity).toBe(105)
    expect(getQuantity()).toBe(105)

    // Step 4: Negative adjustment that would go below zero — should require confirmation
    const step4 = await adjustmentService.adjust({
      productId: 1,
      adjustedBy: 1,
      type: 'lost',
      quantity: -200,
      reason: 'Theft',
    })
    expect(step4.requiresConfirmation).toBe(true)
    // Quantity should NOT have changed
    expect(getQuantity()).toBe(105)

    // Step 5: Force the negative adjustment through
    const step5 = await adjustmentService.adjust({
      productId: 1,
      adjustedBy: 1,
      type: 'lost',
      quantity: -200,
      reason: 'Theft — confirmed by manager',
      forceNegative: true,
    })
    expect(step5.requiresConfirmation).toBe(false)
    expect(step5.newQuantity).toBe(-95) // 105 - 200 = -95
    expect(getQuantity()).toBe(-95)

    // Final arithmetic check: 0 + 100 + 20 - 15 - 200 = -95 ✓
    const expected = 0 + 100 + 20 - 15 - 200
    expect(getQuantity()).toBe(expected)
  })

  it('scenario: stock receipt increments quantity_on_hand for each item', async () => {
    // Simulate two products with different starting quantities
    let qty1 = 10
    let qty2 = 5

    const makeProductBuilder = (productId: number) => ({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(() =>
        Promise.resolve({ id: productId, name: `Product ${productId}`, quantity_on_hand: productId === 1 ? qty1 : qty2 })
      ),
      update: vi.fn().mockResolvedValue(1),
      increment: vi.fn().mockImplementation((col: string, val: number) => {
        if (col === 'quantity_on_hand') {
          if (productId === 1) qty1 += val
          else qty2 += val
        }
        return Promise.resolve(1)
      }),
    })

    const trxFn = vi.fn((table: string) => {
      if (table === 'products') {
        // Return a builder that routes by where clause
        let currentProductId = 1
        return {
          where: vi.fn().mockImplementation((_col: string, id: number) => {
            currentProductId = id
            return {
              increment: vi.fn().mockImplementation((col: string, val: number) => {
                if (col === 'quantity_on_hand') {
                  if (currentProductId === 1) qty1 += val
                  else qty2 += val
                }
                return Promise.resolve(1)
              }),
              update: vi.fn().mockResolvedValue(1),
            }
          }),
        }
      }
      return { insert: vi.fn().mockResolvedValue([1]) }
    }) as unknown as Knex.Transaction

    const mockKnex = vi.fn((table: string) => {
      if (table === 'products') return makeProductBuilder(1)
      return { insert: vi.fn().mockResolvedValue([1]) }
    }) as unknown as Knex

    ;(mockKnex as unknown as { transaction: unknown }).transaction = vi.fn(
      async (cb: (trx: Knex.Transaction) => Promise<unknown>) => cb(trxFn)
    )

    const audit = makeMockAudit()
    const receiptService = new StockReceiptService(mockKnex, audit)

    // Receive 50 units of product 1 and 30 units of product 2
    await receiptService.receive({
      supplierId: 1,
      receivedBy: 1,
      receiptDate: '2024-01-15',
      notes: 'Test delivery',
      items: [
        { productId: 1, quantity: 50, costPrice: 10.00, updateCost: false },
        { productId: 2, quantity: 30, costPrice: 12.00, updateCost: false },
      ],
    })

    // Verify: product 1: 10 + 50 = 60, product 2: 5 + 30 = 35
    expect(qty1).toBe(60)
    expect(qty2).toBe(35)
  })

  it('scenario: negative adjustment without forceNegative does not modify quantity', async () => {
    const { mockKnex, getQuantity } = makeStatefulMockKnex(10)
    const audit = makeMockAudit()
    const service = new StockAdjustmentService(mockKnex, audit)

    // Try to remove 20 from a stock of 10 — should require confirmation
    const result = await service.adjust({
      productId: 1,
      adjustedBy: 1,
      type: 'damaged',
      quantity: -20,
      reason: 'Damaged goods',
    })

    expect(result.requiresConfirmation).toBe(true)
    // Quantity must remain unchanged
    expect(getQuantity()).toBe(10)
  })

  it('scenario: adjustment to exactly zero does not require confirmation', async () => {
    const { mockKnex, getQuantity } = makeStatefulMockKnex(25)
    const audit = makeMockAudit()
    const service = new StockAdjustmentService(mockKnex, audit)

    const result = await service.adjust({
      productId: 1,
      adjustedBy: 1,
      type: 'correction',
      quantity: -25,
      reason: 'Full stock write-off',
    })

    expect(result.requiresConfirmation).toBe(false)
    expect(result.newQuantity).toBe(0)
    expect(getQuantity()).toBe(0)
  })
})
