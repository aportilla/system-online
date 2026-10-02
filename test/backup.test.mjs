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

/** A desktop: a Fonts folder in Macintosh HD with a suitcase, a built-in and
 *  a stored read-me of one name on the desktop, and a read-me in the Trash. */
const desktop = () =>
  listing(
    item('fonts', 'Fonts', 'folder', 'disk', { left: 16, top: 36 }),
    item('geneva', 'Geneva', 'font', 'fonts', { data: { family: 'Geneva' } }),
    item('readme', 'Read Me', 'text', null, { data: { builtin: 'read-me' }, left: 400, top: 36 }),
    item('twin', 'Read Me', 'text', null, { data: { text: 'a twin' } }),
    item('scrap', 'Scrap', 'text', 'trash', { data: { text: 'x' } })
  )

test('plan: paths mirror the tree, Macintosh HD and the Trash as directories with no manifest row', () => {
  const { manifest, entries } = planBackup(desktop(), { app: '1.0.0', date: new Date(2026, 8, 27) })
  assert.equal(manifest.format, BACKUP_FORMAT)
  assert.deepEqual(
    entries.map((e) => e.path),
    ['macintosh-hd/', 'macintosh-hd/fonts/', 'trash/', 'trash/scrap.txt', 'read-me.txt', 'read-me-2.txt']
  )
  // Macintosh HD is "hd" in a manifest, as in backups from before the catalog.
  assert.deepEqual(
    manifest.folders.map((f) => [f.name, f.parent, f.left, f.top]),
    [['Fonts', 'hd', 16, 36]]
  )
  assert.deepEqual(
    manifest.fonts.map((f) => [f.family, f.folder]),
    [['Geneva', 'fonts']]
  )
  assert.deepEqual(
    manifest.texts.map((r) => [r.path, r.folder, r.builtin]),
    [
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

test('items: back into Macintosh HD; a built-in kept while shipped; unshipped fonts counted; places for Replace', () => {
  const { manifest } = planBackup(desktop())
  const contents = { ...manifest, texts: manifest.texts.map((r) => ({ ...r, text: `words of ${r.name}` })) }
  const opts = { shipsText: (key) => key === 'read-me', shipsFamily: () => true }
  const replace = itemsOf(contents, { ...opts, places: true })
  assert.equal(replace.skipped, 0)
  const byId = new Map(replace.items.map((i) => [i.id, i]))
  assert.equal(byId.get('fonts').parent, 'disk')
  assert.deepEqual([byId.get('fonts').left, byId.get('fonts').top], [16, 36])
  assert.deepEqual(byId.get('readme').data, { builtin: 'read-me' })
  assert.deepEqual(byId.get('twin').data, { text: 'words of Read Me' })
  assert.deepEqual(byId.get('geneva').data, { family: 'Geneva' })
  // A built-in no longer shipped keeps its words.
  const gone = itemsOf(contents, { ...opts, shipsText: () => false, places: false })
  assert.deepEqual(gone.items.find((i) => i.id === 'readme').data, { text: 'words of Read Me' })
  // Add takes free cells: no places.
  assert.ok(gone.items.every((i) => i.left == null && i.top == null))
  const noFonts = itemsOf(contents, { ...opts, shipsFamily: () => false, places: false })
  assert.equal(noFonts.skipped, 1)
  assert.ok(!noFonts.items.some((i) => i.kind === 'font'))
})

test('names: slugs and the dated file name', () => {
  assert.equal(slugOf('About the Fonts'), 'about-the-fonts')
  assert.equal(slugOf('***'), 'untitled')
  assert.equal(backupFilename(new Date(2026, 0, 5)), 'system-online-backup-2026-01-05.zip')
})
