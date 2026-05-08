// BranchService — Task 33.3
// CRUD operations and branch assignment logic
// Requirements: 31.1–31.3

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import { NotFoundError, ValidationError } from '../errors'
import type { Branch } from '../types/index'

interface BranchRow {
  id: number
  name: string
  address: string | null
  phone: string | null
  is_active: boolean | number
  created_at: string
}

export class BranchService {
  private readonly db: Knex

  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  private rowToBranch(row: BranchRow): Branch {
    return {
      id: row.id,
      name: row.name,
      address: row.address ?? undefined,
      phone: row.phone ?? undefined,
      isActive: row.is_active === true || row.is_active === 1,
      createdAt: row.created_at,
    }
  }

  async create(payload: { name: string; address?: string; phone?: string }): Promise<Branch> {
    const [id] = await this.db('branches').insert({
      name: payload.name,
      address: payload.address ?? null,
      phone: payload.phone ?? null,
      is_active: true,
    })
    return this.findById(id as number)
  }

  async update(
    id: number,
    payload: Partial<{ name: string; address: string; phone: string; is_active: boolean }>
  ): Promise<Branch> {
    await this.findById(id)

    const updateData: Record<string, unknown> = {}
    if (payload.name !== undefined) updateData.name = payload.name
    if (payload.address !== undefined) updateData.address = payload.address
    if (payload.phone !== undefined) updateData.phone = payload.phone
    if (payload.is_active !== undefined) updateData.is_active = payload.is_active

    await this.db('branches').where('id', id).update(updateData)
    return this.findById(id)
  }

  async delete(id: number): Promise<void> {
    await this.findById(id)

    const result = await this.db('branches').where('is_active', true).count('id as count').first()
    const activeCount = Number((result as { count: number } | undefined)?.count ?? 0)

    if (activeCount <= 1) {
      throw new ValidationError(
        'Cannot delete the last active branch. The system must have at least one active branch.'
      )
    }

    await this.db('branches').where('id', id).delete()
  }

  async list(): Promise<Branch[]> {
    const rows = await this.db<BranchRow>('branches').select('*').orderBy('id', 'asc')
    return rows.map((row) => this.rowToBranch(row))
  }

  async findById(id: number): Promise<Branch> {
    const row = await this.db<BranchRow>('branches').where('id', id).first()
    if (!row) {
      throw new NotFoundError(`Branch with id ${id} not found`)
    }
    return this.rowToBranch(row)
  }

  async assignUserToBranch(userId: number, branchId: number): Promise<void> {
    await this.findById(branchId)
    const user = await this.db('users').where('id', userId).first()
    if (!user) {
      throw new NotFoundError(`User with id ${userId} not found`)
    }
    await this.db('users').where('id', userId).update({ branch_id: branchId })
  }

  async assignProductToBranch(productId: number, branchId: number): Promise<void> {
    await this.findById(branchId)
    const product = await this.db('products').where('id', productId).first()
    if (!product) {
      throw new NotFoundError(`Product with id ${productId} not found`)
    }
    await this.db('products').where('id', productId).update({ branch_id: branchId })
  }
}

export const branchService = new BranchService()
