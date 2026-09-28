// Window manager: adoption, the front application, the resize rule and
// Arrange Windows. Applications own their windows (src/apps/<id>/windows.ts)
// and declare them here through adopt().
//
// - adopt() takes the window's app, placement (`place`), saved pin (`pin`),
//   resize policy, kept box (`keep`) and catalog item (`item`). The owner
//   appends the node, and closes it with dismiss(), which releases and
//   removes it.
// - shell.frontApp follows the desktop's vf-activate event: the active window's
//   app, or the Finder when none is active. beforeFront listeners run first.
// - On a raster resize every adopted window is re-pinned with the nine-slice
//   pin (layout.ts pinOf/pinTo); onRaster passes the change on.
// - arrange() runs each app's arrangement group and re-applies every `place`;
//   arranged() reports whether the screen already matches.

import { snapSys, systemPxQuantum, VfWindow } from 'vintage-frames'
import type { VfDesktop, VfViewportBox } from 'vintage-frames'
import { shell, FINDER } from '../state/shell.ts'
import type { AppId } from '../state/shell.ts'
import {
  cascadeFrom,
  nearBox,
  pinOf,
  pinTo,
  TOP_RESERVE,
  WINDOW_ORIGIN,
  windowFrame,
} from './layout.ts'
import type { Box, Pin, Policy, Size } from './layout.ts'
import type { WindowRecord } from './desktop-state.ts'

// vf-window's grow floor (MIN_WIDTH × MIN_HEIGHT). The kit does not export it.
const KIT_MIN_WIDTH = 80
const KIT_MIN_HEIGHT = 54

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** A box to write, any edge optional. */
export interface BoxInput {
  left?: number
  top?: number
  width?: number
  height?: number
}

/** A placement: a position, and a size where one is stated. */
export interface Placed extends BoxInput {
  left: number
  top: number
}

/** A window's live box, with an undeclared edge read as 0. */
const boxOf = (win: VfWindow): Box => ({
  left: win.left ?? 0,
  top: win.top ?? 0,
  width: win.width ?? 0,
  height: win.height ?? 0,
})

/**
 * The box a placement would write for `g` on `win`. The position snaps to the
 * window's system-px lattice and is clamped onto the raster below TOP_RESERVE.
 * A resizable window's size is first capped at the open area, so its grow box
 * stays reachable.
 */
export function clampedBox(desktop: VfDesktop, win: VfWindow, g: BoxInput): Placed {
  const k = systemPxQuantum(win)
  const down = (v: number) => Math.floor(v / k) * k
  const up = (v: number) => Math.ceil(v / k) * k
  const minTop = up(TOP_RESERVE)
  let { width, height } = g
  if (win.resizable) {
    if (width != null && Number.isFinite(width)) width = Math.min(width, down(desktop.width))
    if (height != null && Number.isFinite(height))
      height = Math.min(height, down(Math.max(0, desktop.height - minTop)))
  }
  const w = width ?? 0
  const h = height ?? 0
  const left = clamp(snapSys(g.left ?? 0, win), 0, Math.max(0, down(desktop.width - w)))
  const top = clamp(snapSys(g.top ?? minTop, win), minTop, Math.max(minTop, down(desktop.height - h)))
  return { left, top, width, height }
}

/**
 * Parses an application's windows.html into a host element of this document,
 * with every custom element upgraded so a window takes properties before it
 * is appended. Template content stays inert until cloneWindow.
 */
export function parseWindows(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  customElements.upgrade(host)
  return host
}

/** A template of parseWindows's host by id. Throws when the markup drifts. */
export function windowTemplate(host: HTMLElement, id: string): HTMLTemplateElement {
  const tpl = host.querySelector(`#${id}`)
  if (!(tpl instanceof HTMLTemplateElement)) throw new Error(`windows: missing template ${id}`)
  return tpl
}

/**
 * A window cloned from its template and upgraded, ready for properties.
 * importNode, not cloneNode: customElements.upgrade() is a no-op on nodes
 * still owned by the template's document. On an un-upgraded element, Lit
 * applies a property only at its first update, after connectedCallback.
 */
export function cloneWindow(tpl: HTMLTemplateElement): VfWindow {
  const win = document.importNode(tpl.content.firstElementChild as Element, true) as VfWindow
  customElements.upgrade(win)
  return win
}

/** Options for adopt(). */
export interface AdoptOptions {
  /** The application shown while the window is active. */
  app?: AppId
  /** Maps a raster `(desktopW, desktopH)` to the window's box. adopt() and
   *  arrange() apply it. Without one the owner places the window. */
  place?: ((w: number, h: number) => Box) | null
  /** A saved pin to open at instead (fromPin). */
  pin?: Pin | null
  /** Its resize policy (layout.ts pinTo). The default is policyOf. */
  policy?: ((cur: Box) => Policy) | null
  /** A box held across raster resizes while the window is near it. */
  keep?: ((w: number, h: number) => Box) | null
  /** The catalog item it shows (isOpen, onWindows). */
  item?: string | null
}

