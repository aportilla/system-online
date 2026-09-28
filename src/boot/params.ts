// Parses URL params into the boot options. Pure (no DOM).
// ?fresh=1 boots a clean desktop: no library, no desktop state read or written.

export function parseBootParams(search: string): { fresh: boolean } {
  const params = new URLSearchParams(search)
  return { fresh: params.get('fresh') === '1' }
}
