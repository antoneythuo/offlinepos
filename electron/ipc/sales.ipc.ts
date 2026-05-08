// IPC handlers for sales operations
// Registered in main.ts during app initialization
// Channels: sales:create, sales:hold, sales:resume, sales:listHeld, sales:refund

import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { saleService } from '../../src/services/SaleService'
import knex from '../../src/db/knex'
import type { CreateSalePayload, SaleResult } from '../../src/types/index'
import type {
  HoldSalePayload,
  HeldTransaction,
  RefundPayload,
  RefundResult,
} from '../../src/services/SaleService'

// ─── Payload shapes ───────────────────────────────────────────────────────────

interface ResumePayload {
  holdId: number
}

interface ListHeldPayload {
  cashierId?: number
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerSalesHandlers(): void {
  /**
   * sales:create
   *
   * Creates a completed sale transaction. Validates payment sufficiency,
   * inserts all records inside a single ACID transaction, decrements stock.
   *
   * Payload:  CreateSalePayload
   * Response: IpcResult<SaleResult>
   *
   * Requirements 9.1-9.4, 10.1-10.5
   */
  registerHandler<SaleResult>('sales:create', async (payload) => {
    requirePermission('sales')
    return saleService.createSale(payload as CreateSalePayload)
  })

  /**
   * sales:hold
   *
   * Serializes the current cart to JSON and saves it as a held transaction.
   * Clears the active cart on the renderer side (handled by the renderer).
   *
   * Payload:  HoldSalePayload
   * Response: IpcResult<{ holdId: number }>
   *
   * Requirements 17.1, 17.2, 17.4
   */
  registerHandler<{ holdId: number }>('sales:hold', async (payload) => {
    requirePermission('sales')
    return saleService.holdSale(payload as HoldSalePayload)
  })

  /**
   * sales:resume
   *
   * Retrieves and deserializes a held transaction by its ID.
   *
   * Payload:  { holdId: number }
   * Response: IpcResult<HeldTransaction>
   *
   * Requirements 17.3, 17.5
   */
  registerHandler<HeldTransaction>('sales:resume', async (payload) => {
    requirePermission('sales')
    const { holdId } = payload as ResumePayload
    return saleService.resumeSale(holdId)
  })

  /**
   * sales:listHeld
   *
   * Lists all currently held transactions, optionally filtered by cashier.
   *
   * Payload:  { cashierId?: number }
   * Response: IpcResult<HeldTransaction[]>
   *
   * Requirements 17.2
   */
  registerHandler<HeldTransaction[]>('sales:listHeld', async (payload) => {
    requirePermission('sales')
    const { cashierId } = (payload ?? {}) as ListHeldPayload
    return saleService.listHeld(cashierId)
  })

  /**
   * sales:refund
   *
   * Processes a refund/return for an original transaction.
   * Enforces return window and requires Manager approval if outside window.
   *
   * Payload:  RefundPayload
   * Response: IpcResult<RefundResult>
   *
   * Requirements 18.1-18.5
   */
  registerHandler<RefundResult>('sales:refund', async (payload) => {
    requirePermission('sales')
    return saleService.refundSale(payload as RefundPayload)
  })

  /**
   * sales:transaction:items
   * Returns the line items for a given transaction ID.
   */
  registerHandler<unknown[]>('sales:transaction:items', async (payload) => {
    requirePermission('credit_view')
    const { transactionId } = payload as { transactionId: number }
    const rows = await knex('transaction_items')
      .where('transaction_id', transactionId)
      .select('product_name', 'sku', 'quantity', 'unit_price', 'discount_amount', 'tax_amount', 'line_total')
    return rows.map((r: Record<string, unknown>) => ({
      productName: r.product_name,
      sku: r.sku,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      discountAmount: Number(r.discount_amount),
      taxAmount: Number(r.tax_amount),
      lineTotal: Number(r.line_total),
    }))
  })
}
