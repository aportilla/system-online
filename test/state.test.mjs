import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createStore } from '../src/state/store.ts'
import { pasteSource } from '../src/state/clipboard.ts'
import { missingDefaults, fontsHome, restoreDefaults, FONTS_FOLDER } from '../src/state/defaults.ts'
import { readDesktopState, openWindowsOf } from '../src/shell/desktop-state.ts'
import { pinOf } from '../src/shell/layout.ts'
import { HD, TRASH, childrenOf } from '../src/state/files.ts'
import { library } from './helpers.mjs'

test('store: a patch that changes nothing notifies no one', () => {
  const s = createStore({ a: 1, b: 2 })
  let calls = 0
  s.subscribe(() => calls++)
  s.patch({ a: 1 })
  assert.equal(calls, 0)
  const before = s.get()
  s.patch({ a: 3 })
  assert.equal(calls, 1)
  assert.notEqual(s.get(), before)
})

test('paste source: the items while the system clipboard holds their names or cannot be read', () => {
  const held = { items: [{ kind: 'text', id: 'a' }], text: 'Note\nBox' }
  assert.equal(pasteSource(held, { text: 'Note\r\nBox\n' }), 'items')
  assert.equal(pasteSource(held, null), 'items')
  assert.equal(pasteSource(held, { text: 'something else' }), 'none')
  assert.equal(pasteSource({ items: [], text: '' }, null), 'none')
})

const TEXTS = [
  { key: 'read-me', name: 'Read Me', home: 'desktop' },
  { key: 'about', name: 'About', home: 'hd' },
]

test('defaults: stored once at their homes, the fonts in a Fonts folder in Macintosh HD', async () => {
  const { files } = await library({ builtins: { 'read-me': 'a', about: 'b' } })
  await restoreDefaults(files, TEXTS, ['Geneva', 'Chicago'], { now: () => 1 })
  const st = files.get()
  assert.deepEqual(
    childrenOf(st, null).texts.map((t) => t.name),
    ['Read Me']
  )
  assert.deepEqual(
    childrenOf(st, HD).texts.map((t) => t.name),
    ['About']
  )
  const home = fontsHome(st)
  assert.deepEqual(
    childrenOf(st, home).fonts.map((t) => t.name),
    ['Geneva', 'Chicago']
  )
  // Again: nothing is missing, nothing is added.
  await restoreDefaults(files, TEXTS, ['Geneva', 'Chicago'])
  assert.equal(files.get().fonts.length, 2)
})

test('defaults: a trashed or renamed one is present; a missing font goes to a new Fonts folder', async () => {
  const { files } = await library({ builtins: { 'read-me': 'a', about: 'b' } })
  await restoreDefaults(files, TEXTS, ['Geneva', 'Chicago'])
  const st = files.get()
  const readMe = st.texts.find((t) => t.builtin === 'read-me')
  await files.renameItem('text', readMe.id, 'Renamed')
  await files.moveFolder(fontsHome(st), TRASH)
  // Trashed, the suitcases are still present.
  assert.deepEqual(missingDefaults(files.get(), TEXTS, ['Geneva', 'Chicago']).fonts, [])
  await files.emptyTrash()
  const missing = missingDefaults(files.get(), TEXTS, ['Geneva', 'Chicago'])
  assert.deepEqual(missing, { texts: [], fonts: ['Geneva', 'Chicago'] })
  assert.equal(fontsHome(files.get()), null)
  await restoreDefaults(files, TEXTS, ['Geneva', 'Chicago'])
  const home = fontsHome(files.get())
  assert.equal(files.get().folders.find((f) => f.id === home).name, FONTS_FOLDER)
  assert.equal(childrenOf(files.get(), home).fonts.length, 2)
})

const R = { width: 1000, height: 800 }
const F = { reserve: 20, bands: { left: 100, top: 100, right: 100, bottom: 100 } }
const pin = pinOf({ left: 40, top: 40, width: 300, height: 200 }, R, F)

test('desktop state: a foreign or garbled blob reads as none, bad entries drop, greet defaults on', () => {
  assert.equal(readDesktopState(null), null)
  assert.equal(readDesktopState({ v: 99 }), null)
  const st = readDesktopState({
    v: 1,
    icons: { 'text:a': { left: 1, top: 2 }, 'text:b': { left: 'x' } },
    windows: { 'folder:hd': { pin, z: 1 }, 'text:a': { pin: { x: [] } } },
    pattern: '  ',
  })
  assert.deepEqual(Object.keys(st.icons), ['text:a'])
  assert.deepEqual(Object.keys(st.windows), ['folder:hd'])
  assert.equal(st.pattern, null)
  assert.equal(st.greet, true)
  assert.equal(st.seeded, false)
})

test('desktop state: the open windows come back deepest first, boxes alone never', () => {
  const st = readDesktopState({
    v: 1,
    windows: {
      'text:top': { pin, z: 2 },
      'folder:closed': { pin },
      'font:bottom': { pin, z: 0 },
    },
  })
  assert.deepEqual(
    openWindowsOf(st).map((w) => w.key),
    ['font:bottom', 'text:top']
  )
})
