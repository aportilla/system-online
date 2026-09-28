// Font Viewer windows: one vf-window per open suitcase, cloned from
// #tpl-font-window. The body sets the sample line in every strike of the
// family, then every character of the chosen strike, each in the strike
// itself: the paragraph carries the strike's family, its rect as the size (one
// design px per system px) and its measured pitch as the line height, so
// nothing on it can be another font's fallback.
//
// Boxes persist and restore as the Text Viewer's do: a nine-slice pin keyed
// like the suitcase's icon, out of the icon and back into it through the
// Finder, and a zoom box toggling expandedFontBox. A suitcase that is gone
// closes at once.

import { VfParagraph, VfWindow } from 'vintage-frames'
import type { VfDesktop, VfLabel, VfViewportBox } from 'vintage-frames'
import markup from './windows.html?raw'
import { CHARSET_FAMILIES } from '../../charset-manifest.ts'
import type { CharsetFamily, CharsetFont } from '../../charset-manifest.ts'
import { files } from '../../state/files.ts'
import { FONT_VIEWER } from '../../state/shell.ts'
import { cascadedBox, nearBox } from '../../shell/layout.ts'
import type { Pin } from '../../shell/layout.ts'
import { cloneWindow, parseWindows, windowTemplate } from '../../shell/windows.ts'
import type { WindowManager } from '../../shell/windows.ts'
import type { WindowRecord } from '../../shell/desktop-state.ts'
import { expandedFontBox } from './layout.ts'
import { loadStrike, strikeUrl } from './strikes.ts'
import { OPENING_SIZE, SAMPLE, charsetRows, nearestStrike, strikeName } from './specimen.ts'

/** A suitcase's catalog item key, shared with its icon. */
const itemOf = (id: string) => `font:${id}`

const familyOf = (label: string): CharsetFamily | null =>
  CHARSET_FAMILIES.find((f) => f.label === label) ?? null

interface Open {
  win: VfWindow
  family: CharsetFamily
  font: CharsetFont
  /** Bumped by each render, so a load that finishes late draws nothing. */
  pass: number
}

/** A paragraph set in `font`, or explaining that its file didn't load. */
function strikeParagraph(family: CharsetFamily, font: CharsetFont, text: string, loaded: boolean) {
  const p = new VfParagraph()
  p.setAttribute('fill-width', '')
  if (!loaded) {
    p.textContent = `${strikeUrl(font)} didn’t load.`
    return p
  }
  p.style.setProperty('--vf-font-family', `'${strikeName(family, font)}'`)
  p.style.setProperty('--vf-font-size', `${font.line}px`)
  p.style.setProperty('--vf-paragraph-line-height', `${font.pitch}px`)
  p.textContent = text
  return p
}

