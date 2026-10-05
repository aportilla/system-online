// The backup archive's format: the paths in it and its desktop.json manifest.
// Pure. Special → Back Up All Files plans an archive here from the catalog,
// and apps/finder/backup.ts does the IO.
//
// Paths mirror the folder tree, so an unzipped backup reads as the desktop: a
// text file is its text, a folder is a directory entry, Macintosh HD is
// macintosh-hd/ and the Trash is trash/. A segment is the item's slug plus its
// extension, suffixed -2, -3 … inside one container, so the exact name lives in
// the manifest alone. A font's strikes are the app's, so a font is a manifest
// row with no entry. A row carries its item's place in its container, when it
// has one, so Replace puts the icons back where they were.
//
// The manifest names Macintosh HD "hd", as SystemOnline's first library did,
// so backups from before the catalog still read.

import { DISK, FOLDER, childrenOf, isContainerKind } from 'vintage-frames/shell/pure'
import type { CatalogState, Item } from 'vintage-frames/shell/pure'
import { FONT, TEXT, fontFamily, textData } from './kinds.ts'

export const MANIFEST_NAME = 'desktop.json'
export const BACKUP_FORMAT = 'system-online-desktop'
export const BACKUP_VERSION = 1

/** Macintosh HD's id in a manifest. */
const HD = 'hd'

interface Row {
  id: string
  name: string
  createdAt: number
  modifiedAt: number
  left?: number
  top?: number
}
export interface BackupFolder extends Row {
  parent: string | null
  path: string
}
export interface BackupText extends Row {
  folder: string | null
  builtin: string | null
  path: string
}
export interface BackupFont extends Row {
  folder: string | null
  family: string
}
export interface BackupManifest {
  format: string
  v: number
  app: string
  exportedAt: string | null
  folders: BackupFolder[]
  texts: BackupText[]
  fonts: BackupFont[]
}
/** The archive's entries in write order, the manifest aside. */
export interface PlanEntry {
  kind: 'dir' | 'text'
  path: string
  id: string
}
/** A read backup's rows, each text with its words. */
export interface BackupContents {
  folders: BackupFolder[]
  texts: (BackupText & { text: string })[]
  fonts: BackupFont[]
}

/** An item's place, when it has one. */
const placeOf = (r: { left?: unknown; top?: unknown }): { left?: number; top?: number } =>
  typeof r.left === 'number' && Number.isFinite(r.left) && typeof r.top === 'number' && Number.isFinite(r.top)
    ? { left: r.left, top: r.top }
    : {}

