import { test } from 'node:test'
import assert from 'node:assert/strict'

import { bitsOf, block, clear, line, outline, plot } from '../src/apps/meteors/raster.ts'

/** The inked px of `bits` as "x,y", row by row. */
function inked(bits) {
  const px = []
  bits.data.forEach((v, i) => v && px.push(`${i % bits.width},${Math.floor(i / bits.width)}`))
  return px
}

test('plot: a px past an edge, negative ones included, lands wrapped', () => {
  const bits = bitsOf(8, 6)
  plot(bits, 9, -1)
  plot(bits, -8, 13)
  assert.deepEqual(inked(bits), ['0,1', '1,5'])
  clear(bits)
  assert.deepEqual(inked(bits), [])
})

test('line: both ends inked, one px a step along its longer axis', () => {
  for (const [x0, y0, x1, y1] of [
    [0, 0, 5, 2],
    [5, 2, 0, 0],
    [1, 5, 3, 0],
  ]) {
    const bits = bitsOf(8, 6)
    line(bits, x0, y0, x1, y1)
    const px = inked(bits)
    assert.ok(px.includes(`${x0},${y0}`) && px.includes(`${x1},${y1}`))
    // One px in each column, or row, the line crosses.
    const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0)
    const along = px.map((p) => Number(p.split(',')[steep ? 1 : 0]))
    const [lo, hi] = steep ? [Math.min(y0, y1), Math.max(y0, y1)] : [Math.min(x0, x1), Math.max(x0, x1)]
    assert.deepEqual(
      along.sort((a, b) => a - b),
      Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
    )
  }
})

test('line: across an edge, it comes back in on the other side', () => {
  const bits = bitsOf(8, 6)
  line(bits, 6, 1, 9, 1)
  assert.deepEqual(inked(bits), ['0,1', '1,1', '6,1', '7,1'])
})

test('block: its whole width and height, wrapping like a point', () => {
  const bits = bitsOf(8, 6)
  block(bits, 7, 5, 2, 2)
  assert.deepEqual(inked(bits), ['0,0', '7,0', '0,5', '7,5'])
})

test('outline: closed, through each point from its center', () => {
  const bits = bitsOf(8, 6)
  outline(
    bits,
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ],
    1,
    1,
  )
  assert.deepEqual(inked(bits), ['1,1', '2,1', '3,1', '1,2', '3,2', '1,3', '2,3', '3,3'])
})
