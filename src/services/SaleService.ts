// Sale creation, hold/resume, and refund logic
// Implements: Requirements 9.1–9.4, 10.1–10.5, 17.1–17.5, 18.1–18.5

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import withTransaction from '../db/withTransaction'
import { AuditService } from './AuditService'
import { ValidationError, NotFoundError } from '../errors'
import {
  computeCartTotals,
  computeLineTotal,
  computeItemTax,
  computeItemDiscount,
} from '../utils/cartCalculations'
import type {
  CreateSalePayload,
  SaleResult,
  CartItem,
  PaymentEntry,
  ReceiptData,
  ReceiptLineItem,
} from '../types/index'

// ─── Payload / Result types ───────────────────────────────────────────────────

export interface HoldSalePayload {
  cartItems: CartItem[]
  payments?: PaymentEntry[]
  customerId?: number
  discountType: 'none' | 'percent' | 'fixed'
  discountValue: number
  cashierId: number
  notes?: string
}

export interface HeldTransaction {
  id: number
  cashierId: number
  cartData: HoldSalePayload
  heldAt: string
}

export interface RefundPayload {
  originalTransactionId: number
  items: Array<{ productId: number; quantity: number }>
  refundMethod: 'cash' | 'card' | 'mobile_money' | 'store_credit'
  managerId?: number
  notes?: string
  processedBy: number
}

export interface RefundResult {
  returnTransactionId: number
  totalRefund: number
}

// ─── SaleService ──────────────────────────────────────────────────────────────

export class SaleService {
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

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Generate a transaction reference in the format TXN-YYYYMMDD-NNNN.
   * Uses the current date and a random 4-digit suffix to avoid collisions.
   */
  private generateTransactionRef(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const suffix = String(Math.floor(1000 + Math.random() * 9000))
    return `TXN-${year}${month}${day}-${suffix}`
  }

  /**
   * Fetch the business name from settings (used in receipt data).
   * Falls back to 'Business' if not configured.
   */
  private async getBusinessName(trx: Knex.Transaction | Knex): Promise<string> {
    try {
      const row = await trx('settings')
        .select('value')
        .where('key_name', 'business_name')
        .first() as { value: string } | undefined
      return row?.value ?? 'Sequence Lounge'
    } catch {
      return 'Sequence Lounge'
    }
  }

  /**
   * Fetch the return window in days from settings.
   * Falls back to 30 days if not configured.
   */
  private async getReturnWindowDays(): Promise<number> {
    try {
      const row = await this.db('settings')
        .select('value')
        .where('key_name', 'returnWindowDays')
        .first() as { value: string } | undefined
      const days = parseInt(row?.value ?? '30', 10)
      return isNaN(days) ? 30 : days
    } catch {
      return 30
    }
  }

  // ─── createSale ─────────────────────────────────────────────────────────────