interface Adoption {
  app: AppId
  place: ((w: number, h: number) => Box) | null
  policy: ((cur: Box) => Policy) | null
  keep: ((w: number, h: number) => Box) | null
  item: string | null
}

/** An application's arrangement group (see arrangeWith). */
export interface ArrangeGroup {
  arrange(): void
  arranged(): boolean
}

type RasterListener = (before: Size, after: Size) => void

export function initWindows(desktop: VfDesktop) {
  const unsubs: (() => void)[] = []
  const raster = (): Size => ({ width: desktop.width, height: desktop.height })

  const adopted = new Map<VfWindow, Adoption>()
  const groups = new Map<AppId, ArrangeGroup>()
  /** Per-window unrounded pin and the geometry the re-pin last wrote. The pin
   *  is re-read only when that geometry no longer matches. Re-reading it from
   *  snapped geometry on every resize ratchets windows down the screen. */
  let pins = new WeakMap<VfWindow, { pin: Pin } & Box>()
  /** The frame every window's pin is read in (see setFrameBands). */
  let frame = windowFrame()

  // Signals.
  /** Layout signal (onLayout): fires after every geometry write, drag release,
   *  grow commit and layoutChanged(). Suppressed while arrange() writes. */
  const layoutListeners = new Set<() => void>()
  let holding = false
  const notifyLayout = () => {
    if (holding) return
    for (const fn of [...layoutListeners]) fn()
  }
  /** Window set signal (onWindows): a window with a catalog item opened or
   *  closed. */
  const windowListeners = new Set<() => void>()
  const notifyWindows = () => {
    for (const fn of [...windowListeners]) fn()
  }
  const rasterListeners = new Set<RasterListener>()
  const frontListeners = new Set<(win: HTMLElement | null) => void>()

  // Placement.
  /** Writes a placement and drops the pin record, so the next resize re-reads
   *  the pin. */
  const writeBox = (win: VfWindow, g: Placed) => {
    win.left = snapSys(g.left, win)
    win.top = snapSys(g.top, win)
    if (g.width != null && Number.isFinite(g.width)) win.width = g.width
    if (g.height != null && Number.isFinite(g.height)) win.height = g.height
    pins.delete(win)
  }
  /** An adopted window's `place` on the live raster, clamped, or null. */
  const placedBox = (win: VfWindow) => {
    const place = adopted.get(win)?.place
    return place ? clampedBox(desktop, win, place(desktop.width, desktop.height)) : null
  }
  const placeAdopted = (win: VfWindow) => {
    const g = placedBox(win)
    if (g) writeBox(win, g)
  }
  /** The resize policy for `win` at its live box `cur`. pinTo applies it. A
   *  floor applied after the write reads as a move on the next resize, and the
   *  pin drifts. */
  const policyOf = (win: VfWindow, cur: Box): Policy => {
    const declared = adopted.get(win)?.policy
    if (declared) return declared(cur)
    return win.resizable
      ? { min: { width: KIT_MIN_WIDTH, height: KIT_MIN_HEIGHT } }
      : { size: { width: cur.width, height: cur.height } }
  }
  /** A saved pin re-expressed on the current raster, then clamped. */
  const pinnedBox = (win: VfWindow, pin: Pin) =>
    clampedBox(desktop, win, pinTo(pin, raster(), frame, policyOf(win, boxOf(win))))
  /** Whether `win` sits exactly at every edge `g` states. */
  const at = (win: VfWindow, g: BoxInput) => {
    const live = boxOf(win)
    return (['left', 'top', 'width', 'height'] as const).every((k) => {
      const v = g[k]
      return v == null || !Number.isFinite(v) || live[k] === v
    })
  }

  // Front application. beforeFront listeners run before shell.setFrontApp.
  const appOf = (win: HTMLElement | null): AppId =>
    (win instanceof VfWindow && adopted.get(win)?.app) || FINDER
  const applyActive = (win: HTMLElement | null) => {
    for (const fn of [...frontListeners]) fn(win)
    shell.setFrontApp(appOf(win))
  }
  const onActivate = (e: Event) =>
    applyActive((e as CustomEvent<{ window: HTMLElement | null }>).detail.window)
  desktop.addEventListener('vf-activate', onActivate)
  unsubs.push(() => desktop.removeEventListener('vf-activate', onActivate))
  // Start from desktop.activeWindow, which is non-null after an HMR teardown.
  applyActive(desktop.activeWindow)

  // Deactivation. A press targeting the desktop itself (its bezel) clears the
  // active window. Presses in slotted children target the child. The Finder's
  // icon field handles its own in apps/finder/icons.ts.
  const onDesktopPress = (e: Event) => {
    if (e.target === desktop) desktop.clearActive()
  }
  desktop.addEventListener('pointerdown', onDesktopPress)
  unsubs.push(() => desktop.removeEventListener('pointerdown', onDesktopPress))

  // Resize rule.
  /** Re-pins one window from the `before` raster to `after`. */
  const repin = (win: VfWindow, before: Size, after: Size) => {
    const cur = boxOf(win)
    // A window near its `keep` box on the old raster gets that box on the new one.
    const keep = adopted.get(win)?.keep
    if (keep && nearBox(cur, keep(before.width, before.height))) {
      writeBox(win, keep(after.width, after.height))
      return
    }
    let rec = pins.get(win)
    // Re-read the pin if the window has no record or has moved. A resizable
    // window whose size changed is re-read too, or its far edge would jump. A
    // fixed-size window's size is owner-derived and does not count.
    const sized = !!rec && win.resizable && (rec.width !== cur.width || rec.height !== cur.height)
    const moved = !rec || rec.left !== cur.left || rec.top !== cur.top || sized
    const pin = moved || !rec ? pinOf(cur, before, frame) : rec.pin
    const g = pinTo(pin, after, frame, policyOf(win, cur))
    win.left = snapSys(g.left, win)
    win.top = snapSys(g.top, win)
    if (win.resizable) {
      // Cap the size at the open area, floor-snapped to the lattice, so the
      // grow box stays reachable. The pin is untouched.
      const k = systemPxQuantum(win)
      const minTop = Math.ceil(TOP_RESERVE / k) * k
      const maxW = Math.floor(after.width / k) * k
      const maxH = Math.floor(Math.max(0, after.height - minTop) / k) * k
      win.width = Math.min(snapSys(g.width, win), maxW)
      win.height = Math.min(snapSys(g.height, win), maxH)
    }
    pins.set(win, { pin, ...boxOf(win) })
  }

  /** Drops a window from the manager. */
  const release = (win: VfWindow) => {
    const a = adopted.get(win)
    if (!a) return
    adopted.delete(win)
    pins.delete(win)
    if (a.item != null) notifyWindows()
    notifyLayout()
  }

  // Gestures. A title-bar drag fires no event, so pointerup notifies layout a
  // task later, after the kit has updated. A grow ends with vf-resize
  // detail.commit.
  const onRelease = () => {
    setTimeout(notifyLayout, 0)
  }
  const onGrow = (e: Event) => {
    if ((e as CustomEvent<{ commit?: boolean }>).detail?.commit) notifyLayout()
  }
  desktop.addEventListener('vf-resize', onGrow)
  desktop.addEventListener('pointerup', onRelease)
  desktop.addEventListener('pointercancel', onRelease)
  unsubs.push(() => {
    desktop.removeEventListener('vf-resize', onGrow)
    desktop.removeEventListener('pointerup', onRelease)
    desktop.removeEventListener('pointercancel', onRelease)
  })

  return {
    /** Adopts a window. It must already be a slotted child of the desktop,
     *  since the clamp reads its lattice. If the window is already active, the
     *  front application is re-read. */
    adopt(
      win: VfWindow,
      { app = FINDER, place = null, pin = null, policy = null, keep = null, item = null }: AdoptOptions = {}
    ): void {
      adopted.set(win, { app, place, policy, keep, item })
      if (desktop.activeWindow === win) applyActive(win)
      if (pin) writeBox(win, pinnedBox(win, pin))
      else placeAdopted(win)
      if (item != null) notifyWindows()
      notifyLayout()
    },

    /** Closes a window into `to`, a viewport box, or at once without one, then
     *  releases and removes it. hide() reads the frame, so it runs first.
     *  Resolves when the zoom rects are done. */
    dismiss(win: VfWindow, to: VfViewportBox | null = null): Promise<boolean> {
      const landed = win.hide({ to })
      release(win)
      win.remove()
      return landed
    },

    /** Writes a box for a gesture the owner runs itself (a zoom, a restore, its
     *  group's arrange), then notifies layout. */
    write(win: VfWindow, box: Placed): void {
      writeBox(win, box)
      notifyLayout()
    },

    /** clampedBox for `win`: a placement's target, not written. */
    clamped(win: VfWindow, box: BoxInput) {
      return clampedBox(desktop, win, box)
    },

    /** The window's nine-slice pin on the current raster. An owner saves this
     *  to reopen the window on a later raster (fromPin). */
    pinOf(win: VfWindow): Pin {
      return pinOf(boxOf(win), raster(), frame)
    },

    /** A pin re-expressed on the live raster, then clamped. The window's own
     *  resize policy applies unless one is passed. */
    fromPin(win: VfWindow, pin: Pin, policy?: Policy) {
      return policy ? clampedBox(desktop, win, pinTo(pin, raster(), frame, policy)) : pinnedBox(win, pin)
    },

    /** A window's saved geometry: its pin, its depth among the desktop's
     *  windows (0 is the bottom) and whether it is the active window. An
     *  application reports these for its own windows, and
     *  shell/desktop-state.ts writes them. */
    record(win: VfWindow): WindowRecord {
      const all = [...desktop.querySelectorAll(':scope > vf-window')]
      return {
        pin: pinOf(boxOf(win), raster(), frame),
        z: all.indexOf(win),
        active: desktop.activeWindow === win,
      }
    },

    /** An adopted window's `place` on the live raster, clamped, or null. */
    placed(win: VfWindow) {
      return placedBox(win)
    },

    /** The first cascade slot from WINDOW_ORIGIN no visible window holds, for
     *  a window about to open, whatever its application. */
    freeSlot(): number {
      const occupied = [...adopted.keys()].filter((w) => !w.hidden).map(boxOf)
      return cascadeFrom(WINDOW_ORIGIN, occupied).slot
    },

    /** Whether a window showing `item` is adopted. */
    isOpen(item: string): boolean {
      for (const a of adopted.values()) if (a.item === item) return true
      return false
    },

    /** Registers an application's arrangement group, for windows adopted
     *  without a `place`. Returns the unregister function. */
    arrangeWith(app: AppId, group: ArrangeGroup): () => void {
      groups.set(app, group)
      notifyLayout()
      return () => {
        if (groups.get(app) === group) groups.delete(app)
        notifyLayout()
      }
    },

    /** View → Arrange Windows. Runs every group's arrange, then re-applies
     *  every `place`. Positions only, with no activation or restacking. */
    arrange(): void {
      holding = true
      try {
        for (const group of groups.values()) group.arrange()
        for (const win of adopted.keys()) placeAdopted(win)
      } finally {
        holding = false
      }
      notifyLayout()
    },

    /** Whether every group reports arranged and every visible window with a
     *  `place` sits at its placedBox. */
    arranged(): boolean {
      for (const group of groups.values()) if (!group.arranged()) return false
      for (const win of adopted.keys()) {
        const g = placedBox(win)
        if (g && !win.hidden && !at(win, g)) return false
      }
      return true
    },

    /** Widens the shared window frame's left, top and right bands. Call it at an
     *  application's init. A saved pin is valid only in the frame it was read in. */
    setFrameBands(bands: { left?: number; top?: number; right?: number }): void {
      frame = windowFrame(bands)
      pins = new WeakMap()
    },

    /** Notifies layout of a change the owner made itself. */
    layoutChanged(): void {
      notifyLayout()
    },

    /** Subscribes to the layout signal. Returns the unsubscribe. */
    onLayout(fn: () => void): () => void {
      layoutListeners.add(fn)
      return () => {
        layoutListeners.delete(fn)
      }
    },

    /** Subscribes to windows with a catalog item opening or closing. Returns
     *  the unsubscribe. */
    onWindows(fn: () => void): () => void {
      windowListeners.add(fn)
      return () => {
        windowListeners.delete(fn)
      }
    },

    /** Subscribes to raster resizes. `fn(before, after)` runs after every
     *  window has re-pinned. Returns the unsubscribe. */
    onRaster(fn: RasterListener): () => void {
      rasterListeners.add(fn)
      return () => {
        rasterListeners.delete(fn)
      }
    },

    /** Subscribes to activations. `fn(win)` runs with the newly active window,
     *  or null, before shell.frontApp changes. Returns the unsubscribe. */
    beforeFront(fn: (win: HTMLElement | null) => void): () => void {
      frontListeners.add(fn)
      return () => {
        frontListeners.delete(fn)
      }
    },

    /** Re-pins every adopted window after the raster changes size, then runs
     *  the onRaster listeners. main.ts calls it after each re-fit, not
     *  debounced. There is no position clamp, so a window may hang off a
     *  shrunk raster. A clamp would rewrite the pin and windows would drift on
     *  grow-back. */
    onDesktopResized(before: Size): void {
      const after = raster()
      if (before.width === after.width && before.height === after.height) return
      for (const win of adopted.keys()) repin(win, before, after)
      for (const fn of [...rasterListeners]) fn(before, after)
      notifyLayout()
    },

    /** Clears the active window, bringing the Finder forward. */
    deactivate(): void {
      desktop.clearActive()
    },

    dispose(): void {
      for (const u of unsubs) u()
      layoutListeners.clear()
      windowListeners.clear()
      rasterListeners.clear()
      frontListeners.clear()
      groups.clear()
      // main.ts disposes the applications first, so their windows are released.
      adopted.clear()
    },
  }
}

export type WindowManager = ReturnType<typeof initWindows>
