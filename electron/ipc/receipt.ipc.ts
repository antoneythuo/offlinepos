// IPC handlers for receipt printing operations
// Registered in main.ts during app initialization
// Channels: receipt:print, receipt:reprint

import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { receiptService } from '../../src/services/ReceiptService'

// ─── Payload shapes ───────────────────────────────────────────────────────────

interface PrintPayload {
  transactionId: number
}

interface ReprintPayload {
  transactionId: number
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerReceiptHandlers(): void {
  /**
   * receipt:print
   *
   * Builds receipt data for the given transaction and sends it to the
   * configured thermal printer via ESC/POS commands.
   *
   * If the printer is unavailable, the sale is NOT failed — the handler
   * returns `{ queued: true }` so the UI can show a "Print when ready" option.
   *
   * Payload:  `{ transactionId: number }`
   * Response: `IpcResult<{ queued: boolean }>`
   *
   * Requirements 15.1, 15.2, 15.5
   */
  registerHandler<{ queued: boolean }>('receipt:print', async (payload) => {
    requirePermission('sales')
    const p = payload as { transactionId?: number; receiptData?: unknown }

    // Support two call patterns:
    // 1. { receiptData } — receipt data already built by the renderer (from sale result)
    // 2. { transactionId } — re-fetch from DB (used by reprint)
    if (p.receiptData) {
      return receiptService.printReceipt(p.receiptData as Parameters<typeof receiptService.printReceipt>[0])
    }

    const { transactionId } = p as { transactionId: number }
    const receiptData = await receiptService.buildReceiptData(transactionId)
    return receiptService.printReceipt(receiptData)
  })

  /**
   * receipt:reprint
   *
   * Fetches the original transaction, marks the receipt as DUPLICATE, and
   * sends it to the thermal printer.
   *
   * If the printer is unavailable, returns `{ queued: true }` without error.
   *
   * Payload:  `{ transactionId: number }`
   * Response: `IpcResult<{ queued: boolean }>`
   *
   * Requirements 15.3, 15.5
   */
  registerHandler<{ queued: boolean }>('receipt:reprint', async (payload) => {
    requirePermission('sales')
    const { transactionId } = payload as ReprintPayload
    // isDuplicate = true marks the receipt with "*** DUPLICATE ***"
    const receiptData = await receiptService.buildReceiptData(transactionId, true)
    return receiptService.printReceipt(receiptData)
  })
}
