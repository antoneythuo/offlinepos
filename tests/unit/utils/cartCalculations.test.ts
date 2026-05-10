/**
 * Unit tests for cartCalculations.ts
 * Verifies specific examples and edge cases.
 * Property-based tests are in tests/property/cart.property.test.ts (Task 10)
 */

import { describe, it, expect } from 'vitest'
import {
  round,
  applyDiscount,
  computeItemTax,
  computeLineTotal,
  computeItemDiscount,
  computeCartTotals
} from '../../../src/utils/cartCalculations'
import type { CartItem, DiscountEntry } from '../../../src/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 1,
    productName: 'Test Product',
    sku: 'SKU-001',
    quantity: 1,
    stockQuantity: 100,
    unitPrice: 100,
    discountType: 'none',
    discountValue: 0,
    taxRate: 0,
    taxInclusive: false,
    ...overrides
  }
}

const noDiscount: DiscountEntry = { type: 'none', value: 0 }

// ─── round() ─────────────────────────────────────────────────────────────────

describe('round', () => {
  it('rounds to 4 decimal places', () => {
    expect(round(1.23456789)).toBe(1.2346)
  })

  it('handles exact values', () => {
    expect(round(10)).toBe(10)
    expect(round(0)).toBe(0)
  })

  it('rounds 0.00005 up', () => {
    expect(round(0.00005)).toBe(0.0001)
  })
})

// ─── applyDiscount() ─────────────────────────────────────────────────────────

describe('applyDiscount', () => {
  it('returns 0 for type none', () => {
    expect(applyDiscount(100, 'none', 50)).toBe(0)
  })

  it('calculates percent discount correctly', () => {
    expect(applyDiscount(200, 'percent', 10)).toBe(20)
  })

  it('calculates fixed discount correctly', () => {
    expect(applyDiscount(200, 'fixed', 30)).toBe(30)
  })

  it('caps percent discount at 100%', () => {
    expect(applyDiscount(100, 'percent', 150)).toBe(100)
  })

  it('caps fixed discount at base amount (never negative)', () => {
    // Requirement 14.3: discount cannot exceed line total
    expect(applyDiscount(50, 'fixed', 200)).toBe(50)
  })

  it('returns 0 for zero discount value', () => {
    expect(applyDiscount(100, 'percent', 0)).toBe(0)
    expect(applyDiscount(100, 'fixed', 0)).toBe(0)
  })

  it('handles 100% discount', () => {
    expect(applyDiscount(100, 'percent', 100)).toBe(100)
  })
})

// ─── computeItemTax() ────────────────────────────────────────────────────────

describe('computeItemTax', () => {
  it('returns 0 when tax rate is 0', () => {
    const item = makeItem({ taxRate: 0 })
    expect(computeItemTax(item)).toBe(0)
  })

  it('calculates exclusive tax correctly', () => {
    // 100 × 1 × 16% = 16
    const item = makeItem({ unitPrice: 100, quantity: 1, taxRate: 16, taxInclusive: false })
    expect(computeItemTax(item)).toBe(16)
  })

  it('calculates exclusive tax after item discount', () => {
    // (100 - 20% of 100) × 16% = 80 × 0.16 = 12.8
    const item = makeItem({
      unitPrice: 100,
      quantity: 1,
      discountType: 'percent',
      discountValue: 20,
      taxRate: 16,
      taxInclusive: false
    })
    expect(computeItemTax(item)).toBe(12.8)
  })

  it('calculates inclusive tax correctly', () => {
    // Price 116 includes 16% tax. Tax = 116 - 116/1.16 = 116 - 100 = 16
    const item = makeItem({ unitPrice: 116, quantity: 1, taxRate: 16, taxInclusive: true })
    expect(computeItemTax(item)).toBeCloseTo(16, 3)
  })

  it('handles multi-quantity items', () => {
    // 50 × 3 = 150, tax = 150 × 0.16 = 24
    const item = makeItem({ unitPrice: 50, quantity: 3, taxRate: 16 })
    expect(computeItemTax(item)).toBe(24)
  })
})

// ─── computeLineTotal() ──────────────────────────────────────────────────────

