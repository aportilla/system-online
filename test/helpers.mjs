// Shared stubs for the test suites. Not a test file: node --test runs
// *.test.mjs only.

/** An in-memory storage/db.ts. Its maps are exposed for assertions. */
export function memStorage() {
  const folders = new Map()
  const texts = new Map()
  const fonts = new Map()
  return {
    folders,
    texts,
    fonts,
    listFolders: async () => [...folders.values()],
    putFolder: async (r) => folders.set(r.id, r),
    removeFolder: async (id) => folders.delete(id),
    listTexts: async () => [...texts.values()],
    getText: async (id) => texts.get(id),
    putText: async (r) => texts.set(r.id, r),
    removeText: async (id) => texts.delete(id),
    listFonts: async () => [...fonts.values()],
    getFont: async (id) => fonts.get(id),
    putFont: async (r) => fonts.set(r.id, r),
    removeFont: async (id) => fonts.delete(id),
  }
}

/** A files slice over memStorage with a stepping clock and counting ids. The
 *  app ships the texts in `builtins` and the families in `families`. */
export async function library({ builtins = { 'read-me': 'Hello.' }, families = ['Geneva', 'Chicago'] } = {}) {
  const { createFiles } = await import('../src/state/files.ts')
  const storage = memStorage()
  let t = 1000
  let n = 0
  const files = createFiles({
    storage,
    builtinText: (key) => builtins[key] ?? null,
    fontSize: (family) => (families.includes(family) ? 100 : null),
    now: () => t++,
    newId: () => `id${++n}`,
  })
  await files.refresh()
  return { files, storage }
}
