import { test } from 'node:test'
import assert from 'node:assert/strict'

import { planBackup, readManifest, itemsOf, backupFilename, slugOf, BACKUP_FORMAT } from '../src/state/backup.ts'
import { listing } from './helpers.mjs'

let t = 1000
const item = (id, name, kind, parent, extra = {}) => ({
  id,
  name,
  kind,
  parent,
  createdAt: t++,
  modifiedAt: t,
  ...extra,
})

/** A desktop: a suitcase in the System Folder's Fonts and another in a
 *  folder in Macintosh HD, a system document and a stored read-me of one name
 *  on the desktop, a system document by its key from before paths in
 *  Macintosh HD, a read-me in the Trash, and one in the System Folder's Apple
 *  Menu Items. */
const desktop = () =>
  listing(
    item('geneva', 'Geneva', 'font', 'fonts', { data: { family: 'Geneva' } }),
    item('projects', 'Projects', 'folder', 'disk', { left: 16, top: 36 }),
    item('chicago', 'Chicago', 'font', 'projects', { data: { family: 'Chicago' } }),
    item('about', 'About the Fonts', 'text', 'disk', { data: { builtin: 'about-the-fonts' } }),
    item('readme', 'Read Me', 'text', null, { data: { path: '/texts/read-me.txt' }, left: 400, top: 36 }),
    item('twin', 'Read Me', 'text', null, { data: { text: 'a twin' } }),
    item('scrap', 'Scrap', 'text', 'trash', { data: { text: 'x' } }),
    item('notes', 'Notes', 'text', 'apple-menu-items', { data: { text: 'n' } })
  )

/** A plan read back: each text with its words, a system document with none,
 *  since it has no entry. */
const contentsOf = (state) => {
  const { manifest } = planBackup(state)
  return { ...manifest, texts: manifest.texts.map((r) => ({ ...r, text: r.builtin == null ? `words of ${r.name}` : null })) }
}

test('plan: paths mirror the tree, the kept containers as directories with no manifest row, and a system document a row alone', () => {
  const { manifest, entries } = planBackup(desktop(), { app: '1.0.0', date: new Date(2026, 8, 27) })
  assert.equal(manifest.format, BACKUP_FORMAT)
  assert.deepEqual(
    entries.map((e) => e.path),
    [
      'macintosh-hd/',
      'macintosh-hd/system-folder/',
      'macintosh-hd/system-folder/apple-menu-items/',
      'macintosh-hd/system-folder/apple-menu-items/notes.txt',
      'macintosh-hd/system-folder/startup-items/',
      'macintosh-hd/system-folder/fonts/',
      'macintosh-hd/projects/',
      'trash/',
      'trash/scrap.txt',
      'read-me-2.txt',
    ]
  )
  // Macintosh HD is "hd" in a manifest, as in backups from before the catalog.
  assert.deepEqual(
    manifest.folders.map((f) => [f.name, f.parent, f.left, f.top]),
    [['Projects', 'hd', 16, 36]]
  )
  assert.deepEqual(
    manifest.fonts.map((f) => [f.family, f.folder]),
    [
      ['Geneva', 'fonts'],
      ['Chicago', 'projects'],
    ]
  )
  // A system document's row keeps its key, by its path or from before paths.
  assert.deepEqual(
    manifest.texts.map((r) => [r.path, r.folder, r.builtin]),
    [
      ['macintosh-hd/system-folder/apple-menu-items/notes.txt', 'apple-menu-items', null],
      ['macintosh-hd/about-the-fonts.txt', 'hd', 'about-the-fonts'],
      ['trash/scrap.txt', 'trash', null],
      ['read-me.txt', null, 'read-me'],
      ['read-me-2.txt', null, null],
    ]
  )
})

test('manifest: a plan reads back as written, and anything else says what is wrong', () => {
  const { manifest } = planBackup(desktop())
  assert.deepEqual(readManifest(JSON.stringify(manifest)), manifest)
  assert.throws(() => readManifest('{'), /not readable/)
  assert.throws(() => readManifest('{"format":"other"}'), /not a SystemOnline backup/)
  assert.throws(() => readManifest(JSON.stringify({ ...manifest, v: 99 })), /newer version/)
  assert.throws(() => readManifest(JSON.stringify({ ...manifest, fonts: null })), /incomplete/)
  assert.throws(
    () => readManifest(JSON.stringify({ ...manifest, fonts: [{ id: 'a', name: 'b' }] })),
    /no family/
  )
})

