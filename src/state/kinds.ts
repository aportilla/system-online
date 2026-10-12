// The library's kind: a text file, as an item of the shell's catalog
// (system-online-sdk). It keeps little in its item's `data`: its words, or the
// key of a text the app ships (src/texts/). A font suitcase is the shell's own
// `font` kind (FONT_KIND, fontFamilyOf), whose family the system serves
// (src/fonts.ts). Pure, so the defaults and the backup format run under Node.

import type { Item } from 'system-online-sdk/pure'

/** A text file's kind, which the Text Viewer opens. */
export const TEXT = 'text'

/** A text file's data: the key of a built-in, or its own words. */
export interface TextData {
  builtin?: string
  text?: string
}

/** A text file's built-in key, or null, and its own words, '' for a built-in. */
export function textData(item: Item): { builtin: string | null; text: string } {
  const d = (item.data ?? {}) as TextData
  return {
    builtin: typeof d.builtin === 'string' ? d.builtin : null,
    text: typeof d.text === 'string' ? d.text : '',
  }
}
