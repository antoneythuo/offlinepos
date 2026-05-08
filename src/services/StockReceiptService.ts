// Stock receipt service — records supplier deliveries and increments stock
// Implements: Requirements 7.1–7.5, 4.3, 4.4

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import withTransaction from '../db/withTransaction'
import { AuditService } from './AuditService'
import { ValidationError } from '../errors'

// ─── Payload / Result types ───────────────────────────────────────────────────

export interface ReceiptItem {
  productId: number
  quantity: number
  costPrice: number
  updateCost: boolean  // if true, update the product's cost_price to this value
}

export interface ReceivePayload {
  supplierId: number
  receivedBy: number
  receiptDate: string  // ISO date string e.g. "2024-01-15"
  notes?: string
  items: ReceiptItem[]
}

export interface StockReceipt {
  id: number
  supplierId: number
  supplierName?: string
  receivedBy: number
  receiptDate: string
  notes?: string
  createdAt: string
  items?: StockReceiptItemRow[]
}

export interface StockReceiptItemRow {
  id: number
  stockReceiptId: number
  productId: number
  productName?: string
  quantity: number
  costPrice: number
  updateCost: boolean
}

export interface ReceiptListFilters {
  supplierId?: number
  dateFrom?: string
  dateTo?: string
}

// ─── StockReceiptService ──────────────────────────────────────────────────────

export class StockReceiptService {
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
   * Record a stock receipt from a supplier.
   *
   * Inside a single Knex transaction:
   *  1. Insert a `stock_receipts` record.
   *  2. For each item:
   *     - Insert a `stock_receipt_items` record.
   *     - Increment `products.quantity_on_hand` by the received quantity.
   *     - If `updateCost` is true, update `products.cost_price`.
   *  3. Write an audit log entry.
   *
   * Requirements 7.2, 7.3, 7.4, 4.3, 4.4
   */
  async receive(payload: ReceivePayload): Promise<{ receiptId: number }> {
    const { supplierId, receivedBy, receiptDate, notes, items } = payload

    if (!items || items.length === 0) {
      throw new ValidationError('A stock receipt must contain at least one item')
    }

    let receiptId: number

    await withTransaction(async (trx) => {
      // 1. Insert stock_receipts record
      const [insertedId] = await trx('stock_receipts').insert({
        supplier_id: supplierId,
        received_by: receivedBy,
        receipt_date: receiptDate,
        notes: notes ?? null,
      })
      receiptId = insertedId

      // 2. Process each item
      for (const item of items) {
        // Insert stock_receipt_items
        await trx('stock_receipt_items').insert({
          stock_receipt_id: receiptId,
          product_id: item.productId,
          quantity: item.quantity,
          cost_price: item.costPrice,
          update_cost: item.updateCost ? 1 : 0,
        })

        // Increment quantity_on_hand
        await trx('products')
          .where('id', item.productId)
          .increment('quantity_on_hand', item.quantity)

        // Optionally update cost_price
        if (item.updateCost) {
          await trx('products')
            .where('id', item.productId)
            .update({ cost_price: item.costPrice })
        }
      }
    }, this.db)

    // 3. Write audit log (fire-and-forget)
    this.audit.log({
      userId: receivedBy,
      action: 'stock_receipt',
      entityType: 'stock_receipt',
      entityId: receiptId!,
      afterState: {
        supplier_id: supplierId,
        receipt_date: receiptDate,
        item_count: items.length,
      },
    })

    return { receiptId: receiptId! }
  }

  /**
   * List stock receipts with optional filters.
   *
   * Joins with `suppliers` to include the supplier name.
   *
   * Requirements 7.5
   */
  async list(filters: ReceiptListFilters = {}): Promise<StockReceipt[]> {
    let query = this.db('stock_receipts as sr')
      .select(
        'sr.id',
        'sr.supplier_id as supplierId',
        's.name as supplierName',
        'sr.received_by as receivedBy',
        'sr.receipt_date as receiptDate',
        'sr.notes',
        'sr.created_at as createdAt'
      )
      .leftJoin('suppliers as s', 'sr.supplier_id', 's.id')
      .orderBy('sr.receipt_date', 'desc')
      .orderBy('sr.id', 'desc')

    if (filters.supplierId !== undefined) {
      query = query.where('sr.supplier_id', filters.supplierId)
    }

    if (filters.dateFrom) {
      query = query.where('sr.receipt_date', '>=', filters.dateFrom)
    }

    if (filters.dateTo) {
      query = query.where('sr.receipt_date', '<=', filters.dateTo)
    }

    const rows = await query as Array<{
      id: number
      supplierId: number
      supplierName: string | null
      receivedBy: number
      receiptDate: string
      notes: string | null
      createdAt: string
    }>

    return rows.map((row) => ({
      id: row.id,
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? undefined,
      receivedBy: row.receivedBy,
      receiptDate: row.receiptDate,
      notes: row.notes ?? undefined,
      createdAt: row.createdAt,
    }))
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const stockReceiptService = new StockReceiptService()
