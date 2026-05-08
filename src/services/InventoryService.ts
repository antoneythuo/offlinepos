// Product, category, brand, and unit management
// Implements: Requirements 1.1–1.7, 2.1–2.5

import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import { ProductRepository, type CreateProductData } from '../repositories/ProductRepository'
import { AuditService } from './AuditService'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Product } from '../types/index'

// ─── InventoryService ─────────────────────────────────────────────────────────

export class InventoryService {
  private readonly repo: ProductRepository
  private readonly audit: AuditService
  private readonly db: Knex

  /**
   * @param knexInstance  Optional Knex instance injected for testing.
   * @param repo          Optional ProductRepository injected for testing.
   * @param audit         Optional AuditService injected for testing.
   */
  constructor(knexInstance?: Knex, repo?: ProductRepository, audit?: AuditService) {
    this.db = knexInstance ?? knexDefault
    this.repo = repo ?? new ProductRepository(this.db)
    this.audit = audit ?? new AuditService(this.db)
  }

  // ─── Validation helpers ─────────────────────────────────────────────────────

  /**
   * Validates that cost price and selling price are non-negative numbers.
   * Requirement 1.7
   */
  private validatePrices(data: Partial<CreateProductData>): void {
    if (data.costPrice !== undefined && data.costPrice < 0) {
      throw new ValidationError('Cost price must be a non-negative value')
    }
    if (data.sellingPrice !== undefined && data.sellingPrice < 0) {
      throw new ValidationError('Selling price must be a non-negative value')
    }
  }

  /**
   * Checks that the given SKU is not already used by another product.
   * Requirement 1.5, 1.6
   */
  private async assertSkuUnique(sku: string, excludeId?: number): Promise<void> {
    const existing = await this.repo.findBySku(sku)
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`A product with SKU "${sku}" already exists`)
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Create a new product.
   *
   * Validates prices, enforces SKU uniqueness, inserts the record, and writes
   * an audit log entry.
   *
   * Requirement 1.1, 1.5, 1.6, 1.7, 28.1
   */
  async createProduct(data: CreateProductData, userId: number): Promise<Product> {
    this.validatePrices(data)
    await this.assertSkuUnique(data.sku)

    const product = await this.repo.create(data)

    this.audit.log({
      userId,
      action: 'product_create',
      entityType: 'product',
      entityId: product.id,
      afterState: product as unknown as Record<string, unknown>,
    })

    return product
  }

  /**
   * Update an existing product.
   *
   * Validates prices, enforces SKU uniqueness if SKU is being changed, updates
   * the record, and writes an audit log entry.
   *
   * Requirement 1.2, 1.5, 1.6, 1.7, 28.1
   */
  async updateProduct(
    id: number,
    data: Partial<CreateProductData>,
    userId: number
  ): Promise<Product> {
    this.validatePrices(data)

    // Fetch current state for audit log before-state
    const before = await this.repo.findById(id)
    if (!before) {
      throw new NotFoundError(`Product with id ${id} not found`)
    }

    // If SKU is being changed, ensure the new SKU is unique
    if (data.sku !== undefined && data.sku !== before.sku) {
      await this.assertSkuUnique(data.sku, id)
    }

    const product = await this.repo.update(id, data)

    this.audit.log({
      userId,
      action: 'product_update',
      entityType: 'product',
      entityId: product.id,
      beforeState: before as unknown as Record<string, unknown>,
      afterState: product as unknown as Record<string, unknown>,
    })

    return product
  }

  /**
   * Soft-delete a product.
   *
   * Rejects deletion if any transaction_items reference this product
   * (Requirement 1.3, 1.4). Writes an audit log entry on success.
   *
   * Requirement 1.3, 1.4, 28.1
   */
  async deleteProduct(id: number, userId: number): Promise<void> {
    // Fetch current state for audit log
    const product = await this.repo.findById(id)
    if (!product) {
      throw new NotFoundError(`Product with id ${id} not found`)
    }

    // Enforce no-transaction constraint (Requirement 1.4)
    const txItemCount = await this.db('transaction_items')
      .where('product_id', id)
      .count('id as count')
      .first()

    const count = Number((txItemCount as { count: number } | undefined)?.count ?? 0)
    if (count > 0) {
      throw new ValidationError(
        `Cannot delete product "${product.name}": it is referenced by ${count} transaction(s). ` +
          'Products with sales history cannot be deleted.'
      )
    }

    await this.repo.softDelete(id)

    this.audit.log({
      userId,
      action: 'product_delete',
      entityType: 'product',
      entityId: id,
      beforeState: product as unknown as Record<string, unknown>,
    })
  }

  /**
   * Search active products by name, SKU, or barcode.
   * Optionally filter by category ID.
   *
   * Requirement 11.1, 11.3
   */
  async searchProducts(query: string, categoryId?: number): Promise<Product[]> {
    return this.repo.search(query, categoryId)
  }

  /**
   * List all active products.
   */
  async listProducts(): Promise<Product[]> {
    return this.repo.listAll()
  }

  /**
   * Get a single product by ID.
   */
  async getProduct(id: number): Promise<Product> {
    const product = await this.repo.findById(id)
    if (!product) {
      throw new NotFoundError(`Product with id ${id} not found`)
    }
    return product
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const inventoryService = new InventoryService()
