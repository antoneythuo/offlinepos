import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Knex } from 'knex'
import { SaleService } from '../../../src/services/SaleService'
import { AuditService } from '../../../src/services/AuditService'
import { ValidationError, NotFoundError } from '../../../src/errors'
import type { CreateSalePayload, CartItem, PaymentEntry } from '../../../src/types/index'
import type { HoldSalePayload, RefundPayload } from '../../../src/services/SaleService'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CART_ITEM: CartItem = {
  productId: 1,
  productName: 'Widget A',
  sku: 'WGT-001',
  quantity: 2,
  stockQuantity: 100,
  unitPrice: 100,
  discountType: 'none',
  discountValue: 0,
  taxRate: 0,
  taxInclusive: false,
}

const PAYMENT_EXACT: PaymentEntry = { method: 'cash', amount: 200 }
const PAYMENT_OVER: PaymentEntry = { method: 'cash', amount: 250 }
const PAYMENT_UNDER: PaymentEntry = { method: 'cash', amount: 100 }

const BASE_PAYLOAD: CreateSalePayload = {
  cartItems: [CART_ITEM],
  payments: [PAYMENT_EXACT],
  discountType: 'none',
  discountValue: 0,
  isCredit: false,
  cashierId: 1,
}

const HOLD_PAYLOAD: HoldSalePayload = {
  cartItems: [CART_ITEM],
  discountType: 'none',
  discountValue: 0,
  cashierId: 1,
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a mock Knex instance that simulates the DB interactions needed
 * by SaleService. The transaction callback is called with the mock trx.
 */
function makeMockKnex(overrides: {
  productRows?: Array<{ id: number; name: string; sku: string; quantity_on_hand: number }>
  cashierRow?: { full_name: string }
  customerRow?: { name: string }
  settingsRow?: { value: string }
  transactionInsertId?: number
  returnTransactionInsertId?: number
  heldTransactionInsertId?: number
  heldTransactionRow?: object | null
  originalTxRow?: object | null
  originalItemRows?: object[]
} = {}): {
  mockKnex: Knex
  insertSpy: ReturnType<typeof vi.fn>
  decrementSpy: ReturnType<typeof vi.fn>
  incrementSpy: ReturnType<typeof vi.fn>
  forUpdateSpy: ReturnType<typeof vi.fn>
} {
  const {
    productRows = [{ id: 1, name: 'Widget A', sku: 'WGT-001', quantity_on_hand: 50 }],
    cashierRow = { full_name: 'John Doe' },
    customerRow = { name: 'Customer A' },
    settingsRow = { value: 'My Business' },
    transactionInsertId = 42,
    returnTransactionInsertId = 10,
    heldTransactionInsertId = 5,
    heldTransactionRow = null,
    originalTxRow = null,
    originalItemRows = [],
  } = overrides

  const insertSpy = vi.fn().mockResolvedValue([transactionInsertId])
  const decrementSpy = vi.fn().mockResolvedValue(1)
  const incrementSpy = vi.fn().mockResolvedValue(1)
  const forUpdateSpy = vi.fn().mockResolvedValue(productRows)

  // Builder for products inside transaction (forUpdate)
  const productsTrxBuilder = {
    select: vi.fn().mockReturnThis(),
    whereIn: vi.fn().mockReturnThis(),
    forUpdate: forUpdateSpy,
    where: vi.fn().mockReturnThis(),
    decrement: decrementSpy,
    increment: incrementSpy,
  }

  // Builder for transaction_items insert
  const txItemsBuilder = { insert: vi.fn().mockResolvedValue([1]) }
  // Builder for transaction_payments insert
  const txPaymentsBuilder = { insert: vi.fn().mockResolvedValue([1]) }
  // Builder for transactions insert
  const txBuilder = { insert: insertSpy }
  // Builder for return_transactions insert
  const returnTxBuilder = { insert: vi.fn().mockResolvedValue([returnTransactionInsertId]) }
  // Builder for return_items insert
  const returnItemsBuilder = { insert: vi.fn().mockResolvedValue([1]) }
  // Builder for held_transactions
  const heldTxBuilder = {
    insert: vi.fn().mockResolvedValue([heldTransactionInsertId]),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(heldTransactionRow),
    orderBy: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(1),
  }

  // Builder for users (cashier lookup)
  const usersBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(cashierRow),
  }

  // Builder for customers
  const customersBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(customerRow),
  }

  // Builder for settings
  const settingsBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(settingsRow),
  }

  // Builder for original transaction lookup (refund)
  const originalTxBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(originalTxRow),
  }

  // Builder for transaction_items lookup (refund)
  const txItemsLookupBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: vi.fn(),
  }

  // The trx object used inside withTransaction callback
  const trx = vi.fn((table: string) => {
    if (table === 'products') return productsTrxBuilder
    if (table === 'transactions') return txBuilder
    if (table === 'transaction_items') return txItemsBuilder
    if (table === 'transaction_payments') return txPaymentsBuilder
    if (table === 'return_transactions') return returnTxBuilder
    if (table === 'return_items') return returnItemsBuilder
    if (table === 'users') return usersBuilder
    if (table === 'customers') return customersBuilder
    if (table === 'settings') return settingsBuilder
    return { insert: vi.fn().mockResolvedValue([1]), select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) }
  }) as unknown as Knex.Transaction

  // The outer knex instance
  const mockKnex = vi.fn((table: string) => {
    if (table === 'held_transactions') return heldTxBuilder
    if (table === 'transactions') return originalTxBuilder
    if (table === 'transaction_items') return {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(originalItemRows),
    }
    if (table === 'settings') return settingsBuilder
    return { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) }
  }) as unknown as Knex

  // Mock transaction() to call the callback with trx
  ;(mockKnex as unknown as { transaction: unknown }).transaction = vi.fn(
    async (cb: (trx: Knex.Transaction) => Promise<unknown>) => cb(trx)
  )

  return { mockKnex, insertSpy, decrementSpy, incrementSpy, forUpdateSpy }
}

