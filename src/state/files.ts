// The library: folders, text files and fonts, storage availability, and the
// storage operations on them. Browser dependencies arrive through init(), so
// the module runs under Node.
//
// - A folder is a record {id, name, parent, createdAt, modifiedAt}. An item's
//   `folder` is a folder id, or null for the desktop. An id with no folder row
//   resolves to the desktop. A folder cannot move into itself or a descendant.
// - Two containers have no record: Macintosh HD (HD) and the Trash (TRASH).
//   Their rows lead `folders`. Neither can be renamed, moved, removed or
//   copied. Nothing can be made or copied into the Trash. Deleting is a move
//   into it, and emptyTrash() removes its subtree.
// - A text file is a record with either `text` or `builtin`, a built-in's key.
//   A built-in's text is the app's (deps.builtinText) and is never stored.
// - A font is a record with `family`, a family the app ships. Its strikes are
//   the app's, never stored.
// - A text or font row whose built-in the app does not ship is left out of the
//   listing and stays in storage.

import { createStore } from './store.ts'

export const UNTITLED_FOLDER = 'untitled folder'
/** Macintosh HD's folder id. It has no storage record. */
export const HD = 'hd'
/** The Trash's folder id. It has no storage record. */
export const TRASH = 'trash'

export interface FolderRow {
  id: string
  name: string
  parent: string | null
  createdAt: number
  modifiedAt: number
}
export interface TextRow {
  id: string
  name: string
  folder: string | null
  createdAt: number
  modifiedAt: number
  /** The built-in's key, or null for a stored text. */
  builtin: string | null
  /** The text's UTF-8 byte length. */
  size: number
}
export interface FontRow {
  id: string
  name: string
  folder: string | null
  createdAt: number
  modifiedAt: number
  family: string
  /** The family's strikes, in bytes. */
  size: number
}
export interface FilesState {
  available: boolean
  folders: FolderRow[]
  texts: TextRow[]
  fonts: FontRow[]
}

export type FolderRecord = FolderRow
export interface TextRecord {
  id: string
  name: string
  folder?: string | null
  createdAt: number
  modifiedAt: number
  text?: string
  builtin?: string
}
export interface FontRecord {
  id: string
  name: string
  folder?: string | null
  createdAt: number
  modifiedAt: number
  family: string
}

/** The storage surface (storage/db.ts; test/helpers.mjs mirrors it). */
export interface LibraryStorage {
  listFolders(): Promise<FolderRecord[]>
  putFolder(r: FolderRecord): Promise<unknown>
  removeFolder(id: string): Promise<unknown>
  listTexts(): Promise<TextRecord[]>
  getText(id: string): Promise<TextRecord | undefined>
  putText(r: TextRecord): Promise<unknown>
  removeText(id: string): Promise<unknown>
  listFonts(): Promise<FontRecord[]>
  getFont(id: string): Promise<FontRecord | undefined>
  putFont(r: FontRecord): Promise<unknown>
  removeFont(id: string): Promise<unknown>
}

export interface FilesDeps {
  storage: LibraryStorage | null
  /** A built-in text by key, or null when the app does not ship it. */
  builtinText?: (key: string) => string | null
  /** A family's strikes in bytes, or null when the app does not ship it. */
  fontSize?: (family: string) => number | null
  now?: () => number
  newId?: () => string
}

/** The two kinds of item that are not folders. */
export type ItemKind = 'text' | 'font'

/** Macintosh HD's and the Trash's listing rows. createdAt 0 sorts them first. */
const HD_ROW: FolderRow = Object.freeze({
  id: HD,
  name: 'Macintosh HD',
  parent: null,
  createdAt: 0,
  modifiedAt: 0,
})
const TRASH_ROW: FolderRow = Object.freeze({
  id: TRASH,
  name: 'Trash',
  parent: null,
  createdAt: 0,
  modifiedAt: 0,
})

/** Whether a folder id is one of the two containers with no record. */
export const isVolume = (id: string | null | undefined): boolean => id === HD || id === TRASH

