// Text Viewer: the read-me application. Wires its menus to the text windows
// (windows.ts). The Finder opens text files through actions.open.

import type { VfViewportBox, VfWindow } from 'vintage-frames'
import menus from './menus.html?raw'
import { TEXT_VIEWER } from '../../state/shell.ts'
import { itemOf, listeners, menuOf, menuValue } from '../../shell/menu-bar.ts'
import type { WindowRecord } from '../../shell/desktop-state.ts'
import type { App } from '../index.ts'
import { initTextWindows } from './windows.ts'

export interface TextViewerActions {
  /** Opens a text file's window or brings it forward. `from` is the box a new
   *  window grows out of. */
  open(id: string, opts?: { from?: VfViewportBox | null }): Promise<VfWindow | null>
  /** Window geometry by key, for the desktop state snapshot (main.ts). */
  pins(): Record<string, WindowRecord>
}

export const textViewer: App<TextViewerActions> = {
  id: TEXT_VIEWER,
  name: 'Text Viewer',
  menus,
  init({ menus, deps }) {
    const { desktop, windows, modalOpen } = deps
    const WHERE = 'apps/text-viewer'
    // A window closes into its icon through the Finder, read at each close.
    const texts = initTextWindows(desktop, windows, {
      savedPin: deps.windowPin,
      iconBox: (key) => deps.apps.finder?.iconBox(key) ?? null,
      holdGhost: (key, until) => deps.apps.finder?.holdGhost(key, until),
      showError: deps.showError,
    })
    const menuFile = menuOf(menus, 'file', WHERE)
    const menuEdit = menuOf(menus, 'edit', WHERE)
    const menuView = menuOf(menus, 'view', WHERE)
    const l = listeners()

    l.on(menuFile, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      switch (menuValue(e)) {
        case 'close': {
          const id = texts.activeText()
          if (id != null) texts.close(id)
          break
        }
        case 'quit':
          texts.closeAll()
          break
      }
    })

    l.on(menuEdit, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      switch (menuValue(e)) {
        case 'copy': {
          // The enabled item takes ⌘C, so the browser's own copy does not run.
          const text = texts.selectedText()
          if (text) navigator.clipboard?.writeText?.(text).catch(() => {})
          break
        }
        case 'select-all': {
          const id = texts.activeText()
          if (id != null) texts.selectAll(id)
          break
        }
      }
    })

    l.on(menuView, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      if (menuValue(e) === 'arrange') windows.arrange()
    })

    // Copy is disabled unless a text window holds a non-empty selection. A
    // disabled item leaves ⌘C to the browser.
    const itemCopy = itemOf(menuEdit, 'copy', WHERE)
    const syncCopy = () => {
      itemCopy.disabled = texts.selectedText() === ''
    }
    l.on(document, 'selectionchange', syncCopy)
    l.on(desktop, 'vf-activate', syncCopy)
    syncCopy()

    // Arrange Windows is disabled while every window is at its placement.
    const itemArrange = itemOf(menuView, 'arrange', WHERE)
    const syncArrange = () => {
      itemArrange.disabled = windows.arranged()
    }
    l.add(windows.onLayout(syncArrange))
    syncArrange()

    return {
      actions: {
        open: (id, opts) => texts.open(id, opts),
        pins: () => texts.pins(),
      },
      dispose() {
        l.dispose()
        texts.dispose()
      },
    }
  },
}