describe('computeLineTotal', () => {
  it('returns unitPrice × quantity for no discount, no tax', () => {
    const item = makeItem({ unitPrice: 50, quantity: 3 })
    expect(computeLineTotal(item)).toBe(150)
  })

  it('applies item discount before adding tax', () => {
    // 100 - 10% = 90, + 16% tax = 90 × 1.16 = 104.4
    const item = makeItem({
      unitPrice: 100,
      quantity: 1,
      discountType: 'percent',
      discountValue: 10,
      taxRate: 16,
      taxInclusive: false
    })
    expect(computeLineTotal(item)).toBeCloseTo(104.4, 3)
  })

  it('line total is never negative', () => {
    // Fixed discount larger than price — should be capped
    const item = makeItem({
      unitPrice: 10,
      quantity: 1,
      discountType: 'fixed',
      discountValue: 999
    })
    expect(computeLineTotal(item)).toBe(0)
  })

  it('tax-inclusive item: line total equals price minus discount', () => {
    const item = makeItem({
      unitPrice: 116,
      quantity: 1,
      taxRate: 16,
      taxInclusive: true
    })
    // Tax is already inside the price; line total = 116
    expect(computeLineTotal(item)).toBe(116)
  })
})

// ─── computeCartTotals() ─────────────────────────────────────────────────────

describe('computeCartTotals', () => {
  it('returns all zeros for empty cart', () => {
    const result = computeCartTotals([], noDiscount)
    expect(result).toEqual({
      subtotal: 0,
      itemDiscountTotal: 0,
      receiptDiscountAmount: 0,
      taxTotal: 0,
      grandTotal: 0
    })
  })

  it('computes totals for a single item with no discounts or tax', () => {
    const items = [makeItem({ unitPrice: 100, quantity: 2 })]
    const result = computeCartTotals(items, noDiscount)
    expect(result.subtotal).toBe(200)
    expect(result.itemDiscountTotal).toBe(0)
    expect(result.receiptDiscountAmount).toBe(0)
    expect(result.taxTotal).toBe(0)
    expect(result.grandTotal).toBe(200)
  })

  it('applies receipt-level percent discount to sum of line totals', () => {
    const items = [makeItem({ unitPrice: 100, quantity: 2 })] // lineTotal = 200
    const receiptDiscount: DiscountEntry = { type: 'percent', value: 10 }
    const result = computeCartTotals(items, receiptDiscount)
    expect(result.receiptDiscountAmount).toBe(20)
    expect(result.grandTotal).toBe(180)
  })

  it('applies receipt-level fixed discount', () => {
    const items = [makeItem({ unitPrice: 100, quantity: 1 })]
    const receiptDiscount: DiscountEntry = { type: 'fixed', value: 15 }
    const result = computeCartTotals(items, receiptDiscount)
    expect(result.receiptDiscountAmount).toBe(15)
    expect(result.grandTotal).toBe(85)
  })

  it('grand total is never negative even with large receipt discount', () => {
    const items = [makeItem({ unitPrice: 50, quantity: 1 })]
    const receiptDiscount: DiscountEntry = { type: 'fixed', value: 999 }
    const result = computeCartTotals(items, receiptDiscount)
    expect(result.grandTotal).toBe(0)
  })

  it('sums tax across multiple items', () => {
    const items = [
      makeItem({ productId: 1, unitPrice: 100, quantity: 1, taxRate: 16 }),
      makeItem({ productId: 2, unitPrice: 200, quantity: 1, taxRate: 8 })
    ]
    const result = computeCartTotals(items, noDiscount)
    // 100 × 16% = 16, 200 × 8% = 16, total tax = 32
    expect(result.taxTotal).toBe(32)
    // grandTotal = (100 + 16) + (200 + 16) = 332
    expect(result.grandTotal).toBe(332)
  })

  it('requirement 12.4: displays subtotal, discount, tax, and grand total', () => {
    const items = [
      makeItem({
        productId: 1,
        unitPrice: 100,
        quantity: 2,
        discountType: 'percent',
        discountValue: 10,
        taxRate: 16
      })
    ]
    const result = computeCartTotals(items, noDiscount)
    // subtotal = 200, item discount = 20, pre-tax = 180, tax = 28.8, lineTotal = 208.8
    expect(result.subtotal).toBe(200)
    expect(result.itemDiscountTotal).toBe(20)
    expect(result.taxTotal).toBe(28.8)
    expect(result.grandTotal).toBe(208.8)
  })
})
