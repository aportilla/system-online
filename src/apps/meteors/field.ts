// Meteors' field, pure: the ship, its shots, the meteors and the debris on a
// screen that wraps at every edge, the score and the ships, the waves, and
// the step that moves them all. Every random draw comes from the field's own
// seeded generator, so a step is a function of the field and the input
// alone. game.ts runs the step; draw.ts draws the field.

import type { Points } from './raster.ts'

/** The field, which is the whole screen, in system px: one canvas px each. */
export const SCREEN = { width: 320, height: 240 } as const

/** The middle of the field, where the ship starts and comes back. */
export const CENTER = { x: SCREEN.width / 2, y: SCREEN.height / 2 } as const

export type Size = 'large' | 'medium' | 'small'

/** A place in system px. */
interface Point {
  x: number
  y: number
}

/** A place, and a velocity in px a step. */
interface Body extends Point {
  vx: number
  vy: number
}

export interface Ship extends Body {
  /** Radians clockwise from pointing right: -π/2 points up. */
  heading: number
  /** Whether it thrust on the last step, for its flame. */
  thrusting: boolean
}

export interface Meteor extends Body {
  size: Size
  /** Its corners, whole px from its center. */
  outline: Points
}

/** A shot or a piece of debris, gone in `life` steps. */
export interface Particle extends Body {
  life: number
}

export interface Field {
  /** The ship, or null while a lost one is on its way back and once the game
   *  is over. */
  ship: Ship | null
  /** The ships in reserve. */
  ships: number
  shots: Particle[]
  meteors: Meteor[]
  debris: Particle[]
  score: number
  /** The wave on the field, from 1. */
  wave: number
  /** Steps the field has been clear of meteors. */
  emptyFor: number
  /** Steps since the ship was lost. */
  lostFor: number
  /** Steps since the game began. */
  ticks: number
  /** The generator's state, carried from step to step. */
  seed: number
}

/** What the player asks of one step. */
export interface Input {
  /** -1 turns left, 1 right, 0 neither. */
  turn: number
  thrust: boolean
  /** A fresh press of fire. */
  fire: boolean
}

export const IDLE: Input = { turn: 0, thrust: false, fire: false }

/** The ship: its turn a step in radians, its thrust in px a step², its top
 *  speed in px a step, the share of its speed it keeps each step, its nose's
 *  reach from its center, where its shots leave, and the radius a meteor hits
 *  it within. */
export const SHIP = { turn: Math.PI / 36, thrust: 0.06, top: 3, drag: 0.99, nose: 6, radius: 4 } as const

/** Shots: their speed past the ship's in px a step, their life in steps, and
 *  the most in flight at once. */
export const SHOT = { speed: 4, life: 45, most: 4 } as const

/** Each size of meteor: its radius in px, its slowest and fastest speeds in
 *  px a step, the corners round its outline, its points, and what a hit
 *  leaves: two of the next size, or none. */
export const METEOR: Record<
  Size,
  { radius: number; speed: readonly [number, number]; corners: number; points: number; splits: Size | null }
> = {
  large: { radius: 14, speed: [0.3, 0.7], corners: 11, points: 20, splits: 'medium' },
  medium: { radius: 8, speed: [0.6, 1.2], corners: 9, points: 50, splits: 'small' },
  small: { radius: 4, speed: [0.9, 1.6], corners: 7, points: 100, splits: null },
}

/** A hit lands within this share of a meteor's radius: inside its outline,
 *  whose corners reach from three quarters of the radius to all of it. */
const REACH = 0.85

/** The debris a hit meteor leaves: its px, their top speed past the meteor's
 *  in px a step, and their life in steps, give or take half again. */
export const DEBRIS = { count: 6, speed: 1.2, life: 24 } as const
/** The debris a lost ship leaves, the same way. */
export const WRECK = { count: 14, speed: 1, life: 50 } as const

/** The ships a game starts with, the one on the field included, and the
 *  points that earn one more. */
export const SHIPS = 3
export const EXTRA_SHIP = 10_000

/** Steps a lost ship takes to come back, at the least: 2 s. */
export const RESPAWN_DELAY = 120

/** The room the center needs past every meteor's edge, in px, before a lost
 *  ship comes back to it. */
export const CLEAR = 40

/** Waves: the first's large meteors, the more each wave brings, and the most. */
export const WAVE = { first: 4, more: 2, most: 11 } as const

/** Steps a field clear of meteors waits for the next wave: 2 s. */
export const WAVE_DELAY = 120

/** The least room a wave's meteor starts from the ship, in px. At most a
 *  quarter of the field's height, so half the field along an edge is clear. */
export const SAFE = 60

/** A draw in [0, 1). */
type Draw = () => number

