import { test } from 'node:test'
import assert from 'node:assert/strict'

import { missingDefaults, formerFonts, moveToInstalled, restoreDefaults, CONTROL_PANELS_FOLDER } from '../src/state/defaults.ts'
import { KEPT, catalog, installer, listing } from './helpers.mjs'

const DEFAULTS = {
  texts: [
    { key: 'read-me', name: 'Read Me', home: 'desktop' },
    { key: 'about', name: 'About', home: 'disk' },
  ],
  apps: [
    { app: 'meteors', home: 'desktop' },
    { app: 'store', home: 'desktop', alias: 'Store…' },
    { app: 'patterns', home: 'control-panels' },
    { app: 'viewer', home: 'disk' },
  ],
  families: ['Geneva', 'Chicago'],
  appleMenu: [CONTROL_PANELS_FOLDER],
}
const FAMILIES = DEFAULTS.families
const NONE = { texts: [], apps: [], fonts: [], appleMenu: [], aliases: [] }

const namesIn = (state, parent, kind) =>
  state.items.filter((i) => i.parent === parent && i.kind === kind).map((i) => i.name)
/** The Control Panels folder in the System Folder. */
const panelsIn = (state) =>
  state.items.find((i) => i.kind === 'folder' && i.parent === 'system-folder' && i.name === CONTROL_PANELS_FOLDER)
const aliasesIn = (state) => state.items.filter((i) => i.kind === 'alias').map((i) => [i.name, i.parent, i.data])
const iconOf = (state, app) => state.items.find((i) => i.kind === 'app' && i.data.app === app)
const item = (id, name, kind, parent, extra = {}) => ({ id, name, kind, parent, createdAt: 0, modifiedAt: 0, ...extra })
const suitcase = (family, parent) => ({ ...item(family, family, 'font', parent), data: { family } })

test('defaults: stored once at their homes, each application installed there, the suitcases in Fonts, and the aliases in the Apple menu', async () => {
  const c = catalog()
  const calls = []
  await restoreDefaults(c, DEFAULTS, { install: installer(c, calls), now: () => 1 })
  const st = c.get()
  assert.deepEqual(
    st.items.filter((i) => i.kind === 'text').map((i) => [i.name, i.parent, i.data]),
    [
      ['Read Me', null, { path: '/texts/read-me.txt' }],
      ['About', 'disk', { path: '/texts/about.txt' }],
    ]
  )
  const panels = panelsIn(st)
  assert.deepEqual(calls, ['install meteors', 'install store', 'install patterns', 'install viewer'])
  assert.deepEqual(
    st.items.filter((i) => i.kind === 'app').map((i) => [i.name, i.parent]),
    [
      ['meteors', null],
      ['store', null],
      ['patterns', panels.id],
      ['viewer', 'disk'],
    ]
  )
  assert.deepEqual(
    st.items.filter((i) => i.kind === 'font').map((i) => [i.name, i.parent, i.data]),
    [
      ['Geneva', 'fonts', { family: 'Geneva' }],
      ['Chicago', 'fonts', { family: 'Chicago' }],
    ]
  )
  assert.deepEqual(aliasesIn(st), [
    [CONTROL_PANELS_FOLDER, 'apple-menu-items', { original: panels.id, kind: 'folder' }],
    ['Store…', 'apple-menu-items', { original: iconOf(st, 'store').id, kind: 'app' }],
  ])
  assert.deepEqual(
    st.items.filter((i) => !KEPT.some((k) => k.id === i.id) && i.kind !== 'app').map((i) => i.createdAt),
    [1, 2, 3, 4, 5, 6, 7],
    'a millisecond apart, in order'
  )
  // Again: nothing is missing, nothing is added.
  assert.deepEqual(missingDefaults(st, DEFAULTS), NONE)
  const before = st.items.length
  await restoreDefaults(c, DEFAULTS, { install: installer(c, calls) })
  assert.equal(c.get().items.length, before)
  assert.equal(calls.length, 4)
})

