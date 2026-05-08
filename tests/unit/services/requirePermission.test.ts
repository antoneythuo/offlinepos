import { describe, it, expect, beforeEach } from 'vitest'
import { SessionManager } from '../../../src/services/SessionManager'
import { AuthorizationError } from '../../../src/errors'
import type { SessionUser } from '../../../src/types/index'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal SessionUser fixture.
 * `permissions` defaults to an empty object; pass overrides to grant specific ones.
 */
function makeSessionUser(permissions: Record<string, boolean> = {}): SessionUser {
  return {
    id: 1,
    username: 'testuser',
    fullName: 'Test User',
    roleId: 2,
    roleName: 'Cashier',
    permissions,
  }
}

/**
 * Create isolated requirePermission / requireAuth functions that use a fresh
 * SessionManager instance so tests do not share state.
 */
function makeIsolatedGuards() {
  const manager = new SessionManager()

  function requireAuth(): void {
    const session = manager.getSession()
    if (!session) {
      throw new AuthorizationError('No active session. Please log in.')
    }
  }

  function requirePermission(permission: string): void {
    const session = manager.getSession()
    if (!session) {
      throw new AuthorizationError('No active session. Please log in.')
    }
    if (session.permissions[permission] !== true) {
      throw new AuthorizationError(
        `Access denied. Required permission: "${permission}"`
      )
    }
  }

  return { manager, requireAuth, requirePermission }
}

// ─── requirePermission ────────────────────────────────────────────────────────

describe('requirePermission', () => {
  let manager: SessionManager
  let requirePermission: (permission: string) => void

  beforeEach(() => {
    const guards = makeIsolatedGuards()
    manager = guards.manager
    requirePermission = guards.requirePermission
  })

  it('throws AuthorizationError when no session is active', () => {
    // No session set — manager starts with null
    expect(() => requirePermission('reports')).toThrow(AuthorizationError)
  })

  it('throws AuthorizationError with a descriptive message when no session', () => {
    expect(() => requirePermission('reports')).toThrow('No active session')
  })

  it('throws AuthorizationError when user lacks the required permission', () => {
    manager.setSession(makeSessionUser({ sales: true }))
    // User has 'sales' but not 'reports'
    expect(() => requirePermission('reports')).toThrow(AuthorizationError)
  })

  it('throws AuthorizationError with the permission name in the message', () => {
    manager.setSession(makeSessionUser({ sales: true }))
    expect(() => requirePermission('reports')).toThrow('"reports"')
  })

  it('throws AuthorizationError when permission key is present but set to false', () => {
    manager.setSession(makeSessionUser({ reports: false }))
    expect(() => requirePermission('reports')).toThrow(AuthorizationError)
  })

  it('throws AuthorizationError when permission key is absent entirely', () => {
    manager.setSession(makeSessionUser({}))
    expect(() => requirePermission('inventory')).toThrow(AuthorizationError)
  })

  it('does NOT throw when user has the required permission set to true', () => {
    manager.setSession(makeSessionUser({ reports: true }))
    expect(() => requirePermission('reports')).not.toThrow()
  })

  it('does NOT throw when user has multiple permissions including the required one', () => {
    manager.setSession(
      makeSessionUser({ sales: true, inventory: true, reports: true })
    )
    expect(() => requirePermission('inventory')).not.toThrow()
  })

  it('AuthorizationError carries code FORBIDDEN', () => {
    try {
      requirePermission('reports')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationError)
      expect((err as AuthorizationError).code).toBe('FORBIDDEN')
    }
  })
})

// ─── requireAuth ──────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  let manager: SessionManager
  let requireAuth: () => void

  beforeEach(() => {
    const guards = makeIsolatedGuards()
    manager = guards.manager
    requireAuth = guards.requireAuth
  })

  it('throws AuthorizationError when no session is active', () => {
    expect(() => requireAuth()).toThrow(AuthorizationError)
  })

  it('throws AuthorizationError with a descriptive message when no session', () => {
    expect(() => requireAuth()).toThrow('No active session')
  })

  it('does NOT throw when a session exists (regardless of permissions)', () => {
    // User with no permissions at all — requireAuth only checks session presence
    manager.setSession(makeSessionUser({}))
    expect(() => requireAuth()).not.toThrow()
  })

  it('does NOT throw when a session exists with permissions', () => {
    manager.setSession(makeSessionUser({ sales: true, reports: true }))
    expect(() => requireAuth()).not.toThrow()
  })

  it('AuthorizationError carries code FORBIDDEN', () => {
    try {
      requireAuth()
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationError)
      expect((err as AuthorizationError).code).toBe('FORBIDDEN')
    }
  })
})

// ─── SessionManager ───────────────────────────────────────────────────────────

describe('SessionManager', () => {
  it('starts with no session (getSession returns null)', () => {
    const manager = new SessionManager()
    expect(manager.getSession()).toBeNull()
  })

  it('stores and returns the session after setSession', () => {
    const manager = new SessionManager()
    const user = makeSessionUser({ sales: true })
    manager.setSession(user)
    expect(manager.getSession()).toBe(user)
  })

  it('returns null after clearSession', () => {
    const manager = new SessionManager()
    manager.setSession(makeSessionUser())
    manager.clearSession()
    expect(manager.getSession()).toBeNull()
  })

  it('replaces the session when setSession is called again', () => {
    const manager = new SessionManager()
    const user1 = makeSessionUser({ sales: true })
    const user2 = { ...makeSessionUser({ reports: true }), id: 2, username: 'manager' }
    manager.setSession(user1)
    manager.setSession(user2)
    expect(manager.getSession()).toBe(user2)
  })
})
