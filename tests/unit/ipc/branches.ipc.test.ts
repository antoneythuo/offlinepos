/**
 * Unit tests for the branches IPC handler logic — Task 33.6
 *
 * We test `listBranches`, `createBranch`, `updateBranch`, and `deleteBranch`
 * directly — without going through Electron's ipcMain — by injecting a mock
 * BranchService. This keeps tests fast and dependency-free while validating
 * the permission enforcement and delegation behaviour.
 *
 * Requirements: 31.1–31.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { listBranches, createBranch, updateBranch, deleteBranch } from '../../../electron/ipc/branches.ipc'
import { BranchService } from '../../../src/services/BranchService'
import { AuthorizationError } from '../../../src/errors'
import type { Branch } from '../../../src/types/index'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 1,
    name: 'Main Branch',
    address: '123 Main St',
    phone: '555-0100',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeService(overrides: Partial<BranchService> = {}): BranchService {
  return {
    list: vi.fn().mockResolvedValue([makeBranch()]),
    create: vi.fn().mockResolvedValue(makeBranch()),
    update: vi.fn().mockResolvedValue(makeBranch()),
    delete: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(makeBranch()),
    assignUserToBranch: vi.fn().mockResolvedValue(undefined),
    assignProductToBranch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as BranchService
}

// ─── Session mock helpers ─────────────────────────────────────────────────────

// requirePermission reads from SessionManager, so we mock the module
vi.mock('../../../src/services/SessionManager', () => ({
  sessionManager: {
    getSession: vi.fn(),
  },
}))

import { sessionManager } from '../../../src/services/SessionManager'

function setSession(permissions: Record<string, boolean> = { settings: true }) {
  vi.mocked(sessionManager.getSession).mockReturnValue({
    id: 1,
    username: 'admin',
    fullName: 'Admin User',
    roleId: 1,
    roleName: 'Administrator',
    permissions,
  })
}

function clearSession() {
  vi.mocked(sessionManager.getSession).mockReturnValue(null)
}

// ─── branches:list ────────────────────────────────────────────────────────────

describe('listBranches', () => {
  beforeEach(() => setSession({ settings: true }))
  afterEach(() => { vi.clearAllMocks() })

  it('returns the list of branches from the service', async () => {
    const branches = [makeBranch({ id: 1 }), makeBranch({ id: 2, name: 'North Branch' })]
    const service = makeService({ list: vi.fn().mockResolvedValue(branches) })

    const result = await listBranches(service)

    expect(result).toEqual(branches)
    expect(service.list).toHaveBeenCalledOnce()
  })

  it('returns an empty array when no branches exist', async () => {
    const service = makeService({ list: vi.fn().mockResolvedValue([]) })

    const result = await listBranches(service)

    expect(result).toEqual([])
  })

  it('delegates to service.list without additional arguments', async () => {
    const service = makeService()

    await listBranches(service)

    expect(service.list).toHaveBeenCalledWith()
  })

  it('throws AuthorizationError when the session lacks the settings permission', async () => {
    setSession({ sales: true }) // no 'settings' permission

    const service = makeService()

    await expect(listBranches(service)).rejects.toThrow(AuthorizationError)
    expect(service.list).not.toHaveBeenCalled()
  })

  it('throws AuthorizationError when there is no active session', async () => {
    clearSession()

    const service = makeService()

    await expect(listBranches(service)).rejects.toThrow(AuthorizationError)
    expect(service.list).not.toHaveBeenCalled()
  })

  it('propagates errors thrown by service.list', async () => {
    const service = makeService({
      list: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    })

    await expect(listBranches(service)).rejects.toThrow('DB connection lost')
  })
})

// ─── branches:create ─────────────────────────────────────────────────────────

describe('createBranch', () => {
  beforeEach(() => setSession({ settings: true }))
  afterEach(() => { vi.clearAllMocks() })

  it('delegates to service.create with the provided payload', async () => {
    const service = makeService()
    const payload = { name: 'East Branch', address: '1 East St', phone: '555-0200' }

    await createBranch(payload, service)

    expect(service.create).toHaveBeenCalledWith(payload)
  })

  it('returns the created branch', async () => {
    const created = makeBranch({ id: 5, name: 'East Branch' })
    const service = makeService({ create: vi.fn().mockResolvedValue(created) })

    const result = await createBranch({ name: 'East Branch' }, service)

    expect(result).toEqual(created)
  })

  it('throws AuthorizationError when the session lacks the settings permission', async () => {
    setSession({ sales: true })
    const service = makeService()

    await expect(createBranch({ name: 'X' }, service)).rejects.toThrow(AuthorizationError)
    expect(service.create).not.toHaveBeenCalled()
  })
})

// ─── branches:update ─────────────────────────────────────────────────────────

describe('updateBranch', () => {
  beforeEach(() => setSession({ settings: true }))
  afterEach(() => { vi.clearAllMocks() })

  it('delegates to service.update with id and fields', async () => {
    const service = makeService()

    await updateBranch({ id: 1, name: 'Renamed Branch' }, service)

    expect(service.update).toHaveBeenCalledWith(1, { name: 'Renamed Branch' })
  })

  it('maps isActive to is_active in the service call', async () => {
    const service = makeService()

    await updateBranch({ id: 1, isActive: false }, service)

    expect(service.update).toHaveBeenCalledWith(1, { is_active: false })
  })

  it('throws AuthorizationError when the session lacks the settings permission', async () => {
    setSession({ sales: true })
    const service = makeService()

    await expect(updateBranch({ id: 1, name: 'X' }, service)).rejects.toThrow(AuthorizationError)
    expect(service.update).not.toHaveBeenCalled()
  })
})

// ─── branches:delete ─────────────────────────────────────────────────────────

describe('deleteBranch', () => {
  beforeEach(() => setSession({ settings: true }))
  afterEach(() => { vi.clearAllMocks() })

  it('delegates to service.delete with the branch id', async () => {
    const service = makeService()

    await deleteBranch({ id: 3 }, service)

    expect(service.delete).toHaveBeenCalledWith(3)
  })

  it('throws AuthorizationError when the session lacks the settings permission', async () => {
    setSession({ sales: true })
    const service = makeService()

    await expect(deleteBranch({ id: 1 }, service)).rejects.toThrow(AuthorizationError)
    expect(service.delete).not.toHaveBeenCalled()
  })
})
