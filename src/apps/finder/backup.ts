// Special → Back Up All Files… and Restore from Backup…, and a backup dropped
// on the page: the IO and the questions around state/backup.ts, which owns the
// format. A restore asks whether to Add the backup's files beside the
// desktop's or Replace the desktop with them, in the Finder's dialogs
// (dialogs.html). Applications' icons are the system's, not files: a backup
// leaves them out, and a Replace puts them back.

import type { VfButton } from 'vintage-frames'
import { APP_KIND, TRASH, isVolume, itemCount, itemOf } from 'vintage-frames/shell'
import type { AppContext, CatalogState, FinderApi } from 'vintage-frames/shell'
import { CHARSET_FAMILIES } from '../../charset-manifest.ts'
import { MANIFEST_NAME, backupFilename, itemsOf, planBackup, readManifest } from '../../state/backup.ts'
import type { BackupContents } from '../../state/backup.ts'
import { restoreDefaults } from '../../state/defaults.ts'
import type { AppDefault } from '../../state/defaults.ts'
import { builtinText, textOf } from '../../texts/index.ts'
import { unzip, zipStore } from '../../lib/zip.ts'
import type { ZipEntry } from '../../lib/zip.ts'
import { downloadBlob } from '../../lib/download.ts'
import { ask } from '../windows.ts'

const encode = (s: string) => new TextEncoder().encode(s)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Write the catalog as a zip and download it. A text file whose built-in the
 *  app no longer ships is left out of the zip and the manifest. `app`: the
 *  version that wrote it. */
function downloadBackup(state: CatalogState, { app, date = new Date() }: { app: string; date?: Date }) {
  const { manifest, entries } = planBackup(state, { app, date })
  const zipped: ZipEntry[] = []
  const gone = new Set<string>()
  for (const e of entries) {
    if (e.kind === 'dir') {
      zipped.push({ name: e.path, bytes: new Uint8Array(0) })
      continue
    }
    const item = itemOf(state, e.id)
    const text = item ? textOf(item) : null
    if (text != null) zipped.push({ name: e.path, bytes: encode(text) })
    else gone.add(e.id)
  }
  if (gone.size) manifest.texts = manifest.texts.filter((t) => !gone.has(t.id))
  const zip = zipStore([{ name: MANIFEST_NAME, bytes: encode(JSON.stringify(manifest, null, 2)) }, ...zipped], {
    date,
  })
  downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), backupFilename(date))
}

/** A read backup: the manifest's rows with each text's words, when it was
 *  made, and how many rows had no entry in the zip. */
type ReadBackup = BackupContents & { exportedAt: string | null; missing: number }

/**
 * Read a file as a backup. One wrapping folder is allowed, so a backup unzipped
 * and zipped again still reads. Throws an Error whose message says what is
 * wrong with the file.
 */
async function readBackup(file: File): Promise<ReadBackup> {
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
  const texts: BackupContents['texts'] = []
  for (const t of manifest.texts) {
    const bytes = at.get(prefix + t.path)
    // A built-in's text is the app's, so its entry may be absent.
    if (!bytes && t.builtin == null) {
      missing++
      continue
    }
    texts.push({ ...t, text: bytes ? text.decode(bytes) : '' })
  }
  return { folders: manifest.folders, texts, fonts: manifest.fonts, exportedAt: manifest.exportedAt, missing }
}

/** "3 folders, 2 read-me files and 25 fonts", leaving out what is not there. */
function contentsPhrase(read: ReadBackup) {
  const parts: string[] = []
  if (read.folders.length) parts.push(plural(read.folders.length, 'folder', 'folders'))
  if (read.texts.length) parts.push(plural(read.texts.length, 'read-me file', 'read-me files'))
  if (read.fonts.length) parts.push(plural(read.fonts.length, 'font', 'fonts'))
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
}

/** Back Up All Files… and Restore from Backup… in the Finder's Special menu,
 *  and the drop. `apps`: the applications' icons a Replace puts back. */
