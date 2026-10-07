import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CENTER,
  CLEAR,
  DEBRIS,
  EXTRA_SHIP,
  IDLE,
  METEOR,
  RESPAWN_DELAY,
  SAFE,
  SCREEN,
  SHIP,
  SHIPS,
  SHOT,
  WAVE,
  WAVE_DELAY,
  WRECK,
  isOver,
  newField,
  stepField,
} from '../src/apps/meteors/field.ts'

/** A meteor of `size` at `x`, `y`, moving `vx`, `vy` a step. */
const rock = (size, x, y, vx = 0, vy = 0) => ({ size, x, y, vx, vy, outline: [] })
/** A shot at `x`, `y`, moving `vx`, `vy` a step, `life` steps from gone. */
const shot = (x, y, vx = 0, vy = 0, life = SHOT.life) => ({ x, y, vx, vy, life })
/** A new field with no meteors, then `parts`: the ship still at the center. */
const field = (parts = {}) => ({ ...newField(1), meteors: [], ...parts })
const FIRE = { ...IDLE, fire: true }

/** `f` after `n` steps of `input`. */
function run(f, n, input = IDLE) {
  for (let i = 0; i < n; i++) f = stepField(f, input)
  return f
}

const speed = (b) => Math.hypot(b.vx, b.vy)

/** The distance from `a` to `b`, the shorter way round. */
function apart(a, b) {
  const dx = Math.abs(a.x - b.x) % SCREEN.width
  const dy = Math.abs(a.y - b.y) % SCREEN.height
  return Math.hypot(Math.min(dx, SCREEN.width - dx), Math.min(dy, SCREEN.height - dy))
}

test('a new field: the ship still at the center, nose up, and the first wave on the edges', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const f = newField(seed)
    const { ship, meteors } = f
    assert.deepEqual([ship.x, ship.y, ship.vx, ship.vy, Math.sin(ship.heading)], [CENTER.x, CENTER.y, 0, 0, -1])
    assert.deepEqual([f.score, f.wave, f.ships, f.shots.length, f.debris.length], [0, 1, SHIPS - 1, 0, 0])
    assert.equal(meteors.length, WAVE.first)
    const [slow, fast] = METEOR.large.speed
    for (const m of meteors) {
      assert.equal(m.size, 'large')
      assert.ok(m.x === 0 || m.y === 0, `${m.x}, ${m.y} is on no edge`)
      assert.ok(speed(m) >= slow - 1e-9 && speed(m) <= fast + 1e-9)
    }
  }
})

test('each meteor has an outline of its own, its corners out to its radius', () => {
  const { meteors } = newField(3)
  const { radius, corners } = METEOR.large
  for (const m of meteors) {
    assert.equal(m.outline.length, corners)
    // Whole px, so a corner can round half a px either way.
    for (const [x, y] of m.outline) assert.ok(Math.hypot(x, y) >= radius * 0.75 - 1 && Math.hypot(x, y) <= radius + 1)
  }
  assert.equal(new Set(meteors.map((m) => JSON.stringify(m.outline))).size, meteors.length)
})

test('everything moves on, wrapping at every edge', () => {
  const f = field({ meteors: [rock('large', SCREEN.width - 0.5, 0.25, 1, -0.5)] })
  const { meteors } = stepField(f, IDLE)
  assert.deepEqual([meteors[0].x, meteors[0].y], [0.5, SCREEN.height - 0.25])
  // The ship goes up off the top and comes back in at the bottom.
  const { ship } = stepField({ ...f, ship: { ...f.ship, y: 1, vy: -2 } }, IDLE)
  assert.ok(ship.y > SCREEN.height - 2)
})

test('the ship: turning right swings its nose clockwise, left the other way, and thrust pushes along the nose', () => {
  const eighth = Math.round(Math.PI / 4 / SHIP.turn)
  const thrust = { ...IDLE, thrust: true }
  // An eighth of a turn from nose up, then thrust: up and right, or up and left.
  const right = run(run(field(), eighth, { ...IDLE, turn: 1 }), 1, thrust).ship
  assert.ok(right.vx > 0 && right.vy < 0)
  const left = run(run(field(), eighth, { ...IDLE, turn: -1 }), 1, thrust).ship
  assert.ok(left.vx < 0 && left.vy < 0)
})

