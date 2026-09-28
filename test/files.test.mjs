import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  createFiles,
  childrenOf,
  copyName,
  descendantsOf,
  enclosingFolders,
  isTrashed,
  itemCount,
  HD,
  TRASH,
} from '../src/state/files.ts'
import { library } from './helpers.mjs'

const names = (rows) => rows.map((r) => r.name)

test('no storage: unavailable, with Macintosh HD and the Trash alone', async () => {
  const files = createFiles({ storage: null })
  await files.refresh()
  const st = files.get()
  assert.equal(st.available, false)
  assert.deepEqual(names(childrenOf(st, null).folders), ['Macintosh HD', 'Trash'])
})

test('folders: made where asked with untitled names counted up, never in the Trash', async () => {
  const { files } = await library()
  const a = await files.createFolder()
  const b = await files.createFolder()
  const inHd = await files.createFolder({ parent: HD })
  assert.equal(a.name, 'untitled folder')
  assert.equal(b.name, 'untitled folder 2')
  assert.equal(inHd.name, 'untitled folder')
  assert.equal(await files.createFolder({ parent: TRASH }), null)
  const st = files.get()
  assert.deepEqual(names(childrenOf(st, HD).folders), ['untitled folder'])
  assert.equal(itemCount(st, null), 4) // HD, the Trash and two folders
})

test('folders: Macintosh HD and the Trash are never renamed, moved or copied', async () => {
  const { files } = await library()
  const box = await files.createFolder({ name: 'Box' })
  await files.renameFolder(HD, 'Disk')
  await files.renameFolder(TRASH, 'Bin')
  assert.equal(await files.moveFolder(HD, box.id), false)
  assert.equal(await files.moveFolder(TRASH, box.id), false)
  assert.equal(await files.copyFolder(HD), null)
  assert.deepEqual(names(childrenOf(files.get(), null).folders), ['Macintosh HD', 'Trash', 'Box'])
})

test('folders: a folder never moves into itself or a descendant', async () => {
  const { files } = await library()
  const outer = await files.createFolder({ name: 'Outer' })
  const inner = await files.createFolder({ name: 'Inner', parent: outer.id })
  assert.equal(await files.moveFolder(outer.id, outer.id), false)
  assert.equal(await files.moveFolder(outer.id, inner.id), false)
  assert.equal(await files.moveFolder(inner.id, HD), true)
  assert.deepEqual(enclosingFolders(files.get(), inner.id), [inner.id, HD])
})

test('trash: a moved folder is trashed with its subtree, and Empty Trash removes only that', async () => {
  const { files, storage } = await library()
  const box = await files.createFolder({ name: 'Box' })
  const note = await files.createText({ name: 'Note', text: 'hi', folder: box.id })
  const keep = await files.createText({ name: 'Keep', text: 'stay' })
  const font = await files.createFont({ name: 'Geneva', family: 'Geneva', folder: box.id })
  await files.moveFolder(box.id, TRASH)
  assert.ok(isTrashed(files.get(), box.id))
  assert.equal(await files.createText({ name: 'No', folder: box.id }), null)
  const removed = await files.emptyTrash()
  assert.deepEqual(removed, { folders: [box.id], texts: [note.id], fonts: [font.id] })
  assert.equal(storage.texts.has(keep.id), true)
  assert.equal(itemCount(files.get(), TRASH), 0)
})

test('texts: a built-in reads the app text and its size; an unknown key is left out', async () => {
  const { files, storage } = await library()
  const readMe = await files.createText({ name: 'Read Me', builtin: 'read-me' })
  await files.createText({ name: 'Gone', builtin: 'no-such-key' })
  const st = files.get()
  assert.deepEqual(names(st.texts), ['Read Me'])
  assert.equal(st.texts[0].size, 'Hello.'.length)
  assert.equal(await files.textOf(readMe.id), 'Hello.')
  assert.equal(storage.texts.size, 2)
})

test('fonts: a shipped family lists with its size; an unknown family is left out', async () => {
  const { files } = await library()
  await files.createFont({ name: 'Geneva', family: 'Geneva' })
  await files.createFont({ name: 'Zapf', family: 'Zapf' })
  assert.deepEqual(names(files.get().fonts), ['Geneva'])
  assert.equal(files.get().fonts[0].size, 100)
})

