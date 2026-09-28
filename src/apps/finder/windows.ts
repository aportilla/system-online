// Finder folder windows: one vf-window per open folder, cloned from
// #tpl-folder-window (windows.html). icons.ts fills its vf-icon-field with the
// folder's children.
//
// A window's box persists as a nine-slice pin, keyed like the folder's icon. It
// is kept at close() for the session and handed to desktop-state.ts by pins(),
// which also reports the open windows' depth, so the boot reopens them.
//
// A window opened from its icon grows out of it, and the user's close shrinks
// it back into the icon (iconBox), which stays drawn open until the zoom rects
// land (holdGhost). A folder that is gone closes at once.

import { VfWindow } from 'vintage-frames'
import type {
  VfDesktop,
  VfIcon,
  VfIconField,
  VfImg,
  VfLabel,
  VfViewportBox,
} from 'vintage-frames'
import markup from './windows.html?raw'
import trashMarkUrl from './art/trash-indicator.png'
import { files, itemCount, isTrashed } from '../../state/files.ts'
import { FINDER } from '../../state/shell.ts'
import { cascadedBox } from '../../shell/layout.ts'
import type { Pin, Size } from '../../shell/layout.ts'
import { cloneWindow, parseWindows, windowTemplate } from '../../shell/windows.ts'
import type { WindowManager } from '../../shell/windows.ts'
import type { WindowRecord } from '../../shell/desktop-state.ts'
import {
  folderViewport,
  fieldExtent,
  FOLDER_COUNT_AT,
  FOLDER_COUNT_AT_TRASHED,
  FOLDER_TRASH_MARK,
  FOLDER_TRASH_MARK_AT,
} from './layout.ts'

/** The folder's desktop-state key, the same as its icon's in icons.ts. */
export const folderKey = (id: string) => `folder:${id}`

