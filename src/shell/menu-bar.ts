// Menu bar: the Apple menu, the front application's menus and the shared
// dialogs.
//
// - The Apple menu (index.html) stays on the bar in every application. It
//   holds About and, after a rule, the items applications install through
//   deps.appleMenu. Key equivalents fire app-wide, so every menu handler checks
//   modalOpen().
// - Each application's menus.html is parsed once with innerHTML in this
//   document, so its vf-menu elements upgrade at once. The nodes go to the
//   application's init, which binds to them whether or not they are on the bar.
// - On each shell.frontApp change, the outgoing application's menus are
//   removed and the incoming ones inserted before the clock. The same nodes
//   are reused, so item state persists. Menus must be detached, not hidden. An
//   item's key equivalent stays active while it is connected.
// - The first sync runs at wire-up, so the first paint shows the Finder's menus.
// - Cross-application calls go through deps.apps, read at pick time.

import type {
  VfCheckbox,
  VfDesktop,
  VfDialog,
  VfMenu,
  VfMenuBar,
  VfMenuItem,
} from 'vintage-frames'
import { shell } from '../state/shell.ts'
import type { AppId } from '../state/shell.ts'
import type { Pin, Point } from './layout.ts'
import type { WindowManager } from './windows.ts'

/** The deps passed to each application's init. `Apps` is the registry's
 *  actions by application id. */
export interface AppDeps<Apps = Record<string, unknown>> {
  desktop: VfDesktop
  windows: WindowManager
  /** The Apple menu, for the items an application installs in it. */
  appleMenu: VfMenu
  iconPos(key: string): Point | null
  windowPin(key: string): Pin | null
  showAbout(): void
  showStorage(): void
  showError(message: string): void
  modalOpen(): boolean
  apps: Apps
}

/** One application: `id` is the value shell.frontApp takes, `name` the menu
 *  bar's accessible name while it is front, and `menus` its menus.html. */
export interface AppDefinition<Apps = Record<string, unknown>> {
  id: AppId
  name: string
  menus: string
  init(args: { menus: HTMLElement[]; deps: AppDeps<Apps> }): {
    actions: unknown
    dispose(): void
  }
}

/** The shared services main.ts hands the applications, plus the About box's
 *  Show at startup, which only the About box uses. */
export interface MenuBarServices {
  windows: WindowManager
  iconPos(key: string): Point | null
  windowPin(key: string): Pin | null
  greet(): boolean
  setGreet(on: boolean): void
}

/** A menu event's value. */
export const menuValue = (e: Event): string =>
  (e as CustomEvent<{ value: string }>).detail.value

/** One of an application's parsed menus by data-menu. Throws when the markup
 *  drifts. */
export function menuOf(menus: HTMLElement[], name: string, where: string): VfMenu {
  const m = menus.find((el) => el.dataset.menu === name)
  if (!m) throw new Error(`${where}: missing menu ${name}`)
  return m as VfMenu
}

/** An item in a menu by value. Throws when the markup drifts. */
export function itemOf(menu: Element, value: string, where: string): VfMenuItem {
  const el = menu.querySelector<VfMenuItem>(`vf-menu-item[value="${value}"]`)
  if (!el) throw new Error(`${where}: missing item ${value}`)
  return el
}

/** A listener list torn down at dispose. */
export function listeners() {
  const teardown: (() => void)[] = []
  return {
    on(el: EventTarget, type: string, fn: (e: Event) => void, opts?: boolean | AddEventListenerOptions) {
      el.addEventListener(type, fn, opts)
      teardown.push(() => el.removeEventListener(type, fn, opts))
    },
    add(fn: () => void) {
      teardown.push(fn)
    },
    dispose() {
      for (const fn of teardown.splice(0)) fn()
    },
  }
}

