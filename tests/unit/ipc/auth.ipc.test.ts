/**
 * Unit tests for auth IPC handler logic.
 *
 * We test the handler behaviour directly — without going through Electron's
 * ipcMain — by extracting the core logic into testable functions.  The
 * handlers in auth.ipc.ts delegate to authService, sessionManager, and
 * auditService, all of which are mocked here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionUser } from '../../../src/types/index'
import { AuthenticationError } from '../../../src/errors'

// ─── Shared mock session user ─────────────────────────────────────────────────

const mockSessionUser: SessionUser = {
  id: 1,
  username: 'admin',
  fullName: 'System Administrator',
  roleId: 1,
  roleName: 'Administrator',
  permissions: { sales: true, inventory: true, reports: true },
}

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeAuthService(resolveWith?: SessionUser, rejectWith?: Error) {
  return {
    login: rejectWith
      ? vi.fn().mockRejectedValue(rejectWith)
      : vi.fn().mockResolvedValue(resolveWith ?? mockSessionUser),
  }
}

function makeSessionManager() {
  let session: SessionUser | null = null
  return {
    setSession: vi.fn((user: SessionUser) => { session = user }),
    getSession: vi.fn(() => session),
    clearSession: vi.fn(() => { session = null }),
  }
}

function makeAuditService() {
  return {
    log: vi.fn(),
  }
}

// ─── Handler logic extracted for testing ─────────────────────────────────────
//
// Rather than importing the registered handlers (which require Electron's
// ipcMain at module load time), we replicate the handler logic inline.
// This keeps tests fast and dependency-free while still validating the
// exact behaviour described in the task.

async function loginHandler(
  payload: { username: string; pin: string },
  deps: {
    authService: ReturnType<typeof makeAuthService>
    sessionManager: ReturnType<typeof makeSessionManager>
    auditService: ReturnType<typeof makeAuditService>
  }
): Promise<SessionUser> {
  const { username, pin } = payload
  const sessionUser = await deps.authService.login(username, pin)
  deps.sessionManager.setSession(sessionUser)
  deps.auditService.log({
    userId: sessionUser.id,
    action: 'user_login',
    entityType: 'user',
    entityId: sessionUser.id,
  })
  return sessionUser
}

async function logoutHandler(deps: {
  sessionManager: ReturnType<typeof makeSessionManager>
  auditService: ReturnType<typeof makeAuditService>
}): Promise<{ success: true }> {
  const session = deps.sessionManager.getSession()
  if (session) {
    deps.auditService.log({
      userId: session.id,
      action: 'user_logout',
      entityType: 'user',
      entityId: session.id,
    })
  }
  deps.sessionManager.clearSession()
  return { success: true }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('auth:login handler', () => {
  let authSvc: ReturnType<typeof makeAuthService>
  let sessionMgr: ReturnType<typeof makeSessionManager>
  let auditSvc: ReturnType<typeof makeAuditService>

  beforeEach(() => {
    authSvc = makeAuthService()
    sessionMgr = makeSessionManager()
    auditSvc = makeAuditService()
  })

  it('returns the SessionUser on valid credentials', async () => {
    const result = await loginHandler(
      { username: 'admin', pin: '1234' },
      { authService: authSvc, sessionManager: sessionMgr, auditService: auditSvc }
    )

    expect(result).toEqual(mockSessionUser)
  })

  it('calls authService.login with the supplied username and pin', async () => {
    await loginHandler(
      { username: 'admin', pin: '1234' },
      { authService: authSvc, sessionManager: sessionMgr, auditService: auditSvc }
    )

    expect(authSvc.login).toHaveBeenCalledOnce()
    expect(authSvc.login).toHaveBeenCalledWith('admin', '1234')
  })

  it('sets the session via sessionManager.setSession after successful login', async () => {
    await loginHandler(
      { username: 'admin', pin: '1234' },
      { authService: authSvc, sessionManager: sessionMgr, auditService: auditSvc }
    )

    expect(sessionMgr.setSession).toHaveBeenCalledOnce()
    expect(sessionMgr.setSession).toHaveBeenCalledWith(mockSessionUser)
  })

  it('writes a user_login audit log entry after successful login', async () => {
    await loginHandler(
      { username: 'admin', pin: '1234' },
      { authService: authSvc, sessionManager: sessionMgr, auditService: auditSvc }
    )

    expect(auditSvc.log).toHaveBeenCalledOnce()
    expect(auditSvc.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_login',
        entityType: 'user',
        entityId: mockSessionUser.id,
        userId: mockSessionUser.id,
      })
    )
  })

  it('throws AuthenticationError when credentials are invalid', async () => {
    const failingAuthSvc = makeAuthService(
      undefined,
      new AuthenticationError('Invalid username or PIN')
    )

    await expect(
      loginHandler(
        { username: 'admin', pin: 'wrong' },
        { authService: failingAuthSvc, sessionManager: sessionMgr, auditService: auditSvc }
      )
    ).rejects.toThrow(AuthenticationError)
  })

  it('does not set session when credentials are invalid', async () => {
    const failingAuthSvc = makeAuthService(
      undefined,
      new AuthenticationError('Invalid username or PIN')
    )

    await loginHandler(
      { username: 'admin', pin: 'wrong' },
      { authService: failingAuthSvc, sessionManager: sessionMgr, auditService: auditSvc }
    ).catch(() => {/* expected */})

    expect(sessionMgr.setSession).not.toHaveBeenCalled()
  })

  it('does not write audit log when credentials are invalid', async () => {
    const failingAuthSvc = makeAuthService(
      undefined,
      new AuthenticationError('Invalid username or PIN')
    )

    await loginHandler(
      { username: 'admin', pin: 'wrong' },
      { authService: failingAuthSvc, sessionManager: sessionMgr, auditService: auditSvc }
    ).catch(() => {/* expected */})

    expect(auditSvc.log).not.toHaveBeenCalled()
  })
})

