import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MAX_FRAME_MS, STEP_MS, commandFor, newGame, stepsDue, titleScreen } from '../src/apps/meteors/game.ts'

const title = (choice) => ({ screen: 'title', choice })

test('title: the arrows move the highlight, wrapping; Return or Space chooses it', () => {
  assert.deepEqual(commandFor(titleScreen(), { key: 'ArrowDown' }), { type: 'highlight', choice: 1 })
  assert.deepEqual(commandFor(title(1), { key: 'ArrowDown' }), { type: 'highlight', choice: 0 })
  assert.deepEqual(commandFor(titleScreen(), { key: 'ArrowUp' }), { type: 'highlight', choice: 1 })
  assert.deepEqual(commandFor(titleScreen(), { key: 'Enter' }), { type: 'choose', item: 'new-game' })
  assert.deepEqual(commandFor(title(1), { key: ' ' }), { type: 'choose', item: 'quit' })
  // Ending is a game's.
  assert.equal(commandFor(titleScreen(), { key: 'Escape' }), null)
  assert.equal(commandFor(titleScreen(), { key: 'q' }), null)
})

test('game: Q or Escape asks to end it; a key held with ⌃, ⌘ or ⌥ is the menu bar’s', () => {
  for (const key of ['q', 'Q', 'Escape']) assert.deepEqual(commandFor(newGame(), { key }), { type: 'end' })
  assert.equal(commandFor(newGame(), { key: 'ArrowDown' }), null)
  assert.equal(commandFor(newGame(), { key: 'q', ctrlKey: true }), null)
  assert.equal(commandFor(newGame(), { key: 'q', metaKey: true }), null)
  assert.equal(commandFor(titleScreen(), { key: 'Enter', altKey: true }), null)
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
