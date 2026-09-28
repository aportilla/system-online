// Reopens the windows the last session left open (shell/desktop-state.ts
// openWindows), deepest first, so the stacking comes back with them. Each
// window's box is its owner's business: the application reads the saved pin as
// it adopts.

/** Splits a desktop-state key ("text:<id>") into its kind and id, or null. */
function parseKey(key: string | null): { kind: string; id: string } | null {
  const at = typeof key === 'string' ? key.indexOf(':') : -1
  if (at <= 0 || key == null) return null
  return { kind: key.slice(0, at), id: key.slice(at + 1) }
}

/** The owners' opens by key kind. Each resolves truthy when a window opened. */
export type Openers = Record<string, (id: string) => unknown>

/** Opens `open` in order, then `active` again so it ends on top. Resolves
 *  whether any window opened. */
export async function restoreSession(
  open: { key: string }[],
  active: string | null,
  openers: Openers
): Promise<boolean> {
  let opened = false
  for (const { key } of open) {
    const it = parseKey(key)
    const fn = it ? openers[it.kind] : undefined
    if (!it || !fn) continue
    if (await fn(it.id)) opened = true
  }
  // Every open raises its own window, so the saved active one is raised last.
  const it = parseKey(active)
  const fn = it ? openers[it.kind] : undefined
  if (it && fn) await fn(it.id)
  return opened
}