test('items: rename, move and copy a text or a font; copies take the next copy name', async () => {
  const { files } = await library()
  const note = await files.createText({ name: 'Note', text: 'x' })
  const font = await files.createFont({ name: 'Geneva', family: 'Geneva' })
  await files.renameItem('text', note.id, 'Memo')
  assert.equal(files.textRec(note.id).name, 'Memo')
  assert.equal(await files.moveItem('font', font.id, HD), true)
  assert.equal(await files.moveItem('font', font.id, HD), false)
  const c1 = await files.copyItem('font', font.id, { folder: HD })
  const c2 = await files.copyItem('font', font.id, { folder: HD })
  assert.deepEqual([c1.name, c2.name], ['Geneva copy', 'Geneva copy 2'])
  assert.equal(files.fontRec(c1.id).family, 'Geneva')
  assert.equal(await files.copyItem('text', note.id, { folder: TRASH }), null)
})

test('copy name: its own name when free, then copy and counted copies of the base', () => {
  const st = {
    available: true,
    folders: [],
    texts: [
      { id: 'a', name: 'Note', folder: null },
      { id: 'b', name: 'Note copy', folder: null },
    ],
    fonts: [],
  }
  assert.equal(copyName(st, null, 'Other', 'text'), 'Other')
  assert.equal(copyName(st, null, 'Note', 'text'), 'Note copy 2')
  assert.equal(copyName(st, null, 'Note copy', 'text'), 'Note copy 2')
  assert.equal(copyName(st, null, 'Note', 'folder'), 'Note')
})

test('copy folder: the subtree comes along once, even into itself', async () => {
  const { files } = await library()
  const box = await files.createFolder({ name: 'Box' })
  const sub = await files.createFolder({ name: 'Sub', parent: box.id })
  await files.createText({ name: 'Note', text: 'x', folder: sub.id })
  await files.createFont({ name: 'Geneva', family: 'Geneva', folder: box.id })
  const copy = await files.copyFolder(box.id, { parent: box.id })
  const st = files.get()
  assert.equal(copy.name, 'Box')
  const inside = descendantsOf(st, copy.id)
  assert.deepEqual(names(inside.folders), ['Sub'])
  assert.deepEqual(names(inside.texts), ['Note'])
  assert.deepEqual(names(inside.fonts), ['Geneva'])
  // The original's subtree now holds the copy and its own items, once.
  assert.equal(descendantsOf(st, box.id).folders.length, 3)
})

const archive = () => ({
  folders: [{ id: 'f1', name: 'Box', parent: HD, createdAt: 1, modifiedAt: 2 }],
  texts: [
    { id: 't1', name: 'Read Me', folder: null, createdAt: 3, modifiedAt: 3, builtin: 'read-me', text: '' },
    { id: 't2', name: 'Old', folder: 'f1', createdAt: 4, modifiedAt: 4, builtin: 'retired', text: 'kept' },
  ],
  fonts: [
    { id: 'n1', name: 'Geneva', folder: 'f1', createdAt: 5, modifiedAt: 5, family: 'Geneva' },
    { id: 'n2', name: 'Zapf', folder: TRASH, createdAt: 6, modifiedAt: 6, family: 'Zapf' },
  ],
})

test('import: merge mints ids and keeps containers; an unshipped text keeps its words, an unshipped font is skipped', async () => {
  const { files, storage } = await library()
  const mine = await files.createText({ name: 'Mine', text: 'x' })
  const res = await files.importArchive(archive())
  assert.deepEqual(res, { folders: 1, texts: 2, fonts: 1, skipped: 1 })
  const st = files.get()
  const box = st.folders.find((f) => f.name === 'Box')
  assert.notEqual(box.id, 'f1')
  assert.equal(box.parent, HD)
  assert.ok(files.textRec(mine.id))
  const old = st.texts.find((t) => t.name === 'Old')
  assert.equal(old.folder, box.id)
  assert.equal(await files.textOf(old.id), 'kept')
  assert.equal(st.fonts.find((t) => t.name === 'Geneva').folder, box.id)
  // Added again, it lands twice.
  await files.importArchive(archive())
  assert.equal(files.get().folders.filter((f) => f.name === 'Box').length, 2)
  assert.equal(storage.fonts.size, 2)
})

test('import: replace clears the library and keeps the archive ids; an empty archive changes nothing', async () => {
  const { files } = await library()
  const mine = await files.createText({ name: 'Mine', text: 'x' })
  const none = await files.importArchive({ folders: [], texts: [], fonts: archive().fonts.slice(1) }, { mode: 'replace' })
  assert.deepEqual(none, { folders: 0, texts: 0, fonts: 0, skipped: 1 })
  assert.ok(files.textRec(mine.id))
  await files.importArchive(archive(), { mode: 'replace' })
  assert.equal(files.textRec(mine.id), null)
  assert.ok(files.get().folders.some((f) => f.id === 'f1'))
  assert.equal(files.textRec('t1').builtin, 'read-me')
})
