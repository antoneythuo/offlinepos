// Unit tests for ReportService.crossBranchSummary
// Requirements 31.2

import { describe, it, expect, vi } from 'vitest'
import type { Knex } from 'knex'
import { ReportService } from '../../../src/services/ReportService'
import type { CrossBranchSummary } from '../../../src/types'

const DATE_RANGE = { from: '2024-01-01', to: '2024-01-31' }

function makeMockKnex(
  txRows: Array<{
    branchId: number | null
    branchName: string | null
    total_transactions: number | string
    total_revenue: number | string
  }>,
  refundRows: Array<{
    branchId: number | null
    total_refunds: number | string
  }> = []
): Knex {
  let callCount = 0

  const makeQueryBuilder = (resolveWith: unknown) => ({
    leftJoin: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    whereRaw: vi.fn().mockReturnThis(),
    whereIn: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockResolvedValue(resolveWith),
  })

  const mockKnex = vi.fn((_table: string) => {
    callCount++
    if (callCount === 1) return makeQueilder(txRows)
    return makeQueryBuilder(refundRows)
  }) as unknown as Knex

  ;(mockKnex as unknown as { raw: (sql: string) => unknown }).raw = vi.fn((sql: string) => sql)

  return mockKnex
}

describe('ReportService.crossBranchSummary', () => {
  it('returns an empty array when there are no transactions', async () => {
    const mockKnex = makeMockKnex([], [])
    const service = new ReportService(mockKnex)
    const result = await service.crossBranchSummary(DATE_RANGE)
    expect(result).toEqual([])
  })

  it('returns one entry per branch', async () => {
    const mockKnex = makeMockKnex([
      { branchId: 1, branchName: 'Main Branch', total_transactions: 5, total_revenue: '1000.0000' },
      { branchId: 2, branchName: 'North Branch', total_transactions: 3, total_revenue: '600.0000' },
    ])
    const service = new ReportService(mockKnex)
    const result = await service.crossBranchSummary(DATE_RANGE)
    expect(result).toHaveLength(2)
  })

  it('maps branchId and branchName correctly', async () => {
    const mockKnex = makeMockKnex([
      { branchId: 7, branchName: 'East Branch', total_transactions: 2, total_revenue: '200.0000' },
    ])
    const service = new ReportService(mockKnex)
    const [entry] = await service.crossBranchSummary(DATE_RANGE)
    expect(entry.branchId).toBe(7)
    expect(entry.branchName).toBe('East Branch')
  })

  it('maps totalTransactions as a number', async () => {
    const mockKnex = makeMockKnex([
      {e: '500.0000' },
    ])
    const service = new ReportService(mockKnex)
    const [entry] = await service.crossBranchSummary(DATE_RANGE)
    expect(entry.totalTransactions).toBe(10)
    expect(typeof entry.totalTransactions).toBe('number')
  })

  it('maps totalRevenue as a number', async () => {
    const mockKnex = makeMockKnex([
      { branchId: 1, branchName: 'Main', total_transactions: 4, total_revenue: '1234.5678' },
    ])
    const service = new ReportService(mockKnex)
    const [entry] = await service.crossBranchSummary(DATE_RANGE)
    expect(entry.totalRevenue).toBeCloseTo(1234.5678, 4)
  })

  it('sets totalRefunds to 0 when no refunds exist for a branch', async () => {
    const mockKnex = makeMockKnex([
      { branchId: 1, branchName: 'Main', total_transactions: 3, total_revenue: '300.0000' },
    ])
    const service = new ReportService(mockKnex)
    const [entry] = await service.crossBranchSummary(DATE_RANGE)
    expect(entry.totalRefunds).toBe(0)
  })

  ithing branch', async () => {
    const mockKnex = makeMockKnex(
      [
        { branchId: 1, branchName: 'Main', total_transactions: 5, total_revenue: '1000.0000' },
        { branchId: 2, branchName: 'North', total_transactions: 3, total_revenue: '600.0000' },
      ],
      [
        { branchId: 1, total_refunds: '150.0000' },
        { branchId: 2, total_refunds: '50.0000' },
      ]
    )
    const service = new ReportService(mockKnex)
    const result = await service.crossBranchSummary(DATE_RANGE)
    st main = result.find((r) => r.branchId === 1)!
    const north = result.find((r) => r.branchId === 2)!
    expect(main.totalRefunds).toBeCloseTo(150, 4)
    expect(north.totalRefunds).toBeCloseTo(50, 4)
  })

  it('does not assign refunds from one branch to another', async () => {
    const mockKnex = makeMockKnex(
      [
        { branchId: 1, branchName: 'Main', total_transactions: 50000' },
        { branchId: 2, branchName: 'North', total_transactions: 3, total_revenue: '600.0000' },
      ],
      [{ branchId: 1, total_refunds: '200.0000' }]
    )
    const service = new ReportService(mockKnex)
    const result = await service.crossBranchSummary(DATE_RANGE)
    const north = result.find((r) => r.branchId === 2)!
    expect(north.totalRefunds).toBe(0)
  })

  it('computes netSales as totalRevenue minus totalRefunds', async () => {
    const mockKnex = makeMockKnex(
1, branchName: 'Main', total_transactions: 5, total_revenue: '1000.0000' }],
      [{ branchId: 1, total_refunds: '150.0000' }]
    )
    const service = new ReportService(mockKnex)
    const [entry] = await service.crossBranchSummary(DATE_RANGE)
    expect(entry.netSales).toBeCloseTo(850, 4)
  })

  it('netSales equals totalRevenue when there are no refunds', async () => {
    const mockKnex = makeMockKnex([
      { branchId: 1, branchName: 'Main', total_transactions: 2, total_revenue: '500.0000' },
    ])
    const service = new ReportService(mockKnex)
    const [entry] = await service.crossBranchSummary(DATE_RANGE)
    expect(entry.netSales).toBeCloseTo(entry.totalRevenue, 4)
  })

  it('includes a row with branchId=null for unassigned transactions', async () => {
    const mockKnex = makeMockKnex([
      { branchId: null, branchName: null, total_transactions: 4, total_revenue: '400.0000' },
      { branchId: 1, branchName: 'Main', total_transactions: 6, total_revenue: '600.0000' },
    ])
    const service = new ReportService(mockKnex)
    const result = await service.crossBranchSummary(DATE_RANGE)
    const unassigned = result.find((r) => r.branchId === null)
    ned()
    expect(unassigned!.branchName).toBeNull()
    expect(unassigned!.totalTransactions).toBe(4)
  })

  it('correctly assigns refunds to the null-branch row', async () => {
    const mockKnex = makeMockKnex(
      [{ branchId: null, branchName: null, total_transactions: 3, total_revenue: '300.0000' }],
      [{ branchId: null, total_refunds: '75.0000' }]
    )
    const service = new ReportService(mockKnex)
    const [entry] = await service.crossBranchSummary(DATE_RANGE)
    expect(entry.branchId).toBeNull()
    expect(entry.totalRefunds).toBeCloseTo(75, 4)
    expect(entry.netSales).toBeCloseTo(225, 4)
  })

  it('every entry satisfies the CrossBranchSummary shape', async () => {
    const mockKnex = makeMockKnex(
      [
        { branchId: 1, branchName: 'Main', total_transactions: 5, total_revenue: '1000.0000' },
        { branchId: null, branchName: null, total_transactions: 1, total_revenue: '100.0000' },
      ],
      [{ branchId: 1, total_refunds: '50.0000' }]
    )
    const service = new ReportService(mockKnex)
    const result: CrossBranchSummary[] = await service.crossBranchSummary(DATE_RANGE)
    for (const entry of result) {
      expect(typeof entry.totalTransactions).toBe('number')
      expect(typeof entry.totalRevenue).toBe('number')
      expect(typeof entry.totalRefunds).toBe('number')
      expect(typeof entry.netSales).toBe('number')
      expect(entry.branchId === null || typeof entry.branchId === 'number').toBe(true)
    }
  })
})
