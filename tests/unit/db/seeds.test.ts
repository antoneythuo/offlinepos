import { describe, it, expect, vi, type Mock } from 'vitest'
import {
  seed,
  BUILT_IN_ROLES,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_FULL_NAME,
  DEFAULT_ADMIN_PIN,
} from '../../../src/db/seeds/01_roles_and_admin'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal mock Knex instance that records calls without hitting a DB. */
function buildMockKnex(adminRoleId = 1) {
  // The chainable query builder returned for each table call
  const makeQueryBuilder = (tableName: string) => {
    const builder: Record<string, Mock> = {}

    builder.insert = vi.fn().mockReturnValue(builder)
    builder.onConflict = vi.fn().mockReturnValue(builder)
    builder.ignore = vi.fn().mockResolvedValue(undefined)
    builder.where = vi.fn().mockReturnValue(builder)
    builder.first = vi.fn().mockResolvedValue(
      tableName === 'roles' ? { id: adminRoleId, name: 'Administrator' } : undefined
    )

    return builder
  }

  const knex = vi.fn((tableName: string) => makeQueryBuilder(tableName)) as unknown as import('knex').Knex

  return knex
}

// ─── Seed file shape ──────────────────────────────────────────────────────────

describe('01_roles_and_admin seed — module shape', () => {
  it('exports a `seed` function', () => {
    expect(typeof seed).toBe('function')
  })

  it('seed function is async (returns a Promise)', () => {
    const knex = buildMockKnex()
    const result = seed(knex)
    expect(result).toBeInstanceOf(Promise)
    // Resolve the promise so we don't leave dangling async work
    return result
  })
})

// ─── Built-in role definitions ────────────────────────────────────────────────

describe('01_roles_and_admin seed — built-in roles', () => {
  const EXPECTED_ROLE_NAMES = ['Administrator', 'Manager', 'Cashier', 'Stock_Controller']

  it('defines exactly 4 built-in roles', () => {
    expect(BUILT_IN_ROLES).toHaveLength(4)
  })

  it.each(EXPECTED_ROLE_NAMES)('includes the "%s" role', (roleName) => {
    const names = BUILT_IN_ROLES.map((r) => r.name)
    expect(names).toContain(roleName)
  })

  it('all built-in roles have is_system set to true', () => {
    for (const role of BUILT_IN_ROLES) {
      expect(role.is_system).toBe(true)
    }
  })

  it('all built-in roles have a permissions object', () => {
    for (const role of BUILT_IN_ROLES) {
      expect(role.permissions).toBeDefined()
      expect(typeof role.permissions).toBe('object')
    }
  })

  it('Administrator role has all permissions set to true', () => {
    const admin = BUILT_IN_ROLES.find((r) => r.name === 'Administrator')!
    for (const [key, value] of Object.entries(admin.permissions)) {
      expect(value, `Administrator.${key} should be true`).toBe(true)
    }
  })

  it('Manager role has sales, reports, credit, customers, expenses, shifts, z_reports, inventory_view permissions', () => {
    const manager = BUILT_IN_ROLES.find((r) => r.name === 'Manager')!
    const p = manager.permissions
    expect(p.sales).toBe(true)
    expect(p.reports).toBe(true)
    expect(p.credit).toBe(true)
    expect(p.customers).toBe(true)
    expect(p.expenses).toBe(true)
    expect(p.shifts).toBe(true)
    expect(p.z_reports).toBe(true)
    expect(p.inventory_view).toBe(true)
  })

  it('Manager role does NOT have user_management or audit_logs permissions', () => {
    const manager = BUILT_IN_ROLES.find((r) => r.name === 'Manager')!
    expect(manager.permissions.user_management).toBe(false)
    expect(manager.permissions.audit_logs).toBe(false)
  })

  it('Cashier role has sales, customers, credit_view permissions', () => {
    const cashier = BUILT_IN_ROLES.find((r) => r.name === 'Cashier')!
    const p = cashier.permissions
    expect(p.sales).toBe(true)
    expect(p.customers).toBe(true)
    expect(p.credit_view).toBe(true)
  })

  it('Cashier role does NOT have inventory, reports, or user_management permissions', () => {
    const cashier = BUILT_IN_ROLES.find((r) => r.name === 'Cashier')!
    expect(cashier.permissions.inventory).toBe(false)
    expect(cashier.permissions.reports).toBe(false)
    expect(cashier.permissions.user_management).toBe(false)
  })

  it('Stock_Controller role has inventory and inventory_view permissions', () => {
    const sc = BUILT_IN_ROLES.find((r) => r.name === 'Stock_Controller')!
    expect(sc.permissions.inventory).toBe(true)
    expect(sc.permissions.inventory_view).toBe(true)
  })

  it('Stock_Controller role does NOT have sales, reports, or user_management permissions', () => {
    const sc = BUILT_IN_ROLES.find((r) => r.name === 'Stock_Controller')!
    expect(sc.permissions.sales).toBe(false)
    expect(sc.permissions.reports).toBe(false)
    expect(sc.permissions.user_management).toBe(false)
  })
})