  /**
   * Create a completed sale transaction.
   *
   * Steps (all inside a single Knex transaction):
   *  1. Validate payment sufficiency — sum(payments) >= grandTotal.
   *  2. For each cart item: SELECT ... FOR UPDATE on products to lock the row.
   *  3. Insert `transactions` record.
   *  4. Insert `transaction_items` records (snapshot product name/SKU).
   *  5. Insert `transaction_payments` records.
   *  6. Decrement `quantity_on_hand` for each item.
   *  7. Write audit log entry.
   *  8. Return SaleResult with transactionId, receiptData, changeAmount.
   *
   * Requirements 9.1–9.4, 10.1–10.5
   */
  async createSale(payload: CreateSalePayload): Promise<SaleResult> {
    const {
      cartItems,
      payments,
      customerId,
      discountType,
      discountValue,
      isCredit,
      creditDueDate,
      cashierId,
      branchId,
    } = payload

    if (!cartItems || cartItems.length === 0) {
      throw new ValidationError('Cart must contain at least one item')
    }

    // Compute cart totals
    const totals = computeCartTotals(cartItems, { type: discountType, value: discountValue })
    const { grandTotal, subtotal, taxTotal, receiptDiscountAmount } = totals

    // Validate payment sufficiency (Requirement 10.5)
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    if (!isCredit && totalPaid < grandTotal) {
      throw new ValidationError(
        `Insufficient payment: total paid ${totalPaid.toFixed(2)} is less than grand total ${grandTotal.toFixed(2)}`
      )
    }

    const changeAmount = isCredit ? 0 : Math.max(0, totalPaid - grandTotal)

    let transactionId: number
    let transactionRef: string
    let cashierName: string
    let customerName: string | undefined
    let businessName: string

    await withTransaction(async (trx) => {
      // Fetch cashier name for receipt
      const cashier = await trx('users')
        .select('full_name')
        .where('id', cashierId)
        .first() as { full_name: string } | undefined
      cashierName = cashier?.full_name ?? 'Unknown'

      // Fetch customer name if provided
      if (customerId) {
        const customer = await trx('customers')
          .select('name')
          .where('id', customerId)
          .first() as { name: string } | undefined
        customerName = customer?.name
      }

      // Fetch business name for receipt
      businessName = await this.getBusinessName(trx)

      // Lock product rows and snapshot product data (SELECT ... FOR UPDATE)
      // Requirement 9.2, 32.3 — row-level locking for concurrent access
      const productIds = cartItems.map((item) => item.productId)
      const productRows = await trx('products')
        .select('id', 'name', 'sku', 'quantity_on_hand')
        .whereIn('id', productIds)
        .forUpdate() as Array<{ id: number; name: string; sku: string; quantity_on_hand: number }>

      const productMap = new Map(productRows.map((p) => [p.id, p]))

      // Validate all products exist
      for (const item of cartItems) {
        if (!productMap.has(item.productId)) {
          throw new NotFoundError(`Product with id ${item.productId} not found`)
        }
      }

      // Generate unique transaction ref
      transactionRef = this.generateTransactionRef()

      // Compute discount amount for the transaction record
      const discountAmount = receiptDiscountAmount

      // Insert transactions record
      const [insertedId] = await trx('transactions').insert({
        transaction_ref: transactionRef,
        cashier_id: cashierId,
        customer_id: customerId ?? null,
        status: isCredit ? 'credit' : 'completed',
        subtotal,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        tax_amount: taxTotal,
        grand_total: grandTotal,
        credit_due_date: isCredit ? (creditDueDate ?? null) : null,
        credit_balance: isCredit ? grandTotal : 0,
        notes: null,
        // Include branch_id when multi-branch mode is active (Req 31.1, Task 33.4)
        ...(branchId !== undefined ? { branch_id: branchId } : {}),
      })
      transactionId = insertedId

      // Insert transaction_items (snapshot product name/SKU at time of sale)
      for (const item of cartItems) {
        const product = productMap.get(item.productId)!
        const itemDiscountAmount = computeItemDiscount(item)
        const itemTaxAmount = computeItemTax(item)
        const lineTotal = computeLineTotal(item)

        await trx('transaction_items').insert({
          transaction_id: transactionId,
          product_id: item.productId,
          product_name: product.name,  // snapshot at time of sale
          sku: product.sku,             // snapshot at time of sale
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_type: item.discountType,
          discount_value: item.discountValue,
          discount_amount: itemDiscountAmount,
          tax_rate: item.taxRate,
          tax_amount: itemTaxAmount,
          line_total: lineTotal,
        })
      }

      // Insert transaction_payments
      for (const payment of payments) {
        await trx('transaction_payments').insert({
          transaction_id: transactionId,
          method: payment.method,
          amount: payment.amount,
        })
      }

      // Decrement quantity_on_hand for each item
      for (const item of cartItems) {
        await trx('products')
          .where('id', item.productId)
          .decrement('quantity_on_hand', item.quantity)
      }
    }, this.db)

    // Write audit log (fire-and-forget, outside the transaction)
    this.audit.log({
      userId: cashierId,
      action: 'sale_complete',
      entityType: 'transaction',
      entityId: transactionId!,
      afterState: {
        transaction_ref: transactionRef!,
        grand_total: grandTotal,
        item_count: cartItems.length,
        is_credit: isCredit,
      },
    })

    // Build receipt data
    const receiptItems: ReceiptLineItem[] = cartItems.map((item) => ({
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: computeItemDiscount(item),
      taxAmount: computeItemTax(item),
      lineTotal: computeLineTotal(item),
    }))

    const receiptData: ReceiptData = {
      transactionRef: transactionRef!,
      dateTime: new Date().toISOString(),
      cashierName: cashierName!,
      customerName,
      items: receiptItems,
      subtotal,
      discountAmount: receiptDiscountAmount,
      taxAmount: taxTotal,
      grandTotal,
      payments,
      changeAmount,
      businessName: businessName!,
    }

    return {
      transactionId: transactionId!,
      receiptData,
      changeAmount,
    }
  }

