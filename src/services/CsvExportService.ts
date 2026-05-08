// CSV export service for bulk product export
// Implements: Requirements 8.3, 8.4

import * as fs from 'fs'
import Papa from 'papaparse'
import type { Knex } from 'knex'
import knexDefault from '../db/knex'

// ─── CsvExportService ─────────────────────────────────────────────────────────

export class CsvExportService {
  private readonly db: Knex

  /**
   * @param knexInstance  Optional Knex instance injected for testing.
   */
  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  /**
   * Export all active products to a CSV file.
   *
   * Steps:
   *  1. Query all active products with joined category/brand/unit names.
   *  2. Map to CSV-friendly format.
   *  3. Use Papa Parse to unparse to CSV string.
   *  4. Write to `filePath`.
   *
   * Requirements 8.3
   */
  async exportProducts(filePath: string): Promise<void> {
    // 1. Query all active products with joined names
    const rows = await this.db('products as p')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('brands as b', 'p.brand_id', 'b.id')
      .leftJoin('units_of_measure as u', 'p.unit_id', 'u.id')
      .where('p.is_active', 1)
      .select(
        'p.sku',
        'p.name',
        'c.name as category',
        'b.name as brand',
        'u.name as unit',
        'p.cost_price',
        'p.selling_price',
        'p.tax_rate',
        'p.tax_inclusive',
        'p.reorder_point',
        'p.quantity_on_hand',
        'p.barcode'
      )
      .orderBy('p.name', 'asc')

    // 2. Map to CSV-friendly format (convert numeric booleans to readable strings)
    const csvData = rows.map((row) => ({
      sku: row.sku,
      name: row.name,
      category: row.category || '',
      brand: row.brand || '',
      unit: row.unit || '',
      cost_price: row.cost_price,
      selling_price: row.selling_price,
      tax_rate: row.tax_rate,
      tax_inclusive: row.tax_inclusive ? 'yes' : 'no',
      reorder_point: row.reorder_point,
      quantity_on_hand: row.quantity_on_hand,
      barcode: row.barcode || '',
    }))

    // 3. Unparse to CSV
    const csv = Papa.unparse(csvData, {
      header: true,
    })

    // 4. Write to file
    fs.writeFileSync(filePath, csv, 'utf-8')
  }

  /**
   * Returns a CSV template string with just the header row and one example row.
   *
   * Requirements 8.4
   */
  getTemplate(): string {
    const templateData = [
      {
        sku: 'EXAMPLE-001',
        name: 'Example Product',
        category: 'Electronics',
        unit: 'piece',
        cost_price: '10.00',
        selling_price: '20.00',
      },
    ]

    return Papa.unparse(templateData, {
      header: true,
    })
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const csvExportService = new CsvExportService()
