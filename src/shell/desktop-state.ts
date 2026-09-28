// Desktop state in localStorage: one versioned JSON key. Folders, text files
// and fonts live in IndexedDB.
//
// - icons: positions by item key ("folder:<id>", "text:<id>", "font:<id>"), in
//   the coordinates of the item's current container (the desktop or a folder
//   window).
// - windows: every window's box as a nine-slice pin (layout.ts pinOf), keyed
//   like icons, so they stay on screen after a browser resize. An entry with a
//   `z` was open at the write, at that depth in the stacking order. An entry
//   without one is a box alone, which boot/restore.ts never opens.
// - active: the active window's key, or null.
// - pattern: the desktop pattern.
// - greet: whether a load that reopens nothing shows the About box. A blob
//   without it reads true.
// - seeded: whether the default files have been stored. main.ts marks it only
//   after the last one is stored, so an interrupted first boot completes on
//   the next one.
//
// markSeeded and setGreet write at once, so an immediate reload still finds
// them. Other changes write after a debounce, and hiding or leaving the page
// writes at once. ?fresh=1 neither reads nor writes.
//
// The boot holds every write until it has reopened the session: a write while
// restore.ts is still opening windows would drop the depth of the ones it has
// not reached, and they would not reopen next time.

import { files } from '../state/files.ts'
import { shell } from '../state/shell.ts'
import { isPin } from './layout.ts'
import type { Pin, Point } from './layout.ts'

const KEY = 'system7web:desktop'
const VERSION = 1
const WRITE_DEBOUNCE_MS = 400

/** A saved window: its pin, and its depth while it was open. */
export interface WindowEntry {
  pin: Pin
  z?: number
}

/** What a window's owner reports for it: its entry, and whether it is the
 *  active window. */
export interface WindowRecord extends WindowEntry {
  active?: boolean
}

export interface DesktopState {
  v: number
  icons: Record<string, Point>
  windows: Record<string, WindowEntry>
  active: string | null
  pattern: string | null
  greet: boolean
  seeded: boolean
}

/** A window entry with a valid pin, or null. */
function windowEntry(e: unknown): WindowEntry | null {
  const x = e as { pin?: unknown; z?: unknown } | null
  if (!isPin(x?.pin)) return null
  return Number.isInteger(x?.z) ? { pin: x.pin, z: x.z as number } : { pin: x.pin }
}

/** Every valid window entry of a parsed map. */
function windowEntries(windows: unknown): Record<string, WindowEntry> {
  const out: Record<string, WindowEntry> = {}
  if (!windows || typeof windows !== 'object') return out
  for (const [key, e] of Object.entries(windows)) {
    const w = windowEntry(e)
    if (w) out[key] = w
  }
  return out
}

/** Every valid icon position of a parsed map. */
function iconEntries(icons: unknown): Record<string, Point> {
  const out: Record<string, Point> = {}
  if (!icons || typeof icons !== 'object') return out
  for (const [key, p] of Object.entries(icons)) {
    const q = p as Point | null
    if (Number.isFinite(q?.left) && Number.isFinite(q?.top)) out[key] = { left: q!.left, top: q!.top }
  }
  return out
}

/** A parsed blob normalized to the current shape, or null for anything that
 *  isn't one. */
export function readDesktopState(parsed: unknown): DesktopState | null {
  const p = parsed as Record<string, unknown> | null
  if (!p || typeof p !== 'object' || p.v !== VERSION) return null
  return {
    v: VERSION,
    icons: iconEntries(p.icons),
    windows: windowEntries(p.windows),
    active: typeof p.active === 'string' && p.active ? p.active : null,
    pattern: typeof p.pattern === 'string' && p.pattern.trim() ? p.pattern : null,
    greet: p.greet !== false,
    seeded: p.seeded === true,
  }
}

