// Meteors' rules, pure: the screen the game is played on, the title screen's
// menu, what each key asks for, and the fixed-step clock a game runs on.
// windows.ts draws the state, feeds it the keys and runs the clock.

/** The screen in system px, one canvas px each. */
export const SCREEN = { width: 320, height: 240 } as const

/** The title screen's menu, top to bottom. */
export const TITLE_ITEMS = ['new-game', 'quit'] as const
export type TitleItem = (typeof TITLE_ITEMS)[number]

/** The title screen with its highlighted item, or a game `ticks` steps in. */
export type Game = { screen: 'title'; choice: number } | { screen: 'playing'; ticks: number }

export const titleScreen = (): Game => ({ screen: 'title', choice: 0 })
export const newGame = (): Game => ({ screen: 'playing', ticks: 0 })

/** One step of a game. The title screen stands still. */
export const step = (game: Game): Game => (game.screen === 'playing' ? { ...game, ticks: game.ticks + 1 } : game)

/** What a key asks of the game. */
export type Command = { type: 'highlight'; choice: number } | { type: 'choose'; item: TitleItem } | { type: 'end' }

/** A key as the game reads it: its name and the modifiers held. */
export interface Key {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}

/**
 * What `key` asks of `game`, or null for a key it ignores. On the title screen
 * the arrows move the highlight, wrapping, and Return or Space chooses it; in
 * a game Q or Escape asks to end it. A key held with ⌃, ⌘ or ⌥ is the menu
 * bar's.
 */
export function commandFor(game: Game, key: Key): Command | null {
  if (key.ctrlKey || key.metaKey || key.altKey) return null
  if (game.screen === 'playing') {
    return key.key === 'Escape' || key.key === 'q' || key.key === 'Q' ? { type: 'end' } : null
  }
  const n = TITLE_ITEMS.length
  if (key.key === 'ArrowUp') return { type: 'highlight', choice: (game.choice + n - 1) % n }
  if (key.key === 'ArrowDown') return { type: 'highlight', choice: (game.choice + 1) % n }
  if (key.key === 'Enter' || key.key === ' ') return { type: 'choose', item: TITLE_ITEMS[game.choice] ?? TITLE_ITEMS[0] }
  return null
}

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
