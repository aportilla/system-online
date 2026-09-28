// Font Viewer: opens font suitcases. Wires its menus to the font windows
// (windows.ts) and fills the Size menu with the active window's strikes. The
// Finder opens a suitcase through actions.open.

import type { VfViewportBox, VfWindow } from 'vintage-frames'
import menus from './menus.html?raw'
import { FONT_VIEWER } from '../../state/shell.ts'
import { itemOf, listeners, menuOf, menuValue } from '../../shell/menu-bar.ts'
import type { WindowRecord } from '../../shell/desktop-state.ts'
import type { App } from '../index.ts'
import { initFontWindows } from './windows.ts'
import { sizeLabel } from './specimen.ts'

export interface FontViewerActions {
  /** Opens a suitcase's window or brings it forward. `from` is the box a new
   *  window grows out of. */
  open(id: string, opts?: { from?: VfViewportBox | null }): VfWindow | null
  /** Window geometry by key, for the desktop state snapshot (main.ts). */
  pins(): Record<string, WindowRecord>
}

export const fontViewer: App<FontViewerActions> = {
  id: FONT_VIEWER,
  name: 'Font Viewer',
  menus,
  init({ menus, deps }) {
    const { desktop, windows, modalOpen } = deps
    const WHERE = 'apps/font-viewer'
    const menuFile = menuOf(menus, 'file', WHERE)
    const menuEdit = menuOf(menus, 'edit', WHERE)
    const menuView = menuOf(menus, 'view', WHERE)
    const menuSize = menuOf(menus, 'size', WHERE)
    const l = listeners()

    /** The Size menu: the active window's strikes, its own checked. The menu
     *  is on the bar only while a font window is active. */
    const syncSize = () => {
      const id = fonts.activeFont()
      const strikes = id != null ? fonts.strikesOf(id) : null
      if (!strikes) return
      const { family, font } = strikes
      const want = family.fonts.map((f) => `${f.size}:${f === font}`).join(' ')
      if (menuSize.dataset.shows === `${family.label} ${want}`) return
      menuSize.dataset.shows = `${family.label} ${want}`
      menuSize.replaceChildren(
        ...family.fonts.map((f) => {
          const item = document.createElement('vf-menu-item')
          item.value = String(f.size)
          item.textContent = sizeLabel(family, f)
          item.checked = f === font
          return item
        })
      )
    }

    // A window closes into its icon through the Finder, read at each close.
    const fonts = initFontWindows(desktop, windows, {
      savedPin: deps.windowPin,
      iconBox: (key) => deps.apps.finder?.iconBox(key) ?? null,
      holdGhost: (key, until) => deps.apps.finder?.holdGhost(key, until),
      onFont: syncSize,
    })
    l.on(desktop, 'vf-activate', syncSize)

    l.on(menuFile, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      switch (menuValue(e)) {
        case 'close': {
          const id = fonts.activeFont()
          if (id != null) fonts.close(id)
          break
        }
        case 'quit':
          fonts.closeAll()
          break
      }
    })

    l.on(menuEdit, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      switch (menuValue(e)) {
        case 'copy': {
          // The enabled item takes ⌘C, so the browser's own copy does not run.
          const text = fonts.selectedText()
          if (text) navigator.clipboard?.writeText?.(text).catch(() => {})
          break
        }
        case 'select-all': {
          const id = fonts.activeFont()
          if (id != null) fonts.selectAll(id)
          break
        }
      }
    })

    l.on(menuSize, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      const id = fonts.activeFont()
      if (id != null) fonts.setSize(id, Number(menuValue(e)))
    })

    l.on(menuView, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      if (menuValue(e) === 'arrange') windows.arrange()
    })

    // Copy is disabled unless a font window holds a non-empty selection.
    const itemCopy = itemOf(menuEdit, 'copy', WHERE)
    const syncCopy = () => {
      itemCopy.disabled = fonts.selectedText() === ''
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
        open: (id, opts) => {
          const win = fonts.open(id, opts)
          syncSize()
          return win
        },
        pins: () => fonts.pins(),
      },
      dispose() {
        l.dispose()
        fonts.dispose()
      },
    }
  },
}
