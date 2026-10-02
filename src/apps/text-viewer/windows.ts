// Text Viewer windows: one per open text file, made from windows.html, the
// body the file's text verbatim and read-only.

import type { VfParagraph, VfWindow } from 'vintage-frames'
import markup from './windows.html?raw'
import { windowFrom } from '../windows.ts'

/** A text window's body, whose contents Select All selects. */
export const bodyOf = (win: VfWindow) => win.querySelector('.text-body') as VfParagraph

/** A window titled `name` showing `text`. */
export function textWindow(name: string, text: string): VfWindow {
  const win = windowFrom(markup)
  win.heading = name
  bodyOf(win).textContent = text
  return win
}
