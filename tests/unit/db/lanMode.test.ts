// Unit tests for LAN mode connection config — Task 32.1
// Validates that getLanAwareDbConfig correctly reads connection_mode from the
// settings table and overrides host/port when mode is 'lan'.
// Requirements: 32.1

import { describe, it, expect, vi } from 'vitest'
import { getLanAwareDbConfig, DEFAULT_DB_CONFIG, type DbConfig } from '../../../src/db/knex'
import type Knex from 'knex'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock Knex instance that returns the given settings rows
 * when queried against the `settings` table.
 */
function buildMockKnex(settingsRows: Array<{ key_name: string; value: string }>): Knex.Knex {
  const builder = {
    whereIn: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(settingsRows),
  }

  const knex = vi.fn((_tableName: string) => builder) as unknown as Knex.Knex
  return knex
}

/** Build a mock Knex that throws when queried (simulates missing settings table). */
function buildFailingKnex(): Knex.Knex {
  const builder = {
    whereIn: vi.fn().mockReturnThis(),
    select: vi.fn().mockRejectedValue(new Error("Table 'settings' doesn't exist")),
  }

  const knex = vi.fn((_tableName: string) => builder) as unknown as Knex.Knex
  return knex
}

const BASE_CONFIG: DbConfig = { ...DEFAULT_DB_CONFIG }

// ─── getLanAwareDbConfig ──────────────────────────────────────────────────────

describe('getLanAwareDbConfig', () => {
  it('returns base config unchanged when connection_mode is "local"', async () => {
    const knex = buildMockKnex([
      { key_name: 'connection_mode', value: 'local' },
      { key_name: 'lan_host', value: '192.168.1.50' },
      { key_name: 'lan_port', value: '3307' },
    ])

    const result = await getLanAwareDbConfig(BASE_CONFIG, knex)

    expect(result.host).toBe(BASE_CONFIG.host)
    expect(result.port).toBe(BASE_CONFIG.port)
    expect(result.user).toBe(BASE_CONFIG.user)
    expect(result.database).toBe(BASE_CONFIG.database)
  })

  it('returns base config unchanged when connection_mode is absent', async () => {
    const knex = buildMockKnex([]) // no settings rows

    const result = await getLanAwareDbConfig(BASE_CONFIG, knex)

    expect(result.host).toBe(BASE_CONFIG.host)
    expect(result.port).toBe(BASE_CONFIG.port)
  })

  it('overrides host and port when connection_mode is "lan"', async () => {
    const knex = buildMockKnex([
      { key_name: 'connection_mode', value: 'lan' },
      { key_name: 'lan_host', value: '192.168.1.100' },
      { key_name: 'lan_port', value: '3307' },
    ])

    const result = await getLanAwareDbConfig(BASE_CONFIG, knex)

    expect(result.host).toBe('192.168.1.100')
    expect(result.port).toBe(3307)
  })

  it('preserves user, password, and database from base config in LAN mode', async () => {
    const knex = buildMockKnex([
      { key_name: 'connection_mode', value: 'lan' },
      { key_name: 'lan_host', value: '10.0.0.5' },
      { key_name: 'lan_port', value: '3306' },
    ])

    const result = await getLanAwareDbConfig(BASE_CONFIG, knex)

    expect(result.user).toBe(BASE_CONFIG.user)
    expect(result.password).toBe(BASE_CONFIG.password)
    expect(result.database).toBe(BASE_CONFIG.database)
  })

  it('falls back to base config when LAN mode is set but lan_host is missing', async () => {
    const knex = buildMockKnex([
      { key_name: 'connection_mode', value: 'lan' },
      // lan_host intentionally absent
      { key_name: 'lan_port', value: '3307' },
    ])

    const result = await getLanAwareDbConfig(BASE_CONFIG, knex)

    // Should fall back to base config host
    expect(result.host).toBe(BASE_CONFIG.host)
  })

  it('uses port 3306 when LAN mode is set but lan_port is invalid', async () => {
    const knex = buildMockKnex([
      { key_name: 'connection_mode', value: 'lan' },
      { key_name: 'lan_host', value: '192.168.1.200' },
      { key_name: 'lan_port', value: 'not-a-number' },
    ])

    const result = await getLanAwareDbConfig(BASE_CONFIG, knex)

    expect(result.host).toBe('192.168.1.200')
    expect(result.port).toBe(3306)
  })

  it('falls back to base config when the settings table query throws', async () => {
    const knex = buildFailingKnex()

    const result = await getLanAwareDbConfig(BASE_CONFIG, knex)

    expect(result.host).toBe(BASE_CONFIG.host)
    expect(result.port).toBe(BASE_CONFIG.port)
  })

  it('does not mutate the base config object', async () => {
    const baseConfigCopy = { ...BASE_CONFIG }
    const knex = buildMockKnex([
      { key_name: 'connection_mode', value: 'lan' },
      { key_name: 'lan_host', value: '10.10.10.10' },
      { key_name: 'lan_port', value: '3308' },
    ])

    await getLanAwareDbConfig(BASE_CONFIG, knex)

    // Original base config must be unchanged
    expect(BASE_CONFIG.host).toBe(baseConfigCopy.host)
    expect(BASE_CONFIG.port).toBe(baseConfigCopy.port)
  })
})
