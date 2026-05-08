// CartPanel — Task 24.3
// +/- qty buttons, editable price with OK button, cost price floor, no discount UI

import React, { useCallback, useState } from 'react'
import { useCartStore } from '../../store/cartStore'
import { computeLineTotal } from '../../../../src/utils/cartCalculations'
import type { CartItem } from '../../../../src/types'

function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface CartLineItemProps {
  item: CartItem
  onQuantityChange: (productId: number, qty: number) => void
  onPriceChange: (productId: number, price: number) => void
  onRemove: (productId: number) => void
}

function CartLineItem({ item, onQuantityChange, onPriceChange, onRemove }: CartLineItemProps): React.ReactElement {
  const lineTotal = computeLineTotal(item)
  const costPrice = item.costPrice ?? 0

  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState(String(item.unitPrice))
  const [priceError, setPriceError] = useState<string | null>(null)

  const openPriceEdit = () => {
    setPriceInput(String(item.unitPrice))
    setPriceError(null)
    setEditingPrice(true)
  }

  const commitPrice = () => {
    const val = parseFloat(priceInput)
    if (isNaN(val) || val < 0) {
      setPriceError('Enter a valid price')
      return
    }
    if (costPrice > 0 && val < costPrice) {
      setPriceError(`Cannot be less than cost price (${formatCurrency(costPrice)})`)
      return
    }
    onPriceChange(item.productId, val)
    setEditingPrice(false)
    setPriceError(null)
  }

  const cancelPriceEdit = () => {
    setPriceInput(String(item.unitPrice))
    setPriceError(null)
    setEditingPrice(false)
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      {/* Row 1: name + remove */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight truncate">
            {item.productName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.sku}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.productId)}
          aria-label={`Remove ${item.productName}`}
          className="flex items-center justify-center !min-w-[44px] !min-h-[44px] -mr-2 -mt-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Row 2: qty stepper + price + line total */}
      <div className="flex items-center gap-3">
        {/* +/- stepper */}
        <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => onQuantityChange(item.productId, item.quantity - 1)}
            aria-label="Decrease quantity"
            className="!min-w-[36px] !min-h-[44px] w-9 h-11 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none text-xl font-medium select-none"
          >
            −
          </button>
          <input
            type="number"
            min={0}
            step={1}
            value={item.quantity}
            onChange={(e) => onQuantityChange(item.productId, parseInt(e.target.value, 10) || 0)}
            aria-label={`Quantity for ${item.productName}`}
            style={{ MozAppearance: 'textfield' }}
            className="w-12 h-11 !min-h-0 text-center text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-x border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => onQuantityChange(item.productId, item.quantity + 1)}
            aria-label="Increase quantity"
            className="!min-w-[36px] !min-h-[44px] w-9 h-11 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none text-xl font-medium select-none"
          >
            +
          </button>
        </div>

        {/* Price */}
        <div className="flex-1 min-w-0">
          {editingPrice ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 shrink-0">@</span>
                <input
                  type="number"
                  step={0.01}
                  value={priceInput}
                  autoFocus
                  onChange={(e) => { setPriceInput(e.target.value); setPriceError(null) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitPrice()
                    if (e.key === 'Escape') cancelPriceEdit()
                  }}
                  style={{ MozAppearance: 'textfield' }}
                  className="w-24 h-9 !min-h-0 px-2 rounded text-sm text-right bg-white dark:bg-gray-700 border border-blue-500 text-gray-900 dark:text-gray-100 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-label="Edit selling price"
                />
                <button
                  type="button"
                  onClick={commitPrice}
                  className="h-9 !min-h-0 px-3 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white focus:outline-none transition-colors"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={cancelPriceEdit}
                  className="h-9 !min-h-0 px-2 rounded text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none transition-colors"
                >
                  ✕
                </button>
              </div>
              {priceError && (
                <p className="text-xs text-red-600 dark:text-red-400">{priceError}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openPriceEdit}
              title="Click to edit price"
              className="!min-h-0 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline focus:outline-none rounded text-left"
            >
              @ {formatCurrency(item.unitPrice)}
            </button>
          )}
          {item.taxRate > 0 && !editingPrice && (
            <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Tax {item.taxRate}%{item.taxInclusive ? ' incl.' : ''}
            </span>
          )}
        </div>

        {/* Line total */}
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0">
          {formatCurrency(lineTotal)}
        </div>
      </div>
    </li>
  )
}

export default function CartPanel(): React.ReactElement {
  const items = useCartStore((s) => s.items)
  const summary = useCartStore((s) => s.summary)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const updateUnitPrice = useCartStore((s) => s.updateUnitPrice)
  const removeItem = useCartStore((s) => s.removeItem)

  const handleQuantityChange = useCallback(
    (productId: number, qty: number) => updateQuantity(productId, qty),
    [updateQuantity]
  )
  const handlePriceChange = useCallback(
    (productId: number, price: number) => updateUnitPrice(productId, price),
    [updateUnitPrice]
  )
  const handleRemove = useCallback(
    (productId: number) => removeItem(productId),
    [removeItem]
  )

  const isEmpty = items.length === 0

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Cart
          {!isEmpty && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              ({items.length} {items.length === 1 ? 'item' : 'items'})
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-300 dark:text-gray-600" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500">Cart is empty</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 text-center">Search for products or scan a barcode</p>
          </div>
        ) : (
          <ul role="list" aria-label="Cart items">
            {items.map((item) => (
              <CartLineItem
                key={item.productId}
                item={item}
                onQuantityChange={handleQuantityChange}
                onPriceChange={handlePriceChange}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg space-y-1.5">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Subtotal</span>
          <span>{formatCurrency(summary.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Tax</span>
          <span>{formatCurrency(summary.taxTotal)}</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5">
          <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-100">
            <span>Grand Total</span>
            <span>{formatCurrency(summary.grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
