// The Finder: the desktop's application. It creates its folder windows
// (windows.ts) and icon layer (icons.ts), wires its menus (menus.html), and
// gives main.ts the icon positions and folder window pins for the desktop state.
//
// The menu bar detaches these menus while another app is front, which disables
// their shortcuts. Handlers return while a modal is open because shortcuts fire
// app-wide.

import type { VfButton, VfDialog, VfWindow } from 'vintage-frames'
import menus from './menus.html?raw'
import { files, descendantsOf, isTrashed, itemCount, TRASH } from '../../state/files.ts'
import type { FilesState } from '../../state/files.ts'
import { clipboard, pasteSource } from '../../state/clipboard.ts'
import type { ClipboardItemRef } from '../../state/clipboard.ts'
import { missingDefaults, restoreDefaults } from '../../state/defaults.ts'
import { shell, FINDER } from '../../state/shell.ts'
import { TEXTS } from '../../texts/index.ts'
import { CHARSET_FAMILIES } from '../../charset-manifest.ts'
import { readSystemClipboard, writeSystemClipboard } from '../../lib/system-clipboard.ts'
import { itemOf, listeners, menuOf, menuValue } from '../../shell/menu-bar.ts'
import type { Point } from '../../shell/layout.ts'
import type { WindowRecord } from '../../shell/desktop-state.ts'
import type { App } from '../index.ts'
import { initFolderWindows } from './windows.ts'
import { initIcons } from './icons.ts'
import { downloadBackup, readBackup } from './backup.ts'
import type { ReadBackup } from './backup.ts'

/** Every family the app ships, a suitcase each. */
const FAMILIES = CHARSET_FAMILIES.map((f) => f.label)

