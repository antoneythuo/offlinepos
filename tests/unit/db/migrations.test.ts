import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'fs'
import { resolve, join } from 'path'

// ─── helpers ────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = resolve(__dirname, '../../../src/db/migrations')

/** Returns all .ts migration files (excludes .gitkeep and other non-ts files). */
function getMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()
}

/** Dynamically imports a migration module and returns it. */
async function importMigration(filename: string): Promise<{ up: unknown; down: unknown }> {
  const fullPath = join(MIGRATIONS_DIR, filename)
  return import(fullPath)
}

// ─── Expected migration files ────────────────────────────────────────────────

const EXPECTED_MIGRATIONS = [
  '20240101000001_create_roles.ts',
  '20240101000002_create_users.ts',
  '20240101000003_create_categories.ts',
  '20240101000004_create_brands.ts',
  '20240101000005_create_units_of_measure.ts',
  '20240101000006_create_products.ts',
  '20240101000007_create_product_batches.ts',
  '20240101000008_create_suppliers.ts',
  '20240101000009_create_stock_receipts.ts',
  '20240101000010_create_stock_receipt_items.ts',
  '20240101000011_create_stock_adjustments.ts',
  '20240101000012_create_customers.ts',
  '20240101000013_create_transactions.ts',
  '20240101000014_create_transaction_items.ts',
  '20240101000015_create_transaction_payments.ts',
  '20240101000016_create_credit_payments.ts',
  '20240101000017_create_return_transactions.ts',
  '20240101000018_create_return_items.ts',
  '20240101000019_create_expense_categories.ts',
  '20240101000020_create_expenses.ts',
  '20240101000021_create_shifts.ts',
  '20240101000022_create_z_reports.ts',
  '20240101000023_create_held_transactions.ts',
  '20240101000024_create_audit_logs.ts',
  '20240101000025_create_settings.ts',
  '20240101000026_create_branches.ts',
]

// ─── File existence tests ────────────────────────────────────────────────────

describe('Migration files — existence', () => {
  it('migrations directory exists', () => {
    expect(existsSync(MIGRATIONS_DIR)).toBe(true)
  })

  it('contains exactly the expected migration files', () => {
    const actual = getMigrationFiles()
    expect(actual).toEqual(EXPECTED_MIGRATIONS)
  })

  it.each(EXPECTED_MIGRATIONS)('%s exists on disk', (filename) => {
    const fullPath = join(MIGRATIONS_DIR, filename)
    expect(existsSync(fullPath)).toBe(true)
  })
})

// ─── Export shape tests ──────────────────────────────────────────────────────

describe('Migration files — exports', () => {
  it.each(EXPECTED_MIGRATIONS)('%s exports an `up` function', async (filename) => {
    const mod = await importMigration(filename)
    expect(typeof mod.up).toBe('function')
  })

  it.each(EXPECTED_MIGRATIONS)('%s exports a `down` function', async (filename) => {
    const mod = await importMigration(filename)
    expect(typeof mod.down).toBe('function')
  })
})

// ─── Ordering tests ──────────────────────────────────────────────────────────

