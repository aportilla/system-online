// Font Viewer windows: one per open suitcase, a copy of windows.html's. The body
// sets the sample line in every strike of the family, then every character of
// the chosen strike, each in the strike itself: the paragraph carries the
// strike's family, its rect as the size (one design px per system px) and its
// measured pitch as the line height, so nothing on it can be another font's
// fallback.

import { VfParagraph } from 'vintage-frames'
import type { VfLabel, VfWindow } from 'vintage-frames'
import type { CharsetFamily, CharsetFont } from '../../charset-manifest.ts'
import { loadStrike, strikeUrl } from './strikes.ts'
import { SAMPLE, charsetRows, strikeName } from './specimen.ts'

/** An open suitcase's window, its family and the strike it shows. */
export interface Specimen {
  win: VfWindow
  family: CharsetFamily
  font: CharsetFont
  /** Bumped by each render, so a load that finishes late draws nothing. */
  pass: number
}

/** `win`, a fresh font window, titled `name` and not yet drawn. */
export function fontWindow(win: VfWindow, name: string): VfWindow {
  win.heading = name
  return win
}

/** A window's body, whose contents Select All selects. */
export const specimenOf = (win: VfWindow) => win.querySelector('.font-specimen')

/** A paragraph set in `font`, or explaining that its file didn't load. */
function strikeParagraph(family: CharsetFamily, font: CharsetFont, text: string, loaded: boolean) {
  const p = new VfParagraph()
  p.setAttribute('fill-width', '')
  if (!loaded) {
    p.textContent = `${strikeUrl(font)} didn’t load.`
    return p
  }
  p.style.setProperty('--vf-font-family', `'${strikeName(family, font)}'`)
  p.style.setProperty('--vf-font-size', `${font.line}px`)
  p.style.setProperty('--vf-paragraph-line-height', `${font.pitch}px`)
  p.textContent = text
  return p
}

/** Draws a window's samples, character rows and status. Every strike loads
 *  first; the wristwatch shows while one is loading. */
export async function render(s: Specimen): Promise<void> {
  const pass = ++s.pass
  const { win, family, font } = s
  win.setAttribute('aria-busy', 'true')
  const loaded = await Promise.all(family.fonts.map((f) => loadStrike(family, f)))
  if (pass !== s.pass) return
  win.removeAttribute('aria-busy')
  const samples = win.querySelector('.font-samples') as HTMLElement
  samples.replaceChildren(...family.fonts.map((f, i) => strikeParagraph(family, f, SAMPLE, !!loaded[i])))
  const ok = !!loaded[family.fonts.indexOf(font)]
  const charset = win.querySelector('.font-charset') as HTMLElement
  charset.replaceChildren(...(ok ? charsetRows(font.chars) : ['']).map((row) => strikeParagraph(family, font, row, ok)))
  const status = win.querySelector('.font-status') as VfLabel
  status.textContent = `${strikeName(family, font)} · ${[...font.chars].length} characters`
}
