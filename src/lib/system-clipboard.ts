// The system clipboard's text, for a paste: the Async Clipboard API for ⌘V and
// a menu pick, and the paste event's clipboardData for the browser's own
// Edit → Paste.

/** The system clipboard's first text/plain, or null when absent; null in
 *  place of the whole result when the clipboard cannot be read. */
export async function readSystemClipboard(): Promise<{ text: string | null } | null> {
  if (!navigator.clipboard?.readText) return null
  try {
    return { text: await navigator.clipboard.readText() }
  } catch {
    return null
  }
}

/** Writes text/plain to the system clipboard. Failures are silent. */
export async function writeSystemClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard?.writeText?.(text)
  } catch {
    // The in-app clipboard still holds the copy.
  }
}
