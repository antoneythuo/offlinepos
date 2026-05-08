// CategoryService, BrandService, and UnitService
// Implements: Requirements 2.1–2.5

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import { ConflictError, NotFoundError } from '../errors'
import type { Category, Brand, UnitOfMeasure } from '../types/index'

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateCategoryData {
  name: string
  description?: string
}

export interface CreateBrandData {
  name: string
  description?: string
}

export interface CreateUnitData {
  name: string
  abbreviation?: string
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as number,
    name: row.name as string,
    description: row.description as string | undefined,
    createdAt: row.created_at as string,
  }
}

function rowToBrand(row: Record<string, unknown>): Brand {
  return {
    id: row.id as number,
    name: row.name as string,
    description: row.description as string | undefined,
    createdAt: row.created_at as string,
  }
}

function rowToUnit(row: Record<string, unknown>): UnitOfMeasure {
  return {
    id: row.id as number,
    name: row.name as string,
    abbreviation: row.abbreviation as string | undefined,
    createdAt: row.created_at as string,
  }
}

// ─── Helper: count active products referencing a catalog record ───────────────

async function countActiveProductReferences(
  db: Knex,
  column: string,
  id: number
): Promise<number> {
  const result = await db('products')
    .where(column, id)
    .where('is_active', 1)
    .count('id as count')
    .first()
  return Number((result as { count: number } | undefined)?.count ?? 0)
}

// ─── CategoryService ──────────────────────────────────────────────────────────

export class CategoryService {
  private readonly db: Knex

  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  /**
   * Create a new category.
   * Requirement 2.1
   */
  async create(data: CreateCategoryData): Promise<Category> {
    const [id] = await this.db('categories').insert({
      name: data.name,
      description: data.description ?? null,
    })
    const row = await this.db('categories').where({ id }).first()
    return rowToCategory(row as Record<string, unknown>)
  }

  /**
   * Update an existing category.
   * Requirement 2.1
   */
  async update(id: number, data: Partial<CreateCategoryData>): Promise<Category> {
    const existing = await this.db('categories').where({ id }).first()
    if (!existing) {
      throw new NotFoundError(`Category with id ${id} not found`)
    }

    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) patch.name = data.name
    if (data.description !== undefined) patch.description = data.description

    await this.db('categories').where({ id }).update(patch)

    const row = await this.db('categories').where({ id }).first()
    return rowToCategory(row as Record<string, unknown>)
  }

  /**
   * Delete a category.
   *
   * Rejects if any active product references this category.
   * Requirement 2.4
   */
  async delete(id: number): Promise<void> {
    const existing = await this.db('categories').where({ id }).first()
    if (!existing) {
      throw new NotFoundError(`Category with id ${id} not found`)
    }

    const refCount = await countActiveProductReferences(this.db, 'category_id', id)
    if (refCount > 0) {
      throw new ConflictError(
        `Cannot delete category: ${refCount} active product(s) reference this category`
      )
    }

    await this.db('categories').where({ id }).delete()
  }

  /**
   * List all categories ordered by name.
   * Requirement 2.1
   */
  async list(): Promise<Category[]> {
    const rows = await this.db('categories').orderBy('name', 'asc')
    return rows.map((r) => rowToCategory(r as Record<string, unknown>))
  }

  /**
   * Find a category by ID. Returns null if not found.
   */
  async findById(id: number): Promise<Category | null> {
    const row = await this.db('categories').where({ id }).first()
    return row ? rowToCategory(row as Record<string, unknown>) : null
  }
}

// ─── BrandService ─────────────────────────────────────────────────────────────

export class BrandService {
  private readonly db: Knex

  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  /**
   * Create a new brand.
   * Requirement 2.2
   */
  async create(data: CreateBrandData): Promise<Brand> {
    const [id] = await this.db('brands').insert({
      name: data.name,
      description: data.description ?? null,
    })
    const row = await this.db('brands').where({ id }).first()
    return rowToBrand(row as Record<string, unknown>)
  }