test('defaults: a trashed or renamed one is present; a missing one goes back, Control Panels made again', async () => {
  const c = catalog()
  await restoreDefaults(c, DEFAULTS, { install: installer(c) })
  const st = c.get()
  st.items.find((i) => i.data?.path === '/texts/read-me.txt').name = 'Renamed'
  iconOf(st, 'meteors').parent = 'trash'
  for (const suitcase of st.items.filter((i) => i.kind === 'font')) suitcase.parent = 'trash'
  const panels = panelsIn(st)
  panels.parent = 'trash'
  for (const alias of st.items.filter((i) => i.kind === 'alias')) alias.name = `${alias.name} alias`
  // Trashed, the icons and the suitcases are still present, and the renamed
  // aliases still stand for Control Panels and the store's icon.
  assert.deepEqual(missingDefaults(st, DEFAULTS), NONE)
  // Emptied from the Trash, they are missing, and so is Control Panels; its
  // alias stands for nothing.
  st.items = st.items.filter((i) => i.parent !== 'trash' && i.parent !== panels.id)
  assert.deepEqual(missingDefaults(st, DEFAULTS), {
    ...NONE,
    apps: [DEFAULTS.apps[0], DEFAULTS.apps[2]],
    fonts: FAMILIES,
    appleMenu: [CONTROL_PANELS_FOLDER],
  })
  const calls = []
  await restoreDefaults(c, DEFAULTS, { install: installer(c, calls) })
  assert.deepEqual(calls, ['install meteors', 'install patterns'])
  assert.deepEqual(namesIn(c.get(), 'fonts', 'font'), FAMILIES)
  assert.deepEqual(namesIn(c.get(), null, 'app'), ['store', 'meteors'])
  const again = panelsIn(c.get())
  assert.deepEqual(namesIn(c.get(), again.id, 'app'), ['patterns'])
  assert.deepEqual(aliasesIn(c.get()), [
    [`${CONTROL_PANELS_FOLDER} alias`, 'apple-menu-items', { original: panels.id, kind: 'folder' }],
    ['Store… alias', 'apple-menu-items', { original: iconOf(c.get(), 'store').id, kind: 'app' }],
    [CONTROL_PANELS_FOLDER, 'apple-menu-items', { original: again.id, kind: 'folder' }],
  ])
})

test('defaults: an application’s alias is missing while none stands for an icon of it, and goes back once one is outside the Trash', async () => {
  const just = { texts: [], apps: [DEFAULTS.apps[1]], families: [], appleMenu: [] }
  const c = catalog(item('store', 'Store', 'app', null, { data: { app: 'store' } }))
  assert.deepEqual(missingDefaults(c.get(), just).aliases, [DEFAULTS.apps[1]])
  // Its one icon trashed: nothing to stand for, and the application is present.
  c.state.items.find((i) => i.id === 'store').parent = 'trash'
  assert.deepEqual(missingDefaults(c.get(), just), NONE)
  await restoreDefaults(c, just, { install: installer(c) })
  assert.deepEqual(aliasesIn(c.get()), [])
  // Back out of the Trash, its alias goes back, standing for it.
  c.state.items.find((i) => i.id === 'store').parent = null
  await restoreDefaults(c, just, { install: installer(c) })
  assert.deepEqual(aliasesIn(c.get()), [['Store…', 'apple-menu-items', { original: 'store', kind: 'app' }]])
  // Uninstalled, its alias stands for nothing: installed again, a new one stands for the new icon.
  c.state.items = c.state.items.filter((i) => i.id !== 'store')
  assert.deepEqual(missingDefaults(c.get(), just), { ...NONE, apps: just.apps, aliases: just.apps })
  const calls = []
  await restoreDefaults(c, just, { install: installer(c, calls) })
  assert.deepEqual(calls, ['install store'])
  assert.deepEqual(aliasesIn(c.get())[1], ['Store…', 'apple-menu-items', { original: iconOf(c.get(), 'store').id, kind: 'app' }])
})

test('defaults: an application that doesn’t install leaves the rest to go back, then rejects', async () => {
  const c = catalog()
  const calls = []
  await assert.rejects(restoreDefaults(c, DEFAULTS, { install: installer(c, calls, { refuse: ['meteors'] }) }), /meteors was refused/)
  assert.deepEqual(calls, ['install meteors', 'install store', 'install patterns', 'install viewer'])
  assert.deepEqual(namesIn(c.get(), null, 'app'), ['store'])
  assert.deepEqual(namesIn(c.get(), 'fonts', 'font'), FAMILIES)
  assert.deepEqual(aliasesIn(c.get()).map(([name]) => name), [CONTROL_PANELS_FOLDER, 'Store…'])
})

