import { test } from 'node:test'
import assert from 'node:assert/strict'

import { missingDefaults, formerFonts, restoreDefaults, CONTROL_PANELS_FOLDER } from '../src/state/defaults.ts'
import { KEPT, catalog, listing } from './helpers.mjs'

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

test('defaults: stored once at their homes, the suitcases in Fonts, Control Panels in the System Folder and its alias in the Apple menu', async () => {
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
  assert.deepEqual(
    st.items.filter((i) => i.kind === 'font').map((i) => [i.name, i.parent, i.data]),
    [
      ['Geneva', 'fonts', { family: 'Geneva' }],
      ['Chicago', 'fonts', { family: 'Chicago' }],
    ]
  )
  assert.deepEqual(aliasesIn(st), [[CONTROL_PANELS_FOLDER, 'apple-menu-items', { original: panels.id, kind: 'folder' }]])
  assert.deepEqual(
    st.items.filter((i) => !KEPT.some((k) => k.id === i.id)).map((i) => i.createdAt),
    [1, 2, 3, 4, 5, 6, 7, 8],
    'a millisecond apart, in order'
  )
  // Again: nothing is missing, nothing is added.
  const before = st.items.length
  await restoreDefaults(c, DEFAULTS)
  assert.equal(c.get().items.length, before)
})

test('defaults: a trashed or renamed one is present; a missing one goes back, Control Panels made again', async () => {
  const c = catalog()
  await restoreDefaults(c, DEFAULTS)
  const st = c.get()
  const readMe = st.items.find((i) => i.data?.builtin === 'read-me')
  readMe.name = 'Renamed'
  st.items.find((i) => i.kind === 'app').parent = 'trash'
  for (const suitcase of st.items.filter((i) => i.kind === 'font')) suitcase.parent = 'trash'
  const panels = panelsIn(st)
  panels.parent = 'trash'
  st.items.find((i) => i.kind === 'alias').name = 'Panels'
  // Trashed, the icons and the suitcases are still present, and the renamed
  // alias still stands for Control Panels.
  assert.deepEqual(missingDefaults(st, DEFAULTS), { texts: [], apps: [], fonts: [], appleMenu: [] })
  // Emptied from the Trash, they are missing, and so is Control Panels; the
  // alias stands for nothing.
  st.items = st.items.filter((i) => i.parent !== 'trash' && i.parent !== panels.id)
  assert.deepEqual(missingDefaults(st, DEFAULTS), {
    texts: [],
    apps: DEFAULTS.apps,
    fonts: FAMILIES,
    appleMenu: [CONTROL_PANELS_FOLDER],
  })
  await restoreDefaults(c, DEFAULTS)
  assert.deepEqual(namesIn(c.get(), 'fonts', 'font'), FAMILIES)
  assert.deepEqual(namesIn(c.get(), null, 'app'), ['Meteors'])
  const again = panelsIn(c.get())
  assert.deepEqual(namesIn(c.get(), again.id, 'app'), ['Patterns'])
  assert.deepEqual(aliasesIn(c.get()), [
    ['Panels', 'apple-menu-items', { original: panels.id, kind: 'folder' }],
    [CONTROL_PANELS_FOLDER, 'apple-menu-items', { original: again.id, kind: 'folder' }],
  ])
})

const item = (id, name, kind, parent) => ({ id, name, kind, parent, createdAt: 0, modifiedAt: 0 })
const suitcase = (family, parent) => ({ ...item(family, family, 'font', parent), data: { family } })
const ids = ({ suitcases, folder }) => ({ suitcases: suitcases.map((i) => i.id), folder })

test('former fonts: the suitcases directly in Macintosh HD → Fonts file into Fonts, and that folder goes once they empty it', () => {
  const before = listing(
    item('old', 'Fonts', 'folder', 'disk'),
    suitcase('Geneva', 'old'),
    suitcase('Chicago', 'old'),
    suitcase('Monaco', null),
    suitcase('Times', 'trash'),
    suitcase('Symbol', 'apple-menu-items')
  )
  assert.deepEqual(ids(formerFonts(before.items)), { suitcases: ['Geneva', 'Chicago'], folder: 'old' })
  // Anything else in it keeps the folder, and a folder in it keeps its own.
  const shared = listing(
    item('old', 'Fonts', 'folder', 'disk'),
    suitcase('Geneva', 'old'),
    item('notes', 'Notes', 'text', 'old'),
    item('more', 'More', 'folder', 'old'),
    suitcase('Chicago', 'more')
  )
  assert.deepEqual(ids(formerFonts(shared.items)), { suitcases: ['Geneva'], folder: null })
  // Nothing files: an empty one, which stays; one of another name, or not
  // directly in Macintosh HD; and a new desktop's, whose suitcases are in the
  // System Folder's Fonts.
  for (const items of [
    [item('old', 'Fonts', 'folder', 'disk')],
    [item('old', 'My Fonts', 'folder', 'disk'), suitcase('Geneva', 'old')],
    [item('old', 'Fonts', 'folder', null), suitcase('Geneva', 'old')],
    [item('old', 'Fonts', 'folder', 'trash'), suitcase('Geneva', 'old')],
    [suitcase('Geneva', 'fonts')],
  ]) {
    assert.deepEqual(ids(formerFonts(listing(...items).items)), { suitcases: [], folder: null })
  }
})
