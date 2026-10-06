// The game's screen as a 1-bit surface over its canvas, one canvas px per
// system px: black and white only, at whole px, so nothing drawn on it is
// smoothed. Text is set in the kit's faces, glyph by glyph, from sprites
// quantized to 1-bit when first drawn.

import { VF_BODY_FAMILY, VF_DISPLAY_FAMILY } from 'vintage-frames'
import type { Box } from 'vintage-frames/shell'

export type Ink = 'black' | 'white'
export type Face = 'display' | 'body'

const COLOR: Record<Ink, string> = { black: '#000', white: '#fff' }

/** Each face at its own size: a 16px em on the faces' 16-design-px grid, so
 *  one design px is one canvas px. */
const FONT: Record<Face, string> = {
  display: `16px "${VF_DISPLAY_FAMILY}"`,
  body: `16px "${VF_BODY_FAMILY}"`,
}
/** A line of either face, and its baseline: 12 above, 4 below. */
export const LINE = 16
const BASELINE = 12

/** Settles once both faces have loaded. A glyph drawn before would be cut
 *  from the fallback face, and kept. */
export const facesLoaded = (): Promise<unknown> => Promise.all(Object.values(FONT).map((f) => document.fonts.load(f)))

interface Glyph {
  sprite: HTMLCanvasElement
  advance: number
}

/** Every glyph cut so far, by face, ink and character. */
const glyphs = new Map<string, Glyph>()

/** `ch` in `face` and `ink`: its advance by one line, ink wherever the face
 *  covers half a pixel or more, clear elsewhere. */
function glyph(ch: string, face: Face, ink: Ink): Glyph {
  const key = `${face} ${ink} ${ch}`
  const cut = glyphs.get(key)
  if (cut) return cut
  const sprite = document.createElement('canvas')
  const g = sprite.getContext('2d', { willReadFrequently: true })!
  g.font = FONT[face]
  const advance = Math.round(g.measureText(ch).width)
  sprite.width = Math.max(advance, 1)
  sprite.height = LINE
  // Sizing the canvas reset its state.
  g.font = FONT[face]
  g.fillText(ch, 0, BASELINE)
  const img = g.getImageData(0, 0, sprite.width, sprite.height)
  const px = img.data
  const v = ink === 'white' ? 255 : 0
  for (let i = 0; i < px.length; i += 4) {
    const on = px[i + 3]! >= 128
    px[i] = px[i + 1] = px[i + 2] = on ? v : 0
    px[i + 3] = on ? 255 : 0
  }
  g.putImageData(img, 0, 0)
  const made = { sprite, advance }
  glyphs.set(key, made)
  return made
}

export interface Screen {
  /** Fill `box`, else the whole screen, with `ink`. */
  fill(ink: Ink, box?: Box): void
  /** How wide `text` runs in `face`, magnified `zoom` times. */
  measure(text: string, face: Face, zoom?: number): number
  /** Set `text` in `face` and `ink`, its line's top-left at `left`, `top`,
   *  each pixel magnified to `zoom` × `zoom`. */
  text(text: string, face: Face, ink: Ink, left: number, top: number, zoom?: number): void
}

/** The 1-bit surface over `canvas`. Places and sizes are whole px. */
export function screenOf(canvas: HTMLCanvasElement): Screen {
  const g = canvas.getContext('2d', { alpha: false })!
  // A magnified glyph stays square pixels.
  g.imageSmoothingEnabled = false
  return {
    fill(ink, box = { left: 0, top: 0, width: canvas.width, height: canvas.height }) {
      g.fillStyle = COLOR[ink]
      g.fillRect(box.left, box.top, box.width, box.height)
    },
    measure(text, face, zoom = 1) {
      let width = 0
      for (const ch of text) width += glyph(ch, face, 'black').advance
      return width * zoom
    },
    text(text, face, ink, left, top, zoom = 1) {
      let x = left
      for (const ch of text) {
        const { sprite, advance } = glyph(ch, face, ink)
        if (advance) g.drawImage(sprite, x, top, sprite.width * zoom, LINE * zoom)
        x += advance * zoom
      }
    },
  }
}
