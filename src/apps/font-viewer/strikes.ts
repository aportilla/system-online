// Strike loading: each imported strike registered once through the FontFace
// API under its own family name ("Geneva 9"), since CSS can't pick a bitmap
// strike by size. The woff2s are served verbatim from public/fonts/imported/.

import type { CharsetFamily, CharsetFont } from '../../charset-manifest.ts'
import { strikeName } from './specimen.ts'

/** Registered strikes by family name; a pending load dedupes re-picks. */
const faces = new Map<string, Promise<boolean>>()

/** The strike's URL, through the site's base: a Pages project site serves
 *  this page under /<repo>/, and fonts/ is under that too. */
export const strikeUrl = (font: CharsetFont): string =>
  `${import.meta.env.BASE_URL}fonts/imported/${font.file}`

/** Fetch and register a strike once. Resolves false, and forgets the attempt,
 *  when the file is absent, so a rebuilt collection doesn't need a reload. */
export function loadStrike(family: CharsetFamily, font: CharsetFont): Promise<boolean> {
  const name = strikeName(family, font)
  let pending = faces.get(name)
  if (!pending) {
    // The broad weight range matters: window content inherits the kit's
    // font-weight 700, and a face registered at the default 400 would get a
    // synthesized bold smeared over every stem.
    const face = new FontFace(name, `url(${strikeUrl(font)})`, { style: 'normal', weight: '100 900' })
    pending = face.load().then(
      () => {
        document.fonts.add(face)
        return true
      },
      () => {
        faces.delete(name)
        return false
      }
    )
    faces.set(name, pending)
  }
  return pending
}
