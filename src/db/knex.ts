import Knex from 'knex'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

// Shape of the database section inside config.json
export interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

// Shape of the full config.json file
interface AppConfig {
  database: DbConfig
}

// Default values used when config.json is absent or incomplete
export const DEFAULT_DB_CONFIG: DbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'pos_user',
  password: 'pos_password',
  database: 'pos_db'
}

// Injectable fs functions — makes the loader unit-testable without touching
// the real filesystem.
export interface FsAdapter {
  existsSync: (path: string) => boolean
  readFileSync: (path: string, encoding: BufferEncoding) => string
}

const defaultFsAdapter: FsAdapter = { existsSync, readFileSync }

/**
 * Reads database connection settings from `config.json`.
 *
 * @param configPath  Absolute path to the config file.
 *                    Defaults to `<cwd>/config.json`.
 * @param fsAdapter   Injectable fs functions for testing.
 *                    Defaults to the real `fs` module.
 */
export function loadDbConfig(
  configPath?: string,
  fsAdapter: FsAdapter = defaultFsAdapter
): DbConfig {
  const resolvedPath = configPath ?? join(process.cwd(), 'config.json')

  if (!fsAdapter.existsSync(resolvedPath)) {
    return { ...DEFAULT_DB_CONFIG }
  }

  try {
    const raw = fsAdapter.readFileSync(resolvedPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>

    if (!parsed.database || typeof parsed.database !== 'object') {
      console.warn('config.json is missing the "database" key — using defaults')
      return { ...DEFAULT_DB_CONFIG }
    }

    // Merge so that any missing keys fall back to defaults
    return { ...DEFAULT_DB_CONFIG, ...parsed.database }
  } catch (err) {
    console.warn('Failed to parse config.json, using defaults:', err)
    return { ...DEFAULT_DB_CONFIG }
  }
}

/**
 * Builds a Knex instance from the given DbConfig.
 * Extracted so that LAN mode can create a new instance with different host/port.
 */
export function createKnexInstance(config: DbConfig): Knex.Knex {
  // In production (packaged app), migrations/seeds are in extraResources next to the app.
  // In development, they live in src/db/migrations and src/db/seeds.
  const isPackaged = !process.env['ELECTRON_RENDERER_URL'] && require('electron')?.app?.isPackaged
  const migrationsDir = isPackaged
    ? join(process.resourcesPath, 'migrations')
    : join(__dirname, 'migrations')
  const seedsDir = isPackaged
    ? join(process.resourcesPath, 'seeds')
    : join(__dirname, 'seeds')

  return Knex({
    client: 'mysql2',
    connection: {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: 'utf8mb4',
      timezone: '+00:00'
    },
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30_000
    },
    migrations: {
      directory: migrationsDir,
      extension: 'js',
      loadExtensions: ['.js', '.ts']
    },
    seeds: {
      directory: seedsDir,
      extension: 'js',
      loadExtensions: ['.js', '.ts']
    },
    debug: process.env.NODE_ENV === 'development'
  })
}

/**
 * Reads the `connection_mode` setting from the `settings` table (if accessible)
 * and returns a DbConfig that uses the LAN host/port when mode is `lan`.
 *
 * This function is called at application startup (after the initial knex instance
 * is available) to optionally reconfigure the connection for LAN multi-terminal mode.
 *
 * @param baseConfig  The base config loaded from config.json (provides credentials
 *                    and database name — those are never overridden by LAN settings).
 * @param knexInstance  An existing Knex instance used to query the settings table.
 * @returns A DbConfig with host/port replaced by LAN values when mode is `lan`.
 */
export async function getLanAwareDbConfig(
  baseConfig: DbConfig,
  knexInstance: Knex.Knex
): Promise<DbConfig> {
  try {
    const rows = await knexInstance('settings')
      .whereIn('key_name', ['connection_mode', 'lan_host', 'lan_port'])
      .select('key_name', 'value')

    const settingsMap: Record<string, string> = {}
    for (const row of rows) {
      settingsMap[row.key_name as string] = row.value as string
    }

    const mode = settingsMap['connection_mode'] ?? 'local'

    if (mode !== 'lan') {
      // Local mode — use the base config unchanged
      return { ...baseConfig }
    }

    // LAN mode — override host and port from settings
    const lanHost = settingsMap['lan_host']
    const lanPortStr = settingsMap['lan_port']
    const lanPort = lanPortStr ? parseInt(lanPortStr, 10) : baseConfig.port

    if (!lanHost) {
      console.warn('LAN mode enabled but lan_host is not set — falling back to local config')
      return { ...baseConfig }
    }

    if (isNaN(lanPort) || lanPort <= 0) {
      console.warn('LAN mode enabled but lan_port is invalid — using default port 3306')
      return { ...baseConfig, host: lanHost, port: 3306 }
    }

    console.info(`[DB] LAN mode: connecting to ${lanHost}:${lanPort}`)
    return {
      ...baseConfig,
      host: lanHost,
      port: lanPort
    }
  } catch (err) {
    // Settings table may not exist yet (first run before migrations)
    console.warn('Could not read connection_mode from settings — using local config:', err)
    return { ...baseConfig }
  }
}

const dbConfig = loadDbConfig()

const knex = createKnexInstance(dbConfig)

export default knex
