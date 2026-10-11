// The Finder: system-online-sdk's stock Finder over SystemOnline's library.
// Macintosh HD and the Trash are its volumes, with the System Folder on
// Macintosh HD; the default files and application icons are its seed, and
// Special gains Restore Default Files, then Back Up All Files… and Restore
// from Backup… (backup.ts). The stock alerts carry the caution art; the ones
// SystemOnline adds are in dialogs.html.

import { finder as stockFinder } from 'system-online-sdk'
import type { AppDefinition, Catalog, CatalogStorage, FinderApi, ShellState } from 'system-online-sdk'
import dialogs from './dialogs.html?raw'
import folderArt from './art/folder.png'
import systemFolderArt from './art/system-folder.png'
import appleMenuItemsArt from './art/apple-menu-items.png'
import startupItemsArt from './art/startup-items.png'
import trashArt from './art/trash.png'
import trashFullArt from './art/trash-full.png'
import trashMarkArt from './art/trash-indicator.png'
import textArt from '../text-viewer/art/text-file.png'
import { CHARSET_FAMILIES } from '../../charset-manifest.ts'
import { CONTROL_PANELS_FOLDER, missingDefaults, restoreDefaults } from '../../state/defaults.ts'
import type { Defaults } from '../../state/defaults.ts'
import { TEXTS } from '../../texts/index.ts'
import { manifest as desktopPatterns } from '../../../apps/Desktop Patterns.png?app'
import { manifest as meteors } from '../../../apps/Meteors.png?app'
import { ask } from '../windows.ts'
import { initBackup } from './backup.ts'

// Served from public/: stand-in art for Macintosh HD, and the alerts' caution
// art, which dialogs.html shares.
const DISK_ART = `${import.meta.env.BASE_URL}icons/app-icon.png`
const CAUTION_ART = `${import.meta.env.BASE_URL}icons/alert.png`

/** What a desktop comes with: the built-in texts, Meteors' icon on the
 *  desktop, a suitcase for every family the app ships, and Desktop Patterns
 *  in the System Folder's Control Panels, which Apple Menu Items holds an
 *  alias of: Apple ▸ Control Panels ▸ Desktop Patterns, as System 7.5 had
 *  it. Both applications are named by their app files' manifests. Startup
 *  Items starts empty. */
const DEFAULTS: Defaults = {
  texts: TEXTS,
  apps: [
    { app: meteors.id, name: meteors.name, home: 'desktop' },
    { app: desktopPatterns.id, name: desktopPatterns.name, home: 'control-panels' },
  ],
  families: CHARSET_FAMILIES.map((f) => f.label),
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

/** `storage`: where the catalog is kept, or null for nothing. */
export function finder({ storage }: { storage: CatalogStorage | null }): AppDefinition<FinderApi> {
  return stockFinder({
    storage,
    // A document with no art of its own looks like a text file.
    art: {
      folder: folderArt,
      systemFolder: systemFolderArt,
      appleMenuItems: appleMenuItemsArt,
      startupItems: startupItemsArt,
      trash: trashArt,
      trashFull: trashFullArt,
      trashMark: trashMarkArt,
      document: textArt,
      disk: DISK_ART,
      caution: CAUTION_ART,
    },
    volumes: { disk: 'Macintosh HD', trash: 'Trash' },
    system: { folder: 'System Folder', appleMenu: 'Apple Menu Items', startup: 'Startup Items' },
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
    },
  })
}
