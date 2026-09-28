// Writes shell.desktopPattern (a kit pattern name or sixteen hex digits) to
// vf-desktop's `pattern`. Runs synchronously before the desktop's first render,
// so a restored pattern does not flash the default dither.

import { parsePattern } from 'vintage-frames'
import type { VfDesktop } from 'vintage-frames'
import { shell } from '../state/shell.ts'

/** `saved`: the last session's pattern (desktop-state.ts), restored only if
 *  parsePattern accepts it. */
export function initDesktopPattern(desktop: VfDesktop, { saved = null }: { saved?: string | null } = {}) {
  if (saved != null && parsePattern(saved) !== null) shell.setDesktopPattern(saved)
  const apply = () => {
    const v = shell.get().desktopPattern
    if (desktop.pattern !== v) desktop.pattern = v
  }
  const unsubscribe = shell.subscribe(apply)
  apply()
  return {
    dispose(): void {
      unsubscribe()
    },
  }
}
