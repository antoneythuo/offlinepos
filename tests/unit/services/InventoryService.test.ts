import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Knex } from 'knex'
import { ProductRepository } from '../../../src/repositories/ProductRepository'
import { InventoryService } from '../../../src/services/InventoryService'
import { AuditService } from '../../../src/services/AuditService'
import { ConflictError, NotFoundError, ValidationError } from '../../../src/errors'
import type { Product } from '../../../src/types/index'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PRODUCT_ROW: Product = {
  id: 1,
  sku: 'SKU-001',
  name: 'Test Product',
  categoryId: 1,
  categoryName: 'Electronics',
  brandId: undefined,
  brandName: undefined,
  unitId: 1,
  unitName: 'piece',
  costPrice: 10.0,
  sellingPrice: 20.0,
  taxRate: 16.0,
  taxInclusive: false,
  reorderPoint: 5,
  quantityOnHand: 100,
  barcode: undefined,
  batchTracking: false,
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const CREATE_DATA = {
  sku: 'SKU-001',
  name: 'Test Product',
  categoryId: 1,
  unitId: 1,
  costPrice: 10.0,
  sellingPrice: 20.0,
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a mock Knex instance that returns the given count for
 * `transaction_items` queries (used by deleteProduct).
 */
function makeMockKnexWithTxCount(count: number): Knex {
  const countBuilder = {
    where: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({ count }),
  }
  const mockKnex = vi.fn().mockReturnValue(countBuilder) as unknown as Knex
  return mockKnex
}

/**
 * Creates a mock ProductRepository with all methods stubbed.
 */
function makeMockRepo(overrides: Partial<ProductRepository> = {}): ProductRepository {
  return {
    create: vi.fn().mockResolvedValue(PRODUCT_ROW),
    update: vi.fn().mockResolvedValue(PRODUCT_ROW),
    softDelete: vi.fn().mockResolvedValue(undefined),
    findBySku: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(PRODUCT_ROW),
    search: vi.fn().mockResolvedValue([PRODUCT_ROW]),
    listAll: vi.fn().mockResolvedValue([PRODUCT_ROW]),
    ...overrides,
  } as unknown as ProductRepository
}

/**
 * Creates a mock AuditService with `log` stubbed.
 */
function makeMockAudit(): AuditService {
  return {
    log: vi.fn(),
  } as unknown as AuditService
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InventoryService.createProduct', () => {
  it('creates a product with valid data and returns the product', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    const result = await service.createProduct(CREATE_DATA, 1)

    expect(repo.create).toHaveBeenCalledWith(CREATE_DATA)
    expect(result).toEqual(PRODUCT_ROW)
  })

  it('writes an audit log entry after creating a product', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await service.createProduct(CREATE_DATA, 42)

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        action: 'product_create',
        entityType: 'product',
        entityId: PRODUCT_ROW.id,
      })
    )
  })

  it('throws ConflictError when SKU already exists', async () => {
    // findBySku returns an existing product with the same SKU
    const repo = makeMockRepo({
      findBySku: vi.fn().mockResolvedValue(PRODUCT_ROW),
    })
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(service.createProduct(CREATE_DATA, 1)).rejects.toThrow(ConflictError)
  })

  it('throws ConflictError with descriptive message for duplicate SKU', async () => {
    const repo = makeMockRepo({
      findBySku: vi.fn().mockResolvedValue(PRODUCT_ROW),
    })
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(service.createProduct(CREATE_DATA, 1)).rejects.toThrow(
      `A product with SKU "${CREATE_DATA.sku}" already exists`
    )
  })

  it('throws ValidationError when cost price is negative', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(
      service.createProduct({ ...CREATE_DATA, costPrice: -1 }, 1)
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError when selling price is negative', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(
      service.createProduct({ ...CREATE_DATA, sellingPrice: -0.01 }, 1)
    ).rejects.toThrow(ValidationError)
  })

  it('accepts zero cost price (boundary: non-negative)', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(
      service.createProduct({ ...CREATE_DATA, costPrice: 0 }, 1)
    ).resolves.toBeDefined()
  })

  it('does not call repo.create when validation fails', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(
      service.createProduct({ ...CREATE_DATA, costPrice: -5 }, 1)
    ).rejects.toThrow(ValidationError)

    expect(repo.create).not.toHaveBeenCalled()
  })
})

