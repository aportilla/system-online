// Text Viewer: the read-me application. It opens the library's text files (the
// `text` kind), one window each (windows.ts), and wires its menus. The window
// manager places a window, opens it out of its icon and closes it back into
// it, retitles or closes it as its file is renamed or removed, and runs its
// zoom box, which toggles a reading column (layout.ts).

import { VfWindow } from 'vintage-frames'
import type { VfViewportBox } from 'vintage-frames'
import { defineApp } from 'vintage-frames/shell'
import type { AppDefinition, Item } from 'vintage-frames/shell'
import menus from './menus.html?raw'
import dialogs from './dialogs.html?raw'
import windowMarkup from './windows.html?raw'
import textArt from './art/text-file.png'
import { TEXT } from '../../state/kinds.ts'
import { textOf } from '../../texts/index.ts'
import { ask, selectContents, selectedTextIn } from '../windows.ts'
import { bodyOf, textWindow } from './windows.ts'
import { expandedTextBox } from './layout.ts'

const TEXT_VIEWER = 'text-viewer'

export interface TextViewerActions {
  /** Open a text file's window, or bring it forward. The boot reopens the
   *  last session's windows through it. */
  open(target: { item?: string | null; from?: VfViewportBox | null }): void
}

export function textViewer(): AppDefinition<TextViewerActions> {
  /** Opens a text file's window out of `from`; init sets it. */
  let openText = (_item: Item, _from: VfViewportBox | null): void => {}

  return defineApp<TextViewerActions>({
    id: TEXT_VIEWER,
    name: 'Text Viewer',
    menus,
    dialogs,
    windows: windowMarkup,
    kinds: {
      [TEXT]: {
        art: textArt,
        open: (item, from) => openText(item, from),
        size: (item) => new TextEncoder().encode(textOf(item) ?? '').byteLength,
      },
    },
    init(ctx) {
      const { desktop, windows } = ctx
      const alert = ctx.dialog('alert')

      openText = (item, from) => {
        const text = textOf(item)
        if (text == null) {
          void ask(ctx, alert, `“${item.name}” can’t be opened: its text is no longer part of SystemOnline.`)
          return
        }
        windows.open({
          app: TEXT_VIEWER,
          item: item.id,
          from,
          create: () => textWindow(ctx.window('text'), item.name, text),
          zoom: expandedTextBox,
        })
      }

      /** The active window, when it is a text window. */
      const active = (): VfWindow | null => {
        const w = desktop.activeWindow
        return w instanceof VfWindow && windows.appOf(w) === TEXT_VIEWER ? w : null
      }

      ctx.onMenu((value) => {
        const win = active()
        if (value === 'close' && win) void windows.requestClose(win)
        else if (value === 'quit') void windows.closeAll(TEXT_VIEWER)
        // The enabled item takes ⌘C, so the browser's own copy does not run.
        else if (value === 'copy') navigator.clipboard?.writeText?.(selectedTextIn(windows, TEXT_VIEWER)).catch(() => {})
        else if (value === 'select-all' && win) selectContents(bodyOf(win))
        else if (value === 'arrange') windows.arrange()
      })
      // Copy is disabled unless a text window holds a selection, so ⌘C falls
      // through to the browser.
      ctx.gate(ctx.item('copy'), () => selectedTextIn(windows, TEXT_VIEWER) !== '')
      ctx.gate(ctx.item('arrange'), () => !windows.arranged())

      return {
        open({ item, from = null }) {
          const it = ctx.catalog?.item(item)
          if (it?.kind === TEXT) openText(it, from)
        },
      }
    },
  })
}
