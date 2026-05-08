// Data access layer for products table
// Methods: create, update, softDelete, findBySku, findById, search, listAll

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import type { Product } from '../types/index'
import { getBranchFilter } from '../utils/branchFilter'

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateProductData {
  sku: string
  name: string
  categoryId: number
  brandId?: number
  unitId: number
  costPrice: number
  sellingPrice: number
  taxRate?: number
  taxInclusive?: boolean
  reorderPoint?: number
  quantityOnHand?: number
  barcode?: string
  batchTracking?: boolean
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

/**
 * Maps a raw database row (snake_case) to the `Product` TypeScript interface
 * (camelCase). Handles MySQL's numeric booleans (0/1) and optional joins.
 */
function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    sku: row.sku as string,
    name: row.name as string,
    categoryId: row.category_id as number,
    categoryName: row.category_name as string | undefined,
    brandId: row.brand_id as number | undefined,
    brandName: row.brand_name as string | undefined,
    unitId: row.unit_id as number,
    unitName: row.unit_name as string | undefined,
    costPrice: Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    taxRate: Number(row.tax_rate),
    taxInclusive: Boolean(row.tax_inclusive),
    reorderPoint: Number(row.reorder_point ?? 0),
    quantityOnHand: Number(row.quantity_on_hand ?? 0),
    barcode: row.barcode as string | undefined,
    batchTracking: Boolean(row.batch_tracking),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class ProductRepository {
  private readonly db: Knex

  /**
   * @param knexInstance  Optional Knex instance injected for testing.
   *                      Defaults to the application-wide singleton.
   */
  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  /**
   * Insert a new product record and return the created product.
   */
  async create(data: CreateProductData): Promise<Product> {
    const [id] = await this.db('products').insert({
      sku: data.sku,
      name: data.name,
      category_id: data.categoryId,
      brand_id: data.brandId ?? null,
      unit_id: data.unitId,
      cost_price: data.costPrice,
      selling_price: data.sellingPrice,
      tax_rate: data.taxRate ?? 0,
      tax_inclusive: data.taxInclusive ? 1 : 0,
      reorder_point: data.reorderPoint ?? 0,
      quantity_on_hand: data.quantityOnHand ?? 0,
      barcode: data.barcode ?? null,
      batch_tracking: data.batchTracking ? 1 : 0,
      is_active: 1,
    })

    const product = await this.findById(id as number)
    if (!product) {
      throw new Error(`Failed to retrieve product after insert (id=${id})`)
    }
    return product
  }

  /**
   * Update an existing product and return the updated record.
   * Only the fields present in `data` are changed.
   */
  async update(id: number, data: Partial<CreateProductData>): Promise<Product> {
    const patch: Record<string, unknown> = {}

    if (data.sku !== undefined) patch.sku = data.sku
    if (data.name !== undefined) patch.name = data.name
    if (data.categoryId !== undefined) patch.category_id = data.categoryId
    if (data.brandId !== undefined) patch.brand_id = data.brandId
    if (data.unitId !== undefined) patch.unit_id = data.unitId
    if (data.costPrice !== undefined) patch.cost_price = data.costPrice
    if (data.sellingPrice !== undefined) patch.selling_price = data.sellingPrice
    if (data.taxRate !== undefined) patch.tax_rate = data.taxRate
    if (data.taxInclusive !== undefined) patch.tax_inclusive = data.taxInclusive ? 1 : 0
    if (data.reorderPoint !== undefined) patch.reorder_point = data.reorderPoint
    if (data.barcode !== undefined) patch.barcode = data.barcode
    if (data.batchTracking !== undefined) patch.batch_tracking = data.batchTracking ? 1 : 0

    await this.db('products').where({ id }).update(patch)

    const product = await this.findById(id)
    if (!product) {
      throw new Error(`Product not found after update (id=${id})`)
    }
    return product
  }

  /**
   * Soft-delete a product by setting `is_active = false`.
   * The record remains in the database for historical references.
   * The SKU is suffixed with `__deleted_{id}` to free the original SKU for reuse,
   * since the database enforces a unique constraint on the sku column.
   */
  async softDelete(id: number): Promise<void> {
    await this.db('products').where({ id }).update({
      is_active: 0,
      sku: this.db.raw('CONCAT(sku, ?, id)', ['__deleted_']),
    })
  }

  /**
   * Find a product by its SKU. Returns `null` if not found.
   * Searches only active products to support uniqueness checks.
   * Soft-deleted products do not block SKU reuse.
   */
  async findBySku(sku: string): Promise<Product | null> {
    const row = await this.db('products as p')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('brands as b', 'p.brand_id', 'b.id')
      .leftJoin('units_of_measure as u', 'p.unit_id', 'u.id')
      .where('p.sku', sku)
      .where('p.is_active', 1)
      .select(
        'p.*',
        'c.name as category_name',
        'b.name as brand_name',
        'u.name as unit_name'
      )
      .first()

    return row ? rowToProduct(row as Record<string, unknown>) : null
  }

  /**
   * Find a product by its internal ID. Returns `null` if not found.
   * Includes joined category/brand/unit names.
   */
  async findById(id: number): Promise<Product | null> {
    const row = await this.db('products as p')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('brands as b', 'p.brand_id', 'b.id')
      .leftJoin('units_of_measure as u', 'p.unit_id', 'u.id')
      .where('p.id', id)
      .select(
        'p.*',
        'c.name as category_name',
        'b.name as brand_name',
        'u.name as unit_name'
      )
      .first()

    return row ? rowToProduct(row as Record<string, unknown>) : null
  }

  /**
   * Search active products by name, SKU, or barcode.
   * Optionally filter by category ID and/or branch ID.
   *
   * @param query       Free-text search string (matched against name, sku, barcode).
   * @param categoryId  Optional category filter.
   * @param branchId    Optional branch filter — applied when multi-branch mode is
   *                    enabled (Req 31.1, Task 33.4).
   */
  async search(query: string, categoryId?: number, branchId?: number): Promise<Product[]> {
    const qb = this.db('products as p')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('brands as b', 'p.brand_id', 'b.id')
      .leftJoin('units_of_measure as u', 'p.unit_id', 'u.id')
      .where('p.is_active', 1)
      .select(
        'p.*',
        'c.name as category_name',
        'b.name as brand_name',
        'u.name as unit_name'
      )

    if (query.trim()) {
      const like = `%${query.trim()}%`
      qb.where((builder) => {
        builder
          .where('p.name', 'like', like)
          .orWhere('p.sku', 'like', like)
          .orWhere('p.barcode', 'like', like)
      })
    }

    if (categoryId !== undefined) {
      qb.where('p.category_id', categoryId)
    }

    // Apply branch filter when multi-branch mode is active (Req 31.1)
    const branchFilter = getBranchFilter(branchId)
    if (Object.keys(branchFilter).length > 0) {
      qb.where('p.branch_id', (branchFilter as { branch_id: number }).branch_id)
    }

    const rows = await qb
    return rows.map((r) => rowToProduct(r as Record<string, unknown>))
  }

  /**
   * Return all active products with joined category, brand, and unit names.
   *
   * @param branchId  Optional branch filter — applied when multi-branch mode is
   *                  enabled (Req 31.1, Task 33.4).
   */
  async listAll(branchId?: number): Promise<Product[]> {
    const qb = this.db('products as p')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('brands as b', 'p.brand_id', 'b.id')
      .leftJoin('units_of_measure as u', 'p.unit_id', 'u.id')
      .where('p.is_active', 1)
      .select(
        'p.*',
        'c.name as category_name',
        'b.name as brand_name',
        'u.name as unit_name'
      )
      .orderBy('p.name', 'asc')

    // Apply branch filter when multi-branch mode is active (Req 31.1)
    const branchFilter = getBranchFilter(branchId)
    if (Object.keys(branchFilter).length > 0) {
      qb.where('p.branch_id', (branchFilter as { branch_id: number }).branch_id)
    }

    const rows = await qb
    return rows.map((r) => rowToProduct(r as Record<string, unknown>))
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const productRepository = new ProductRepository()
