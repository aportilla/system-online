// Finder geometry (pure): the icon lattices, the Trash's default position, the
// icons' resize frame and the folder window's measurements.

import { BAND, MENU_BAR } from '../../shell/layout.ts'
import type { Frame, Point, Size } from '../../shell/layout.ts'

// Lattice pitches, shared by every container.
const ICON_ROW_PITCH = 72
const ICON_COL_PITCH = 80 // the 64px icon plate + a 16px gutter
// Inset from the raster's right and bottom edges, for the desktop lattice and
// the Trash.
const ICON_EDGE = 16
const ICON_TOP = MENU_BAR + ICON_EDGE
/** An icon's 64px plate, label included. Also the margin icons.ts clamps by. */
export const ICON_CELL = 64

/** A container's icon grid. left and top locate cell (0,0). dx is negative
 *  when columns run left. cols or rows is Infinity when unbounded. down fills
 *  a column at a time, otherwise a row at a time. */
export interface Lattice {
  left: number
  top: number
  dx: number
  dy: number
  cols: number
  rows: number
  down: boolean
}

/**
 * The desktop's lattice on a desktopW × desktopH raster: cell (0,0) at the
 * top right, columns running left, rows down to the bottom inset. Always at
 * least one row and one column.
 */
export function desktopLattice(desktopW: number, desktopH: number): Lattice {
  const left = Math.max(0, desktopW - ICON_EDGE - ICON_CELL)
  return {
    left,
    top: ICON_TOP,
    dx: -ICON_COL_PITCH,
    dy: ICON_ROW_PITCH,
    cols: Math.floor(left / ICON_COL_PITCH) + 1,
    rows: Math.max(
      1,
      Math.floor((desktopH - ICON_TOP - ICON_CELL - ICON_EDGE) / ICON_ROW_PITCH) + 1
    ),
    down: true,
  }
}

/** Top-left of cell (`col`, `row`). Not bounded to the lattice's extent. */
export function latticeCell(grid: Lattice, col: number, row: number): Point {
  return { left: grid.left + col * grid.dx, top: grid.top + row * grid.dy }
}

/** The position of cell number `slot` in the lattice's fill order. The icon
 *  layer walks slots to find the first free cell. */
export function latticeSlot(grid: Lattice, slot: number): Point {
  const major = grid.down ? grid.rows : grid.cols
  const a = Math.floor(slot / major)
  const b = slot % major
  return grid.down ? latticeCell(grid, a, b) : latticeCell(grid, b, a)
}

/**
 * Compares two positions in the lattice's fill order. Negative when `a` comes
 * first. Clean Up walks icons in this order. Each position is rounded to its
 * nearest cell, so a pixel of drift still sorts correctly.
 */
export function fillOrder(grid: Lattice, a: Point, b: Point): number {
  const col = (p: Point) => Math.round((p.left - grid.left) / grid.dx)
  const row = (p: Point) => Math.round((p.top - grid.top) / grid.dy)
  return grid.down ? col(a) - col(b) || row(a) - row(b) : row(a) - row(b) || col(a) - col(b)
}

/** Rounds `v` to a cell index clamped to [0, n - 1]. */
const cellIndex = (v: number, n: number) => Math.min(Math.max(Math.round(v), 0), n - 1)

/**
 * Snaps a container's icons onto its lattice (Special → Clean Up). Each icon
 * takes the free cell nearest its position, searching square rings outward
 * from its rounded, clamped cell. Icons beyond the cell count stack on their
 * ideal cells. Returns one position per input, in input order.
 */
