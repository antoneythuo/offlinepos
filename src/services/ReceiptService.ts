// Receipt generation and printing logic
// Implements: Requirements 15.1–15.5

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import { NotFoundError } from '../errors'
import type { ReceiptData, ReceiptLineItem } from '../types/index'
import { PosPrinter } from 'electron-pos-printer'
import type { PosPrintData, PosPrintOptions } from 'electron-pos-printer'

// ─── ReceiptService ───────────────────────────────────────────────────────────

export class ReceiptService {
  private readonly db: Knex

  /**
   * @param knexInstance  Optional Knex instance injected for testing.
   */
  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  // ─── buildReceiptData ─────────────────────────────────────────────────────────

  /**
   * Build receipt data for a completed transaction.
   *
   * Steps:
   *  1. Query the transaction with cashier name and customer name (if present).
   *  2. Query transaction_items for the transaction.
   *  3. Query transaction_payments for the transaction.
   *  4. Query settings for business name, address, receipt header, and footer.
   *  5. Return ReceiptData object with all required fields.
   *
   * @param transactionId  The ID of the transaction to build receipt data for.
   * @param isDuplicate    Optional flag to mark the receipt as DUPLICATE.
   * @returns ReceiptData object containing all receipt information.
   * @throws NotFoundError if the transaction does not exist.
   *
   * Requirements 15.1
   */
  async buildReceiptData(
    transactionId: number,
    isDuplicate = false
  ): Promise<ReceiptData> {
    // Query transaction with cashier and customer names
    const transaction = await this.db('transactions')
      .leftJoin('users', 'transactions.cashier_id', 'users.id')
      .leftJoin('customers', 'transactions.customer_id', 'customers.id')
      .where('transactions.id', transactionId)
      .select(
        'transactions.id',
        'transactions.transaction_ref',
        'transactions.created_at',
        'transactions.subtotal',
        'transactions.discount_amount',
        'transactions.tax_amount',
        'transactions.grand_total',
        'users.full_name as cashier_name',
        'customers.name as customer_name'
      )
      .first() as
      | {
          id: number
          transaction_ref: string
          created_at: string
          subtotal: number
          discount_amount: number
          tax_amount: number
          grand_total: number
          cashier_name: string
          customer_name: string | null
        }
      | undefined

    if (!transaction) {
      throw new NotFoundError(`Transaction with id ${transactionId} not found`)
    }

    // Query transaction items
    const items = (await this.db('transaction_items')
      .select(
        'product_name',
        'sku',
        'quantity',
        'unit_price',
        'discount_amount',
        'tax_amount',
        'line_total'
      )
      .where('transaction_id', transactionId)) as Array<{
      product_name: string
      sku: string
      quantity: number
      unit_price: number
      discount_amount: number
      tax_amount: number
      line_total: number
    }>

    // Query transaction payments
    const payments = (await this.db('transaction_payments')
      .select('method', 'amount')
      .where('transaction_id', transactionId)) as Array<{
      method: 'cash' | 'card' | 'mobile_money'
      amount: number
    }>

    // Query settings for business info
    const settingsRows = (await this.db('settings')
      .select('key_name', 'value')
      .whereIn('key_name', [
        'business_name',
        'business_address',
        'receipt_header',
        'receipt_footer',
      ])) as Array<{ key_name: string; value: string }>

    const settingsMap = new Map(settingsRows.map((row) => [row.key_name, row.value]))

    // Calculate change amount (sum of payments - grand total)
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const changeAmount = Math.max(0, totalPaid - Number(transaction.grand_total))

    // Build receipt line items
    const receiptItems: ReceiptLineItem[] = items.map((item) => ({
      productName: item.product_name,
      sku: item.sku,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      discountAmount: Number(item.discount_amount),
      taxAmount: Number(item.tax_amount),
      lineTotal: Number(item.line_total),
    }))

    // Build receipt data
    const receiptData: ReceiptData = {
      transactionRef: transaction.transaction_ref,
      dateTime: transaction.created_at,
      cashierName: transaction.cashier_name,
      customerName: transaction.customer_name ?? undefined,
      items: receiptItems,
      subtotal: Number(transaction.subtotal),
      discountAmount: Number(transaction.discount_amount),
      taxAmount: Number(transaction.tax_amount),
      grandTotal: Number(transaction.grand_total),
      payments: payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      })),
      changeAmount,
      businessName: settingsMap.get('business_name') ?? 'Sequence Lounge',
      businessAddress: settingsMap.get('business_address'),
      receiptHeader: settingsMap.get('receipt_header'),
      receiptFooter: settingsMap.get('receipt_footer'),
      isDuplicate,
    }

    return receiptData
  }

  // ─── printReceipt ─────────────────────────────────────────────────────────────

  /**
   * Print a receipt using electron-pos-printer.
   *
   * Steps:
   *  1. Query settings for printer name.
   *  2. Build print data array from receipt data.
   *  3. Call PosPrinter.print() with the data and options.
   *  4. On success, return { queued: false }.
   *  5. On any printer error, catch it and return { queued: true } (non-blocking).
   *
   * @param receiptData  The receipt data to print.
   * @returns { queued: boolean } — false if printed successfully, true if queued due to error.
   *
   * Requirements 15.2, 15.5
   */
  async printReceipt(receiptData: ReceiptData): Promise<{ queued: boolean }> {
    try {
      // Query settings for printer name
      const printerRow = await this.db('settings')
        .select('value')
        .where('key_name', 'printer_name')
        .first() as { value: string } | undefined

      const printerName = printerRow?.value

      // Build print data array
      const printData: PosPrintData[] = []

      // Receipt header (if configured)
      if (receiptData.receiptHeader) {
        printData.push({
          type: 'text',
          value: receiptData.receiptHeader,
          style: { textAlign: 'center', fontSize: '12px', marginBottom: '10px' },
        })
      }

      // Business name
      printData.push({
        type: 'text',
        value: receiptData.businessName,
        style: { fontWeight: '700', textAlign: 'center', fontSize: '18px' },
      })

      // Business address (if configured)
      if (receiptData.businessAddress) {
        printData.push({
          type: 'text',
          value: receiptData.businessAddress,
          style: { textAlign: 'center', fontSize: '10px', marginBottom: '10px' },
        })
      }

      // Duplicate marker (if applicable)
      if (receiptData.isDuplicate) {
        printData.push({
          type: 'text',
          value: '*** DUPLICATE ***',
          style: {
            fontWeight: '700',
            textAlign: 'center',
            fontSize: '14px',
            marginTop: '10px',
            marginBottom: '10px',
          },
        })
      }

      // Transaction ref and date/time
      printData.push({
        type: 'text',
        value: `Transaction: ${receiptData.transactionRef}`,
        style: { fontSize: '10px', marginTop: '10px' },
      })

      const dateTime = new Date(receiptData.dateTime)
      printData.push({
        type: 'text',
        value: `Date: ${dateTime.toLocaleDateString()} ${dateTime.toLocaleTimeString()}`,
        style: { fontSize: '10px' },
      })

      printData.push({
        type: 'text',
        value: `Cashier: ${receiptData.cashierName}`,
        style: { fontSize: '10px' },
      })

      if (receiptData.customerName) {
        printData.push({
          type: 'text',
          value: `Customer: ${receiptData.customerName}`,
          style: { fontSize: '10px', marginBottom: '10px' },
        })
      }

      // Separator line
      printData.push({
        type: 'text',
        value: '----------------------------------------',
        style: { fontSize: '10px', marginTop: '5px', marginBottom: '5px' },
      })

      // Items table
      const tableBody: string[][] = receiptData.items.map((item) => [
        `${item.productName}\n${item.sku}`,
        `${item.quantity}`,
        `${item.unitPrice.toFixed(2)}`,
        `${item.lineTotal.toFixed(2)}`,
      ])

      printData.push({
        type: 'table',
        style: { fontSize: '10px' },
        tableHeader: ['Item', 'Qty', 'Price', 'Total'],
        tableBody,
        tableHeaderStyle: { fontWeight: '700' },
        tableBodyStyle: { fontSize: '10px' },
      })

      // Separator line
      printData.push({
        type: 'text',
        value: '----------------------------------------',
        style: { fontSize: '10px', marginTop: '5px', marginBottom: '5px' },
      })

      // Totals
      printData.push({
        type: 'text',
        value: `Subtotal: ${receiptData.subtotal.toFixed(2)}`,
        style: { fontSize: '10px', textAlign: 'right' },
      })

      if (receiptData.discountAmount > 0) {
        printData.push({
          type: 'text',
          value: `Discount: -${receiptData.discountAmount.toFixed(2)}`,
          style: { fontSize: '10px', textAlign: 'right' },
        })
      }

      printData.push({
        type: 'text',
        value: `Tax: ${receiptData.taxAmount.toFixed(2)}`,
        style: { fontSize: '10px', textAlign: 'right' },
      })

      printData.push({
        type: 'text',
        value: `TOTAL: ${receiptData.grandTotal.toFixed(2)}`,
        style: {
          fontWeight: '700',
          fontSize: '14px',
          textAlign: 'right',
          marginTop: '5px',
        },
      })

      // Payments
      printData.push({
        type: 'text',
        value: '----------------------------------------',
        style: { fontSize: '10px', marginTop: '5px', marginBottom: '5px' },
      })

      for (const payment of receiptData.payments) {
        const methodLabel =
          payment.method === 'cash'
            ? 'Cash'
            : payment.method === 'card'
            ? 'Card'
            : 'Mobile Money'
        printData.push({
          type: 'text',
          value: `${methodLabel}: ${payment.amount.toFixed(2)}`,
          style: { fontSize: '10px', textAlign: 'right' },
        })
      }

      if (receiptData.changeAmount > 0) {
        printData.push({
          type: 'text',
          value: `Change: ${receiptData.changeAmount.toFixed(2)}`,
          style: {
            fontWeight: '700',
            fontSize: '12px',
            textAlign: 'right',
            marginTop: '5px',
          },
        })
      }

      // Receipt footer (if configured)
      if (receiptData.receiptFooter) {
        printData.push({
          type: 'text',
          value: receiptData.receiptFooter,
          style: {
            textAlign: 'center',
            fontSize: '10px',
            marginTop: '15px',
          },
        })
      }

      // Thank you message
      printData.push({
        type: 'text',
        value: 'Thank you for your business!',
        style: {
          textAlign: 'center',
          fontSize: '12px',
          marginTop: '10px',
          marginBottom: '10px',
        },
      })

      // Print options
      const options: PosPrintOptions = {
        preview: false,
        margin: '0 0 0 0',
        copies: 1,
        printerName,
        timeOutPerLine: 400,
        pageSize: '80mm',
        silent: true,
      }

      // Print the receipt
      await PosPrinter.print(printData, options)

      return { queued: false }
    } catch (error) {
      // On any printer error, return queued: true without failing the sale
      // Requirement 15.5 — printer unavailability should not block sale completion
      console.error('Receipt printing failed:', error)
      return { queued: true }
    }
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const receiptService = new ReceiptService()
