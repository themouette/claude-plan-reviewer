import { describe, it, expect } from 'vitest'
import {
  runHeartbeatTick,
  type HeartbeatTickContext,
} from './useHeartbeat'
import {
  initialHeartbeatState,
  type ConnectivityStatus,
  type HeartbeatState,
} from './connectivity'

interface Harness {
  ctx: HeartbeatTickContext
  state: { value: HeartbeatState }
  abort: { value: AbortController | null }
  generation: { value: number }
  cancelled: { value: boolean }
  visible: { value: boolean }
  statuses: ConnectivityStatus[]
  fetchCalls: AbortSignal[]
}

function createHarness(opts: {
  doFetch: (signal: AbortSignal) => Promise<Response>
}): Harness {
  const state = { value: { ...initialHeartbeatState } }
  const abort: { value: AbortController | null } = { value: null }
  const generation = { value: 0 }
  const cancelled = { value: false }
  const visible = { value: true }
  const statuses: ConnectivityStatus[] = []
  const fetchCalls: AbortSignal[] = []

  const ctx: HeartbeatTickContext = {
    doFetch: (signal) => {
      fetchCalls.push(signal)
      return opts.doFetch(signal)
    },
    isVisible: () => visible.value,
    isCancelled: () => cancelled.value,
    getNextGeneration: () => ++generation.value,
    getCurrentGeneration: () => generation.value,
    getAbortController: () => abort.value,
    setAbortController: (c) => {
      abort.value = c
    },
    getState: () => state.value,
    setState: (s) => {
      state.value = s
    },
    onStatus: (s) => {
      statuses.push(s)
    },
    timeoutMs: 3000,
  }

  return { ctx, state, abort, generation, cancelled, visible, statuses, fetchCalls }
}

describe('runHeartbeatTick (v2 copy)', () => {
  it('v2 copy: successful fetch keeps status online without calling onStatus', async () => {
    const h = createHarness({
      doFetch: () => Promise.resolve(new Response(null, { status: 200 })),
    })

    await runHeartbeatTick(h.ctx)

    expect(h.state.value.status).toBe('online')
    expect(h.statuses).toHaveLength(0)
  })
})
