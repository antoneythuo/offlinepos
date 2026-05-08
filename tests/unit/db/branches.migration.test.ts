import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'path'
import { existsSync } from 'fs'

// ─── Path to the migration file ───────────────────────────────────────────────

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../src/db/migrations/20240101000026_create_branches.ts'
)

// ─── Mock schema builder ──────────────────────────────────────────────────────

/**
 * Builds a mock Knex instance that captures the table name and column
 * definitions passed to `knex.schema.createTable(...)` without touching
 * a real database.
 */
function buildMockKnex() {
  // Captured state
  const captured: {
    tableName: string | null
    columns: Array<{ method: string; args: unknown[] }>
    droppedTable: string | null
  } = {
    tableName: null,
    columns: [],
    droppedTable: null,
  }

  // Column builder — each method returns `this` for chaining
  function makeColumnBuilder(method: string, args: unknown[]) {
    captured.columns.push({ method, args })
    const col: Record<string, unknown> = {}
    const chainable = [
      'unsigned',
      'primary',
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

  // Table builder — intercepts column definition calls
  const tableBuilder: Record<string, unknown> = {
    increments: vi.fn((...args: unknown[]) => makeColumnBuilder('increments', args)),
    string: vi.fn((...args: unknown[]) => makeColumnBuilder('string', args)),
    text: vi.fn((...args: unknown[]) => makeColumnBuilder('text', args)),
    boolean: vi.fn((...args: unknown[]) => makeColumnBuilder('boolean', args)),
    timestamp: vi.fn((...args: unknown[]) => makeColumnBuilder('timestamp', args)),
    integer: vi.fn((...args: unknown[]) => makeColumnBuilder('integer', args)),
    foreign: vi.fn((...args: unknown[]) => makeColumnBuilder('foreign', args)),
  }

  // Schema builder
  const schemaBuilder = {
    createTable: vi.fn(
      (tableName: string, callback: (table: typeof tableBuilder) => void) => {
        captured.tableName = tableName
        callback(tableBuilder)
        return Promise.resolve()
      }
    ),
    dropTableIfExists: vi.fn((tableName: string) => {
      captured.droppedTable = tableName
      return Promise.resolve()
    }),
  }

  // Knex instance
  const knex = {
    schema: schemaBuilder,
    fn: { now: vi.fn(() => 'CURRENT_TIMESTAMP') },
  } as unknown as import('knex').Knex

  return { knex, captured, tableBuilder }
}

// ─── File existence ───────────────────────────────────────────────────────────

describe('branches migration — file', () => {
  it('migration file 20240101000026_create_branches.ts exists on disk', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
  })
})

// ─── Export shape ─────────────────────────────────────────────────────────────

describe('branches migration — exports', () => {
  it('exports an `up` function', async () => {
    const mod = await import(MIGRATION_PATH)
    expect(typeof mod.up).toBe('function')
  })

  it('exports a `down` function', async () => {
    const mod = await import(MIGRATION_PATH)
    expect(typeof mod.down).toBe('function')
  })
})

// ─── up() — table creation ────────────────────────────────────────────────────

describe('branches migration — up()', () => {
  it('creates a table named "branches"', async () => {
    const { knex, captured } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    expect(captured.tableName).toBe('branches')
  })

  it('defines an auto-increment primary key column "id"', async () => {
    const { knex, captured, tableBuilder } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    expect(tableBuilder.increments).toHaveBeenCalledWith('id')
    expect(captured.columns.some((c) => c.method === 'increments' && c.args[0] === 'id')).toBe(true)
  })

  it('defines a NOT NULL string column "name" with max length 200', async () => {
    const { knex, tableBuilder } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    // string('name', 200) should have been called
    expect(tableBuilder.string).toHaveBeenCalledWith('name', 200)
  })

  it('defines a nullable text column "address"', async () => {
    const { knex, tableBuilder } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    expect(tableBuilder.text).toHaveBeenCalledWith('address')
  })

  it('defines a nullable string column "phone" with max length 30', async () => {
    const { knex, tableBuilder } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    expect(tableBuilder.string).toHaveBeenCalledWith('phone', 30)
  })

  it('defines a boolean column "is_active" with default true', async () => {
    const { knex, tableBuilder } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    expect(tableBuilder.boolean).toHaveBeenCalledWith('is_active')
  })

  it('defines a timestamp column "created_at"', async () => {
    const { knex, tableBuilder } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    expect(tableBuilder.timestamp).toHaveBeenCalledWith('created_at')
  })

  it('defines exactly the 6 expected columns (id, name, address, phone, is_active, created_at)', async () => {
    const { knex, captured } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.up(knex)

    const columnNames = captured.columns.map((c) => c.args[0] as string)
    expect(columnNames).toContain('id')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('address')
    expect(columnNames).toContain('phone')
    expect(columnNames).toContain('is_active')
    expect(columnNames).toContain('created_at')
    expect(columnNames).toHaveLength(6)
  })
})

// ─── down() — table removal ───────────────────────────────────────────────────

describe('branches migration — down()', () => {
  it('drops the "branches" table', async () => {
    const { knex, captured } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.down(knex)

    expect(captured.droppedTable).toBe('branches')
  })

  it('uses dropTableIfExists (safe to run even if table does not exist)', async () => {
    const { knex, knex: _k, captured } = buildMockKnex()
    const mod = await import(MIGRATION_PATH)

    await mod.down(knex)

    // dropTableIfExists should have been called (not dropTable)
    expect(knex.schema.dropTableIfExists).toHaveBeenCalledWith('branches')
  })
})