// Pure selectors

const folderExists = (state: FilesState, id: string | null): boolean =>
  id != null && state.folders.some((f) => f.id === id)

const parentOf = (state: FilesState, id: string): string | null =>
  state.folders.find((f) => f.id === id)?.parent ?? null

/** The container an item's folder resolves to: the folder while its row
 *  exists, else the desktop (null). */
export function containerOf(state: FilesState, folder: string | null | undefined): string | null {
  return folderExists(state, folder ?? null) ? (folder as string) : null
}

/** The folders, text files and fonts directly in a container (null: the
 *  desktop), each in listing order. */
export function childrenOf(
  state: FilesState,
  folder: string | null
): { folders: FolderRow[]; texts: TextRow[]; fonts: FontRow[] } {
  const target = containerOf(state, folder)
  return {
    folders: state.folders.filter((f) => f.id !== target && containerOf(state, f.parent) === target),
    texts: state.texts.filter((t) => containerOf(state, t.folder) === target),
    fonts: state.fonts.filter((t) => containerOf(state, t.folder) === target),
  }
}

/** The number of items directly in a container. */
export function itemCount(state: FilesState, folder: string | null): number {
  const c = childrenOf(state, folder)
  return c.folders.length + c.texts.length + c.fonts.length
}

/** Whether `ancestor` is on folder `id`'s parent chain. A folder is not inside
 *  itself. A looping chain stops at its first repeat. */
export function isInside(state: FilesState, id: string, ancestor: string): boolean {
  const seen = new Set<string>()
  let cur = parentOf(state, id)
  while (cur != null && !seen.has(cur)) {
    if (cur === ancestor) return true
    seen.add(cur)
    cur = parentOf(state, cur)
  }
  return false
}

/** Folder `id` and the folders around it, innermost first. The desktop ends
 *  the chain, and so does a folder with no row. A looping chain stops at its
 *  first repeat. */
export function enclosingFolders(state: FilesState, id: string | null | undefined): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  let cur = containerOf(state, id ?? null)
  while (cur != null && !seen.has(cur)) {
    ids.push(cur)
    seen.add(cur)
    cur = containerOf(state, parentOf(state, cur))
  }
  return ids
}

/** Whether a container is the Trash or inside it. */
export function isTrashed(state: FilesState, folder: string | null | undefined): boolean {
  const c = containerOf(state, folder ?? null)
  return c === TRASH || (c != null && isInside(state, c, TRASH))
}

/** Every folder, text file and font under a container, parents before their
 *  children. A looping chain is walked once. */
export function descendantsOf(
  state: FilesState,
  folder: string | null
): { folders: FolderRow[]; texts: TextRow[]; fonts: FontRow[] } {
  const folders: FolderRow[] = []
  const texts: TextRow[] = []
  const fonts: FontRow[] = []
  const seen = new Set<string>()
  const walk = (id: string | null) => {
    const kids = childrenOf(state, id)
    texts.push(...kids.texts)
    fonts.push(...kids.fonts)
    for (const f of kids.folders) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      folders.push(f)
      walk(f.id)
    }
  }
  walk(containerOf(state, folder))
  return { folders, texts, fonts }
}

/** The first free folder name in a container: "untitled folder",
 *  "untitled folder 2", … */
export function nextFolderName(state: FilesState, parent: string | null): string {
  const used = new Set(childrenOf(state, parent).folders.map((f) => f.name))
  if (!used.has(UNTITLED_FOLDER)) return UNTITLED_FOLDER
  for (let n = 2; ; n++) {
    const name = `${UNTITLED_FOLDER} ${n}`
    if (!used.has(name)) return name
  }
}

/** A name without a trailing " copy" or " copy N". */
const copyBase = (name: string) => name.replace(/ copy( \d+)?$/, '')

/**
 * The name for a copy in `folder`: `name` itself if no item of `kind` there has
 * it, else the base name (without a trailing " copy" or " copy N") plus
 * " copy", then " copy 2", " copy 3", … until one is free.
 */
