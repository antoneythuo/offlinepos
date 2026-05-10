// Stock adjustment service
// Implements: Requirements 6.1–6.4, 4.5

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import withTransaction from '../db/withTransaction'
import { AuditService } from './AuditService'
import { NotFoundError } from '../errors'

// ─── Payload / Result types ───────────────────────────────────────────────────

export interface AdjustPayload {
  productId: number
  type: 'damaged' | 'lost' | 'returned' | 'correction'
  quantity: number       // positive = add stock, negative = remove stock
  reason?: string
  userId: number
  forceNegative?: boolean  // if true, allow the result to go below zero
}

export interface AdjustResult {
  /** true when the adjustment would result in negative stock AND forceNegative was not set */
  requiresConfirmation: boolean
  /** Only present when the adjustment was actually applied */
  newQuantity?: number
}

// ─── StockAdjustmentService ───────────────────────────────────────────────────

export class StockAdjustmentService {
  private readonly db: Knex
  private readonly audit: AuditService

  /**
   * @param knexInstance  Optional Knex instance injected for testing.
   * @param audit         Optional AuditService injected for testing.
   */
  constructor(knexInstance?: Knex, audit?: AuditService) {
    this.db = knexInstance ?? knexDefault
    this.audit = audit ?? new AuditService(knexInstance ?? knexDefault)
  }

  /**
   * Apply a stock adjustment to a product.
   *
   * Steps:
   *  1. Fetch the current `quantity_on_hand` for the product.
   *  2. Compute `newQty = currentQty + payload.quantity`.
   *  3. If `newQty < 0` and `forceNegative` is not set, return
   *     `{ requiresConfirmation: true }` without touching the database.
   *  4. Otherwise, inside a single Knex transaction:
   *     - Update `products.quantity_on_hand` to `newQty`.
   *     - Insert a `stock_adjustments` record.
   *     - Write an audit log entry.
   *  5. Return `{ requiresConfirmation: false, newQuantity: newQty }`.
   *
   * Requirements 6.1, 6.2, 6.3, 4.5
   */
  async adjust(payload: AdjustPayload): Promise<AdjustResult> {
    const { productId, type, quantity, reason, userId, forceNegative = false } = payload

    // 1. Fetch current quantity
    const product = await this.db('products')
      .select('id', 'name', 'quantity_on_hand')
      .where('id', productId)
      .first() as { id: number; name: string; quantity_on_hand: number } | undefined

    if (!product) {
      throw new NotFoundError(`Product with id ${productId} not found`)
    }

    const currentQty = Number(product.quantity_on_hand)
    const newQty = currentQty + quantity

    // 2. Warn if result would be negative and confirmation not forced
    if (newQty < 0 && !forceNegative) {
      return { requiresConfirmation: true }
    }

    // 3. Apply the adjustment inside a transaction
    await withTransaction(async (trx) => {
      // Update quantity_on_hand
      await trx('products')
        .where('id', productId)
        .update({ quantity_on_hand: newQty })

      // Insert stock_adjustments record
      await trx('stock_adjustments').insert({
        product_id: productId,
        adjusted_by: userId,
        type,
        quantity,
        reason,
      })
    }, this.db)

    // 4. Write audit log (fire-and-forget, outside the transaction)
    this.audit.log({
      userId,
      action: 'stock_adjustment',
      entityType: 'product',
      entityId: productId,
      beforeState: { quantity_on_hand: currentQty },
      afterState: { quantity_on_hand: newQty, adjustment_type: type, quantity, reason },
    })

    return { requiresConfirmation: false, newQuantity: newQty }
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const stockAdjustmentService = new StockAdjustmentService()
