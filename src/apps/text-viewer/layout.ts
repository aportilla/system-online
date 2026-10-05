// Text Viewer geometry (pure): the zoomed box for a read-me window.

import type { Box } from 'vintage-frames/shell/pure'

const TEXT_EXPAND_PAD = 20
const TEXT_EXPAND_MAX_WIDTH = 520
const TEXT_EXPAND_MIN = 220

/**
 * A text window's zoomed box in the desktop's window area (below the menu
 * bar): inset TEXT_EXPAND_PAD, at most TEXT_EXPAND_MAX_WIDTH wide and
 * centered. Width and height are floored at TEXT_EXPAND_MIN. Whole system px.
 */
export function expandedTextBox(area: Box): Box {
  const top = area.top + TEXT_EXPAND_PAD
  const width = Math.max(TEXT_EXPAND_MIN, Math.min(TEXT_EXPAND_MAX_WIDTH, area.width - 2 * TEXT_EXPAND_PAD))
  return {
    left: area.left + Math.max(0, Math.floor((area.width - width) / 2)),
    top,
    width,
    height: Math.max(TEXT_EXPAND_MIN, area.top + area.height - TEXT_EXPAND_PAD - top),
  }
}
