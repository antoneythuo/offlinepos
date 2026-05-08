import type { Knex } from 'knex'
import defaultKnex from './knex'

/**
 * Wraps a callback in a Knex transaction.
 *
 * - On success: commits the transaction and returns the callback's result.
 * - On error: Knex automatically rolls back the transaction, then the error
 *   is re-thrown so callers can handle it.
 *
 * @param fn            Callback that receives the transaction object and
 *                      performs all database operations within it.
 * @param knexInstance  Optional Knex instance to use. Defaults to the
 *                      application-wide instance. Pass a custom instance
 *                      in tests to avoid requiring a real DB connection.
 */
async function withTransaction<T>(
  fn: (trx: Knex.Transaction) => Promise<T>,
  knexInstance: Knex = defaultKnex
): Promise<T> {
  return knexInstance.transaction(async (trx) => {
    try {
      return await fn(trx)
    } catch (err) {
      // Knex auto-rolls back when an error is thrown inside the callback.
      // Re-throw so the caller receives the original error.
      throw err
    }
  })
}

export default withTransaction
