import { test } from 'node:test'
import assert from 'node:assert/strict'

import { charsetRows, nearestStrike, sizeLabel, strikeName } from '../src/apps/font-viewer/specimen.ts'

const font = (size) => ({ size, line: size + 3, pitch: size + 3, file: `X-${size}.woff2`, chars: 'a' })
const geneva = { label: 'Geneva', sizeIsLine: false, fonts: [9, 10, 12, 14].map(font) }
const system = { label: 'System', sizeIsLine: true, fonts: [font(16)] }

test('rows: ASCII, accented Latin and the rest, empty rows left out', () => {
  assert.deepEqual(charsetRows('Ab1éü⌘π'), ['Ab1', 'éü', '⌘π'])
  assert.deepEqual(charsetRows('abc'), ['abc'])
})

test('nearest strike: the exact size, else the nearest, a tie to the smaller', () => {
  assert.equal(nearestStrike(geneva, 12).size, 12)
  assert.equal(nearestStrike(geneva, 13).size, 12)
  assert.equal(nearestStrike({ ...geneva, fonts: [font(10), font(14)] }, 12).size, 10)
  assert.equal(nearestStrike({ ...geneva, fonts: [] }, 12), null)
})

test('names: the strike family and the Size item, in points or pixels', () => {
  assert.equal(strikeName(geneva, geneva.fonts[0]), 'Geneva 9')
  assert.equal(sizeLabel(geneva, geneva.fonts[0]), '9 Point')
  assert.equal(sizeLabel(system, system.fonts[0]), '16 Pixels')
})