test('the ship holds to its top speed under thrust, and coasts slower without it', () => {
  // A meteor parked in a corner, off the ship's line, holds back the next wave.
  const fast = run(field({ meteors: [rock('small', 0, 0)] }), 300, { ...IDLE, thrust: true })
  assert.ok(speed(fast.ship) <= SHIP.top && speed(fast.ship) > SHIP.top * 0.9)
  assert.ok(fast.ship.thrusting)
  const coasting = run(fast, 60)
  assert.ok(speed(coasting.ship) < speed(fast.ship))
  assert.ok(!coasting.ship.thrusting)
})

test('a press fires from the nose, at the ship’s velocity plus its own', () => {
  // Nose up from the center, a step on.
  const [s] = stepField(field(), FIRE).shots
  assert.ok(Math.abs(s.x - CENTER.x) < 1e-9)
  assert.equal(s.y, CENTER.y - SHIP.nose - SHOT.speed)
  assert.equal(s.vy, -SHOT.speed)
  // A moving ship's shot carries its speed.
  const moving = field({ ship: { ...field().ship, vx: 2 } })
  assert.ok(Math.abs(stepField(moving, FIRE).shots[0].vx - 2 * SHIP.drag) < 1e-9)
})

test('shots in flight hold back one more past the most, and age out', () => {
  const flying = Array.from({ length: SHOT.most }, (_, i) => shot(20 + 10 * i, 20))
  assert.equal(stepField(field({ shots: flying }), FIRE).shots.length, SHOT.most)
  assert.equal(stepField(field({ shots: flying.slice(1) }), FIRE).shots.length, SHOT.most)
  const ageing = [shot(20, 20, 0, 0, 1), shot(40, 20, 0, 0, 2)]
  assert.deepEqual(
    stepField(field({ shots: ageing }), IDLE).shots.map((s) => s.x),
    [40],
  )
})

test('a hit splits a large meteor into two medium and a medium into two small, takes a small one out, and scores its points', () => {
  for (const [size, left] of [
    ['large', ['medium', 'medium']],
    ['medium', ['small', 'small']],
    ['small', []],
  ]) {
    const f = stepField(field({ meteors: [rock(size, 100, 100)], shots: [shot(100, 100)] }), IDLE)
    assert.deepEqual(
      f.meteors.map((m) => m.size),
      left,
    )
    assert.equal(f.score, METEOR[size].points)
    assert.equal(f.shots.length, 0)
    assert.equal(f.debris.length, DEBRIS.count)
  }
})

test('debris ages out', () => {
  const hit = stepField(field({ meteors: [rock('small', 100, 100)], shots: [shot(100, 100)] }), IDLE)
  assert.equal(run(hit, Math.ceil(DEBRIS.life * 1.5)).debris.length, 0)
})

test('each shot takes out one meteor, the first it hits', () => {
  const f = stepField(field({ meteors: [rock('small', 100, 100), rock('small', 100, 100)], shots: [shot(100, 100)] }), IDLE)
  assert.equal(f.meteors.length, 1)
})

test('a hit counts across an edge', () => {
  const f = stepField(field({ meteors: [rock('medium', 1, 100)], shots: [shot(SCREEN.width - 2, 100)] }), IDLE)
  assert.equal(f.score, METEOR.medium.points)
})

test('a shot hits along its whole move: a fast one can’t step over a small meteor, and one passing wide misses', () => {
  const { radius } = METEOR.small
  // Both ends of the move a full radius past the meteor's edge.
  const through = shot(100 - 2 * radius, 100, 4 * radius)
  assert.equal(stepField(field({ meteors: [rock('small', 100, 100)], shots: [through] }), IDLE).score, METEOR.small.points)
  const wide = { ...through, y: 100 + 2 * radius }
  assert.equal(stepField(field({ meteors: [rock('small', 100, 100)], shots: [wide] }), IDLE).score, 0)
})

test('a meteor that hits the ship goes as a shot would have it, and the ship breaks up', () => {
  const lost = stepField(field({ meteors: [rock('large', CENTER.x, CENTER.y)] }), IDLE)
  assert.equal(lost.ship, null)
  assert.equal(lost.ships, SHIPS - 1)
  assert.deepEqual(
    lost.meteors.map((m) => m.size),
    ['medium', 'medium'],
  )
  assert.equal(lost.score, METEOR.large.points)
  assert.equal(lost.debris.length, DEBRIS.count + WRECK.count)
  // A ship on its way back fires nothing.
  assert.equal(stepField(lost, FIRE).shots.length, 0)
  // A meteor clear of the ship's radius and its own passes it by.
  const by = rock('large', CENTER.x + SHIP.radius + METEOR.large.radius + 1, CENTER.y)
  assert.ok(stepField(field({ meteors: [by] }), IDLE).ship)
})

