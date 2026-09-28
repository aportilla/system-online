// Desktop geometry (pure, no DOM): the landmarks, the window cascade, the
// nearness test and the nine-slice resize pin shared by windows and icons.
// Application-specific boxes and sizes live in src/apps/<id>/layout.ts.
//
// Nine-slice resize rule (pinOf / pinTo): a frame is the raster below a
// reserve band, cut by four outer bands into nine slices. An edge in an outer
// band is a strut and keeps its offset from that raster edge. An edge in the
// middle is a spring and keeps its fraction of the middle. Nothing clamps, so
// the same pin always maps back exactly. Callers keep the unrounded pin between
// resize events. Re-reading it from snapped geometry on every resize ratchets
// boxes across the screen.

export interface Point {
  left: number
  top: number
}
export interface Size {
  width: number
  height: number
}
export interface Box extends Point, Size {}

/** The band the menu bar reserves. Windows and icons keep clear of it. */
export const MENU_BAR = 20

/** The band reserved above windows. */
export const TOP_RESERVE = MENU_BAR

/** Where an application's first window opens, and the base of every window
 *  cascade. */
export const WINDOW_ORIGIN: Point = { left: 40, top: TOP_RESERVE + 20 }

export const CASCADE_STEP = 24
export const CASCADE_SLOTS = 5

/** Cascade slot `i` of `base`, wrapping past CASCADE_SLOTS. */
export function cascadeSlot(base: Point, i: number): Point & { slot: number } {
  const slot = i % CASCADE_SLOTS
  return {
    left: base.left + CASCADE_STEP * slot,
    top: base.top + CASCADE_STEP * slot,
    slot,
  }
}

/**
 * The first cascade slot from `base` not held by a window in `occupied`
 * (top-lefts). A window within half a step of a slot holds it, which absorbs
 * snapping and clamping.
 */
export function cascadeFrom(base: Point, occupied: Point[]): Point & { slot: number } {
  const near = CASCADE_STEP / 2
  for (let i = 0; i < CASCADE_SLOTS; i++) {
    const s = cascadeSlot(base, i)
    const held = occupied.some(
      (o) => Math.abs(o.left - s.left) < near && Math.abs(o.top - s.top) < near
    )
    if (!held) return s
  }
  return cascadeSlot(base, occupied.length % CASCADE_SLOTS)
}

/**
 * A box of `size` centered in the open area below TOP_RESERVE. The top-left
 * floors at TOP_RESERVE and 0. Whole system px.
 */
export function centeredBox(desktopW: number, desktopH: number, size: Size): Box {
  return {
    left: Math.max(0, Math.floor((desktopW - size.width) / 2)),
    top: Math.max(
      TOP_RESERVE,
      TOP_RESERVE + Math.floor((desktopH - TOP_RESERVE - size.height) / 2)
    ),
    width: size.width,
    height: size.height,
  }
}

/**
 * A box of `size` on cascade slot `n` from WINDOW_ORIGIN, `n` being the
 * windows of its kind open before this one. The top-left is pulled in to fit
 * the raster, but not above TOP_RESERVE or left of 0. Whole system px.
 */
export function cascadedBox(desktopW: number, desktopH: number, size: Size, n = 0): Box {
  const slot = cascadeSlot(WINDOW_ORIGIN, n)
  return {
    left: Math.max(0, Math.min(slot.left, Math.max(0, desktopW - size.width))),
    top: Math.max(
      TOP_RESERVE,
      Math.min(slot.top, Math.max(TOP_RESERVE, desktopH - size.height))
    ),
    width: size.width,
    height: size.height,
  }
}

/** nearBox's edge tolerance in system px. Larger than a lattice snap (2 or 4),
 *  smaller than a real move. */
export const NEAR = 10

/** Whether each of the four edges of `box` is within `tol` of `target`'s. */
export function nearBox(box: Box, target: Box, tol = NEAR): boolean {
  return (
    Math.abs(box.left - target.left) <= tol &&
    Math.abs(box.top - target.top) <= tol &&
    Math.abs(box.left + box.width - (target.left + target.width)) <= tol &&
    Math.abs(box.top + box.height - (target.top + target.height)) <= tol
  )
}

// Nine-slice resize rule.
/** The minimum outer slice thickness in system px. The middle is the remainder. */
export const BAND = 100

/** `reserve` is the chrome band above the open area (the pin's y = 0 line).
 *  `bands` is each outer slice's thickness in system px. */
export interface Frame {
  reserve: number
  bands: { left: number; top: number; right: number; bottom: number }
}

/**
 * The frame shared by every window: below TOP_RESERVE, with outer slices at
 * least BAND thick. An application may widen `left`, `top` and `right`
 * (setFrameBands in shell/windows.ts).
 */
