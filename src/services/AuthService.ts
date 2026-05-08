import bcrypt from 'bcryptjs'
import type { Knex } from 'knex'
import knexDefault from '../db/knex'
import type { SessionUser } from '../types/index'
import { AuthenticationError } from '../errors'

// ─── Raw DB row shapes ────────────────────────────────────────────────────────

interface UserRow {
  id: number
  username: string
  full_name: string
  pin_hash: string
  is_active: boolean | number  // MySQL returns 0/1 for BOOLEAN columns
  role_id: number
  role_name: string
  permissions: string | Record<string, boolean>  // JSON column — may be pre-parsed by mysql2
}

// ─── AuthService ─────────────────────────────────────────────────────────────

export class AuthService {
  private readonly db: Knex

  /**
   * @param knexInstance  Optional Knex instance injected for testing.
   *                      Defaults to the application-wide singleton.
   */
  constructor(knexInstance?: Knex) {
    this.db = knexInstance ?? knexDefault
  }

  /**
   * Authenticates a user by username and PIN.
   *
   * Steps:
   *  1. Query `users` joined with `roles` by username.
   *  2. Throw `AuthenticationError` if no user found.
   *  3. Throw `AuthenticationError` if the user is inactive.
   *  4. Verify the supplied PIN against the stored bcrypt hash.
   *  5. Throw `AuthenticationError` if the PIN does not match.
   *  6. Parse the role's `permissions` JSON and return a `SessionUser`.
   *
   * @param username  The user's login name (case-sensitive).
   * @param pin       The plain-text PIN entered by the user.
   * @returns         A `SessionUser` with role name and parsed permissions.
   * @throws          `AuthenticationError` on any authentication failure.
   */
  async login(username: string, pin: string): Promise<SessionUser> {
    // 1. Fetch user + role in a single join
    const row = await this.db<UserRow>('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.username', username)
      .select(
        'users.id',
        'users.username',
        'users.full_name',
        'users.pin_hash',
        'users.is_active',
        'users.role_id',
        'roles.name as role_name',
        'roles.permissions'
      )
      .first()

    // 2. Unknown username
    if (!row) {
      throw new AuthenticationError('Invalid username or PIN')
    }

    // 3. Inactive account
    // MySQL BOOLEAN columns come back as 0/1 integers via mysql2
    const isActive = row.is_active === true || row.is_active === 1
    if (!isActive) {
      throw new AuthenticationError('User account is inactive')
    }

    // 4. PIN verification
    const pinMatches = await bcrypt.compare(pin, row.pin_hash)

    // 5. Wrong PIN
    if (!pinMatches) {
      throw new AuthenticationError('Invalid username or PIN')
    }

    // 6. Parse permissions — mysql2 may return the JSON column already parsed
    //    as an object, or as a raw JSON string depending on driver version.
    let permissions: Record<string, boolean>
    if (typeof row.permissions === 'string') {
      try {
        permissions = JSON.parse(row.permissions) as Record<string, boolean>
      } catch {
        permissions = {}
      }
    } else {
      permissions = row.permissions ?? {}
    }

    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      roleId: row.role_id,
      roleName: row.role_name,
      permissions,
    }
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const authService = new AuthService()
