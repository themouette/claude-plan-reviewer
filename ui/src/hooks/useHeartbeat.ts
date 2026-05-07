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

export function useHeartbeat(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>(initialHeartbeatState.status)
  // failCount lives in a ref so increments do NOT trigger re-renders;
  // only ConnectivityStatus transitions go through setStatus.
  const stateRef = useRef<HeartbeatState>(initialHeartbeatState)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    // Generation token: each tick takes a fresh number; a tick whose generation
    // is no longer current must NOT touch state. This prevents a phantom failure
    // increment when an interval-driven tick is superseded mid-flight by a
    // visibilitychange-driven tick (which calls `abortRef.current?.abort()`,
    // causing the older tick's fetch to reject — that rejection is NOT a real
    // network failure and must be ignored). Code review WR-01.
    let generation = 0

    async function tick() {
      // Pitfall 5: pause for ANY non-visible state ('hidden', 'prerender', 'unloaded').
      if (document.visibilityState !== 'visible') return

      const myGen = ++generation

      // Defense-in-depth: cancel any prior in-flight request.
      // AbortSignal.timeout(3000) < 5000ms interval makes overlap structurally
      // impossible for the setInterval axis alone, but the visibilitychange
      // listener can still fire a fresh tick mid-flight. The generation guard
      // below prevents the superseded tick from poisoning failCount.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      const signal =
        typeof AbortSignal.any === 'function'
          ? AbortSignal.any([controller.signal, timeoutSignal])
          : timeoutSignal

      let event: HeartbeatEvent
      try {
        const res = await fetch('/api/ping', { signal })
        if (cancelled || myGen !== generation) return
        event = res.ok ? { type: 'success' } : { type: 'failure' }
      } catch {
        // Pitfall 1: do NOT inspect the thrown error — Chromium reports an
        // AbortError, Firefox/Safari report a TimeoutError. Branching on the
        // error type is non-portable. Treat ANY exception as a failure.
        // WR-01: a superseded tick's fetch rejection is NOT a real failure;
        // skip the state update via the generation guard.
        if (cancelled || myGen !== generation) return
        event = { type: 'failure' }
      }

      const next = nextHeartbeatState(stateRef.current, event)
      stateRef.current = next
      // Object.is bail-out: only re-render when the status string actually changes;
      // failCount changes from 0 -> 1 -> 2 do not flow into React state.
      setStatus((prev) => (prev === next.status ? prev : next.status))
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