function makeMockAudit(): AuditService {
  return { log: vi.fn() } as unknown as AuditService
}

// ─── createSale tests ─────────────────────────────────────────────────────────

describe('SaleService.createSale', () => {
  describe('valid payment — returns SaleResult', () => {
    it('returns a SaleResult with transactionId, receiptData, and changeAmount', async () => {
      const { mockKnex } = makeMockKnex({ transactionInsertId: 42 })
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      const result = await service.createSale(BASE_PAYLOAD)

      expect(result.transactionId).toBe(42)
      expect(result.receiptData).toBeDefined()
      expect(result.receiptData.grandTotal).toBe(200)
      expect(result.changeAmount).toBe(0)
    })

    it('calculates correct change when overpaid', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      const result = await service.createSale({
        ...BASE_PAYLOAD,
        payments: [PAYMENT_OVER],
      })

      expect(result.changeAmount).toBe(50) // 250 - 200
    })

    it('receipt data contains required fields', async () => {
      const { mockKnex } = makeMockKnex({ settingsRow: { value: 'Test Shop' } })
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      const result = await service.createSale(BASE_PAYLOAD)
      const { receiptData } = result

      expect(receiptData.transactionRef).toMatch(/^TXN-\d{8}-\d{4}$/)
      expect(receiptData.cashierName).toBe('John Doe')
      expect(receiptData.items).toHaveLength(1)
      expect(receiptData.grandTotal).toBe(200)
      expect(receiptData.payments).toHaveLength(1)
      expect(receiptData.businessName).toBe('Test Shop')
    })

    it('inserts a transactions record inside the transaction', async () => {
      const { mockKnex, insertSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await service.createSale(BASE_PAYLOAD)

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cashier_id: 1,
          status: 'completed',
          grand_total: 200,
        })
      )
    })

    it('decrements quantity_on_hand for each cart item', async () => {
      const { mockKnex, decrementSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await service.createSale(BASE_PAYLOAD)

      expect(decrementSpy).toHaveBeenCalledWith('quantity_on_hand', 2)
    })

    it('writes an audit log entry after sale', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await service.createSale(BASE_PAYLOAD)

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: 'sale_complete',
          entityType: 'transaction',
        })
      )
    })

    it('sets status to credit for credit sales', async () => {
      const { mockKnex, insertSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await service.createSale({
        ...BASE_PAYLOAD,
        isCredit: true,
        payments: [{ method: 'cash', amount: 0 }],
      })

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'credit' })
      )
    })

    it('uses SELECT ... FOR UPDATE locking when reading quantity_on_hand (Requirement 32.3)', async () => {
      // Verifies that .forUpdate() is called on the products query inside the
      // transaction, ensuring row-level locking prevents overselling in
      // multi-terminal (LAN) mode as required by the design document.
      const { mockKnex, forUpdateSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await service.createSale(BASE_PAYLOAD)

      expect(forUpdateSpy).toHaveBeenCalledTimes(1)
    })

    it('applies FOR UPDATE lock before decrementing quantity_on_hand', async () => {
      // Ensures the lock is acquired on the product rows BEFORE the decrement
      // so that concurrent terminals cannot read stale stock quantities.
      const callOrder: string[] = []
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()

      // Patch the trx mock to track forUpdate vs decrement call order.
      // We do this by wrapping the transaction callback via the existing
      // mockKnex.transaction spy.
      const originalTransaction = (mockKnex as unknown as { transaction: (cb: (trx: Knex.Transaction) => Promise<unknown>) => Promise<unknown> }).transaction

      ;(mockKnex as unknown as { transaction: unknown }).transaction = vi.fn(
        async (cb: (trx: Knex.Transaction) => Promise<unknown>) => {
          // Build a trx that records forUpdate and decrement call order
          const trx = vi.fn((table: string) => {
            if (table === 'products') {
              return {
                select: vi.fn().mockReturnThis(),
                whereIn: vi.fn().mockReturnThis(),
                forUpdate: vi.fn(() => {
                  callOrder.push('forUpdate')
                  return Promise.resolve([{ id: 1, name: 'Widget A', sku: 'WGT-001', quantity_on_hand: 50 }])
                }),
                where: vi.fn().mockReturnThis(),
                decrement: vi.fn(() => {
                  callOrder.push('decrement')
                  return Promise.resolve(1)
                }),
                increment: vi.fn().mockResolvedValue(1),
              }
            }
            if (table === 'transactions') return { insert: vi.fn().mockResolvedValue([42]) }
            if (table === 'transaction_items') return { insert: vi.fn().mockResolvedValue([1]) }
            if (table === 'transaction_payments') return { insert: vi.fn().mockResolvedValue([1]) }
            if (table === 'users') return { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue({ full_name: 'John Doe' }) }
            if (table === 'customers') return { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) }
            if (table === 'settings') return { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue({ value: 'My Business' }) }
            return { insert: vi.fn().mockResolvedValue([1]), select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) }
          }) as unknown as Knex.Transaction
          return cb(trx)
        }
      )

      const service = new SaleService(mockKnex, audit)
      await service.createSale(BASE_PAYLOAD)

      expect(callOrder).toEqual(['forUpdate', 'decrement'])
    })
  })

  describe('insufficient payment — throws ValidationError', () => {
    it('throws ValidationError when total paid is less than grand total', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await expect(
        service.createSale({ ...BASE_PAYLOAD, payments: [PAYMENT_UNDER] })
      ).rejects.toThrow(ValidationError)
    })

    it('error message mentions the shortfall', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await expect(
        service.createSale({ ...BASE_PAYLOAD, payments: [PAYMENT_UNDER] })
      ).rejects.toThrow('Insufficient payment')
    })

    it('does not insert any records when payment is insufficient', async () => {
      const { mockKnex, insertSpy } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await expect(
        service.createSale({ ...BASE_PAYLOAD, payments: [PAYMENT_UNDER] })
      ).rejects.toThrow(ValidationError)

      expect(insertSpy).not.toHaveBeenCalled()
    })

    it('does not write audit log when payment is insufficient', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await expect(
        service.createSale({ ...BASE_PAYLOAD, payments: [PAYMENT_UNDER] })
      ).rejects.toThrow(ValidationError)

      expect(audit.log).not.toHaveBeenCalled()
    })

    it('throws ValidationError when cart is empty', async () => {
      const { mockKnex } = makeMockKnex()
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await expect(
        service.createSale({ ...BASE_PAYLOAD, cartItems: [] })
      ).rejects.toThrow(ValidationError)
    })
  })
})