export function windowFrame({
  left = BAND,
  top = BAND,
  right = BAND,
}: { left?: number; top?: number; right?: number } = {}): Frame {
  return {
    reserve: TOP_RESERVE,
    bands: {
      left: Math.max(BAND, left),
      top: Math.max(BAND, top),
      right: Math.max(BAND, right),
      bottom: BAND,
    },
  }
}

/** A resize policy per axis (pinTo). `size` fixes an axis at its live size.
 *  `min` floors a resizable axis. */
export interface Policy {
  size?: { width?: number; height?: number }
  min?: { width?: number; height?: number }
}
/** near: v is the offset from the span's start. far: the offset from its end.
 *  spring: the unrounded fraction of the middle. */
export interface EdgePin {
  kind: 'near' | 'far' | 'spring'
  v: number
}
/** Per axis, the near edge (left or top) then the far edge (right or bottom). */
export interface Pin {
  x: [EdgePin, EdgePin]
  y: [EdgePin, EdgePin]
}

/** Whether `p` has a pin's shape. Pins are stored in desktop state. A stale or
 *  garbled record must read as none, so pinTo never throws. */
export function isPin(p: unknown): p is Pin {
  const edge = (e: unknown): boolean => {
    const x = e as EdgePin | null
    return (
      !!x &&
      (x.kind === 'near' || x.kind === 'far' || x.kind === 'spring') &&
      Number.isFinite(x.v)
    )
  }
  const axis = (a: unknown): boolean =>
    Array.isArray(a) && a.length === 2 && edge(a[0]) && edge(a[1])
  const q = p as Pin | null
  return !!q && typeof q === 'object' && axis(q.x) && axis(q.y)
}

/** Classifies edge `v` on a span `s` with near band `n` and far band `f`.
 *  Near is tested first, so where the bands overlap an edge reads near. An
 *  edge outside the span is a strut with a negative offset. A spring's
 *  fraction is always in [0, 1). */
function edgePin(v: number, s: number, n: number, f: number): EdgePin {
  if (v < n) return { kind: 'near', v }
  if (v >= s - f) return { kind: 'far', v: s - v }
  return { kind: 'spring', v: (v - n) / Math.max(1, s - n - f) }
}

/** An edge pin re-expressed on a span `s`. It is continuous at both slice
 *  boundaries. Where the bands overlap, every spring maps to `n`. */
function edgeTo(pin: EdgePin, s: number, n: number, f: number): number {
  if (pin.kind === 'near') return pin.v
  if (pin.kind === 'far') return s - pin.v
  return n + pin.v * Math.max(0, s - n - f)
}

/** Resolves one axis. For a fixed `size`, or a mapped size below `min`, the
 *  anchor rule places it: a near strut holds, else a far strut, else the
 *  center. */
function resolveAxis(
  pins: [EdgePin, EdgePin],
  s: number,
  n: number,
  f: number,
  { size, min = 0 }: { size?: number; min?: number }
): { a: number; size: number } {
  const a = edgeTo(pins[0], s, n, f)
  const b = edgeTo(pins[1], s, n, f)
  let fixed = size
  if (fixed == null) {
    if (b - a >= min) return { a, size: b - a }
    fixed = min
  }
  if (pins[0].kind !== 'spring') return { a, size: fixed }
  if (pins[1].kind !== 'spring') return { a: b - fixed, size: fixed }
  return { a: (a + b) / 2 - fixed / 2, size: fixed }
}

/** A box's nine-slice pin on `raster` in `frame`: each edge classified as a
 *  strut or a spring, with its offset or fraction. */
export function pinOf(box: Box, raster: Size, frame: Frame): Pin {
  const { reserve, bands } = frame
  const sw = raster.width
  const sh = raster.height - reserve
  const top = box.top - reserve
  return {
    x: [
      edgePin(box.left, sw, bands.left, bands.right),
      edgePin(box.left + box.width, sw, bands.left, bands.right),
    ],
    y: [
      edgePin(top, sh, bands.top, bands.bottom),
      edgePin(top + box.height, sh, bands.top, bands.bottom),
    ],
  }
}

/**
 * `pin` re-expressed on `raster` as a box, in the frame it was read in. The
 * policy applies per axis. An axis with `size` resolves as fixed through the
 * anchor rule. An axis with `min`, or neither, resolves as resizable. Rounded
 * to whole system px. Callers snap to their lattice and cap oversize boxes.
 */
export function pinTo(pin: Pin, raster: Size, frame: Frame, { size, min }: Policy = {}): Box {
  const { reserve, bands } = frame
  const x = resolveAxis(pin.x, raster.width, bands.left, bands.right, {
    size: size?.width,
    min: min?.width,
  })
  const y = resolveAxis(pin.y, raster.height - reserve, bands.top, bands.bottom, {
    size: size?.height,
    min: min?.height,
  })
  return {
    left: Math.round(x.a),
    top: Math.round(reserve + y.a),
    width: Math.round(x.size),
    height: Math.round(y.size),
  }
}
