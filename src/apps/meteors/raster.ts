// Meteors' raster, pure: a 1-bit buffer of ink and paper, and the points,
// lines and outlines drawn into it at whole px. A point past an edge wraps to
// the far side, so a shape across an edge shows on both. draw.ts draws the
// field into it; screen.ts puts it on the canvas.

/** A raster: one byte a px, row by row, 1 for ink. */
export interface Bits {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array
}

/** Points as whole-px offsets from a center, in order round a shape. */
export type Points = readonly (readonly [number, number])[]

export const bitsOf = (width: number, height: number): Bits => ({ width, height, data: new Uint8Array(width * height) })

/** All paper. */
export function clear(bits: Bits): void {
  bits.data.fill(0)
}

/** Ink the px at `x`, `y`, rounded to whole px and wrapped into the raster. */
export function plot(bits: Bits, x: number, y: number): void {
  const { width, height } = bits
  const col = ((Math.round(x) % width) + width) % width
  const row = ((Math.round(y) % height) + height) % height
  bits.data[row * width + col] = 1
}

/** Ink the line from `x0`, `y0` to `x1`, `y1`, its ends rounded to whole px
 *  and both inked: one px a step along its longer axis (Bresenham's). */
export function line(bits: Bits, x0: number, y0: number, x1: number, y1: number): void {
  let x = Math.round(x0)
  let y = Math.round(y0)
  const xEnd = Math.round(x1)
  const yEnd = Math.round(y1)
  const dx = Math.abs(xEnd - x)
  const dy = -Math.abs(yEnd - y)
  const sx = x < xEnd ? 1 : -1
  const sy = y < yEnd ? 1 : -1
  let err = dx + dy
  for (;;) {
    plot(bits, x, y)
    if (x === xEnd && y === yEnd) return
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/** Ink the `width` × `height` block whose top left is `x`, `y`. */
export function block(bits: Bits, x: number, y: number, width: number, height: number): void {
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) plot(bits, x + col, y + row)
}

/** Ink the closed outline through `points`, offsets from `x`, `y`. */
export function outline(bits: Bits, points: Points, x: number, y: number): void {
  points.forEach(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length]!
    line(bits, x + ax, y + ay, x + bx, y + by)
  })
}
