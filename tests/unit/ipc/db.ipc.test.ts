/**
 * Unit tests for the db:ping IPC handler logic.
 *
 * We test `pingDatabase` directly — without going through Electron's ipcMain —
 * by injecting a mock Knex instance.  This keeps tests fast and dependency-free
 * while validating the exact behaviour described in Task 32.2.
 *
 * Requirements: 32.2
 */

import { describe, it, expect, vi } from 'vitest'
import { pingDatabase } from '../../../electron/ipc/db.ipc'

// ─── Mock Knex factory ────────────────────────────────────────────────────────

function makeDb(shouldResolve: boolean, resolveValue: unknown = [[{ 1: 1 }], []]) {
  return {
    raw: shouldResolve
      ? vi.fn().mockResolvedValue(resolveValue)
      : vi.fn().mockRejectedValue(new Error('Connection refused')),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('pingDatabase', () => {
  it('returns { ok: true } when SELECT 1 succeeds', async () => {
    const db = makeDb(true)
    const result = await pingDatabase(db)
    expect(result).toEqual({ ok: true })
  })

  it('calls db.raw with "SELECT 1"', async () => {
    const db = makeDb(true)
    await pingDatabase(db)
    expect(db.raw).toHaveBeenCalledOnce()
    expect(db.raw).toHaveBeenCalledWith('SELECT 1')
  })

  it('returns { ok: false } when the query throws a connection error', async () => {
    const db = makeDb(false)
    const result = await pingDatabase(db)
    expect(result).toEqual({ ok: false })
  })

  it('returns { ok: false } when the query throws a generic error', async () => {
    const db = {
      raw: vi.fn().mockRejectedValue(new Error('Unknown error')),
    }
    const result = await pingDatabase(db)
    expect(result).toEqual({ ok: false })
  })

  it('does not throw — always resolves to { ok: boolean }', async () => {
    const db = makeDb(false)
    await expect(pingDatabase(db)).resolves.toMatchObject({ ok: false })
  })

  it('returns { ok: true } regardless of the raw query return value shape', async () => {
    // MySQL2 returns a two-element array; we only care that it resolves
    const db = makeDb(true, [[{ 1: 1 }], []])
    const result = await pingDatabase(db)
    expect(result.ok).toBe(true)
  })
})