/** A generator from `seed` (mulberry32): its draws, and the state to carry on from. */
function generator(seed: number): { draw: Draw; seed: () => number } {
  let s = seed | 0
  return {
    draw() {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), s | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    seed: () => s,
  }
}

/** `v` wrapped into [0, `span`). */
const wrap = (v: number, span: number) => ((v % span) + span) % span

/** The shorter way from `a` to `b` round a span of `span`. */
function across(a: number, b: number, span: number): number {
  const d = wrap(b - a, span)
  return d > span / 2 ? d - span : d
}

/** The distance from `a` to `b`, the shorter way round. */
const distance = (a: Point, b: Point) => Math.hypot(across(a.x, b.x, SCREEN.width), across(a.y, b.y, SCREEN.height))

/** `b` a step on, wrapped at the edges. */
const moved = <T extends Body>(b: T): T => ({ ...b, x: wrap(b.x + b.vx, SCREEN.width), y: wrap(b.y + b.vy, SCREEN.height) })

/** `p` a step on and a step older. */
const aged = (p: Particle): Particle => ({ ...moved(p), life: p.life - 1 })
const alive = (p: Particle) => p.life > 0

/** The ship as it starts and comes back: still at the center, nose up. */
const startingShip = (): Ship => ({ ...CENTER, vx: 0, vy: 0, heading: -Math.PI / 2, thrusting: false })

/** `ship` a step on: turned, thrust, held to its top speed, slowed by drag, and moved. */
function fly(ship: Ship, input: Input): Ship {
  const heading = wrap(ship.heading + input.turn * SHIP.turn, 2 * Math.PI)
  let { vx, vy } = ship
  if (input.thrust) {
    vx += Math.cos(heading) * SHIP.thrust
    vy += Math.sin(heading) * SHIP.thrust
  }
  const keep = Math.min(1, SHIP.top / Math.hypot(vx, vy)) * SHIP.drag
  return moved({ ...ship, heading, vx: vx * keep, vy: vy * keep, thrusting: input.thrust })
}

/** A shot from `ship`'s nose, at the ship's velocity plus its own. */
function shotFrom(ship: Ship): Particle {
  const cos = Math.cos(ship.heading)
  const sin = Math.sin(ship.heading)
  return {
    x: wrap(ship.x + cos * SHIP.nose, SCREEN.width),
    y: wrap(ship.y + sin * SHIP.nose, SCREEN.height),
    vx: ship.vx + cos * SHOT.speed,
    vy: ship.vy + sin * SHOT.speed,
    life: SHOT.life,
  }
}

/** A `size` meteor at `x`, `y`, headed anywhere at one of its size's speeds,
 *  in an outline of its own: its corners evenly round it give or take a
 *  little, each from three quarters of its radius out to all of it. */
function meteor(draw: Draw, size: Size, x: number, y: number): Meteor {
  const { radius, speed, corners } = METEOR[size]
  const heading = draw() * 2 * Math.PI
  const pace = speed[0] + (speed[1] - speed[0]) * draw()
  const outline = Array.from({ length: corners }, (_, i) => {
    const angle = ((i + (draw() - 0.5) * 0.6) / corners) * 2 * Math.PI
    const reach = radius * (0.75 + 0.25 * draw())
    return [Math.round(Math.cos(angle) * reach), Math.round(Math.sin(angle) * reach)] as const
  })
  return { size, x, y, vx: Math.cos(heading) * pace, vy: Math.sin(heading) * pace, outline }
}

/** Debris flung from `from`: `count` px, each at up to `speed` px a step on
 *  top of its velocity, lasting `life` steps up to half again. */
function burst(draw: Draw, from: Body, { count, speed, life }: { count: number; speed: number; life: number }): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = draw() * 2 * Math.PI
    const pace = speed * (0.3 + 0.7 * draw())
    return {
      x: from.x,
      y: from.y,
      vx: from.vx + Math.cos(angle) * pace,
      vy: from.vy + Math.sin(angle) * pace,
      life: Math.round(life * (1 + 0.5 * draw())),
    }
  })
}

/** Whether `shot` came within a hit of `m` this step: anywhere along its
 *  move, as the meteor saw it, so a fast shot can't step over a small meteor
 *  between one step and the next. */
