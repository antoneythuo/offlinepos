// IPC handlers for branch management — Task 33.6
// Channels: branches:list, branches:create, branches:update, branches:delete
// Requirements: 31.1–31.3

import { registerHandler } from '../../src/ipc/registerHandler'
import { requirePermission } from '../../src/ipc/requirePermission'
import { BranchService } from '../../src/services/BranchService'
import type { Branch } from '../../src/types/index'

// ─── Payload shapes ───────────────────────────────────────────────────────────

interface CreateBranchPayload {
  name: string
  address?: string
  phone?: string
}

interface UpdateBranchPayload {
  id: number
  name?: string
  address?: string
  phone?: string
  isActive?: boolean
}

interface DeleteBranchPayload {
  id: number
}

// ─── Exported handler logic (for unit testing without Electron) ───────────────

/**
 * listBranches — returns all branches from the database.
 *
 * Requires the `settings` permission (Requirement 31.3).
 * Exported so it can be unit-tested without going through ipcMain.
 */
export async function listBranches(
  service: BranchService
): Promise<Branch[]> {
  requirePermission('settings')
  return service.list()
}

/**
 * createBranch — creates a new branch record.
 *
 * Requires the `settings` permission.
 */
export async function createBranch(
  payload: CreateBranchPayload,
  service: BranchService
): Promise<Branch> {
  requirePermission('settings')
  return service.create(payload)
}

/**
 * updateBranch — updates an existing branch record.
 *
 * Requires the `settings` permission.
 */
export async function updateBranch(
  payload: UpdateBranchPayload,
  service: BranchService
): Promise<Branch> {
  requirePermission('settings')
  const { id, isActive, ...rest } = payload
  return service.update(id, {
    ...rest,
    ...(isActive !== undefined ? { is_active: isActive } : {}),
  })
}

/**
 * deleteBranch — deletes a branch record.
 *
 * Requires the `settings` permission.
 */
export async function deleteBranch(
  payload: DeleteBranchPayload,
  service: BranchService
): Promise<void> {
  requirePermission('settings')
  return service.delete(payload.id)
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerBranchHandlers(): void {
  const service = new BranchService()

  /**
   * branches:list
   *
   * Returns all branch records. Requires `settings` permission.
   *
   * Payload:  (none)
   * Response: `IpcResult<Branch[]>`
   */
  registerHandler<Branch[]>('branches:list', async (_payload: unknown) => {
    return listBranches(service)
  })

  /**
   * branches:create
   *
   * Creates a new branch. Requires `settings` permission.
   *
   * Payload:  `{ name: string, address?: string, phone?: string }`
   * Response: `IpcResult<Branch>`
   */
  registerHandler<Branch>('branches:create', async (payload: unknown) => {
    return createBranch(payload as CreateBranchPayload, service)
  })

  /**
   * branches:update
   *
   * Updates an existing branch. Requires `settings` permission.
   *
   * Payload:  `{ id: number, name?: string, address?: string, phone?: string, isActive?: boolean }`
   * Response: `IpcResult<Branch>`
   */
  registerHandler<Branch>('branches:update', async (payload: unknown) => {
    return updateBranch(payload as UpdateBranchPayload, service)
  })

  /**
   * branches:delete
   *
   * Deletes a branch. Requires `settings` permission.
   *
   * Payload:  `{ id: number }`
   * Response: `IpcResult<void>`
   */
  registerHandler<void>('branches:delete', async (payload: unknown) => {
    return deleteBranch(payload as DeleteBranchPayload, service)
  })
}