describe('Migration files — ordering', () => {
  it('migration filenames are in ascending timestamp order', () => {
    const files = getMigrationFiles()
    const timestamps = files.map((f) => f.split('_')[0])
    const sorted = [...timestamps].sort()
    expect(timestamps).toEqual(sorted)
  })

  it('roles migration comes before users migration (FK dependency)', () => {
    const files = getMigrationFiles()
    const rolesIdx = files.findIndex((f) => f.includes('create_roles'))
    const usersIdx = files.findIndex((f) => f.includes('create_users'))
    expect(rolesIdx).toBeLessThan(usersIdx)
  })

  it('categories, brands, and units_of_measure come before products (FK dependencies)', () => {
    const files = getMigrationFiles()
    const categoriesIdx = files.findIndex((f) => f.includes('create_categories'))
    const brandsIdx = files.findIndex((f) => f.includes('create_brands'))
    const unitsIdx = files.findIndex((f) => f.includes('create_units_of_measure'))
    const productsIdx = files.findIndex((f) => f.includes('create_products'))

    expect(categoriesIdx).toBeLessThan(productsIdx)
    expect(brandsIdx).toBeLessThan(productsIdx)
    expect(unitsIdx).toBeLessThan(productsIdx)
  })

  it('products comes before product_batches (FK dependency)', () => {
    const files = getMigrationFiles()
    const productsIdx = files.findIndex((f) => f.includes('create_products'))
    const batchesIdx = files.findIndex((f) => f.includes('create_product_batches'))
    expect(productsIdx).toBeLessThan(batchesIdx)
  })

  it('suppliers comes before stock_receipts (FK dependency)', () => {
    const files = getMigrationFiles()
    const suppliersIdx = files.findIndex((f) => f.includes('create_suppliers'))
    const receiptsIdx = files.findIndex((f) => f.includes('create_stock_receipts'))
    expect(suppliersIdx).toBeLessThan(receiptsIdx)
  })

  it('stock_receipts comes before stock_receipt_items (FK dependency)', () => {
    const files = getMigrationFiles()
    const receiptsIdx = files.findIndex((f) => f.includes('create_stock_receipts'))
    const itemsIdx = files.findIndex((f) => f.includes('create_stock_receipt_items'))
    expect(receiptsIdx).toBeLessThan(itemsIdx)
  })

  it('transactions comes before transaction_items, transaction_payments, credit_payments, return_transactions (FK dependencies)', () => {
    const files = getMigrationFiles()
    const txIdx = files.findIndex((f) => f.includes('create_transactions'))
    const txItemsIdx = files.findIndex((f) => f.includes('create_transaction_items'))
    const txPaymentsIdx = files.findIndex((f) => f.includes('create_transaction_payments'))
    const creditPaymentsIdx = files.findIndex((f) => f.includes('create_credit_payments'))
    const returnTxIdx = files.findIndex((f) => f.includes('create_return_transactions'))

    expect(txIdx).toBeLessThan(txItemsIdx)
    expect(txIdx).toBeLessThan(txPaymentsIdx)
    expect(txIdx).toBeLessThan(creditPaymentsIdx)
    expect(txIdx).toBeLessThan(returnTxIdx)
  })

  it('return_transactions comes before return_items (FK dependency)', () => {
    const files = getMigrationFiles()
    const returnTxIdx = files.findIndex((f) => f.includes('create_return_transactions'))
    const returnItemsIdx = files.findIndex((f) => f.includes('create_return_items'))
    expect(returnTxIdx).toBeLessThan(returnItemsIdx)
  })

  it('expense_categories comes before expenses (FK dependency)', () => {
    const files = getMigrationFiles()
    const catIdx = files.findIndex((f) => f.includes('create_expense_categories'))
    const expIdx = files.findIndex((f) => f.includes('create_expenses'))
    expect(catIdx).toBeLessThan(expIdx)
  })

  it('users comes before shifts (FK dependency)', () => {
    const files = getMigrationFiles()
    const usersIdx = files.findIndex((f) => f.includes('create_users'))
    const shiftsIdx = files.findIndex((f) => f.includes('create_shifts'))
    expect(usersIdx).toBeLessThan(shiftsIdx)
  })

  it('users comes before z_reports (FK dependency)', () => {
    const files = getMigrationFiles()
    const usersIdx = files.findIndex((f) => f.includes('create_users'))
    const zReportsIdx = files.findIndex((f) => f.includes('create_z_reports'))
    expect(usersIdx).toBeLessThan(zReportsIdx)
  })

  it('users comes before held_transactions (FK dependency)', () => {
    const files = getMigrationFiles()
    const usersIdx = files.findIndex((f) => f.includes('create_users'))
    const heldIdx = files.findIndex((f) => f.includes('create_held_transactions'))
    expect(usersIdx).toBeLessThan(heldIdx)
  })
})

// ─── Table name coverage ─────────────────────────────────────────────────────

describe('Migration files — table coverage', () => {
  const EXPECTED_TABLES = [
    'roles',
    'users',
    'categories',
    'brands',
    'units_of_measure',
    'products',
    'product_batches',
    'suppliers',
    'stock_receipts',
    'stock_receipt_items',
    'stock_adjustments',
    'customers',
    'transactions',
    'transaction_items',
    'transaction_payments',
    'credit_payments',
    'return_transactions',
    'return_items',
    'expense_categories',
    'expenses',
    'shifts',
    'z_reports',
    'held_transactions',
    'audit_logs',
    'settings',
    'branches',
  ]

  it.each(EXPECTED_TABLES)('a migration file exists for table "%s"', (tableName) => {
    const files = getMigrationFiles()
    const match = files.some((f) => f.includes(`create_${tableName}`))
    expect(match).toBe(true)
  })
})