/** "Cargo Ship" -> "cargo-ship". */
export const slugOf = (name: string): string => {
  const slug = (name || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "system-online-backup-2026-09-27.zip", the day in local time. */
export const backupFilename = (date = new Date()): string =>
  `system-online-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`

/** The first free path segment for a name in a container: its slug plus
 *  `ext`, then -2, -3 … */
function segment(used: Set<string>, name: string, ext: string): string {
  const slug = slugOf(name)
  let seg = `${slug}${ext}`
  for (let n = 2; used.has(seg); n++) seg = `${slug}-${n}${ext}`
  used.add(seg)
  return seg
}

/**
 * The archive for a catalog: its manifest and its entries, parents before
 * their children, and in each container its folders, then its text files,
 * then its fonts. Macintosh HD and the Trash are walked like any folder but
 * have no manifest row, so their items carry the folder id `"hd"` or
 * `"trash"` and come back there.
 */
export function planBackup(
  state: CatalogState,
  { app = '', date = new Date() }: { app?: string; date?: Date } = {}
): { manifest: BackupManifest; entries: PlanEntry[] } {
  const entries: PlanEntry[] = []
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    v: BACKUP_VERSION,
    app,
    exportedAt: date.toISOString(),
    folders: [],
    texts: [],
    fonts: [],
  }
  const seen = new Set<string>()
  const walk = (container: string | null, prefix: string) => {
    const kids = childrenOf(state, container)
    const ref = container === DISK ? HD : container
    const used = new Set<string>()
    for (const f of kids.filter((i) => isContainerKind(i.kind))) {
      if (seen.has(f.id)) continue // a looping chain is walked once
      seen.add(f.id)
      const path = prefix + segment(used, f.name, '/')
      entries.push({ kind: 'dir', path, id: f.id })
      if (f.kind === FOLDER) {
        manifest.folders.push({
          id: f.id,
          name: f.name,
          parent: ref,
          createdAt: f.createdAt,
          modifiedAt: f.modifiedAt,
          ...placeOf(f),
          path,
        })
      }
      walk(f.id, path)
    }
    for (const t of kids.filter((i) => i.kind === TEXT)) {
      const path = prefix + segment(used, t.name, '.txt')
      entries.push({ kind: 'text', path, id: t.id })
      manifest.texts.push({
        id: t.id,
        name: t.name,
        folder: ref,
        createdAt: t.createdAt,
        modifiedAt: t.modifiedAt,
        ...placeOf(t),
        builtin: textData(t).builtin,
        path,
      })
    }
    for (const t of kids.filter((i) => i.kind === FONT)) {
      manifest.fonts.push({
        id: t.id,
        name: t.name,
        folder: ref,
        createdAt: t.createdAt,
        modifiedAt: t.modifiedAt,
        ...placeOf(t),
        family: fontFamily(t),
      })
    }
  }
  walk(null, '')
  return { manifest, entries }
}

/** A required string field. */
function str(v: unknown, what: string): string {
  if (typeof v !== 'string' || !v) throw new Error(`its desktop.json has a row with no ${what}`)
  return v
}

/** A time, or 0. */
const time = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** A container reference or a key: a string, or null. */
const ref = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** Validate and normalize a desktop.json. Throws an Error whose message says
 *  what is wrong with it, for the alert. */
export function readManifest(text: string): BackupManifest {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('its desktop.json is not readable')
  }
  if (!parsed || typeof parsed !== 'object' || parsed.format !== BACKUP_FORMAT) {
    throw new Error('it is not a SystemOnline backup')
  }
  const v = parsed.v
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new Error('its desktop.json has no version')
  }
  if (v > BACKUP_VERSION) {
    throw new Error(`it was made by a newer version of SystemOnline (backup version ${v})`)
  }
  const rows = (key: string): Record<string, unknown>[] => {
    const list = parsed[key]
    if (!Array.isArray(list)) throw new Error('its desktop.json is incomplete')
    return list.map((r) => (r && typeof r === 'object' ? r : {}))
  }
  const folders = rows('folders')
  const texts = rows('texts')
  const fonts = rows('fonts')
  return {
    format: BACKUP_FORMAT,
    v,
    app: typeof parsed.app === 'string' ? parsed.app : '',
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    folders: folders.map((f) => ({
      id: str(f.id, 'id'),
      name: str(f.name, 'name'),
      parent: ref(f.parent),
      createdAt: time(f.createdAt),
      modifiedAt: time(f.modifiedAt),
      ...placeOf(f),
      path: str(f.path, 'path'),
    })),
    texts: texts.map((t) => ({
      id: str(t.id, 'id'),
      name: str(t.name, 'name'),
      folder: ref(t.folder),
      createdAt: time(t.createdAt),
      modifiedAt: time(t.modifiedAt),
      ...placeOf(t),
      builtin: ref(t.builtin),
      path: str(t.path, 'path'),
    })),
    fonts: fonts.map((t) => ({
      id: str(t.id, 'id'),
      name: str(t.name, 'name'),
      folder: ref(t.folder),
      createdAt: time(t.createdAt),
      modifiedAt: time(t.modifiedAt),
      ...placeOf(t),
      family: str(t.family, 'family'),
    })),
  }
}

/**
 * A read backup as catalog items, for the catalog's import. A text keeps its
 * built-in's key while the app still ships that text, else its words are
 * stored, so nothing is lost. A font whose family the app doesn't ship is
 * skipped and counted. `places` keeps each row's place, for Replace; without
 * it the items take their containers' free cells, for Add.
 */
export function itemsOf(
  contents: BackupContents,
  {
    shipsText,
    shipsFamily,
    places,
  }: { shipsText: (key: string) => boolean; shipsFamily: (family: string) => boolean; places: boolean }
): { items: Item[]; skipped: number } {
  const item = (r: Row, kind: string, parent: string | null): Item => ({
    id: r.id,
    name: r.name,
    kind,
    parent: parent === HD ? DISK : parent,
    createdAt: r.createdAt,
    modifiedAt: r.modifiedAt,
    ...(places ? placeOf(r) : {}),
  })
  const items: Item[] = contents.folders.map((f) => item(f, FOLDER, f.parent))
  for (const t of contents.texts) {
    const data = t.builtin != null && shipsText(t.builtin) ? { builtin: t.builtin } : { text: t.text }
    items.push({ ...item(t, TEXT, t.folder), data })
  }
  const fonts = contents.fonts.filter((t) => shipsFamily(t.family))
  for (const t of fonts) items.push({ ...item(t, FONT, t.folder), data: { family: t.family } })
  return { items, skipped: contents.fonts.length - fonts.length }
}
