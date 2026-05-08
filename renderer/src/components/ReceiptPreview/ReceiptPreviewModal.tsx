// ReceiptPreviewModal — POS thermal receipt design (80mm width)

import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { IpcResult, ReceiptData } from '../../../../src/types'

function fmt(n: number): string {
  return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) +
    '  ' + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
}

function fmtMethod(m: string): string {
  return m === 'cash' ? 'Cash' : m === 'card' ? 'Card' : 'M-Money'
}

function Line(): React.ReactElement {
  return <div className="border-t border-dashed border-gray-400 my-1.5" />
}

interface ReceiptPreviewModalProps {
  receiptData: ReceiptData | null
  onClose: () => void
}

export default function ReceiptPreviewModal({ receiptData, onClose }: ReceiptPreviewModalProps): React.ReactElement | null {
  const [isPrinting, setIsPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (receiptData) { setIsPrinting(false); setPrintError(null) }
  }, [receiptData])

  useEffect(() => {
    if (!receiptData) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [receiptData, onClose])

  const handlePrint = useCallback(async () => {
    if (!receiptData || !receiptRef.current) return
    setIsPrinting(true)
    setPrintError(null)

    try {
      const html = receiptRef.current.innerHTML
      const result = await window.api.invoke<IpcResult<{ printed: boolean }>>('print:html', { html })
      if (!result.success) setPrintError(result.error ?? 'Print failed.')
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed.')
    } finally {
      setIsPrinting(false)
    }

    // Also notify main process receipt handler (fire and forget)
    window.api.invoke<IpcResult<{ queued?: boolean }>>('receipt:print', { receiptData }).catch(() => {})
  }, [receiptData])

  if (!receiptData) return null

  const {
    businessName, businessAddress, receiptHeader, receiptFooter,
    transactionRef, dateTime, cashierName, customerName,
    items, subtotal, discountAmount, taxAmount, grandTotal,
    payments, changeAmount, isDuplicate
  } = receiptData

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Receipt"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-xs max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isDuplicate ? 'Receipt (Duplicate)' : 'Receipt'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {printError && (
          <div role="alert" className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border-b border-red-200 shrink-0">
            <p className="text-xs text-red-700 dark:text-red-300">{printError}</p>
          </div>
        )}

        {/* Receipt body — styled like a thermal receipt */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white">
          <div
            ref={receiptRef}
            style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#000', padding: '12px 14px', width: '100%' }}
          >
            {/* Header */}
            {receiptHeader && <p className="center sm" style={{ textAlign: 'center', fontSize: '10px', marginBottom: '4px' }}>{receiptHeader}</p>}
            <p className="center bold xl" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '2px' }}>{businessName}</p>
            {businessAddress && <p className="center sm" style={{ textAlign: 'center', fontSize: '10px', marginBottom: '4px' }}>{businessAddress}</p>}

            {isDuplicate && (
              <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', border: '1px solid #000', padding: '2px', margin: '4px 0' }}>
                *** DUPLICATE ***
              </p>
            )}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Transaction info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Ref #</span><span style={{ textAlign: 'right', fontWeight: 'bold' }}>{transactionRef}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Date</span><span style={{ textAlign: 'right' }}>{fmtDate(dateTime)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Cashier</span><span style={{ textAlign: 'right', fontWeight: 'bold' }}>{cashierName}</span>
            </div>
            {customerName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Customer</span><span style={{ textAlign: 'right' }}>{customerName}</span>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Items */}
            <p style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ITEMS</p>
            {items.map((item, i) => (
              <div key={i} style={{ marginBottom: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', flex: 1, paddingRight: '8px' }}>{item.productName}</span>
                  <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{fmt(item.lineTotal)}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#444' }}>
                  {item.quantity} × {fmt(item.unitPrice)}
                  {item.discountAmount > 0 && <span style={{ marginLeft: '6px' }}>disc −{fmt(item.discountAmount)}</span>}
                </div>
              </div>
            ))}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Discount</span><span>−{fmt(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Tax</span><span>{fmt(taxAmount)}</span>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', margin: '4px 0' }}>
              <span>TOTAL</span><span>{fmt(grandTotal)}</span>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Payments */}
            <p style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAYMENT</p>
            {payments.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>{fmtMethod(p.method)}</span><span>{fmt(p.amount)}</span>
              </div>
            ))}
            {changeAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', margin: '2px 0' }}>
                <span>Change</span><span>{fmt(changeAmount)}</span>
              </div>
            )}

            {/* Footer */}
            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '8px 0 4px' }} />
            <p style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px' }}>
              {receiptFooter ?? 'Thank you for your business!'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-900">
          <button type="button" onClick={handlePrint} disabled={isPrinting}
            className={['flex-1 min-h-[44px] rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2',
              isPrinting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'].join(' ')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {isPrinting ? 'Printing…' : 'Print'}
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 min-h-[44px] rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
