// Sales / POS screen — three-panel layout
// Requirements: 9.1–9.4, 10.1–10.5, 11.1–11.4, 12.1–12.5, 14.1–14.5, 15.1–15.5, 17.1–17.5
//
// Layout (Req 30.4):
//   Left  (~320px, fixed): ProductSearchPanel — search and add products to cart
//   Center (flex-grow):    CartPanel          — active cart with live totals
//   Right  (~280px, fixed): PaymentPanel      — payment method selection and sale completion
//
// All three panels are visible simultaneously at 1024px+ without horizontal scrolling.
// Each panel scrolls independently via overflow-y-auto on its inner body.
//
// Layout at minimum resolution (Req 30.2):
//   At 1024×600 with a 224px sidebar, the content area is ~800px wide.
//   Column widths: 320px (left) + flex-1 (center, ~192px min) + 288px (right) = fits in 800px.
//   The gap-3 (12px) and p-3 (12px) padding account for ~48px, leaving ~752px for columns.
//   320 + 288 = 608px fixed; remaining ~144px goes to the center flex-1 column — sufficient.
//   At 1920×1080 the center column expands naturally to fill the extra space.
//
// Hold/Resume toolbar (Req 17.1–17.5):
//   A thin toolbar above the center CartPanel contains HoldSaleButton and
//   HeldTransactionsDrawer so the cashier can hold and resume sales without
//   leaving the POS screen.
//
// Keyboard shortcuts (Req 30.3 — touch-friendly, also keyboard-accessible):
//   F1 = New sale (clear cart)
//   F2 = Hold sale
//   F3 = Open held transactions drawer
//   F4 = Focus payment panel
//   Escape = Cancel / close open drawers
//   Shortcuts only fire when no input/select/textarea is focused.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import ProductSearchPanel from '../components/ProductSearch/ProductSearchPanel'
import CartPanel from '../components/Cart/CartPanel'
import PaymentPanel from '../components/PaymentModal/PaymentPanel'
import HoldSaleButton from '../components/Cart/HoldSaleButton'
import HeldTransactionsDrawer from '../components/Cart/HeldTransactionsDrawer'
import ReceiptPreviewModal from '../components/ReceiptPreview/ReceiptPreviewModal'
import { useCartStore } from '../store/cartStore'
import { useSessionStore } from '../store/sessionStore'
import { apiCall } from '../hooks/useApi'
import type { CartItem, SaleResult } from '../../../src/types'

// ─── Keyboard hint bar ────────────────────────────────────────────────────────

interface KeyHintProps {
  keyLabel: string
  description: string
}

function KeyHint({ keyLabel, description }: KeyHintProps): React.ReactElement {
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      <kbd
        className="
          inline-flex items-center justify-center
          px-1.5 py-0.5 rounded
          bg-gray-200 dark:bg-gray-700
          border border-gray-300 dark:border-gray-600
          text-gray-600 dark:text-gray-300
          font-mono text-[10px] leading-none
          shadow-sm
        "
      >
        {keyLabel}
      </kbd>
      <span>{description}</span>
    </span>
  )
}

// ─── SalesPage ────────────────────────────────────────────────────────────────

/**
 * SalesPage — the primary POS screen.
 *
 * Uses a CSS flexbox row layout so all three panels sit side-by-side and fill
 * the available viewport height (inherited from AppShell's `flex-1 overflow-hidden`
 * main area). Each panel manages its own vertical scroll internally.
 *
 * Requirement 30.2: renders correctly at 1024×600 minimum resolution.
 * Requirement 30.4: product search, cart, and payment visible simultaneously
 *                   without scrolling.
 * Requirement 17.1–17.5: hold/resume toolbar above the cart panel.
 */
