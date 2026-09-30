// The backup archive's format: the paths in it and its desktop.json manifest.
// Pure. Special → Back Up All Files plans an archive here and
// apps/finder/backup.ts does the IO.
//
// Paths mirror the folder tree, so an unzipped backup reads as the desktop: a
// text file is its text, a folder is a directory entry, Macintosh HD is
// macintosh-hd/ and the Trash is trash/. A segment is the item's slug plus its
// extension, suffixed -2, -3 … inside one container, so the exact name lives in
// the manifest alone. A font's strikes are the app's, so a font is a manifest
// row with no entry.

import { childrenOf, containerOf, isVolume } from './files.ts'
import type { FilesState } from './files.ts'

export const MANIFEST_NAME = 'desktop.json'
export const BACKUP_FORMAT = 'system-online-desktop'
export const BACKUP_VERSION = 1

interface Row {
  id: string
  name: string
  createdAt: number
  modifiedAt: number
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
 * The archive for a library: its manifest and its entries, parents before
 * their children. Macintosh HD and the Trash are walked like any folder but
 * have no manifest row, so their items carry the folder id `"hd"` or
 * `"trash"` and come back there.
 */
export function planBackup(
  state: FilesState,
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
    const used = new Set<string>()
    for (const f of kids.folders) {
      if (seen.has(f.id)) continue // a looping chain is walked once
      seen.add(f.id)
      const path = prefix + segment(used, f.name, '/')
      entries.push({ kind: 'dir', path, id: f.id })
      if (!isVolume(f.id)) {
        manifest.folders.push({
          id: f.id,
          name: f.name,
          parent: containerOf(state, f.parent),
          createdAt: f.createdAt,
          modifiedAt: f.modifiedAt,
          path,
        })
      }
      walk(f.id, path)
    }
    for (const t of kids.texts) {
      const path = prefix + segment(used, t.name, '.txt')
      entries.push({ kind: 'text', path, id: t.id })
      manifest.texts.push({
        id: t.id,
        name: t.name,
        folder: containerOf(state, t.folder),
        createdAt: t.createdAt,
        modifiedAt: t.modifiedAt,
        builtin: t.builtin,
        path,
      })
    }
    for (const t of kids.fonts) {
      manifest.fonts.push({
        id: t.id,
        name: t.name,
        folder: containerOf(state, t.folder),
        createdAt: t.createdAt,
        modifiedAt: t.modifiedAt,
        family: t.family,
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
      path: str(f.path, 'path'),
    })),
    texts: texts.map((t) => ({
      id: str(t.id, 'id'),
      name: str(t.name, 'name'),
      folder: ref(t.folder),
      createdAt: time(t.createdAt),
      modifiedAt: time(t.modifiedAt),
      builtin: ref(t.builtin),
      path: str(t.path, 'path'),
    })),
    fonts: fonts.map((t) => ({
      id: str(t.id, 'id'),
      name: str(t.name, 'name'),
      folder: ref(t.folder),
      createdAt: time(t.createdAt),
      modifiedAt: time(t.modifiedAt),
      family: str(t.family, 'family'),
    })),
  }
}
