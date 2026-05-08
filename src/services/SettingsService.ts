// SettingsService — Task 21.1, 21.2, 32.1
// Provides get/set access to the `settings` table (key/value pairs).
// Requirements: 15.4, 22.7, 30.1, 30.5, 32.1

import knex from '../db/knex'

// ─── Well-known setting keys ──────────────────────────────────────────────────

export const SETTING_KEYS = {
  // Business info
  BUSINESS_NAME: 'business_name',
  BUSINESS_ADDRESS: 'business_address',
  BUSINESS_PHONE: 'business_phone',

  // Receipt
  RECEIPT_HEADER: 'receipt_header',
  RECEIPT_FOOTER: 'receipt_footer',

  // Tax
  TAX_MODE: 'tax_mode', // 'inclusive' | 'exclusive'

  // Session / security
  IDLE_TIMEOUT_MINUTES: 'idle_timeout_minutes',
  RETURN_WINDOW_DAYS: 'return_window_days',
  CREDIT_LIMIT_ENFORCEMENT: 'credit_limit_enforcement', // 'strict' | 'warn'

  // UI
  THEME: 'theme', // 'light' | 'dark'

  // Printer
  PRINTER_NAME: 'printer_name',

  // Backup
  BACKUP_SCHEDULE_TIME: 'backup_schedule_time',
  LAST_BACKUP: 'last_backup',

  // Connection mode (Task 32.1)
  CONNECTION_MODE: 'connection_mode', // 'local' | 'lan'
  LAN_HOST: 'lan_host',
  LAN_PORT: 'lan_port',

  // Multi-branch mode (Task 33.4)
  MULTI_BRANCH_MODE: 'multi_branch_mode',   // 'true' | 'false'
  CURRENT_BRANCH_ID: 'current_branch_id',   // numeric string, e.g. '1'
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

// ─── Default values ───────────────────────────────────────────────────────────
// NOTE: This object is also imported by the seed file (src/db/seeds/01_roles_and_admin.ts)
// to populate the settings table on first run. Keep it as a pure constant with no
// side-effects so it is safe to import in any context.

export const DEFAULT_SETTINGS: Record<string, string> = {
  [SETTING_KEYS.BUSINESS_NAME]: 'Sequence Lounge',
  [SETTING_KEYS.BUSINESS_ADDRESS]: '',
  [SETTING_KEYS.BUSINESS_PHONE]: '',
  [SETTING_KEYS.RECEIPT_HEADER]: '',
  [SETTING_KEYS.RECEIPT_FOOTER]: 'Thank you for your business!',
  [SETTING_KEYS.TAX_MODE]: 'exclusive',
  [SETTING_KEYS.IDLE_TIMEOUT_MINUTES]: '15',
  [SETTING_KEYS.RETURN_WINDOW_DAYS]: '30',
  [SETTING_KEYS.CREDIT_LIMIT_ENFORCEMENT]: 'warn',
  [SETTING_KEYS.THEME]: 'light',
  [SETTING_KEYS.PRINTER_NAME]: '',
  [SETTING_KEYS.BACKUP_SCHEDULE_TIME]: '02:00',
  [SETTING_KEYS.LAST_BACKUP]: '',
  // LAN / connection mode defaults (Req 32.1)
  [SETTING_KEYS.CONNECTION_MODE]: 'local',
  [SETTING_KEYS.LAN_HOST]: '192.168.1.1',
  [SETTING_KEYS.LAN_PORT]: '3306',
  // Multi-branch mode defaults (Req 31.1–31.3, Task 33.4)
  [SETTING_KEYS.MULTI_BRANCH_MODE]: 'false',
  [SETTING_KEYS.CURRENT_BRANCH_ID]: '',
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SettingsService {
  /**
   * Retrieve a single setting value.
   * Returns the in-memory default if the key is not present in the database.
   */
  async get(key: string): Promise<string> {
    const row = await knex('settings').where({ key_name: key }).first()
    if (row) return row.value as string
    return DEFAULT_SETTINGS[key] ?? ''
  }

  /**
   * Persist a setting value (upsert).
   */
  async set(key: string, value: string): Promise<void> {
    await knex('settings')
      .insert({ key_name: key, value })
      .onConflict('key_name')
      .merge({ value })
  }

  /**
   * Retrieve all settings as a flat key→value map.
   * Keys not present in the database are filled from DEFAULT_SETTINGS.
   */
  async getAll(): Promise<Record<string, string>> {
    const rows = await knex('settings').select('key_name', 'value')

    // Start with defaults, then overlay DB values
    const result: Record<string, string> = { ...DEFAULT_SETTINGS }
    for (const row of rows) {
      result[row.key_name as string] = row.value as string
    }
    return result
  }
}

export const settingsService = new SettingsService()
