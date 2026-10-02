// Desktop Patterns window: a preview well, a chooser of the kit's PATTERN_NAMES
// and a Set Desktop Pattern button. A cell click previews its pattern; only
// Set Desktop Pattern commits it.
//
// Every piece is a kit element. A cell is a vf-container pattern, a radio in
// the grid's radiogroup with a roving tab stop. Only the chosen cell takes
// focus, so the focus the window manager moves into an opened window lands on
// it. The chosen cell's ring is 1px black over its edge and 1px white inside,
// eight 1px vf-containers over the cell's own pattern, so the pattern keeps
// its phase.

import type { VfButton, VfContainer, VfGrid, VfWindow } from 'vintage-frames'
import { PATTERN_NAMES } from 'vintage-frames'
import type { Box } from 'vintage-frames/shell'
import markup from './windows.html?raw'
import { windowFrom } from '../windows.ts'

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

/** The panel, its choice seeded from `current`; Set Desktop Pattern calls
 *  `set` with the choice. */
export function patternsWindow(current: string, set: (pattern: string) => void): VfWindow {
  const win = windowFrom(markup)
  /** The pattern shown in the well and ringed in the grid. */
  let pending = current

  const ring = RING.map(({ pattern, ...box }) => {
    const strip = document.createElement('vf-container')
    Object.assign(strip, box)
    strip.pattern = pattern
    strip.setAttribute('aria-hidden', 'true')
    return strip
  })

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
    cell.addEventListener('click', () => pick(name, true))
    return cell
  })

  /** Shows `pending` in the well and rings its cell. */
  function render() {
    const well = win.querySelector('.patterns-well') as VfContainer
    well.pattern = pending
    well.setAttribute('aria-label', `preview: ${pending}`)
    for (const cell of cells) {
      const on = cell.dataset.pattern === pending
      cell.setAttribute('aria-checked', String(on))
      if (on) cell.tabIndex = 0
      else cell.removeAttribute('tabindex')
      if (on) cell.append(...ring)
    }
    // A pattern that isn't a named one rings nothing, so the first cell keeps
    // the tab stop.
    if (!cells.some((c) => c.tabIndex === 0) && cells[0]) cells[0].tabIndex = 0
  }

  function pick(name: string, focus = false) {
    pending = name
    render()
    if (focus) cells.find((c) => c.dataset.pattern === name)?.focus()
  }

  const grid = win.querySelector('.patterns-grid') as VfGrid
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
  const button = win.querySelector('.patterns-set') as VfButton
  button.addEventListener('click', () => set(pending))
  render()
  return win
}
