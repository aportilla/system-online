// The system's fonts: every family of the imported strike collection
// (charset-manifest.ts), each strike served verbatim from
// public/fonts/imported/ with its size in bytes. The shell hands them to every
// application through ctx.fonts, and a suitcase in the System Folder's Fonts
// installs its family. Nothing loads until an application asks for a strike.

import type { FontFamily } from 'system-online-sdk'
import { CHARSET_FAMILIES } from './charset-manifest.ts'

export const FONT_FAMILIES: FontFamily[] = CHARSET_FAMILIES.map((family) => ({
  name: family.label,
  sizes: family.sizeIsLine ? 'pixels' : 'points',
  strikes: family.fonts.map((font) => ({
    size: font.size,
    line: font.line,
    pitch: font.pitch,
    url: `${import.meta.env.BASE_URL}fonts/imported/${font.file}`,
    bytes: __FONT_BYTES__[font.file] ?? 0,
    chars: font.chars,
  })),
}))
