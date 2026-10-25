// The Finder: system-online-sdk's stock Finder over SystemOnline's library.
// Macintosh HD and the Trash are its volumes, with the System Folder on
// Macintosh HD, whose Fonts installs the suitcases of the families the system
// serves (src/fonts.ts); the default files, suitcases and applications are
// its seed, each application installed from its app file in apps/, and
// Special gains Restore Default Files, then Back Up All Files… and Restore
// from Backup… (backup.ts). The stock alerts carry the caution art; the ones
// SystemOnline adds, and its answers to the Finder's install alerts
// (installs.ts), are in dialogs.html.

import { FONTS, TRASH, finder as stockFinder } from 'system-online-sdk'
import type {
  AppDefinition,
  AppManifest,
  Catalog,
  CatalogStorage,
  FinderApi,
  Install,
  Point,
  Shell,
  ShellState,
} from 'system-online-sdk'
import dialogs from './dialogs.html?raw'
import folderArt from './art/folder.png'
import systemFolderArt from './art/system-folder.png'
import appleMenuItemsArt from './art/apple-menu-items.png'
import startupItemsArt from './art/startup-items.png'
import trashArt from './art/trash.png'
import trashFullArt from './art/trash-full.png'
import trashMarkArt from './art/trash-indicator.png'
import textArt from './art/text-file.png'
import { FONT_FAMILIES } from '../../fonts.ts'
import { CONTROL_PANELS_FOLDER, formerFonts, missingDefaults, moveToInstalled, restoreDefaults } from '../../state/defaults.ts'
import type { Defaults, Home, InstallDefault } from '../../state/defaults.ts'
import { TEXTS } from '../../texts/index.ts'
import meteorsFile, { manifest as meteors } from '../../../apps/Meteors.png?app-file'
import storeFile, { manifest as store } from '../../../apps/App Store.png?app-file'
import patternsFile, { manifest as desktopPatterns } from '../../../apps/Desktop Patterns.png?app-file'
import textViewerFile, { manifest as textViewer } from '../../../apps/Text Viewer.png?app-file'
import fontViewerFile, { manifest as fontViewer } from '../../../apps/Font Viewer.png?app-file'
import { ask } from '../windows.ts'
import { initBackup } from './backup.ts'
import { initInstalls } from './installs.ts'

// Served from public/: stand-in art for Macintosh HD and a font suitcase, and
// the alerts' caution art, which dialogs.html shares.
const DISK_ART = `${import.meta.env.BASE_URL}icons/app-icon.png`
const SUITCASE_ART = `${import.meta.env.BASE_URL}icons/app-icon.png`
const CAUTION_ART = `${import.meta.env.BASE_URL}icons/alert.png`

/** The applications a desktop comes with: each one's file, the index's signed
 *  copy in apps/, its manifest, its home, and its alias in Apple Menu Items.
 *  App Store… is an alias of the store's icon, as today's Apple menu has it. */
const APPS: { file: string; manifest: AppManifest; home: Home; alias?: string }[] = [
  { file: meteorsFile, manifest: meteors, home: 'desktop' },
  { file: storeFile, manifest: store, home: 'desktop', alias: `${store.name}…` },
  { file: patternsFile, manifest: desktopPatterns, home: 'control-panels' },
  { file: textViewerFile, manifest: textViewer, home: 'disk' },
  { file: fontViewerFile, manifest: fontViewer, home: 'disk' },
]

/** What a desktop comes with: Read Me, Meteors and the App Store on the
 *  desktop; About the Fonts, the Text Viewer and the Font Viewer in Macintosh
 *  HD; a suitcase for every family the system serves, in the System Folder's
 *  Fonts; and Desktop Patterns in the System Folder's Control Panels, which
 *  Apple Menu Items holds an alias of: Apple ▸ Control Panels ▸ Desktop
 *  Patterns, as System 7.5 had it. Startup Items starts empty. */
const DEFAULTS: Defaults = {
  texts: TEXTS,
  apps: APPS.map(({ manifest, home, alias }) => ({ app: manifest.id, home, ...(alias ? { alias } : {}) })),
  families: FONT_FAMILIES.map((f) => f.name),
  appleMenu: [CONTROL_PANELS_FOLDER],
}

/** The defaults' install over the shell's: fetches a default application's
 *  file and installs it, rejecting with why it didn't install. */
function installer(install: Install): InstallDefault {
  return async ({ app }, options) => {
    const entry = APPS.find((a) => a.manifest.id === app)
    if (!entry) return
    const { name } = entry.manifest
    const res = await fetch(entry.file).catch(() => null)
    if (!res?.ok) throw new Error(`${name} couldn’t be read`)
    const answer = await install(await res.arrayBuffer(), options)
    if (answer.status === 'refused') throw new Error(`${name} couldn’t be installed, because ${answer.reason}`)
  }
}

/** The session key set once a desktop has been given the System Folder's
 *  defaults (giveSystemFolder). */
export const SYSTEM_GIVEN = 'system-folder'