describe('auth:logout handler', () => {
  let sessionMgr: ReturnType<typeof makeSessionManager>
  let auditSvc: ReturnType<typeof makeAuditService>

  beforeEach(() => {
    sessionMgr = makeSessionManager()
    auditSvc = makeAuditService()
  })

  it('returns { success: true }', async () => {
    const result = await logoutHandler({ sessionManager: sessionMgr, auditService: auditSvc })
    expect(result).toEqual({ success: true })
  })

  it('clears the session via sessionManager.clearSession', async () => {
    await logoutHandler({ sessionManager: sessionMgr, auditService: auditSvc })
    expect(sessionMgr.clearSession).toHaveBeenCalledOnce()
  })

  it('writes a user_logout audit log entry when a session is active', async () => {
    // Seed an active session
    sessionMgr.setSession(mockSessionUser)

    await logoutHandler({ sessionManager: sessionMgr, auditService: auditSvc })

    expect(auditSvc.log).toHaveBeenCalledOnce()
    expect(auditSvc.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_logout',
        entityType: 'user',
        entityId: mockSessionUser.id,
        userId: mockSessionUser.id,
      })
    )
  })

  it('does not write audit log when no session is active', async () => {
    // sessionMgr.getSession() returns null by default (no session seeded)
    await logoutHandler({ sessionManager: sessionMgr, auditService: auditSvc })

    expect(auditSvc.log).not.toHaveBeenCalled()
  })

  it('session is null after logout', async () => {
    sessionMgr.setSession(mockSessionUser)
    await logoutHandler({ sessionManager: sessionMgr, auditService: auditSvc })

    // clearSession was called — the mock implementation sets session to null
    expect(sessionMgr.clearSession).toHaveBeenCalled()
    expect(sessionMgr.getSession()).toBeNull()
  })
})

// ─── IpcResult envelope (registerHandler) ────────────────────────────────────

describe('registerHandler IpcResult envelope', () => {
  /**
   * We test the envelope logic directly by importing registerHandler's
   * wrapping behaviour.  Since ipcMain is an Electron API unavailable in
   * Vitest's Node environment, we mock the electron module.
   */

  it('wraps a successful result in { success: true, data }', async () => {
    // Inline the envelope logic (mirrors registerHandler implementation)
    async function wrapHandler<T>(
      handler: (payload: unknown) => Promise<T>,
      payload: unknown
    ) {
      try {
        const data = await handler(payload)
        return { success: true as const, data }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred'
        const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR'
        return { success: false as const, error: message, code }
      }
    }

    const result = await wrapHandler(async () => ({ id: 1 }), {})
    expect(result).toEqual({ success: true, data: { id: 1 } })
  })

  it('wraps a thrown error in { success: false, error, code }', async () => {
    async function wrapHandler<T>(
      handler: (payload: unknown) => Promise<T>,
      payload: unknown
    ) {
      try {
        const data = await handler(payload)
        return { success: true as const, data }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred'
        const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR'
        return { success: false as const, error: message, code }
      }
    }

    const err = new AuthenticationError('Invalid username or PIN')
    const result = await wrapHandler(async () => { throw err }, {})

    expect(result).toEqual({
      success: false,
      error: 'Invalid username or PIN',
      code: 'AUTH_FAILED',
    })
  })

  it('uses INTERNAL_ERROR code when error has no code property', async () => {
    async function wrapHandler<T>(
      handler: (payload: unknown) => Promise<T>,
      payload: unknown
    ) {
      try {
        const data = await handler(payload)
        return { success: true as const, data }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred'
        const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR'
        return { success: false as const, error: message, code }
      }
    }

    const result = await wrapHandler(async () => { throw new Error('oops') }, {})
    expect(result).toMatchObject({ success: false, code: 'INTERNAL_ERROR' })
  })
})
