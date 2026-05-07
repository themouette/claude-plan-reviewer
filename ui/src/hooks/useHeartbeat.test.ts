import { describe, it, expect, vi } from 'vitest'
import {
  runHeartbeatTick,
  type HeartbeatTickContext,
} from './useHeartbeat'
import {
  initialHeartbeatState,
  type ConnectivityStatus,
  type HeartbeatState,
} from '../utils/connectivity'

/**
 * Behavioral tests for the wiring layer of useHeartbeat.
 *
 * Constraint (RESEARCH.md A1 / bundle-size policy): no `@testing-library/react`.
 * Strategy: drive the exported `runHeartbeatTick` helper directly with a fake
 * fetch and synthetic refs/state. The hook itself wires real refs into this
 * helper, so these tests exercise the same logic the hook runs in production.
 */

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

function ok(): Response {
  return new Response(null, { status: 200 })
}

function notOk(): Response {
  return new Response(null, { status: 503 })
}

describe('runHeartbeatTick', () => {
  it('returns immediately without fetching when visibility is not visible', async () => {
    const fetchSpy = vi.fn<typeof fetch>()
    const h = createHarness({ doFetch: () => Promise.resolve(ok()) })
    h.visible.value = false

    await runHeartbeatTick(h.ctx)

    expect(h.fetchCalls).toHaveLength(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(h.statuses).toHaveLength(0)
    expect(h.state.value.failCount).toBe(0)
  })

  it('records a success event when fetch returns res.ok', async () => {
    const h = createHarness({ doFetch: () => Promise.resolve(ok()) })

    await runHeartbeatTick(h.ctx)

    expect(h.state.value.status).toBe('online')
    expect(h.state.value.failCount).toBe(0)
    // onStatus is NOT fired when the status did not change (already online).
    expect(h.statuses).toHaveLength(0)
  })

  it('records a failure event when fetch returns non-ok', async () => {
    const h = createHarness({ doFetch: () => Promise.resolve(notOk()) })

    await runHeartbeatTick(h.ctx)

    expect(h.state.value.failCount).toBe(1)
    expect(h.state.value.status).toBe('online') // 1 failure: still online
  })

  it('records a failure event when fetch throws (any error class)', async () => {
    const h = createHarness({
      doFetch: () => Promise.reject(new DOMException('aborted', 'AbortError')),
    })

    await runHeartbeatTick(h.ctx)

    expect(h.state.value.failCount).toBe(1)
  })

  it('three consecutive failures transition status to offline', async () => {
    const h = createHarness({ doFetch: () => Promise.resolve(notOk()) })

    await runHeartbeatTick(h.ctx)
    await runHeartbeatTick(h.ctx)
    await runHeartbeatTick(h.ctx)

    expect(h.state.value.status).toBe('offline')
    expect(h.state.value.failCount).toBe(3)
    expect(h.statuses[h.statuses.length - 1]).toBe('offline')
  })

  it('aborts the prior controller when a new tick starts (defense-in-depth)', async () => {
    const fetchQueue: Array<{
      resolve: (r: Response) => void
      reject: (e: unknown) => void
      signal: AbortSignal
    }> = []
    const h = createHarness({
      doFetch: (signal) =>
        new Promise<Response>((resolve, reject) => {
          fetchQueue.push({ resolve, reject, signal })
          // Reject when aborted, mirroring real-world fetch semantics so
          // the suspended ticks actually finish.
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    })

    // Start tick A but do not let it resolve.
    const tickA = runHeartbeatTick(h.ctx)
    const controllerA = h.abort.value
    expect(controllerA).not.toBeNull()
    expect(controllerA!.signal.aborted).toBe(false)

    // Start tick B; it must abort controllerA before installing controllerB.
    const tickB = runHeartbeatTick(h.ctx)

    expect(controllerA!.signal.aborted).toBe(true)
    expect(h.abort.value).not.toBe(controllerA)

    // Resolve tick B's fetch with success; tick A already rejected on abort.
    fetchQueue[1].resolve(ok())
    await Promise.all([tickA, tickB])
  })

  it('WR-01: superseded tick whose fetch was aborted must NOT increment failCount', async () => {
    // Reproduce the race from WR-01 deterministically.
    // Sequence:
    //   1. Tick A starts; its fetch is queued (unresolved).
    //   2. Tick B starts; aborts A's controller, starts its own fetch.
    //   3. Tick A's fetch rejects (because its signal was aborted by B).
    //   4. Tick B's fetch resolves with success.
    // Before WR-01: A's catch path increments failCount to 1.
    // After WR-01: A's myGen no longer matches generation; A bails silently.
    const fetchQueue: Array<{
      resolve: (r: Response) => void
      reject: (e: unknown) => void
      signal: AbortSignal
    }> = []

    const h = createHarness({
      doFetch: (signal) =>
        new Promise<Response>((resolve, reject) => {
          fetchQueue.push({ resolve, reject, signal })
          // When the signal aborts (because a newer tick called .abort()),
          // make the fetch reject — that is exactly what the browser would do.
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    })

    const tickA = runHeartbeatTick(h.ctx) // generation = 1
    const tickB = runHeartbeatTick(h.ctx) // generation = 2; aborts A's controller

    // Tick B's fetch is the second entry in the queue; resolve it with success.
    // Tick A already rejected via the abort listener above.
    fetchQueue[1].resolve(ok())

    await Promise.all([tickA, tickB])

    // Critical assertion: failCount must be 0. Tick A's rejection (caused by
    // B's abort, NOT by network failure) must not have poisoned the counter.
    expect(h.state.value.failCount).toBe(0)
    expect(h.state.value.status).toBe('online')
  })

  it('WR-02: AbortSignal passed to fetch is composite (cleanup abort cancels fetch)', async () => {
    // The fix for WR-02 requires that the controller's signal IS wired into
    // the fetch — not just the timeout signal. Verify by aborting the
    // controller and checking the fetch's signal becomes aborted too.
    let capturedSignal: AbortSignal | null = null
    const h = createHarness({
      doFetch: (signal) => {
        capturedSignal = signal
        return new Promise<Response>(() => {
          /* never resolves */
        })
      },
    })

    void runHeartbeatTick(h.ctx)

    // Simulate effect cleanup aborting the controller.
    expect(h.abort.value).not.toBeNull()
    h.abort.value!.abort()

    expect(capturedSignal).not.toBeNull()
    expect(capturedSignal!.aborted).toBe(true)
  })

  it('cancelled flag prevents state update after fetch resolves', async () => {
    const fetchQueue: Array<(r: Response) => void> = []
    const h = createHarness({
      doFetch: () =>
        new Promise<Response>((resolve) => {
          fetchQueue.push(resolve)
        }),
    })

    const tick = runHeartbeatTick(h.ctx)

    // Effect cleanup runs while fetch is in flight.
    h.cancelled.value = true
    fetchQueue[0](ok())
    await tick

    // No status callback fired; state untouched.
    expect(h.statuses).toHaveLength(0)
    expect(h.state.value).toEqual(initialHeartbeatState)
  })
})
