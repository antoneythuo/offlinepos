import { describe, it, expect, vi } from 'vitest'
import type { Knex } from 'knex'
import { BranchService } from '../../../src/services/BranchService'
import { NotFoundError, ValidationError } from '../../../src/errors'

function makeBranchRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'Main Branch',
    address: '123 Main St',
    phone: '555-0100',
    is_active: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeBuilder(resolveWith: unknown) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn().mockReturnThis()
  builder.orderBy = vi.fn().mockReturnThis()
  builder.where = vi.fn().mockReturnThis()
  builder.count = vi.fn().mockReturnThis()
  builder.first = vi.fn().mockResolvedValue(resolveWith)
  builder.insert = vi.fn().mockResolvedValue([1])
  builder.update = vi.fn().mockResolvedValue(1)
  builder.delete = vi.fn().mockResolvedValue(1)
  ;(builder as unknown as Promise<unknown>).then = (
    resolve: (v: unknown) => void,
    _reject?: (e: unknown) => void
  ) => Promise.resolve(resolveWith).then(resolve, _reject)
  return builder
}

describe('BranchService.create', () => {
  it('inserts a new branch with the provided fields', async () => {
    const branchRow = makeBranchRow({ id: 2, name: 'North Branch' })
    const insertBuilder = makeBuilder([2])
    const findBuilder = makeBuilder(branchRow)
    let callCount = 0
    const mockKnex = vi.fn().mockImplementation(() => {
      callCount++
      return callCount === 1 ? insertBuilder : findBuilder
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await service.create({ name: 'North Branch', address: '1 North St', phone: '555-0101' })
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      name: 'North Branch',
      address: '1 North St',
      phone: '555-0101',
      is_active: true,
    })
  })

  it('sets address and phone to null when not provided', async () => {
    const branchRow = makeBranchRow()
    const insertBuilder = makeBuilder([1])
    const findBuilder = makeBuilder(branchRow)
    let callCount = 0
    const mockKnex = vi.fn().mockImplementation(() => {
      callCount++
      return callCount === 1 ? insertBuilder : findBuilder
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await service.create({ name: 'Minimal Branch' })
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ address: null, phone: null })
    )
  })

  it('returns the created branch from findById', async () => {
    const branchRow = makeBranchRow({ id: 3, name: 'South Branch' })
    const insertBuilder = makeBuilder([3])
    const findBuilder = makeBuilder(branchRow)
    let callCount = 0
    const mockKnex = vi.fn().mockImplementation(() => {
      callCount++
      return callCount === 1 ? insertBuilder : findBuilder
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    const branch = await service.create({ name: 'South Branch' })
    expect(branch.id).toBe(3)
    expect(branch.name).toBe('South Branch')
  })
})

describe('BranchService.findById', () => {
  it('returns a Branch when the row exists', async () => {
    const row = makeBranchRow({ id: 5, name: 'East Branch' })
    const mockKnex = vi.fn().mockReturnValue(makeBuilder(row)) as unknown as Knex
    const service = new BranchService(mockKnex)
    const branch = await service.findById(5)
    expect(branch).toMatchObject({ id: 5, name: 'East Branch', isActive: true })
  })

  it('maps is_active = 1 to isActive = true', async () => {
    const row = makeBranchRow({ is_active: 1 })
    const mockKnex = vi.fn().mockReturnValue(makeBuilder(row)) as unknown as Knex
    const service = new BranchService(mockKnex)
    const branch = await service.findById(1)
    expect(branch.isActive).toBe(true)
  })

  it('maps is_active = 0 to isActive = false', async () => {
    const row = makeBranchRow({ is_active: 0 })
    const mockKnex = vi.fn().mockReturnValue(makeBuilder(row)) as unknown as Knex
    const service = new BranchService(mockKnex)
    const branch = await service.findById(1)
    expect(branch.isActive).toBe(false)
  })

  it('maps null address to undefined', async () => {
    const row = makeBranchRow({ address: null })
    const mockKnex = vi.fn().mockReturnValue(makeBuilder(row)) as unknown as Knex
    const service = new BranchService(mockKnex)
    const branch = await service.findById(1)
    expect(branch.address).toBeUndefined()
  })

  it('throws NotFoundError when branch does not exist', async () => {
    const mockKnex = vi.fn().mockReturnValue(makeBuilder(undefined)) as unknown as Knex
    const service = new BranchService(mockKnex)
    await expect(service.findById(999)).rejects.toThrow(NotFoundError)
  })
})

describe('BranchService.list', () => {
  it('returns all branches as Branch objects', async () => {
    const rows = [
      makeBranchRow({ id: 1, name: 'Main Branch' }),
      makeBranchRow({ id: 2, name: 'North Branch' }),
    ]
    const mockKnex = vi.fn().mockReturnValue(makeBuilder(rows)) as unknown as Knex
    const service = new BranchService(mockKnex)
    const branches = await service.list()
    expect(branches).toHaveLength(2)
    expect(branches[0].name).toBe('Main Branch')
  })

  it('returns an empty array when no branches exist', async () => {
    const mockKnex = vi.fn().mockReturnValue(makeBuilder([])) as unknown as Knex
    const service = new BranchService(mockKnex)
    const branches = await service.list()
    expect(branches).toEqual([])
  })
})

describe('BranchService.update', () => {
  it('updates the branch and returns the updated branch', async () => {
    const branchRow = makeBranchRow({ name: 'Updated Branch' })
    let callCount = 0
    const mockKnex = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeBuilder(branchRow)
      if (callCount === 2) return makeBuilder(1)
      return makeBuilder(branchRow)
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    const branch = await service.update(1, { name: 'Updated Branch' })
    expect(branch.name).toBe('Updated Branch')
  })

  it('only includes provided fields in the update payload', async () => {
    const branchRow = makeBranchRow()
    const updateBuilder = makeBuilder(1)
    let callCount = 0
    const mockKnex = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeBuilder(branchRow)
      if (callCount === 2) return updateBuilder
      return makeBuilder(branchRow)
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await service.update(1, { name: 'Renamed' })
    expect(updateBuilder.update).toHaveBeenCalledWith({ name: 'Renamed' })
  })

  it('throws NotFoundError when branch does not exist', async () => {
    const mockKnex = vi.fn().mockReturnValue(makeBuilder(undefined)) as unknown as Knex
    const service = new BranchService(mockKnex)
    await expect(service.update(999, { name: 'Ghost' })).rejects.toThrow(NotFoundError)
  })
})

describe('BranchService.delete', () => {
  it('deletes the branch when more than one active branch exists', async () => {
    const branchRow = makeBranchRow()
    const deleteBuilder = makeBuilder(1)
    let callCount = 0
    const mockKnex = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeBuilder(branchRow)
      if (callCount === 2) return makeBuilder({ count: 2 })
      return deleteBuilder
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await service.delete(1)
    expect(deleteBuilder.delete).toHaveBeenCalled()
  })

  it('throws ValidationError when deleting the last active branch', async () => {
    const branchRow = makeBranchRow()
    let callCount = 0
    const mockKnex = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeBuilder(branchRow)
      return makeBuilder({ count: 1 })
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await expect(service.delete(1)).rejects.toThrow(ValidationError)
  })

  it('ValidationError message mentions "last active branch"', async () => {
    const branchRow = makeBranchRow()
    let callCount = 0
    const mockKnex = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeBuilder(branchRow)
      return makeBuilder({ count: 1 })
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await expect(service.delete(1)).rejects.toThrow(/last active branch/i)
  })

  it('throws NotFoundError when branch does not exist', async () => {
    const mockKnex = vi.fn().mockReturnValue(makeBuilder(undefined)) as unknown as Knex
    const service = new BranchService(mockKnex)
    await expect(service.delete(999)).rejects.toThrow(NotFoundError)
  })
})

describe('BranchService.assignUserToBranch', () => {
  it('updates users.branch_id to the given branchId', async () => {
    const branchRow = makeBranchRow()
    const userRow = { id: 1, username: 'admin' }
    const usersUpdateBuilder = makeBuilder(1)
    usersUpdateBuilder.first = vi.fn().mockResolvedValue(userRow)
    const mockKnex = vi.fn().mockImplementation((tableName: string) => {
      if (tableName === 'branches') return makeBuilder(branchRow)
      if (tableName === 'users') return usersUpdateBuilder
      return makeBuilder(undefined)
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await service.assignUserToBranch(1, 1)
    expect(usersUpdateBuilder.update).toHaveBeenCalledWith({ branch_id: 1 })
  })

  it('throws NotFoundError when branch does not exist', async () => {
    const mockKnex = vi.fn().mockImplementation((tableName: string) => {
      if (tableName === 'branches') return makeBuilder(undefined)
      return makeBuilder({ id: 1 })
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await expect(service.assignUserToBranch(1, 999)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when user does not exist', async () => {
    const branchRow = makeBranchRow()
    const mockKnex = vi.fn().mockImplementation((tableName: string) => {
      if (tableName === 'branches') return makeBuilder(branchRow)
      if (tableName === 'users') return makeBuilder(undefined)
      return makeBuilder(undefined)
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await expect(service.assignUserToBranch(999, 1)).rejects.toThrow(NotFoundError)
  })
})

describe('BranchService.assignProductToBranch', () => {
  it('updates products.branch_id to the given branchId', async () => {
    const branchRow = makeBranchRow()
    const productRow = { id: 1, name: 'Widget' }
    const productsUpdateBuilder = makeBuilder(1)
    productsUpdateBuilder.first = vi.fn().mockResolvedValue(productRow)
    const mockKnex = vi.fn().mockImplementation((tableName: string) => {
      if (tableName === 'branches') return makeBuilder(branchRow)
      if (tableName === 'products') return productsUpdateBuilder
      return makeBuilder(undefined)
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await service.assignProductToBranch(1, 1)
    expect(productsUpdateBuilder.update).toHaveBeenCalledWith({ branch_id: 1 })
  })

  it('throws NotFoundError when branch does not exist', async () => {
    const mockKnex = vi.fn().mockImplementation((tableName: string) => {
      if (tableName === 'branches') return makeBuilder(undefined)
      return makeBuilder({ id: 1 })
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await expect(service.assignProductToBranch(1, 999)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when product does not exist', async () => {
    const branchRow = makeBranchRow()
    const mockKnex = vi.fn().mockImplementation((tableName: string) => {
      if (tableName === 'branches') return makeBuilder(branchRow)
      if (tableName === 'products') return makeBuilder(undefined)
      return makeBuilder(undefined)
    }) as unknown as Knex
    const service = new BranchService(mockKnex)
    await expect(service.assignProductToBranch(999, 1)).rejects.toThrow(NotFoundError)
  })
})
