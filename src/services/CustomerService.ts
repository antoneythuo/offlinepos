// CustomerService — Task 14
// Requirements: 21.1–21.5

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import { NotFoundError, ValidationError } from '../errors'
import type { Customer, Transaction } from '../types/index'

interface CustomerRow {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  credit_limit: number
  is_active: boolean | number
  created_at: string
  updated_at: string
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    creditLimit: Number(row.credit_limit),
    isActive: row.is_active === true || row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CustomerService {
  private readonly db: Knex

  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  async list(query?: string): Promise<Customer[]> {
    const qb = this.db<CustomerRow>('customers').where('is_active', 1)
    if (query?.trim()) {
      const like = `%${query.trim()}%`
      qb.where((b) => {
        b.where('name', 'like', like)
          .orWhere('phone', 'like', like)
          .orWhere('email', 'like', like)
      })
    }
    const rows = await qb.orderBy('name', 'asc')
    return rows.map(rowToCustomer)
  }

  async findById(id: number): Promise<Customer> {
    const row = await this.db<CustomerRow>('customers').where('id', id).first()
    if (!row) throw new NotFoundError(`Customer ${id} not found`)
    return rowToCustomer(row)
  }

  async create(payload: {
    name: string
    phone?: string
    email?: string
    address?: string
    creditLimit?: number
  }): Promise<Customer> {
    const [id] = await this.db('customers').insert({
      name: payload.name,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      address: payload.address ?? null,
      credit_limit: payload.creditLimit ?? 0,
      is_active: true,
    })
    return this.findById(id as number)
  }

  async update(
    id: number,
    payload: Partial<{ name: string; phone: string; email: string; address: string; creditLimit: number }>
  ): Promise<Customer> {
    await this.findById(id)
    const data: Record<string, unknown> = {}
    if (payload.name !== undefined) data.name = payload.name
    if (payload.phone !== undefined) data.phone = payload.phone
    if (payload.email !== undefined) data.email = payload.email
    if (payload.address !== undefined) data.address = payload.address
    if (payload.creditLimit !== undefined) data.credit_limit = payload.creditLimit
    await this.db('customers').where('id', id).update(data)
    return this.findById(id)
  }

  async delete(id: number): Promise<void> {
    await this.findById(id)
    const openCredit = await this.db('transactions')
      .where('customer_id', id)
      .where('status', 'credit')
      .count('id as count')
      .first()
    const count = Number((openCredit as { count: number } | undefined)?.count ?? 0)
    if (count > 0) {
      throw new ValidationError(
        `Cannot delete customer: ${count} open credit transaction${count > 1 ? 's' : ''} exist.`
      )
    }
    await this.db('customers').where('id', id).update({ is_active: false })
  }

  async getPurchaseHistory(customerId: number): Promise<Transaction[]> {
    const rows = await this.db('transactions as t')
      .leftJoin('users as u', 't.cashier_id', 'u.id')
      .select(
        't.*',
        'u.full_name as cashier_name',
      )
      .where('t.customer_id', customerId)
      .orderBy('t.created_at', 'desc') as Array<Record<string, unknown>>

    return rows.map((r) => ({
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
  }

  async getOutstandingDebt(customerId: number): Promise<{ outstandingDebt: number; creditLimit: number }> {
    const customer = await this.findById(customerId)
    const result = await this.db('transactions')
      .where('customer_id', customerId)
      .where('status', 'credit')
      .sum('credit_balance as total')
      .first()
    const outstandingDebt = Number((result as { total: number } | undefined)?.total ?? 0)
    return { outstandingDebt, creditLimit: customer.creditLimit }
  }
}

export const customerService = new CustomerService()
