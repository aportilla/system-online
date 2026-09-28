// Special → Back Up All Files, and reading a backup: the IO around
// state/backup.ts, which owns the format. The Finder holds both ends, as it
// holds the files and folders.

import { files } from '../../state/files.ts'
import type { LibraryArchive } from '../../state/files.ts'
import { MANIFEST_NAME, backupFilename, planBackup, readManifest } from '../../state/backup.ts'
import { zipStore, unzip } from '../../lib/zip.ts'
import type { ZipEntry } from '../../lib/zip.ts'
import { downloadBlob } from '../../lib/download.ts'

const encode = (s: string) => new TextEncoder().encode(s)

/** Write the library as a zip and download it. A text file that has gone
 *  between the listing and the read is left out of the zip and the
 *  manifest. `app`: the version that wrote it. */
export async function downloadBackup({ app = '', date = new Date() }: { app?: string; date?: Date } = {}) {
  const { manifest, entries } = planBackup(files.get(), { app, date })
  const zipped: ZipEntry[] = []
  const gone = new Set<string>()
  for (const e of entries) {
    if (e.kind === 'dir') {
      zipped.push({ name: e.path, bytes: new Uint8Array(0) })
      continue
    }
    const text = await files.textOf(e.id)
    if (text != null) zipped.push({ name: e.path, bytes: encode(text) })
    else gone.add(e.id)
  }
  if (gone.size) manifest.texts = manifest.texts.filter((t) => !gone.has(t.id))
  const zip = zipStore(
    [{ name: MANIFEST_NAME, bytes: encode(JSON.stringify(manifest, null, 2)) }, ...zipped],
    { date }
  )
  downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), backupFilename(date))
}

/** A read backup: the manifest's rows with each text's words, when it was
 *  made, and how many rows had no entry in the zip. */
export type ReadBackup = LibraryArchive & { exportedAt: string | null; missing: number }

/**
 * Read a file as a backup. One wrapping folder is allowed, so a backup unzipped
 * and zipped again still reads. Throws an Error whose message says what is
 * wrong with the file.
 */
export async function readBackup(file: File): Promise<ReadBackup> {
  let entries
  try {
    entries = await unzip(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error('it is not a zip archive')
  }
  // __MACOSX holds the resource forks the Finder's own compress adds.
  const usable = entries.filter((e) => !e.dir && !e.name.startsWith('__MACOSX/'))
  const found = usable.find((e) => e.name === MANIFEST_NAME || e.name.endsWith(`/${MANIFEST_NAME}`))
  if (!found) throw new Error(`there is no ${MANIFEST_NAME} in it`)
  const prefix = found.name.slice(0, -MANIFEST_NAME.length)
  const text = new TextDecoder()
  const manifest = readManifest(text.decode(found.bytes))
  const at = new Map(usable.map((e) => [e.name, e.bytes]))
  let missing = 0
  const texts: LibraryArchive['texts'] = []
  for (const t of manifest.texts) {
    const bytes = at.get(prefix + t.path)
    // A built-in's text is the app's, so its entry may be absent.
    if (!bytes && t.builtin == null) {
      missing++
      continue
    }
    texts.push({ ...t, text: bytes ? text.decode(bytes) : '' })
  }
  return {
    folders: manifest.folders,
    texts,
    fonts: manifest.fonts,
    exportedAt: manifest.exportedAt,
    missing,
  }
}