export function initBackup(finder: FinderApi, ctx: AppContext, apps: AppDefault[]): void {
  const { catalog } = finder
  const question = ctx.dialog('restore')
  const replace = question.querySelector('vf-button[value="replace"]') as VfButton
  const alert = ctx.dialog('alert')
  const say = (message: string) => void ask(ctx, alert, message)
  /** Every file stored, the Trash's included: every item but the volumes and
   *  the applications' icons. */
  const libraryCount = () => catalog.get().items.filter((i) => !isVolume(i.id) && i.kind !== APP_KIND).length

  function restoreQuestion(name: string, read: ReadBackup, here: number) {
    const when = read.exportedAt ? new Date(read.exportedAt) : null
    const saved =
      when && !Number.isNaN(when.getTime())
        ? `, saved ${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : ''
    const head = `“${name}” holds ${contentsPhrase(read)}${saved}.`
    if (!here) return `${head} Add them to the desktop?`
    const trashed = itemCount(catalog.get(), TRASH) > 0
    return (
      `${head} Add them to the desktop, or replace the ` +
      `${plural(here, 'item', 'items')} on it${trashed ? ', the Trash included' : ''}?`
    )
  }

  /** A dropped zip or a picked one. */
  async function restore(file: File) {
    // Without storage, the stock Finder's Storage Unavailable alert.
    if (ctx.modalOpen() || !finder.storageReady()) return
    let read: ReadBackup
    try {
      read = await readBackup(file)
    } catch (err) {
      say(`“${file.name}” isn’t a backup this desktop can read: ${(err as Error).message}.`)
      return
    }
    if (!read.folders.length && !read.texts.length && !read.fonts.length) {
      say(`“${file.name}” holds no files.`)
      return
    }
    const here = libraryCount()
    // Replace is offered only over something to replace.
    replace.hidden = !here
    const answer = await ask(ctx, question, restoreQuestion(file.name, read, here))
    if (answer !== 'add' && answer !== 'replace') return
    const { items, skipped } = itemsOf(read, {
      shipsText: (key) => builtinText(key) != null,
      shipsFamily: (family) => CHARSET_FAMILIES.some((f) => f.label === family),
      places: answer === 'replace',
    })
    try {
      await catalog.import({ items }, { mode: answer === 'replace' ? 'replace' : 'merge' })
      if (answer === 'replace') await restoreDefaults(catalog, { texts: [], apps, families: [] })
    } catch (err) {
      say(`Restore failed: ${(err as Error).message}.`)
      return
    }
    const unread = skipped + read.missing
    if (unread) say(`The backup was restored, but ${plural(unread, 'item', 'items')} in it couldn’t be read.`)
  }

  finder.addCommand({
    menu: 'special',
    value: 'back-up',
    label: 'Back Up All Files…',
    separator: true,
    run: () => {
      try {
        downloadBackup(catalog.get(), { app: __APP_VERSION__ })
      } catch (err) {
        say(`Back Up All Files failed: ${(err as Error).message}.`)
      }
    },
    // Something to write.
    enabled: () => catalog.get().available && libraryCount() > 0,
  })

  // Restore from Backup… opens a file picker. It sits off-screen rather than
  // hidden, so click() opens it in every browser.
  const picker = document.createElement('input')
  picker.type = 'file'
  picker.accept = '.zip,application/zip'
  picker.style.position = 'fixed'
  picker.style.left = '-9999px'
  document.body.append(picker)
  ctx.onDispose(() => picker.remove())
  ctx.on(picker, 'change', () => {
    const f = picker.files?.[0]
    picker.value = '' // so picking the same file again still fires change
    if (f) void restore(f)
  })
  finder.addCommand({
    menu: 'special',
    value: 'restore-backup',
    label: 'Restore from Backup…',
    run: () => picker.click(),
    // Somewhere to put it.
    enabled: () => catalog.get().available,
  })

  // A zip dropped anywhere on the page. Any other file is refused, so the
  // browser does not navigate to it.
  const hasFiles = (e: Event) => [...((e as DragEvent).dataTransfer?.types ?? [])].includes('Files')
  const isArchive = (f: File) => /\.zip$/i.test(f.name) || f.type === 'application/zip'
  ctx.on(document.body, 'dragover', (e) => {
    if (hasFiles(e)) e.preventDefault()
  })
  ctx.on(document.body, 'drop', (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    const f = (e as DragEvent).dataTransfer?.files?.[0]
    if (f && isArchive(f)) void restore(f)
  })
}
