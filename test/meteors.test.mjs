import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CENTER, IDLE, newField } from '../src/apps/meteors/field.ts'
import {
  MAX_FRAME_MS,
  OVER_STEPS,
  STEP_MS,
  bestOf,
  commandFor,
  controlFor,
  inputOf,
  newGame,
  step,
  stepsDue,
  titleScreen,
} from '../src/apps/meteors/game.ts'

const title = (choice) => ({ screen: 'title', choice })
/** A game under way, or paused. */
const game = (paused = false) => ({ ...newGame(1), paused })

test('title: the arrows move the highlight, wrapping; Return or Space chooses it', () => {
  assert.deepEqual(commandFor(titleScreen(), { key: 'ArrowDown' }), { type: 'highlight', choice: 1 })
  assert.deepEqual(commandFor(title(1), { key: 'ArrowDown' }), { type: 'highlight', choice: 0 })
  assert.deepEqual(commandFor(titleScreen(), { key: 'ArrowUp' }), { type: 'highlight', choice: 1 })
  assert.deepEqual(commandFor(titleScreen(), { key: 'Enter' }), { type: 'choose', item: 'new-game' })
  assert.deepEqual(commandFor(title(1), { key: ' ' }), { type: 'choose', item: 'quit' })
  // Ending and pausing are a game's.
  assert.equal(commandFor(titleScreen(), { key: 'Escape' }), null)
  assert.equal(commandFor(titleScreen(), { key: 'q' }), null)
  assert.equal(commandFor(titleScreen(), { key: 'p' }), null)
})

test('game: Q or Escape asks to end it, P pauses and resumes it; a held key’s repeats ask nothing', () => {
  for (const key of ['q', 'Q', 'Escape']) assert.deepEqual(commandFor(game(), { key }), { type: 'end' })
  assert.deepEqual(commandFor(game(true), { key: 'Escape' }), { type: 'end' })
  assert.deepEqual(commandFor(game(), { key: 'p' }), { type: 'pause' })
  assert.deepEqual(commandFor(game(true), { key: 'P' }), { type: 'resume' })
  assert.equal(commandFor(game(), { key: 'p', repeat: true }), null)
  assert.equal(commandFor(game(), { key: 'Escape', repeat: true }), null)
  // In a game the arrows are controls, not commands.
  assert.equal(commandFor(game(), { key: 'ArrowUp' }), null)
})

test('a key held with ⌃, ⌘ or ⌥ is the menu bar’s', () => {
  assert.equal(commandFor(game(), { key: 'q', ctrlKey: true }), null)
  assert.equal(commandFor(game(), { key: 'p', metaKey: true }), null)
  assert.equal(commandFor(titleScreen(), { key: 'Enter', altKey: true }), null)
  assert.equal(controlFor({ key: 'ArrowLeft', ctrlKey: true }), null)
})

test('controls: ← and → turn, ↑ thrusts, Space fires; left and right together cancel', () => {
  assert.equal(controlFor({ key: 'ArrowLeft' }), 'left')
  assert.equal(controlFor({ key: 'ArrowRight' }), 'right')
  assert.equal(controlFor({ key: 'ArrowUp' }), 'thrust')
  assert.equal(controlFor({ key: ' ' }), 'fire')
  assert.equal(controlFor({ key: 'ArrowDown' }), null)
  assert.deepEqual(inputOf(new Set(['left']), false), { turn: -1, thrust: false, fire: false })
  assert.deepEqual(inputOf(new Set(['right', 'thrust']), true), { turn: 1, thrust: true, fire: true })
  assert.deepEqual(inputOf(new Set(['left', 'right']), false), { turn: 0, thrust: false, fire: false })
})

test('step: losing the last ship is game over, which drifts on for OVER_STEPS, then gives way to the title screen', () => {
  const doomed = { ...newField(1), ships: 0, meteors: [{ size: 'large', ...CENTER, vx: 0, vy: 0, outline: [] }] }
  let g = step({ screen: 'playing', field: doomed, paused: false }, IDLE)
  assert.equal(g.screen, 'over')
  assert.equal(step(g, IDLE).field.ticks, g.field.ticks + 1)
  for (let i = 1; i < OVER_STEPS; i++) g = step(g, IDLE)
  assert.equal(g.screen, 'over')
  assert.deepEqual(step(g, IDLE), titleScreen())
})

test('best: a saved best reads back as whole points above 0, anything else as none', () => {
  assert.equal(bestOf(1230), 1230)
  for (const saved of [undefined, null, 0, -20, 12.5, Infinity, NaN, '1230', {}]) assert.equal(bestOf(saved), 0)
})

test('game over takes no keys', () => {
  const over = { screen: 'over', field: newField(1), left: OVER_STEPS }
  for (const key of ['Escape', 'q', 'p', 'Enter', ' ', 'ArrowUp']) assert.equal(commandFor(over, { key }), null)
})

test('step: a game moves on; the title screen and a paused game stand still', () => {
  const g = game()
  assert.equal(step(g, IDLE).field.ticks, g.field.ticks + 1)
  const paused = game(true)
  assert.equal(step(paused, IDLE), paused)
  const t = titleScreen()
  assert.equal(step(t, IDLE), t)
})

test('clock: whole steps due, the rest carried, a long gap capped', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`)
  const first = stepsDue(0, STEP_MS * 2.5)
  assert.equal(first.steps, 2)
  near(first.carry, STEP_MS / 2)
  // The carry counts toward the next frame.
  const next = stepsDue(first.carry, STEP_MS * 0.75)
  assert.equal(next.steps, 1)
  near(next.carry, STEP_MS / 4)
  // A gap past MAX_FRAME_MS runs MAX_FRAME_MS of steps; time going backward runs none.
  assert.equal(stepsDue(0, 60_000).steps, Math.floor(MAX_FRAME_MS / STEP_MS))
  assert.deepEqual(stepsDue(5, -100), { steps: 0, carry: 5 })
})
