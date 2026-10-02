// Built-in text files, imported whole with Vite's ?raw. A seeded text file
// stores the key alone, so every one opens the text shipped here (textOf). A
// key never changes once shipped.
//
// To add one, put the .txt here and list it below with a new key, its name and
// its home. An existing profile gets it from Special → Restore Default Files.

import type { Item } from 'vintage-frames/shell'
import readMe from './read-me.txt?raw'
import aboutTheFonts from './about-the-fonts.txt?raw'
import type { TextDefault } from '../state/defaults.ts'
import { textData } from '../state/kinds.ts'

export const TEXTS: (TextDefault & { text: string })[] = [
  { key: 'read-me', name: 'Read Me', home: 'desktop', text: readMe },
  { key: 'about-the-fonts', name: 'About the Fonts', home: 'disk', text: aboutTheFonts },
]

/** A built-in's text by key, or null. */
export const builtinText = (key: string): string | null =>
  TEXTS.find((t) => t.key === key)?.text ?? null

/** A text file's words: a built-in's are the app's, else its own. Null for a
 *  built-in the app no longer ships. */
export function textOf(item: Item): string | null {
  const { builtin, text } = textData(item)
  return builtin != null ? builtinText(builtin) : text
}
