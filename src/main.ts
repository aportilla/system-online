// Composition root: the shell (system-online-sdk) over the page's desktop,
// with SystemOnline's five applications and its system's fonts (fonts.ts),
// the About box, and the startup curtain lifted once the desktop is composed.
// The Text Viewer, Desktop Patterns, the Font Viewer and Meteors come from
// their app files in apps/, built in by vite.config.ts's appFiles(); the Text
// Viewer is handed the built-in texts' words (texts/). An app file dropped or
// pasted in the Finder installs, through the shell's trust: one SystemOnline
// signed without asking, any other once the visitor says so.
//
// The shell fits the desktop to the viewport, keeps the catalog in IndexedDB
// and the session in localStorage, and reopens the last session's windows.
// ?fresh=1 boots the desktop a first visit sees: the catalog in memory, the
// session neither read nor written, so a reload forgets both. A desktop from
// before the System Folder is given its defaults once, after the boot, and
// one from before its Fonts has its suitcases filed there once.

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
import { FONTS_FILED, SYSTEM_GIVEN, fileFonts, finder, giveSystemFolder } from './apps/finder/index.ts'
import { builtinText } from './texts/index.ts'
import textViewer from '../apps/Text Viewer.png?app'
import desktopPatterns from '../apps/Desktop Patterns.png?app'
import fontViewer from '../apps/Font Viewer.png?app'
import meteors from '../apps/Meteors.png?app'

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
  extra: { [GREET]: true, [SYSTEM_GIVEN]: false, [FONTS_FILED]: false },
})
const shell = createShell(desktop, {
  apps: [
    finder({ storage: fresh ? memoryStorage() : indexedDbStorage('system-online') }),
    textViewer({ builtinText }),
    desktopPatterns(),
    fontViewer(),
    meteors(),
  ],
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

// A load that reopens no window greets with the About box.
void shell.ready.then(() => {
  if (about.greets() && !desktop.stackingOrder.some((w) => w instanceof VfWindow)) about.show()
})

// The seed never runs again for a desktop from before the System Folder, so
// the Finder stores what it lacks of the System Folder's defaults, once, and
// files the suitcases of one from before its Fonts there, once.
void shell.ready.then(() => giveSystemFolder(shell.catalog, state))
void shell.ready.then(() => fileFonts(shell.catalog, state))

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
