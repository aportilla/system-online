// The library's kinds: a text file and a font suitcase, as items of the shell's
// catalog (vintage-frames/shell). Each keeps little in its item's `data`: a
// text file its words, or the key of a text the app ships (src/texts/); a
// suitcase its family, whose strikes are the app's. Pure, so the defaults and
// the backup format run under Node.

import type { Item } from 'vintage-frames/shell'

/** A text file's kind, which the Text Viewer opens. */
export const TEXT = 'text'
/** A font suitcase's kind, which the Font Viewer opens. */
export const FONT = 'font'

// The catalog's own ids and kinds, restated: vintage-frames/shell's entry
// needs a DOM, so its DISK, TRASH and FOLDER can't be imported under Node.
export const DISK = 'disk'
export const TRASH = 'trash'
export const FOLDER = 'folder'

/** A text file's data: the key of a built-in, or its own words. */
export interface TextData {
  builtin?: string
  text?: string
}

/** A font suitcase's data. */
export interface FontData {
  family: string
}

/** A text file's built-in key, or null, and its own words, '' for a built-in. */
export function textData(item: Item): { builtin: string | null; text: string } {
  const d = (item.data ?? {}) as TextData
  return {
    builtin: typeof d.builtin === 'string' ? d.builtin : null,
    text: typeof d.text === 'string' ? d.text : '',
  }
}

/** A font suitcase's family. */
export const fontFamily = (item: Item): string => String((item.data as FontData | undefined)?.family ?? '')