export function copyName(
  state: FilesState,
  folder: string | null,
  name: string,
  kind: 'folder' | ItemKind
): string {
  const kids = childrenOf(state, folder)
  const rows = kind === 'folder' ? kids.folders : kind === 'text' ? kids.texts : kids.fonts
  const used = new Set(rows.map((x) => x.name))
  if (!used.has(name)) return name
  const base = copyBase(name)
  const first = `${base} copy`
  if (!used.has(first)) return first
  for (let n = 2; ; n++) {
    const next = `${base} copy ${n}`
    if (!used.has(next)) return next
  }
}

/** A read backup (state/backup.ts): the manifest's rows, each text paired
 *  with its text. */
export interface LibraryArchive {
  folders: { id: string; name: string; parent: string | null; createdAt: number; modifiedAt: number }[]
  texts: {
    id: string
    name: string
    folder: string | null
    createdAt: number
    modifiedAt: number
    builtin: string | null
    text: string
  }[]
  fonts: {
    id: string
    name: string
    folder: string | null
    createdAt: number
    modifiedAt: number
    family: string
  }[]
}

export interface ImportResult {
  folders: number
  texts: number
  fonts: number
  /** Rows that could not be stored: a font whose family is not shipped. */
  skipped: number
}

export function createFiles(deps: FilesDeps | null = null) {
  const NOTHING = (): FilesState => ({
    available: false,
    folders: [HD_ROW, TRASH_ROW],
    texts: [],
    fonts: [],
  })
  const store = createStore<FilesState>(NOTHING())
  let d = deps

  const now = () => (d?.now ?? Date.now)()
  const newId = () => (d?.newId ? d.newId() : crypto.randomUUID())
  const byCreation = <T extends { createdAt: number; id: string }>(a: T, b: T) =>
    a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1)
  const textSize = (text: string) => new TextEncoder().encode(text).byteLength
  /** A text record's text: the app's for a built-in, null for an unknown key. */
  const bodyOf = (rec: TextRecord): string | null =>
    rec.builtin != null ? (d?.builtinText?.(rec.builtin) ?? null) : String(rec.text ?? '')
  const storage = (): LibraryStorage => {
    if (!d?.storage) throw new Error('storage is unavailable')
    return d.storage
  }
  const folderRow = (id: string) => store.get().folders.find((f) => f.id === id) ?? null
  /** A new record's times: `at` when the caller orders a batch, else now. */
  const stamp = (at?: number) => {
    const t = at ?? now()
    return { createdAt: t, modifiedAt: t }
  }

  /** The storage calls for a text file or a font, by kind. */
  const io = {
    text: {
      get: (id: string) => storage().getText(id),
      put: (r: TextRecord | FontRecord) => storage().putText(r as TextRecord),
      remove: (id: string) => storage().removeText(id),
    },
    font: {
      get: (id: string) => storage().getFont(id),
      put: (r: TextRecord | FontRecord) => storage().putFont(r as FontRecord),
      remove: (id: string) => storage().removeFont(id),
    },
  }

  const api = {
    store,
    get: store.get,
    subscribe: store.subscribe,

    /** Sets the dependencies after construction. */
    init(realDeps: FilesDeps) {
      d = realDeps
    },

    /** Re-read the library from storage and set `available`. Macintosh HD's and
     *  the Trash's rows always lead `folders`. */
    async refresh(): Promise<void> {
      if (!d?.storage) {
        store.patch(NOTHING())
        return
      }
      try {
        const folderRecords = await d.storage.listFolders()
        const textRecords = await d.storage.listTexts()
        const fontRecords = await d.storage.listFonts()
        const folders = folderRecords
          .filter((r) => !isVolume(r.id))
          .map(({ id, name, parent, createdAt, modifiedAt }) => ({
            id,
            name,
            parent: parent ?? null,
            createdAt,
            modifiedAt,
          }))
          .sort(byCreation)
        const texts: TextRow[] = []
        for (const rec of textRecords) {
          const body = bodyOf(rec)
          if (body == null) continue
          texts.push({
            id: rec.id,
            name: rec.name,
            folder: rec.folder ?? null,
            createdAt: rec.createdAt,
            modifiedAt: rec.modifiedAt,
            builtin: rec.builtin ?? null,
            size: textSize(body),
          })
        }
        texts.sort(byCreation)
        const fonts: FontRow[] = []
        for (const rec of fontRecords) {
          const size = d.fontSize?.(rec.family) ?? null
          if (size == null) continue
          fonts.push({
            id: rec.id,
            name: rec.name,
            folder: rec.folder ?? null,
            createdAt: rec.createdAt,
            modifiedAt: rec.modifiedAt,
            family: rec.family,
            size,
          })
        }
        fonts.sort(byCreation)
        store.patch({ available: true, folders: [HD_ROW, TRASH_ROW, ...folders], texts, fonts })
      } catch (err) {
        // Otherwise a failed listing shows only as an empty desktop.
        console.warn('SystemOnline: the library could not be read —', err)
        store.patch(NOTHING())
      }
    },

    // Folders

    /** Make a folder in a container (`parent` null: the desktop), named `name`
     *  or the next free "untitled folder". Resolves `{id, name}`, or null when
     *  the container is trashed. */
    async createFolder({
      name,
      parent = null,
      at,
    }: { name?: string; parent?: string | null; at?: number } = {}) {
      const state = store.get()
      const target = containerOf(state, parent)
      if (isTrashed(state, target)) return null
      const finalName = name ?? nextFolderName(state, target)
      const id = newId()
      await storage().putFolder({ id, name: finalName, parent: target, ...stamp(at) })
      await api.refresh()
      return { id, name: finalName }
    },

    /** Rename a folder. Macintosh HD and the Trash keep their names. */
    async renameFolder(id: string, name: string): Promise<void> {
      const rec = folderRow(id)
      if (!rec || isVolume(id)) return
      await storage().putFolder({ ...rec, name, modifiedAt: now() })
      await api.refresh()
    },

    /**
     * Move a folder into another (`null`: the desktop). Resolves false without
     * moving when the target is the folder or inside it, when the folder is
     * gone or already there, or for Macintosh HD and the Trash.
     */
    async moveFolder(id: string, parent: string | null): Promise<boolean> {
      const state = store.get()
      const rec = folderRow(id)
      if (!rec || isVolume(id)) return false
      const target = containerOf(state, parent)
      if (target === id || (target != null && isInside(state, target, id))) return false
      if ((rec.parent ?? null) === target) return false
      await storage().putFolder({ ...rec, parent: target })
      await api.refresh()
      return true
    },

    /**
     * Copy a folder and its subtree into a container (`parent` null: the
     * desktop). Every copy gets a fresh id and times. Only the top folder is
     * renamed (`name`, else copyName). The subtree is read before any write,
     * so a folder copied into itself is copied once. Resolves `{id, name}`, or
     * null for Macintosh HD, the Trash, a missing source or a trashed target.
     */
    async copyFolder(id: string, { parent = null, name }: { parent?: string | null; name?: string } = {}) {
      const state = store.get()
      const rec = folderRow(id)
      if (!rec || isVolume(id)) return null
      const target = containerOf(state, parent)
      if (isTrashed(state, target)) return null
      const { folders: dirs, texts, fonts } = descendantsOf(state, id)
      const finalName = name ?? copyName(state, target, rec.name, 'folder')
      /** Old folder id -> its copy's id. */
      const map = new Map<string, string>()
      const putFolder = async (old: string, folderName: string, into: string | null) => {
        const nid = newId()
        map.set(old, nid)
        await storage().putFolder({ id: nid, name: folderName, parent: into, ...stamp() })
        return nid
      }
      const rootId = await putFolder(id, finalName, target)
      const within = (folder: string | null) => map.get(containerOf(state, folder) ?? '') ?? rootId
      // descendantsOf lists parents first, so each is mapped before its
      // children.
      for (const f of dirs) await putFolder(f.id, f.name, within(f.parent))
      for (const [kind, rows] of [
        ['text', texts],
        ['font', fonts],
      ] as const) {
        for (const r of rows) {
          const full = await io[kind].get(r.id)
          if (!full) continue
          await io[kind].put({ ...full, id: newId(), ...stamp(), folder: within(r.folder) })
        }
      }
      await api.refresh()
      return { id: rootId, name: finalName }
    },

    // Text files and fonts

    /** Store a new text file in a container (`folder` null: the desktop): its
     *  `text`, or with `builtin` the built-in's key alone. Resolves
     *  `{id, name}`, or null for a trashed target. */
    async createText({
      name,
      text,
      builtin = null,
      folder = null,
      at,
    }: {
      name: string
      text?: string
      builtin?: string | null
      folder?: string | null
      at?: number
    }) {
      const state = store.get()
      const target = containerOf(state, folder)
      if (isTrashed(state, target)) return null
      const id = newId()
      await storage().putText({
        id,
        name,
        ...(builtin != null ? { builtin } : { text: String(text ?? '') }),
        folder: target,
        ...stamp(at),
      })
      await api.refresh()
      return { id, name }
    },

    /** Store a new font of `family` in a container. Resolves `{id, name}`, or
     *  null for a trashed target. */
    async createFont({
      name,
      family,
      folder = null,
      at,
    }: {
      name: string
      family: string
      folder?: string | null
      at?: number
    }) {
      const state = store.get()
      const target = containerOf(state, folder)
      if (isTrashed(state, target)) return null
      const id = newId()
      await storage().putFont({ id, name, family, folder: target, ...stamp(at) })
      await api.refresh()
      return { id, name }
    },

    /** A text file's text. Null when the id is gone, its key is unknown or
     *  storage is unavailable. */
    async textOf(id: string): Promise<string | null> {
      if (!d?.storage) return null
      const rec = await d.storage.getText(id).catch(() => undefined)
      return rec ? bodyOf(rec) : null
    },

    /** A text file's listing row by id. */
    textRec(id: string): TextRow | null {
      return store.get().texts.find((t) => t.id === id) ?? null
    },

    /** A font's listing row by id. */
    fontRec(id: string): FontRow | null {
      return store.get().fonts.find((t) => t.id === id) ?? null
    },

    /** Rename a text file or font. `modifiedAt` is unchanged. */
    async renameItem(kind: ItemKind, id: string, name: string): Promise<void> {
      const rec = await io[kind].get(id)
      if (!rec) return
      await io[kind].put({ ...rec, name })
      await api.refresh()
    },

    /** Move a text file or font into a folder (`null`: the desktop). Resolves
     *  true when the record moved. */
    async moveItem(kind: ItemKind, id: string, folder: string | null): Promise<boolean> {
      const rec = await io[kind].get(id)
      if (!rec) return false
      const target = containerOf(store.get(), folder)
      if ((rec.folder ?? null) === target) return false
      await io[kind].put({ ...rec, folder: target })
      await api.refresh()
      return true
    },

    /** Copy a text file or font into a container as a new record with fresh
     *  times, named `name`, else by copyName. Resolves `{id, name}`, or null
     *  when the source is gone or the target is trashed. */
    async copyItem(
      kind: ItemKind,
      id: string,
      { folder = null, name }: { folder?: string | null; name?: string } = {}
    ) {
      const state = store.get()
      const target = containerOf(state, folder)
      if (isTrashed(state, target)) return null
      const rec = await io[kind].get(id)
      if (!rec) return null
      const finalName = name ?? copyName(state, target, rec.name, kind)
      const nid = newId()
      await io[kind].put({ ...rec, id: nid, name: finalName, folder: target, ...stamp() })
      await api.refresh()
      return { id: nid, name: finalName }
    },

    // The Trash and backups

    /** Remove every folder, text file and font under the Trash from storage.
     *  Resolves the removed ids. */
    async emptyTrash(): Promise<{ folders: string[]; texts: string[]; fonts: string[] }> {
      const { folders, texts, fonts } = descendantsOf(store.get(), TRASH)
      for (const t of texts) await storage().removeText(t.id)
      for (const t of fonts) await storage().removeFont(t.id)
      for (const f of folders) await storage().removeFolder(f.id)
      await api.refresh()
      return {
        folders: folders.map((f) => f.id),
        texts: texts.map((t) => t.id),
        fonts: fonts.map((t) => t.id),
      }
    },

    /** Remove every folder, text file and font, the Trash's included. Reads
     *  the stored listings rather than the slice, so a record the listing
     *  leaves out goes too. */
    async clearLibrary({ refresh = true }: { refresh?: boolean } = {}): Promise<void> {
      if (!d?.storage) return
      for (const t of await d.storage.listTexts()) await d.storage.removeText(t.id)
      for (const t of await d.storage.listFonts()) await d.storage.removeFont(t.id)
      for (const f of await d.storage.listFolders()) await d.storage.removeFolder(f.id)
      if (refresh) await api.refresh()
    },

    /**
     * Write a backup into storage. `replace` clears the library first and keeps
     * the archive's ids, so a backup restored over the profile that wrote it
     * finds its icon positions again. `merge` mints fresh ids and remaps the
     * containers, so the same archive can be added twice. Both keep the
     * archive's names and times. A font whose family the app does not ship is
     * skipped and counted. An archive nothing would come through from leaves
     * the library alone, so a replace cannot empty the desktop.
     */
    async importArchive(
      archive: LibraryArchive,
      { mode = 'merge' }: { mode?: 'merge' | 'replace' } = {}
    ): Promise<ImportResult | null> {
      if (!d?.storage) return null
      const replace = mode === 'replace'
      /** The archive's folder id -> the id written. */
      const map = new Map<string, string>()
      for (const f of archive.folders) map.set(f.id, replace ? f.id : newId())
      // Mapped in full first, so a manifest whose folders are out of order
      // still nests. An unknown container is the desktop.
      const into = (ref: string | null): string | null =>
        ref == null || isVolume(ref) ? ref : (map.get(ref) ?? null)
      const fonts = archive.fonts.filter((t) => d?.fontSize?.(t.family) != null)
      const skipped = archive.fonts.length - fonts.length
      if (!archive.folders.length && !archive.texts.length && !fonts.length) {
        return { folders: 0, texts: 0, fonts: 0, skipped }
      }

      if (replace) await api.clearLibrary({ refresh: false })
      for (const f of archive.folders) {
        await d.storage.putFolder({
          id: map.get(f.id) as string,
          name: f.name,
          parent: into(f.parent),
          createdAt: f.createdAt,
          modifiedAt: f.modifiedAt,
        })
      }
      // A built-in's key is kept only while the app still ships that text;
      // otherwise the archived text is stored, so nothing is lost.
      for (const t of archive.texts) {
        const known = t.builtin != null && d.builtinText?.(t.builtin) != null
        await d.storage.putText({
          id: replace ? t.id : newId(),
          name: t.name,
          ...(known ? { builtin: t.builtin as string } : { text: t.text }),
          folder: into(t.folder),
          createdAt: t.createdAt,
          modifiedAt: t.modifiedAt,
        })
      }
      for (const t of fonts) {
        await d.storage.putFont({
          id: replace ? t.id : newId(),
          name: t.name,
          family: t.family,
          folder: into(t.folder),
          createdAt: t.createdAt,
          modifiedAt: t.modifiedAt,
        })
      }
      await api.refresh()
      return {
        folders: archive.folders.length,
        texts: archive.texts.length,
        fonts: fonts.length,
        skipped,
      }
    },
  }
  return api
}

export type Files = ReturnType<typeof createFiles>

// The app's instance. main.ts injects its dependencies through init().
export const files = createFiles()
