// CreditService — Task 13
// Requirements: 19.1–19.5, 20.1–20.6

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import { NotFoundError, ValidationError } from '../errors'
import { AuditService, auditService as defaultAudit } from './AuditService'
import type { CreditBalance, CreditPayment, RecordCreditPaymentPayload, Transaction } from '../types/index'

export class CreditService {
  private readonly db: Knex
  private readonly audit: AuditService

  constructor(knexInstance?: Knex, auditSvc?: AuditService) {
    this.db = knexInstance ?? knexDefault
    this.audit = auditSvc ?? defaultAudit
  }

  async recordPayment(payload: RecordCreditPaymentPayload): Promise<CreditBalance> {
    const { creditTransactionId, amount, method, note, cashierId } = payload

    return this.db.transaction(async (trx) => {
      // Lock the transaction row
      const tx = await trx('transactions')
        .where('id', creditTransactionId)
        .where('status', 'credit')
        .forUpdate()
        .first() as Record<string, unknown> | undefined

      if (!tx) throw new NotFoundError(`Credit transaction ${creditTransactionId} not found or already settled`)

      const currentBalance = Number(tx.credit_balance ?? tx.grand_total)

      if (amount <= 0) throw new ValidationError('Payment amount must be greater than zero')
      if (amount > currentBalance) {
        throw new ValidationError(
          `Payment amount ${amount} exceeds outstanding balance ${currentBalance.toFixed(2)}`
        )
      }

      const newBalance = Math.max(0, currentBalance - amount)
      const newStatus = newBalance === 0 ? 'settled' : 'credit'
      const balanceAfter = Number(newBalance.toFixed(4))

      // Insert credit_payment record
      await trx('credit_payments').insert({
        transaction_id: creditTransactionId,
        recorded_by: cashierId,
        amount,
        method,
        note: note ?? null,
        balance_after_payment: balanceAfter,
      })

      // Update transaction balance and status
      await trx('transactions')
        .where('id', creditTransactionId)
        .update({ credit_balance: balanceAfter, status: newStatus })

      this.audit.log({
        userId: cashierId,
        action: 'credit_payment',
        entityType: 'transaction',
        entityId: creditTransactionId,
        beforeState: { credit_balance: currentBalance, status: 'credit' },
        afterState: { credit_balance: balanceAfter, status: newStatus },
      })

      return {
        transactionId: creditTransactionId,
        outstandingBalance: balanceAfter,
        status: newStatus as 'credit' | 'settled',
      }
    })
  }

  async getCustomerStatement(
    customerId: number,
    dateRange?: { from: string; to: string }
  ): Promise<{ transactions: Transaction[]; payments: CreditPayment[] }> {
    const txQb = this.db('transactions as t')
      .leftJoin('users as u', 't.cashier_id', 'u.id')
      .select('t.*', 'u.full_name as cashier_name')
      .where('t.customer_id', customerId)
      .whereIn('t.status', ['credit', 'settled'])

    if (dateRange) {
      txQb.whereRaw('DATE(t.created_at) BETWEEN ? AND ?', [dateRange.from, dateRange.to])
    }

    const txRows = await txQb.orderBy('t.created_at', 'desc') as Array<Record<string, unknown>>

    const transactions: Transaction[] = txRows.map((r) => ({
      id: r.id as number,
      transactionRef: r.transaction_ref as string,
      cashierId: r.cashier_id as number,
      cashierName: r.cashier_name as string | undefined,
      customerId: r.customer_id as number | undefined,
      status: r.status as Transaction['status'],
      subtotal: Number(r.subtotal),
      discountType: r.discount_type as Transaction['discountType'],
      discountValue: Number(r.discount_value),
      discountAmount: Number(r.discount_amount),
      taxAmount: Number(r.tax_amount),
      grandTotal: Number(r.grand_total),
      creditDueDate: r.credit_due_date as string | undefined,
      creditBalance: r.credit_balance != null ? Number(r.credit_balance) : undefined,
      notes: r.notes as string | undefined,
      createdAt: r.created_at as string,
    }))

    const txIds = transactions.map((t) => t.id)
    const payments: CreditPayment[] = txIds.length === 0 ? [] : await this.db('credit_payments')
      .whereIn('transaction_id', txIds)
      .orderBy('created_at', 'asc')
      .select('*')
      .then((rows: Array<Record<string, unknown>>) => rows.map((r) => ({
        id: r.id as number,
        transactionId: r.transaction_id as number,
        recordedBy: r.recorded_by as number,
        amount: Number(r.amount),
        method: r.method as CreditPayment['method'],
        note: r.note as string | undefined,
        balanceAfterPayment: Number(r.balance_after_payment),
        createdAt: r.created_at as string,
      })))

    return { transactions, payments }
  }

  async listOpen(customerId?: number): Promise<Transaction[]> {
    const qb = this.db('transactions as t')
      .leftJoin('customers as c', 't.customer_id', 'c.id')
      .leftJoin('users as u', 't.cashier_id', 'u.id')
      .select('t.*', 'c.name as customer_name', 'u.full_name as cashier_name')
      .where('t.status', 'credit')
      .orderBy('t.created_at', 'desc')

    if (customerId) qb.where('t.customer_id', customerId)

    const rows = await qb as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: r.id as number,
      transactionRef: r.transaction_ref as string,
      cashierId: r.cashier_id as number,
      cashierName: r.cashier_name as string | undefined,
      customerId: r.customer_id as number | undefined,
      customerName: r.customer_name as string | undefined,
      status: r.status as Transaction['status'],
      subtotal: Number(r.subtotal),
      discountType: r.discount_type as Transaction['discountType'],
      discountValue: Number(r.discount_value),
      discountAmount: Number(r.discount_amount),
      taxAmount: Number(r.tax_amount),
      grandTotal: Number(r.grand_total),
      creditDueDate: r.credit_due_date as string | undefined,
      creditBalance: r.credit_balance != null ? Number(r.credit_balance) : undefined,
      notes: r.notes as string | undefined,
      createdAt: r.created_at as string,
    }))
  }
}

export const creditService = new CreditService()
