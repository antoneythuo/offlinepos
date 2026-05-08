// BarcodePrintModal — Task 25.6
// Requirements: 3.1, 3.2
//
// Fetches the barcode SVG for a product via `inventory:barcode:generate` IPC,
// displays it with product name, SKU, and price, and triggers window.print().

import React, { useEffect, useState } from 'react'
import type { IpcResult, Product } from '../../../../src/types'

export interface BarcodePrintModalProps {
  product: Product
  onClose: () => void
}

function formatPrice(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function BarcodePrintModal({ product, onClose }: BarcodePrintModalProps) {
  const [barcodeSvg, setBarcodeSvg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api
      .invoke<IpcResult<string>>('inventory:barcode:generate', { sku: product.sku })
      .then((result) => {
        if (result.success) {
          setBarcodeSvg(result.data)
        } else {
          setError(result.error)
        }
      })
      .catch(() => setError('Failed to generate barcode'))
      .finally(() => setLoading(false))
  }, [product.sku])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handlePrint() {
    window.print()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print barcode"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:bg-transparent print:p-0 print:block"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="
        bg-white dark:bg-gray-800 rounded-xl shadow-2xl
        border border-gray-200 dark:border-gray-700
        w-full max-w-sm flex flex-col
        print:shadow-none print:border-none print:rounded-none print:max-w-none
      ">
        {/* Header — hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Print Barcode</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="
              min-w-[44px] min-h-[44px] flex items-center justify-center
              rounded-lg text-gray-400 dark:text-gray-500
              hover:bg-gray-100 dark:hover:bg-gray-700
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              transition-colors
            "
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Label content */}
        <div className="px-6 py-5 flex flex-col items-center gap-3">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Generating barcode…</p>
            </div>
          )}

          {error && (
            <div role="alert" className="w-full px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {barcodeSvg && !loading && (
            <div
              className="
                w-full rounded-xl border border-gray-200 dark:border-gray-700
                bg-white p-4 flex flex-col items-center gap-2
                print:border-none print:rounded-none print:shadow-none
              "
              role="region"
              aria-label="Barcode label"
            >
              {/* Product name */}
              <p className="text-center text-sm font-semibold text-gray-800 leading-tight line-clamp-2 max-w-full">
                {product.name}
              </p>

              {/* Barcode SVG */}
              <div
                className="my-1 flex justify-center w-full"
                dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                aria-label={`Barcode for ${product.sku}`}
              />

              {/* SKU */}
              <p className="text-center text-xs text-gray-500 font-mono tracking-wide">
                {product.sku}
              </p>

              {/* Price */}
              <p className="text-center text-base font-bold text-gray-900">
                {formatPrice(product.sellingPrice)}
              </p>
            </div>
          )}
        </div>

        {/* Footer — hidden when printing */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="
              min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              hover:bg-gray-200 dark:hover:bg-gray-600
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
              transition-colors
            "
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !!error || !barcodeSvg}
            className="
              inline-flex items-center gap-2
              min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium
              bg-blue-600 hover:bg-blue-700
              text-white
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              disabled:opacity-50 transition-colors
            "
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Label
          </button>
        </div>
      </div>
    </div>
  )
}
