// Clipboard slice: the Finder's copied item references and the text/plain
// written to the system clipboard for them. Session-only. The references are
// not pruned, so a paste skips removed items.

import { createStore } from './store.ts'

export interface ClipboardItemRef {
  kind: 'folder' | 'text' | 'font'
  id: string
}
export interface ClipboardState {
  items: ClipboardItemRef[]
  /** The text/plain written to the system clipboard for these items; '' when
   *  nothing is copied. */
  text: string
}

/** Normalizes line endings and trailing whitespace, which a clipboard round
 *  trip may change. */
const norm = (s: string | null | undefined) =>
  String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .trimEnd()

/**
 * What a paste uses: 'items' when the system clipboard's text matches the
 * slice's, or when the system clipboard is unreadable (null) and the slice has
 * items. Otherwise 'none'.
 */
export function pasteSource(slice: ClipboardState, system: { text: string | null } | null): 'items' | 'none' {
  const held = slice.items.length > 0
  if (!held) return 'none'
  if (system == null) return 'items'
  return system.text != null && norm(system.text) === norm(slice.text) ? 'items' : 'none'
}

export function createClipboard() {
  const store = createStore<ClipboardState>({ items: [], text: '' })
  return {
    store,
    get: store.get,
    subscribe: store.subscribe,

    /** Record a copy: the item references, in order, and the text written to
     *  the system clipboard for them. */
    set(items: ClipboardItemRef[], text: string): void {
      store.patch({ items: items.map((it) => ({ kind: it.kind, id: it.id })), text })
    },

    clear(): void {
      store.patch({ items: [], text: '' })
    },
  }
}

export const clipboard = createClipboard()
