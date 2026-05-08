// HeldTransactionsDrawer — Task 24.5
// Requirements: 17.2, 17.3, 17.4, 17.5
//
// A slide-in drawer that lists all held transactions for the current cashier.
// - Shows hold time and item count for each held transaction (Req 17.2)
// - "Resume" button on each item: calls `sales:resume` IPC, then restores
//   cart items via `cartStore.addItem` for each item (Req 17.3)
// - Supports up to 10 held transactions (Req 17.4)
// - A trigger button to open/close the drawer
// - Refreshes the list when opened or when a hold is successfully created
// - Accepts `openSignal` prop to open the drawer programmatically (F3 shortcut)
// - Accepts `closeSignal` prop to close the drawer programmatically (Escape shortcut)

import React, { useState, useEffect, useCallback } from 'react'
import { useCartStore } from '../../store/cartStore'
import { useSessionStore } from '../../store/sessionStore'
import { apiCall } from '../../hooks/useApi'
import type { CartItem } from '../../../../src/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeldTransactionSummary {
  id: number
  cashierId: number
  cartData: { cartData: CartItem[]; cashierId: number; discountType?: string; discountValue?: number }
  heldAt: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatHeldAt(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return isoString
  }
}

function getItemCount(held: HeldTransactionSummary): number {
  try {
    const items = held.cartData?.cartData
    if (Array.isArray(items)) {
      return items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
    }
  } catch {
    // fall through
  }
  return 0
}

// ─── HeldTransactionRow ───────────────────────────────────────────────────────

interface HeldTransactionRowProps {
  held: HeldTransactionSummary
  onResume: (holdId: number) => Promise<void>
  resumingId: number | null
}

function HeldTransactionRow({ held, onResume, resumingId }: HeldTransactionRowProps): React.ReactElement {
  const isResuming = resumingId === held.id
  const itemCount = getItemCount(held)

  return (
    <li className="
      flex items-center justify-between gap-3 px-4 py-3
      border-b border-gray-100 dark:border-gray-700 last:border-b-0
    ">
      {/* Hold info */}
      <div className="flex-1 min-w-0">
        {/* Hold time — Req 17.2 */}
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Held at {formatHeldAt(held.heldAt)}
        </p>
        {/* Item count — Req 17.2 */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Resume button — min 44×44px tap target (Req 30.3) */}
      <button
        type="button"
        onClick={() => onResume(held.id)}
        disabled={isResuming || resumingId !== null}
        aria-label={`Resume held sale from ${formatHeldAt(held.heldAt)}`}
        className={`
          flex items-center gap-1.5 px-3
          min-h-[44px] min-w-[44px]
          rounded-md text-sm font-medium
          border transition-colors duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500
          ${isResuming || resumingId !== null
            ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
          }
        `}
      >
        {isResuming ? (
          <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
            <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
          </svg>
        )}
        <span>Resume</span>
      </button>
    </li>
  )
}

// ─── HeldTransactionsDrawer ───────────────────────────────────────────────────

interface HeldTransactionsDrawerProps {
  /** External signal to refresh the list (e.g. after a new hold is created) */
  refreshSignal?: number
  /** Incrementing this value opens the drawer programmatically (F3 shortcut) */
  openSignal?: number
  /** Incrementing this value closes the drawer programmatically (Escape shortcut) */
  closeSignal?: number
}

