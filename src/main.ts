// Composition root: the shell (vintage-frames/shell) over the page's desktop,
// with SystemOnline's four applications, the About box, and the startup
// curtain lifted once the desktop is composed.
//
// The shell fits the desktop to the viewport, keeps the catalog in IndexedDB
// and the session in localStorage, and reopens the last session's windows.
// ?fresh=1 boots a clean desktop that reads and writes neither.

// Imported first: boot/curtain.ts lifts the curtain on window load even if this
// module throws.
import { liftCurtain } from './boot/curtain.ts'
import 'vintage-frames'
import { VfWindow, applyCursor } from 'vintage-frames'
import type { VfDesktop } from 'vintage-frames'
import { createShell, indexedDbStorage, localStorageState } from 'vintage-frames/shell'
import './page.css'
import './desktop.css'
import { GREET, initAbout } from './about.ts'
import { finder } from './apps/finder/index.ts'
import { textViewer } from './apps/text-viewer/index.ts'
import { desktopPatterns } from './apps/desktop-patterns/index.ts'
import { fontViewer } from './apps/font-viewer/index.ts'

const fresh = new URLSearchParams(location.search).get('fresh') === '1'
const desktop = document.getElementById('desktop') as VfDesktop

const removeCursor = applyCursor()
// page.css turns off zoom with touch-action. As a backup, this cancels
// gesturestart, the pinch event only WebKit sends, in case Safari lets a pinch
// through anyway.
const onGestureStart = (e: Event) => e.preventDefault()
document.addEventListener('gesturestart', onGestureStart)

// The session reads ?fresh=1 itself.
const state = localStorageState('system-online:desktop', { extra: { [GREET]: true } })
const shell = createShell(desktop, {
  apps: [
    finder({ storage: fresh ? null : indexedDbStorage('system-online') }),
    textViewer(),
    desktopPatterns(),
    fontViewer(),
  ],
  fit: 'viewport',
  state,
})
const about = initAbout(desktop, state)

// The desktop is composed, so lift the startup curtain. The boot below waits
// on IndexedDB and is not awaited.
void liftCurtain()

// A load that reopens no window greets with the About box.
void shell.ready.then(() => {
  if (about.greets() && !desktop.stackingOrder.some((w) => w instanceof VfWindow)) about.show()
})

// HMR teardown. Vite re-runs this module without unloading the old instance,
// so everything wired above is disposed.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    about.dispose()
    shell.dispose()
    document.removeEventListener('gesturestart', onGestureStart)
    removeCursor()
  })
}
