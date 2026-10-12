// The files a desktop comes with: the built-in text files (src/texts/), the
// built-in applications' icons, one font suitcase per family the system
// serves, in the System Folder's Fonts, and the System Folder's own: a Control
// Panels folder, and an alias of it in Apple Menu Items. They are the
// catalog's seed, stored once per storage; Special → Restore Default Files
// stores the ones missing since. Before the System Folder had Fonts, the
// suitcases lived in a Fonts folder in Macintosh HD (formerFonts).

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
  resolve,
} from 'system-online-sdk/pure'
import type { Catalog, CatalogState, Item } from 'system-online-sdk/pure'
import { TEXT, textData } from './kinds.ts'

/** The folder the control panels live in, directly in the System Folder. */
export const CONTROL_PANELS_FOLDER = 'Control Panels'

/** The folder the suitcases lived in, directly in Macintosh HD, before the
 *  System Folder had Fonts. */
const FORMER_FONTS = 'Fonts'

/** Where a default is stored: on the desktop, directly in Macintosh HD, or
 *  in the System Folder's Control Panels. */
export type Home = 'desktop' | 'disk' | 'control-panels'

/** A built-in text file: its key, its name, and where it is stored. */
export interface TextDefault {
  key: string
  name: string
  home: Home
}

/** A built-in application's icon: the application, its name, and where it is
 *  stored. */
export interface AppDefault {
  app: string
  name: string
  home: Home
}

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

/**
 * The built-in texts whose keys no text file carries, the applications no
 * icon opens, the families no suitcase carries, and the folders no alias
 * stands for. A trashed or renamed one counts as present, so a restore
 * never duplicates one: an alias counts while it stands for a folder of that
 * name, wherever either is.
 */
export function missingDefaults<T extends TextDefault>(
  state: CatalogState,
  { texts, apps, families, appleMenu }: Defaults<T>
): { texts: T[]; apps: AppDefault[]; fonts: string[]; appleMenu: string[] } {
  const keys = new Set(state.items.filter((i) => i.kind === TEXT).map((i) => textData(i).builtin))
  const installed = new Set(state.items.filter((i) => i.kind === APP_KIND).map(appIdOf))
  const carried = new Set(state.items.map(fontFamilyOf))
  const aliased = new Set(
    state.items
      .filter((i) => i.kind === ALIAS_KIND)
      .map((i) => resolve(state, i.id))
      .flatMap((original) => (original?.kind === FOLDER ? [original.name] : []))
  )
  return {
    texts: texts.filter((t) => !keys.has(t.key)),
    apps: apps.filter((a) => !installed.has(a.app)),
    fonts: families.filter((f) => !carried.has(f)),
    appleMenu: appleMenu.filter((name) => !aliased.has(name)),
  }
}

/**
 * Store the missing defaults: each text and each application's icon at its
 * home, each suitcase in the System Folder's Fonts, and each alias in Apple
 * Menu Items. Control Panels is made again in the System Folder if it is
 * gone. The times step by a millisecond, so the listing keeps the order
 * given.
 */
export async function restoreDefaults(
  catalog: Pick<Catalog, 'get' | 'create'>,
  defaults: Defaults,
  { now = Date.now }: { now?: () => number } = {}
): Promise<void> {
  const missing = missingDefaults(catalog.get(), defaults)
  let at = now()
  /** Folder `name` directly in `parent`, made there if it is gone. */
  const folder = async (parent: string, name: string): Promise<string | null> =>
    folderIn(catalog.get().items, parent, name) ??
    (await catalog.create({ kind: FOLDER, name, parent, at: at++ }))?.id ??
    null
  const homeOf = async (home: Home): Promise<string | null> =>
    home === 'disk' ? DISK : home === 'control-panels' ? folder(SYSTEM_FOLDER, CONTROL_PANELS_FOLDER) : null
  for (const t of missing.texts) {
    await catalog.create({ kind: TEXT, name: t.name, parent: await homeOf(t.home), data: { builtin: t.key }, at: at++ })
  }
  for (const a of missing.apps) {
    await catalog.create({ kind: APP_KIND, name: a.name, parent: await homeOf(a.home), data: { app: a.app }, at: at++ })
  }
  for (const family of missing.fonts) {
    await catalog.create({ kind: FONT_KIND, name: family, parent: FONTS, data: { family }, at: at++ })
  }
  for (const name of missing.appleMenu) {
    const original = await folder(SYSTEM_FOLDER, name)
    if (original == null) continue
    await catalog.create({ kind: ALIAS_KIND, name, parent: APPLE_MENU_ITEMS, data: { original, kind: FOLDER }, at: at++ })
  }
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
