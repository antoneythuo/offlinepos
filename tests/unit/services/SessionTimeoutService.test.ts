import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SessionTimeoutService, buildOnExpiredCallback } from '../../../src/services/SessionTimeoutService'
import { SessionManager } from '../../../src/services/SessionManager'
import type { SessionUser } from '../../../src/types/index'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IDLE_MINUTES = 5
const IDLE_MS = IDLE_MINUTES * 60 * 1000

function makeSessionUser(): SessionUser {
  return {
    id: 1,
    username: 'cashier',
    fullName: 'Test Cashier',
    roleId: 3,
    roleName: 'Cashier',
    permissions: { sales: true },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SessionTimeoutService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Timer fires after idle period ──────────────────────────────────────────

  it('calls onExpired after the configured idle time elapses', () => {
    const service = new SessionTimeoutService()
    const onExpired = vi.fn()

    service.start(IDLE_MINUTES, onExpired)

    // Just before the deadline — should NOT have fired
    vi.advanceTimersByTime(IDLE_MS - 1)
    expect(onExpired).not.toHaveBeenCalled()

    // Exactly at the deadline — should fire
    vi.advanceTimersByTime(1)
    expect(onExpired).toHaveBeenCalledOnce()
  })

  it('calls onExpired exactly once (not repeatedly)', () => {
    const service = new SessionTimeoutService()
    const onExpired = vi.fn()

    service.start(IDLE_MINUTES, onExpired)
    vi.advanceTimersByTime(IDLE_MS * 3)

    expect(onExpired).toHaveBeenCalledOnce()
  })

  it('respects the configured idle duration (1 minute)', () => {
    const service = new SessionTimeoutService()
    const onExpired = vi.fn()

    service.start(1, onExpired)

    vi.advanceTimersByTime(59_999)
    expect(onExpired).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onExpired).toHaveBeenCalledOnce()
  })

  // ── resetTimer() resets the countdown ─────────────────────────────────────

  it('resetTimer() prevents expiry if called before the deadline', () => {
    const service = new SessionTimeoutService()
    const onExpired = vi.fn()

    service.start(IDLE_MINUTES, onExpired)

    // Advance to just before expiry, then reset
    vi.advanceTimersByTime(IDLE_MS - 1)
    service.resetTimer()

    // Advance another full idle period minus 1ms — still should not fire
    vi.advanceTimersByTime(IDLE_MS - 1)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('resetTimer() restarts the full countdown from the reset point', () => {
    const service = new SessionTimeoutService()
    const onExpired = vi.fn()

    service.start(IDLE_MINUTES, onExpired)

    // Advance halfway, then reset
    vi.advanceTimersByTime(IDLE_MS / 2)
    service.resetTimer()

    // Advance the original remaining half — should NOT fire (timer was reset)
    vi.advanceTimersByTime(IDLE_MS / 2)
    expect(onExpired).not.toHaveBeenCalled()

    // Advance the remaining half of the NEW countdown — now it should fire
    vi.advanceTimersByTime(IDLE_MS / 2)
    expect(onExpired).toHaveBeenCalledOnce()
  })

  it('resetTimer() is a no-op when the timer has not been started', () => {
    const service = new SessionTimeoutService()
    // Should not throw
    expect(() => service.resetTimer()).not.toThrow()
  })

  it('resetTimer() is a no-op after stop()', () => {
    const service = new SessionTimeoutService()
    const onExpired = vi.fn()

    service.start(IDLE_MINUTES, onExpired)
    service.stop()
    service.resetTimer() // should not throw or restart the timer

    vi.advanceTimersByTime(IDLE_MS * 2)
    expect(onExpired).not.toHaveBeenCalled()
  })

  // ── stop() prevents the timer from firing ─────────────────────────────────

  it('stop() prevents onExpired from being called', () => {
    const service = new SessionTimeoutService()
    const onExpired = vi.fn()

    service.start(IDLE_MINUTES, onExpired)
    service.stop()

    vi.advanceTimersByTime(IDLE_MS * 2)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('stop() can be called before start() without throwing', () => {
    const service = new SessionTimeoutService()
    expect(() => service.stop()).not.toThrow()
  })

  it('stop() can be called multiple times without throwing', () => {
    const service = new SessionTimeoutService()
    const onExpired = vi.fn()

    service.start(IDLE_MINUTES, onExpired)
    service.stop()
    expect(() => service.stop()).not.toThrow()
  })

  // ── start() replaces an existing timer ────────────────────────────────────

  it('calling start() again replaces the previous timer', () => {
    const service = new SessionTimeoutService()
    const firstExpired = vi.fn()
    const secondExpired = vi.fn()

    service.start(IDLE_MINUTES, firstExpired)

    // Advance partway, then restart with a new callback
    vi.advanceTimersByTime(IDLE_MS / 2)
    service.start(IDLE_MINUTES, secondExpired)

    // Advance the full idle period from the restart point
    vi.advanceTimersByTime(IDLE_MS)

    expect(firstExpired).not.toHaveBeenCalled()
    expect(secondExpired).toHaveBeenCalledOnce()
  })

  // ── Injectable timer functions ─────────────────────────────────────────────

  it('uses injected timer functions instead of global setTimeout', () => {
    const fakeSetTimeout = vi.fn().mockReturnValue(42 as unknown as ReturnType<typeof setTimeout>)
    const fakeClearTimeout = vi.fn()

    const service = new SessionTimeoutService({
      setTimeout: fakeSetTimeout,
      clearTimeout: fakeClearTimeout,
    })

    const onExpired = vi.fn()
    service.start(IDLE_MINUTES, onExpired)

    expect(fakeSetTimeout).toHaveBeenCalledOnce()
    expect(fakeSetTimeout).toHaveBeenCalledWith(expect.any(Function), IDLE_MS)
  })

  it('calls injected clearTimeout when stop() is invoked', () => {
    const timerId = 99 as unknown as ReturnType<typeof setTimeout>
    const fakeSetTimeout = vi.fn().mockReturnValue(timerId)
    const fakeClearTimeout = vi.fn()

    const service = new SessionTimeoutService({
      setTimeout: fakeSetTimeout,
      clearTimeout: fakeClearTimeout,
    })

    service.start(IDLE_MINUTES, vi.fn())
    service.stop()

    expect(fakeClearTimeout).toHaveBeenCalledWith(timerId)
  })
})

// ─── buildOnExpiredCallback ───────────────────────────────────────────────────

describe('buildOnExpiredCallback', () => {
  it('clears the session when invoked', () => {
    const sm = new SessionManager()
    sm.setSession(makeSessionUser())

    const sendEvent = vi.fn()
    const callback = buildOnExpiredCallback(sm, sendEvent)

    callback()

    expect(sm.getSession()).toBeNull()
  })

  it('calls sendEvent with "session:expired" channel', () => {
    const sm = new SessionManager()
    const sendEvent = vi.fn()

    const callback = buildOnExpiredCallback(sm, sendEvent)
    callback()

    expect(sendEvent).toHaveBeenCalledOnce()
    expect(sendEvent).toHaveBeenCalledWith('session:expired')
  })

  it('clears session before sending the event', () => {
    const sm = new SessionManager()
    sm.setSession(makeSessionUser())

    const callOrder: string[] = []
    const sendEvent = vi.fn(() => {
      // At the time sendEvent is called, session should already be cleared
      callOrder.push(sm.getSession() === null ? 'session-cleared' : 'session-still-set')
    })

    const callback = buildOnExpiredCallback(sm, sendEvent)
    callback()

    expect(callOrder).toEqual(['session-cleared'])
  })
})
