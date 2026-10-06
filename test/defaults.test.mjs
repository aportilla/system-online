import { test } from 'node:test'
import assert from 'node:assert/strict'

import { missingDefaults, fontsHome, restoreDefaults, FONTS_FOLDER } from '../src/state/defaults.ts'
import { catalog } from './helpers.mjs'

const DEFAULTS = {
  texts: [
    { key: 'read-me', name: 'Read Me', home: 'desktop' },
    { key: 'about', name: 'About', home: 'disk' },
  ],
  apps: [{ app: 'meteors', name: 'Meteors', home: 'desktop' }],
  families: ['Geneva', 'Chicago'],
}
const FAMILIES = DEFAULTS.families

const namesIn = (state, parent, kind) =>
  state.items.filter((i) => i.parent === parent && i.kind === kind).map((i) => i.name)

test('defaults: stored once at their homes, the fonts in a Fonts folder in Macintosh HD', async () => {
  const c = catalog()
  await restoreDefaults(c, DEFAULTS, { now: () => 1 })
  const st = c.get()
  assert.deepEqual(namesIn(st, null, 'text'), ['Read Me'])
  assert.deepEqual(namesIn(st, 'disk', 'text'), ['About'])
  assert.deepEqual(
    st.items.filter((i) => i.kind === 'app').map((i) => [i.name, i.parent, i.data]),
    [['Meteors', null, { app: 'meteors' }]]
  )
  const home = fontsHome(st)
  assert.deepEqual(namesIn(st, home, 'font'), FAMILIES)
  assert.deepEqual(
    st.items.filter((i) => i.kind !== 'disk' && i.kind !== 'trash').map((i) => i.createdAt),
    [1, 2, 3, 4, 5, 6],
    'a millisecond apart, in order'
  )
  // Again: nothing is missing, nothing is added.
  const before = st.items.length
  await restoreDefaults(c, DEFAULTS)
  assert.equal(c.get().items.length, before)
})

test('defaults: a trashed or renamed one is present; a missing font goes to a new Fonts folder', async () => {
  const c = catalog()
  await restoreDefaults(c, DEFAULTS)
  const st = c.get()
  const readMe = st.items.find((i) => i.data?.builtin === 'read-me')
  readMe.name = 'Renamed'
  st.items.find((i) => i.kind === 'app').parent = 'trash'
  const fonts = st.items.find((i) => i.id === fontsHome(st))
  fonts.parent = 'trash'
  // Trashed, the icon and the suitcases are still present.
  assert.deepEqual(missingDefaults(st, DEFAULTS), { texts: [], apps: [], fonts: [] })
  // Emptied from the Trash, they are missing, and so is the Fonts folder.
  st.items = st.items.filter((i) => i.parent !== 'trash' && i.parent !== fonts.id)
  assert.deepEqual(missingDefaults(st, DEFAULTS), { texts: [], apps: DEFAULTS.apps, fonts: FAMILIES })
  assert.equal(fontsHome(st), null)
  await restoreDefaults(c, DEFAULTS)
  const home = fontsHome(c.get())
  assert.equal(c.get().items.find((i) => i.id === home).name, FONTS_FOLDER)
  assert.deepEqual(namesIn(c.get(), home, 'font'), FAMILIES)
  assert.deepEqual(namesIn(c.get(), null, 'app'), ['Meteors'])
})
