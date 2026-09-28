// Text Viewer geometry (pure): the zoomed box for a read-me window.

import { MENU_BAR } from '../../shell/layout.ts'
import type { Box } from '../../shell/layout.ts'

const TEXT_EXPAND_PAD = 20
const TEXT_EXPAND_MAX_WIDTH = 520
const TEXT_EXPAND_MIN = 220

/**
 * A text window's zoomed box on a desktopW × desktopH raster: below the menu
 * bar, inset TEXT_EXPAND_PAD, at most TEXT_EXPAND_MAX_WIDTH wide and centered.
 * Width and height are floored at TEXT_EXPAND_MIN. Whole system px.
 */
export function expandedTextBox(desktopW: number, desktopH: number): Box {
  const top = MENU_BAR + TEXT_EXPAND_PAD
  const width = Math.max(TEXT_EXPAND_MIN, Math.min(TEXT_EXPAND_MAX_WIDTH, desktopW - 2 * TEXT_EXPAND_PAD))
  return {
    left: Math.max(0, Math.floor((desktopW - width) / 2)),
    top,
    width,
    height: Math.max(TEXT_EXPAND_MIN, desktopH - TEXT_EXPAND_PAD - top),
  }
}
