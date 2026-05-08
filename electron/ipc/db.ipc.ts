// IPC handler for database connectivity check — Task 32.2
// Channel: db:ping
// Requirements: 32.2

import { registerHandler } from '../../src/ipc/registerHandler'
import knex from '../../src/db/knex'

/**
 * pingDatabase — executes a lightweight `SELECT 1` query to verify that the
 * database connection is alive.
 *
 * Returns `{ ok: true }` on success, or `{ ok: false }` on any error.
 * Errors are caught internally so the IPC envelope always resolves (the
 * renderer interprets `ok: false` as a disconnected state rather than an
 * IPC failure).
 */
export async function pingDatabase(
  db: { raw: (sql: string) => Promise<unknown> } = knex
): Promise<{ ok: boolean }> {
  try {
    await db.raw('SELECT 1')
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export function registerDbHandlers(): void {
  registerHandler('db:ping', async (_payload: unknown) => {
    return pingDatabase()
  })
}