export function initMenuBar<Apps extends object>(
  desktop: VfDesktop,
  { apps, defaultApp }: { apps: AppDefinition<Apps>[]; defaultApp: AppId },
  { greet, setGreet, ...services }: MenuBarServices
) {
  const $ = <T extends Element = HTMLElement>(sel: string): T => {
    const el = desktop.querySelector<T>(sel)
    if (!el) throw new Error(`shell/menu-bar: missing element ${sel}`)
    return el
  }
  const l = listeners()

  const bar = $<VfMenuBar>('vf-menu-bar')
  const clock = $('#clock')
  const appleMenu = $<VfMenu>('#menu-apple')

  const modalOpen = () => !!desktop.querySelector('vf-dialog[open]')

  // Shared dialogs.
  // About box: the Apple menu's first item and the boot greeting. The version
  // and date come from vite.config.ts `define`. Show at startup saves on each
  // toggle, because a click outside closes the box without OK.
  const dlgAbout = $<VfDialog>('#dlg-about')
  $('#about-version').textContent = `version ${__APP_VERSION__}`
  $('#about-date').textContent = __APP_DATE__
  const chkGreet = $<VfCheckbox>('#about-greet')
  const showAbout = () => {
    chkGreet.checked = greet()
    dlgAbout.show()
  }
  l.on(chkGreet, 'vf-change', (e) =>
    setGreet(!!(e as CustomEvent<{ checked: boolean }>).detail.checked)
  )
  l.on($('#btn-about-ok'), 'click', () => dlgAbout.close())
  // Storage unavailable, shown when IndexedDB fails (a private window).
  const dlgStorage = $<VfDialog>('#dlg-storage')
  const showStorage = () => dlgStorage.show()
  l.on($('#btn-storage-ok'), 'click', () => dlgStorage.close())
  // An operation that failed, in words.
  const dlgError = $<VfDialog>('#dlg-error')
  const errorMsg = $('#error-msg')
  const showError = (message: string) => {
    errorMsg.textContent = message
    dlgError.show()
  }
  l.on($('#btn-error-ok'), 'click', () => dlgError.close())

  l.on(appleMenu, 'vf-menu-select', (e) => {
    if (modalOpen()) return
    if (menuValue(e) === 'about') showAbout()
  })

  // Applications.
  /** Each application's actions by id, filled as its init returns. */
  const actionsById = {} as Apps
  const deps: AppDeps<Apps> = {
    ...services,
    desktop,
    appleMenu,
    showAbout,
    showStorage,
    showError,
    modalOpen,
    apps: actionsById,
  }
  /** Parses a menus fragment into detached vf-menu elements of this document. */
  const parseMenus = (html: string): HTMLElement[] => {
    const host = document.createElement('div')
    host.innerHTML = html
    const nodes = [...host.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.localName === 'vf-menu'
    )
    for (const node of nodes) node.remove()
    return nodes
  }
  const entries = apps.map((app) => ({ app, nodes: parseMenus(app.menus) }))
  const instances = entries.map(({ app, nodes }) => {
    const instance = app.init({ menus: nodes, deps })
    ;(actionsById as Record<string, unknown>)[app.id] = instance.actions
    return instance
  })

  // Menu swap.
  let slotted: (typeof entries)[number] | null = null
  const sync = () => {
    const id = shell.get().frontApp
    const entry =
      entries.find((e) => e.app.id === id) ??
      entries.find((e) => e.app.id === defaultApp) ??
      entries[0]
    if (!entry || entry === slotted) return
    if (slotted) for (const node of slotted.nodes) node.remove()
    clock.before(...entry.nodes)
    bar.label = entry.app.name
    slotted = entry
  }
  l.add(shell.subscribe(sync))
  sync()

  return {
    /** Shows the About box. main.ts calls it as the boot greeting. */
    showAbout,
    /** Shows the storage-unavailable notice. */
    showStorage,
    /** Each application's actions by id. */
    apps: actionsById,
    dispose(): void {
      for (const instance of instances) instance.dispose()
      if (slotted) for (const node of slotted.nodes) node.remove()
      slotted = null
      l.dispose()
    },
  }
}
