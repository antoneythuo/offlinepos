/**
 * Pure cart calculation functions.
 * These are the single source of truth for all cart math.
 * Used by both the renderer (cartStore) and the main process (SaleService).
 *
 * Property tests for these functions are in tests/property/cart.property.test.ts
 * Implements: Requirements 12.1–12.5, 13.1–13.5, 14.1–14.5
 */

import type { CartItem, DiscountEntry, CartSummary } from '../types'

const DECIMAL_PLACES = 4

/**
 * Round a number to DECIMAL_PLACES decimal places.
 * Uses "round half away from zero" to match financial conventions.
 */
export function round(value: number): number {
  return Math.round(value * 10 ** DECIMAL_PLACES) / 10 ** DECIMAL_PLACES
}

/**
 * Apply a discount to a base amount.
 * Caps the discount so the result is never negative (Requirement 14.3).
 *
 * @param baseAmount - The amount before discount
 * @param discountType - 'none' | 'percent' | 'fixed'
 * @param discountValue - The discount value (percentage 0–100 or fixed amount)
 * @returns The discount amount (never exceeds baseAmount)
 */
export function applyDiscount(
  baseAmount: number,
  discountType: 'none' | 'percent' | 'fixed',
  discountValue: number
): number {
  if (discountType === 'none' || discountValue <= 0) return 0

  let discountAmount: number
  if (discountType === 'percent') {
    // Clamp percentage to [0, 100]
    const clampedPct = Math.min(100, Math.max(0, discountValue))
    discountAmount = baseAmount * (clampedPct / 100)
  } else {
    // Fixed discount
    discountAmount = discountValue
  }

  // Cap at baseAmount — line total can never go negative (Requirement 14.3)
  return round(Math.min(discountAmount, baseAmount))
}

/**
 * Compute the tax amount for a single cart item.
 * Supports both tax-exclusive and tax-inclusive pricing.
 *
 * For tax-exclusive (default):
 *   tax = (unitPrice × quantity - itemDiscount) × (taxRate / 100)
 *
 * For tax-inclusive:
 *   The price already includes tax; extract the tax component:
 *   tax = preTaxTotal - preTaxTotal / (1 + taxRate / 100)
 *
 * Requirement 13.2: apply product's configured tax rate
 */
export function computeItemTax(item: CartItem): number {
  const grossLineAmount = item.unitPrice * item.quantity
  const itemDiscountAmount = applyDiscount(
    grossLineAmount,
    item.discountType,
    item.discountValue
  )
  const preTaxTotal = grossLineAmount - itemDiscountAmount

  if (item.taxRate <= 0) return 0

  if (item.taxInclusive) {
    // Extract tax from inclusive price
    const taxAmount = preTaxTotal - preTaxTotal / (1 + item.taxRate / 100)
    return round(taxAmount)
  } else {
    // Add tax on top of price
    return round(preTaxTotal * (item.taxRate / 100))
  }
}

/**
 * Compute the line total for a single cart item (after discount, including tax for exclusive).
 * For tax-exclusive: lineTotal = (unitPrice × qty - itemDiscount) + tax
 * For tax-inclusive: lineTotal = unitPrice × qty - itemDiscount (tax is already inside)
 *
 * Requirement 12.1: display line total
 */
export function computeLineTotal(item: CartItem): number {
  const grossLineAmount = item.unitPrice * item.quantity
  const itemDiscountAmount = applyDiscount(
    grossLineAmount,
    item.discountType,
    item.discountValue
  )
  const preTaxTotal = grossLineAmount - itemDiscountAmount

  if (item.taxInclusive) {
    // Tax is already included in the price
    return round(preTaxTotal)
  } else {
    // Add tax on top
    const taxAmount = computeItemTax(item)
    return round(preTaxTotal + taxAmount)
  }
}

/**
 * Compute the item-level discount amount for a cart item.
 */
export function computeItemDiscount(item: CartItem): number {
  const grossLineAmount = item.unitPrice * item.quantity
  return applyDiscount(grossLineAmount, item.discountType, item.discountValue)
}

/**
 * Compute full cart totals from a list of items and an optional receipt-level discount.
 *
 * Grand total formula (Property 1):
 *   grandTotal = sum(lineTotals) - receiptDiscountAmount
 *
 * Requirements 12.4, 13.4, 14.2
 */
export function computeCartTotals(
  items: CartItem[],
  receiptDiscount: DiscountEntry
): CartSummary {
  if (items.length === 0) {
    return {
      subtotal: 0,
      itemDiscountTotal: 0,
      receiptDiscountAmount: 0,
      taxTotal: 0,
      grandTotal: 0
    }
  }

  // Sum gross amounts (before any discounts)
  const subtotal = round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))

  // Sum all item-level discounts
  const itemDiscountTotal = round(
    items.reduce((sum, item) => sum + computeItemDiscount(item), 0)
  )

  // Sum all tax amounts
  const taxTotal = round(items.reduce((sum, item) => sum + computeItemTax(item), 0))

  // Sum all line totals (post item-discount, post tax for exclusive)
  const lineTotalsSum = round(items.reduce((sum, item) => sum + computeLineTotal(item), 0))

  // Apply receipt-level discount to the sum of line totals
  const receiptDiscountAmount = applyDiscount(
    lineTotalsSum,
    receiptDiscount.type,
    receiptDiscount.value
  )

  // Grand total: sum of line totals minus receipt discount (never negative)
  const grandTotal = round(Math.max(0, lineTotalsSum - receiptDiscountAmount))

  return {
    subtotal,
    itemDiscountTotal,
    receiptDiscountAmount,
    taxTotal,
    grandTotal
  }
}
