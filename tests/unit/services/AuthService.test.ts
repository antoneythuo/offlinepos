import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import type { Knex } from 'knex'
import { AuthService } from '../../../src/services/AuthService'
import { AuthenticationError } from '../../../src/errors'

// ─── Mock Knex builder ────────────────────────────────────────────────────────

/**
 * Builds a minimal mock Knex instance whose query chain resolves to the
 * provided `row` value (or `undefined` to simulate "not found").
 *
 * The chain we need to mock:
 *   db('users').join(...).where(...).select(...).first()
 */
function makeMockKnex(row: Record<string, unknown> | undefined): Knex {
  const queryBuilder = {
    join: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(row),
  }

  const mockKnex = vi.fn().mockReturnValue(queryBuilder) as unknown as Knex
  return mockKnex
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const PLAIN_PIN = '1234'

async function makeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  const pin_hash = await bcrypt.hash(PLAIN_PIN, 10)
  return {
    id: 1,
    username: 'admin',
    full_name: 'System Administrator',
    pin_hash,
    is_active: 1,                          // MySQL returns 1 for TRUE
    role_id: 1,
    role_name: 'Administrator',
    permissions: JSON.stringify({          // JSON string as returned by mysql2
      sales: true,
      inventory: true,
      reports: true,
      user_management: true,
    }),
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService.login', () => {
  let userRow: Record<string, unknown>

  beforeEach(async () => {
    userRow = await makeUserRow()
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns a SessionUser when credentials are valid', async () => {
    const service = new AuthService(makeMockKnex(userRow))
    const session = await service.login('admin', PLAIN_PIN)

    expect(session).toMatchObject({
      id: 1,
      username: 'admin',
      fullName: 'System Administrator',
      roleId: 1,
      roleName: 'Administrator',
    })
  })

  it('parses permissions from a JSON string into a Record<string, boolean>', async () => {
    const service = new AuthService(makeMockKnex(userRow))
    const session = await service.login('admin', PLAIN_PIN)

    expect(session.permissions).toEqual({
      sales: true,
      inventory: true,
      reports: true,
      user_management: true,
    })
  })

  it('handles permissions already parsed as an object (mysql2 auto-parse)', async () => {
    // Some mysql2 versions auto-parse JSON columns into objects
    const rowWithParsedPermissions = await makeUserRow({
      permissions: { sales: true, reports: false },
    })
    const service = new AuthService(makeMockKnex(rowWithParsedPermissions))
    const session = await service.login('admin', PLAIN_PIN)

    expect(session.permissions).toEqual({ sales: true, reports: false })
  })

  // ── Unknown username ────────────────────────────────────────────────────────

  it('throws AuthenticationError when username is not found', async () => {
    const service = new AuthService(makeMockKnex(undefined))

    await expect(service.login('unknown', PLAIN_PIN)).rejects.toThrow(AuthenticationError)
  })

  it('throws AuthenticationError with a generic message for unknown username (no info leak)', async () => {
    const service = new AuthService(makeMockKnex(undefined))

    await expect(service.login('unknown', PLAIN_PIN)).rejects.toThrow(
      'Invalid username or PIN'
    )
  })

  // ── Wrong PIN ───────────────────────────────────────────────────────────────

  it('throws AuthenticationError when PIN does not match', async () => {
    const service = new AuthService(makeMockKnex(userRow))

    await expect(service.login('admin', 'wrong')).rejects.toThrow(AuthenticationError)
  })

  it('throws AuthenticationError with a generic message for wrong PIN (no info leak)', async () => {
    const service = new AuthService(makeMockKnex(userRow))

    await expect(service.login('admin', 'wrong')).rejects.toThrow(
      'Invalid username or PIN'
    )
  })

  // ── Inactive user ───────────────────────────────────────────────────────────

  it('throws AuthenticationError when user account is inactive (is_active = 0)', async () => {
    const inactiveRow = await makeUserRow({ is_active: 0 })
    const service = new AuthService(makeMockKnex(inactiveRow))

    await expect(service.login('admin', PLAIN_PIN)).rejects.toThrow(AuthenticationError)
  })

  it('throws AuthenticationError with "inactive" message for inactive user', async () => {
    const inactiveRow = await makeUserRow({ is_active: 0 })
    const service = new AuthService(makeMockKnex(inactiveRow))

    await expect(service.login('admin', PLAIN_PIN)).rejects.toThrow(
      'User account is inactive'
    )
  })

  it('throws AuthenticationError when is_active is boolean false', async () => {
    const inactiveRow = await makeUserRow({ is_active: false })
    const service = new AuthService(makeMockKnex(inactiveRow))

    await expect(service.login('admin', PLAIN_PIN)).rejects.toThrow(AuthenticationError)
  })

  // ── Error code ──────────────────────────────────────────────────────────────

  it('AuthenticationError carries code AUTH_FAILED', async () => {
    const service = new AuthService(makeMockKnex(undefined))

    try {
      await service.login('nobody', '0000')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthenticationError)
      expect((err as AuthenticationError).code).toBe('AUTH_FAILED')
    }
  })

  // ── SessionUser shape ───────────────────────────────────────────────────────

  it('returned SessionUser contains all required fields', async () => {
    const service = new AuthService(makeMockKnex(userRow))
    const session = await service.login('admin', PLAIN_PIN)

    expect(session).toHaveProperty('id')
    expect(session).toHaveProperty('username')
    expect(session).toHaveProperty('fullName')
    expect(session).toHaveProperty('roleId')
    expect(session).toHaveProperty('roleName')
    expect(session).toHaveProperty('permissions')
    expect(typeof session.permissions).toBe('object')
  })
})
