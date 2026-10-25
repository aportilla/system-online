// The files a desktop comes with: the system's documents (src/texts/), each
// default application installed from its file at its home, one font suitcase
// per family the system serves, in the System Folder's Fonts, and the System
// Folder's own: a Control Panels folder, and in Apple Menu Items an alias of
// it and one of the App Store. They are the catalog's seed, stored once per
// storage; Special → Restore Default Files stores the ones missing since. A
// desktop from before nothing was built in is moved onto installed
// applications once (moveToInstalled). Before the System Folder had Fonts,
// the suitcases lived in a Fonts folder in Macintosh HD (formerFonts).

import {
  ALIAS_KIND,
  APPLE_MENU_ITEMS,
  APP_KIND,
  DISK,
  FOLDER,
  FONTS,
  FONT_KIND,
  SYSTEM_FOLDER,
  appIdOf,
  fontFamilyOf,
  isTrashed,
  resolve,
} from 'system-online-sdk/pure'
import type { Catalog, CatalogState, Item } from 'system-online-sdk/pure'
import { TEXT, docPath, textData } from './kinds.ts'
import type { TextData } from './kinds.ts'

/** The folder the control panels live in, directly in the System Folder. */
export const CONTROL_PANELS_FOLDER = 'Control Panels'

/** The folder the suitcases lived in, directly in Macintosh HD, before the
 *  System Folder had Fonts. */
const FORMER_FONTS = 'Fonts'

/** Where a default is stored: on the desktop, directly in Macintosh HD, or
 *  in the System Folder's Control Panels. */
export type Home = 'desktop' | 'disk' | 'control-panels'

/** A system document: its key, its name, and where it is stored. */
export interface TextDefault {
  key: string
  name: string
  home: Home
}

/** A default application: its id, where it's installed, and the name of an
 *  alias of it in Apple Menu Items, when it has one there. */
export interface AppDefault {
  app: string
  home: Home
  alias?: string
}

/** Installs a default application from its file: a new icon in `parent`, or,
 *  with `replace`, the file given to the icons it has. Rejects when it
 *  doesn't install. */
export type InstallDefault = (app: AppDefault, options: { parent?: string | null; replace?: boolean }) => Promise<void>

/** Everything a desktop comes with. */
export interface Defaults<T extends TextDefault = TextDefault> {
  texts: T[]
  apps: AppDefault[]
  families: string[]
  /** The System Folder's folders Apple Menu Items holds an alias of, by
   *  name: each a submenu of the Apple menu. */
  appleMenu: string[]
}

/** The first folder named `name` directly in `parent`, or null. */
const folderIn = (items: readonly Item[], parent: string, name: string): string | null =>
  items.find((i) => i.kind === FOLDER && i.parent === parent && i.name === name)?.id ?? null

/** The icons of application `app`. */
const iconsOf = (state: CatalogState, app: string): Item[] =>
  state.items.filter((i) => i.kind === APP_KIND && appIdOf(i) === app)

/**
 * The system documents whose keys no text file carries, the applications no
 * icon names, the families no suitcase carries, the folders no alias stands
 * for, and the applications no alias stands for an icon of. A trashed or
 * renamed one counts as present, so a restore never duplicates one: an alias
 * counts while it stands for a folder of that name, or an icon of that
 * application, wherever either is. An application's alias is missing only
 * when there's an icon to stand for, outside the Trash, or the application
 * goes back with it.
 */
export function missingDefaults<T extends TextDefault>(
  state: CatalogState,
  { texts, apps, families, appleMenu }: Defaults<T>
): { texts: T[]; apps: AppDefault[]; fonts: string[]; appleMenu: string[]; aliases: AppDefault[] } {
  const keys = new Set(state.items.filter((i) => i.kind === TEXT).map((i) => textData(i).key))
  const installed = new Set(state.items.filter((i) => i.kind === APP_KIND).map(appIdOf))
  const carried = new Set(state.items.map(fontFamilyOf))
  const originals = state.items.filter((i) => i.kind === ALIAS_KIND).flatMap((i) => resolve(state, i.id) ?? [])
  const folders = new Set(originals.filter((o) => o.kind === FOLDER).map((o) => o.name))
  const icons = new Set(originals.filter((o) => o.kind === APP_KIND).map(appIdOf))
  const missingApps = apps.filter((a) => !installed.has(a.app))
  return {
    texts: texts.filter((t) => !keys.has(t.key)),
    apps: missingApps,
    fonts: families.filter((f) => !carried.has(f)),
    appleMenu: appleMenu.filter((name) => !folders.has(name)),
    aliases: apps.filter(
      (a) =>
        a.alias != null &&
        !icons.has(a.app) &&
        (missingApps.includes(a) || iconsOf(state, a.app).some((i) => !isTrashed(state, i.id)))
    ),
  }
}

