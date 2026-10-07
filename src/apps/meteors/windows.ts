// Meteors window: the game's screen (screen.ts) in a vf-container of SCREEN's
// size, which holds the canvas on whole device px (desktop.css). The title
// screen offers New Game and Quit, by the arrows and Return or by a click. A
// game runs on the fixed-step clock (game.ts) from one animation frame to the
// next, fed the controls held, and draw.ts draws each frame a step ran. The
// game runs only while its screen has the keyboard focus: losing it pauses
// the game, and P or a click on the screen resumes it. Q or Escape asks
// whether to end it. Game over runs out on the clock, focus or not, and gives
// way to the title screen, the game's score counted toward the best.

import type { VfWindow } from 'vintage-frames'
import { drawScreen, itemBox } from './draw.ts'
import { SCREEN } from './field.ts'
import { STEP_MS, TITLE_ITEMS, commandFor, controlFor, inputOf, newGame, step, stepsDue, titleScreen } from './game.ts'
import type { Command, Control, Game, TitleItem } from './game.ts'
import { bitsOf } from './raster.ts'
import { facesLoaded, screenOf } from './screen.ts'

/** What the window asks of its application. */
export interface GameHooks {
  quit(): void
  /** Ask whether to end the game in progress; resolves true to end it. */
  confirmEnd(): Promise<boolean>
  /** The best score so far. */
  best(): number
  /** Count a game's score toward the best, once its last ship is lost. */
  record(score: number): void
}

/** A seed for a new game's field. */
const freshSeed = () => Math.floor(Math.random() * 2 ** 32)

/** `win`, a fresh Meteors window, on the title screen. */
export function gameWindow(win: VfWindow, hooks: GameHooks): VfWindow {
  const stage = win.querySelector('.meteors-screen') as HTMLElement
  const canvas = stage.querySelector('canvas')!
  const screen = screenOf(canvas)
  const bits = bitsOf(SCREEN.width, SCREEN.height)
  let game: Game = titleScreen()
  /** Whether the faces have loaded; text waits on them. */
  let faces = false
  /** Whether the alert is up. */
  let asking = false
  /** The controls held down, and whether fire was pressed since the last step. */
  const held = new Set<Control>()
  let fired = false

  const draw = () => drawScreen(screen, bits, game, { faces, best: hooks.best() })
  /** Whether a game is under way: in progress and not paused. */
  const underWay = () => game.screen === 'playing' && !game.paused
  /** Whether the clock runs: for a game under way, and for game over to run out. */
  const running = () => underWay() || game.screen === 'over'

  // The clock: the pending frame, the last frame's time, and the time short
  // of a whole step.
  let frame = 0
  let last: number | null = null
  let carry = 0

  /** Run the game from the next frame. The clock starts half a step in, so
   *  frames that jitter around the step's length still take one step each.
   *  While it runs, the page losing the focus or going hidden pauses the game
   *  too, in case its screen hears nothing of it. */
  function run() {
    if (frame) return
    last = null
    carry = STEP_MS / 2
    frame = requestAnimationFrame(tick)
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', pauseIfHidden)
  }

  function halt() {
    cancelAnimationFrame(frame)
    frame = 0
    window.removeEventListener('blur', pause)
    document.removeEventListener('visibilitychange', pauseIfHidden)
  }

  function tick(now: number) {
    frame = 0
    // Closed, paused, or back on the title screen.
    if (!win.isConnected || !running()) return halt()
    const due = stepsDue(carry, last == null ? 0 : now - last)
    last = now
    carry = due.carry
    for (let i = 0; i < due.steps; i++) {
      const before = game
      game = step(game, inputOf(held, fired))
      fired = false
      if (before.screen === 'playing' && game.screen === 'over') hooks.record(game.field.score)
    }
    if (due.steps) draw()
    frame = requestAnimationFrame(tick)
  }

  /** Pause the game under way. The keys held are let go, since their keyups
   *  will land elsewhere, and a press not yet fired is dropped. */
  function pause() {
    held.clear()
    fired = false
    if (game.screen !== 'playing' || game.paused) return
    game = { ...game, paused: true }
    halt()
    draw()
  }

  const pauseIfHidden = () => {
    if (document.hidden) pause()
  }

  function resume() {
    if (game.screen !== 'playing' || !game.paused) return
    game = { ...game, paused: false }
    draw()
    run()
  }

  function choose(item: TitleItem) {
    if (item === 'quit') return hooks.quit()
    held.clear()
    fired = false
    game = newGame(freshSeed())
    draw()
    run()
  }

  /** Ask whether to end the game, which stands paused while the alert is up.
   *  Ending it goes back to the title screen; Cancel goes back to the game as
   *  it was, its screen given the keys again. */
  async function askToEnd() {
    if (asking || game.screen !== 'playing') return
    asking = true
    const paused = game.paused
    pause()
    const end = await hooks.confirmEnd()
    asking = false
    if (!win.isConnected || game.screen !== 'playing') return
    if (end) {
      game = titleScreen()
      draw()
    } else if (!paused) {
      stage.focus({ preventScroll: true })
      resume()
    }
  }

  function act(cmd: Command) {
    if (cmd.type === 'highlight') {
      game = { screen: 'title', choice: cmd.choice }
      draw()
    } else if (cmd.type === 'choose') choose(cmd.item)
    else if (cmd.type === 'pause') pause()
    else if (cmd.type === 'resume') resume()
    else void askToEnd()
  }

  // Keys reach the game while its screen has the focus: the window manager
  // moves it there on open, and a click on the screen takes it.
  stage.addEventListener('keydown', (e) => {
    const cmd = commandFor(game, e)
    if (cmd) {
      e.preventDefault()
      return act(cmd)
    }
    const control = underWay() ? controlFor(e) : null
    if (!control) return
    e.preventDefault()
    // A shot is a fresh press: a held key's repeats never fire, so the Space
    // that chose New Game doesn't either.
    if (control === 'fire') fired ||= !e.repeat
    else held.add(control)
  })
  // A release lets its control go, whatever modifiers came down since.
  stage.addEventListener('keyup', (e) => {
    const control = controlFor({ key: e.key })
    if (control) held.delete(control)
  })
  // Anything else taking the focus pauses the game: another window, the
  // desktop, a menu, the alert.
  stage.addEventListener('focusout', pause)

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
  // On the title screen the pointer highlights an item and a click chooses
  // it. In a game a click resumes it, if it is paused.
  canvas.addEventListener('pointermove', (e) => {
    const i = itemAt(e)
    if (game.screen === 'title' && i >= 0 && i !== game.choice) act({ type: 'highlight', choice: i })
  })
  canvas.addEventListener('click', (e) => {
    if (game.screen === 'playing') return resume()
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