export default function SalesPage(): React.ReactElement {
  // refreshSignal increments each time a hold succeeds, causing the drawer
  // to re-fetch the held list automatically (Req 17.2).
  const [refreshSignal, setRefreshSignal] = useState(0)

  // saleResult holds the last completed sale so ReceiptPreviewModal can display it (Req 15.1–15.5).
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null)

  // openDrawer signal: incrementing this tells HeldTransactionsDrawer to open (F3 shortcut).
  const [openDrawerSignal, setOpenDrawerSignal] = useState(0)

  // focusPaymentSignal: incrementing this tells PaymentPanel to focus its first input (F4 shortcut).
  const [focusPaymentSignal, setFocusPaymentSignal] = useState(0)

  // closeDrawerSignal: incrementing this tells HeldTransactionsDrawer to close (Escape shortcut).
  const [closeDrawerSignal, setCloseDrawerSignal] = useState(0)

  // holdTriggerSignal: incrementing this triggers a hold from the keyboard shortcut (F2).
  const [holdTriggerSignal, setHoldTriggerSignal] = useState(0)

  // Track whether a keyboard-triggered hold is in progress to show feedback.
  const [kbHoldStatus, setKbHoldStatus] = useState<'idle' | 'holding' | 'success' | 'error'>('idle')
  const [kbHoldMessage, setKbHoldMessage] = useState<string>('')

  const clearCart = useCartStore((s) => s.clearCart)
  const cartItems = useCartStore((s) => s.items)
  const currentUser = useSessionStore((s) => s.currentUser)

  const handleHoldSuccess = () => setRefreshSignal((n) => n + 1)

  // ── Keyboard shortcut handler ─────────────────────────────────────────────
  // Only fires when no input/select/textarea/contenteditable is focused.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (isInputFocused) return

      switch (e.key) {
        case 'F1': {
          // New sale — clear the cart
          e.preventDefault()
          clearCart()
          break
        }
        case 'F2': {
          // Hold sale — trigger programmatically
          e.preventDefault()
          setHoldTriggerSignal((n) => n + 1)
          break
        }
        case 'F3': {
          // Open held transactions drawer
          e.preventDefault()
          setOpenDrawerSignal((n) => n + 1)
          break
        }
        case 'F4': {
          // Focus payment panel
          e.preventDefault()
          setFocusPaymentSignal((n) => n + 1)
          break
        }
        case 'Escape': {
          // Cancel — close any open drawers / modals
          e.preventDefault()
          setCloseDrawerSignal((n) => n + 1)
          setSaleResult(null)
          break
        }
        default:
          break
      }
    },
    [clearCart]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── F2: programmatic hold ─────────────────────────────────────────────────
  // When holdTriggerSignal changes, attempt to hold the current cart.
  useEffect(() => {
    if (holdTriggerSignal === 0) return
    if (cartItems.length === 0 || !currentUser) return

    setKbHoldStatus('holding')
    setKbHoldMessage('')

    apiCall<{ holdId: number }>('sales:hold', {
      cashierId: currentUser.id,
      cartData: cartItems as CartItem[],
    })
      .then(() => {
        clearCart()
        setRefreshSignal((n) => n + 1)
        setKbHoldStatus('success')
        setKbHoldMessage('Sale held')
        setTimeout(() => setKbHoldStatus('idle'), 2500)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to hold sale'
        setKbHoldStatus('error')
        setKbHoldMessage(msg)
        setTimeout(() => setKbHoldStatus('idle'), 3500)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdTriggerSignal])

  return (
    // Full-height flex column — fills the AppShell <main> area (flex-1 overflow-auto)
    // overflow-hidden here prevents the page itself from scrolling; panels scroll internally
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">

      {/* ── Main three-panel row ──────────────────────────────────────────── */}
      {/*
        Layout verification at 1024×600 (Req 30.2):
          Viewport: 1024px wide × 600px tall
          AppShell sidebar: w-56 = 224px (confirmed in AppShell.tsx)
          AppShell top bar: h-16 = 64px
          Keyboard hint bar (this page): ~32px
          Content area width: 1024 - 224 = 800px
          Content area height: 600 - 64 - 32 = 504px (sufficient for panel content)

          Column widths inside the p-3 (12px each side) padded flex row:
            Available: 800 - 24px padding - 24px gaps (gap-3 × 2) = 752px
            Left  (w-80 = 320px) + Right (w-72 = 288px) = 608px fixed
            Center flex-1 gets: 752 - 608 = 144px minimum — sufficient for cart display

        Layout verification at 1920×1080 (Req 30.2):
          Content area width: 1920 - 224 = 1696px
          Center column expands to: 1696 - 24 - 24 - 608 = 1040px — ample space.
          All panels remain visible simultaneously without horizontal scrolling.
      */}
      <div className="flex flex-1 min-h-0 gap-3 p-3">

        {/* ── Left panel: Product Search (~320px fixed width) ─────────────── */}
        <div className="w-80 shrink-0 min-h-0">
          <ProductSearchPanel />
        </div>

        {/* ── Center panel: Cart + Hold toolbar (flex-grow) ────────────────── */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">

          {/* Hold/Resume toolbar — Req 17.1–17.5 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Hold current sale (also triggered by F2) */}
            <HoldSaleButton
              onHoldSuccess={handleHoldSuccess}
              triggerSignal={holdTriggerSignal}
            />

            {/* View / resume held sales (also triggered by F3) */}
            <HeldTransactionsDrawer
              refreshSignal={refreshSignal}
              openSignal={openDrawerSignal}
              closeSignal={closeDrawerSignal}
            />

            {/* Keyboard hold status feedback */}
            {kbHoldStatus !== 'idle' && (
              <span
                role="status"
                aria-live="polite"
                className={`text-xs font-medium px-2 py-1 rounded ${
                  kbHoldStatus === 'holding'
                    ? 'text-amber-600 dark:text-amber-400'
                    : kbHoldStatus === 'success'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {kbHoldStatus === 'holding' ? 'Holding…' : kbHoldMessage}
              </span>
            )}
          </div>

          {/* Cart panel fills remaining height */}
          <div className="flex-1 min-h-0">
            <CartPanel />
          </div>
        </div>

        {/* ── Right panel: Payment (~288px fixed width) ────────────────────── */}
        <div className="w-72 shrink-0 min-h-0">
          <PaymentPanel
            onSaleComplete={setSaleResult}
            focusSignal={focusPaymentSignal}
          />
        </div>

      </div>

      {/* ── Keyboard hint bar ─────────────────────────────────────────────── */}
      {/*
        A thin bar at the bottom of the sales screen showing available keyboard
        shortcuts. Only visible when no input is focused (shortcuts are inactive
        while typing). Helps cashiers discover and remember shortcuts.
      */}
      <div
        aria-label="Keyboard shortcuts"
        className="
          shrink-0 flex items-center gap-4 flex-wrap
          px-4 py-1.5
          border-t border-gray-200 dark:border-gray-700
          bg-gray-50 dark:bg-gray-800/60
        "
      >
        <KeyHint keyLabel="F1" description="New sale" />
        <KeyHint keyLabel="F2" description="Hold sale" />
        <KeyHint keyLabel="F3" description="Held sales" />
        <KeyHint keyLabel="F4" description="Payment" />
        <KeyHint keyLabel="Esc" description="Cancel" />
      </div>

      {/* ── Receipt preview modal — shown after sale completion (Req 15.1–15.5) ── */}
      <ReceiptPreviewModal
        receiptData={saleResult?.receiptData ?? null}
        onClose={() => setSaleResult(null)}
      />

    </div>
  )
}
