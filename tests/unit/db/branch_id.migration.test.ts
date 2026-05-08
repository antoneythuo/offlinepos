import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'path'
import { existsSync } from 'fs'

// ─── Path to the migration file ───────────────────────────────────────────────

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../src/db/migrations/20240101000027_add_branch_id.ts'
)

// ─── Mock schema builder ──────────────────────────────────────────────────────

/**
 * Builds a mock Knex instance that captures `alterTable` calls (table name +
 * column definitions) without touching a real database.
 */
function buildMockKnex() {
  // Captured state per table
  const alterations: Array<{
    tableName: string
    columns: Array<{ method: string; args: unknown[] }>
    droppedForeignKeys: string[][]
    droppedColumns: string[]
  }> = []

  // Column builder — each method returns `this` for chaining
  function makeColumnBuilder(method: string, args: unknown[], tableCapture: (typeof alterations)[0]) {
    tableCapture.columns.push({ method, args })
    const col: Record<string, unknown> = {}
    const chainable = [
      'unsigned',
      'notNullable',
      'nullable',
      'defaultTo',
      'unique',
      'references',
      'inTable',
    ]
    for (const m of chainable) {
      col[m] = vi.fn(() => col)
    }
    return col
  }

  // Schema builder
  const schemaBuilder = {
    alterTable: vi.fn(
      (tableName: string, callback: (table: Record<string, unknown>) => void) => {
        const tableCapture = {
          tableName,
          columns: [] as Array<{ method: string; args: unknown[] }>,
          droppedForeignKeys: [] as string[][],
          droppedColumns: [] as string[],
        }
        alterations.push(tableCapture)

        const tableBuilder: Record<string, unknown> = {
          integer: vi.fn((...args: unknown[]) => makeColumnBuilder('integer', args, tableCapture)),
          dropForeign: vi.fn((cols: string[]) => {
            tableCapture.droppedForeignKeys.push(cols)
          }),
          dropColumn: vi.fn((col: string) => {
            tableCapture.droppedColumns.push(col)
          }),
        }

        callback(tableBuilder)
        return Promise.resolve()
      }
    ),
  }

  const knex = {
    schema: schemaBuilder,
    fn: { now: vi.fn(() => 'CURRENT_TIMESTAMP') },
  } as unknown as import('knex').Knex

  return { knex, alterations }
}

// ─── File existence ───────────────────────────────────────────────────────────

describe('branch_id migration — file', () => {
  it('migration file 20240101000027_add_branch_id.ts exists on disk', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
  })
})

// ─── Export shape ─────────────────────────────────────────────────────────────

describe('branch_id migration — exports', () => {
  it('exports an `up` function', async () => {
    const mod = await import(MIGRATION_PATH)
    expect(typeof mod.up).toBe('function')
  })

  it('exports a `down` function', async () => {
    const mod = await import(MIGRATION_PATH)
    expect(typeof mod.down).toBe('function')
  })
})

// ─── up() — column additions ──────────────────────────────────────────────────

describe('branch_id migration — up()', () => {
  it('alters exactly 3 tables: transactions, users, products', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    const tableNames = alterations.map((a) => a.tableName)
    expect(tableNames).toContain('transactions')
    expect(tableNames).toContain('users')
    expect(tableNames).toContain('products')
    expect(tableNames).toHaveLength(3)
  })

  it('adds an integer column named "branch_id" to the transactions table', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    const txAlteration = alterations.find((a) => a.tableName === 'transactions')!
    expect(txAlteration).toBeDefined()
    const branchCol = txAlteration.columns.find(
      (c) => c.method === 'integer' && c.args[0] === 'branch_id'
    )
    expect(branchCol).toBeDefined()
  })

  it('adds an integer column named "branch_id" to the users table', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    const usersAlteration = alterations.find((a) => a.tableName === 'users')!
    expect(usersAlteration).toBeDefined()
    const branchCol = usersAlteration.columns.find(
      (c) => c.method === 'integer' && c.args[0] === 'branch_id'
    )
    expect(branchCol).toBeDefined()
  })

  it('adds an integer column named "branch_id" to the products table', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    const productsAlteration = alterations.find((a) => a.tableName === 'products')!
    expect(productsAlteration).toBeDefined()
    const branchCol = productsAlteration.columns.find(
      (c) => c.method === 'integer' && c.args[0] === 'branch_id'
    )
    expect(branchCol).toBeDefined()
  })

  it('calls alterTable for each of the 3 tables', async () => {
    const { knex } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    expect(knex.schema.alterTable).toHaveBeenCalledTimes(3)
  })
})

// ─── down() — column removal ──────────────────────────────────────────────────

describe('branch_id migration — down()', () => {
  it('alters exactly 3 tables in down()', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.down(knex)

    const tableNames = alterations.map((a) => a.tableName)
    expect(tableNames).toContain('transactions')
    expect(tableNames).toContain('users')
    expect(tableNames).toContain('products')
    expect(tableNames).toHaveLength(3)
  })

  it('drops the branch_id foreign key from the transactions table', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.down(knex)

    const txAlteration = alterations.find((a) => a.tableName === 'transactions')!
    expect(txAlteration.droppedForeignKeys).toContainEqual(['branch_id'])
  })

  it('drops the branch_id column from the transactions table', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.down(knex)

    const txAlteration = alterations.find((a) => a.tableName === 'transactions')!
    expect(txAlteration.droppedColumns).toContain('branch_id')
  })

  it('drops the branch_id foreign key from the users table', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.down(knex)

    const usersAlteration = alterations.find((a) => a.tableName === 'users')!
    expect(usersAlteration.droppedForeignKeys).toContainEqual(['branch_id'])
  })

  it('drops the branch_id column from the users table', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.down(knex)

    const usersAlteration = alterations.find((a) => a.tableName === 'users')!
    expect(usersAlteration.droppedColumns).toContain('branch_id')
  })

  it('drops the branch_id foreign key from the products table', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.down(knex)

    const productsAlteration = alterations.find((a) => a.tableName === 'products')!
    expect(productsAlteration.droppedForeignKeys).toContainEqual(['branch_id'])
  })

  it('drops the branch_id column from the products table', async () => {
    const { knex, alterations } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.down(knex)

    const productsAlteration = alterations.find((a) => a.tableName === 'products')!
    expect(productsAlteration.droppedColumns).toContain('branch_id')
  })
})