export function cleanUp(grid: Lattice, positions: Point[]): Point[] {
  const ideal = positions.map((p) => ({
    col: cellIndex((p.left - grid.left) / grid.dx, grid.cols),
    row: cellIndex((p.top - grid.top) / grid.dy, grid.rows),
  }))
  const at = (i: number) => ideal[i] as { col: number; row: number }
  const order = positions
    .map((_, i) => i)
    .sort((a, b) => at(a).row - at(b).row || at(a).col - at(b).col || a - b)
  const taken = new Set<string>()
  // Search radius cap, bounded by the lattice size and the icon count.
  const reach =
    Math.min(grid.cols, positions.length + 1) + Math.min(grid.rows, positions.length + 1)
  const out: Point[] = []
  for (const i of order) {
    const want = at(i)
    const pos = positions[i] as Point
    let best = want
    for (let r = 0; r <= reach; r++) {
      let found: { col: number; row: number } | null = null
      let nearest = Infinity
      for (let col = want.col - r; col <= want.col + r; col++) {
        for (let row = want.row - r; row <= want.row + r; row++) {
          const ring = Math.max(Math.abs(col - want.col), Math.abs(row - want.row))
          if (ring !== r) continue // only cells on ring r
          if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue
          if (taken.has(`${col},${row}`)) continue
          const cell = latticeCell(grid, col, row)
          const d = (cell.left - pos.left) ** 2 + (cell.top - pos.top) ** 2
          if (d < nearest) {
            nearest = d
            found = { col, row }
          }
        }
      }
      if (found) {
        best = found
        break
      }
    }
    taken.add(`${best.col},${best.row}`)
    out[i] = latticeCell(grid, best.col, best.row)
  }
  return out
}

/** The Trash's default position: the raster's bottom-right cell, inset
 *  ICON_EDGE. The top is floored at MENU_BAR. */
export function trashDefault(desktopW: number, desktopH: number): Point {
  return {
    left: Math.max(0, desktopW - ICON_EDGE - ICON_CELL),
    top: Math.max(MENU_BAR, desktopH - ICON_EDGE - ICON_CELL),
  }
}

/** The icons' resize frame: the desktop below the menu bar, in uniform bands. */
export const ICON_FRAME: Frame = {
  reserve: MENU_BAR,
  bands: { left: BAND, top: BAND, right: BAND, bottom: BAND },
}

// Folder windows. windows.html repeats FOLDER_STRIP and FOLDER_COUNT_AT.
const FOLDER_COUNT_PAPER = 17 // rows of paper above the divider
/** A top of 2 puts the body face's digits on rows 5–11. */
export const FOLDER_COUNT_AT: Point = { left: 8, top: 2 }
/** The count line's height: its paper plus its bottom rule. */
export const FOLDER_COUNT_LINE = FOLDER_COUNT_PAPER + 1
/** The header's height: the count line, a white row and the header's rule. */
export const FOLDER_STRIP = FOLDER_COUNT_LINE + 1 + 1
/** The trash mark before the count in the Trash's window and trashed folders.
 *  Its ink starts in column 1, so it sits 1px left of the count's inset. */
export const FOLDER_TRASH_MARK: Size = { width: 12, height: 12 }
export const FOLDER_TRASH_MARK_AT: Point = {
  left: FOLDER_COUNT_AT.left - 1,
  top: FOLDER_COUNT_AT.top,
}
export const FOLDER_COUNT_AT_TRASHED: Point = {
  left: FOLDER_TRASH_MARK_AT.left + FOLDER_TRASH_MARK.width + 3,
  top: FOLDER_COUNT_AT.top,
}
// 1px borders, the 18px title bar, the header and the kit's 15px scroll rails,
// in system px. Re-derive if the kit's chrome changes.
const FOLDER_CHROME = { w: 2 + 15, h: 1 + 18 + FOLDER_STRIP + 15 + 1 }
const GRID_INSET = 16

/** A folder window body's inner box, the plane's viewport, for the window's
 *  outer size. */
export function folderViewport(size: Size): Size {
  return {
    width: Math.max(0, size.width - FOLDER_CHROME.w),
    height: Math.max(0, size.height - FOLDER_CHROME.h),
  }
}

/** A folder window's lattice for a plane `innerWidth` wide: rows from the
 *  inset, wrapping at the width, unbounded downward. */
export function folderLattice(innerWidth: number): Lattice {
  return {
    left: GRID_INSET,
    top: GRID_INSET,
    dx: ICON_COL_PITCH,
    dy: ICON_ROW_PITCH,
    cols: Math.max(1, Math.floor((innerWidth - GRID_INSET - ICON_CELL) / ICON_COL_PITCH) + 1),
    rows: Infinity,
    down: false,
  }
}

/** A folder field's box: at least the viewport, grown to hold every icon
 *  (`positions`, their top-lefts) plus the inset. The kit sizes the scroll
 *  range to it. */
export function fieldExtent(positions: Point[], viewport: Size): Size {
  let width = viewport.width
  let height = viewport.height
  for (const p of positions) {
    width = Math.max(width, p.left + ICON_CELL + GRID_INSET)
    height = Math.max(height, p.top + ICON_CELL + GRID_INSET)
  }
  return { width, height }
}