function strikes(shot: Particle, m: Meteor): boolean {
  // Where the shot ended up from the meteor, the shorter way round, and its
  // move this step as the meteor saw it.
  const ex = across(m.x, shot.x, SCREEN.width)
  const ey = across(m.y, shot.y, SCREEN.height)
  const dx = shot.vx - m.vx
  const dy = shot.vy - m.vy
  // How far back along that move it passed nearest.
  const back = Math.min(1, Math.max(0, (ex * dx + ey * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(ex - back * dx, ey - back * dy) < METEOR[m.size].radius * REACH
}

/** The first of `meteors` that hits `ship`, if any. */
const crash = (ship: Ship, meteors: Meteor[]) =>
  meteors.find((m) => distance(ship, m) < SHIP.radius + METEOR[m.size].radius * REACH)

/** Wave `wave`'s large meteors, each starting on the top or left edge: the
 *  bottom and right edges are the same ones on a field that wraps. One that
 *  would start within SAFE of `near` starts half the field along its edge. */
function waveOf(draw: Draw, wave: number, near: Point): Meteor[] {
  const count = Math.min(WAVE.first + (wave - 1) * WAVE.more, WAVE.most)
  return Array.from({ length: count }, () => {
    const top = draw() < 0.5
    const along = draw()
    let x = top ? along * SCREEN.width : 0
    let y = top ? 0 : along * SCREEN.height
    if (distance({ x, y }, near) < SAFE) {
      if (top) x = wrap(x + SCREEN.width / 2, SCREEN.width)
      else y = wrap(y + SCREEN.height / 2, SCREEN.height)
    }
    return meteor(draw, 'large', x, y)
  })
}

/** Whether the game is over: no ship on the field, and none in reserve. */
export const isOver = (field: Field): boolean => !field.ship && field.ships === 0

/** A field seeded with `seed`: the ship still at the center, nose up, the
 *  rest of its SHIPS in reserve, and the first wave on the edges. */
export function newField(seed: number): Field {
  const { draw, seed: carried } = generator(seed)
  const ship = startingShip()
  const meteors = waveOf(draw, 1, ship)
  return {
    ship,
    ships: SHIPS - 1,
    shots: [],
    meteors,
    debris: [],
    score: 0,
    wave: 1,
    emptyFor: 0,
    lostFor: 0,
    ticks: 0,
    seed: carried(),
  }
}

/**
 * `field` a step on with `input`, in order:
 *
 * 1. The ship flies, and a fresh press fires from its nose while fewer than
 *    SHOT.most shots fly.
 * 2. Everything moves, and shots and debris age out.
 * 3. Each shot takes out the first meteor it hits, for that meteor's points:
 *    a large one leaves two medium and a medium two small, each headed its
 *    own way, and every one leaves debris.
 * 4. A meteor that hits the ship goes the same way, and the ship breaks up.
 * 5. Every EXTRA_SHIP points adds a ship.
 * 6. A field clear of meteors brings the next wave WAVE_DELAY steps on.
 * 7. While there are ships in reserve, a lost ship comes back at the center
 *    RESPAWN_DELAY steps on, once the center is CLEAR.
 */
export function stepField(field: Field, input: Input): Field {
  const { draw, seed } = generator(field.seed)
  let ship = field.ship && fly(field.ship, input)
  const fired = ship && input.fire && field.shots.length < SHOT.most ? [...field.shots, shotFrom(ship)] : field.shots
  const meteors = field.meteors.map(moved)
  const debris = field.debris.map(aged).filter(alive)
  const shots: Particle[] = []
  const born: Meteor[] = []
  let { ships, score, wave, emptyFor, lostFor } = field

  /** Take `hit` off the field for its points, leaving what it splits into
   *  and its debris. */
  function shatter(hit: Meteor) {
    meteors.splice(meteors.indexOf(hit), 1)
    const { points, splits } = METEOR[hit.size]
    score += points
    if (splits) born.push(meteor(draw, splits, hit.x, hit.y), meteor(draw, splits, hit.x, hit.y))
    debris.push(...burst(draw, hit, DEBRIS))
  }

  for (const shot of fired.map(aged).filter(alive)) {
    const hit = meteors.find((m) => strikes(shot, m))
    if (hit) shatter(hit)
    else shots.push(shot)
  }
  const crashed = ship && crash(ship, meteors)
  if (ship && crashed) {
    shatter(crashed)
    debris.push(...burst(draw, ship, WRECK))
    ship = null
    lostFor = 0
  }
  meteors.push(...born)
  ships += Math.floor(score / EXTRA_SHIP) - Math.floor(field.score / EXTRA_SHIP)
  emptyFor = meteors.length ? 0 : emptyFor + 1
  if (emptyFor >= WAVE_DELAY) {
    wave += 1
    emptyFor = 0
    meteors.push(...waveOf(draw, wave, ship ?? CENTER))
  }
  if (!ship && ships > 0) {
    lostFor += 1
    if (lostFor >= RESPAWN_DELAY && meteors.every((m) => distance(CENTER, m) >= CLEAR + METEOR[m.size].radius)) {
      ship = startingShip()
      ships -= 1
    }
  }
  return { ship, ships, shots, meteors, debris, score, wave, emptyFor, lostFor, ticks: field.ticks + 1, seed: seed() }
}
