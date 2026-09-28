// Text Viewer windows: one vf-window per open text file, cloned from
// #tpl-text-window. The body shows the file's text, read-only.
//
// A window's box persists as a nine-slice pin, keyed like the file's icon. It is
// kept at close() for the session, and pins() hands it to desktop-state.ts with
// the open windows' depth, so the boot reopens them where they were.
//
// The zoom box toggles between the expandedTextBox column and the previous box.
// nearBox reads the state at the click. The previous box is saved as a
// nine-slice pin. Without one the window returns to its placement. `keep` holds
// a zoomed window zoomed across a browser resize.
//
// A window opened from its icon grows out of it, and the user's close shrinks
// it back into the icon through the Finder (iconBox, holdGhost). A file that
// is gone closes at once.

import { VfWindow } from 'vintage-frames'
import type { VfDesktop, VfParagraph, VfViewportBox } from 'vintage-frames'
import markup from './windows.html?raw'
import { files } from '../../state/files.ts'
import { TEXT_VIEWER } from '../../state/shell.ts'
import { cascadedBox, nearBox } from '../../shell/layout.ts'
import type { Pin } from '../../shell/layout.ts'
import { cloneWindow, parseWindows, windowTemplate } from '../../shell/windows.ts'
import type { WindowManager } from '../../shell/windows.ts'
import type { WindowRecord } from '../../shell/desktop-state.ts'
import { expandedTextBox } from './layout.ts'

/** A text's catalog item key, shared with its icon. */
const itemOf = (id: string) => `text:${id}`

