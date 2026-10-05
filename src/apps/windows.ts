// What the applications' windows and dialogs share: the selection the viewers'
// Copy and Select All act on, and an alert asked with its message.

import { effectiveScale } from 'vintage-frames'
import type { VfDialog, VfParagraph } from 'vintage-frames'
import type { AppContext, WindowManager } from 'vintage-frames/shell'

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
 * is measured on vf-show, since a closed dialog lays out nothing; the new size
 * lands before the first paint.
 */
export function ask(ctx: AppContext, dialog: VfDialog, message: string): Promise<string | null> {
  const text = dialog.querySelector('[data-message]') as VfParagraph
  if (!authored.has(dialog)) {
    authored.set(dialog, dialog.height ?? 0)
    const buttons = dialog.querySelector('vf-button-group')!
    ctx.on(dialog, 'vf-show', () => {
      const scale = effectiveScale(text)
      const tall = Math.ceil(text.getBoundingClientRect().height / scale)
      const row = Math.ceil(buttons.getBoundingClientRect().height / scale)
      dialog.height = Math.max(authored.get(dialog)!, (text.top ?? 0) + tall + 16 + row + 26)
      buttons.top = dialog.height - 26
    })
  }
  text.textContent = message
  return ctx.ask(dialog)
}
