// The Finder: the kit's stock Finder (vintage-frames/shell) over SystemOnline's
// library. Macintosh HD and the Trash are its volumes, the default files its
// seed, and Special gains Restore Default Files, then Back Up All Files… and
// Restore from Backup… (backup.ts).

import { finder as stockFinder } from 'vintage-frames/shell'
import type { AppDefinition, CatalogStorage, FinderApi } from 'vintage-frames/shell'
import folderArt from './art/folder.png'
import trashArt from './art/trash.png'
import trashFullArt from './art/trash-full.png'
import trashMarkArt from './art/trash-indicator.png'
import textArt from '../text-viewer/art/text-file.png'
import { CHARSET_FAMILIES } from '../../charset-manifest.ts'
import { missingDefaults, restoreDefaults } from '../../state/defaults.ts'
import { TEXTS } from '../../texts/index.ts'
import { initBackup } from './backup.ts'

// Stand-in art for Macintosh HD, served from public/.
const DISK_ART = `${import.meta.env.BASE_URL}icons/app-icon.png`

/** Every family the app ships, a suitcase each. */
const FAMILIES = CHARSET_FAMILIES.map((f) => f.label)

/** `storage`: where the catalog is kept, or null for nothing (?fresh=1). */
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
    },
    volumes: { disk: 'Macintosh HD', trash: 'Trash' },
    seed: (catalog) => restoreDefaults(catalog, TEXTS, FAMILIES),
    extend(finder, ctx) {
      const { catalog } = finder
      finder.addCommand({
        menu: 'special',
        value: 'restore-defaults',
        label: 'Restore Default Files',
        separator: true,
        run: () => {
          restoreDefaults(catalog, TEXTS, FAMILIES).catch((err: Error) => {
            void ctx.alert(`Restore Default Files failed: ${err.message}.`)
          })
        },
        // A trashed or renamed default counts as present.
        enabled: () => {
          const st = catalog.get()
          const missing = missingDefaults(st, TEXTS, FAMILIES)
          return st.available && missing.texts.length + missing.fonts.length > 0
        },
      })
      initBackup(finder, ctx)
    },
  })
}