  /**
   * Update an existing brand.
   * Requirement 2.2
   */
  async update(id: number, data: Partial<CreateBrandData>): Promise<Brand> {
    const existing = await this.db('brands').where({ id }).first()
    if (!existing) {
      throw new NotFoundError(`Brand with id ${id} not found`)
    }

    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) patch.name = data.name
    if (data.description !== undefined) patch.description = data.description

    await this.db('brands').where({ id }).update(patch)

    const row = await this.db('brands').where({ id }).first()
    return rowToBrand(row as Record<string, unknown>)
  }

  /**
   * Delete a brand.
   *
   * Rejects if any active product references this brand.
   * Requirement 2.4
   */
  async delete(id: number): Promise<void> {
    const existing = await this.db('brands').where({ id }).first()
    if (!existing) {
      throw new NotFoundError(`Brand with id ${id} not found`)
    }

    const refCount = await countActiveProductReferences(this.db, 'brand_id', id)
    if (refCount > 0) {
      throw new ConflictError(
        `Cannot delete brand: ${refCount} active product(s) reference this brand`
      )
    }

    await this.db('brands').where({ id }).delete()
  }

  /**
   * List all brands ordered by name.
   * Requirement 2.2
   */
  async list(): Promise<Brand[]> {
    const rows = await this.db('brands').orderBy('name', 'asc')
    return rows.map((r) => rowToBrand(r as Record<string, unknown>))
  }

  /**
   * Find a brand by ID. Returns null if not found.
   */
  async findById(id: number): Promise<Brand | null> {
    const row = await this.db('brands').where({ id }).first()
    return row ? rowToBrand(row as Record<string, unknown>) : null
  }
}

// ─── UnitService ──────────────────────────────────────────────────────────────

export class UnitService {
  private readonly db: Knex

  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  /**
   * Create a new unit of measure.
   * Requirement 2.3
   */
  async create(data: CreateUnitData): Promise<UnitOfMeasure> {
    const [id] = await this.db('units_of_measure').insert({
      name: data.name,
      abbreviation: data.abbreviation ?? null,
    })
    const row = await this.db('units_of_measure').where({ id }).first()
    return rowToUnit(row as Record<string, unknown>)
  }

  /**
   * Update an existing unit of measure.
   * Requirement 2.3
   */
  async update(id: number, data: Partial<CreateUnitData>): Promise<UnitOfMeasure> {
    const existing = await this.db('units_of_measure').where({ id }).first()
    if (!existing) {
      throw new NotFoundError(`Unit of measure with id ${id} not found`)
    }

    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) patch.name = data.name
    if (data.abbreviation !== undefined) patch.abbreviation = data.abbreviation

    await this.db('units_of_measure').where({ id }).update(patch)

    const row = await this.db('units_of_measure').where({ id }).first()
    return rowToUnit(row as Record<string, unknown>)
  }

  /**
   * Delete a unit of measure.
   *
   * Rejects if any active product references this unit.
   * Requirement 2.4
   */
  async delete(id: number): Promise<void> {
    const existing = await this.db('units_of_measure').where({ id }).first()
    if (!existing) {
      throw new NotFoundError(`Unit of measure with id ${id} not found`)
    }

    const refCount = await countActiveProductReferences(this.db, 'unit_id', id)
    if (refCount > 0) {
      throw new ConflictError(
        `Cannot delete unit of measure: ${refCount} active product(s) reference this unit`
      )
    }

    await this.db('units_of_measure').where({ id }).delete()
  }

  /**
   * List all units of measure ordered by name.
   * Requirement 2.3
   */
  async list(): Promise<UnitOfMeasure[]> {
    const rows = await this.db('units_of_measure').orderBy('name', 'asc')
    return rows.map((r) => rowToUnit(r as Record<string, unknown>))
  }

  /**
   * Find a unit of measure by ID. Returns null if not found.
   */
  async findById(id: number): Promise<UnitOfMeasure | null> {
    const row = await this.db('units_of_measure').where({ id }).first()
    return row ? rowToUnit(row as Record<string, unknown>) : null
  }
}

// ─── Default singleton exports ────────────────────────────────────────────────

export const categoryService = new CategoryService()
export const brandService = new BrandService()
export const unitService = new UnitService()
