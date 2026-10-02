// What the applications' windows and dialogs share: a window made from an
// application's windows.html, a document window's zoom box, the selection the
// viewers' Copy and Select All act on, and an alert asked with its message.

import { VfWindow, effectiveScale } from 'vintage-frames'
import type { VfDialog, VfParagraph } from 'vintage-frames'
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

/** Each alert's authored height, the least it is asked at. */
const authored = new WeakMap<VfDialog, number>()

/**
 * Ask `dialog`, an alert from an application's dialogs.html, with `message`
 * in its [data-message] paragraph. Resolves the pressed button's value, or
 * null for Escape.
 *
 * A longer message grows the box, as the kit's own Finder alerts do: 16 under
 * the message, the button row, then 16 and the plain frame's 10 below it. It
 * is measured once shown, since a closed dialog lays out nothing; the new size
 * lands before the first paint.
 */
export function ask(ctx: AppContext, dialog: VfDialog, message: string): Promise<string | null> {
  const text = dialog.querySelector('[data-message]') as VfParagraph
  const buttons = dialog.querySelector('vf-button-group')!
  if (!authored.has(dialog)) authored.set(dialog, dialog.height ?? 0)
  text.textContent = message
  const answer = ctx.ask(dialog)
  const scale = effectiveScale(text)
  const tall = Math.ceil(text.getBoundingClientRect().height / scale)
  const row = Math.ceil(buttons.getBoundingClientRect().height / scale)
  dialog.height = Math.max(authored.get(dialog)!, (text.top ?? 0) + tall + 16 + row + 26)
  buttons.top = dialog.height - 26
  return answer
}