// ─── Default admin user constants ────────────────────────────────────────────

describe('01_roles_and_admin seed — default admin user', () => {
  it('default admin username is "admin"', () => {
    expect(DEFAULT_ADMIN_USERNAME).toBe('admin')
  })

  it('default admin full name is "System Administrator"', () => {
    expect(DEFAULT_ADMIN_FULL_NAME).toBe('System Administrator')
  })

  it('default admin PIN is defined and non-empty', () => {
    expect(DEFAULT_ADMIN_PIN).toBeTruthy()
    expect(typeof DEFAULT_ADMIN_PIN).toBe('string')
  })
})

// ─── Seed execution behaviour ─────────────────────────────────────────────────

/**
 * Build a self-referencing chainable query builder using a plain object
 * assigned via `let` so the variable is in scope when the mock functions
 * capture it in their closures.
 */
function makeRolesBuilder(adminRole: { id: number; name: string } | undefined = { id: 1, name: 'Administrator' }) {
  // Use `let` + reassignment so the closure captures the final object reference
  let b: ReturnType<typeof _make>
  function _make() {
    return {
      insert: vi.fn((..._args: unknown[]) => b),
      onConflict: vi.fn((..._args: unknown[]) => b),
      ignore: vi.fn(() => Promise.resolve(undefined)),
      where: vi.fn((..._args: unknown[]) => b),
      first: vi.fn(() => Promise.resolve(adminRole)),
    }
  }
  b = _make()
  return b
}

function makeUsersBuilder() {
  let b: ReturnType<typeof _make>
  function _make() {
    return {
      insert: vi.fn((..._args: unknown[]) => b),
      onConflict: vi.fn((..._args: unknown[]) => b),
      ignore: vi.fn(() => Promise.resolve(undefined)),
      // first() returns undefined by default (no existing record)
      first: vi.fn(() => Promise.resolve(undefined)),
    }
  }
  b = _make()
  return b
}

describe('01_roles_and_admin seed — execution', () => {
  it('calls knex("roles").insert() with 4 role records', async () => {
    const insertedRows: unknown[] = []
    const rolesBuilder = makeRolesBuilder()
    // Override insert to capture rows
    rolesBuilder.insert = vi.fn((rows: unknown[]) => {
      insertedRows.push(...rows)
      return rolesBuilder
    })

    const usersBuilder = makeUsersBuilder()
    const settingsBuilder = makeUsersBuilder()
    const knex = vi.fn((tableName: string) => {
      if (tableName === 'roles') return rolesBuilder
      if (tableName === 'users') return usersBuilder
      return settingsBuilder
    }) as unknown as import('knex').Knex

    await seed(knex)

    expect(rolesBuilder.insert).toHaveBeenCalledOnce()
    expect(insertedRows).toHaveLength(4)
  })

  it('inserts roles using onConflict("name").ignore() for idempotency', async () => {
    const rolesBuilder = makeRolesBuilder()
    const usersBuilder = makeUsersBuilder()
    const settingsBuilder = makeUsersBuilder()
    const knex = vi.fn((tableName: string) => {
      if (tableName === 'roles') return rolesBuilder
      if (tableName === 'users') return usersBuilder
      return settingsBuilder
    }) as unknown as import('knex').Knex

    await seed(knex)

    expect(rolesBuilder.onConflict).toHaveBeenCalledWith('name')
    expect(rolesBuilder.ignore).toHaveBeenCalled()
  })

  it('inserts the admin user using onConflict("username").ignore() for idempotency', async () => {
    const rolesBuilder = makeRolesBuilder()
    const usersBuilder = makeUsersBuilder()
    const settingsBuilder = makeUsersBuilder()
    const knex = vi.fn((tableName: string) => {
      if (tableName === 'roles') return rolesBuilder
      if (tableName === 'users') return usersBuilder
      return settingsBuilder
    }) as unknown as import('knex').Knex

    await seed(knex)

    expect(usersBuilder.onConflict).toHaveBeenCalledWith('username')
    expect(usersBuilder.ignore).toHaveBeenCalled()
  })

  it('inserts admin user with username "admin"', async () => {
    const insertedUser: Record<string, unknown>[] = []
    const rolesBuilder = makeRolesBuilder()
    const usersBuilder = makeUsersBuilder()
    const settingsBuilder = makeUsersBuilder()
    // Override insert to capture the user row
    usersBuilder.insert = vi.fn((row: Record<string, unknown>) => {
      insertedUser.push(row)
      return usersBuilder
    })

    const knex = vi.fn((tableName: string) => {
      if (tableName === 'roles') return rolesBuilder
      if (tableName === 'users') return usersBuilder
      return settingsBuilder
    }) as unknown as import('knex').Knex

    await seed(knex)

    expect(insertedUser).toHaveLength(1)
    expect(insertedUser[0].username).toBe('admin')
    expect(insertedUser[0].full_name).toBe('System Administrator')
  })

  it('stores a bcrypt hash (not plaintext) for the admin PIN', async () => {
    const insertedUser: Record<string, unknown>[] = []
    const rolesBuilder = makeRolesBuilder()
    const usersBuilder = makeUsersBuilder()
    const settingsBuilder = makeUsersBuilder()
    usersBuilder.insert = vi.fn((row: Record<string, unknown>) => {
      insertedUser.push(row)
      return usersBuilder
    })

    const knex = vi.fn((tableName: string) => {
      if (tableName === 'roles') return rolesBuilder
      if (tableName === 'users') return usersBuilder
      return settingsBuilder
    }) as unknown as import('knex').Knex

    await seed(knex)

    const pinHash = insertedUser[0].pin_hash as string
    // bcrypt hashes start with $2b$ or $2a$
    expect(pinHash).toMatch(/^\$2[ab]\$/)
    // Must NOT store the plaintext PIN
    expect(pinHash).not.toBe(DEFAULT_ADMIN_PIN)
  })

  it('throws if the Administrator role is not found after insert', async () => {
    // Simulate the role lookup returning nothing by building the builder manually
    // (cannot pass `undefined` to makeRolesBuilder because JS treats it as "use default")
    let b: Record<string, unknown>
    b = {
      insert: vi.fn(() => b),
      onConflict: vi.fn(() => b),
      ignore: vi.fn(() => Promise.resolve(undefined)),
      where: vi.fn(() => b),
      // Explicitly return null so !adminRole is true
      first: vi.fn(() => Promise.resolve(null)),
    }

    const knex = vi.fn(() => b) as unknown as import('knex').Knex

    await expect(seed(knex)).rejects.toThrow('Administrator role not found')
  })
})

