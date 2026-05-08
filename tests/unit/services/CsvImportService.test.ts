// Unit tests for CsvImportService
// Validates: Requirements 8.1, 8.2

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { CsvImportService } from '../../../src/services/CsvImportService'
import type { Knex } from 'knex'

// ─── Mock fs ──────────────────────────────────────────────────────────────────

vi.mock('fs')

const mockReadFileSync = vi.mocked(fs.readFileSync)

// ─── Mock Knex builder ────────────────────────────────────────────────────────

/**
 * Creates a minimal mock Knex instance that simulates category/unit lookups
 * and product upserts.
 *
 * `categoryMap`  maps category name → id (undefined = not found)
 * `unitMap`      maps unit name → id (undefined = not found)
 * `existingSkus` set of SKUs that already exist in the DB
 */
function makeMockKnex(options: {
  categoryMap?: Record<string, number>
  unitMap?: Record<string, number>
  existingSkus?: string[]
} = {}): Knex {
  const {
    categoryMap = { Electronics: 1, Food: 2 },
    unitMap = { piece: 1, kg: 2 },
    existingSkus = [],
  } = options

  // Track insert/update calls for assertions
  const insertMock = vi.fn().mockResolvedValue([1])
  const updateMock = vi.fn().mockResolvedValue(1)

  const mockKnex = vi.fn((table: string) => {
    // categories table
    if (table === 'categories') {
      return {
        where: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(function (this: { _whereName?: string }) {
          // We need to capture the where argument — use a closure trick
          return Promise.resolve(undefined) // overridden below
        }),
      }
    }
    // units_of_measure table
    if (table === 'units_of_measure') {
      return {
        where: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(undefined),
      }
    }
    // products table
    if (table === 'products') {
      return {
        where: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(undefined),
        insert: insertMock,
        update: updateMock,
      }
    }
    return {
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(undefined),
      insert: insertMock,
      update: updateMock,
    }
  }) as unknown as Knex

  // Override to properly simulate lookups based on the where argument
  ;(mockKnex as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    const builder = {
      _table: table,
      _whereArgs: {} as Record<string, unknown>,
      where(col: string, val: unknown) {
        this._whereArgs[col] = val
        return this
      },
      first() {
        if (this._table === 'categories') {
          const name = this._whereArgs['name'] as string
          const id = categoryMap[name]
          return Promise.resolve(id !== undefined ? { id } : undefined)
        }
        if (this._table === 'units_of_measure') {
          const name = this._whereArgs['name'] as string
          const id = unitMap[name]
          return Promise.resolve(id !== undefined ? { id } : undefined)
        }
        if (this._table === 'products') {
          const sku = this._whereArgs['sku'] as string
          const exists = existingSkus.includes(sku)
          return Promise.resolve(exists ? { id: 99 } : undefined)
        }
        return Promise.resolve(undefined)
      },
      insert: insertMock,
      update: updateMock,
    }
    return builder
  })

  return mockKnex
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function makeCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return 'sku,name,category,unit,cost_price,selling_price\n'
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => row[h] ?? '').join(','))
  }
  return lines.join('\n')
}

const VALID_ROW = {
  sku: 'SKU-001',
  name: 'Test Product',
  category: 'Electronics',
  unit: 'piece',
  cost_price: '10.00',
  selling_price: '20.00',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CsvImportService.importProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('imports all rows from a valid CSV and returns correct count', async () => {
    const csv = makeCsv([VALID_ROW, { ...VALID_ROW, sku: 'SKU-002', name: 'Product 2' }])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(2)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a row with a missing required field and reports correct row number', async () => {
    const csv = makeCsv([
      { ...VALID_ROW, sku: '' }, // row 1: missing sku
    ])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(1)
    expect(result.errors[0].errors.some((e) => e.includes('"sku"'))).toBe(true)
  })

  it('rejects a row with a missing name field', async () => {
    const csv = makeCsv([{ ...VALID_ROW, name: '' }])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(0)
    expect(result.errors[0].errors.some((e) => e.includes('"name"'))).toBe(true)
  })

  it('rejects a row with a negative cost_price', async () => {
    const csv = makeCsv([{ ...VALID_ROW, cost_price: '-5.00' }])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].errors.some((e) => e.includes('cost_price'))).toBe(true)
  })

  it('rejects a row with a negative selling_price', async () => {
    const csv = makeCsv([{ ...VALID_ROW, selling_price: '-0.01' }])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].errors.some((e) => e.includes('selling_price'))).toBe(true)
  })

  it('imports valid rows even when some rows have errors', async () => {
    const csv = makeCsv([
      VALID_ROW,                                    // row 1: valid
      { ...VALID_ROW, sku: 'SKU-002', cost_price: '-1' }, // row 2: invalid
      { ...VALID_ROW, sku: 'SKU-003', name: 'Product 3' }, // row 3: valid
    ])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(2)
  })

  it('returns 0 imported and 0 errors for an empty CSV (header only)', async () => {
    const csv = 'sku,name,category,unit,cost_price,selling_price\n'
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('includes the SKU in the error entry when the SKU is present but other fields are invalid', async () => {
    const csv = makeCsv([{ ...VALID_ROW, name: '', cost_price: '-1' }])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.errors[0].sku).toBe(VALID_ROW.sku)
  })

  it('reports correct row numbers for multiple invalid rows', async () => {
    const csv = makeCsv([
      { ...VALID_ROW, sku: 'SKU-001' },              // row 1: valid
      { ...VALID_ROW, sku: 'SKU-002', name: '' },    // row 2: invalid
      { ...VALID_ROW, sku: 'SKU-003' },              // row 3: valid
      { ...VALID_ROW, sku: 'SKU-004', category: '' }, // row 4: invalid
    ])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(2)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0].row).toBe(2)
    expect(result.errors[1].row).toBe(4)
  })

  it('accepts zero prices (boundary: non-negative)', async () => {
    const csv = makeCsv([{ ...VALID_ROW, cost_price: '0', selling_price: '0' }])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('collects multiple errors for a single row with multiple invalid fields', async () => {
    const csv = makeCsv([{ ...VALID_ROW, sku: '', name: '', cost_price: '-5' }])
    mockReadFileSync.mockReturnValue(csv)

    const db = makeMockKnex()
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.errors[0].errors.length).toBeGreaterThanOrEqual(2)
  })

  it('adds a row error when category is not found in the database', async () => {
    const csv = makeCsv([{ ...VALID_ROW, category: 'NonExistentCategory' }])
    mockReadFileSync.mockReturnValue(csv)

    // categoryMap does not include 'NonExistentCategory'
    const db = makeMockKnex({ categoryMap: { Electronics: 1 } })
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].errors[0]).toContain('NonExistentCategory')
  })

  it('updates an existing product when SKU already exists', async () => {
    const csv = makeCsv([VALID_ROW])
    mockReadFileSync.mockReturnValue(csv)

    // SKU-001 already exists
    const db = makeMockKnex({ existingSkus: ['SKU-001'] })
    const service = new CsvImportService(db)

    const result = await service.importProducts('/fake/path.csv')

    // Should succeed (upsert = update)
    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)
  })
})
