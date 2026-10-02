// The About box: Apple menu → About SystemOnline…, and the greeting a load
// shows when it reopens no window, unless Show at startup is off. Show at
// startup is saved with the session on each toggle, since a click outside
// closes the box without OK. The version and date come from vite.config.ts
// `define`.

import type { VfCheckbox, VfDialog } from 'vintage-frames'
import type { ShellState } from 'vintage-frames/shell'

/** The session key that holds Show at startup. */
export const GREET = 'greet'

export function initAbout(desktop: HTMLElement, state: ShellState) {
  const teardown: (() => void)[] = []
  const $ = <T extends Element = HTMLElement>(sel: string): T => {
    const el = desktop.querySelector<T>(sel)
    if (!el) throw new Error(`about: missing element ${sel}`)
    return el
  }
  const on = (el: EventTarget, type: string, fn: (e: Event) => void) => {
    el.addEventListener(type, fn)
    teardown.push(() => el.removeEventListener(type, fn))
  }

  const dialog = $<VfDialog>('#dlg-about')
  const greet = $<VfCheckbox>('#about-greet')
  $('#about-version').textContent = `version ${__APP_VERSION__}`
  $('#about-date').textContent = __APP_DATE__
  const greets = () => state.get(GREET) !== false
  const show = () => {
    greet.checked = greets()
    dialog.show()
  }
  on($('#menu-apple'), 'vf-menu-select', (e) => {
    if ((e as CustomEvent<{ value: string }>).detail.value !== 'about') return
    if (!document.querySelector('vf-dialog[open]')) show()
  })
  on(greet, 'vf-change', (e) => state.set(GREET, !!(e as CustomEvent<{ checked: boolean }>).detail.checked))
  on($('#btn-about-ok'), 'click', () => dialog.close())

  return {
    show,
    /** Whether a load that reopens no window shows the box. */
    greets,
    dispose(): void {
      for (const fn of teardown.splice(0)) fn()
    },
  }
}
