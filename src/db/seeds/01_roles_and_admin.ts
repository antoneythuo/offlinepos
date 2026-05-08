import type { Knex } from 'knex'
import bcrypt from 'bcryptjs'
import { DEFAULT_SETTINGS } from '../../services/SettingsService'

// ─── Permission definitions ──────────────────────────────────────────────────

interface Permissions {
  sales: boolean
  inventory: boolean
  inventory_view: boolean
  reports: boolean
  credit: boolean
  credit_view: boolean
  customers: boolean
  expenses: boolean
  shifts: boolean
  z_reports: boolean
  user_management: boolean
  settings: boolean
  audit_logs: boolean
  cost_prices: boolean
}

const ALL_PERMISSIONS: Permissions = {
  sales: true,
  inventory: true,
  inventory_view: true,
  reports: true,
  credit: true,
  credit_view: true,
  customers: true,
  expenses: true,
  shifts: true,
  z_reports: true,
  user_management: true,
  settings: true,
  audit_logs: true,
  cost_prices: true,
}

const NO_PERMISSIONS: Permissions = {
  sales: false,
  inventory: false,
  inventory_view: false,
  reports: false,
  credit: false,
  credit_view: false,
  customers: false,
  expenses: false,
  shifts: false,
  z_reports: false,
  user_management: false,
  settings: false,
  audit_logs: false,
  cost_prices: false,
}

// ─── Built-in roles ──────────────────────────────────────────────────────────

export const BUILT_IN_ROLES = [
  {
    name: 'Administrator',
    is_system: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Manager',
    is_system: true,
    permissions: {
      ...NO_PERMISSIONS,
      sales: true,
      reports: true,
      credit: true,
      credit_view: true,
      customers: true,
      expenses: true,
      shifts: true,
      z_reports: true,
      inventory_view: true,
      cost_prices: true,
    } satisfies Permissions,
  },
  {
    name: 'Cashier',
    is_system: true,
    permissions: {
      ...NO_PERMISSIONS,
      sales: true,
      customers: true,
      credit_view: true,
    } satisfies Permissions,
  },
  {
    name: 'Stock_Controller',
    is_system: true,
    permissions: {
      ...NO_PERMISSIONS,
      inventory: true,
      inventory_view: true,
      // stock_adjustments and stock_receipts are covered by the inventory permission
    } satisfies Permissions,
  },
]

// ─── Default admin user ──────────────────────────────────────────────────────

export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PIN = '1234'
export const DEFAULT_ADMIN_FULL_NAME = 'System Administrator'

// ─── Seed function ───────────────────────────────────────────────────────────

export async function seed(knex: Knex): Promise<void> {
  // 1. Insert built-in roles (skip if already present — idempotent)
  const rolesPayload = BUILT_IN_ROLES.map((role) => ({
    name: role.name,
    permissions: JSON.stringify(role.permissions),
    is_system: role.is_system,
  }))

  await knex('roles').insert(rolesPayload).onConflict('name').ignore()

  // 2. Look up the Administrator role id
  const adminRole = await knex('roles').where({ name: 'Administrator' }).first()
  if (!adminRole) {
    throw new Error('Administrator role not found after seed insert — cannot create default admin user')
  }

  // 3. Hash the default PIN
  const pinHash = await bcrypt.hash(DEFAULT_ADMIN_PIN, 10)

  // 4. Insert default admin user (skip if username already exists — idempotent)
  await knex('users')
    .insert({
      username: DEFAULT_ADMIN_USERNAME,
      pin_hash: pinHash,
      full_name: DEFAULT_ADMIN_FULL_NAME,
      role_id: adminRole.id,
      is_active: true,
    })
    .onConflict('username')
    .ignore()

  // 5. Insert default settings (skip if already present — idempotent)
  //    Includes connection_mode (default: 'local'), lan_host, and lan_port (Req 32.1)
  const settingsPayload = Object.entries(DEFAULT_SETTINGS).map(([key_name, value]) => ({
    key_name,
    value,
  }))

  await knex('settings').insert(settingsPayload).onConflict('key_name').ignore()

  // 6. Insert default category and unit of measure (idempotent)
  await knex('categories').insert({ name: 'General', description: 'Default category' }).onConflict('name').ignore()
  await knex('units_of_measure').insert({ name: 'Piece', abbreviation: 'pcs' }).onConflict('name').ignore()

  // 7. Insert default branch (skip if any branch already exists — idempotent)
  //    Req 31.1: seed a default "Main Branch" so the system has at least one branch
  const existingBranch = await knex('branches').first()
  if (!existingBranch) {
    await knex('branches').insert({
      name: 'Main Branch',
      address: null,
      phone: null,
      is_active: true,
    })
  }
}
