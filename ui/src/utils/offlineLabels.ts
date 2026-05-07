import type { ConnectivityStatus } from './connectivity'

export const OFFLINE_BANNER_LINE_1 = 'Server connection lost — working offline.'
export const OFFLINE_BANNER_LINE_2 =
  "When you're done, copy your decision to the clipboard and paste it back into Claude."

export const OFFLINE_APPROVE_LABEL = 'Copy to clipboard — approve'
export const OFFLINE_DENY_LABEL = 'Copy to clipboard — deny'
export const OFFLINE_SUBMIT_DENIAL_LABEL = 'Copy to clipboard'

export function approveButtonLabel(
  status: ConnectivityStatus,
  defaultLabel: string,
): string {
  return status === 'offline' ? OFFLINE_APPROVE_LABEL : defaultLabel
}

export function denyButtonLabel(
  status: ConnectivityStatus,
  defaultLabel: string,
): string {
  return status === 'offline' ? OFFLINE_DENY_LABEL : defaultLabel
}

export function submitDenialButtonLabel(status: ConnectivityStatus): string {
  return status === 'offline' ? OFFLINE_SUBMIT_DENIAL_LABEL : 'Submit Denial'
}
