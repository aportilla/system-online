// Shell slice: the front application and the desktop pattern.
//
// frontApp is the application of the desktop's active window, or the Finder
// when no window is active. shell/windows.ts seeds it from
// desktop.activeWindow at wire-up and updates it on vf-activate.
//
// desktopPattern is painted by shell/desktop-pattern.ts and persisted by
// shell/desktop-state.ts.

import { createStore } from './store.ts'

/** Application ids. Both shell/ and apps/ import them from here. */
export const FINDER = 'finder'
export const TEXT_VIEWER = 'text-viewer'
export const DESKTOP_PATTERNS = 'desktop-patterns'
export const FONT_VIEWER = 'font-viewer'
export type AppId =
  | typeof FINDER
  | typeof TEXT_VIEWER
  | typeof DESKTOP_PATTERNS
  | typeof FONT_VIEWER
const APP_IDS: readonly string[] = [FINDER, TEXT_VIEWER, DESKTOP_PATTERNS, FONT_VIEWER]

/** The kit's default desktop pattern, the 50% dither. */
export const DEFAULT_DESKTOP_PATTERN = 'gray-50'

export interface ShellState {
  /** The application whose menus the bar holds. */
  frontApp: AppId
  /** A kit pattern name (`gray-50`, `bricks`, …) or sixteen hex digits, as
   *  vf-desktop's `pattern` takes. */
  desktopPattern: string
}

export function createShell() {
  const store = createStore<ShellState>({
    frontApp: FINDER,
    desktopPattern: DEFAULT_DESKTOP_PATTERN,
  })
  return {
    store,
    get: store.get,
    subscribe: store.subscribe,

    /** Called only by shell/windows.ts. */
    setFrontApp(id: string): void {
      const frontApp = (APP_IDS.includes(id) ? id : FINDER) as AppId
      if (store.get().frontApp === frontApp) return
      store.patch({ frontApp })
    },

    /** Not validated here. shell/desktop-pattern.ts validates a restored
     *  value. */
    setDesktopPattern(v: string | null | undefined): void {
      const next = String(v ?? '').trim() || DEFAULT_DESKTOP_PATTERN
      if (store.get().desktopPattern === next) return
      store.patch({ desktopPattern: next })
    },
  }
}

export const shell = createShell()
