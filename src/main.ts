// Composition root: the shell (system-online-sdk) over the page's desktop,
// with the Finder and the system's fonts (fonts.ts), the About box, and the
// startup curtain lifted once the desktop is composed. Nothing else is built
// in: every other application is an app file installed at runtime, through
// the shell's trust, one SystemOnline signed without asking and any other
// once the visitor says so. A new desktop installs the defaults from their
// files in apps/ (apps/finder/), and a file dropped or pasted in the Finder
// installs the same way.
//
// The shell fits the desktop to the viewport, keeps the catalog and what's
// installed in IndexedDB and the session in localStorage, and reopens the
// last session's windows. ?fresh=1 boots the desktop a first visit sees: the
// catalog in memory, the session neither read nor written, so a reload
// forgets both. Once the boot is done, a desktop from before the System
// Folder is given its defaults, one from before its Fonts has its suitcases
// filed there, and one from before nothing was built in is moved onto
// installed applications, each once.

// Imported first: boot/curtain.ts lifts the curtain on window load even if this
// module throws.
import { liftCurtain } from './boot/curtain.ts'
import 'vintage-frames'
import { VfWindow, applyCursor } from 'vintage-frames'
import type { VfDesktop } from 'vintage-frames'
import { createShell, indexedDbStorage, localStorageState, memoryStorage } from 'system-online-sdk'
import './page.css'
import './desktop.css'
import { GREET, initAbout } from './about.ts'
import { FONT_FAMILIES } from './fonts.ts'
import { APPS_INSTALLED, FONTS_FILED, SYSTEM_GIVEN, fileFonts, finder, giveSystemFolder, installApps } from './apps/finder/index.ts'

const fresh = new URLSearchParams(location.search).get('fresh') === '1'
const desktop = document.getElementById('desktop') as VfDesktop

// SystemOnline's public key, which the index's scripts/signing.ts holds too.
// The private key is a file on the machine that signs, never in a repo.
const TRUST = { keys: ['lN1OZiOf2BlaY7GUL7IcAFKNQ81uml1/vuR8ktRqLMM='], otherwise: 'ask' } as const
// The index of app files the shell hands applications (ctx.index): the live
// one, or the one VITE_INDEX names at build. Never read from the address.
const INDEX: string = import.meta.env.VITE_INDEX || 'https://apps.portill.io/index.json'

const removeCursor = applyCursor()
// page.css turns off zoom with touch-action. As a backup, this cancels
// gesturestart, the pinch event only WebKit sends, in case Safari lets a pinch
// through anyway.
const onGestureStart = (e: Event) => e.preventDefault()
document.addEventListener('gesturestart', onGestureStart)

// The session reads ?fresh=1 itself.
const state = localStorageState('system-online:desktop', {
  extra: { [GREET]: true, [SYSTEM_GIVEN]: false, [FONTS_FILED]: false, [APPS_INSTALLED]: false },
})
const shell = createShell(desktop, {
  apps: [finder({ storage: fresh ? memoryStorage() : indexedDbStorage('system-online') })],
  fonts: FONT_FAMILIES,
  fit: 'viewport',
  state,
  trust: TRUST,
  index: INDEX,
})
const about = initAbout(desktop, state)

// The desktop is composed, so lift the startup curtain. The boot below waits
// on IndexedDB and is not awaited.
void liftCurtain()

// The seed never runs again for a desktop from before, so the Finder brings
// it up to date, each step once, in order: what it lacks of the System
// Folder's defaults, the suitcases of one from before Fonts filed there, and
// its applications installed. A step that fails says so, and the next boot
// tries it again. Then a load that reopens no window greets with the About
// box: after the steps, since a desktop from before reopens its windows as
// its applications install.
void shell.ready.then(async () => {
  const moves = [() => giveSystemFolder(shell, state), () => fileFonts(shell.catalog, state), () => installApps(shell, state)]
  for (const move of moves) {
    await move().catch((err: Error) => console.warn(`SystemOnline: a desktop from before wasn’t brought up to date: ${err.message}`))
  }
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
