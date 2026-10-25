// Shared stubs for the test suites. Not a test file: node --test runs
// *.test.mjs only.

/** The containers the catalog keeps, as it lists them for this desktop:
 *  Macintosh HD and the Trash, then the System Folder and its three folders. */
export const KEPT = [
  { id: 'disk', name: 'Macintosh HD', kind: 'disk', parent: null, createdAt: 0, modifiedAt: 0 },
  { id: 'trash', name: 'Trash', kind: 'trash', parent: null, createdAt: 0, modifiedAt: 0 },
  { id: 'system-folder', name: 'System Folder', kind: 'folder', parent: 'disk', createdAt: 0, modifiedAt: 0 },
  { id: 'apple-menu-items', name: 'Apple Menu Items', kind: 'folder', parent: 'system-folder', createdAt: 0, modifiedAt: 0 },
  { id: 'startup-items', name: 'Startup Items', kind: 'folder', parent: 'system-folder', createdAt: 0, modifiedAt: 0 },
  { id: 'fonts', name: 'Fonts', kind: 'folder', parent: 'system-folder', createdAt: 0, modifiedAt: 0 },
]

/** A catalog state: the kept containers, then `items`. */
export const listing = (...items) => ({ available: true, items: [...KEPT, ...items] })

/** What state/defaults.ts asks of the shell's catalog, get(), create() and
 *  update(), over a listing, with counting ids. The listing is exposed for
 *  edits. */
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
    async update(id, data) {
      const item = state.items.find((i) => i.id === id)
      if (item) item.data = data
      return item != null
    },
  }
}

/** The defaults' install over a catalog, as the shell's would leave it: a
 *  new icon of the application in `parent`, or, with `replace`, the icons it
 *  has. Each call is recorded in `calls`; an application in `refuse` rejects. */
export const installer =
  (c, calls = [], { refuse = [] } = {}) =>
  async ({ app }, { parent = null, replace = false }) => {
    calls.push(`${replace ? 'replace' : 'install'} ${app}`)
    if (refuse.includes(app)) throw new Error(`${app} was refused`)
    if (!replace) await c.create({ name: app, kind: 'app', parent, data: { app } })
  }
