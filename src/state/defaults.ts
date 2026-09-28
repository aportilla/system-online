// The files a desktop comes with: the built-in text files (src/texts/) and one
// font suitcase per family the app ships, in a Fonts folder in Macintosh HD.
// A new profile stores them once; Special → Restore Default Files stores the
// ones missing since.

import { HD, childrenOf } from './files.ts'
import type { Files, FilesState } from './files.ts'

/** The folder the font suitcases live in, directly in Macintosh HD. */
export const FONTS_FOLDER = 'Fonts'

/** A built-in text file: its key, its name, and where it is stored. */
export interface TextDefault {
  key: string
  name: string
  home: 'desktop' | 'hd'
}

/**
 * The built-in texts whose keys no text row carries, and the families no font
 * row carries. A trashed or renamed built-in counts as present, so a restore
 * never duplicates one.
 */
export function missingDefaults<T extends TextDefault>(
  state: FilesState,
  texts: T[],
  families: string[]
): { texts: T[]; fonts: string[] } {
  const keys = new Set(state.texts.map((t) => t.builtin))
  const shipped = new Set(state.fonts.map((t) => t.family))
  return {
    texts: texts.filter((t) => !keys.has(t.key)),
    fonts: families.filter((f) => !shipped.has(f)),
  }
}

/** The Fonts folder a restored suitcase goes into: the first folder of that
 *  name directly in Macintosh HD, or null when there is none. */
export function fontsHome(state: FilesState): string | null {
  return childrenOf(state, HD).folders.find((f) => f.name === FONTS_FOLDER)?.id ?? null
}

/**
 * Store the missing defaults: each text at its home, and each font in the
 * Fonts folder, which is made again in Macintosh HD if it is gone. The times
 * step by a millisecond, so the listing keeps the order given.
 */
export async function restoreDefaults(
  files: Files,
  texts: TextDefault[],
  families: string[],
  { now = Date.now }: { now?: () => number } = {}
): Promise<void> {
  const missing = missingDefaults(files.get(), texts, families)
  let at = now()
  for (const t of missing.texts) {
    await files.createText({
      name: t.name,
      builtin: t.key,
      folder: t.home === 'hd' ? HD : null,
      at: at++,
    })
  }
  if (!missing.fonts.length) return
  const home =
    fontsHome(files.get()) ??
    (await files.createFolder({ name: FONTS_FOLDER, parent: HD, at: at++ }))?.id ??
    null
  for (const family of missing.fonts) {
    await files.createFont({ name: family, family, folder: home, at: at++ })
  }
}
