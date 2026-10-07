// What Meteors' screens look like, white ink on black. A game's field is drawn
// into the raster (raster.ts): each meteor's outline, the shots, the debris,
// the ship, its flame flickering while it thrusts, and the ships in reserve.
// Text goes over it on the screen: the title screen's name, menu and best
// score, a game's score, and PAUSED or GAME OVER on a black plate.

import { SCREEN, SHIP } from './field.ts'
import type { Field } from './field.ts'
import { TITLE_ITEMS } from './game.ts'
import type { Game, TitleItem } from './game.ts'
import { block, clear, line, outline, plot } from './raster.ts'
import type { Bits } from './raster.ts'
import { LINE } from './screen.ts'
import type { Screen } from './screen.ts'

const LABELS: Record<TitleItem, string> = { 'new-game': 'New Game', quit: 'Quit' }

/** The title, magnified, and its line's top. */
const TITLE = { text: 'METEORS', zoom: 3, top: 40 }
/** The menu: bars a line tall plus 2 above and below, stacked 4 apart. */
const ITEM = { width: 96, height: LINE + 4, top: 136, gap: 4 }
/** The best score's line, under the menu. */
const BEST_TOP = SCREEN.height - 28

/** Title menu item `i`'s bar, centered. */
export const itemBox = (i: number) => ({
  left: (SCREEN.width - ITEM.width) / 2,
  top: ITEM.top + i * (ITEM.height + ITEM.gap),
  width: ITEM.width,
  height: ITEM.height,
})

/** The left that centers `width` across `span`, the screen's by default. */
const centered = (width: number, span: number = SCREEN.width) => Math.floor((span - width) / 2)

/** The score's line, at the top left. */
const SCORE = { left: 8, top: 4 }
/** The ships in reserve, nose up under the score: the first's center, the
 *  room from one center to the next, and the most drawn. */
const RESERVE = { left: 12, top: 30, gap: 10, most: 10 }
/** A shot's square, in px. */
const SHOT_SIZE = 2

/** A line by its ends, x then y each. */
type Segment = readonly [number, number, number, number]

/** The ship pointing right, about its center: its two sides from the nose,
 *  and the bar across them. */
const HULL: readonly Segment[] = [
  [SHIP.nose, 0, -5, -4],
  [SHIP.nose, 0, -5, 4],
  [-3, -3, -3, 3],
]
/** Its flame, out behind the bar. */
const FLAME: readonly Segment[] = [
  [-3, -2, -8, 0],
  [-8, 0, -3, 2],
]
/** Steps the flame stays lit, then dark, while the ship thrusts. */
const FLICKER = 3

/** A ship at `place`, pointing along `heading`, its flame `lit` or not. */
function drawShip(bits: Bits, place: { x: number; y: number }, heading: number, lit: boolean) {
  const x = Math.round(place.x)
  const y = Math.round(place.y)
  const cos = Math.cos(heading)
  const sin = Math.sin(heading)
  // Each end turned to the heading and rounded, whole px from the center.
  const at = (px: number, py: number) => [x + Math.round(px * cos - py * sin), y + Math.round(px * sin + py * cos)] as const
  for (const [x0, y0, x1, y1] of lit ? [...HULL, ...FLAME] : HULL) {
    const [ax, ay] = at(x0, y0)
    const [bx, by] = at(x1, y1)
    line(bits, ax, ay, bx, by)
  }
}

function drawField(bits: Bits, field: Field) {
  // Each outline's corners are whole px from its rounded center, so it drifts
  // without changing shape.
  for (const m of field.meteors) outline(bits, m.outline, Math.round(m.x), Math.round(m.y))
  for (const s of field.shots) block(bits, s.x, s.y, SHOT_SIZE, SHOT_SIZE)
  for (const d of field.debris) plot(bits, d.x, d.y)
  const { ship } = field
  if (ship) drawShip(bits, ship, ship.heading, ship.thrusting && Math.floor(field.ticks / FLICKER) % 2 === 0)
  for (let i = 0; i < Math.min(field.ships, RESERVE.most); i++) {
    drawShip(bits, { x: RESERVE.left + i * RESERVE.gap, y: RESERVE.top }, -Math.PI / 2, false)
  }
}

function drawTitle(screen: Screen, choice: number, best: number) {
  const width = screen.measure(TITLE.text, 'display', TITLE.zoom)
  screen.text(TITLE.text, 'display', 'white', centered(width), TITLE.top, TITLE.zoom)
  TITLE_ITEMS.forEach((item, i) => {
    const box = itemBox(i)
    const on = i === choice
    if (on) screen.fill('white', box)
    const label = LABELS[item]
    const left = box.left + centered(screen.measure(label, 'display'), box.width)
    screen.text(label, 'display', on ? 'black' : 'white', left, box.top + 2)
  })
  if (!best) return
  const line = `Best ${best}`
  screen.text(line, 'body', 'white', centered(screen.measure(line, 'body')), BEST_TOP)
}

/** `text` doubled and centered, any `hint` under it, on a black plate 8 px
 *  wider all round, so both read over the field. */
function banner(screen: Screen, text: string, hint = '') {
  const zoom = 2
  const width = screen.measure(text, 'display', zoom)
  const hintWidth = hint ? screen.measure(hint, 'body') : 0
  const height = LINE * zoom + (hint ? LINE : 0)
  const top = centered(height, SCREEN.height)
  const plate = Math.max(width, hintWidth) + 16
  screen.fill('black', { left: centered(plate), top: top - 8, width: plate, height: height + 16 })
  screen.text(text, 'display', 'white', centered(width), top, zoom)
  if (hint) screen.text(hint, 'body', 'white', centered(hintWidth), top + LINE * zoom)
}

/** What a screen shows besides the game: whether the faces have loaded,
 *  which text waits on, and the best score so far. */
export interface View {
  faces: boolean
  best: number
}

/** Draw `game` on `screen`, a game's field through `bits`. */
export function drawScreen(screen: Screen, bits: Bits, game: Game, { faces, best }: View): void {
  clear(bits)
  if (game.screen !== 'title') drawField(bits, game.field)
  screen.present(bits)
  if (!faces) return
  if (game.screen === 'title') return drawTitle(screen, game.choice, best)
  screen.text(String(game.field.score), 'display', 'white', SCORE.left, SCORE.top)
  if (game.screen === 'over') banner(screen, 'GAME OVER')
  else if (game.paused) banner(screen, 'PAUSED', 'Click or press P to continue')
}