/**
 * Give a desktop from before the System Folder its defaults, once: Desktop
 * Patterns in Control Panels, and Apple ▸ Control Panels. The seed never runs
 * again for such a desktop, so without this its Apple menu would lose Desktop
 * Patterns. Only what is missing is stored, and a new desktop's seed has
 * stored it all. Called once the boot is done; without storage it waits for
 * a boot that has it.
 */
export async function giveSystemFolder(shell: Pick<Shell, 'catalog' | 'install'>, state: ShellState): Promise<void> {
  const { catalog } = shell
  if (!catalog?.get().available || state.get(SYSTEM_GIVEN)) return
  await restoreDefaults(
    catalog,
    {
      texts: [],
      apps: DEFAULTS.apps.filter((a) => a.home === 'control-panels'),
      families: [],
      appleMenu: DEFAULTS.appleMenu,
    },
    { install: installer(shell.install) }
  )
  state.set(SYSTEM_GIVEN, true)
}

/** The session key set once a desktop's suitcases are in the System Folder's
 *  Fonts (fileFonts). */
export const FONTS_FILED = 'fonts-folder'

/**
 * File a desktop's suitcases from before the System Folder had Fonts there,
 * once: each one in Macintosh HD → Fonts moves, keeping its id, so an open
 * font window and its aliases follow, and its place; that folder, left
 * empty, goes to the Trash (formerFonts). Called once the boot is done;
 * without storage it waits for a boot that has it.
 */
export async function fileFonts(catalog: Catalog | null, state: ShellState): Promise<void> {
  if (!catalog?.get().available || state.get(FONTS_FILED)) return
  const { suitcases, folder } = formerFonts(catalog.get().items)
  const places = new Map<string, Point | null>(
    suitcases.map((i) => [i.id, i.left != null && i.top != null ? { left: i.left, top: i.top } : null])
  )
  await catalog.move([...places.keys()], FONTS, places)
  if (folder != null) await catalog.move([folder], TRASH)
  state.set(FONTS_FILED, true)
}

/** The session key set once a desktop has been moved onto installed
 *  applications (installApps). */
export const APPS_INSTALLED = 'apps-installed'

/**
 * Move a desktop from before nothing was built in onto installed
 * applications, once (moveToInstalled): its system documents by path,
 * Meteors' and Desktop Patterns' icons given their files, and the Text
 * Viewer, the Font Viewer and the App Store installed at their homes. Its
 * first boot after the change loads no application but the Finder, so each
 * one's windows from the last visit reopen as it installs. Called once the
 * boot is done; without storage it waits for a boot that has it, and a move
 * that fails is tried again at the next.
 */
export async function installApps(shell: Pick<Shell, 'catalog' | 'install' | 'installed'>, state: ShellState): Promise<void> {
  const { catalog } = shell
  if (!catalog?.get().available || state.get(APPS_INSTALLED)) return
  await moveToInstalled(catalog, DEFAULTS, {
    // The applications whose icons a desktop had while they were built in.
    had: [meteors.id, desktopPatterns.id],
    kept: (id) => shell.installed().some((a) => a.id === id && a.source === 'installed'),
    install: installer(shell.install),
  })
  state.set(APPS_INSTALLED, true)
}

/** `storage`: where the catalog is kept, or null for nothing. */
export function finder({ storage }: { storage: CatalogStorage | null }): AppDefinition<FinderApi> {
  return stockFinder({
    storage,
    // A document with no art of its own looks like a text file. Fonts takes
    // the folder's art until its own is drawn.
    art: {
      folder: folderArt,
      systemFolder: systemFolderArt,
      appleMenuItems: appleMenuItemsArt,
      startupItems: startupItemsArt,
      trash: trashArt,
      trashFull: trashFullArt,
      trashMark: trashMarkArt,
      document: textArt,
      suitcase: SUITCASE_ART,
      disk: DISK_ART,
      caution: CAUTION_ART,
    },
    volumes: { disk: 'Macintosh HD', trash: 'Trash' },
    system: { folder: 'System Folder', appleMenu: 'Apple Menu Items', startup: 'Startup Items', fonts: 'Fonts' },
    // A seed that rejects would stop the boot, so one that doesn't install
    // says so, and Restore Default Files brings it back.
    seed: (catalog, install) =>
      restoreDefaults(catalog, DEFAULTS, { install: installer(install) }).catch((err: Error) => {
        console.warn(`SystemOnline: a default didn’t install: ${err.message}`)
      }),
    dialogs,
    extend(finder, ctx) {
      const { catalog } = finder
      finder.addCommand({
        menu: 'special',
        value: 'restore-defaults',
        label: 'Restore Default Files',
        separator: true,
        run: () => {
          restoreDefaults(catalog, DEFAULTS, { install: installer(ctx.install) }).catch((err: Error) => {
            void ask(ctx, ctx.dialog('alert'), `Restore Default Files failed: ${err.message}.`)
          })
        },
        // A trashed or renamed default counts as present.
        enabled: () => {
          const st = catalog.get()
          const missing = missingDefaults(st, DEFAULTS)
          const count = Object.values(missing).reduce((n, list) => n + list.length, 0)
          return st.available && count > 0
        },
      })
      initBackup(finder, ctx, DEFAULTS, installer(ctx.install))
      initInstalls(finder, ctx)
    },
  })
}
