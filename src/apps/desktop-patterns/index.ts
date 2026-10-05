// Desktop Patterns: the control panel application. Its item in the Apple menu
// opens one panel (windows.ts), centered, with no icon to open out of or close
// into. Only Set Desktop Pattern changes the desktop's pattern, which the
// shell saves with the session; closing discards an unset choice.

import type { VfWindow } from 'vintage-frames'
import { centeredBox, defineApp } from 'vintage-frames/shell'
import type { AppDefinition } from 'vintage-frames/shell'
import menus from './menus.html?raw'
import windowMarkup from './windows.html?raw'
import { patternsWindow } from './windows.ts'

const DESKTOP_PATTERNS = 'desktop-patterns'

/** The kit's default desktop pattern, the 50% dither. */
const DEFAULT_PATTERN = 'gray-50'

export function desktopPatterns(): AppDefinition {
  return defineApp({
    id: DESKTOP_PATTERNS,
    name: 'Desktop Patterns',
    menus,
    windows: windowMarkup,
    init(ctx) {
      const { desktop, windows } = ctx
      /** The panel, while it is open. */
      let panel: VfWindow | null = null

      // Each open seeds the choice from the desktop's pattern.
      const open = () => {
        if (panel?.isConnected) {
          desktop.bringToFront(panel)
          return
        }
        const win = patternsWindow(ctx.window('patterns'), desktop.pattern ?? DEFAULT_PATTERN, (pattern) => {
          desktop.pattern = pattern
        })
        const size = { width: win.width ?? 0, height: win.height ?? 0 }
        panel = windows.open({ app: DESKTOP_PATTERNS, create: () => win, place: (area) => centeredBox(area, size) })
      }
      // No ellipsis: it opens a window, not a dialog.
      ctx.systemItem(DESKTOP_PATTERNS, 'Desktop Patterns', open)

      ctx.onMenu((value) => {
        if (value === 'close' && panel?.isConnected) void windows.requestClose(panel)
        else if (value === 'quit') void windows.closeAll(DESKTOP_PATTERNS)
        else if (value === 'arrange') windows.arrange()
      })
      ctx.gate(ctx.item('arrange'), () => !windows.arranged())
    },
  })
}
