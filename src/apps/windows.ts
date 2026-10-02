// What the applications' windows share: a window made from an application's
// windows.html, a document window's zoom box, and the selection the viewers'
// Copy and Select All act on.

import { VfWindow } from 'vintage-frames'
import { nearBox } from 'vintage-frames/shell'
import type { AppContext, Box, Pin, WindowManager } from 'vintage-frames/shell'

/** A window from `markup`, a windows.html holding one vf-window, upgraded so
 *  its properties can be set before it is appended. */
export function windowFrom(markup: string): VfWindow {
  const host = document.createElement('div')
  host.innerHTML = markup
  customElements.upgrade(host)
  const win = host.querySelector('vf-window')
  if (!(win instanceof VfWindow)) throw new Error('windows.html holds no vf-window')
  win.remove()
  return win
}

/**
 * The zoom box of `app`'s windows: it toggles between the application's
 * `column` and the box the window had before, or its placement without one.
 * The windows open with `keep: column`, so a zoomed one stays zoomed across a
 * browser resize.
 */
export function zoomBetween(ctx: AppContext, app: string, column: (area: Box) => Box): void {
  const { windows } = ctx
  /** Each zoomed window's pin from before the zoom. */
  const before = new WeakMap<VfWindow, Pin>()
  ctx.on(ctx.desktop, 'vf-zoom', (e) => {
    const win = e.target
    if (!(win instanceof VfWindow) || windows.appOf(win) !== app) return
    const cur = { left: win.left ?? 0, top: win.top ?? 0, width: win.width ?? 0, height: win.height ?? 0 }
    const zoomed = column(windows.area)
    if (nearBox(cur, zoomed)) {
      const pin = before.get(win)
      before.delete(win)
      const back = pin ? windows.fromPin(win, pin) : windows.placed(win)
      if (back) windows.write(win, back)
    } else {
      before.set(win, windows.pinOf(win))
      windows.write(win, zoomed)
    }
  })
}

/** The selected text when the selection is anchored in one of `app`'s
 *  windows, otherwise ''. */
export function selectedTextIn(windows: WindowManager, app: string): string {
  const sel = document.getSelection()
  const at = sel?.anchorNode ?? null
  const el = at instanceof Element ? at : (at?.parentElement ?? null)
  if (!sel || sel.isCollapsed || windows.appOf(el?.closest('vf-window') ?? null) !== app) return ''
  return sel.toString()
}

/** Select everything in `node`. */
export function selectContents(node: Node | null): void {
  const sel = document.getSelection()
  if (!node || !sel) return
  const range = document.createRange()
  range.selectNodeContents(node)
  sel.removeAllRanges()
  sel.addRange(range)
}