  // ─── holdSale ────────────────────────────────────────────────────────────────

  /**
   * Hold a sale by serializing the cart to JSON and inserting a
   * `held_transactions` record.
   *
   * Requirements 17.1, 17.2, 17.4
   */
  async holdSale(cartData: HoldSalePayload): Promise<{ holdId: number }> {
    const [insertedId] = await this.db('held_transactions').insert({
      cashier_id: cartData.cashierId,
      cart_data: JSON.stringify(cartData),
    })

    return { holdId: insertedId }
  }

  // ─── resumeSale ──────────────────────────────────────────────────────────────

  /**
   * Resume a held sale by retrieving and deserializing the cart data.
   *
   * Requirements 17.3, 17.5
   */
  async resumeSale(holdId: number): Promise<HeldTransaction> {
    const row = await this.db('held_transactions')
      .select('id', 'cashier_id', 'cart_data', 'held_at')
      .where('id', holdId)
      .first() as {
        id: number
        cashier_id: number
        cart_data: string | object
        held_at: string
      } | undefined

    if (!row) {
      throw new NotFoundError(`Held transaction with id ${holdId} not found`)
    }

    // Deserialize cart_data — MySQL may return it as a string or parsed object
    const cartData: HoldSalePayload =
      typeof row.cart_data === 'string'
        ? JSON.parse(row.cart_data)
        : row.cart_data

    return {
      id: row.id,
      cashierId: row.cashier_id,
      cartData,
      heldAt: row.held_at,
    }
  }

  // ─── listHeld ────────────────────────────────────────────────────────────────

