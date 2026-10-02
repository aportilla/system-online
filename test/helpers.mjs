// Shared stubs for the test suites. Not a test file: node --test runs
// *.test.mjs only.

/** Macintosh HD and the Trash, as the catalog lists its volumes. */
export const VOLUMES = [
  { id: 'disk', name: 'Macintosh HD', kind: 'disk', parent: null, createdAt: 0, modifiedAt: 0 },
  { id: 'trash', name: 'Trash', kind: 'trash', parent: null, createdAt: 0, modifiedAt: 0 },
]

/** A catalog state: the volumes, then `items`. */
export const listing = (...items) => ({ available: true, items: [...VOLUMES, ...items] })

/** What state/defaults.ts asks of the shell's catalog, get() and create(),
 *  over a listing, with counting ids. The listing is exposed for edits. */
export function catalog(...items) {
  let n = 0
  const state = listing(...items)
  return {
    state,
    get: () => state,
    async create({ name, kind = 'folder', parent = null, data, at = 0 }) {
      const item = { id: `id${++n}`, name, kind, parent, createdAt: at, modifiedAt: at }
      if (data !== undefined) item.data = data
      state.items = [...state.items, item]
      return item
    },
  }
}
