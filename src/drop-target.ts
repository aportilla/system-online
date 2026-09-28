// A backup dropped anywhere on the page. Any other file is refused, so the
// browser does not navigate to it.

const dragHasFiles = (e: DragEvent) =>
  !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')

/** A backup archive, by name or type. */
const isArchive = (f: File) => /\.zip$/i.test(f.name) || f.type === 'application/zip'

/** `onArchive` receives a dropped zip, which the Finder answers for. Returns
 *  the teardown. */
export function initDropTarget({ onArchive }: { onArchive: (file: File) => void }): () => void {
  const body = document.body
  const onDragOver = (e: DragEvent) => {
    if (dragHasFiles(e)) e.preventDefault()
  }
  const onDrop = (e: DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f && isArchive(f)) onArchive(f)
  }
  body.addEventListener('dragover', onDragOver)
  body.addEventListener('drop', onDrop)
  return () => {
    body.removeEventListener('dragover', onDragOver)
    body.removeEventListener('drop', onDrop)
  }
}
