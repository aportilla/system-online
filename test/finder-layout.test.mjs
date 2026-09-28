import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pinOf, pinTo, MENU_BAR } from '../src/shell/layout.ts'
import {
  cleanUp,
  desktopLattice,
  fieldExtent,
  folderLattice,
  latticeCell,
  latticeSlot,
  ICON_CELL,
  ICON_FRAME,
} from '../src/apps/finder/layout.ts'

const W = 980
const H = 830
const cell = { width: ICON_CELL, height: ICON_CELL }
const roundTrip = (b, from, to) => pinTo(pinOf(b, from, ICON_FRAME), to, ICON_FRAME, { size: cell })

test('icon pin: the right-edge column keeps its offset, its rows spread, and the menu bar holds', () => {
  const home = { width: W, height: H }
  const icon = { ...latticeSlot(desktopLattice(W, H), 2), ...cell }
  for (const w of [500, 1400]) {
    assert.deepEqual(roundTrip(icon, home, { width: w, height: H }), {
      ...latticeSlot(desktopLattice(w, H), 2),
      ...cell,
    })
  }
  assert.ok(roundTrip(icon, home, { width: W, height: 500 }).top < icon.top)
  assert.ok(roundTrip(icon, home, { width: W, height: 1400 }).top > icon.top)
  const high = { left: 16, top: MENU_BAR, ...cell }
  for (const h of [300, 2000]) assert.equal(roundTrip(high, home, { width: W, height: h }).top, MENU_BAR)
})

test('lattice: the desktop fills down the right edge, a folder across its rows', () => {
  const desk = desktopLattice(W, H)
  const first = latticeSlot(desk, 0)
  assert.equal(first.left, W - 16 - ICON_CELL)
  assert.deepEqual(latticeSlot(desk, 1), { left: first.left, top: first.top + desk.dy })
  assert.deepEqual(latticeSlot(desk, desk.rows), { left: first.left + desk.dx, top: first.top })
  const folder = folderLattice(400)
  assert.deepEqual(latticeSlot(folder, folder.cols), latticeCell(folder, 0, 1))
})

test('clean up: every icon on a cell, one icon per cell, a tidy set held', () => {
  for (const grid of [desktopLattice(W, H), folderLattice(400)]) {
    const onCell = (p) =>
      Number.isInteger((p.left - grid.left) / grid.dx) && Number.isInteger((p.top - grid.top) / grid.dy)
    const cells = [latticeCell(grid, 0, 0), latticeCell(grid, 1, 0), latticeCell(grid, 0, 1), latticeCell(grid, 1, 1)]
    const nudged = cells.map((c, i) => ({ left: c.left + 7 * i, top: c.top - 5 * i }))
    nudged.push({ left: cells[0].left + 3, top: cells[0].top + 2 }) // onto a taken cell
    const out = cleanUp(grid, nudged)
    assert.equal(out.length, nudged.length)
    for (const p of out) assert.ok(onCell(p), `off the lattice: ${JSON.stringify(p)}`)
    assert.equal(new Set(out.map((p) => `${p.left},${p.top}`)).size, out.length)
    assert.deepEqual(cleanUp(grid, cells), cells)
  }
})

test('field extent: at least the viewport, grown to hold every icon', () => {
  const viewport = { width: 300, height: 200 }
  assert.deepEqual(fieldExtent([], viewport), viewport)
  const ext = fieldExtent([{ left: 400, top: 16 }], viewport)
  assert.ok(ext.width > 400 + ICON_CELL)
  assert.equal(ext.height, 200)
})
