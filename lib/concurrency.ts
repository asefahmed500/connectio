import 'server-only'

/**
 * Per-key connection counter, used to cap concurrent SSE streams per user.
 *
 * Lives in module scope — accurate as long as the Node.js process is the only
 * one handling SSE for a given user. In a multi-instance deployment the cap
 * is enforced per-instance (still effective — multiplied by N instances it
 * remains a useful upper bound). For a global cap, swap the in-memory Map
 * for a Redis INCR/DECR pair.
 */

const counters = new Map<string, number>()

/**
 * Attempts to acquire a slot for `key`. Returns true if the current count is
 * below `max`; false otherwise. Caller MUST call `release` in its finally
 * block to avoid leaks.
 */
export function acquireConnectionSlot(key: string, max: number): boolean {
  const current = counters.get(key) ?? 0
  if (current >= max) return false
  counters.set(key, current + 1)
  return true
}

export function releaseConnectionSlot(key: string): void {
  const current = counters.get(key)
  if (current === undefined) return
  if (current <= 1) counters.delete(key)
  else counters.set(key, current - 1)
}

export function activeConnectionsFor(key: string): number {
  return counters.get(key) ?? 0
}

/** Default cap — per-user across all SSE streams (notifications + comments). */
export const DEFAULT_MAX_STREAMS_PER_USER = 5
