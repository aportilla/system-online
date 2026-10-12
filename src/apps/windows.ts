// What the applications' windows and dialogs share: an alert asked with its
// message.

import { effectiveScale } from 'vintage-frames'
import type { VfDialog, VfParagraph } from 'vintage-frames'
import type { AppContext } from 'system-online-sdk'

/** Each alert's authored height, the least it is asked at. */
const authored = new WeakMap<VfDialog, number>()

/**
 * Ask `dialog`, an alert from an application's dialogs.html, with `message`
 * in its [data-message] paragraph. Resolves the pressed button's value, or
 * null for Escape.
 *
 * A longer message grows the box, as the stock Finder's alerts do: 16 under
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
