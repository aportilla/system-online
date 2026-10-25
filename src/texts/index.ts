// The system's documents: texts whose words are the system's, updated with
// it. Each one's words are served from public/texts/, at its key's path
// (docPath), and a text file holds the path, so the Text Viewer reads this
// deploy's words at every open, on every desktop. A key, and so its path,
// never changes once shipped.
//
// To add one, put its words at public/texts/<key>.txt and list it below with
// a new key, its name and its home. An existing desktop gets it from
// Special → Restore Default Files.

import type { TextDefault } from '../state/defaults.ts'

export const TEXTS: TextDefault[] = [
  { key: 'read-me', name: 'Read Me', home: 'desktop' },
  { key: 'about-the-fonts', name: 'About the Fonts', home: 'disk' },
]

/** Whether the site serves the system document `key`. */
export const servesText = (key: string): boolean => TEXTS.some((t) => t.key === key)