function load(): DesktopState | null {
  try {
    return readDesktopState(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return null
  }
}

/** The windows that were open, deepest first. boot/restore.ts reopens them in
 *  this order. */
export function openWindowsOf(state: DesktopState | null): { key: string; pin: Pin }[] {
  const out: { key: string; pin: Pin; z: number }[] = []
  for (const [key, e] of Object.entries(state?.windows ?? {})) {
    if (Number.isInteger(e.z)) out.push({ key, pin: e.pin, z: e.z as number })
  }
  out.sort((a, b) => a.z - b.z)
  return out.map(({ key, pin }) => ({ key, pin }))
}

/** `fresh`: ?fresh=1, neither restore nor persist. */
export function createDesktopState(fresh: boolean) {
  const saved = fresh ? null : load()
  let seeded = saved?.seeded === true
  let greet = saved?.greet !== false
  /** Whether writes are held (see hold). */
  let held = false
  /** The synchronous writer, once start() has set one. */
  let writeNow = () => {}

  return {
    /** The restored state, or null. */
    saved,

    /** Holds every write until release(). The boot holds while it reopens the
     *  session. */
    hold(): void {
      held = true
    },

    /** Releases the hold and writes what is on screen. */
    release(): void {
      held = false
      writeNow()
    },

    /** Whether the default files have been stored. */
    seeded: (): boolean => seeded,

    /** Marks the default files stored and writes at once. */
    markSeeded(): void {
      seeded = true
      writeNow()
    },

    /** Whether a load that reopens nothing shows the About box. */
    greet: (): boolean => greet,

    /** Sets the About box's Show at startup and writes at once. */
    setGreet(on: boolean): void {
      greet = !!on
      writeNow()
    },

    /** A saved icon position by key, in its container's coordinates, or
     *  null. */
    iconPos(key: string): Point | null {
      return saved?.icons[key] ?? null
    },

    /** A saved window's pin by key, or null. */
    windowPin(key: string): Pin | null {
      return saved?.windows[key]?.pin ?? null
    },

    /** The windows that were open, deepest first. */
    openWindows(): { key: string; pin: Pin }[] {
      return openWindowsOf(saved)
    },

    /** The active window's saved key, or null. */
    activeWindow(): string | null {
      return saved?.active ?? null
    },

    /** The saved desktop pattern, or null. shell/desktop-pattern.ts validates
     *  it. */
    desktopPattern(): string | null {
      return saved?.pattern ?? null
    },

    /**
     * Starts persisting and returns a stop function. readIcons and readWindows
     * are merged over the last written maps, so items in closed folder windows
     * keep their entries. A null position (an item filed away and not yet
     * rendered in its new container) removes its entry. onMoved subscribes to
     * moves that end without a pointerup, such as Clean Up.
     *
     * readWindows reports every window its application has open, with `z` its
     * depth among the desktop's windows and `active` for the active one, plus
     * any box it remembers for a window closed this session, without a `z`.
     */
    start({
      readIcons,
      readWindows = () => ({}),
      onMoved = () => () => {},
    }: {
      readIcons: () => Record<string, Point | null>
      readWindows?: () => Record<string, WindowRecord>
      onMoved?: (fn: () => void) => () => void
    }): () => void {
      if (fresh) return () => {}
      let known: Record<string, Point> = { ...(saved?.icons ?? {}) }
      let knownWindows: Record<string, WindowEntry> = { ...(saved?.windows ?? {}) }

      function snapshot(): DesktopState {
        const icons: Record<string, Point> = { ...known }
        for (const [key, p] of Object.entries(readIcons())) {
          if (p) icons[key] = { left: p.left, top: p.top }
          else delete icons[key]
        }
        known = icons
        // A known window keeps its box and loses its depth: only the windows
        // open at this write carry a `z`, and one of them the active flag.
        const windows: Record<string, WindowEntry> = {}
        for (const [key, e] of Object.entries(knownWindows)) windows[key] = { pin: e.pin }
        let active: string | null = null
        for (const [key, e] of Object.entries(readWindows())) {
          const w = windowEntry(e)
          if (!w) continue
          windows[key] = w
          if (e.active) active = key
        }
        knownWindows = windows
        return {
          v: VERSION,
          icons,
          windows,
          active,
          pattern: shell.get().desktopPattern,
          greet,
          seeded,
        }
      }

      const write = () => {
        if (held) return
        try {
          localStorage.setItem(KEY, JSON.stringify(snapshot()))
        } catch {
          // Ignore quota and private-mode failures.
        }
      }
      writeNow = write

      let timer = 0
      const writeSoon = () => {
        clearTimeout(timer)
        timer = window.setTimeout(write, WRITE_DEBOUNCE_MS)
      }

      const unsubs = [files.subscribe(writeSoon), shell.subscribe(writeSoon), onMoved(writeSoon)]
      const onHide = () => {
        if (document.visibilityState === 'hidden') write()
      }
      document.addEventListener('pointerup', writeSoon)
      document.addEventListener('visibilitychange', onHide)
      window.addEventListener('resize', writeSoon)
      window.addEventListener('beforeunload', write)

      return () => {
        clearTimeout(timer)
        writeNow = () => {}
        for (const u of unsubs) u()
        document.removeEventListener('pointerup', writeSoon)
        document.removeEventListener('visibilitychange', onHide)
        window.removeEventListener('resize', writeSoon)
        window.removeEventListener('beforeunload', write)
      }
    },
  }
}

export type DesktopStateHandle = ReturnType<typeof createDesktopState>