export function initTextWindows(
  desktop: VfDesktop,
  windows: WindowManager,
  {
    savedPin = () => null,
    iconBox = () => null,
    holdGhost = () => {},
    showError = () => {},
  }: {
    /** A saved pin by item key (desktop-state.ts windowPin), or null. */
    savedPin?: (key: string) => Pin | null
    /** The Finder's, read at each close. */
    iconBox?: (key: string) => VfViewportBox | null
    holdGhost?: (key: string, until: Promise<unknown>) => void
    showError?: (message: string) => void
  } = {}
) {
  const tpl = windowTemplate(parseWindows(markup), 'tpl-text-window')
  /** Text id -> window. */
  const wins = new Map<string, VfWindow>()
  /** Text id -> the pin its window closed at this session. */
  const remembered = new Map<string, Pin>()

  const bodyOf = (win: VfWindow) => win.querySelector('.text-body') as VfParagraph
  /** The text id a window shows, or null. */
  const idOf = (win: Element) => {
    for (const [id, w] of wins) if (w === win) return id
    return null
  }

  // The kit's close box fires vf-close but does not remove the window.
  const onClose = (e: Event) => {
    const id = e.target instanceof VfWindow ? idOf(e.target) : null
    if (id != null) close(id)
  }
  desktop.addEventListener('vf-close', onClose)

  /** Each zoomed window's pin from before the zoom. */
  const expandMemory = new WeakMap<VfWindow, Pin>()
  const zoom = (win: VfWindow) => {
    const cur = { left: win.left ?? 0, top: win.top ?? 0, width: win.width ?? 0, height: win.height ?? 0 }
    const column = expandedTextBox(desktop.width, desktop.height)
    if (nearBox(cur, column)) {
      const pin = expandMemory.get(win)
      expandMemory.delete(win)
      const back = pin ? windows.fromPin(win, pin) : windows.placed(win)
      if (back) windows.write(win, back)
    } else {
      expandMemory.set(win, windows.pinOf(win))
      windows.write(win, column)
    }
  }
  const onZoom = (e: Event) => {
    const win = e.target
    if (win instanceof VfWindow && idOf(win) != null) zoom(win)
  }
  desktop.addEventListener('vf-zoom', onZoom)

  /** Opens or raises a text file's window. `from` is the box a new window
   *  grows out of, in viewport CSS px. Resolves the window, or null if the
   *  file is gone. */
  async function open(id: string, { from = null }: { from?: VfViewportBox | null } = {}) {
    let win = wins.get(id)
    if (win) {
      desktop.bringToFront(win)
      return win
    }
    const rec = files.textRec(id)
    if (!rec) return null
    let text: string | null
    try {
      text = await files.textOf(id)
    } catch (err) {
      showError(`“${rec.name}” couldn’t be opened: ${(err as Error).message}.`)
      return null
    }
    if (text == null) return null
    win = wins.get(id) // another open finished during the await
    if (win) {
      desktop.bringToFront(win)
      return win
    }
    win = cloneWindow(tpl)
    win.id = `win-text-${id}`
    win.heading = files.textRec(id)?.name ?? rec.name
    bodyOf(win).textContent = text
    const size = { width: win.width ?? 0, height: win.height ?? 0 }
    const n = windows.freeSlot()
    // Append before adopt: the clamp reads the raster's lattice from a
    // connected element.
    desktop.append(win)
    wins.set(id, win)
    // This session's pin, else the saved pin, else the cascade.
    windows.adopt(win, {
      app: TEXT_VIEWER,
      place: (w, h) => cascadedBox(w, h, size, n),
      pin: remembered.get(id) ?? savedPin(itemOf(id)),
      keep: expandedTextBox,
      item: itemOf(id),
    })
    remembered.delete(id)
    desktop.bringToFront(win)
    if (from) void win.show({ from })
    return win
  }

  /** Closes a text's window into `to`, a viewport box, or at once without
   *  one. */
  function closeWindow(id: string, to: VfViewportBox | null = null) {
    const win = wins.get(id)
    if (!win) return
    remembered.set(id, windows.pinOf(win))
    wins.delete(id)
    const landed = windows.dismiss(win, to) // the kit picks the next active window
    if (to) holdGhost(itemOf(id), landed)
  }

  /** The user's close: into the file's icon. */
  const close = (id: string) => closeWindow(id, iconBox(itemOf(id)))

  // Follow renames, and close windows whose text file was deleted.
  const sync = () => {
    const st = files.get()
    for (const [id, win] of [...wins]) {
      const rec = st.texts.find((t) => t.id === id)
      if (!rec) {
        closeWindow(id)
        continue
      }
      if (win.heading !== rec.name) win.heading = rec.name
    }
  }
  const unsubscribe = files.subscribe(sync)

  /** The text id of the window containing `node`, or null. */
  const textOfNode = (node: Node | null) => {
    const el = node instanceof Element ? node : (node?.parentElement ?? null)
    const win = el?.closest('vf-window')
    return win ? idOf(win) : null
  }

  return {
    open,
    /** Closes a text file's window into its icon. */
    close,
    /** Closes every window, each into its own icon. */
    closeAll(): void {
      for (const id of [...wins.keys()]) close(id)
    },
    /** Every known window by item key, for the desktop state: the open ones
     *  read live, over the boxes of those closed this session. */
    pins(): Record<string, WindowRecord> {
      const out: Record<string, WindowRecord> = {}
      for (const [id, pin] of remembered) out[itemOf(id)] = { pin }
      for (const [id, win] of wins) out[itemOf(id)] = windows.record(win)
      return out
    },
    /** The text id of the active window, or null. */
    activeText(): string | null {
      const w = desktop.activeWindow
      return w ? idOf(w) : null
    },
    /** The selected text if the selection is anchored in a text window,
     *  otherwise ''. */
    selectedText(): string {
      const sel = document.getSelection()
      if (!sel || sel.isCollapsed || textOfNode(sel.anchorNode) == null) return ''
      return sel.toString()
    },
    /** Selects all the body text in a text's window. */
    selectAll(id: string): void {
      const win = wins.get(id)
      const body = win ? bodyOf(win) : null
      const sel = document.getSelection()
      if (!body || !sel) return
      const range = document.createRange()
      range.selectNodeContents(body)
      sel.removeAllRanges()
      sel.addRange(range)
    },
    dispose(): void {
      unsubscribe()
      desktop.removeEventListener('vf-close', onClose)
      desktop.removeEventListener('vf-zoom', onZoom)
      for (const id of [...wins.keys()]) closeWindow(id)
    },
  }
}
