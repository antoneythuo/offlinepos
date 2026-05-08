// CSV import service for bulk product import
// Implements: Requirements 8.1, 8.2

import * as fs from 'fs'
import Papa from 'papaparse'
import type { Knex } from 'knex'
import knexDefault from '../db/knex'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RowError {
  /** 1-indexed row number (header = row 0, first data row = row 1) */
  row: number
  sku?: string
  errors: string[]
}

export interface ImportResult {
  imported: number
  errors: RowError[]
}

/** The required columns that must be present and non-empty in every CSV row */
const REQUIRED_COLUMNS = ['sku', 'name', 'category', 'unit', 'cost_price', 'selling_price'] as const

// ─── CsvImportService ─────────────────────────────────────────────────────────

export class CsvImportService {
  private readonly db: Knex

  /**
   * @param knexInstance  Optional Knex instance injected for testing.
   */
  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  /**
   * Import products from a CSV file.
   *
   * Steps:
   *  1. Read the file from `filePath`.
   *  2. Parse with Papa Parse (header: true).
   *  3. For each row, validate required fields are present and non-empty,
   *     and that prices are non-negative numbers.
   *  4. For valid rows, upsert by SKU (insert or update).
   *  5. Collect errors for invalid rows with 1-indexed row number.
   *  6. Return `{ imported, errors }`.
   *
   * Requirements 8.1, 8.2
   */
  async importProducts(filePath: string): Promise<ImportResult> {
    // 1. Read file
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // 2. Parse CSV
    const parsed = Papa.parse<Record<string, string>>(fileContent, {
      header: true,
      skipEmptyLines: true,
    })

    const rows = parsed.data
    const errors: RowError[] = []
    let imported = 0

    // 3. Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 1 // 1-indexed; header is row 0
      const rowErrors: string[] = []

      // Validate required fields are present and non-empty
      for (const col of REQUIRED_COLUMNS) {
        const value = row[col]
        if (value === undefined || value === null || String(value).trim() === '') {
          rowErrors.push(`Missing required field: "${col}"`)
        }
      }

      // Validate prices are non-negative numbers (only if fields are present)
      const costPriceRaw = row['cost_price']
      const sellingPriceRaw = row['selling_price']

      if (costPriceRaw !== undefined && costPriceRaw.trim() !== '') {
        const costPrice = Number(costPriceRaw)
        if (isNaN(costPrice)) {
          rowErrors.push(`"cost_price" must be a number, got: "${costPriceRaw}"`)
        } else if (costPrice < 0) {
          rowErrors.push(`"cost_price" must be non-negative, got: ${costPrice}`)
        }
      }

      if (sellingPriceRaw !== undefined && sellingPriceRaw.trim() !== '') {
        const sellingPrice = Number(sellingPriceRaw)
        if (isNaN(sellingPrice)) {
          rowErrors.push(`"selling_price" must be a number, got: "${sellingPriceRaw}"`)
        } else if (sellingPrice < 0) {
          rowErrors.push(`"selling_price" must be non-negative, got: ${sellingPrice}`)
        }
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          sku: row['sku']?.trim() || undefined,
          errors: rowErrors,
        })
        continue
      }

      // 4. Upsert valid row by SKU
      try {
        await this._upsertRow(row)
        imported++
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error during upsert'
        errors.push({
          row: rowNumber,
          sku: row['sku']?.trim(),
          errors: [message],
        })
      }
    }

    return { imported, errors }
  }

  /**
   * Upsert a single validated CSV row into the products table.
   *
   * Resolves category and unit by name, then inserts or updates the product
   * matched by SKU.
   */
  private async _upsertRow(row: Record<string, string>): Promise<void> {
    const sku = row['sku'].trim()
    const name = row['name'].trim()
    const categoryName = row['category'].trim()
    const unitName = row['unit'].trim()
    const costPrice = Number(row['cost_price'])
    const sellingPrice = Number(row['selling_price'])

    // Resolve category by name
    const category = await this.db('categories')
      .where('name', categoryName)
      .first() as { id: number } | undefined

    if (!category) {
      throw new Error(`Category "${categoryName}" not found`)
    }

    // Resolve unit by name
    const unit = await this.db('units_of_measure')
      .where('name', unitName)
      .first() as { id: number } | undefined

    if (!unit) {
      throw new Error(`Unit "${unitName}" not found`)
    }

    // Check if product with this SKU already exists
    const existing = await this.db('products')
      .where('sku', sku)
      .first() as { id: number } | undefined

    if (existing) {
      // Update existing product
      await this.db('products').where('id', existing.id).update({
        name,
        category_id: category.id,
        unit_id: unit.id,
        cost_price: costPrice,
        selling_price: sellingPrice,
        is_active: 1,
      })
    } else {
      // Insert new product
      await this.db('products').insert({
        sku,
        name,
        category_id: category.id,
        unit_id: unit.id,
        cost_price: costPrice,
        selling_price: sellingPrice,
        tax_rate: 0,
        tax_inclusive: 0,
        reorder_point: 0,
        quantity_on_hand: 0,
        batch_tracking: 0,
        is_active: 1,
      })
    }
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const csvImportService = new CsvImportService()