export interface FinderActions {
  /** Icon positions by key, for the desktop state snapshot (main.ts). */
  positions(): Record<string, Point | null>
  /** Folder window pins by key, for the snapshot. */
  pins(): Record<string, WindowRecord>
  /** Opens a folder's window, or brings it forward. */
  openFolder(id: string): VfWindow | null
  /** The box a window showing an item closes into, or null (icons.ts). */
  iconBox(key: string): DOMRect | null
  /** Keeps an item's icon drawn open until `until` settles. */
  holdGhost(key: string, until: Promise<unknown>): void
  /** Asks whether to add or replace, for a backup dropped on the page. */
  receiveArchive(file: File): void
  /** Subscribes to icon moves that end without a gesture, such as a Clean Up
   *  walk. Returns the unsubscribe. */
  onMoved(fn: () => void): () => void
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Everything stored anywhere, the Trash's included: every item but the two
 *  record-less containers. */
const libraryCount = (st: FilesState) => st.folders.length - 2 + st.texts.length + st.fonts.length

export const finder: App<FinderActions> = {
  id: FINDER,
  name: 'Finder',
  menus,
  init({ menus, deps }) {
    const { desktop, windows, modalOpen, showStorage, showError } = deps
    const WHERE = 'apps/finder'
    // The icon layer takes the folder windows, so its calls are read at each
    // close.
    const folders = initFolderWindows(desktop, windows, {
      savedPin: deps.windowPin,
      iconBox: (key) => icons.iconBox(key),
      holdGhost: (key, until) => icons.holdGhost(key, until),
    })
    const icons = initIcons(desktop, {
      windows,
      folders,
      apps: deps.apps,
      savedPos: deps.iconPos,
      showError,
    })
    const $ = <T extends Element = HTMLElement>(sel: string): T => {
      const el = desktop.querySelector<T>(sel)
      if (!el) throw new Error(`${WHERE}: missing element ${sel}`)
      return el
    }
    const menuFile = menuOf(menus, 'file', WHERE)
    const menuEdit = menuOf(menus, 'edit', WHERE)
    const menuView = menuOf(menus, 'view', WHERE)
    const menuSpecial = menuOf(menus, 'special', WHERE)
    const l = listeners()
    const failed = (what: string) => (err: unknown) =>
      showError(`${what} failed: ${(err as Error).message}.`)

    // Empty Trash alert.
    const dlgEmptyTrash = $<VfDialog>('#dlg-empty-trash')
    const emptyTrashMsg = $('#empty-trash-msg')
    function showEmptyTrash() {
      const { folders: dirs, texts, fonts } = descendantsOf(files.get(), TRASH)
      const n = dirs.length + texts.length + fonts.length
      if (!n) return
      const bytes = [...texts, ...fonts].reduce((sum, r) => sum + r.size, 0)
      const k = Math.ceil(bytes / 1024)
      emptyTrashMsg.textContent =
        n === 1
          ? `The Trash contains 1 item, which uses ${k}K of disk space. Are you sure you want to permanently remove it?`
          : `The Trash contains ${n} items, which use ${k}K of disk space. Are you sure you want to permanently remove these items?`
      dlgEmptyTrash.show()
    }
    l.on($('#btn-empty-trash-cancel'), 'click', () => dlgEmptyTrash.close())
    l.on($('#btn-empty-trash-ok'), 'click', () => {
      dlgEmptyTrash.close()
      files.emptyTrash().catch(failed('Empty Trash'))
    })

    // Back Up All Files, and Restore from Backup… or a dropped zip (main.ts).
    // The archive waits in `pending` for the Restore question's answer.
    const dlgRestore = $<VfDialog>('#dlg-restore-backup')
    const restoreMsg = $('#restore-backup-msg')
    const btnRestoreReplace = $<VfButton>('#btn-restore-replace')
    const dlgRestoreFailed = $<VfDialog>('#dlg-restore-failed')
    const restoreFailedMsg = $('#restore-failed-msg')
    let pending: ReadBackup | null = null

    const showRestoreFailed = (msg: string) => {
      restoreFailedMsg.textContent = msg
      dlgRestoreFailed.show()
    }
    l.on($('#btn-restore-failed-ok'), 'click', () => dlgRestoreFailed.close())

    function backUp() {
      if (!files.get().available) {
        showStorage()
        return
      }
      downloadBackup({ app: __APP_VERSION__ }).catch(failed('Back Up All Files'))
    }

    /** "3 folders, 2 read-me files and 25 fonts", leaving out what is not
     *  there. */
    function archivePhrase(archive: ReadBackup) {
      const parts: string[] = []
      if (archive.folders.length) parts.push(plural(archive.folders.length, 'folder', 'folders'))
      if (archive.texts.length) parts.push(plural(archive.texts.length, 'read-me file', 'read-me files'))
      if (archive.fonts.length) parts.push(plural(archive.fonts.length, 'font', 'fonts'))
      return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
    }

    function restoreQuestion(name: string, archive: ReadBackup) {
      const when = archive.exportedAt ? new Date(archive.exportedAt) : null
      const saved =
        when && !Number.isNaN(when.getTime())
          ? `, saved ${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
          : ''
      const head = `“${name}” holds ${archivePhrase(archive)}${saved}.`
      const st = files.get()
      const here = libraryCount(st)
      if (!here) return `${head} Add them to the desktop?`
      const trashed = itemCount(st, TRASH) > 0
      return (
        `${head} Add them to the desktop, or replace the ` +
        `${plural(here, 'item', 'items')} on it${trashed ? ', the Trash included' : ''}?`
      )
    }

    /** A dropped zip or a picked one. */
    async function receiveArchive(file: File) {
      if (modalOpen()) return
      if (!files.get().available) {
        showStorage()
        return
      }
      let archive: ReadBackup
      try {
        archive = await readBackup(file)
      } catch (err) {
        showRestoreFailed(`“${file.name}” isn’t a backup this desktop can read: ${(err as Error).message}.`)
        return
      }
      if (!archive.folders.length && !archive.texts.length && !archive.fonts.length) {
        showRestoreFailed(`“${file.name}” holds no files.`)
        return
      }
      pending = archive
      restoreMsg.textContent = restoreQuestion(file.name, archive)
      btnRestoreReplace.disabled = libraryCount(files.get()) === 0
      dlgRestore.show()
    }

    function restore(mode: 'merge' | 'replace') {
      const archive = pending
      pending = null
      dlgRestore.close()
      if (!archive) return
      files
        .importArchive(archive, { mode })
        .then((res) => {
          const unread = (res?.skipped ?? 0) + archive.missing
          if (unread) {
            showRestoreFailed(
              `The backup was restored, but ${plural(unread, 'item', 'items')} in it couldn’t be read.`
            )
          }
        })
        .catch(failed('Restore'))
    }
    l.on($('#btn-restore-cancel'), 'click', () => {
      pending = null
      dlgRestore.close()
    })
    l.on(btnRestoreReplace, 'click', () => restore('replace'))
    l.on($('#btn-restore-add'), 'click', () => restore('merge'))

    // Restore from Backup… reaches the same handler through a file picker. It
    // sits off-screen rather than hidden, so click() opens it in every browser.
    const picker = document.createElement('input')
    picker.type = 'file'
    picker.accept = '.zip,application/zip'
    picker.style.position = 'fixed'
    picker.style.left = '-9999px'
    document.body.append(picker)
    l.add(() => picker.remove())
    l.on(picker, 'change', () => {
      const f = picker.files?.[0]
      picker.value = '' // so picking the same file again still fires change
      if (f) void receiveArchive(f)
    })

    // Clipboard.
    /** Parses an icon key (kind:id, from icons.ts) into a clipboard ref. */
    const refOf = (key: string): ClipboardItemRef => {
      const at = key.indexOf(':')
      return { kind: key.slice(0, at) as ClipboardItemRef['kind'], id: key.slice(at + 1) }
    }
    const nameOf = (st: FilesState, it: ClipboardItemRef) =>
      it.kind === 'folder'
        ? st.folders.find((f) => f.id === it.id)?.name
        : it.kind === 'text'
          ? st.texts.find((t) => t.id === it.id)?.name
          : st.fonts.find((t) => t.id === it.id)?.name

    // The system clipboard gets the names, one per line. pasteSource compares
    // that text with the slice's to tell an in-app copy from a foreign one.
    function copySelection() {
      const keys = icons.selection()
      if (!keys.length) return
      const st = files.get()
      const items = keys.map(refOf)
      const text = items
        .map((it) => nameOf(st, it))
        .filter((n) => n != null)
        .join('\n')
      clipboard.set(items, text)
      void writeSystemClipboard(text)
    }

    // An unreadable system clipboard reads as null, and pasteSource then uses
    // the slice.
    async function paste(system?: { text: string | null } | null) {
      if (!files.get().available) {
        showStorage()
        return
      }
      const target = folders.activeFolder()
      if (isTrashed(files.get(), target)) return
      const read = system === undefined ? await readSystemClipboard() : system
      if (pasteSource(clipboard.get(), read) !== 'items') return
      try {
        const keys: string[] = []
        for (const it of clipboard.get().items) {
          const made =
            it.kind === 'folder'
              ? await files.copyFolder(it.id, { parent: target })
              : await files.copyItem(it.kind, it.id, { folder: target })
          if (made) keys.push(`${it.kind}:${made.id}`)
        }
        if (keys.length) icons.select(keys)
      } catch (err) {
        failed('Paste')(err)
      }
    }

    // Menus.
    l.on(menuFile, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      switch (menuValue(e)) {
        case 'open':
          void icons.openSelection()
          break
        case 'new-folder': {
          // createFolder also refuses a parent in the Trash.
          if (!files.get().available) {
            showStorage()
            break
          }
          files
            .createFolder({ parent: folders.activeFolder() })
            .then((made) => {
              if (made) icons.startRename(`folder:${made.id}`)
            })
            .catch(failed('New Folder'))
          break
        }
        case 'close': {
          // Folder windows are the only windows the Finder closes.
          const f = folders.activeFolder()
          if (f != null) folders.close(f)
          break
        }
      }
    })

    l.on(menuEdit, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      switch (menuValue(e)) {
        case 'copy':
          copySelection()
          break
        case 'paste':
          void paste()
          break
        case 'select-all':
          icons.selectAll(folders.activeFolder())
          break
      }
    })

    l.on(menuView, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      if (menuValue(e) === 'arrange') windows.arrange()
    })

    l.on(menuSpecial, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      switch (menuValue(e)) {
        case 'clean-up':
          void icons.cleanUp(folders.activeFolder())
          break
        case 'empty-trash':
          showEmptyTrash()
          break
        case 'restore-defaults':
          restoreDefaults(files, TEXTS, FAMILIES).catch(failed('Restore Default Files'))
          break
        case 'back-up':
          backUp()
          break
        case 'restore-backup':
          picker.click()
          break
      }
    })

    // The browser's own Edit → Paste fires a paste event with no keydown.
    // clipboardData is readable only during the event.
    l.on(document, 'paste', (e) => {
      if (shell.get().frontApp !== FINDER || itemPaste.disabled || modalOpen()) return
      const text = (e as ClipboardEvent).clipboardData?.getData('text/plain') ?? null
      if (pasteSource(clipboard.get(), { text }) !== 'items') return
      e.preventDefault()
      void paste({ text })
    })

    // Gates.
    // The kit's shortcuts ignore focus, so Copy, Paste and Select All are
    // disabled while a text control has focus. Focus is read from the composed
    // path because kit fields keep their <input> in shadow DOM.
    const itemOpen = itemOf(menuFile, 'open', WHERE)
    const itemClose = itemOf(menuFile, 'close', WHERE)
    const itemNewFolder = itemOf(menuFile, 'new-folder', WHERE)
    const itemCopy = itemOf(menuEdit, 'copy', WHERE)
    const itemPaste = itemOf(menuEdit, 'paste', WHERE)
    const itemSelectAll = itemOf(menuEdit, 'select-all', WHERE)
    const itemCleanUp = itemOf(menuSpecial, 'clean-up', WHERE)
    /** Whether the innermost focused element is a text control. */
    let textFocused = false
    const syncGate = () => {
      const st = files.get()
      const front = folders.activeFolder()
      // Clean Up is never disabled.
      const cleanUp = front == null ? 'Clean Up Desktop' : 'Clean Up Window'
      if (itemCleanUp.textContent !== cleanUp) itemCleanUp.textContent = cleanUp
      itemClose.disabled = front == null
      itemNewFolder.disabled = isTrashed(st, front)
      itemOpen.disabled = textFocused || icons.selectedKeys().length === 0
      itemCopy.disabled = textFocused || icons.selection().length === 0
      itemPaste.disabled = textFocused || isTrashed(st, front)
      itemSelectAll.disabled = textFocused
    }
    l.add(folders.onChange(syncGate))
    l.add(files.subscribe(syncGate))
    l.add(icons.onSelectionChange(syncGate))
    l.on(desktop, 'vf-activate', syncGate)
    l.on(document, 'focusin', (e) => {
      const t = e.composedPath()[0]
      const tag = t instanceof Element ? t.tagName : ''
      textFocused = tag === 'INPUT' || tag === 'TEXTAREA'
      syncGate()
    })
    l.on(document, 'focusout', () => {
      // A following focusin sets it again.
      textFocused = false
      syncGate()
    })
    syncGate()

    const itemEmptyTrash = itemOf(menuSpecial, 'empty-trash', WHERE)
    const itemRestore = itemOf(menuSpecial, 'restore-defaults', WHERE)
    const itemBackUp = itemOf(menuSpecial, 'back-up', WHERE)
    const itemRestoreBackup = itemOf(menuSpecial, 'restore-backup', WHERE)
    const syncSpecial = () => {
      const st = files.get()
      itemEmptyTrash.disabled = itemCount(st, TRASH) === 0
      // missingDefaults counts a trashed built-in as present.
      const missing = missingDefaults(st, TEXTS, FAMILIES)
      itemRestore.disabled = !st.available || !(missing.texts.length + missing.fonts.length)
      // Back Up needs something to write; Restore needs somewhere to put it.
      itemBackUp.disabled = !st.available || libraryCount(st) === 0
      itemRestoreBackup.disabled = !st.available
    }
    l.add(files.subscribe(syncSpecial))
    syncSpecial()

    // Arrange Windows is disabled while every window is at its placement.
    const itemArrange = itemOf(menuView, 'arrange', WHERE)
    const syncArrange = () => {
      itemArrange.disabled = windows.arranged()
    }
    l.add(windows.onLayout(syncArrange))
    syncArrange()

    return {
      actions: {
        positions: () => icons.positions(),
        pins: () => folders.pins(),
        openFolder: (id) => folders.open(id),
        iconBox: (key) => icons.iconBox(key),
        holdGhost: (key, until) => icons.holdGhost(key, until),
        receiveArchive: (file) => void receiveArchive(file),
        onMoved: (fn) => icons.onMoved(fn),
      },
      dispose() {
        l.dispose()
        icons.dispose()
        folders.dispose()
      },
    }
  },
}
