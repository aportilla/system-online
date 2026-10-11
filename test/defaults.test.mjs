import { test } from 'node:test'
import assert from 'node:assert/strict'

import { missingDefaults, fontsHome, restoreDefaults, CONTROL_PANELS_FOLDER, FONTS_FOLDER } from '../src/state/defaults.ts'
import { KEPT, catalog } from './helpers.mjs'

const DEFAULTS = {
  texts: [
    { key: 'read-me', name: 'Read Me', home: 'desktop' },
    { key: 'about', name: 'About', home: 'disk' },
  ],
  apps: [
    { app: 'meteors', name: 'Meteors', home: 'desktop' },
    { app: 'patterns', name: 'Patterns', home: 'control-panels' },
  ],
  families: ['Geneva', 'Chicago'],
  appleMenu: [CONTROL_PANELS_FOLDER],
}
const FAMILIES = DEFAULTS.families

const namesIn = (state, parent, kind) =>
  state.items.filter((i) => i.parent === parent && i.kind === kind).map((i) => i.name)
/** The Control Panels folder in the System Folder. */
const panelsIn = (state) =>
  state.items.find((i) => i.kind === 'folder' && i.parent === 'system-folder' && i.name === CONTROL_PANELS_FOLDER)
const aliasesIn = (state) => state.items.filter((i) => i.kind === 'alias').map((i) => [i.name, i.parent, i.data])

test('defaults: stored once at their homes, Control Panels in the System Folder and its alias in the Apple menu', async () => {
  const c = catalog()
  await restoreDefaults(c, DEFAULTS, { now: () => 1 })
  const st = c.get()
  assert.deepEqual(namesIn(st, null, 'text'), ['Read Me'])
  assert.deepEqual(namesIn(st, 'disk', 'text'), ['About'])
  const panels = panelsIn(st)
  assert.deepEqual(
    st.items.filter((i) => i.kind === 'app').map((i) => [i.name, i.parent, i.data]),
    [
      ['Meteors', null, { app: 'meteors' }],
      ['Patterns', panels.id, { app: 'patterns' }],
    ]
  )
  const home = fontsHome(st)
  assert.deepEqual(namesIn(st, home, 'font'), FAMILIES)
  assert.deepEqual(aliasesIn(st), [[CONTROL_PANELS_FOLDER, 'apple-menu-items', { original: panels.id, kind: 'folder' }]])
  assert.deepEqual(
    st.items.filter((i) => !KEPT.some((k) => k.id === i.id)).map((i) => i.createdAt),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    'a millisecond apart, in order'
  )
  // Again: nothing is missing, nothing is added.
  const before = st.items.length
  await restoreDefaults(c, DEFAULTS)
  assert.equal(c.get().items.length, before)
})

test('defaults: a trashed or renamed one is present; a missing one goes to its folder, made again', async () => {
  const c = catalog()
  await restoreDefaults(c, DEFAULTS)
  const st = c.get()
  const readMe = st.items.find((i) => i.data?.builtin === 'read-me')
  readMe.name = 'Renamed'
  st.items.find((i) => i.kind === 'app').parent = 'trash'
  const fonts = st.items.find((i) => i.id === fontsHome(st))
  fonts.parent = 'trash'
  const panels = panelsIn(st)
  panels.parent = 'trash'
  st.items.find((i) => i.kind === 'alias').name = 'Panels'
  // Trashed, the icons and the suitcases are still present, and the renamed
  // alias still stands for Control Panels.
  assert.deepEqual(missingDefaults(st, DEFAULTS), { texts: [], apps: [], fonts: [], appleMenu: [] })
  // Emptied from the Trash, they are missing, and so are the folders; the
  // alias stands for nothing.
  st.items = st.items.filter((i) => i.parent !== 'trash' && i.parent !== fonts.id && i.parent !== panels.id)
  assert.deepEqual(missingDefaults(st, DEFAULTS), {
    texts: [],
    apps: DEFAULTS.apps,
    fonts: FAMILIES,
    appleMenu: [CONTROL_PANELS_FOLDER],
  })
  assert.equal(fontsHome(st), null)
  await restoreDefaults(c, DEFAULTS)
  const home = fontsHome(c.get())
  assert.equal(c.get().items.find((i) => i.id === home).name, FONTS_FOLDER)
  assert.deepEqual(namesIn(c.get(), home, 'font'), FAMILIES)
  assert.deepEqual(namesIn(c.get(), null, 'app'), ['Meteors'])
  const again = panelsIn(c.get())
  assert.deepEqual(namesIn(c.get(), again.id, 'app'), ['Patterns'])
  assert.deepEqual(aliasesIn(c.get()), [
    ['Panels', 'apple-menu-items', { original: panels.id, kind: 'folder' }],
    [CONTROL_PANELS_FOLDER, 'apple-menu-items', { original: again.id, kind: 'folder' }],
  ])
})