  /**
   * List all held transactions, optionally filtered by cashier.
   *
   * Requirements 17.2
   */
  async listHeld(cashierId?: number): Promise<HeldTransaction[]> {
    let query = this.db('held_transactions')
      .select('id', 'cashier_id', 'cart_data', 'held_at')
      .orderBy('held_at', 'desc')

    if (cashierId !== undefined) {
      query = query.where('cashier_id', cashierId)
    }

    const rows = await query as Array<{
      id: number
      cashier_id: number
      cart_data: string | object
      held_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      cashierId: row.cashier_id,
      cartData:
        typeof row.cart_data === 'string'
          ? JSON.parse(row.cart_data)
          : row.cart_data,
      heldAt: row.held_at,
    }))
  }

  // ─── deleteHeld ──────────────────────────────────────────────────────────────

  /**
   * Delete a held transaction after it has been resumed and completed.
   *
   * Requirements 17.5
   */
  async deleteHeld(holdId: number): Promise<void> {
    await this.db('held_transactions').where('id', holdId).delete()
  }

  // ─── refundSale ──────────────────────────────────────────────────────────────

  /**
   * Process a refund/return for an original transaction.
   *
   * Steps:
   *  1. Fetch the original transaction; throw NotFoundError if not found.
   *  2. Check return window — if outside window and no managerId, throw ValidationError.
   *  3. Inside a single Knex transaction:
   *     - Insert `return_transactions` record.
   *     - For each returned item: insert `return_items`, increment quantity_on_hand.
   *  4. Write audit log entry.
   *
   * Requirements 18.1–18.5
   */
  async refundSale(payload: RefundPayload): Promise<RefundResult> {
    const { originalTransactionId, items, refundMethod, managerId, notes, processedBy } = payload

    if (!items || items.length === 0) {
      throw new ValidationError('Refund must include at least one item')
    }

    // Fetch original transaction
    const originalTx = await this.db('transactions')
      .select('id', 'grand_total', 'created_at', 'status')
      .where('id', originalTransactionId)
      .first() as {
        id: number
        grand_total: number
        created_at: string
        status: string
      } | undefined

    if (!originalTx) {
      throw new NotFoundError(`Transaction with id ${originalTransactionId} not found`)
    }

    // Check return window (Requirement 18.4)
    const returnWindowDays = await this.getReturnWindowDays()
    const txDate = new Date(originalTx.created_at)
    const now = new Date()
    const daysDiff = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)

    if (daysDiff > returnWindowDays && !managerId) {
      throw new ValidationError(
        `Return window of ${returnWindowDays} days has expired. Manager approval is required to proceed.`
      )
    }

    // Fetch original transaction items to get unit prices for refund calculation
    const originalItems = await this.db('transaction_items')
      .select('product_id', 'unit_price', 'quantity', 'line_total')
      .where('transaction_id', originalTransactionId) as Array<{
        product_id: number
        unit_price: number
        quantity: number
        line_total: number
      }>

    const originalItemMap = new Map(originalItems.map((i) => [i.product_id, i]))

    // Validate returned items exist in original transaction
    for (const item of items) {
      if (!originalItemMap.has(item.productId)) {
        throw new ValidationError(
          `Product with id ${item.productId} was not part of the original transaction`
        )
      }
    }

    // Calculate total refund amount
    let totalRefund = 0
    for (const item of items) {
      const originalItem = originalItemMap.get(item.productId)!
      // Refund is proportional: (returned_qty / original_qty) * line_total
      const refundAmount = (item.quantity / Number(originalItem.quantity)) * Number(originalItem.line_total)
      totalRefund += refundAmount
    }
    totalRefund = Math.round(totalRefund * 10000) / 10000

    let returnTransactionId: number

    await withTransaction(async (trx) => {
      // Insert return_transactions record
      const [insertedId] = await trx('return_transactions').insert({
        original_transaction_id: originalTransactionId,
        processed_by: processedBy,
        refund_method: refundMethod,
        total_refund: totalRefund,
        notes: notes ?? null,
      })
      returnTransactionId = insertedId

      // Insert return_items and increment quantity_on_hand
      for (const item of items) {
        const originalItem = originalItemMap.get(item.productId)!
        const refundAmount = (item.quantity / Number(originalItem.quantity)) * Number(originalItem.line_total)

        await trx('return_items').insert({
          return_transaction_id: returnTransactionId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: originalItem.unit_price,
          refund_amount: Math.round(refundAmount * 10000) / 10000,
        })

        // Increment quantity_on_hand for returned items
        await trx('products')
          .where('id', item.productId)
          .increment('quantity_on_hand', item.quantity)
      }
    }, this.db)

    // Write audit log (fire-and-forget, Requirement 18.5)
    this.audit.log({
      userId: processedBy,
      action: 'sale_refund',
      entityType: 'return_transaction',
      entityId: returnTransactionId!,
      afterState: {
        original_transaction_id: originalTransactionId,
        total_refund: totalRefund,
        refund_method: refundMethod,
        manager_id: managerId ?? null,
        item_count: items.length,
      },
    })

    return {
      returnTransactionId: returnTransactionId!,
      totalRefund,
    }
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const saleService = new SaleService()
