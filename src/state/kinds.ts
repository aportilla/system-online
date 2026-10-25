// The library's kind: a text file, as an item of the shell's catalog
// (system-online-sdk). It keeps little in its item's `data`: its own words, or
// the path of a system document, a text the site serves (public/texts/). A
// font suitcase is the shell's own `font` kind (FONT_KIND, fontFamilyOf),
// whose family the system serves (src/fonts.ts). Pure, so the defaults and the
// backup format run under Node.

import type { Item } from 'system-online-sdk/pure'

/** A text file's kind, which the Text Viewer opens. */
export const TEXT = 'text'

/**
 * A text file's data: its own words, or a system document's path. `builtin`,
 * a system document's key, is from before system documents had paths: a
 * desktop's are rewritten to paths once (state/defaults.ts), and a backup's
 * as it's restored.
 */
export interface TextData {
  text?: string
  path?: string
  builtin?: string
}

/** Where the site serves a system document's words, by its key. A key, and
 *  so its path, never changes once shipped. */
export const docPath = (key: string): string => `/texts/${key}.txt`

/** The key a system document's path names, or null. */
const keyOf = (path: string): string | null => /^\/texts\/([^/]+)\.txt$/.exec(path)?.[1] ?? null

/**
 * A text file's own words, '' for none, and whether it's a system document,
 * by a path or a key from before paths, with its key: null for a visitor's
 * text, and for a path that names none.
 */
export function textData(item: Item): { text: string; doc: boolean; key: string | null } {
  const d = (item.data ?? {}) as TextData
  const path = typeof d.path === 'string' && d.path ? d.path : null
  const key = typeof d.builtin === 'string' && d.builtin ? d.builtin : null
  return {
    text: typeof d.text === 'string' ? d.text : '',
    doc: path != null || key != null,
    key: path != null ? keyOf(path) : key,
  }
}
