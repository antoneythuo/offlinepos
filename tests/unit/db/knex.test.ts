import { describe, it, expect } from 'vitest'
import { loadDbConfig, DEFAULT_DB_CONFIG, type FsAdapter } from '../../../src/db/knex'

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build a fake FsAdapter that returns the given JSON content. */
function makeFsAdapter(content: string): FsAdapter {
  return {
    existsSync: () => true,
    readFileSync: () => content
  }
}

/** Build a fake FsAdapter that reports the file as missing. */
function missingFsAdapter(): FsAdapter {
  return {
    existsSync: () => false,
    readFileSync: () => { throw new Error('file not found') }
  }
}

// ─── loadDbConfig ────────────────────────────────────────────────────────────

describe('loadDbConfig', () => {
  it('returns default config when config.json does not exist', () => {
    const config = loadDbConfig('/nonexistent/config.json', missingFsAdapter())

    expect(config).toEqual(DEFAULT_DB_CONFIG)
  })

  it('reads host, port, user, password, and database from config.json', () => {
    const mockConfig = {
      database: {
        host: '192.168.1.10',
        port: 3307,
        user: 'shop_user',
        password: 'secret123',
        database: 'shop_db'
      }
    }

    const config = loadDbConfig('/fake/config.json', makeFsAdapter(JSON.stringify(mockConfig)))

    expect(config.host).toBe('192.168.1.10')
    expect(config.port).toBe(3307)
    expect(config.user).toBe('shop_user')
    expect(config.password).toBe('secret123')
    expect(config.database).toBe('shop_db')
  })

  it('merges partial config with defaults when some keys are missing', () => {
    const partialConfig = {
      database: {
        host: '10.0.0.5',
        database: 'custom_db'
        // port, user, password intentionally omitted
      }
    }

    const config = loadDbConfig('/fake/config.json', makeFsAdapter(JSON.stringify(partialConfig)))

    expect(config.host).toBe('10.0.0.5')
    expect(config.database).toBe('custom_db')
    // Defaults fill in the rest
    expect(config.port).toBe(3306)
    expect(config.user).toBe('pos_user')
    expect(config.password).toBe('pos_password')
  })

  it('falls back to defaults when config.json contains invalid JSON', () => {
    const config = loadDbConfig('/fake/config.json', makeFsAdapter('{ this is not valid json }'))

    expect(config).toEqual(DEFAULT_DB_CONFIG)
  })

  it('falls back to defaults when config.json is missing the "database" key', () => {
    const badConfig = { someOtherKey: {} }

    const config = loadDbConfig('/fake/config.json', makeFsAdapter(JSON.stringify(badConfig)))

    expect(config).toEqual(DEFAULT_DB_CONFIG)
  })

  it('accepts an explicit configPath and reads from that path', () => {
    const customPath = '/custom/path/config.json'
    const mockConfig = {
      database: {
        host: 'db.local',
        port: 3308,
        user: 'admin',
        password: 'adminpass',
        database: 'prod_db'
      }
    }

    // Adapter only "exists" for the custom path
    const adapter: FsAdapter = {
      existsSync: (p) => p === customPath,
      readFileSync: () => JSON.stringify(mockConfig)
    }

    const config = loadDbConfig(customPath, adapter)

    expect(config.host).toBe('db.local')
    expect(config.port).toBe(3308)
    expect(config.database).toBe('prod_db')
  })

  it('returns defaults when the path does not match the custom path', () => {
    const customPath = '/custom/path/config.json'
    const adapter: FsAdapter = {
      existsSync: (p) => p === customPath,
      readFileSync: () => '{}'
    }

    // Pass a different path — adapter reports it as missing
    const config = loadDbConfig('/other/path/config.json', adapter)

    expect(config).toEqual(DEFAULT_DB_CONFIG)
  })
})

// ─── knex instance ───────────────────────────────────────────────────────────

describe('knex instance configuration', () => {
  it('exports a Knex instance as the default export', async () => {
    const mod = await import('../../../src/db/knex')
    const knexInstance = mod.default

    expect(knexInstance).toBeDefined()
    // Knex instances are callable functions
    expect(typeof knexInstance).toBe('function')
    // The underlying client config should reference mysql2
    expect((knexInstance as any).client?.config?.client).toBe('mysql2')
  })

  it('configures connection pool with min=2 and max=10', async () => {
    const mod = await import('../../../src/db/knex')
    const knexInstance = mod.default
    const poolConfig = (knexInstance as any).client?.config?.pool

    expect(poolConfig?.min).toBe(2)
    expect(poolConfig?.max).toBe(10)
  })
})
