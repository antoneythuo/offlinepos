import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Knex } from 'knex'
import { ProductRepository } from '../../../src/repositories/ProductRepository'

// ─── Mock Knex builder factory ────────────────────────────────────────────────

/**
 * Builds a chainable mock Knex query builder.
 *
 * The chain we need to support:
 *   db('table').leftJoin(...).where(...).select(...).first()
 *   db('table').insert(...)
 *   db('table').where(...).update(...)
 *   db('table').where(...).where(...).select(...).orderBy(...)
 */
function makeQueryBuilder(resolveValue: unknown) {
  const builder: Record<string, unknown> = {}
  const chainMethods = [
    'leftJoin', 'join', 'where', 'select', 'orderBy',
    'update', 'delete', 'andWhere', 'orWhere',
  ]
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnThis()
  }
  builder.first = vi.fn().mockResolvedValue(resolveValue)
  builder.insert = vi.fn().mockResolvedValue([1])
  // For array results (search, listAll)
  builder.then = undefined
  return builder
}

/**
 * Creates a mock Knex instance that returns the given value for all queries.
 * For array-returning queries, the builder itself is thenable.
 */
function makeMockKnex(
  firstResult: unknown,
  arrayResult: unknown[] = []
): Knex {
  const builder = makeQueryBuilder(firstResult) as Record<string, unknown>

  // Make the builder itself a thenable so `await qb` returns arrayResult
  // (used by search and listAll which don't call .first())
  builder[Symbol.iterator] = undefined
  // Override: when awaited directly (no .first()), resolve to arrayResult
  const originalThen = Promise.resolve(arrayResult).then.bind(
    Promise.resolve(arrayResult)
  )
  builder.then = originalThen

  const mockKnex = vi.fn().mockReturnValue(builder) as unknown as Knex
  return mockKnex
}

// ─── Raw product row fixture ──────────────────────────────────────────────────

const RAW_ROW = {
  id: 1,
  sku: 'SKU-001',
  name: 'Test Product',
  category_id: 1,
  category_name: 'Electronics',
  brand_id: null,
  brand_name: null,
  unit_id: 1,
  unit_name: 'piece',
  cost_price: '10.0000',
  selling_price: '20.0000',
  tax_rate: '16.00',
  tax_inclusive: 0,
  reorder_point: 5,
  quantity_on_hand: '100.0000',
  barcode: null,
  batch_tracking: 0,
  is_active: 1,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProductRepository.findById', () => {
  it('returns a Product when the row exists', async () => {
    const db = makeMockKnex(RAW_ROW)
    const repo = new ProductRepository(db)

    const product = await repo.findById(1)

    expect(product).not.toBeNull()
    expect(product!.id).toBe(1)
    expect(product!.sku).toBe('SKU-001')
    expect(product!.name).toBe('Test Product')
    expect(product!.costPrice).toBe(10)
    expect(product!.sellingPrice).toBe(20)
    expect(product!.taxInclusive).toBe(false)
    expect(product!.isActive).toBe(true)
  })

  it('returns null when no row is found', async () => {
    const db = makeMockKnex(undefined)
    const repo = new ProductRepository(db)

    const product = await repo.findById(999)

    expect(product).toBeNull()
  })

  it('maps category_name to categoryName', async () => {
    const db = makeMockKnex(RAW_ROW)
    const repo = new ProductRepository(db)

    const product = await repo.findById(1)

    expect(product!.categoryName).toBe('Electronics')
  })

  it('maps unit_name to unitName', async () => {
    const db = makeMockKnex(RAW_ROW)
    const repo = new ProductRepository(db)

    const product = await repo.findById(1)

    expect(product!.unitName).toBe('piece')
  })
})

describe('ProductRepository.findBySku', () => {
  it('returns a Product when the SKU exists', async () => {
    const db = makeMockKnex(RAW_ROW)
    const repo = new ProductRepository(db)

    const product = await repo.findBySku('SKU-001')

    expect(product).not.toBeNull()
    expect(product!.sku).toBe('SKU-001')
  })

  it('returns null when SKU is not found', async () => {
    const db = makeMockKnex(undefined)
    const repo = new ProductRepository(db)

    const product = await repo.findBySku('NONEXISTENT')

    expect(product).toBeNull()
  })
})

describe('ProductRepository.create', () => {
  it('inserts a product and returns the created record', async () => {
    // insert returns [1], then findById (via first()) returns RAW_ROW
    const builder = makeQueryBuilder(RAW_ROW) as Record<string, unknown>
    builder.insert = vi.fn().mockResolvedValue([1])
    // Make builder thenable for array queries
    builder.then = Promise.resolve([]).then.bind(Promise.resolve([]))

    const mockKnex = vi.fn().mockReturnValue(builder) as unknown as Knex
    const repo = new ProductRepository(mockKnex)

    const product = await repo.create({
      sku: 'SKU-001',
      name: 'Test Product',
      categoryId: 1,
      unitId: 1,
      costPrice: 10,
      sellingPrice: 20,
    })

    expect(product).not.toBeNull()
    expect(product.id).toBe(1)
    expect(product.sku).toBe('SKU-001')
  })
})

describe('ProductRepository.softDelete', () => {
  it('calls update with is_active = 0', async () => {
    const builder = makeQueryBuilder(undefined) as Record<string, unknown>
    builder.update = vi.fn().mockResolvedValue(1)
    builder.then = Promise.resolve([]).then.bind(Promise.resolve([]))

    const mockKnex = vi.fn().mockReturnValue(builder) as unknown as Knex
    const repo = new ProductRepository(mockKnex)

    await repo.softDelete(1)

    expect(builder.update).toHaveBeenCalledWith({ is_active: 0 })
  })
})

describe('ProductRepository.search', () => {
  it('returns an array of products matching the query', async () => {
    const db = makeMockKnex(RAW_ROW, [RAW_ROW])
    const repo = new ProductRepository(db)

    const results = await repo.search('Test')

    // The mock resolves to [RAW_ROW] when awaited as array
    expect(Array.isArray(results)).toBe(true)
  })

  it('returns empty array when no products match', async () => {
    const db = makeMockKnex(undefined, [])
    const repo = new ProductRepository(db)

    const results = await repo.search('nonexistent')

    expect(results).toEqual([])
  })
})
