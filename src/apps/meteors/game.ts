// Meteors' rules, pure: the screens a game goes through, what each key asks,
// the controls the keys work, and the fixed-step clock a game runs on.
// The field itself is field.ts's. windows.ts feeds the game its keys and runs
// the clock; draw.ts draws it.

import { IDLE, isOver, newField, stepField } from './field.ts'
import type { Field, Input } from './field.ts'

/** The title screen's menu, top to bottom. */
export const TITLE_ITEMS = ['new-game', 'quit'] as const
export type TitleItem = (typeof TITLE_ITEMS)[number]

/** Steps GAME OVER stays up before the title screen: 3 s. */
export const OVER_STEPS = 180

/** The title screen with its highlighted item; a game, paused or not; or a
 *  game over, its field drifting on with `left` steps to go. */
export type Game =
  | { screen: 'title'; choice: number }
  | { screen: 'playing'; field: Field; paused: boolean }
  | { screen: 'over'; field: Field; left: number }

export const titleScreen = (): Game => ({ screen: 'title', choice: 0 })
/** A game on a field seeded with `seed`. */
export const newGame = (seed: number): Game => ({ screen: 'playing', field: newField(seed), paused: false })

/** One step of `game` with `input`. The title screen and a paused game stand
 *  still. A game that loses its last ship is over: its field drifts on for
 *  OVER_STEPS, then the title screen comes back. */
export function step(game: Game, input: Input): Game {
  if (game.screen === 'title' || (game.screen === 'playing' && game.paused)) return game
  if (game.screen === 'over') {
    return game.left > 1 ? { ...game, field: stepField(game.field, IDLE), left: game.left - 1 } : titleScreen()
  }
  const field = stepField(game.field, input)
  return isOver(field) ? { screen: 'over', field, left: OVER_STEPS } : { ...game, field }
}

/** A saved best score, read back: a whole number of points above 0, else 0,
 *  so a missing or garbled one reads as none. */
export const bestOf = (saved: unknown): number =>
  typeof saved === 'number' && Number.isSafeInteger(saved) && saved > 0 ? saved : 0

/** What a key asks of the game. */
export type Command =
  | { type: 'highlight'; choice: number }
  | { type: 'choose'; item: TitleItem }
  | { type: 'end' }
  | { type: 'pause' }
  | { type: 'resume' }

/** A key as the game reads it: its name, whether it is a held key's repeat,
 *  and the modifiers held. */
export interface Key {
  key: string
  repeat?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}

/** Whether `key` is held with ⌃, ⌘ or ⌥, which makes it the menu bar's. */
const modified = (key: Key) => !!(key.ctrlKey || key.metaKey || key.altKey)

/**
 * What `key` asks of `game`, or null for a key it ignores. On the title screen
 * the arrows move the highlight, wrapping, and Return or Space chooses it. In
 * a game Q or Escape asks to end it and P pauses or resumes it; a held key's
 * repeats ask nothing. Game over takes no keys. A key held with ⌃, ⌘ or ⌥ is
 * the menu bar's.
 */
export function commandFor(game: Game, key: Key): Command | null {
  if (modified(key) || game.screen === 'over') return null
  if (game.screen === 'playing') {
    if (key.repeat) return null
    if (key.key === 'Escape' || key.key === 'q' || key.key === 'Q') return { type: 'end' }
    if (key.key === 'p' || key.key === 'P') return game.paused ? { type: 'resume' } : { type: 'pause' }
    return null
  }
  const n = TITLE_ITEMS.length
  if (key.key === 'ArrowUp') return { type: 'highlight', choice: (game.choice + n - 1) % n }
  if (key.key === 'ArrowDown') return { type: 'highlight', choice: (game.choice + 1) % n }
  if (key.key === 'Enter' || key.key === ' ') return { type: 'choose', item: TITLE_ITEMS[game.choice] ?? TITLE_ITEMS[0] }
  return null
}

/** What the player works in a game: turning and thrust are held down, and
 *  fire is pressed, a shot a press. */
export type Control = 'left' | 'right' | 'thrust' | 'fire'

const CONTROLS = new Map<string, Control>([
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['ArrowUp', 'thrust'],
  [' ', 'fire'],
])

/** The control `key` works, or null. A key held with ⌃, ⌘ or ⌥ is the menu bar's. */
export const controlFor = (key: Key): Control | null => (modified(key) ? null : (CONTROLS.get(key.key) ?? null))

/** A step's input: the controls held, and whether fire was pressed since the
 *  last step. Left and right together cancel. */
export const inputOf = (held: ReadonlySet<Control>, fire: boolean): Input => ({
  turn: Number(held.has('right')) - Number(held.has('left')),
  thrust: held.has('thrust'),
  fire,
})

/** A game's fixed step: 60 a second. */
export const STEPS_PER_SECOND = 60
export const STEP_MS = 1000 / STEPS_PER_SECOND
/** The most time one frame makes up, in ms. A longer gap, a background tab or
 *  a breakpoint, is dropped rather than run all at once. */
export const MAX_FRAME_MS = 250

/** The whole steps due once `elapsed` ms pass on top of the `carry` ms left
 *  from the frame before, and the carry left for the next. */
export function stepsDue(carry: number, elapsed: number): { steps: number; carry: number } {
  const t = carry + Math.min(Math.max(elapsed, 0), MAX_FRAME_MS)
  const steps = Math.floor(t / STEP_MS)
  return { steps, carry: t - steps * STEP_MS }
}