// ─── holdSale tests ───────────────────────────────────────────────────────────

describe('SaleService.holdSale', () => {
  it('serializes cart and returns holdId', async () => {
    const { mockKnex } = makeMockKnex({ heldTransactionInsertId: 7 })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    const result = await service.holdSale(HOLD_PAYLOAD)

    expect(result.holdId).toBe(7)
  })

  it('inserts a held_transactions record with serialized cart_data', async () => {
    const { mockKnex } = makeMockKnex()
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    // Capture the insert call
    const heldInsertSpy = vi.fn().mockResolvedValue([5])
    ;(mockKnex as unknown as { _heldInsertSpy: unknown })._heldInsertSpy = heldInsertSpy

    // Override the held_transactions builder to capture the insert
    const originalMockKnex = mockKnex as unknown as (table: string) => unknown
    const heldBuilder = {
      insert: heldInsertSpy,
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      orderBy: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(1),
    }
    vi.mocked(mockKnex).mockImplementation((table: string) => {
      if (table === 'held_transactions') return heldBuilder as unknown as ReturnType<Knex>
      return originalMockKnex(table) as ReturnType<Knex>
    })

    await service.holdSale(HOLD_PAYLOAD)

    expect(heldInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cashier_id: 1,
        cart_data: expect.any(String),
      })
    )

    // Verify cart_data is valid JSON
    const call = heldInsertSpy.mock.calls[0][0] as { cart_data: string }
    const parsed = JSON.parse(call.cart_data)
    expect(parsed.cartItems).toHaveLength(1)
    expect(parsed.cashierId).toBe(1)
  })
})

