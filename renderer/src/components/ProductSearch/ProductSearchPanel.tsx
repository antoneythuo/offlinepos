// ProductSearchPanel — Task 24.2
// Requirements: 11.1–11.4
//
// Features:
//   - Debounced search input (300ms) → inventory:product:search IPC
//   - Category filter dropdown populated from inventory:category:list on mount
//   - Product grid with cards (name, SKU, price); click adds to cart
//   - Barcode scan support via search input (fast keystrokes + Enter)
//   - "No products found" message when empty
//   - Dark/light mode; min 44×44px tap targets

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Category, IpcResult, Product } from '../../../../src/types'
import { useCartStore } from '../../store/cartStore'

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatPrice(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product
  onAdd: (product: Product) => void
}

function ProductCard({ product, onAdd }: ProductCardProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      // min 44×44px tap target (Req 30.3)
      className="
        flex flex-col justify-between
        w-full min-h-[44px] p-3 rounded-lg text-left
        bg-white dark:bg-gray-700
        border border-gray-200 dark:border-gray-600
        hover:border-blue-500 dark:hover:border-blue-400
        hover:bg-blue-50 dark:hover:bg-gray-600
        active:scale-[0.98]
        transition-colors duration-100
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
      "
      aria-label={`Add ${product.name} to cart`}
    >
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
        {product.name}
      </span>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {product.sku}
        </span>
        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0">
          {formatPrice(product.sellingPrice)}
        </span>
      </div>
    </button>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ProductSearchPanel(): React.ReactElement {
  const addItem = useCartStore((s) => s.addItem)

  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false) // true once first search ran

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load categories on mount ──────────────────────────────────────────────
  useEffect(() => {
    window.api
      .invoke<IpcResult<Category[]>>('inventory:category:list', {})
      .then((result) => {
        if (result.success) setCategories(result.data)
      })
      .catch(() => {
        // silently ignore — categories are optional for filtering
      })
  }, [])

  // ── Search function ───────────────────────────────────────────────────────
  const runSearch = useCallback(
    async (searchQuery: string, catId: number | '') => {
      setLoading(true)
      setSearched(true)
      try {
        const payload: { query: string; categoryId?: number } = { query: searchQuery }
        if (catId !== '') payload.categoryId = catId
        const result = await window.api.invoke<IpcResult<Product[]>>(
          'inventory:product:search',
          payload
        )
        if (result.success) {
          setProducts(result.data)
        } else {
          setProducts([])
        }
      } catch {
        setProducts([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // ── Debounced search on query / category change ───────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(query, categoryId)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, categoryId, runSearch])

  // ── Category change — immediate search (no extra debounce needed) ─────────
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setCategoryId(val === '' ? '' : Number(val))
  }

  // ── Add product to cart ───────────────────────────────────────────────────
  const handleAddProduct = useCallback(
    (product: Product) => {
      addItem({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        stockQuantity: product.quantityOnHand,
        unitPrice: product.sellingPrice,
        costPrice: product.costPrice,
        discountType: 'none',
        discountValue: 0,
        taxRate: product.taxRate,
        taxInclusive: product.taxInclusive
      })
    },
    [addItem]
  )

  // ── Barcode scan: Enter key in search input triggers immediate search ──────
  // USB HID scanners emit characters rapidly then send Enter (Req 11.2, 3.5)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      runSearch(query, categoryId)
    }
  }

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Products
        </h2>

        {/* Search input — min-h-[44px] for touch target */}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name, SKU, or scan barcode…"
          autoFocus
          className="
            w-full min-h-[44px] px-3 py-2 rounded-md text-sm
            bg-gray-50 dark:bg-gray-700
            border border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          "
          aria-label="Search products"
        />

        {/* Category filter — min-h-[44px] for touch target */}
        <select
          value={categoryId}
          onChange={handleCategoryChange}
          className="
            mt-2 w-full min-h-[44px] px-3 py-2 rounded-md text-sm
            bg-gray-50 dark:bg-gray-700
            border border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          "
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Product grid ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <div className="flex items-center justify-center h-20">
            <span className="text-sm text-gray-400 dark:text-gray-500">Searching…</span>
          </div>
        )}

        {!loading && searched && products.length === 0 && (
          // Req 11.4: "No products found" message
          <div className="flex items-center justify-center h-20">
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
              No products found
            </p>
          </div>
        )}

        {!loading && !searched && (
          <div className="flex items-center justify-center h-20">
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
              Type to search or scan a barcode
            </p>
          </div>
        )}

        {!loading && products.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={handleAddProduct} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