export function initFolderWindows(
  desktop: VfDesktop,
  windows: WindowManager,
  {
    savedPin = () => null,
    iconBox = () => null,
    holdGhost = () => {},
  }: {
    /** A saved pin by item key (desktop-state.ts windowPin), or null. */
    savedPin?: (key: string) => Pin | null
    /** The icon layer's, read at each close. */
    iconBox?: (key: string) => VfViewportBox | null
    holdGhost?: (key: string, until: Promise<unknown>) => void
  } = {}
) {
  const tpl = windowTemplate(parseWindows(markup), 'tpl-folder-window')
  /** Folder id -> its open window. */
  const wins = new Map<string, VfWindow>()
  /** Folder id -> the pin its window closed at this session. */
  const remembered = new Map<string, Pin>()
  /** A window opened or closed. */
  const changed = new Set<() => void>()
  /** A window about to close, its field still live. */
  const willClose = new Set<(id: string, field: VfIconField) => void>()
  const notify = () => {
    for (const fn of changed) fn()
  }

  const fieldOf = (win: VfWindow) => win.querySelector(':scope > vf-icon-field') as VfIconField
  const countOf = (win: VfWindow) => win.querySelector('.folder-count') as VfLabel | null
  const lineOf = (win: VfWindow) => win.querySelector(':scope > vf-container[slot="header"]')
  const markOf = (win: VfWindow) => win.querySelector('.folder-trash-mark')
  /** The folder a window shows, or null. */
  const idOf = (win: Element) => {
    for (const [id, w] of wins) if (w === win) return id
    return null
  }

  /** The header's trash mark: a 1:1 vf-img at the start of the count line. */
  function makeMark(): VfImg {
    const mark = document.createElement('vf-img')
    mark.className = 'folder-trash-mark'
    mark.width = FOLDER_TRASH_MARK.width
    mark.height = FOLDER_TRASH_MARK.height
    mark.left = FOLDER_TRASH_MARK_AT.left
    mark.top = FOLDER_TRASH_MARK_AT.top
    const img = document.createElement('img')
    img.alt = 'in the Trash'
    img.src = trashMarkUrl
    mark.append(img)
    return mark
  }

  /** Update the header's item count, and its trash mark while the folder is
   *  trashed. */
  function count(id: string) {
    const win = wins.get(id)
    if (!win) return
    const st = files.get()
    const n = itemCount(st, id)
    const label = countOf(win)
    const text = `${n} item${n === 1 ? '' : 's'}`
    if (label && label.textContent !== text) label.textContent = text
    const trashed = isTrashed(st, id)
    const mark = markOf(win)
    if (trashed && !mark) lineOf(win)?.prepend(makeMark())
    else if (!trashed && mark) mark.remove()
    const at = trashed ? FOLDER_COUNT_AT_TRASHED : FOLDER_COUNT_AT
    if (label && label.left !== at.left) label.left = at.left
  }

  // The close box only fires vf-close. Closing removes the window.
  const onClose = (e: Event) => {
    const id = e.target instanceof VfWindow ? idOf(e.target) : null
    if (id != null) close(id)
  }
  desktop.addEventListener('vf-close', onClose)
  // A grow box commit changes the viewport, so the field refits.
  const onGrow = (e: Event) => {
    if (!(e as CustomEvent<{ commit?: boolean }>).detail?.commit) return
    const id = e.target instanceof VfWindow ? idOf(e.target) : null
    if (id != null) fit(id)
  }
  desktop.addEventListener('vf-resize', onGrow)

  /** Opens a folder's window or brings it forward. `from` is the box a new
   *  window grows out of, in viewport CSS px. Returns the window, or null for
   *  an unknown folder. */
  function open(id: string, { from = null }: { from?: VfViewportBox | null } = {}): VfWindow | null {
    const rec = files.get().folders.find((f) => f.id === id)
    if (!rec) return null
    let win = wins.get(id)
    if (win) {
      desktop.bringToFront(win)
      return win
    }
    // cloneWindow upgrades the clone, so width and height are readable before
    // the append.
    win = cloneWindow(tpl)
    win.id = `win-folder-${id}`
    win.heading = rec.name
    fieldOf(win).label = rec.name
    const size: Size = { width: win.width ?? 0, height: win.height ?? 0 }
    const n = windows.freeSlot()
    // Append before adopt: the clamp reads the raster's lattice from a
    // connected element.
    desktop.append(win)
    wins.set(id, win)
    // This session's pin, else the saved pin, else the cascade.
    windows.adopt(win, {
      app: FINDER,
      place: (w, h) => cascadedBox(w, h, size, n),
      pin: remembered.get(id) ?? savedPin(folderKey(id)),
      item: folderKey(id),
    })
    remembered.delete(id)
    desktop.bringToFront(win)
    count(id)
    fit(id)
    if (from) void win.show({ from })
    notify()
    return win
  }

  /** Closes a folder's window into `to`, a viewport box, or at once without
   *  one. */
  function closeWindow(id: string, to: VfViewportBox | null = null) {
    const win = wins.get(id)
    if (!win) return
    for (const fn of willClose) fn(id, fieldOf(win))
    remembered.set(id, windows.pinOf(win))
    const landed = windows.dismiss(win, to) // the kit activates the next window
    wins.delete(id)
    if (to) holdGhost(folderKey(id), landed)
    notify()
  }

  /** The user's close: into the folder's icon. */
  const close = (id: string) => closeWindow(id, iconBox(folderKey(id)))

  /** Size the field to the viewport, grown to hold every icon. The field's size
   *  is the scroll range. */
  function fit(id: string) {
    const win = wins.get(id)
    if (!win) return
    const field = fieldOf(win)
    const positions = [...field.querySelectorAll<VfIcon>(':scope > vf-icon')].map((el) => ({
      left: el.left ?? 0,
      top: el.top ?? 0,
    }))
    const ext = fieldExtent(positions, folderViewport({ width: win.width ?? 0, height: win.height ?? 0 }))
    if (field.width !== ext.width) field.width = ext.width
    if (field.height !== ext.height) field.height = ext.height
  }

  // Titles and counts follow the listing. A folder that no longer exists
  // closes its window.
  const sync = () => {
    const st = files.get()
    for (const [id, win] of [...wins]) {
      const rec = st.folders.find((f) => f.id === id)
      if (!rec) {
        closeWindow(id)
        continue
      }
      if (win.heading !== rec.name) win.heading = rec.name
      const field = fieldOf(win)
      if (field.label !== rec.name) field.label = rec.name
      count(id)
    }
  }
  const unsubscribe = files.subscribe(sync)

  return {
    open,
    /** Close a folder's window into its icon. */
    close,
    isOpen: (id: string) => wins.has(id),
    /** The open folders' fields as `[id, field]` pairs. */
    fields: (): [string, VfIconField][] => [...wins].map(([id, win]) => [id, fieldOf(win)]),
    /** The folder whose window `el` is or sits in, or null. */
    folderOf(el: Element | null): string | null {
      const win = el instanceof VfWindow ? el : el?.closest('vf-window')
      return win ? idOf(win) : null
    },
    /** The folder whose window is the desktop's active window, or null. */
    activeFolder(): string | null {
      const w = desktop.activeWindow
      return w ? idOf(w) : null
    },
    /** The plane's viewport of an open folder's window, or null. */
    viewportOf(id: string): Size | null {
      const win = wins.get(id)
      return win ? folderViewport({ width: win.width ?? 0, height: win.height ?? 0 }) : null
    },
    /** Refit a field's size after its icons change. */
    fit,
    /** Every known folder window by item key, for the desktop state: the open
     *  ones read live, over the boxes of those closed this session. */
    pins(): Record<string, WindowRecord> {
      const out: Record<string, WindowRecord> = {}
      for (const [id, pin] of remembered) out[folderKey(id)] = { pin }
      for (const [id, win] of wins) out[folderKey(id)] = windows.record(win)
      return out
    },
    /** A window opened or closed. Returns the unsubscribe. */
    onChange(fn: () => void): () => void {
      changed.add(fn)
      return () => {
        changed.delete(fn)
      }
    },
    /** A window is about to close: `fn(id, field)` with the field still live.
     *  Returns the unsubscribe. */
    onWillClose(fn: (id: string, field: VfIconField) => void): () => void {
      willClose.add(fn)
      return () => {
        willClose.delete(fn)
      }
    },
    dispose(): void {
      unsubscribe()
      desktop.removeEventListener('vf-close', onClose)
      desktop.removeEventListener('vf-resize', onGrow)
      for (const id of [...wins.keys()]) closeWindow(id)
      changed.clear()
      willClose.clear()
    },
  }
}

export type FolderWindows = ReturnType<typeof initFolderWindows>
