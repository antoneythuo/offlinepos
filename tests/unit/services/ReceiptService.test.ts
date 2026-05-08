import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Knex } from 'knex'
import { ReceiptService } from '../../../src/services/ReceiptService'
import { NotFoundError } from '../../../src/errors'
import type { ReceiptData } from '../../../src/types/index'

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a mock Knex instance that simulates the DB interactions needed
 * by ReceiptService.buildReceiptData.
 */
function makeMockKnex(overrides: {
  transactionRow?: object | null
  itemRows?: object[]
  paymentRows?: object[]
  settingsRows?: Array<{ key_name: string; value: string }>
} = {}): Knex {
  const {
    transactionRow = {
      id: 1,
      transaction_ref: 'TXN-20240115-0001',
      created_at: '2024-01-15T10:30:00.000Z',
      subtotal: 200,
      discount_amount: 10,
      tax_amount: 30,
      grand_total: 220,
      cashier_name: 'John Doe',
      customer_name: 'Jane Smith',
    },
    itemRows = [
      {
        product_name: 'Widget A',
        sku: 'WGT-001',
        quantity: 2,
        unit_price: 100,
        discount_amount: 5,
        tax_amount: 15,
        line_total: 110,
      },
    ],
    paymentRows = [
      { method: 'cash', amount: 220 },
    ],
    settingsRows = [
      { key_name: 'businessName', value: 'Test Shop' },
      { key_name: 'businessAddress', value: '123 Main St' },
      { key_name: 'receiptHeader', value: 'Welcome!' },
      { key_name: 'receiptFooter', value: 'Thank you!' },
    ],
  } = overrides

  // Builder for transactions query
  const transactionsBuilder = {
    select: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(transactionRow),
  }

  // Builder for transaction_items query
  const itemsBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(itemRows),
  }

  // Builder for transaction_payments query
  const paymentsBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(paymentRows),
  }

  // Builder for settings query
  const settingsBuilder = {
    select: vi.fn().mockReturnThis(),
    whereIn: vi.fn().mockResolvedValue(settingsRows),
  }

  // The outer knex instance
  const mockKnex = vi.fn((table: string) => {
    if (table === 'transactions') return transactionsBuilder
    if (table === 'transaction_items') return itemsBuilder
    if (table === 'transaction_payments') return paymentsBuilder
    if (table === 'settings') return settingsBuilder
    return {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    }
  }) as unknown as Knex

  return mockKnex
}

// ─── buildReceiptData tests ───────────────────────────────────────────────────

