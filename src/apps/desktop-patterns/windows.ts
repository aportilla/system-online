// Desktop Patterns window: at most one, cloned from #tpl-patterns-window. A
// preview well, a chooser of the kit's PATTERN_NAMES and a Set Desktop Pattern
// button. A cell click previews its pattern; only Set Desktop Pattern commits
// it. Only the chosen pattern persists (shell/desktop-pattern.ts).
//
// Every piece is a kit element. A cell is a vf-container pattern, a radio in
// the grid's radiogroup with a roving tab stop. The chosen cell's ring is 1px
// black over its edge and 1px white inside, eight 1px vf-containers over the
// cell's own pattern, so the pattern keeps its phase. Each strip states its
// pattern: an unpatterned vf-container paints the pattern it inherits.

import type { VfButton, VfContainer, VfDesktop, VfGrid, VfWindow } from 'vintage-frames'
import { PATTERN_NAMES } from 'vintage-frames'
import markup from './windows.html?raw'
import { shell, DESKTOP_PATTERNS } from '../../state/shell.ts'
import { centeredBox } from '../../shell/layout.ts'
import type { Box } from '../../shell/layout.ts'
import { cloneWindow, parseWindows, windowTemplate } from '../../shell/windows.ts'
import type { WindowManager } from '../../shell/windows.ts'

/** A chooser cell's edge in system px. */
const CELL = 16
/** The ring's strips inside a cell: black on the edge, white one pixel in. */
const RING: (Box & { pattern: 'black' | 'white' })[] = [
  { left: 0, top: 0, width: CELL, height: 1, pattern: 'black' },
  { left: 0, top: CELL - 1, width: CELL, height: 1, pattern: 'black' },
  { left: 0, top: 1, width: 1, height: CELL - 2, pattern: 'black' },
  { left: CELL - 1, top: 1, width: 1, height: CELL - 2, pattern: 'black' },
  { left: 1, top: 1, width: CELL - 2, height: 1, pattern: 'white' },
  { left: 1, top: CELL - 2, width: CELL - 2, height: 1, pattern: 'white' },
  { left: 1, top: 2, width: 1, height: CELL - 4, pattern: 'white' },
  { left: CELL - 2, top: 2, width: 1, height: CELL - 4, pattern: 'white' },
]

export function initPatternsWindow(desktop: VfDesktop, windows: WindowManager) {
  const tpl = windowTemplate(parseWindows(markup), 'tpl-patterns-window')
  /** The open panel. */
  let win: VfWindow | null = null
  /** The pattern shown in the well and ringed in the grid. */
  let pending = shell.get().desktopPattern

  // The kit's close box fires vf-close but does not remove the window.
  const onClose = (e: Event) => {
    if (e.target === win) close()
  }

  const ring = RING.map(({ pattern, ...box }) => {
    const strip = document.createElement('vf-container')
    Object.assign(strip, box)
    strip.pattern = pattern
    strip.setAttribute('aria-hidden', 'true')
    return strip
  })

  const cellsOf = (w: VfWindow) => [...w.querySelectorAll<VfContainer>('.patterns-cell')]

  /** Shows `pending` in the well and rings its cell. */
  function render(w: VfWindow) {
    const well = w.querySelector('.patterns-well') as VfContainer
    well.pattern = pending
    well.setAttribute('aria-label', `preview: ${pending}`)
    for (const cell of cellsOf(w)) {
      const on = cell.dataset.pattern === pending
      cell.setAttribute('aria-checked', String(on))
      cell.tabIndex = on ? 0 : -1
      if (on) cell.append(...ring)
    }
    // A pattern that isn't a named one rings nothing, so the first cell keeps
    // the tab stop.
    if (!cellsOf(w).some((c) => c.tabIndex === 0)) {
      const first = cellsOf(w)[0]
      if (first) first.tabIndex = 0
    }
  }

  function pick(name: string, focus = false) {
    if (!win) return
    pending = name
    render(win)
    if (focus) cellsOf(win).find((c) => c.dataset.pattern === name)?.focus()
  }

  function fill(w: VfWindow) {
    const grid = w.querySelector('.patterns-grid') as VfGrid
    const cells = PATTERN_NAMES.map((name) => {
      const cell = document.createElement('vf-container')
      cell.className = 'patterns-cell'
      cell.dataset.pattern = name
      cell.width = CELL
      cell.height = CELL
      cell.pattern = name
      cell.setAttribute('role', 'radio')
      cell.setAttribute('aria-label', `${name} pattern`)
      cell.title = name
      cell.addEventListener('click', () => pick(name))
      return cell
    })
    // Arrow keys move the choice through the grid in reading order.
    grid.addEventListener('keydown', (e) => {
      const i = cells.findIndex((c) => c.dataset.pattern === pending)
      const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 13, ArrowLeft: -1, ArrowUp: -13 }
      const d = step[e.key]
      if (d == null) return
      e.preventDefault()
      const next = cells[Math.min(cells.length - 1, Math.max(0, (i < 0 ? 0 : i) + d))]
      if (next?.dataset.pattern) pick(next.dataset.pattern, true)
    })
    grid.replaceChildren(...cells)
    const set = w.querySelector('.patterns-set') as VfButton
    set.addEventListener('click', () => shell.setDesktopPattern(pending))
  }

  function open() {
    if (win) {
      desktop.bringToFront(win)
      return
    }
    // Each open seeds the choice from the desktop's current pattern.
    pending = shell.get().desktopPattern
    win = cloneWindow(tpl)
    win.id = 'win-patterns'
    win.addEventListener('vf-close', onClose)
    fill(win)
    render(win)
    // Append before adopt: the clamp reads the raster's lattice from a
    // connected element.
    desktop.append(win)
    const size = { width: win.width ?? 0, height: win.height ?? 0 }
    windows.adopt(win, { app: DESKTOP_PATTERNS, place: (w, h) => centeredBox(w, h, size) })
    // bringToFront syncs the DOM order with the z-order and activates the window.
    desktop.bringToFront(win)
  }

  // Opened from a menu, so it has no icon to close into: it goes at once. A
  // pattern chosen but not set is discarded.
  function close() {
    if (!win) return
    win.removeEventListener('vf-close', onClose)
    void windows.dismiss(win) // the kit picks the next active window
    win = null
  }

  return {
    open,
    close,
    dispose(): void {
      close()
    },
  }
}
