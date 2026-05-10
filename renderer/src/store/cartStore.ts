import { create } from 'zustand'
import type { CartItem, DiscountEntry, CartSummary } from '../../../src/types'
import { computeCartTotals } from '../../../src/utils/cartCalculations'

interface CartState {
  items: CartItem[]
  receiptDiscount: DiscountEntry
  summary: CartSummary

  // Actions
  addItem: (item: CartItem) => void
  updateQuantity: (productId: number, quantity: number) => void
  updateUnitPrice: (productId: number, price: number) => void
  updateItemDiscount: (productId: number, discount: DiscountEntry) => void
  removeItem: (productId: number) => void
  setReceiptDiscount: (discount: DiscountEntry) => void
  clearCart: () => void
}

const emptyDiscount: DiscountEntry = { type: 'none', value: 0 }

const emptySummary: CartSummary = {
  subtotal: 0,
  itemDiscountTotal: 0,
  receiptDiscountAmount: 0,
  taxTotal: 0,
  grandTotal: 0
}

/**
 * Cart store — manages the active sale cart.
 * Uses computeCartTotals from cartCalculations.ts for all math.
 * Requirement 12.1–12.5: cart management with live totals
 */
export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  receiptDiscount: emptyDiscount,
  summary: emptySummary,

  addItem: (newItem) => {
    const { items, receiptDiscount } = get()
    const existingIndex = items.findIndex((i) => i.productId === newItem.productId)

    let updatedItems: CartItem[]
    if (existingIndex >= 0) {
      // Increment quantity but cap at stockQuantity
      updatedItems = items.map((item, idx) => {
        if (idx !== existingIndex) return item
        const newQty = Math.min(item.quantity + newItem.quantity, item.stockQuantity)
        return { ...item, quantity: newQty }
      })
    } else {
      updatedItems = [...items, { ...newItem, quantity: Math.min(newItem.quantity, newItem.stockQuantity) }]
    }

    set({
      items: updatedItems,
      summary: computeCartTotals(updatedItems, receiptDiscount)
    })
  },

  updateQuantity: (productId, quantity) => {
    const { items, receiptDiscount } = get()
    const item = items.find((i) => i.productId === productId)
    const capped = item ? Math.min(quantity, item.stockQuantity) : quantity
    const updatedItems =
      capped <= 0
        ? items.filter((i) => i.productId !== productId)
        : items.map((i) => (i.productId === productId ? { ...i, quantity: capped } : i))

    set({
      items: updatedItems,
      summary: computeCartTotals(updatedItems, receiptDiscount)
    })
  },

  updateUnitPrice: (productId, price) => {
    const { items, receiptDiscount } = get()
    const updatedItems = items.map((i) =>
      i.productId === productId ? { ...i, unitPrice: Math.max(0, price) } : i
    )
    set({
      items: updatedItems,
      summary: computeCartTotals(updatedItems, receiptDiscount)
    })
  },

  updateItemDiscount: (productId, discount) => {
    const { items, receiptDiscount } = get()
    const updatedItems = items.map((i) =>
      i.productId === productId
        ? { ...i, discountType: discount.type, discountValue: discount.value }
        : i
    )
    set({
      items: updatedItems,
      summary: computeCartTotals(updatedItems, receiptDiscount)
    })
  },

  removeItem: (productId) => {
    const { items, receiptDiscount } = get()
    const updatedItems = items.filter((i) => i.productId !== productId)
    set({
      items: updatedItems,
      summary: computeCartTotals(updatedItems, receiptDiscount)
    })
  },

  setReceiptDiscount: (discount) => {
    const { items } = get()
    set({
      receiptDiscount: discount,
      summary: computeCartTotals(items, discount)
    })
  },

  clearCart: () =>
    set({
      items: [],
      receiptDiscount: emptyDiscount,
      summary: emptySummary
    })
}))
