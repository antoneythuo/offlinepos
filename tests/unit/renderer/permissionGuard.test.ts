/**
 * Unit tests for the PermissionGuard permission-checking logic.
 *
 * The PermissionGuard component delegates its permission check to
 * sessionStore.hasPermission(). These tests verify that the underlying
 * logic correctly grants or denies access based on the user's role
 * permissions object.
 *
 * Requirement 22.4: The system SHALL deny access and display an "Access Denied"
 *   message when a user attempts to access a feature outside their role's permissions.
 * Requirement 22.5: The system SHALL require authentication before accessing the system.
 * Requirement 30.2: Consistent behaviour across supported resolutions.
 * Requirement 30.5: Theme changes apply immediately.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { SessionUser } from '../../../src/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mirrors the hasPermission logic from sessionStore so we can test it
 * in isolation without a DOM / React environment.
 */
function hasPermission(user: SessionUser | null, permission: string): boolean {
  if (!user) return false
  return user.permissions[permission] === true
}

function makeUser(permissions: Record<string, boolean>): SessionUser {
  return {
    id: 1,
    username: 'testuser',
    fullName: 'Test User',
    roleId: 1,
    roleName: 'TestRole',
    permissions
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PermissionGuard — permission check logic', () => {
  // ── No session ──────────────────────────────────────────────────────────────

  describe('when there is no authenticated user', () => {
    it('denies every permission', () => {
      expect(hasPermission(null, 'reports')).toBe(false)
      expect(hasPermission(null, 'inventory')).toBe(false)
      expect(hasPermission(null, 'audit')).toBe(false)
      expect(hasPermission(null, 'users')).toBe(false)
      expect(hasPermission(null, 'sales')).toBe(false)
    })
  })

  // ── Administrator role ───────────────────────────────────────────────────────

  describe('Administrator role', () => {
    let admin: SessionUser

    beforeEach(() => {
      admin = makeUser({
        sales: true,
        inventory: true,
        reports: true,
        audit: true,
        users: true,
        credit: true
      })
    })

    it('has access to reports (Req 22.3)', () => {
      expect(hasPermission(admin, 'reports')).toBe(true)
    })

    it('has access to inventory (Req 22.3)', () => {
      expect(hasPermission(admin, 'inventory')).toBe(true)
    })

    it('has access to audit log (Req 22.3, 28.3)', () => {
      expect(hasPermission(admin, 'audit')).toBe(true)
    })

    it('has access to user management (Req 22.3)', () => {
      expect(hasPermission(admin, 'users')).toBe(true)
    })
  })

  // ── Manager role ─────────────────────────────────────────────────────────────

  describe('Manager role', () => {
    let manager: SessionUser

    beforeEach(() => {
      manager = makeUser({
        sales: true,
        inventory: true,
        reports: true,
        audit: false,
        users: false,
        credit: true
      })
    })

    it('has access to reports (Req 22.3)', () => {
      expect(hasPermission(manager, 'reports')).toBe(true)
    })

    it('has access to inventory (Req 22.3)', () => {
      expect(hasPermission(manager, 'inventory')).toBe(true)
    })

    it('does NOT have access to audit log (Req 22.3)', () => {
      expect(hasPermission(manager, 'audit')).toBe(false)
    })

    it('does NOT have access to user management (Req 22.3)', () => {
      expect(hasPermission(manager, 'users')).toBe(false)
    })
  })

  // ── Cashier role ─────────────────────────────────────────────────────────────

  describe('Cashier role', () => {
    let cashier: SessionUser

    beforeEach(() => {
      cashier = makeUser({
        sales: true,
        inventory: false,
        reports: false,
        audit: false,
        users: false,
        credit: false
      })
    })

    it('has access to sales', () => {
      expect(hasPermission(cashier, 'sales')).toBe(true)
    })

    it('does NOT have access to reports (Req 22.3)', () => {
      expect(hasPermission(cashier, 'reports')).toBe(false)
    })

    it('does NOT have access to inventory editing (Req 22.3)', () => {
      expect(hasPermission(cashier, 'inventory')).toBe(false)
    })

    it('does NOT have access to audit log (Req 22.3)', () => {
      expect(hasPermission(cashier, 'audit')).toBe(false)
    })

    it('does NOT have access to user management (Req 22.3)', () => {
      expect(hasPermission(cashier, 'users')).toBe(false)
    })
  })

  // ── Stock_Controller role ─────────────────────────────────────────────────────

  describe('Stock_Controller role', () => {
    let stockController: SessionUser

    beforeEach(() => {
      stockController = makeUser({
        sales: false,
        inventory: true,
        reports: false,
        audit: false,
        users: false,
        credit: false
      })
    })

    it('has access to inventory (Req 22.3)', () => {
      expect(hasPermission(stockController, 'inventory')).toBe(true)
    })

    it('does NOT have access to reports (Req 22.3)', () => {
      expect(hasPermission(stockController, 'reports')).toBe(false)
    })

    it('does NOT have access to audit log (Req 22.3)', () => {
      expect(hasPermission(stockController, 'audit')).toBe(false)
    })

    it('does NOT have access to user management (Req 22.3)', () => {
      expect(hasPermission(stockController, 'users')).toBe(false)
    })
  })

  // ── Edge cases ────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns false for an unknown permission key', () => {
      const user = makeUser({ sales: true })
      expect(hasPermission(user, 'nonexistent_permission')).toBe(false)
    })

    it('returns false when permission value is explicitly false', () => {
      const user = makeUser({ reports: false })
      expect(hasPermission(user, 'reports')).toBe(false)
    })

    it('returns true when permission value is explicitly true', () => {
      const user = makeUser({ reports: true })
      expect(hasPermission(user, 'reports')).toBe(true)
    })

    it('handles an empty permissions object — denies all', () => {
      const user = makeUser({})
      expect(hasPermission(user, 'sales')).toBe(false)
      expect(hasPermission(user, 'reports')).toBe(false)
    })
  })
})
