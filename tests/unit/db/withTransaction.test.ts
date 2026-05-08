import { describe, it, expect, vi } from 'vitest'
import type { Knex } from 'knex'
import withTransaction from '../../../src/db/withTransaction'

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Builds a minimal mock Knex instance whose `transaction()` method
 * immediately invokes the callback with a fake transaction object.
 *
 * This lets us test `withTransaction` without a real database connection.
 */
function makeMockKnex(trxObject: Partial<Knex.Transaction> = {}): Knex {
  const mockTrx = trxObject as Knex.Transaction

  const mockKnex = {
    transaction: vi.fn(async (callback: (trx: Knex.Transaction) => Promise<unknown>) => {
      return callback(mockTrx)
    })
  } as unknown as Knex

  return mockKnex
}

// ─── withTransaction ─────────────────────────────────────────────────────────

describe('withTransaction', () => {
  it('returns the result of the callback on success', async () => {
    const mockKnex = makeMockKnex()

    const result = await withTransaction(async (_trx) => {
      return 42
    }, mockKnex)

    expect(result).toBe(42)
  })

  it('passes the transaction object to the callback', async () => {
    const fakeTrx = { id: 'fake-trx' } as unknown as Knex.Transaction
    const mockKnex = makeMockKnex(fakeTrx)

    let receivedTrx: Knex.Transaction | undefined

    await withTransaction(async (trx) => {
      receivedTrx = trx
      return 'ok'
    }, mockKnex)

    expect(receivedTrx).toBe(fakeTrx)
  })

  it('re-throws the error when the callback throws', async () => {
    const mockKnex = makeMockKnex()
    const boom = new Error('db write failed')

    await expect(
      withTransaction(async (_trx) => {
        throw boom
      }, mockKnex)
    ).rejects.toThrow('db write failed')
  })

  it('re-throws the exact error instance (not a wrapped copy)', async () => {
    const mockKnex = makeMockKnex()
    const originalError = new Error('original')

    let caughtError: unknown
    try {
      await withTransaction(async (_trx) => {
        throw originalError
      }, mockKnex)
    } catch (err) {
      caughtError = err
    }

    expect(caughtError).toBe(originalError)
  })

  it('calls knex.transaction() exactly once per invocation', async () => {
    const mockKnex = makeMockKnex()

    await withTransaction(async () => 'done', mockKnex)

    expect((mockKnex.transaction as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })

  it('returns a resolved promise with the callback value for async work', async () => {
    const mockKnex = makeMockKnex()

    const result = await withTransaction(async (_trx) => {
      // Simulate async work
      await Promise.resolve()
      return { inserted: true, id: 7 }
    }, mockKnex)

    expect(result).toEqual({ inserted: true, id: 7 })
  })
})
