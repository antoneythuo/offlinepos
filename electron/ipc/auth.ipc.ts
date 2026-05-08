// IPC handlers for authentication and user/role management
// Channels: auth:login, auth:logout, auth:roles:list, auth:roles:create,
//           auth:users:list, auth:users:create, auth:users:update, auth:users:deactivate

import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { authService } from '../../src/services/AuthService'
import { sessionManager } from '../../src/services/SessionManager'
import { auditService } from '../../src/services/AuditService'
import knex from '../../src/db/knex'
import bcrypt from 'bcryptjs'
import type { Role, SessionUser, User } from '../../src/types/index'

interface LoginPayload { username: string; pin: string }

export function registerAuthHandlers(): void {

  registerHandler<SessionUser>('auth:login', async (payload) => {
    const { username, pin } = payload as LoginPayload
    const sessionUser = await authService.login(username, pin)
    sessionManager.setSession(sessionUser)
    auditService.log({ userId: sessionUser.id, action: 'user_login', entityType: 'user', entityId: sessionUser.id })
    return sessionUser
  })

  registerHandler<{ success: true }>('auth:logout', async () => {
    const session = sessionManager.getSession()
    if (session) {
      auditService.log({ userId: session.id, action: 'user_logout', entityType: 'user', entityId: session.id })
    }
    sessionManager.clearSession()
    return { success: true }
  })

  // ── Roles ──────────────────────────────────────────────────────────────────

  registerHandler<Role[]>('auth:roles:list', async () => {
    requirePermission('user_management')
    const rows = await knex('roles').select('*').orderBy('name')
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as number,
      name: r.name as string,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions as string) : r.permissions,
      isSystem: Boolean(r.is_system),
      createdAt: r.created_at as string,
    }))
  })

  registerHandler<Role>('auth:roles:create', async (payload) => {
    requirePermission('user_management')
    const { name, permissions } = payload as { name: string; permissions: Record<string, boolean> }
    const trimmed = name.trim()

    const existing = await knex('roles').where('name', trimmed).first()
    if (existing) {
      throw new Error(`A role named "${trimmed}" already exists. Choose a different name.`)
    }

    const [id] = await knex('roles').insert({
      name: trimmed,
      permissions: JSON.stringify(permissions),
      is_system: false,
    })
    const row = await knex('roles').where('id', id).first()
    return {
      id: row.id,
      name: row.name,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      isSystem: false,
      createdAt: row.created_at,
    }
  })

  registerHandler<Role>('auth:roles:update', async (payload) => {
    requirePermission('user_management')
    const { id, name, permissions } = payload as { id: number; name?: string; permissions?: Record<string, boolean> }
    const patch: Record<string, unknown> = {}
    if (name) {
      const trimmed = name.trim()
      const conflict = await knex('roles').where('name', trimmed).whereNot('id', id).first()
      if (conflict) throw new Error(`A role named "${trimmed}" already exists.`)
      patch.name = trimmed
    }
    if (permissions) patch.permissions = JSON.stringify(permissions)
    await knex('roles').where('id', id).update(patch)
    const row = await knex('roles').where('id', id).first()
    return {
      id: row.id,
      name: row.name,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      isSystem: Boolean(row.is_system),
      createdAt: row.created_at,
    }
  })

  // ── Users ──────────────────────────────────────────────────────────────────

  registerHandler<User[]>('auth:users:list', async () => {
    requirePermission('user_management')
    const rows = await knex('users').select('id', 'username', 'full_name', 'role_id', 'is_active', 'created_at').orderBy('full_name')
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as number,
      username: r.username as string,
      fullName: r.full_name as string,
      roleId: r.role_id as number,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at as string,
    }))
  })

  registerHandler<User>('auth:users:create', async (payload) => {
    requirePermission('user_management')
    const { username, fullName, pin, roleId } = payload as { username: string; fullName: string; pin: string; roleId: number }
    const pinHash = await bcrypt.hash(pin, 10)
    const [id] = await knex('users').insert({
      username: username.trim(),
      full_name: fullName.trim(),
      pin_hash: pinHash,
      role_id: roleId,
      is_active: true,
    })
    const row = await knex('users').where('id', id).first()
    return { id: row.id, username: row.username, fullName: row.full_name, roleId: row.role_id, isActive: Boolean(row.is_active), createdAt: row.created_at }
  })

  registerHandler<User>('auth:users:update', async (payload) => {
    requirePermission('user_management')
    const { id, username, fullName, pin, roleId } = payload as { id: number; username?: string; fullName?: string; pin?: string; roleId?: number }
    const patch: Record<string, unknown> = {}
    if (username) patch.username = username.trim()
    if (fullName) patch.full_name = fullName.trim()
    if (roleId) patch.role_id = roleId
    if (pin) patch.pin_hash = await bcrypt.hash(pin, 10)
    await knex('users').where('id', id).update(patch)
    const row = await knex('users').where('id', id).first()
    return { id: row.id, username: row.username, fullName: row.full_name, roleId: row.role_id, isActive: Boolean(row.is_active), createdAt: row.created_at }
  })

  registerHandler<void>('auth:users:deactivate', async (payload) => {
    requirePermission('user_management')
    const { id } = payload as { id: number }
    await knex('users').where('id', id).update({ is_active: false })
  })
}
