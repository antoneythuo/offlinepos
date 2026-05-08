// Unit tests for the getBranchFilter utility
// Task 33.4 — Requirements 31.1–31.3

import { describe, it, expect } from 'vitest'
import { getBranchFilter } from '../../../src/utils/branchFilter'

describe('getBranchFilter', () => {
  it('returns { branch_id: branchId } when a branchId is provided', () => {
    const filter = getBranchFilter(1)
    expect(filter).toEqual({ branch_id: 1 })
  })

  it('returns { branch_id: branchId } for any positive integer branchId', () => {
    expect(getBranchFilter(42)).toEqual({ branch_id: 42 })
    expect(getBranchFilter(100)).toEqual({ branch_id: 100 })
    expect(getBranchFilter(999)).toEqual({ branch_id: 999 })
  })

  it('returns an empty object when branchId is undefined', () => {
    const filter = getBranchFilter(undefined)
    expect(filter).toEqual({})
  })

  it('returns an empty object when called with no arguments', () => {
    const filter = getBranchFilter()
    expect(filter).toEqual({})
  })

  it('empty object has no keys (no filter applied)', () => {
    const filter = getBranchFilter()
    expect(Object.keys(filter)).toHaveLength(0)
  })

  it('non-empty object has exactly one key (branch_id)', () => {
    const filter = getBranchFilter(5)
    expect(Object.keys(filter)).toHaveLength(1)
    expect(Object.keys(filter)[0]).toBe('branch_id')
  })

  it('branch_id value matches the provided branchId exactly', () => {
    const branchId = 7
    const filter = getBranchFilter(branchId) as { branch_id: number }
    expect(filter.branch_id).toBe(branchId)
  })
})
