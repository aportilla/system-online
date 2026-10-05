// Font Viewer geometry (pure): the zoomed box for a font window.

import type { Box } from 'vintage-frames/shell/pure'

const FONT_EXPAND_PAD = 20
const FONT_EXPAND_MAX_WIDTH = 720
const FONT_EXPAND_MIN = 240

/**
 * A font window's zoomed box in the desktop's window area (below the menu
 * bar): inset FONT_EXPAND_PAD, at most FONT_EXPAND_MAX_WIDTH wide and
 * centered. Width and height are floored at FONT_EXPAND_MIN. Whole system px.
 */
export function expandedFontBox(area: Box): Box {
  const top = area.top + FONT_EXPAND_PAD
  const width = Math.max(FONT_EXPAND_MIN, Math.min(FONT_EXPAND_MAX_WIDTH, area.width - 2 * FONT_EXPAND_PAD))
  return {
    left: area.left + Math.max(0, Math.floor((area.width - width) / 2)),
    top,
    width,
    height: Math.max(FONT_EXPAND_MIN, area.top + area.height - FONT_EXPAND_PAD - top),
  }
}