export default function HeldTransactionsDrawer({ refreshSignal, openSignal, closeSignal }: HeldTransactionsDrawerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [heldList, setHeldList] = useState<HeldTransactionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resumingId, setResumingId] = useState<number | null>(null)
  const [resumeError, setResumeError] = useState<string | null>(null)

  const addItem = useCartStore((s) => s.addItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const currentUser = useSessionStore((s) => s.currentUser)

  // ── Fetch held transactions ────────────────────────────────────────────────

  const fetchHeld = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    setError(null)
    try {
      const list = await apiCall<HeldTransactionSummary[]>('sales:listHeld', {
        cashierId: currentUser.id,
      })
      // Req 17.4: cap display at 10
      setHeldList((list ?? []).slice(0, 10))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load held sales')
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  // Refresh when drawer opens
  useEffect(() => {
    if (isOpen) {
      void fetchHeld()
    }
  }, [isOpen, fetchHeld])

  // Refresh when a new hold is created (refreshSignal changes)
  useEffect(() => {
    if (refreshSignal !== undefined && refreshSignal > 0 && isOpen) {
      void fetchHeld()
    }
  }, [refreshSignal, isOpen, fetchHeld])

  // Open drawer programmatically (F3 keyboard shortcut)
  useEffect(() => {
    if (openSignal !== undefined && openSignal > 0) {
      setIsOpen(true)
    }
  }, [openSignal])

  // Close drawer programmatically (Escape keyboard shortcut)
  useEffect(() => {
    if (closeSignal !== undefined && closeSignal > 0) {
      setIsOpen(false)
    }
  }, [closeSignal])

  // ── Resume a held transaction ──────────────────────────────────────────────

  const handleResume = async (holdId: number) => {
    if (resumingId !== null) return
    setResumingId(holdId)
    setResumeError(null)

    try {
      const held = await apiCall<HeldTransactionSummary>('sales:resume', { holdId })

      // Req 17.3: restore cart to saved state
      // Clear current cart first, then add each item
      clearCart()
      const cartItems: CartItem[] = Array.isArray(held.cartData?.cartData)
        ? held.cartData.cartData
        : []

      for (const item of cartItems) {
        addItem(item)
      }

      // Req 17.5: remove from held list after resumption
      setHeldList((prev) => prev.filter((h) => h.id !== holdId))

      // Close drawer so the cashier can see the restored cart
      setIsOpen(false)
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Failed to resume sale')
    } finally {
      setResumingId(null)
    }
  }

  // ── Trigger button ─────────────────────────────────────────────────────────

  const heldCount = heldList.length

  return (
    <>
      {/* Trigger button — min 44×44px tap target (Req 30.3) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`View held sales${heldCount > 0 ? ` (${heldCount})` : ''}`}
        aria-expanded={isOpen}
        title="View held transactions"
        className="
          relative flex items-center gap-1.5 px-3
          min-h-[44px] min-w-[44px]
          rounded-md text-sm font-medium
          border transition-colors duration-150
          bg-gray-50 dark:bg-gray-700
          border-gray-300 dark:border-gray-600
          text-gray-700 dark:text-gray-300
          hover:bg-gray-100 dark:hover:bg-gray-600
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500
        "
      >
        {/* List icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
          <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
        </svg>
        <span>Held</span>

        {/* Badge showing count */}
        {heldCount > 0 && (
          <span
            aria-label={`${heldCount} held sale${heldCount !== 1 ? 's' : ''}`}
            className="
              absolute -top-1.5 -right-1.5
              flex items-center justify-center
              w-5 h-5 rounded-full text-xs font-bold
              bg-amber-500 text-white
            "
          >
            {heldCount}
          </span>
        )}
      </button>

      {/* ── Drawer overlay + panel ─────────────────────────────────────────── */}
      {isOpen && (
        <>
          {/* Backdrop — click to close */}
          <div
            className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />

          {/* Slide-in panel from the right */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Held transactions"
            className="
              fixed right-0 top-0 bottom-0 z-50
              w-80 max-w-full
              flex flex-col
              bg-white dark:bg-gray-800
              border-l border-gray-200 dark:border-gray-700
              shadow-xl
            "
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Held Sales
                </h2>
                {/* Req 17.4: up to 10 */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {heldCount} of 10 slots used
                </p>
              </div>

              {/* Close button — min 44×44px */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close held sales drawer"
                className="
                  flex items-center justify-center
                  min-w-[44px] min-h-[44px] -mr-2
                  rounded text-gray-400 dark:text-gray-500
                  hover:text-gray-700 dark:hover:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  transition-colors duration-100
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                "
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            {/* Drawer body — scrollable list */}
            <div className="flex-1 overflow-y-auto min-h-0">

              {/* Loading state */}
              {loading && (
                <div className="flex items-center justify-center h-32 gap-2 text-gray-500 dark:text-gray-400">
                  <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">Loading held sales…</span>
                </div>
              )}

              {/* Fetch error */}
              {!loading && error && (
                <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  <button
                    type="button"
                    onClick={() => void fetchHeld()}
                    className="text-xs text-blue-600 dark:text-blue-400 underline hover:no-underline focus:outline-none"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Resume error banner */}
              {resumeError && (
                <div
                  role="alert"
                  className="mx-4 mt-3 px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400"
                >
                  {resumeError}
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && heldList.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 gap-2 px-4 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-300 dark:text-gray-600" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
                  </svg>
                  <p className="text-sm text-gray-400 dark:text-gray-500">No held sales</p>
                  <p className="text-xs text-gray-300 dark:text-gray-600">
                    Hold a sale to park it here and serve another customer
                  </p>
                </div>
              )}

              {/* Held transactions list — Req 17.2 */}
              {!loading && !error && heldList.length > 0 && (
                <ul role="list" aria-label="Held transactions list">
                  {heldList.map((held) => (
                    <HeldTransactionRow
                      key={held.id}
                      held={held}
                      onResume={handleResume}
                      resumingId={resumingId}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Drawer footer — refresh button */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
              <button
                type="button"
                onClick={() => void fetchHeld()}
                disabled={loading}
                className="
                  w-full flex items-center justify-center gap-2
                  min-h-[44px] px-3 rounded-md text-sm font-medium
                  border border-gray-300 dark:border-gray-600
                  bg-gray-50 dark:bg-gray-700
                  text-gray-700 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-150
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                "
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
