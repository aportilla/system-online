// Composition root: parses the boot params, fits the desktop raster, wires the
// library, the shell and the applications, lifts the startup curtain and
// reopens the session.

// Imported first: boot/curtain.ts lifts the curtain on window load even if this
// module throws.
import { liftCurtain } from './boot/curtain.ts'
import 'vintage-frames'
import { applyCursor, onScaleChange } from 'vintage-frames'
import type { VfDesktop } from 'vintage-frames'
import './page.css'
import './desktop.css'
import { CHARSET_FAMILIES } from './charset-manifest.ts'
import { parseBootParams } from './boot/params.ts'
import { restoreSession } from './boot/restore.ts'
import { files } from './state/files.ts'
import { restoreDefaults } from './state/defaults.ts'
import { createStorageIfAvailable } from './storage/db.ts'
import { TEXTS, builtinText } from './texts/index.ts'
import { initWindows } from './shell/windows.ts'
import { initMenuBar } from './shell/menu-bar.ts'
import { initClock } from './shell/clock.ts'
import { initDesktopPattern } from './shell/desktop-pattern.ts'
import { createDesktopState } from './shell/desktop-state.ts'
import type { Size } from './shell/layout.ts'
import { initDropTarget } from './drop-target.ts'
import { APPS, DEFAULT_APP } from './apps/index.ts'

const boot = parseBootParams(location.search)

// Desktop raster and cursor. fitWithin() fits the largest whole raster to the
// viewport on resize and scale change, and each fit re-pins windows and icons.
// Not debounced, so windows track the raster during a resize.
const desktop = document.getElementById('desktop') as VfDesktop
/** Set to the window manager's re-pin once the shell is wired. */
let repinDesktop = (_before: Size) => {}
const fitDesktop = () => {
  const before = { width: desktop.width, height: desktop.height }
  desktop.fitWithin(document.documentElement.clientWidth, document.documentElement.clientHeight)
  repinDesktop(before)
}
fitDesktop()
window.addEventListener('resize', fitDesktop)
const offScale = onScaleChange(fitDesktop)
const removeCursor = applyCursor()

// The library takes its browser dependencies here so it stays Node-testable. A
// font's size is its strikes' bytes; a family the app no longer ships has none.
// ?fresh=1 reads and writes nothing.
const FAMILIES = CHARSET_FAMILIES.map((f) => f.label)
files.init({
  storage: boot.fresh ? null : createStorageIfAvailable(),
  builtinText,
  fontSize: (label) => {
    const family = CHARSET_FAMILIES.find((f) => f.label === label)
    return family ? family.fonts.reduce((sum, f) => sum + (__FONT_BYTES__[f.file] ?? 0), 0) : null
  },
})
const dstate = createDesktopState(boot.fresh)
// No writes until bootDesktop() has reopened the session.
dstate.hold()

// Shell.
const windows = initWindows(desktop)
// Restores the saved pattern before the desktop's first render.
const desktopPattern = initDesktopPattern(desktop, { saved: dstate.desktopPattern() })
// The menu bar and the applications (src/apps).
const menuBar = initMenuBar(
  desktop,
  { apps: APPS, defaultApp: DEFAULT_APP },
  {
    windows,
    iconPos: dstate.iconPos,
    windowPin: dstate.windowPin,
    greet: dstate.greet,
    setGreet: dstate.setGreet,
  }
)
const apps = menuBar.apps
const clock = initClock(document.getElementById('clock') as HTMLElement)
// Safe to bind here: no resize event can fire before this synchronous top level
// finishes.
repinDesktop = (before) => windows.onDesktopResized(before)
const stopPersist = dstate.start({
  readIcons: () => apps.finder?.positions() ?? {},
  // Each application reports its own windows. The keys are disjoint.
  readWindows: () => ({
    ...apps.finder?.pins(),
    ...apps['text-viewer']?.pins(),
    ...apps['font-viewer']?.pins(),
  }),
  onMoved: (fn) => apps.finder?.onMoved(fn) ?? (() => {}),
})
const disposeDrop = initDropTarget({ onArchive: (file) => apps.finder?.receiveArchive(file) })

// The desktop is composed, so lift the startup curtain. The session below waits
// on IndexedDB and is not awaited.
void liftCurtain()

// HMR teardown. Vite re-runs this module without unloading the old instance, so
// everything wired above is disposed. The store singletons persist.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeDrop()
    // Applications before the window manager: each removes its own windows.
    menuBar.dispose()
    windows.dispose()
    clock.dispose()
    desktopPattern.dispose()
    stopPersist()
    window.removeEventListener('resize', fitDesktop)
    offScale()
    removeCursor()
  })
}

// The session, in order:
//   1. Read the library. An unseeded profile stores the default files, then
//      sets the seeded flag, so an interrupted seeding runs again next boot.
//   2. Reopen the windows the last session left open, deepest first, each at
//      its saved pin (boot/restore.ts).
//   3. With nothing reopened, show the About box, unless Show at startup is
//      off.
// The desktop state is held throughout and released at the end, however this
// goes, so no half-restored desktop is written.
async function bootDesktop(): Promise<void> {
  try {
    await files.refresh()
    if (files.get().available && !dstate.seeded()) {
      await restoreDefaults(files, TEXTS, FAMILIES)
      dstate.markSeeded()
    }
    const restored = await restoreSession(dstate.openWindows(), dstate.activeWindow(), {
      folder: (id) => apps.finder?.openFolder(id),
      text: (id) => apps['text-viewer']?.open(id),
      font: (id) => apps['font-viewer']?.open(id),
    })
    if (!restored && dstate.greet()) menuBar.showAbout()
  } finally {
    dstate.release()
  }
}

void bootDesktop()
