// InventoryPage — Task 25.1
// Requirements: 1.1–1.7, 2.1–2.5, 3.1–3.5, 4.1–4.5, 6.1–6.4, 7.1–7.5, 8.1–8.4
//
// Features:
//   - Debounced search input (300ms) + category filter dropdown
//   - Product table: Name, SKU, Category, Quantity (low-stock badge), Selling Price, Actions
//   - Per-row actions: Edit, Delete (with confirmation), Adjust Stock, Barcode
//   - "Add Product" button → ProductFormModal (create mode)
//   - "Import CSV" and "Export CSV" buttons
//   - Low-stock filter toggle
//   - Dark/light mode; min 44×44px tap targets (Req 30.1, 30.3)

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Category, IpcResult, Product } from '../../../src/types'
import ProductFormModal from '../components/shared/ProductFormModal'
import StockAdjustmentModal from '../components/shared/StockAdjustmentModal'
import BarcodePrintModal from '../components/shared/BarcodePrintModal'
import CsvImportModal from '../components/shared/CsvImportModal'
import StockReceiptModal from '../components/shared/StockReceiptModal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function isLowStock(product: Product): boolean {
  return product.quantityOnHand <= product.reorderPoint
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Inline confirmation dialog rendered inside the table row area */
interface DeleteConfirmProps {
  productName: string
  onConfirm: () => void
  onCancel: () => void
}
function DeleteConfirm({ productName, onConfirm, onCancel }: DeleteConfirmProps): React.ReactElement {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm delete"
      className="
        fixed inset-0 z-50 flex items-center justify-center
        bg-black/50 backdrop-blur-sm
      "
    >
      <div className="
        bg-white dark:bg-gray-800 rounded-xl shadow-2xl
        border border-gray-200 dark:border-gray-700
        p-6 w-full max-w-sm mx-4
      ">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Delete product?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          <span className="font-medium text-gray-900 dark:text-gray-100">{productName}</span>
          {' '}will be permanently removed. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="
              min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              hover:bg-gray-200 dark:hover:bg-gray-600
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
              transition-colors
            "
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="
              min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
              bg-red-600 hover:bg-red-700
              text-white
              focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500
              transition-colors
            "
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Action button helper ─────────────────────────────────────────────────────

interface ActionBtnProps {
  onClick: () => void
  title: string
  className?: string
  children: React.ReactNode
}
function ActionBtn({ onClick, title, className = '', children }: ActionBtnProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`
        inline-flex items-center justify-center
        min-w-[44px] min-h-[44px] rounded-lg
        text-sm font-medium
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        transition-colors
        ${className}
      `}
    >
      {children}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InventoryPage(): React.ReactElement {
  // ── Data state ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Filter state ────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)

  // ── Modal state ──────────────────────────────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)

  // ── Delete confirmation state ────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load categories on mount ─────────────────────────────────────────────
  useEffect(() => {
    window.api
      .invoke<IpcResult<Category[]>>('inventory:category:list', {})
      .then((result) => {
        if (result.success) setCategories(result.data)
      })
      .catch(() => {/* silently ignore */})
  }, [])

  // ── Search / fetch products ──────────────────────────────────────────────
  const fetchProducts = useCallback(async (searchQuery: string, catId: number | '', lowStock: boolean) => {
    setLoading(true)
    setError(null)
    try {
      if (lowStock) {
        // Use dedicated low-stock channel (Req 4.2, 4.3)
        const result = await window.api.invoke<IpcResult<Product[]>>('inventory:lowstock:list', {})
        if (result.success) {
          // Apply any additional query/category filter client-side
          let filtered = result.data
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q) ||
                (p.barcode ?? '').toLowerCase().includes(q)
            )
          }
          if (catId !== '') {
            filtered = filtered.filter((p) => p.categoryId === catId)
          }
          setProducts(filtered)
        } else {
          setProducts([])
          setError(result.error)
        }
      } else {
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
          setError(result.error)
        }
      }
    } catch (err) {
      setProducts([])
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Debounced search on query / category / low-stock toggle change ────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchProducts(query, categoryId, showLowStockOnly)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, categoryId, showLowStockOnly, fetchProducts])

  // ── Delete product ────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    try {
      const result = await window.api.invoke<IpcResult<void>>('inventory:product:delete', {
        id: deleteTarget.id,
      })
      if (result.success) {
        setDeleteTarget(null)
        // Refresh list
        fetchProducts(query, categoryId, showLowStockOnly)
      } else {
        setDeleteError(result.error)
      }
    } catch {
      setDeleteError('Failed to delete product')
    }
  }

  // ── CSV import / export ───────────────────────────────────────────────────
  const handleImportCsv = () => {
    setShowCsvModal(true)
  }

  const handleExportCsv = async () => {
    try {
      await window.api.invoke('inventory:csv:export', {})
    } catch {
      // Error handling will be improved in future tasks
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openEdit = (product: Product) => {
    setSelectedProduct(product)
    setShowEditModal(true)
  }
  const openAdjust = (product: Product) => {
    setSelectedProduct(product)
    setShowAdjustModal(true)
  }
  const openBarcode = (product: Product) => {
    setSelectedProduct(product)
    setShowBarcodeModal(true)
  }
  const handleModalSaved = () => {
    setShowAddModal(false)
    setShowEditModal(false)
    setShowAdjustModal(false)
    setShowReceiptModal(false)
    setShowCsvModal(false)
    setSelectedProduct(null)
    fetchProducts(query, categoryId, showLowStockOnly)
  }
  const handleModalClose = () => {
    setShowAddModal(false)
    setShowEditModal(false)
    setShowAdjustModal(false)
    setShowBarcodeModal(false)
    setShowReceiptModal(false)
    setShowCsvModal(false)
    setSelectedProduct(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="
        shrink-0 px-6 py-4
        bg-white dark:bg-gray-800
        border-b border-gray-200 dark:border-gray-700
      ">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Inventory
          </h1>

          {/* ── Toolbar buttons ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Low-stock toggle (Req 4.2, 4.3) */}
            <button
              type="button"
              onClick={() => setShowLowStockOnly((v) => !v)}
              aria-pressed={showLowStockOnly}
              className={`
                inline-flex items-center gap-2
                min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
                border transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500
                ${showLowStockOnly
                  ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-400 dark:border-orange-500 text-orange-700 dark:text-orange-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }
              `}
            >
              {/* Warning icon */}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Low Stock
            </button>

            {/* Import CSV (Req 8.1, 8.2) */}
            <button
              type="button"
              onClick={handleImportCsv}
              className="
                inline-flex items-center gap-2
                min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
                bg-white dark:bg-gray-700
                border border-gray-300 dark:border-gray-600
                text-gray-700 dark:text-gray-300
                hover:bg-gray-50 dark:hover:bg-gray-600
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                transition-colors
              "
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Import CSV
            </button>

            {/* Receive Stock (Req 7.2) */}
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="
                inline-flex items-center gap-2
                min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
                bg-white dark:bg-gray-700
                border border-gray-300 dark:border-gray-600
                text-gray-700 dark:text-gray-300
                hover:bg-gray-50 dark:hover:bg-gray-600
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                transition-colors
              "
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              Receive Stock
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="
                inline-flex items-center gap-2
                min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
                bg-white dark:bg-gray-700
                border border-gray-300 dark:border-gray-600
                text-gray-700 dark:text-gray-300
                hover:bg-gray-50 dark:hover:bg-gray-600
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                transition-colors
              "
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </button>

            {/* Add Product (Req 1.1) */}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="
                inline-flex items-center gap-2
                min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium
                bg-blue-600 hover:bg-blue-700
                text-white
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                transition-colors
              "
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Product
            </button>
          </div>
        </div>

        {/* ── Search + filter row ──────────────────────────────────────── */}
        <div className="mt-3 flex flex-wrap gap-3">
          {/* Search input — debounced 300ms (Req 11.1) */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, SKU, or barcode…"
              className="
                w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg text-sm
                bg-gray-50 dark:bg-gray-700
                border border-gray-300 dark:border-gray-600
                text-gray-900 dark:text-gray-100
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              "
              aria-label="Search products"
            />
          </div>

          {/* Category filter (Req 2.5) */}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            className="
              min-h-[44px] px-3 py-2 rounded-lg text-sm
              bg-gray-50 dark:bg-gray-700
              border border-gray-300 dark:border-gray-600
              text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            "
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="
            shrink-0 mx-6 mt-3 px-4 py-3 rounded-lg text-sm
            bg-red-50 dark:bg-red-900/30
            border border-red-200 dark:border-red-700
            text-red-700 dark:text-red-300
          "
        >
          {error}
        </div>
      )}

      {/* ── Delete error banner ───────────────────────────────────────────── */}
      {deleteError && (
        <div
          role="alert"
          className="
            shrink-0 mx-6 mt-3 px-4 py-3 rounded-lg text-sm
            bg-red-50 dark:bg-red-900/30
            border border-red-200 dark:border-red-700
            text-red-700 dark:text-red-300
          "
        >
          {deleteError}
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="ml-3 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Product table ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-gray-400 dark:text-gray-500">Loading products…</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {showLowStockOnly ? 'No low-stock products found.' : 'No products found.'}
            </p>
            {!showLowStockOnly && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Add your first product
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    SKU
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Quantity
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-right">
                    Selling Price
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="
                      bg-white dark:bg-gray-800
                      hover:bg-gray-50 dark:hover:bg-gray-750
                      transition-colors
                    "
                  >
                    {/* Name */}
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium max-w-[200px]">
                      <span className="line-clamp-2">{product.name}</span>
                    </td>

                    {/* SKU */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                      {product.sku}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {product.categoryName ?? '—'}
                    </td>

                    {/* Quantity + low-stock badge (Req 4.1, 4.2) */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${
                          isLowStock(product)
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {Number(product.quantityOnHand).toLocaleString()}
                        </span>
                        {isLowStock(product) && (
                          <span
                            title={`Reorder point: ${product.reorderPoint}`}
                            className="
                              inline-flex items-center gap-1
                              px-2 py-0.5 rounded-full text-xs font-semibold
                              bg-red-100 dark:bg-red-900/40
                              text-red-700 dark:text-red-300
                              border border-red-200 dark:border-red-700
                            "
                          >
                            {/* Mini warning icon */}
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            Low
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Selling Price */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                      {formatPrice(product.sellingPrice)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">

                        {/* Edit (Req 1.2) */}
                        <ActionBtn
                          onClick={() => openEdit(product)}
                          title="Edit product"
                          className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </ActionBtn>

                        {/* Adjust Stock (Req 6.1) */}
                        <ActionBtn
                          onClick={() => openAdjust(product)}
                          title="Adjust stock"
                          className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                          </svg>
                        </ActionBtn>

                        {/* Barcode (Req 3.1, 3.2) */}
                        <ActionBtn
                          onClick={() => openBarcode(product)}
                          title="Print barcode"
                          className="text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                          </svg>
                        </ActionBtn>

                        {/* Delete (Req 1.3, 1.4) */}
                        <ActionBtn
                          onClick={() => { setDeleteTarget(product); setDeleteError(null) }}
                          title="Delete product"
                          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </ActionBtn>

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {/* Add Product modal (task 25.2) */}
      {showAddModal && (
        <ProductFormModal
          key={`add-${Date.now()}`}
          product={null}
          onClose={handleModalClose}
          onSaved={handleModalSaved}
        />
      )}

      {/* Edit Product modal (task 25.2) */}
      {showEditModal && selectedProduct && (
        <ProductFormModal
          product={selectedProduct}
          onClose={handleModalClose}
          onSaved={handleModalSaved}
        />
      )}

      {/* Adjust Stock modal (task 25.3) */}
      {showAdjustModal && selectedProduct && (
        <StockAdjustmentModal
          product={selectedProduct}
          onClose={handleModalClose}
          onSaved={handleModalSaved}
        />
      )}

      {/* Barcode Print modal (task 25.6) */}
      {showBarcodeModal && selectedProduct && (
        <BarcodePrintModal
          product={selectedProduct}
          onClose={handleModalClose}
        />
      )}

      {/* Stock Receipt modal (task 25.4) */}
      {showReceiptModal && (
        <StockReceiptModal
          onClose={handleModalClose}
          onSaved={handleModalSaved}
        />
      )}

      {/* CSV Import modal (task 25.5) */}
      {showCsvModal && (
        <CsvImportModal
          onClose={handleModalClose}
          onImported={() => fetchProducts(query, categoryId, showLowStockOnly)}
        />
      )}

      {/* Delete confirmation dialog (Req 1.3, 1.4) */}
      {deleteTarget && (
        <DeleteConfirm
          productName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null) }}
        />
      )}

    </div>
  )
}
