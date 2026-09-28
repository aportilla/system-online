import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'

import { crc32, unzip, zipStore } from '../src/lib/zip.ts'

const enc = (s) => new TextEncoder().encode(s)

test('crc32 matches the zlib check value', () => {
  assert.equal(crc32(enc('123456789')), 0xcbf43926)
})

test('a stored zip reads back entry for entry, directories included', async () => {
  const zip = zipStore(
    [
      { name: 'desktop.json', bytes: enc('{}') },
      { name: 'folder/', bytes: new Uint8Array(0) },
      { name: 'folder/note.txt', bytes: enc('hello') },
    ],
    { date: new Date(2026, 8, 27) }
  )
  const out = await unzip(zip)
  assert.deepEqual(
    out.map((e) => [e.name, e.dir, new TextDecoder().decode(e.bytes)]),
    [
      ['desktop.json', false, '{}'],
      ['folder/', true, ''],
      ['folder/note.txt', false, 'hello'],
    ]
  )
})

test('a deflated entry another program wrote inflates', async () => {
  // One entry, method 8, the way another zipper writes it.
  const body = deflateRawSync(Buffer.from('deflated text'))
  const name = enc('a.txt')
  const local = new Uint8Array(30 + name.length + body.length)
  const lv = new DataView(local.buffer)
  lv.setUint32(0, 0x04034b50, true)
  lv.setUint16(8, 8, true)
  lv.setUint32(18, body.length, true)
  lv.setUint32(22, 13, true)
  lv.setUint16(26, name.length, true)
  local.set(name, 30)
  local.set(body, 30 + name.length)
  const central = new Uint8Array(46 + name.length)
  const cv = new DataView(central.buffer)
  cv.setUint32(0, 0x02014b50, true)
  cv.setUint16(10, 8, true)
  cv.setUint32(20, body.length, true)
  cv.setUint32(24, 13, true)
  cv.setUint16(28, name.length, true)
  central.set(name, 46)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, 1, true)
  ev.setUint16(10, 1, true)
  ev.setUint32(12, central.length, true)
  ev.setUint32(16, local.length, true)
  const bytes = new Uint8Array([...local, ...central, ...end])
  const [entry] = await unzip(bytes)
  assert.equal(new TextDecoder().decode(entry.bytes), 'deflated text')
})

test('a file that is not a zip throws', async () => {
  await assert.rejects(() => unzip(enc('not a zip at all, just some words')), /not a zip/)
})
