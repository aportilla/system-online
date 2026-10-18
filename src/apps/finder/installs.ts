// The Finder's install alerts, answered in SystemOnline's words with its own
// dialogs (dialogs.html): an app file SystemOnline's key didn't sign, one
// whose application is already on the desktop, one the shell refused, and an
// application's icon that won't open. Each is the SDK's alert (its
// docs/SHELL.md § The Finder's alerts); the shell decides, and this says it.

import { APP_API, APP_API_OLDEST } from 'system-online-sdk'
import type { AppContext, AppManifest, FinderApi } from 'system-online-sdk'
import { ask } from '../windows.ts'

/** Why an application built for another app API doesn't run here, as the end
 *  of a sentence; the shell's reason when its level isn't the trouble. */
function apiWords(manifest: AppManifest | null, reason: string): string {
  if (manifest && manifest.api > APP_API) return 'it needs a newer system'
  if (manifest && manifest.api < APP_API_OLDEST) return 'it was made for an older system'
  return reason
}

export function initInstalls(finder: FinderApi, ctx: AppContext): void {
  const alert = ctx.dialog('alert')
  const untrusted = ctx.dialog('untrusted')
  const replace = ctx.dialog('replace')

  // The manifest's author is the file's own say, so it's given as that.
  finder.alertWith('untrusted-application', ({ manifest, standing }) =>
    ask(
      ctx,
      untrusted,
      `“${manifest.name}”, which says it’s by ${manifest.author}, ` +
        (standing === 'unsigned' ? 'isn’t signed, so SystemOnline can’t vouch for it. ' : 'is signed by someone SystemOnline doesn’t know. ') +
        'Once it’s installed, it can read and change everything on this desktop. Install it anyway?'
    )
  )

  // Only what SystemOnline signed is offered updates.
  finder.alertWith('replace-application', ({ manifest, installed, standing }) =>
    ask(
      ctx,
      replace,
      (installed != null
        ? `“${manifest.name}” ${installed} is already on this desktop. Replace it with version ${manifest.version}?`
        : `“${manifest.name}” is already on this desktop. Install version ${manifest.version} for it?`) +
        (standing === 'trusted' ? '' : ' SystemOnline didn’t sign this copy, so it won’t be offered updates.')
    )
  )

  finder.alertWith('install-refused', ({ name, manifest, why, reason }) => {
    const because = why === 'built-in' && manifest ? `${manifest.name} is built into SystemOnline` : why === 'api' ? apiWords(manifest, reason) : reason
    return ask(ctx, alert, `“${name}” couldn’t be installed, because ${because}.`)
  })

  finder.alertWith('application-unavailable', ({ item, manifest, why, reason }) =>
    ask(ctx, alert, `“${manifest?.name ?? item.name}” can’t be opened, because ${why === 'api' ? apiWords(manifest, reason) : reason}.`)
  )
}