test('items: back into the kept folders; a system document by its path while served; unserved fonts counted; places for Replace', () => {
  const contents = contentsOf(desktop())
  const opts = { shipsText: (key) => key === 'read-me' || key === 'about-the-fonts', shipsFamily: () => true }
  const replace = itemsOf(contents, { ...opts, places: true })
  assert.equal(replace.skipped, 0)
  const byId = new Map(replace.items.map((i) => [i.id, i]))
  assert.equal(byId.get('projects').parent, 'disk')
  assert.equal(byId.get('notes').parent, 'apple-menu-items')
  assert.deepEqual([byId.get('projects').left, byId.get('projects').top], [16, 36])
  assert.deepEqual(byId.get('readme').data, { path: '/texts/read-me.txt' })
  assert.deepEqual([byId.get('about').parent, byId.get('about').data], ['disk', { path: '/texts/about-the-fonts.txt' }])
  assert.deepEqual(byId.get('twin').data, { text: 'words of Read Me' })
  assert.deepEqual([byId.get('geneva').parent, byId.get('geneva').data], ['fonts', { family: 'Geneva' }])
  assert.equal(byId.get('chicago').parent, 'projects')
  // A system document the site no longer serves has no words here: skipped and counted.
  const gone = itemsOf(contents, { ...opts, shipsText: () => false, places: false })
  assert.equal(gone.skipped, 2)
  assert.ok(!gone.items.some((i) => i.id === 'readme' || i.id === 'about'))
  // Add takes free cells: no places.
  assert.ok(gone.items.every((i) => i.left == null && i.top == null))
  const noFonts = itemsOf(contents, { ...opts, shipsFamily: () => false, places: false })
  assert.equal(noFonts.skipped, 2)
  assert.ok(!noFonts.items.some((i) => i.kind === 'font'))
})

test('items: an older backup’s system document, its words in an entry, comes back by its path while served, else with its words', () => {
  const contents = contentsOf(desktop())
  const older = { ...contents, texts: contents.texts.map((r) => ({ ...r, text: `words of ${r.name}` })) }
  const opts = { shipsFamily: () => true, places: false }
  const readMe = (shipsText) => itemsOf(older, { ...opts, shipsText }).items.find((i) => i.id === 'readme').data
  assert.deepEqual(readMe((key) => key === 'read-me'), { path: '/texts/read-me.txt' })
  assert.deepEqual(readMe(() => false), { text: 'words of Read Me' })
  assert.equal(itemsOf(older, { ...opts, shipsText: () => false }).skipped, 0)
})

test('items: a backup from before Fonts files the suitcases of Macintosh HD → Fonts in Fonts, and leaves that folder out once empty', () => {
  const opts = { shipsText: () => true, shipsFamily: () => true, places: true }
  const where = ({ items }) => items.map((i) => [i.id, i.parent, i.left ?? null])
  const before = listing(
    item('old', 'Fonts', 'folder', 'disk', { left: 16, top: 36 }),
    item('geneva', 'Geneva', 'font', 'old', { data: { family: 'Geneva' }, left: 16, top: 16 }),
    item('chicago', 'Chicago', 'font', 'old', { data: { family: 'Chicago' } }),
    item('monaco', 'Monaco', 'font', null, { data: { family: 'Monaco' } })
  )
  assert.deepEqual(where(itemsOf(contentsOf(before), opts)), [
    ['geneva', 'fonts', 16],
    ['chicago', 'fonts', null],
    ['monaco', null, null],
  ])
  // Anything else in it keeps the folder.
  const shared = listing(
    item('old', 'Fonts', 'folder', 'disk', { left: 16, top: 36 }),
    item('geneva', 'Geneva', 'font', 'old', { data: { family: 'Geneva' } }),
    item('notes', 'Notes', 'text', 'old', { data: { text: 'n' } })
  )
  assert.deepEqual(where(itemsOf(contentsOf(shared), opts)), [
    ['old', 'disk', 16],
    ['notes', 'old', null],
    ['geneva', 'fonts', null],
  ])
})

test('names: slugs and the dated file name', () => {
  assert.equal(slugOf('About the Fonts'), 'about-the-fonts')
  assert.equal(slugOf('***'), 'untitled')
  assert.equal(backupFilename(new Date(2026, 0, 5)), 'system-online-backup-2026-01-05.zip')
})
