// The files a desktop comes with: the built-in text files (src/texts/) and one
// font suitcase per family the app ships, in a Fonts folder in Macintosh HD.
// They are the catalog's seed, stored once per storage; Special → Restore
// Default Files stores the ones missing since.

import type { Catalog, CatalogState } from 'vintage-frames/shell'
import { DISK, FOLDER, FONT, TEXT, fontFamily, textData } from './kinds.ts'

/** The folder the font suitcases live in, directly in Macintosh HD. */
export const FONTS_FOLDER = 'Fonts'

/** A built-in text file: its key, its name, and where it is stored. */
export interface TextDefault {
  key: string
  name: string
  home: 'desktop' | 'disk'
}

/**
 * The built-in texts whose keys no text file carries, and the families no
 * suitcase carries. A trashed or renamed one counts as present, so a restore
 * never duplicates one.
 */
export function missingDefaults<T extends TextDefault>(
  state: CatalogState,
  texts: T[],
  families: string[]
): { texts: T[]; fonts: string[] } {
  const keys = new Set(state.items.filter((i) => i.kind === TEXT).map((i) => textData(i).builtin))
  const shipped = new Set(state.items.filter((i) => i.kind === FONT).map(fontFamily))
  return {
    texts: texts.filter((t) => !keys.has(t.key)),
    fonts: families.filter((f) => !shipped.has(f)),
  }
}

/** The Fonts folder a restored suitcase goes into: the first folder of that
 *  name directly in Macintosh HD, or null when there is none. */
export function fontsHome(state: CatalogState): string | null {
  return state.items.find((i) => i.kind === FOLDER && i.parent === DISK && i.name === FONTS_FOLDER)?.id ?? null
}

/**
 * Store the missing defaults: each text at its home, and each font in the
 * Fonts folder, which is made again in Macintosh HD if it is gone. The times
 * step by a millisecond, so the listing keeps the order given.
 */
export async function restoreDefaults(
  catalog: Pick<Catalog, 'get' | 'create'>,
  texts: TextDefault[],
  families: string[],
  { now = Date.now }: { now?: () => number } = {}
): Promise<void> {
  const missing = missingDefaults(catalog.get(), texts, families)
  let at = now()
  for (const t of missing.texts) {
    await catalog.create({
      kind: TEXT,
      name: t.name,
      parent: t.home === 'disk' ? DISK : null,
      data: { builtin: t.key },
      at: at++,
    })
  }
  if (!missing.fonts.length) return
  const home =
    fontsHome(catalog.get()) ??
    (await catalog.create({ kind: FOLDER, name: FONTS_FOLDER, parent: DISK, at: at++ }))?.id ??
    null
  for (const family of missing.fonts) {
    await catalog.create({ kind: FONT, name: family, parent: home, data: { family }, at: at++ })
  }
}
