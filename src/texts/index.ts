// Built-in text files, imported whole with Vite's ?raw. A seeded record stores
// the key alone, so every file opens the text shipped here (files.ts
// builtinText). A key never changes once shipped; a record whose key is gone
// leaves the desktop.
//
// To add one, put the .txt here and list it below with a new key, its name and
// its home. An existing profile gets it from Special → Restore Default Files.

import readMe from './read-me.txt?raw'
import aboutTheFonts from './about-the-fonts.txt?raw'
import type { TextDefault } from '../state/defaults.ts'

export const TEXTS: (TextDefault & { text: string })[] = [
  { key: 'read-me', name: 'Read Me', home: 'desktop', text: readMe },
  { key: 'about-the-fonts', name: 'About the Fonts', home: 'hd', text: aboutTheFonts },
]

/** A built-in's text by key, or null. */
export const builtinText = (key: string): string | null =>
  TEXTS.find((t) => t.key === key)?.text ?? null