describe('InventoryService.updateProduct', () => {
  it('updates a product and returns the updated record', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    const result = await service.updateProduct(1, { name: 'Updated Name' }, 1)

    expect(repo.update).toHaveBeenCalledWith(1, { name: 'Updated Name' })
    expect(result).toEqual(PRODUCT_ROW)
  })

  it('throws NotFoundError when product does not exist', async () => {
    const repo = makeMockRepo({
      findById: vi.fn().mockResolvedValue(null),
    })
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(service.updateProduct(999, { name: 'X' }, 1)).rejects.toThrow(NotFoundError)
  })

  it('throws ValidationError when updating with negative price', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(
      service.updateProduct(1, { sellingPrice: -10 }, 1)
    ).rejects.toThrow(ValidationError)
  })

  it('throws ConflictError when updating to a duplicate SKU', async () => {
    // findById returns the current product (id=1, sku='SKU-001')
    // findBySku returns a different product with the same new SKU (id=2)
    const existingWithSameSku: Product = { ...PRODUCT_ROW, id: 2, sku: 'SKU-002' }
    const repo = makeMockRepo({
      findById: vi.fn().mockResolvedValue(PRODUCT_ROW),
      findBySku: vi.fn().mockResolvedValue(existingWithSameSku),
    })
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(
      service.updateProduct(1, { sku: 'SKU-002' }, 1)
    ).rejects.toThrow(ConflictError)
  })

  it('writes an audit log entry with before and after state', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await service.updateProduct(1, { name: 'New Name' }, 7)

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        action: 'product_update',
        entityType: 'product',
        entityId: PRODUCT_ROW.id,
      })
    )
  })
})

describe('InventoryService.deleteProduct', () => {
  it('soft-deletes a product with no transactions', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await service.deleteProduct(1, 1)

    expect(repo.softDelete).toHaveBeenCalledWith(1)
  })

  it('throws ValidationError when product has associated transactions', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    // Simulate 3 transaction items referencing this product
    const db = makeMockKnexWithTxCount(3)
    const service = new InventoryService(db, repo, audit)

    await expect(service.deleteProduct(1, 1)).rejects.toThrow(ValidationError)
  })

  it('includes transaction count in the error message', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(5)
    const service = new InventoryService(db, repo, audit)

    await expect(service.deleteProduct(1, 1)).rejects.toThrow('5 transaction(s)')
  })

  it('does not call softDelete when transactions exist', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(1)
    const service = new InventoryService(db, repo, audit)

    await expect(service.deleteProduct(1, 1)).rejects.toThrow(ValidationError)
    expect(repo.softDelete).not.toHaveBeenCalled()
  })

  it('throws NotFoundError when product does not exist', async () => {
    const repo = makeMockRepo({
      findById: vi.fn().mockResolvedValue(null),
    })
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await expect(service.deleteProduct(999, 1)).rejects.toThrow(NotFoundError)
  })

  it('writes an audit log entry after soft-delete', async () => {
    const repo = makeMockRepo()
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await service.deleteProduct(1, 3)

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 3,
        action: 'product_delete',
        entityType: 'product',
        entityId: 1,
      })
    )
  })
})

describe('InventoryService.searchProducts', () => {
  it('delegates to repo.search and returns results', async () => {
    const repo = makeMockRepo({
      search: vi.fn().mockResolvedValue([PRODUCT_ROW]),
    })
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    const results = await service.searchProducts('Test', 1)

    expect(repo.search).toHaveBeenCalledWith('Test', 1)
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual(PRODUCT_ROW)
  })

  it('passes undefined categoryId when not provided', async () => {
    const repo = makeMockRepo({
      search: vi.fn().mockResolvedValue([]),
    })
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    await service.searchProducts('query')

    expect(repo.search).toHaveBeenCalledWith('query', undefined)
  })

  it('returns empty array when no products match', async () => {
    const repo = makeMockRepo({
      search: vi.fn().mockResolvedValue([]),
    })
    const audit = makeMockAudit()
    const db = makeMockKnexWithTxCount(0)
    const service = new InventoryService(db, repo, audit)

    const results = await service.searchProducts('nonexistent')

    expect(results).toEqual([])
  })
})
