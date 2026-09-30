import { test } from 'node:test'
import assert from 'node:assert/strict'

import { planBackup, readManifest, backupFilename, slugOf, BACKUP_FORMAT } from '../src/state/backup.ts'
import { HD, TRASH } from '../src/state/files.ts'
import { library } from './helpers.mjs'

test('plan: paths mirror the tree, Macintosh HD and the Trash as directories with no manifest row', async () => {
  const { files } = await library()
  const fonts = await files.createFolder({ name: 'Fonts', parent: HD })
  await files.createFont({ name: 'Geneva', family: 'Geneva', folder: fonts.id })
  await files.createText({ name: 'Read Me', builtin: 'read-me' })
  await files.createText({ name: 'Read Me', text: 'a twin' })
  const scrap = await files.createText({ name: 'Scrap', text: 'x' })
  await files.moveItem('text', scrap.id, TRASH)
  const { manifest, entries } = planBackup(files.get(), { app: '1.0.0', date: new Date(2026, 8, 27) })
  assert.equal(manifest.format, BACKUP_FORMAT)
  assert.deepEqual(
    entries.map((e) => e.path),
    ['macintosh-hd/', 'macintosh-hd/fonts/', 'trash/', 'trash/scrap.txt', 'read-me.txt', 'read-me-2.txt']
  )
  assert.deepEqual(
    manifest.folders.map((f) => [f.name, f.parent]),
    [['Fonts', HD]]
  )
  assert.deepEqual(
    manifest.fonts.map((t) => [t.family, t.folder]),
    [['Geneva', fonts.id]]
  )
  assert.equal(manifest.texts.find((t) => t.path === 'trash/scrap.txt').folder, TRASH)
})

test('manifest: a plan reads back as written, and anything else says what is wrong', async () => {
  const { files } = await library()
  await files.createText({ name: 'Note', text: 'x' })
  const { manifest } = planBackup(files.get())
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

test('names: slugs and the dated file name', () => {
  assert.equal(slugOf('About the Fonts'), 'about-the-fonts')
  assert.equal(slugOf('***'), 'untitled')
  assert.equal(backupFilename(new Date(2026, 0, 5)), 'system-online-backup-2026-01-05.zip')
})
