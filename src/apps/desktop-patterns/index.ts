// Desktop Patterns: the control panel application. It installs its item in the
// Apple menu and wires its menus to the panel window (windows.ts).

import menus from './menus.html?raw'
import { DESKTOP_PATTERNS } from '../../state/shell.ts'
import { itemOf, listeners, menuOf, menuValue } from '../../shell/menu-bar.ts'
import type { App } from '../index.ts'
import { initPatternsWindow } from './windows.ts'

export interface DesktopPatternsActions {
  /** Opens the panel or brings it forward. */
  open(): void
}

/** The Apple menu item's value. */
const APPLE_ITEM = 'desktop-patterns'

export const desktopPatterns: App<DesktopPatternsActions> = {
  id: DESKTOP_PATTERNS,
  name: 'Desktop Patterns',
  menus,
  init({ menus, deps }) {
    const { desktop, windows, modalOpen, appleMenu } = deps
    const WHERE = 'apps/desktop-patterns'
    const panel = initPatternsWindow(desktop, windows)
    const menuFile = menuOf(menus, 'file', WHERE)
    const menuView = menuOf(menus, 'view', WHERE)
    const l = listeners()

    // Apple menu → Desktop Patterns. No ellipsis: it opens a window, not a
    // dialog.
    const appleItem = document.createElement('vf-menu-item')
    appleItem.value = APPLE_ITEM
    appleItem.textContent = 'Desktop Patterns'
    appleMenu.append(appleItem)
    l.add(() => appleItem.remove())
    l.on(appleMenu, 'vf-menu-select', (e) => {
      if (!modalOpen() && menuValue(e) === APPLE_ITEM) panel.open()
    })

    l.on(menuFile, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      switch (menuValue(e)) {
        case 'close':
        case 'quit':
          panel.close()
          break
      }
    })

    l.on(menuView, 'vf-menu-select', (e) => {
      if (modalOpen()) return
      if (menuValue(e) === 'arrange') windows.arrange()
    })

    // Arrange Windows is disabled while every window is at its placement.
    const itemArrange = itemOf(menuView, 'arrange', WHERE)
    const syncArrange = () => {
      itemArrange.disabled = windows.arranged()
    }
    l.add(windows.onLayout(syncArrange))
    syncArrange()

    return {
      actions: {
        open: () => panel.open(),
      },
      dispose() {
        l.dispose()
        panel.dispose()
      },
    }
  },
}
