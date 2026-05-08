import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import type { AuditEntry } from '../types/index'

/**
 * AuditService — handles writing entries to the `audit_logs` table.
 *
 * The `log` method is fire-and-forget: it inserts the entry asynchronously
 * and swallows any errors so that audit failures never block the main
 * operation. Full query support (for the Administrator audit log viewer)
 * is implemented in Task 18.
 */
export class AuditService {
  private readonly db: Knex

  /**
   * @param knexInstance  Optional Knex instance injected for testing.
   *                      Defaults to the application-wide singleton.
   */
  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  /**
   * Write an audit log entry to the `audit_logs` table.
   *
   * This is intentionally fire-and-forget — the returned Promise is not
   * awaited by callers so that audit failures never block the main operation.
   * Errors are silently swallowed and logged to stderr for diagnostics.
   *
   * @param entry  The audit entry to persist.
   */
  log(entry: AuditEntry): void {
    this.db('audit_logs')
      .insert({
        user_id: entry.userId ?? null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        before_state: entry.beforeState ? JSON.stringify(entry.beforeState) : null,
        after_state: entry.afterState ? JSON.stringify(entry.afterState) : null,
        ip_address: entry.ipAddress ?? null,
      })
      .catch((err: unknown) => {
        // Audit failures must never crash the application
        console.error('[AuditService] Failed to write audit log entry:', err)
      })
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const auditService = new AuditService()
