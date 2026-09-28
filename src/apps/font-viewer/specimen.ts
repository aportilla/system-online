// Font Viewer text (pure): the sample line, the character rows, a strike's
// names and the strike a window opens on.

import type { CharsetFamily, CharsetFont } from '../../charset-manifest.ts'

/** The sample line System 7 set a font in when a font file was opened. */
export const SAMPLE = 'How razorback-jumping frogs can level six piqued gymnasts!'

/** The size a window opens on, or the strike nearest it. */
export const OPENING_SIZE = 12

/** A strike's own family name, the one it is registered under: "Geneva 9". */
export const strikeName = (family: CharsetFamily, font: CharsetFont): string =>
  `${family.label} ${font.size}`

/** A Size menu item: "9 Point", or "16 Pixels" where the collection still
 *  names the family by line height. */
export const sizeLabel = (family: CharsetFamily, font: CharsetFont): string =>
  `${font.size} ${family.sizeIsLine ? 'Pixels' : 'Point'}`

/** The strike whose size sits nearest `target`; a tie goes to the smaller. */
export function nearestStrike(family: CharsetFamily, target: number): CharsetFont | null {
  let best: CharsetFont | null = null
  for (const font of family.fonts) {
    if (!best || Math.abs(font.size - target) < Math.abs(best.size - target)) best = font
  }
  return best
}

/** A strike's characters as the specimen's rows: ASCII, accented Latin, then
 *  the rest. Empty rows are left out. */
export function charsetRows(chars: string): string[] {
  let ascii = ''
  let latin = ''
  let rest = ''
  for (const ch of chars) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp <= 0x7e) ascii += ch
    else if (cp <= 0x24f) latin += ch
    else rest += ch
  }
  return [ascii, latin, rest].filter((row) => row !== '')
}