describe('ReceiptService.buildReceiptData', () => {
  describe('valid transaction — returns ReceiptData', () => {
    it('returns ReceiptData with all required fields', async () => {
      const mockKnex = makeMockKnex()
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result).toBeDefined()
      expect(result.transactionRef).toBe('TXN-20240115-0001')
      expect(result.dateTime).toBe('2024-01-15T10:30:00.000Z')
      expect(result.cashierName).toBe('John Doe')
      expect(result.customerName).toBe('Jane Smith')
      expect(result.items).toHaveLength(1)
      expect(result.subtotal).toBe(200)
      expect(result.discountAmount).toBe(10)
      expect(result.taxAmount).toBe(30)
      expect(result.grandTotal).toBe(220)
      expect(result.payments).toHaveLength(1)
      expect(result.changeAmount).toBe(0)
      expect(result.businessName).toBe('Test Shop')
      expect(result.businessAddress).toBe('123 Main St')
      expect(result.receiptHeader).toBe('Welcome!')
      expect(result.receiptFooter).toBe('Thank you!')
      expect(result.isDuplicate).toBe(false)
    })

    it('items array contains correct line items', async () => {
      const mockKnex = makeMockKnex({
        itemRows: [
          {
            product_name: 'Widget A',
            sku: 'WGT-001',
            quantity: 2,
            unit_price: 100,
            discount_amount: 5,
            tax_amount: 15,
            line_total: 110,
          },
          {
            product_name: 'Widget B',
            sku: 'WGT-002',
            quantity: 1,
            unit_price: 50,
            discount_amount: 0,
            tax_amount: 5,
            line_total: 55,
          },
        ],
      })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.items).toHaveLength(2)
      expect(result.items[0]).toEqual({
        productName: 'Widget A',
        sku: 'WGT-001',
        quantity: 2,
        unitPrice: 100,
        discountAmount: 5,
        taxAmount: 15,
        lineTotal: 110,
      })
      expect(result.items[1]).toEqual({
        productName: 'Widget B',
        sku: 'WGT-002',
        quantity: 1,
        unitPrice: 50,
        discountAmount: 0,
        taxAmount: 5,
        lineTotal: 55,
      })
    })

    it('payments array contains correct payment entries', async () => {
      const mockKnex = makeMockKnex({
        paymentRows: [
          { method: 'cash', amount: 100 },
          { method: 'card', amount: 120 },
        ],
      })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.payments).toHaveLength(2)
      expect(result.payments[0]).toEqual({ method: 'cash', amount: 100 })
      expect(result.payments[1]).toEqual({ method: 'card', amount: 120 })
    })

    it('calculates change amount correctly when overpaid', async () => {
      const mockKnex = makeMockKnex({
        transactionRow: {
          id: 1,
          transaction_ref: 'TXN-20240115-0001',
          created_at: '2024-01-15T10:30:00.000Z',
          subtotal: 200,
          discount_amount: 0,
          tax_amount: 0,
          grand_total: 200,
          cashier_name: 'John Doe',
          customer_name: null,
        },
        paymentRows: [{ method: 'cash', amount: 250 }],
      })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.changeAmount).toBe(50) // 250 - 200
    })

    it('change amount is zero when payment equals grand total', async () => {
      const mockKnex = makeMockKnex({
        transactionRow: {
          id: 1,
          transaction_ref: 'TXN-20240115-0001',
          created_at: '2024-01-15T10:30:00.000Z',
          subtotal: 200,
          discount_amount: 0,
          tax_amount: 0,
          grand_total: 200,
          cashier_name: 'John Doe',
          customer_name: null,
        },
        paymentRows: [{ method: 'cash', amount: 200 }],
      })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.changeAmount).toBe(0)
    })

    it('handles missing customer name (undefined)', async () => {
      const mockKnex = makeMockKnex({
        transactionRow: {
          id: 1,
          transaction_ref: 'TXN-20240115-0001',
          created_at: '2024-01-15T10:30:00.000Z',
          subtotal: 200,
          discount_amount: 0,
          tax_amount: 0,
          grand_total: 200,
          cashier_name: 'John Doe',
          customer_name: null,
        },
      })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.customerName).toBeUndefined()
    })

    it('handles missing optional settings (address, header, footer)', async () => {
      const mockKnex = makeMockKnex({
        settingsRows: [{ key_name: 'businessName', value: 'Test Shop' }],
      })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.businessName).toBe('Test Shop')
      expect(result.businessAddress).toBeUndefined()
      expect(result.receiptHeader).toBeUndefined()
      expect(result.receiptFooter).toBeUndefined()
    })

    it('defaults businessName to "Business" when not configured', async () => {
      const mockKnex = makeMockKnex({
        settingsRows: [],
      })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.businessName).toBe('Business')
    })

    it('marks receipt as duplicate when isDuplicate flag is true', async () => {
      const mockKnex = makeMockKnex()
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1, true)

      expect(result.isDuplicate).toBe(true)
    })

    it('isDuplicate is false by default', async () => {
      const mockKnex = makeMockKnex()
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.isDuplicate).toBe(false)
    })
  })

  describe('transaction not found — throws NotFoundError', () => {
    it('throws NotFoundError when transaction does not exist', async () => {
      const mockKnex = makeMockKnex({ transactionRow: null })
      const service = new ReceiptService(mockKnex)

      await expect(service.buildReceiptData(999)).rejects.toThrow(NotFoundError)
    })

    it('error message includes the transaction ID', async () => {
      const mockKnex = makeMockKnex({ transactionRow: null })
      const service = new ReceiptService(mockKnex)

      await expect(service.buildReceiptData(999)).rejects.toThrow('999')
    })
  })

  describe('edge cases', () => {
    it('handles empty items array', async () => {
      const mockKnex = makeMockKnex({ itemRows: [] })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.items).toHaveLength(0)
    })

    it('handles empty payments array', async () => {
      const mockKnex = makeMockKnex({ paymentRows: [] })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.payments).toHaveLength(0)
      expect(result.changeAmount).toBe(0) // max(0, 0 - 220)
    })

    it('handles multiple payment methods (split payment)', async () => {
      const mockKnex = makeMockKnex({
        transactionRow: {
          id: 1,
          transaction_ref: 'TXN-20240115-0001',
          created_at: '2024-01-15T10:30:00.000Z',
          subtotal: 200,
          discount_amount: 0,
          tax_amount: 0,
          grand_total: 200,
          cashier_name: 'John Doe',
          customer_name: null,
        },
        paymentRows: [
          { method: 'cash', amount: 100 },
          { method: 'card', amount: 50 },
          { method: 'mobile_money', amount: 50 },
        ],
      })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      expect(result.payments).toHaveLength(3)
      expect(result.payments[0].method).toBe('cash')
      expect(result.payments[1].method).toBe('card')
      expect(result.payments[2].method).toBe('mobile_money')
      expect(result.changeAmount).toBe(0) // 200 - 200
    })

    it('converts numeric strings to numbers for all monetary fields', async () => {
      const mockKnex = makeMockKnex({
        transactionRow: {
          id: 1,
          transaction_ref: 'TXN-20240115-0001',
          created_at: '2024-01-15T10:30:00.000Z',
          subtotal: '200.00', // string from DB
          discount_amount: '10.50',
          tax_amount: '30.25',
          grand_total: '219.75',
          cashier_name: 'John Doe',
          customer_name: null,
        },
        itemRows: [
          {
            product_name: 'Widget A',
            sku: 'WGT-001',
            quantity: '2', // string from DB
            unit_price: '100.00',
            discount_amount: '5.00',
            tax_amount: '15.00',
            line_total: '110.00',
          },
        ],
        paymentRows: [{ method: 'cash', amount: '220.00' }],
      })
      const service = new ReceiptService(mockKnex)

      const result = await service.buildReceiptData(1)

      // All monetary fields should be numbers
      expect(typeof result.subtotal).toBe('number')
      expect(typeof result.discountAmount).toBe('number')
      expect(typeof result.taxAmount).toBe('number')
      expect(typeof result.grandTotal).toBe('number')
      expect(typeof result.items[0].quantity).toBe('number')
      expect(typeof result.items[0].unitPrice).toBe('number')
      expect(typeof result.items[0].discountAmount).toBe('number')
      expect(typeof result.items[0].taxAmount).toBe('number')
      expect(typeof result.items[0].lineTotal).toBe('number')
      expect(typeof result.payments[0].amount).toBe('number')
      expect(typeof result.changeAmount).toBe('number')

      // Verify values are correct
      expect(result.subtotal).toBe(200)
      expect(result.discountAmount).toBe(10.5)
      expect(result.taxAmount).toBe(30.25)
      expect(result.grandTotal).toBe(219.75)
    })
  })
})
