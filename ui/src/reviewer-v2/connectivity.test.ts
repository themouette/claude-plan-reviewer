import { describe, it, expect } from 'vitest'
import {
  initialHeartbeatState,
  nextHeartbeatState,
  type HeartbeatState,
} from './connectivity'

describe('nextHeartbeatState', () => {
  it('Test 1: one failure stays online (failCount 1)', () => {
    const next = nextHeartbeatState(initialHeartbeatState, { type: 'failure' })
    expect(next.status).toBe('online')
    expect(next.failCount).toBe(1)
  })

  it('Test 2: two failures stay online (failCount 2)', () => {
    let s: HeartbeatState = initialHeartbeatState
    s = nextHeartbeatState(s, { type: 'failure' })
    s = nextHeartbeatState(s, { type: 'failure' })
    expect(s.status).toBe('online')
    expect(s.failCount).toBe(2)
  })

  it('Test 3: three consecutive failures transition to offline', () => {
    let s: HeartbeatState = initialHeartbeatState
    s = nextHeartbeatState(s, { type: 'failure' })
    s = nextHeartbeatState(s, { type: 'failure' })
    s = nextHeartbeatState(s, { type: 'failure' })
    expect(s.status).toBe('offline')
    expect(s.failCount).toBe(3)
  })

  it('Test 4: single success from offline returns to online and resets failCount', () => {
    const offline: HeartbeatState = { status: 'offline', failCount: 5 }
    const recovered = nextHeartbeatState(offline, { type: 'success' })
    expect(recovered.status).toBe('online')
    expect(recovered.failCount).toBe(0)
  })

  it('Test 5: success while degraded resets failCount without status change', () => {
    const partial: HeartbeatState = { status: 'online', failCount: 2 }
    const recovered = nextHeartbeatState(partial, { type: 'success' })
    expect(recovered.status).toBe('online')
    expect(recovered.failCount).toBe(0)
  })
})
