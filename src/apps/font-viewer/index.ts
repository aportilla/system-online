// Font Viewer: opens the library's font suitcases (the `font` kind), one window
// each, set in the suitcase's own strikes (windows.ts), and fills the Size menu
// with the active window's. It opens on the strike nearest 12; the zoom box
// toggles a wide column (layout.ts).

import { VfWindow } from 'vintage-frames'
import type { VfViewportBox } from 'vintage-frames'
import { defineApp } from 'vintage-frames/shell'
import type { AppDefinition, Item } from 'vintage-frames/shell'
import menus from './menus.html?raw'
import dialogs from './dialogs.html?raw'
import { CHARSET_FAMILIES } from '../../charset-manifest.ts'
import { FONT, fontFamily } from '../../state/kinds.ts'
import { ask, selectContents, selectedTextIn, zoomBetween } from '../windows.ts'
import { fontWindow, render, specimenOf } from './windows.ts'
import type { Specimen } from './windows.ts'
import { expandedFontBox } from './layout.ts'
import { OPENING_SIZE, nearestStrike, sizeLabel } from './specimen.ts'

const FONT_VIEWER = 'font-viewer'

// Stand-in art for a suitcase, served from public/.
const SUITCASE_ART = `${import.meta.env.BASE_URL}icons/app-icon.png`

const familyOf = (label: string) => CHARSET_FAMILIES.find((f) => f.label === label) ?? null

/** A suitcase's size: its family's strikes in bytes. */
const familyBytes = (label: string): number =>
  familyOf(label)?.fonts.reduce((sum, f) => sum + (__FONT_BYTES__[f.file] ?? 0), 0) ?? 0

export interface FontViewerActions {
  /** Open a suitcase's window, or bring it forward. The boot reopens the last
   *  session's windows through it. */
  open(target: { item?: string | null; from?: VfViewportBox | null }): void
}

export function fontViewer(): AppDefinition<FontViewerActions> {
  /** Opens a suitcase's window out of `from`; init sets it. */
  let openFont = (_item: Item, _from: VfViewportBox | null): void => {}

  return defineApp<FontViewerActions>({
    id: FONT_VIEWER,
    name: 'Font Viewer',
    menus,
    dialogs,
    kinds: {
      [FONT]: {
        art: SUITCASE_ART,
        open: (item, from) => openFont(item, from),
        size: (item) => familyBytes(fontFamily(item)),
      },
    },
    init(ctx) {
      const { desktop, windows } = ctx
      const sizeMenu = ctx.menu('size')
      const alert = ctx.dialog('alert')
      /** Each open window's family and strike. */
      const specimens = new WeakMap<VfWindow, Specimen>()
      /** The active window's, when it is a font window. */
      const active = (): Specimen | null => {
        const w = desktop.activeWindow
        return w instanceof VfWindow ? (specimens.get(w) ?? null) : null
      }

      /** The Size menu: the active window's strikes, its own checked. The menu
       *  is on the bar only while a font window is active. */
      const syncSize = () => {
        const s = active()
        if (!s) return
        const { family, font } = s
        const shows = `${family.label} ${family.fonts.map((f) => `${f.size}:${f === font}`).join(' ')}`
        if (sizeMenu.dataset.shows === shows) return
        sizeMenu.dataset.shows = shows
        sizeMenu.replaceChildren(
          ...family.fonts.map((f) => {
            const item = document.createElement('vf-menu-item')
            item.value = String(f.size)
            item.textContent = sizeLabel(family, f)
            item.checked = f === font
            return item
          })
        )
      }
      ctx.on(desktop, 'vf-activate', syncSize)

      openFont = (item, from) => {
        const family = familyOf(fontFamily(item))
        const font = family ? nearestStrike(family, OPENING_SIZE) : null
        if (!family || !font) {
          void ask(ctx, alert, `“${item.name}” can’t be opened: its strikes are no longer part of SystemOnline.`)
          return
        }
        windows.open({
          app: FONT_VIEWER,
          item: item.id,
          from,
          create: () => {
            const s: Specimen = { win: fontWindow(item.name), family, font, pass: 0 }
            specimens.set(s.win, s)
            void render(s)
            return s.win
          },
          keep: expandedFontBox,
        })
        syncSize()
      }
      zoomBetween(ctx, FONT_VIEWER, expandedFontBox)

      ctx.onMenu((value, item) => {
        const s = active()
        if (sizeMenu.contains(item)) {
          const font = s?.family.fonts.find((f) => String(f.size) === value)
          if (!s || !font || font === s.font) return
          s.font = font
          void render(s)
          syncSize()
        } else if (value === 'close' && s) windows.requestClose(s.win)
        else if (value === 'quit') for (const w of windows.windowsOf(FONT_VIEWER)) windows.requestClose(w)
        // The enabled item takes ⌘C, so the browser's own copy does not run.
        else if (value === 'copy') navigator.clipboard?.writeText?.(selectedTextIn(windows, FONT_VIEWER)).catch(() => {})
        else if (value === 'select-all' && s) selectContents(specimenOf(s.win))
        else if (value === 'arrange') windows.arrange()
      })
      // Copy is disabled unless a font window holds a selection.
      ctx.gate(ctx.item('copy'), () => selectedTextIn(windows, FONT_VIEWER) !== '')
      ctx.gate(ctx.item('arrange'), () => !windows.arranged())
      ctx.onDispose(() => {
        for (const w of windows.windowsOf(FONT_VIEWER)) w.remove()
      })

      return {
        open({ item, from = null }) {
          const it = ctx.catalog?.item(item)
          if (it?.kind === FONT) openFont(it, from)
        },
      }
    },
  })
}
