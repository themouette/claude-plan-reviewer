import { useEffect, useRef, useState } from 'react'
import {
  initialHeartbeatState,
  nextHeartbeatState,
  type ConnectivityStatus,
  type HeartbeatEvent,
  type HeartbeatState,
} from '../utils/connectivity'

const POLL_INTERVAL_MS = 5000
const REQUEST_TIMEOUT_MS = 3000

/**
 * Test-only export. Body of a single heartbeat tick with every dependency
 * injected so it can be exercised without a React renderer (the project
 * bans `@testing-library/react` per RESEARCH.md A1 / bundle-size policy).
 *
 * Generation semantics (WR-01): a tick whose `myGen` no longer equals
 * `getCurrentGeneration()` after an `await` MUST NOT touch state — its
 * fetch was aborted by a newer tick, not by a real network failure.
 *
 * Never throws: any error during fetch becomes `{ type: 'failure' }`
 * (Pitfall 1: do NOT inspect err.name — Chromium throws AbortError,
 * Firefox/Safari throw TimeoutError).
 */
export interface HeartbeatTickContext {
  doFetch: (signal: AbortSignal) => Promise<Response>
  isVisible: () => boolean
  isCancelled: () => boolean
  getNextGeneration: () => number
  getCurrentGeneration: () => number
  getAbortController: () => AbortController | null
  setAbortController: (c: AbortController | null) => void
  getState: () => HeartbeatState
  setState: (s: HeartbeatState) => void
  onStatus: (s: ConnectivityStatus) => void
  timeoutMs: number
}

export async function runHeartbeatTick(ctx: HeartbeatTickContext): Promise<void> {
  // Pitfall 5: pause for ANY non-visible state ('hidden', 'prerender', 'unloaded').
  if (!ctx.isVisible()) return

  const myGen = ctx.getNextGeneration()

  // Defense-in-depth: cancel any prior in-flight request.
  // AbortSignal.timeout(3000) < 5000ms interval makes overlap structurally
  // impossible for the setInterval axis alone, but the visibilitychange
  // listener can still fire a fresh tick mid-flight. The generation guard
  // below prevents the superseded tick from poisoning failCount.
  ctx.getAbortController()?.abort()
  const controller = new AbortController()
  ctx.setAbortController(controller)

  // WR-02: AbortSignal.any and AbortSignal.timeout shipped in the same
  // browser-version cohort (Chrome 116+, Safari 17.4+, Firefox 124+,
  // Baseline 2024); accepting one and feature-checking the other buys
  // nothing, and the previous fallback silently disabled cleanup-time
  // cancellation by dropping `controller.signal` from the fetch.
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(ctx.timeoutMs),
  ])

  let event: HeartbeatEvent
  try {
    const res = await ctx.doFetch(signal)
    if (ctx.isCancelled() || myGen !== ctx.getCurrentGeneration()) return
    event = res.ok ? { type: 'success' } : { type: 'failure' }
  } catch {
    // Pitfall 1: do NOT inspect the thrown error — Chromium reports an
    // AbortError, Firefox/Safari report a TimeoutError. Branching on the
    // error type is non-portable. Treat ANY exception as a failure.
    // WR-01: a superseded tick's fetch rejection is NOT a real failure;
    // skip the state update via the generation guard.
    if (ctx.isCancelled() || myGen !== ctx.getCurrentGeneration()) return
    event = { type: 'failure' }
  }

  const prev = ctx.getState()
  const next = nextHeartbeatState(prev, event)
  ctx.setState(next)
  // Only notify on actual status transitions (online→offline, offline→online).
  // Calling onStatus every successful tick would schedule a React state update
  // on each 5-second heartbeat even when status is unchanged, triggering renders
  // and layout effects for zero UI change.
  if (next.status !== prev.status) {
    ctx.onStatus(next.status)
  }
}

export function useHeartbeat(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>(initialHeartbeatState.status)
  // failCount lives in a ref so increments do NOT trigger re-renders;
  // only ConnectivityStatus transitions go through setStatus.
  const stateRef = useRef<HeartbeatState>(initialHeartbeatState)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    // Generation token: each tick takes a fresh number; a tick whose generation
    // is no longer current must NOT touch state. Prevents phantom failCount
    // increments when an interval-driven tick is superseded mid-flight by a
    // visibilitychange-driven tick. Code review WR-01.
    let generation = 0

    async function tick() {
      await runHeartbeatTick({
        doFetch: (signal) => fetch('/api/ping', { signal }),
        isVisible: () => document.visibilityState === 'visible',
        isCancelled: () => cancelled,
        getNextGeneration: () => ++generation,
        getCurrentGeneration: () => generation,
        getAbortController: () => abortRef.current,
        setAbortController: (c) => {
          abortRef.current = c
        },
        getState: () => stateRef.current,
        setState: (s) => {
          stateRef.current = s
        },
        // Object.is bail-out: only re-render when the status string actually
        // changes; failCount churn from 0 -> 1 -> 2 does not flow into React state.
        onStatus: (s) => setStatus((prev) => (prev === s ? prev : s)),
        timeoutMs: REQUEST_TIMEOUT_MS,
      })
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        // Pitfall 7: fire an immediate tick on resume so the user does not wait
        // up to 5s for the next interval after returning to the tab.
        void tick()
      }
    }

    // Immediate first tick on mount — surfaces real reachability promptly
    // without falsely flashing 'offline' on slow startup.
    void tick()
    const id = window.setInterval(tick, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      abortRef.current?.abort()
    }
  }, [])

  return status
}