/**
 * Store the missing defaults: each document at its home, each application
 * installed at its home through `install`, each suitcase in the System
 * Folder's Fonts, and each alias in Apple Menu Items, of a System Folder's
 * folder, made again there if it is gone, or of an application's icon
 * outside the Trash. An application that doesn't install leaves the rest to
 * go back, then the first failure rejects. The times step by a millisecond,
 * so the listing keeps the order given.
 */
export async function restoreDefaults(
  catalog: Pick<Catalog, 'get' | 'create'>,
  defaults: Defaults,
  { install, now = Date.now }: { install: InstallDefault; now?: () => number }
): Promise<void> {
  const missing = missingDefaults(catalog.get(), defaults)
  const failures: unknown[] = []
  let at = now()
  /** Folder `name` directly in `parent`, made there if it is gone. */
  const folder = async (parent: string, name: string): Promise<string | null> =>
    folderIn(catalog.get().items, parent, name) ??
    (await catalog.create({ kind: FOLDER, name, parent, at: at++ }))?.id ??
    null
  const homeOf = async (home: Home): Promise<string | null> =>
    home === 'disk' ? DISK : home === 'control-panels' ? folder(SYSTEM_FOLDER, CONTROL_PANELS_FOLDER) : null
  for (const t of missing.texts) {
    await catalog.create({ kind: TEXT, name: t.name, parent: await homeOf(t.home), data: { path: docPath(t.key) }, at: at++ })
  }
  for (const a of missing.apps) {
    await install(a, { parent: await homeOf(a.home) }).catch((err: unknown) => void failures.push(err))
  }
  for (const family of missing.fonts) {
    await catalog.create({ kind: FONT_KIND, name: family, parent: FONTS, data: { family }, at: at++ })
  }
  for (const name of missing.appleMenu) {
    const original = await folder(SYSTEM_FOLDER, name)
    if (original == null) continue
    await catalog.create({ kind: ALIAS_KIND, name, parent: APPLE_MENU_ITEMS, data: { original, kind: FOLDER }, at: at++ })
  }
  for (const a of missing.aliases) {
    const st = catalog.get()
    const icon = iconsOf(st, a.app).find((i) => !isTrashed(st, i.id))
    if (icon == null || a.alias == null) continue
    await catalog.create({
      kind: ALIAS_KIND,
      name: a.alias,
      parent: APPLE_MENU_ITEMS,
      data: { original: icon.id, kind: APP_KIND },
      at: at++,
    })
  }
  if (failures.length) throw failures[0]
}

/**
 * Move a desktop from before nothing was built in onto installed
 * applications, once. First its system documents' keys become paths, the
 * ones the site still serves, so the Text Viewer, installed next, never sees
 * one. Then each default application whose icons have no file is given it,
 * keeping the icons, their places and aliases, and what the application kept
 * under them. Then the defaults it never had an icon of, the applications
 * not in `had`, are installed at their homes, with their aliases. One the
 * visitor removed stays removed: Restore Default Files brings it back.
 * `kept` says whether the shell keeps an application's file. Every step is
 * tried, then the first failure rejects.
 */
export async function moveToInstalled(
  catalog: Pick<Catalog, 'get' | 'create' | 'update'>,
  defaults: Defaults,
  {
    had,
    kept,
    install,
    now = Date.now,
  }: { had: readonly string[]; kept: (app: string) => boolean; install: InstallDefault; now?: () => number }
): Promise<void> {
  const failures: unknown[] = []
  const served = new Set(defaults.texts.map((t) => t.key))
  for (const item of catalog.get().items) {
    const { builtin, path } = (item.data ?? {}) as TextData
    if (item.kind !== TEXT || path || typeof builtin !== 'string' || !served.has(builtin)) continue
    await catalog.update(item.id, { path: docPath(builtin) })
  }
  const st = catalog.get()
  for (const a of defaults.apps) {
    if (!iconsOf(st, a.app).length || kept(a.app)) continue
    await install(a, { replace: true }).catch((err: unknown) => void failures.push(err))
  }
  const added = { texts: [], apps: defaults.apps.filter((a) => !had.includes(a.app)), families: [], appleMenu: [] }
  await restoreDefaults(catalog, added, { install, now }).catch((err: unknown) => void failures.push(err))
  if (failures.length) throw failures[0]
}

/**
 * What files into the System Folder's Fonts from a desktop or a backup from
 * before it had one: each suitcase directly in Macintosh HD → Fonts, the
 * first folder of that name there, where the defaults kept them. `folder` is
 * that folder when the move leaves it empty, so it doesn't stand in
 * Macintosh HD as a second Fonts; null when there is none, nothing moves, or
 * anything else is in it. A suitcase anywhere else stays where it is.
 */
export function formerFonts(items: readonly Item[]): { suitcases: Item[]; folder: string | null } {
  const folder = folderIn(items, DISK, FORMER_FONTS)
  const inside = folder == null ? [] : items.filter((i) => i.parent === folder)
  const suitcases = inside.filter((i) => i.kind === FONT_KIND)
  return { suitcases, folder: suitcases.length > 0 && suitcases.length === inside.length ? folder : null }
}
