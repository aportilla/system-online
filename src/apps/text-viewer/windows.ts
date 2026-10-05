// Text Viewer windows: one per open text file, a copy of windows.html's, the
// body the file's text verbatim and read-only.

import type { VfParagraph, VfWindow } from 'vintage-frames'

/** A text window's body, whose contents Select All selects. */
export const bodyOf = (win: VfWindow) => win.querySelector('.text-body') as VfParagraph

/** `win`, a fresh text window, titled `name` and showing `text`. */
export function textWindow(win: VfWindow, name: string, text: string): VfWindow {
  win.heading = name
  bodyOf(win).textContent = text
  return win
}
