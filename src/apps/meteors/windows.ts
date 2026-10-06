// Meteors window: the game's screen (screen.ts) in a vf-container of
// SCREEN's size, which holds the canvas on whole device px (desktop.css). The
// title screen offers New Game and Quit, by the arrows and Return or by a
// click, and is drawn when it changes. A game runs on the fixed-step clock
// (game.ts) from one animation frame to the next, and stops while the alert
// asks whether to end it. For now a game is a placeholder: the time it has run.

import type { VfWindow } from 'vintage-frames'
import { SCREEN, STEPS_PER_SECOND, STEP_MS, TITLE_ITEMS, commandFor, newGame, step, stepsDue, titleScreen } from './game.ts'
import type { Command, Game, TitleItem } from './game.ts'
import { LINE, facesLoaded, screenOf } from './screen.ts'

const LABELS: Record<TitleItem, string> = { 'new-game': 'New Game', quit: 'Quit' }

/** The title, magnified, and its line's top. */
const TITLE = { text: 'METEORS', zoom: 3, top: 40 }
/** The menu: bars a line tall plus 2 above and below, stacked 4 apart. */
const ITEM = { width: 96, height: LINE + 4, top: 136, gap: 4 }

/** Title menu item `i`'s bar, centered. */
const itemBox = (i: number) => ({
  left: (SCREEN.width - ITEM.width) / 2,
  top: ITEM.top + i * (ITEM.height + ITEM.gap),
  width: ITEM.width,
  height: ITEM.height,
})

/** The left that centers `width` across `span`, the screen's by default. */
const centered = (width: number, span: number = SCREEN.width) => Math.floor((span - width) / 2)

/** A game's time as m:ss. */
function playTime(ticks: number): string {
  const s = Math.floor(ticks / STEPS_PER_SECOND)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** What the window asks of its application. */
export interface GameHooks {
  quit(): void
  /** Ask whether to end the game in progress; resolves true to end it. */
  confirmEnd(): Promise<boolean>
}

/** `win`, a fresh Meteors window, on the title screen. */
export function gameWindow(win: VfWindow, hooks: GameHooks): VfWindow {
  const stage = win.querySelector('.meteors-screen') as HTMLElement
  const canvas = stage.querySelector('canvas')!
  const screen = screenOf(canvas)
  let game: Game = titleScreen()
  /** Whether the faces have loaded; text waits on them. */
  let faces = false
  /** Whether the alert is up. */
  let asking = false

  function drawTitle(choice: number) {
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
  }

  function drawGame(ticks: number) {
    for (const [text, top] of [
      ['Game in progress', 96],
      [playTime(ticks), 116],
    ] as const) {
      screen.text(text, 'display', 'white', centered(screen.measure(text, 'display')), top)
    }
    const hint = 'Q or Esc ends the game'
    screen.text(hint, 'body', 'white', centered(screen.measure(hint, 'body')), SCREEN.height - 28)
  }

  function draw() {
    screen.fill('black')
    if (!faces) return
    if (game.screen === 'title') drawTitle(game.choice)
    else drawGame(game.ticks)
  }

  // The clock: the pending frame, the last frame's time, and the time short
  // of a whole step.
  let frame = 0
  let last: number | null = null
  let carry = 0

  /** Run the game from the next frame. The clock starts half a step in, so
   *  frames that jitter around the step's length still take one step each. */
  function run() {
    if (frame) return
    last = null
    carry = STEP_MS / 2
    frame = requestAnimationFrame(tick)
  }

  function halt() {
    cancelAnimationFrame(frame)
    frame = 0
  }

  function tick(now: number) {
    frame = 0
    // Closed, or back on the title screen.
    if (!win.isConnected || game.screen !== 'playing') return
    const due = stepsDue(carry, last == null ? 0 : now - last)
    last = now
    carry = due.carry
    for (let i = 0; i < due.steps; i++) game = step(game)
    draw()
    frame = requestAnimationFrame(tick)
  }

  function choose(item: TitleItem) {
    if (item === 'quit') return hooks.quit()
    game = newGame()
    draw()
    run()
  }

  async function askToEnd() {
    if (asking) return
    asking = true
    halt()
    const end = await hooks.confirmEnd()
    asking = false
    if (!win.isConnected || game.screen !== 'playing') return
    if (!end) return run()
    game = titleScreen()
    draw()
  }

  function act(cmd: Command) {
    if (cmd.type === 'highlight') {
      game = { screen: 'title', choice: cmd.choice }
      draw()
    } else if (cmd.type === 'choose') choose(cmd.item)
    else void askToEnd()
  }

  // Keys reach the game while its screen has the focus: the window manager
  // moves it there on open, and a click on the screen takes it.
  stage.addEventListener('keydown', (e) => {
    const cmd = commandFor(game, e)
    if (!cmd) return
    e.preventDefault()
    act(cmd)
  })

  /** The index of the title menu item under the pointer, else -1. */
  const itemAt = (e: MouseEvent): number => {
    const r = canvas.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * SCREEN.width
    const y = ((e.clientY - r.top) / r.height) * SCREEN.height
    return TITLE_ITEMS.findIndex((_, i) => {
      const b = itemBox(i)
      return x >= b.left && x < b.left + b.width && y >= b.top && y < b.top + b.height
    })
  }
  // On the title screen the pointer highlights an item and a click chooses it.
  canvas.addEventListener('pointermove', (e) => {
    const i = itemAt(e)
    if (game.screen === 'title' && i >= 0 && i !== game.choice) act({ type: 'highlight', choice: i })
  })
  canvas.addEventListener('click', (e) => {
    const item = TITLE_ITEMS[itemAt(e)]
    if (game.screen === 'title' && item) choose(item)
  })

  draw()
  void facesLoaded().then(() => {
    faces = true
    draw()
  })
  return win
}