// ─── resumeSale tests ─────────────────────────────────────────────────────────

describe('SaleService.resumeSale', () => {
  it('deserializes cart correctly from a held transaction', async () => {
    const serializedCart = JSON.stringify(HOLD_PAYLOAD)
    const heldRow = {
      id: 5,
      cashier_id: 1,
      cart_data: serializedCart,
      held_at: '2024-01-15T10:00:00.000Z',
    }

    const { mockKnex } = makeMockKnex({ heldTransactionRow: heldRow })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    const result = await service.resumeSale(5)

    expect(result.id).toBe(5)
    expect(result.cashierId).toBe(1)
    expect(result.cartData.cartItems).toHaveLength(1)
    expect(result.cartData.cartItems[0].productId).toBe(1)
    expect(result.cartData.cashierId).toBe(1)
  })

  it('handles cart_data already parsed as object (MySQL JSON column)', async () => {
    const heldRow = {
      id: 5,
      cashier_id: 1,
      cart_data: HOLD_PAYLOAD, // already an object, not a string
      held_at: '2024-01-15T10:00:00.000Z',
    }

    const { mockKnex } = makeMockKnex({ heldTransactionRow: heldRow })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    const result = await service.resumeSale(5)

    expect(result.cartData.cartItems).toHaveLength(1)
  })

  it('throws NotFoundError when held transaction does not exist', async () => {
    const { mockKnex } = makeMockKnex({ heldTransactionRow: null })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    await expect(service.resumeSale(999)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError with the holdId in the message', async () => {
    const { mockKnex } = makeMockKnex({ heldTransactionRow: null })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    await expect(service.resumeSale(999)).rejects.toThrow('999')
  })
})

// ─── refundSale tests ─────────────────────────────────────────────────────────

describe('SaleService.refundSale', () => {
  const ORIGINAL_TX_ROW = {
    id: 10,
    grand_total: 200,
    created_at: new Date().toISOString(), // today — within window
    status: 'completed',
  }

  const ORIGINAL_ITEMS = [
    {
      product_id: 1,
      unit_price: 100,
      quantity: 2,
      line_total: 200,
    },
  ]

  const REFUND_PAYLOAD: RefundPayload = {
    originalTransactionId: 10,
    items: [{ productId: 1, quantity: 1 }],
    refundMethod: 'cash',
    processedBy: 1,
  }

  it('returns RefundResult with returnTransactionId and totalRefund', async () => {
    const { mockKnex } = makeMockKnex({
      originalTxRow: ORIGINAL_TX_ROW,
      originalItemRows: ORIGINAL_ITEMS,
      returnTransactionInsertId: 20,
    })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    const result = await service.refundSale(REFUND_PAYLOAD)

    expect(result.returnTransactionId).toBe(20)
    expect(result.totalRefund).toBe(100) // 1/2 of 200
  })

  it('increments quantity_on_hand for returned items', async () => {
    const { mockKnex, incrementSpy } = makeMockKnex({
      originalTxRow: ORIGINAL_TX_ROW,
      originalItemRows: ORIGINAL_ITEMS,
    })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    await service.refundSale(REFUND_PAYLOAD)

    expect(incrementSpy).toHaveBeenCalledWith('quantity_on_hand', 1)
  })

  it('writes an audit log entry for the refund', async () => {
    const { mockKnex } = makeMockKnex({
      originalTxRow: ORIGINAL_TX_ROW,
      originalItemRows: ORIGINAL_ITEMS,
    })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    await service.refundSale(REFUND_PAYLOAD)

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        action: 'sale_refund',
        entityType: 'return_transaction',
      })
    )
  })

  it('throws NotFoundError when original transaction does not exist', async () => {
    const { mockKnex } = makeMockKnex({ originalTxRow: null })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    await expect(service.refundSale(REFUND_PAYLOAD)).rejects.toThrow(NotFoundError)
  })

  describe('return window enforcement', () => {
    it('throws ValidationError when outside return window and no managerId', async () => {
      // Create a transaction date 60 days ago (outside default 30-day window)
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 60)

      const oldTxRow = {
        ...ORIGINAL_TX_ROW,
        created_at: oldDate.toISOString(),
      }

      const { mockKnex } = makeMockKnex({
        originalTxRow: oldTxRow,
        originalItemRows: ORIGINAL_ITEMS,
        settingsRow: { value: '30' }, // 30-day return window
      })
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await expect(
        service.refundSale({ ...REFUND_PAYLOAD, managerId: undefined })
      ).rejects.toThrow(ValidationError)
    })

    it('error message mentions return window and manager approval', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 60)

      const oldTxRow = {
        ...ORIGINAL_TX_ROW,
        created_at: oldDate.toISOString(),
      }

      const { mockKnex } = makeMockKnex({
        originalTxRow: oldTxRow,
        originalItemRows: ORIGINAL_ITEMS,
        settingsRow: { value: '30' },
      })
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      await expect(
        service.refundSale({ ...REFUND_PAYLOAD, managerId: undefined })
      ).rejects.toThrow('Manager approval')
    })

    it('allows refund outside return window when managerId is provided', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 60)

      const oldTxRow = {
        ...ORIGINAL_TX_ROW,
        created_at: oldDate.toISOString(),
      }

      const { mockKnex } = makeMockKnex({
        originalTxRow: oldTxRow,
        originalItemRows: ORIGINAL_ITEMS,
        settingsRow: { value: '30' },
        returnTransactionInsertId: 99,
      })
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      const result = await service.refundSale({
        ...REFUND_PAYLOAD,
        managerId: 2,
      })

      expect(result.returnTransactionId).toBe(99)
    })

    it('allows refund within return window without managerId', async () => {
      // Transaction from today — within window
      const { mockKnex } = makeMockKnex({
        originalTxRow: ORIGINAL_TX_ROW,
        originalItemRows: ORIGINAL_ITEMS,
        returnTransactionInsertId: 55,
      })
      const audit = makeMockAudit()
      const service = new SaleService(mockKnex, audit)

      const result = await service.refundSale(REFUND_PAYLOAD)

      expect(result.returnTransactionId).toBe(55)
    })
  })

  it('throws ValidationError when refund items list is empty', async () => {
    const { mockKnex } = makeMockKnex({ originalTxRow: ORIGINAL_TX_ROW })
    const audit = makeMockAudit()
    const service = new SaleService(mockKnex, audit)

    await expect(
      service.refundSale({ ...REFUND_PAYLOAD, items: [] })
    ).rejects.toThrow(ValidationError)
  })
})
