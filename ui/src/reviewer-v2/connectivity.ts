export type ConnectivityStatus = 'online' | 'offline'

export interface HeartbeatState {
  status: ConnectivityStatus
  failCount: number
}

export type HeartbeatEvent = { type: 'success' } | { type: 'failure' }

export const initialHeartbeatState: HeartbeatState = {
  status: 'online',
  failCount: 0,
}

export function nextHeartbeatState(
  state: HeartbeatState,
  event: HeartbeatEvent,
): HeartbeatState {
  switch (event.type) {
    case 'success':
      return { status: 'online', failCount: 0 }
    case 'failure': {
      const failCount = state.failCount + 1
      if (failCount >= 3) {
        return { status: 'offline', failCount }
      }
      return { status: state.status, failCount }
    }
  }
}
