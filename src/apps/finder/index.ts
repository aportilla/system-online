// The Finder: system-online-sdk's stock Finder over SystemOnline's library.
// Macintosh HD and the Trash are its volumes, with the System Folder on
// Macintosh HD, whose Fonts installs the suitcases of the families the system
// serves (src/fonts.ts); the default files, suitcases and application icons
// are its seed, and Special gains Restore Default Files, then Back Up All
// Files… and Restore from Backup… (backup.ts). The stock alerts carry the
// caution art; the ones SystemOnline adds, and its answers to the Finder's
// install alerts (installs.ts), are in dialogs.html.

import { FONTS, TRASH, finder as stockFinder } from 'system-online-sdk'
import type { AppDefinition, Catalog, CatalogStorage, FinderApi, Point, ShellState } from 'system-online-sdk'
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
import { CONTROL_PANELS_FOLDER, formerFonts, missingDefaults, restoreDefaults } from '../../state/defaults.ts'
import type { Defaults } from '../../state/defaults.ts'
import { TEXTS } from '../../texts/index.ts'
import { manifest as desktopPatterns } from '../../../apps/Desktop Patterns.png?app'
import { manifest as meteors } from '../../../apps/Meteors.png?app'
import { ask } from '../windows.ts'
import { initBackup } from './backup.ts'
import { initInstalls } from './installs.ts'

// Served from public/: stand-in art for Macintosh HD and a font suitcase, and
// the alerts' caution art, which dialogs.html shares.
const DISK_ART = `${import.meta.env.BASE_URL}icons/app-icon.png`
const SUITCASE_ART = `${import.meta.env.BASE_URL}icons/app-icon.png`
const CAUTION_ART = `${import.meta.env.BASE_URL}icons/alert.png`

/** What a desktop comes with: the built-in texts, Meteors' icon on the
 *  desktop, a suitcase for every family the system serves, in the System
 *  Folder's Fonts, and Desktop Patterns in the System Folder's Control
 *  Panels, which Apple Menu Items holds an alias of: Apple ▸ Control Panels ▸
 *  Desktop Patterns, as System 7.5 had it. Both applications are named by
 *  their app files' manifests. Startup Items starts empty. */
const DEFAULTS: Defaults = {
  texts: TEXTS,
  apps: [
    { app: meteors.id, name: meteors.name, home: 'desktop' },
    { app: desktopPatterns.id, name: desktopPatterns.name, home: 'control-panels' },
  ],
  families: FONT_FAMILIES.map((f) => f.name),
  appleMenu: [CONTROL_PANELS_FOLDER],
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
export async function giveSystemFolder(catalog: Catalog | null, state: ShellState): Promise<void> {
  if (!catalog?.get().available || state.get(SYSTEM_GIVEN)) return
  await restoreDefaults(catalog, {
    texts: [],
    apps: DEFAULTS.apps.filter((a) => a.home === 'control-panels'),
    families: [],
    appleMenu: DEFAULTS.appleMenu,
  })
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
    seed: (catalog) => restoreDefaults(catalog, DEFAULTS),
    dialogs,
    extend(finder, ctx) {
      const { catalog } = finder
      finder.addCommand({
        menu: 'special',
        value: 'restore-defaults',
        label: 'Restore Default Files',
        separator: true,
        run: () => {
          restoreDefaults(catalog, DEFAULTS).catch((err: Error) => {
            void ask(ctx, ctx.dialog('alert'), `Restore Default Files failed: ${err.message}.`)
          })
        },
        // A trashed or renamed default counts as present.
        enabled: () => {
          const st = catalog.get()
          const missing = missingDefaults(st, DEFAULTS)
          const count = missing.texts.length + missing.apps.length + missing.fonts.length + missing.appleMenu.length
          return st.available && count > 0
        },
      })
      initBackup(finder, ctx, DEFAULTS)
      initInstalls(finder, ctx)
    },
  })
}
