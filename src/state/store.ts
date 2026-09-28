// A minimal observable store. Every slice is built on it.
//
// - get() returns the current snapshot. patch() replaces the object, so
//   Object.is on two snapshots detects a change.
// - patch() does nothing when every key is Object.is-equal to the current value.
// - Values are held by reference and never cloned.
// - Notification is synchronous and covers the whole slice.

export interface Store<S extends object> {
  get(): S
  patch(partial: Partial<S>): void
  /** Returns the unsubscribe. */
  subscribe(fn: (s: S) => void): () => void
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state: S = { ...initial }
  const listeners = new Set<(s: S) => void>()
  return {
    get: () => state,
    patch(partial) {
      let changed = false
      for (const k in partial) {
        if (!Object.is(state[k], partial[k])) {
          changed = true
          break
        }
      }
      if (!changed) return
      state = { ...state, ...partial }
      for (const fn of listeners) fn(state)
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}
