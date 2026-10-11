// The files a desktop comes with: the built-in text files (src/texts/), the
// built-in applications' icons, one font suitcase per family the app ships,
// in a Fonts folder in Macintosh HD, and the System Folder's: a Control
// Panels folder, and an alias of it in Apple Menu Items. They are the
// catalog's seed, stored once per storage; Special → Restore Default Files
// stores the ones missing since.

import {
  ALIAS_KIND,
  APPLE_MENU_ITEMS,
  APP_KIND,
  DISK,
  FOLDER,
  SYSTEM_FOLDER,
  appIdOf,
  resolve,
} from 'system-online-sdk/pure'
import type { Catalog, CatalogState } from 'system-online-sdk/pure'
import { FONT, TEXT, fontFamily, textData } from './kinds.ts'

/** The folder the font suitcases live in, directly in Macintosh HD. */
export const FONTS_FOLDER = 'Fonts'

/** The folder the control panels live in, directly in the System Folder. */
export const CONTROL_PANELS_FOLDER = 'Control Panels'

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
const folderIn = (state: CatalogState, parent: string, name: string): string | null =>
  state.items.find((i) => i.kind === FOLDER && i.parent === parent && i.name === name)?.id ?? null

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
  const shipped = new Set(state.items.filter((i) => i.kind === FONT).map(fontFamily))
  const aliased = new Set(
    state.items
      .filter((i) => i.kind === ALIAS_KIND)
      .map((i) => resolve(state, i.id))
      .flatMap((original) => (original?.kind === FOLDER ? [original.name] : []))
  )
  return {
    texts: texts.filter((t) => !keys.has(t.key)),
    apps: apps.filter((a) => !installed.has(a.app)),
    fonts: families.filter((f) => !shipped.has(f)),
    appleMenu: appleMenu.filter((name) => !aliased.has(name)),
  }
}

/** The Fonts folder a restored suitcase goes into: the first folder of that
 *  name directly in Macintosh HD, or null when there is none. */
export const fontsHome = (state: CatalogState): string | null => folderIn(state, DISK, FONTS_FOLDER)

/**
 * Store the missing defaults: each text and each application's icon at its
 * home, each font in the Fonts folder, and each alias in Apple Menu Items.
 * A folder a default goes into, Fonts in Macintosh HD or one in the System
 * Folder, is made again there if it is gone. The times step by a
 * millisecond, so the listing keeps the order given.
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
    folderIn(catalog.get(), parent, name) ??
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
    await catalog.create({ kind: FONT, name: family, parent: await folder(DISK, FONTS_FOLDER), data: { family }, at: at++ })
  }
  for (const name of missing.appleMenu) {
    const original = await folder(SYSTEM_FOLDER, name)
    if (original == null) continue
    await catalog.create({ kind: ALIAS_KIND, name, parent: APPLE_MENU_ITEMS, data: { original, kind: FOLDER }, at: at++ })
  }
}