// ─── Default branch seeding ───────────────────────────────────────────────────

/**
 * Build a mock Knex that tracks branches table calls separately,
 * allowing us to control whether a branch already exists.
 */
function buildMockKnexWithBranches(branchExists: boolean) {
  const rolesBuilder = makeRolesBuilder()
  const usersBuilder = makeUsersBuilder()
  const settingsBuilder = makeUsersBuilder()

  // Branches builder — tracks insert calls
  let branchesBuilder: Record<string, unknown>
  branchesBuilder = {
    insert: vi.fn(() => Promise.resolve(undefined)),
    first: vi.fn(() => Promise.resolve(branchExists ? { id: 1, name: 'Main Branch' } : undefined)),
  }

  const knex = vi.fn((tableName: string) => {
    if (tableName === 'roles') return rolesBuilder
    if (tableName === 'users') return usersBuilder
    if (tableName === 'branches') return branchesBuilder
    return settingsBuilder
  }) as unknown as import('knex').Knex

  return { knex, branchesBuilder }
}

describe('01_roles_and_admin seed — default branch', () => {
  it('inserts a default branch when no branches exist', async () => {
    const { knex, branchesBuilder } = buildMockKnexWithBranches(false)

    await seed(knex)

    expect(branchesBuilder.insert).toHaveBeenCalledOnce()
  })

  it('inserts a branch named "Main Branch"', async () => {
    const insertedBranch: Record<string, unknown>[] = []
    const { knex, branchesBuilder } = buildMockKnexWithBranches(false)

    branchesBuilder.insert = vi.fn((row: Record<string, unknown>) => {
      insertedBranch.push(row)
      return Promise.resolve(undefined)
    })

    await seed(knex)

    expect(insertedBranch).toHaveLength(1)
    expect(insertedBranch[0].name).toBe('Main Branch')
  })

  it('inserts the default branch with is_active set to true', async () => {
    const insertedBranch: Record<string, unknown>[] = []
    const { knex, branchesBuilder } = buildMockKnexWithBranches(false)

    branchesBuilder.insert = vi.fn((row: Record<string, unknown>) => {
      insertedBranch.push(row)
      return Promise.resolve(undefined)
    })

    await seed(knex)

    expect(insertedBranch[0].is_active).toBe(true)
  })

  it('does NOT insert a branch when one already exists (idempotent)', async () => {
    const { knex, branchesBuilder } = buildMockKnexWithBranches(true)

    await seed(knex)

    expect(branchesBuilder.insert).not.toHaveBeenCalled()
  })

  it('checks for existing branches using .first() before inserting', async () => {
    const { knex, branchesBuilder } = buildMockKnexWithBranches(false)

    await seed(knex)

    expect(branchesBuilder.first).toHaveBeenCalled()
  })
})
