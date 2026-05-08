// ExpenseService — Task 16
// Requirements: 25.1–25.5

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import { NotFoundError } from '../errors'
import { AuditService, auditService as defaultAudit } from './AuditService'
import type { Expense, ExpenseCategory } from '../types/index'

export class ExpenseService {
  private readonly db: Knex
  private readonly audit: AuditService

  constructor(knexInstance?: Knex, auditSvc?: AuditService) {
    this.db = knexInstance ?? knexDefault
    this.audit = auditSvc ?? defaultAudit
  }

  async listCategories(): Promise<ExpenseCategory[]> {
    const rows = await this.db('expense_categories').orderBy('name', 'asc')
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as number,
      name: r.name as string,
      createdAt: r.created_at as string,
    }))
  }

  async createCategory(name: string): Promise<ExpenseCategory> {
    const [id] = await this.db('expense_categories').insert({ name })
    const row = await this.db('expense_categories').where('id', id).first()
    return { id: row.id, name: row.name, createdAt: row.created_at }
  }

  async list(filters?: {
    dateFrom?: string
    dateTo?: string
    categoryId?: number
  }): Promise<Expense[]> {
    const qb = this.db('expenses as e')
      .leftJoin('expense_categories as ec', 'e.category_id', 'ec.id')
      .select('e.*', 'ec.name as category_name')
      .orderBy('e.expense_date', 'desc')

    if (filters?.dateFrom) qb.where('e.expense_date', '>=', filters.dateFrom)
    if (filters?.dateTo) qb.where('e.expense_date', '<=', filters.dateTo)
    if (filters?.categoryId) qb.where('e.category_id', filters.categoryId)

    const rows = await qb as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: r.id as number,
      categoryId: r.category_id as number,
      categoryName: r.category_name as string | undefined,
      amount: Number(r.amount),
      expenseDate: r.expense_date as string,
      description: r.description as string | undefined,
      recordedBy: r.recorded_by as number,
      createdAt: r.created_at as string,
    }))
  }

  async create(payload: {
    categoryId: number
    amount: number
    expenseDate: string
    description?: string
    recordedBy: number
  }): Promise<Expense> {
    const [id] = await this.db('expenses').insert({
      category_id: payload.categoryId,
      amount: payload.amount,
      expense_date: payload.expenseDate,
      description: payload.description ?? null,
      recorded_by: payload.recordedBy,
    })

    this.audit.log({
      userId: payload.recordedBy,
      action: 'expense_create',
      entityType: 'expense',
      entityId: id as number,
      afterState: { amount: payload.amount, categoryId: payload.categoryId },
    })

    const rows = await this.db('expenses as e')
      .leftJoin('expense_categories as ec', 'e.category_id', 'ec.id')
      .select('e.*', 'ec.name as category_name')
      .where('e.id', id)
      .first() as Record<string, unknown>

    return {
      id: rows.id as number,
      categoryId: rows.category_id as number,
      categoryName: rows.category_name as string | undefined,
      amount: Number(rows.amount),
      expenseDate: rows.expense_date as string,
      description: rows.description as string | undefined,
      recordedBy: rows.recorded_by as number,
      createdAt: rows.created_at as string,
    }
  }

  async delete(id: number, deletedBy: number): Promise<void> {
    const row = await this.db('expenses').where('id', id).first()
    if (!row) throw new NotFoundError(`Expense ${id} not found`)

    await this.db('expenses').where('id', id).delete()

    this.audit.log({
      userId: deletedBy,
      action: 'expense_delete',
      entityType: 'expense',
      entityId: id,
      beforeState: { amount: row.amount, categoryId: row.category_id },
    })
  }
}

export const expenseService = new ExpenseService()