export function initFontWindows(
  desktop: VfDesktop,
  windows: WindowManager,
  {
    savedPin = () => null,
    iconBox = () => null,
    holdGhost = () => {},
    onFont = () => {},
  }: {
    /** A saved pin by item key (desktop-state.ts windowPin), or null. */
    savedPin?: (key: string) => Pin | null
    /** The Finder's, read at each close. */
    iconBox?: (key: string) => VfViewportBox | null
    holdGhost?: (key: string, until: Promise<unknown>) => void
    /** A window's chosen strike changed. */
    onFont?: () => void
  } = {}
) {
  const tpl = windowTemplate(parseWindows(markup), 'tpl-font-window')
  /** Suitcase id -> its open window. */
  const wins = new Map<string, Open>()
  /** Suitcase id -> the pin its window closed at this session. */
  const remembered = new Map<string, Pin>()

  const idOf = (win: Element) => {
    for (const [id, o] of wins) if (o.win === win) return id
    return null
  }

  /** Draws a window's samples, character rows and status. Every strike loads
   *  first; the wristwatch shows while one is loading. */
  async function render(o: Open) {
    const pass = ++o.pass
    const { win, family, font } = o
    win.setAttribute('aria-busy', 'true')
    const loaded = await Promise.all(family.fonts.map((f) => loadStrike(family, f)))
    if (pass !== o.pass) return
    win.removeAttribute('aria-busy')
    const samples = win.querySelector('.font-samples') as HTMLElement
    samples.replaceChildren(
      ...family.fonts.map((f, i) => strikeParagraph(family, f, SAMPLE, !!loaded[i]))
    )
    const ok = !!loaded[family.fonts.indexOf(font)]
    const charset = win.querySelector('.font-charset') as HTMLElement
    charset.replaceChildren(...(ok ? charsetRows(font.chars) : ['']).map((row) => strikeParagraph(family, font, row, ok)))
    const status = win.querySelector('.font-status') as VfLabel
    status.textContent = `${strikeName(family, font)} · ${[...font.chars].length} characters`
  }

  // The kit's close box fires vf-close but does not remove the window.
  const onClose = (e: Event) => {
    const id = e.target instanceof VfWindow ? idOf(e.target) : null
    if (id != null) close(id)
  }
  desktop.addEventListener('vf-close', onClose)

  /** Each zoomed window's pin from before the zoom. */
  const expandMemory = new WeakMap<VfWindow, Pin>()
  const onZoom = (e: Event) => {
    const win = e.target
    if (!(win instanceof VfWindow) || idOf(win) == null) return
    const cur = { left: win.left ?? 0, top: win.top ?? 0, width: win.width ?? 0, height: win.height ?? 0 }
    const column = expandedFontBox(desktop.width, desktop.height)
    if (nearBox(cur, column)) {
      const pin = expandMemory.get(win)
      expandMemory.delete(win)
      const back = pin ? windows.fromPin(win, pin) : windows.placed(win)
      if (back) windows.write(win, back)
    } else {
      expandMemory.set(win, windows.pinOf(win))
      windows.write(win, column)
    }
  }
  desktop.addEventListener('vf-zoom', onZoom)

  /** Opens or raises a suitcase's window. `from` is the box a new window grows
   *  out of, in viewport CSS px. Returns the window, or null if the suitcase
   *  or its family is gone. */
  function open(id: string, { from = null }: { from?: VfViewportBox | null } = {}): VfWindow | null {
    const had = wins.get(id)
    if (had) {
      desktop.bringToFront(had.win)
      return had.win
    }
    const rec = files.fontRec(id)
    const family = rec ? familyOf(rec.family) : null
    const font = family ? nearestStrike(family, OPENING_SIZE) : null
    if (!rec || !family || !font) return null
    const win = cloneWindow(tpl)
    win.id = `win-font-${id}`
    win.heading = rec.name
    const size = { width: win.width ?? 0, height: win.height ?? 0 }
    const n = windows.freeSlot()
    // Append before adopt: the clamp reads the raster's lattice from a
    // connected element.
    desktop.append(win)
    const o: Open = { win, family, font, pass: 0 }
    wins.set(id, o)
    // This session's pin, else the saved pin, else the cascade.
    windows.adopt(win, {
      app: FONT_VIEWER,
      place: (w, h) => cascadedBox(w, h, size, n),
      pin: remembered.get(id) ?? savedPin(itemOf(id)),
      keep: expandedFontBox,
      item: itemOf(id),
    })
    remembered.delete(id)
    desktop.bringToFront(win)
    void render(o)
    if (from) void win.show({ from })
    return win
  }

  /** Closes a suitcase's window into `to`, a viewport box, or at once without
   *  one. */
  function closeWindow(id: string, to: VfViewportBox | null = null) {
    const o = wins.get(id)
    if (!o) return
    o.pass++
    remembered.set(id, windows.pinOf(o.win))
    wins.delete(id)
    const landed = windows.dismiss(o.win, to) // the kit picks the next active window
    if (to) holdGhost(itemOf(id), landed)
  }

  /** The user's close: into the suitcase's icon. */
  const close = (id: string) => closeWindow(id, iconBox(itemOf(id)))

  // Follow renames, and close windows whose suitcase was deleted.
  const sync = () => {
    const st = files.get()
    for (const [id, o] of [...wins]) {
      const rec = st.fonts.find((t) => t.id === id)
      if (!rec) {
        closeWindow(id)
        continue
      }
      if (o.win.heading !== rec.name) o.win.heading = rec.name
    }
  }
  const unsubscribe = files.subscribe(sync)

  /** The suitcase id of the window containing `node`, or null. */
  const fontOfNode = (node: Node | null) => {
    const el = node instanceof Element ? node : (node?.parentElement ?? null)
    const win = el?.closest('vf-window')
    return win ? idOf(win) : null
  }

  return {
    open,
    close,
    /** Closes every window, each into its own icon. */
    closeAll(): void {
      for (const id of [...wins.keys()]) close(id)
    },
    /** The suitcase id of the active window, or null. */
    activeFont(): string | null {
      const w = desktop.activeWindow
      return w ? idOf(w) : null
    },
    /** A window's family and chosen strike, or null. */
    strikesOf(id: string): { family: CharsetFamily; font: CharsetFont } | null {
      const o = wins.get(id)
      return o ? { family: o.family, font: o.font } : null
    },
    /** Shows the family's strike of `size` in a window. */
    setSize(id: string, size: number): void {
      const o = wins.get(id)
      const font = o?.family.fonts.find((f) => f.size === size)
      if (!o || !font || font === o.font) return
      o.font = font
      void render(o)
      onFont()
    },
    /** Every known window by item key, for the desktop state. */
    pins(): Record<string, WindowRecord> {
      const out: Record<string, WindowRecord> = {}
      for (const [id, pin] of remembered) out[itemOf(id)] = { pin }
      for (const [id, o] of wins) out[itemOf(id)] = windows.record(o.win)
      return out
    },
    /** The selected text if the selection is anchored in a font window,
     *  otherwise ''. */
    selectedText(): string {
      const sel = document.getSelection()
      if (!sel || sel.isCollapsed || fontOfNode(sel.anchorNode) == null) return ''
      return sel.toString()
    },
    /** Selects all the text in a suitcase's window. */
    selectAll(id: string): void {
      const body = wins.get(id)?.win.querySelector('.font-specimen')
      const sel = document.getSelection()
      if (!body || !sel) return
      const range = document.createRange()
      range.selectNodeContents(body)
      sel.removeAllRanges()
      sel.addRange(range)
    },
    dispose(): void {
      unsubscribe()
      desktop.removeEventListener('vf-close', onClose)
      desktop.removeEventListener('vf-zoom', onZoom)
      for (const id of [...wins.keys()]) closeWindow(id)
    },
  }
}
