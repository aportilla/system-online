import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  cascadeFrom,
  cascadeSlot,
  CASCADE_STEP,
  CASCADE_SLOTS,
  pinOf,
  pinTo,
  isPin,
  TOP_RESERVE,
  windowFrame,
  nearBox,
  NEAR,
} from '../src/shell/layout.ts'

// No reserve and 100px bands. On R the middle is x ∈ [100, 900), y ∈ [100, 700).
const F = { reserve: 0, bands: { left: 100, top: 100, right: 100, bottom: 100 } }
const R = { width: 1000, height: 800 }
const box = (left, top, width, height) => ({ left, top, width, height })
const roundTrip = (b, from, to, frame = F, policy) => pinTo(pinOf(b, from, frame), to, frame, policy)

test('cascade: each further open steps down-right, and a freed slot is reused', () => {
  const base = { left: 100, top: 100 }
  assert.deepEqual(cascadeFrom(base, []), { left: 100, top: 100, slot: 0 })
  const one = [{ left: 100, top: 100 }]
  assert.deepEqual(cascadeFrom(base, one), {
    left: 100 + CASCADE_STEP,
    top: 100 + CASCADE_STEP,
    slot: 1,
  })
  // Slot 0's window moved away and slot 1 is held, so the next open takes slot 0.
  assert.deepEqual(
    cascadeFrom(base, [
      { left: 400, top: 300 },
      { left: 100 + CASCADE_STEP, top: 100 + CASCADE_STEP },
    ]),
    { left: 100, top: 100, slot: 0 }
  )
  // A window a pixel or two off its slot still holds it; half a step away does not.
  assert.equal(cascadeFrom(base, [{ left: 102, top: 99 }]).slot, 1)
  assert.equal(cascadeFrom(base, [{ left: 100 + CASCADE_STEP / 2, top: 100 }]).slot, 0)
})

test('cascade: every slot held wraps instead of walking off the raster', () => {
  const base = { left: 100, top: 100 }
  const all = Array.from({ length: CASCADE_SLOTS }, (_, i) => cascadeSlot(base, i))
  assert.equal(cascadeFrom(base, all).slot, 0)
  assert.equal(cascadeFrom(base, [...all, cascadeSlot(base, 0)]).slot, 1)
  assert.deepEqual(cascadeSlot(base, CASCADE_SLOTS + 1), cascadeSlot(base, 1))
})

test('near: a box reads at its target while every edge is within the tolerance', () => {
  const t = box(300, 40, 520, 700)
  assert.ok(nearBox(t, t))
  assert.ok(nearBox(box(302, 38, 520, 700), t))
  assert.ok(nearBox(box(300, 40, 520 + NEAR, 700 - NEAR), t))
  assert.ok(!nearBox(box(300 + NEAR + 1, 40, 520, 700), t))
  assert.ok(!nearBox(box(300, 40, 520, 700 - NEAR - 1), t))
})

test('pin: a strut keeps its offset from its edge, a spring its fraction of the middle', () => {
  // Near struts: the box does not move.
  assert.deepEqual(roundTrip(box(30, 40, 50, 30), R, { width: 600, height: 500 }), box(30, 40, 50, 30))
  // Far struts: the box keeps its right and bottom offsets, with or without a
  // fixed size.
  for (const to of [
    { width: 600, height: 500 },
    { width: 300, height: 250 },
  ]) {
    const want = box(to.width - 60, to.height - 60, 40, 40)
    assert.deepEqual(roundTrip(box(940, 740, 40, 40), R, to), want)
    assert.deepEqual(roundTrip(box(940, 740, 40, 40), R, to, F, { size: { width: 40, height: 40 } }), want)
  }
  // Band to band: both margins hold and the box stretches.
  assert.deepEqual(roundTrip(box(50, 50, 900, 700), R, { width: 1400, height: 1200 }), box(50, 50, 1300, 1100))
  // Springs: position and size both scale.
  assert.deepEqual(roundTrip(box(300, 250, 400, 300), R, { width: 1400, height: 1200 }), box(400, 350, 600, 500))
  assert.deepEqual(roundTrip(box(300, 250, 400, 300), R, R), box(300, 250, 400, 300))
  // The reserve is the frame's y = 0: a box at TOP_RESERVE stays there.
  const under = box(14, TOP_RESERVE, 30, 187)
  for (const h of [400, 2000]) {
    assert.equal(roundTrip(under, { width: 1000, height: 830 }, { width: 1000, height: h }, windowFrame()).top, TOP_RESERVE)
  }
})

test('pin: continuous across every seam', () => {
  for (const to of [
    { width: 600, height: 800 },
    { width: 1400, height: 800 },
  ]) {
    for (const seam of [100, 900]) {
      let prev = null
      for (let v = seam - 2; v <= seam + 2; v++) {
        const { left } = roundTrip(box(v, 300, 0, 10), R, to)
        if (prev !== null) assert.ok(left >= prev && left - prev <= 2, `seam ${seam}, v ${v}`)
        prev = left
      }
    }
  }
})

test('pin: an edge outside the raster hangs the same', () => {
  assert.equal(roundTrip(box(-30, 50, 100, 40), R, { width: 600, height: 500 }).left, -30)
  assert.deepEqual(roundTrip(box(960, 50, 80, 40), R, { width: 600, height: 500 }), box(560, 50, 80, 40))
})

test('pin: a fixed-size box resolves through the anchor rule', () => {
  // x: a near strut holds. y: two springs, so the mapped center holds.
  assert.deepEqual(
    roundTrip(box(50, 250, 200, 100), R, { width: 1000, height: 1400 }, F, { size: { width: 200, height: 100 } }),
    box(50, 450, 200, 100)
  )
  // A lone far strut holds.
  assert.deepEqual(
    roundTrip(box(700, 50, 250, 40), R, { width: 600, height: 800 }, F, { size: { width: 250, height: 40 } }),
    box(300, 50, 250, 40)
  )
})

test('pin: a resizable box floors its size around the mapped center', () => {
  assert.deepEqual(
    roundTrip(box(300, 250, 400, 300), R, { width: 400, height: 400 }, F, { min: { width: 164, height: 160 } }),
    box(118, 120, 164, 160)
  )
})

test('pin: a degenerate span collapses the middle to a seam, and grows back exactly', () => {
  const tiny = { width: 150, height: 120 }
  const spring = box(300, 250, 400, 300)
  const pin = pinOf(spring, R, F)
  assert.deepEqual(pinTo(pin, tiny, F, { min: { width: 80, height: 54 } }), box(60, 73, 80, 54))
  assert.deepEqual(pinTo(pin, R, F), spring)
})

test('pin: what pinOf reads is a pin, stored and parsed back too, and a garbled record is not', () => {
  const pin = pinOf(box(300, 250, 400, 300), R, F)
  assert.ok(isPin(pin))
  assert.ok(isPin(JSON.parse(JSON.stringify(pin))))
  for (const bad of [
    null,
    { left: 1, top: 2 },
    { x: [], y: [] },
    { x: pin.x, y: [pin.y[0], { kind: 'sideways', v: 1 }] },
    { x: pin.x, y: [pin.y[0], { kind: 'near', v: NaN }] },
  ]) {
    assert.equal(isPin(bad), false, JSON.stringify(bad))
  }
})