/** A desktop from before nothing was built in: its documents by key, Meteors'
 *  icon on the desktop and Desktop Patterns' in Control Panels, neither with
 *  a file, its suitcases, and a visitor's own text. */
const before = () =>
  catalog(
    ...FAMILIES.map((f) => suitcase(f, 'fonts')),
    item('readme', 'Read Me', 'text', null, { data: { builtin: 'read-me' } }),
    item('about', 'About', 'text', 'disk', { data: { builtin: 'about', text: 'stale words' } }),
    item('gone', 'Gone', 'text', null, { data: { builtin: 'gone' } }),
    item('mine', 'Mine', 'text', null, { data: { text: 'my words' } }),
    item('panels', CONTROL_PANELS_FOLDER, 'folder', 'system-folder'),
    item('meteors', 'Meteors', 'app', null, { data: { app: 'meteors' }, left: 400, top: 36 }),
    item('patterns', 'Patterns', 'app', 'panels', { data: { app: 'patterns' } }),
    item('panels-alias', CONTROL_PANELS_FOLDER, 'alias', 'apple-menu-items', { data: { original: 'panels', kind: 'folder' } })
  )
const HAD = ['meteors', 'patterns']

test('the move: keys become paths first, icons with no file get their files, and the applications it never had install at their homes', async () => {
  const c = before()
  const calls = []
  const install = installer(c, calls)
  let pathsFirst = null
  await moveToInstalled(c, DEFAULTS, {
    had: HAD,
    kept: () => false,
    install: async (app, options) => {
      pathsFirst ??= c.get().items.find((i) => i.id === 'readme').data
      await install(app, options)
    },
  })
  const st = c.get()
  const dataOf = (id) => st.items.find((i) => i.id === id).data
  assert.deepEqual(pathsFirst, { path: '/texts/read-me.txt' })
  assert.deepEqual(dataOf('about'), { path: '/texts/about.txt' })
  // A key the site no longer serves stays a key, and a visitor's words stay.
  assert.deepEqual(dataOf('gone'), { builtin: 'gone' })
  assert.deepEqual(dataOf('mine'), { text: 'my words' })
  assert.deepEqual(calls, ['replace meteors', 'replace patterns', 'install store', 'install viewer'])
  // The icons keep their places; the new ones are at their homes, the store's alias with it.
  assert.deepEqual([iconOf(st, 'meteors').id, iconOf(st, 'meteors').left], ['meteors', 400])
  assert.deepEqual([iconOf(st, 'store').parent, iconOf(st, 'viewer').parent], [null, 'disk'])
  assert.deepEqual(aliasesIn(st)[1], ['Store…', 'apple-menu-items', { original: iconOf(st, 'store').id, kind: 'app' }])
  // Done: nothing is missing.
  assert.deepEqual(missingDefaults(st, DEFAULTS), NONE)
})

test('the move: one the visitor removed stays removed, one with a file stays as it is, and a step that fails leaves the rest done', async () => {
  const c = before()
  // Meteors trashed and the Trash emptied; the store dropped in by hand.
  c.state.items = [
    ...c.state.items.filter((i) => i.id !== 'meteors'),
    item('own-store', 'Store', 'app', null, { data: { app: 'store' } }),
  ]
  const calls = []
  await assert.rejects(
    moveToInstalled(c, DEFAULTS, {
      had: HAD,
      kept: (app) => app === 'store',
      install: installer(c, calls, { refuse: ['patterns'] }),
    }),
    /patterns was refused/
  )
  assert.deepEqual(calls, ['replace patterns', 'install viewer'])
  const st = c.get()
  assert.equal(iconOf(st, 'meteors'), undefined)
  assert.deepEqual(aliasesIn(st)[1], ['Store…', 'apple-menu-items', { original: 'own-store', kind: 'app' }])
  assert.deepEqual(st.items.find((i) => i.id === 'readme').data, { path: '/texts/read-me.txt' })
})

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