test('a lost ship comes back at the center RESPAWN_DELAY steps on, from the reserve, once the center is clear', () => {
  const lost = stepField(field({ meteors: [rock('large', CENTER.x, CENTER.y)] }), IDLE)
  const clear = { ...lost, meteors: [rock('large', 20, 20)] }
  assert.equal(run(clear, RESPAWN_DELAY - 2).ship, null)
  const back = run(clear, RESPAWN_DELAY - 1)
  assert.deepEqual([back.ship.x, back.ship.y, back.ship.vx, back.ship.vy], [CENTER.x, CENTER.y, 0, 0])
  assert.equal(back.ships, lost.ships - 1)
  // A meteor in the way holds it back until it has gone.
  const blocked = run({ ...lost, meteors: [rock('large', CENTER.x + CLEAR, CENTER.y)] }, RESPAWN_DELAY * 2)
  assert.equal(blocked.ship, null)
  assert.ok(stepField({ ...blocked, meteors: [rock('large', 20, 20)] }, IDLE).ship)
})

test('losing the last ship ends the game, and no ship comes back', () => {
  assert.ok(!isOver(newField(1)))
  const over = stepField(field({ ships: 0, meteors: [rock('large', CENTER.x, CENTER.y)] }), IDLE)
  assert.ok(isOver(over))
  assert.ok(isOver(run({ ...over, meteors: [] }, RESPAWN_DELAY * 2)))
})

test('each EXTRA_SHIP points crossed adds a ship, even as the last one goes', () => {
  const hit = (score) => stepField(field({ score, meteors: [rock('small', 100, 100)], shots: [shot(100, 100)] }), IDLE)
  assert.equal(hit(EXTRA_SHIP - METEOR.small.points).ships, SHIPS)
  assert.equal(hit(2 * EXTRA_SHIP - METEOR.small.points).ships, SHIPS)
  assert.equal(hit(EXTRA_SHIP).ships, SHIPS - 1)
  // The meteor that takes the last ship earns the next: the game goes on.
  const last = { ships: 0, score: EXTRA_SHIP - METEOR.large.points, meteors: [rock('large', CENTER.x, CENTER.y)] }
  const saved = stepField(field(last), IDLE)
  assert.equal(saved.ships, 1)
  assert.ok(!isOver(saved))
})

test('a field clear of meteors brings the next wave WAVE_DELAY steps on, bigger each time up to the most', () => {
  const clear = field()
  assert.equal(run(clear, WAVE_DELAY - 1).meteors.length, 0)
  const next = run(clear, WAVE_DELAY)
  assert.equal(next.wave, 2)
  assert.equal(next.meteors.length, WAVE.first + WAVE.more)
  assert.ok(next.meteors.every((m) => m.size === 'large'))
  assert.equal(run(field({ wave: 40 }), WAVE_DELAY).meteors.length, WAVE.most)
})

test('a wave’s meteors start on the edges, clear of the ship', () => {
  for (const at of [
    { x: 3, y: 2 },
    { x: SCREEN.width - 10, y: 50 },
    { x: 70, y: SCREEN.height - 1 },
  ]) {
    for (let seed = 1; seed <= 30; seed++) {
      const start = newField(seed)
      const ship = { ...start.ship, ...at }
      for (const m of run({ ...start, ship, meteors: [] }, WAVE_DELAY).meteors) {
        assert.ok(m.x === 0 || m.y === 0, `${m.x}, ${m.y} is on no edge`)
        assert.ok(apart(m, ship) >= SAFE, `${m.x}, ${m.y} is ${apart(m, ship)} from the ship`)
      }
    }
  }
})

test('the same seed and input give the same field; another seed, another', () => {
  const input = (i) => ({ turn: i % 90 < 30 ? 1 : 0, thrust: i % 40 < 15, fire: i % 7 === 0 })
  const play = (seed) => {
    let f = newField(seed)
    for (let i = 0; i < 600; i++) f = stepField(f, input(i))
    return f
  }
  assert.deepEqual(play(7), play(7))
  assert.notDeepEqual(play(7).meteors, play(8).meteors)
})
