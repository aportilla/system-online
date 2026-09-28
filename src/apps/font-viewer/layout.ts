// Font Viewer geometry (pure): the zoomed box for a font window.

import { MENU_BAR } from '../../shell/layout.ts'
import type { Box } from '../../shell/layout.ts'

const FONT_EXPAND_PAD = 20
const FONT_EXPAND_MAX_WIDTH = 720
const FONT_EXPAND_MIN = 240

/**
 * A font window's zoomed box on a desktopW × desktopH raster: below the menu
 * bar, inset FONT_EXPAND_PAD, at most FONT_EXPAND_MAX_WIDTH wide and centered.
 * Width and height are floored at FONT_EXPAND_MIN. Whole system px.
 */
export function expandedFontBox(desktopW: number, desktopH: number): Box {
  const top = MENU_BAR + FONT_EXPAND_PAD
  const width = Math.max(FONT_EXPAND_MIN, Math.min(FONT_EXPAND_MAX_WIDTH, desktopW - 2 * FONT_EXPAND_PAD))
  return {
    left: Math.max(0, Math.floor((desktopW - width) / 2)),
    top,
    width,
    height: Math.max(FONT_EXPAND_MIN, desktopH - FONT_EXPAND_PAD - top),
  }
}
