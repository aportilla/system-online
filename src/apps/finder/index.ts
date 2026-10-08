// The Finder: the kit's stock Finder (vintage-frames/shell) over SystemOnline's
// library. Macintosh HD and the Trash are its volumes, the default files and
// application icons its seed, and Special gains Restore Default Files, then
// Back Up All Files… and Restore from Backup… (backup.ts). The stock alerts
// carry the caution art; the ones SystemOnline adds are in dialogs.html.

import { finder as stockFinder } from 'vintage-frames/shell'
import type { AppDefinition, CatalogStorage, FinderApi } from 'vintage-frames/shell'
import dialogs from './dialogs.html?raw'
import folderArt from './art/folder.png'
import trashArt from './art/trash.png'
import trashFullArt from './art/trash-full.png'
import trashMarkArt from './art/trash-indicator.png'
import textArt from '../text-viewer/art/text-file.png'
import { CHARSET_FAMILIES } from '../../charset-manifest.ts'
import { missingDefaults, restoreDefaults } from '../../state/defaults.ts'
import type { Defaults } from '../../state/defaults.ts'
import { TEXTS } from '../../texts/index.ts'
import { manifest as meteors } from '../../../apps/Meteors.png?app'
import { ask } from '../windows.ts'
import { initBackup } from './backup.ts'

// Served from public/: stand-in art for Macintosh HD, and the alerts' caution
// art, which dialogs.html shares.
const DISK_ART = `${import.meta.env.BASE_URL}icons/app-icon.png`
const CAUTION_ART = `${import.meta.env.BASE_URL}icons/alert.png`

/** What a desktop comes with: the built-in texts, Meteors' icon on the
 *  desktop, named by its app file's manifest, and a suitcase for every
 *  family the app ships. */
const DEFAULTS: Defaults = {
  texts: TEXTS,
  apps: [{ app: meteors.id, name: meteors.name, home: 'desktop' }],
  families: CHARSET_FAMILIES.map((f) => f.label),
}

/** `storage`: where the catalog is kept, or null for nothing. */
export function finder({ storage }: { storage: CatalogStorage | null }): AppDefinition<FinderApi> {
  return stockFinder({
    storage,
    // A document with no art of its own looks like a text file.
    art: {
      folder: folderArt,
      trash: trashArt,
      trashFull: trashFullArt,
      trashMark: trashMarkArt,
      document: textArt,
      disk: DISK_ART,
      caution: CAUTION_ART,
    },
    volumes: { disk: 'Macintosh HD', trash: 'Trash' },
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
          return st.available && missing.texts.length + missing.apps.length + missing.fonts.length > 0
        },
      })
      initBackup(finder, ctx, DEFAULTS.apps)
    },
  })
}
