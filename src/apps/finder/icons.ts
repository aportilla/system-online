// Finder icon layer: reconciles the files slice into vf-icons in each
// container's field (#desktop-icons for the desktop, one field per open folder
// window).
//
// - Keys are folder:<id>, text:<id> and font:<id>. Macintosh HD and the Trash
//   are the synthetic folder rows folder:hd and folder:trash.
// - Positions are the icons' left/top properties in system px, in the
//   container's coordinates. desktop-state.ts persists them by key through
//   positions().
// - Filing is the kit's icon drag. A drop into another container moves the
//   model, and the reconciler re-creates the icon there.

import {
  prefersReducedMotion,
  snapSys,
  systemPxQuantum,
  WINDOW_RECT_STEP_MS,
  WINDOW_RECT_STEPS,
  WINDOW_RECTS_VISIBLE,
} from 'vintage-frames'
import type { VfDesktop, VfIcon, VfIconDragDetail, VfIconField, VfWindow } from 'vintage-frames'
import folderArtUrl from './art/folder.png'
import trashArtUrl from './art/trash.png'
import trashFullArtUrl from './art/trash-full.png'
import textArtUrl from './art/text-file.png'
import { files, childrenOf, enclosingFolders, isInside, itemCount, HD, TRASH } from '../../state/files.ts'
import type { FilesState } from '../../state/files.ts'
import { shell, FINDER } from '../../state/shell.ts'
import { pinOf, pinTo, MENU_BAR } from '../../shell/layout.ts'
import type { Pin, Point, Size } from '../../shell/layout.ts'
import type { WindowManager } from '../../shell/windows.ts'
import type { Apps } from '../index.ts'
import type { FolderWindows } from './windows.ts'
import {
  cleanUp as cleanUpOnto,
  desktopLattice,
  fillOrder,
  folderLattice,
  latticeSlot,
  trashDefault,
  ICON_CELL,
  ICON_FRAME,
} from './layout.ts'
import type { Lattice } from './layout.ts'

// Stand-in art for Macintosh HD and the font suitcases, served from public/.
const PLACEHOLDER_ART = `${import.meta.env.BASE_URL}icons/app-icon.png`

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
// The beat between opens when one command opens several icons: one run of a
// window's zoom rects, so each window draws before the next opens.
const OPEN_BEAT_MS = (WINDOW_RECT_STEPS + WINDOW_RECTS_VISIBLE) * WINDOW_RECT_STEP_MS
const FOLDER = 'folder:'
const TEXT = 'text:'
const FONT = 'font:'

type Kind = 'folder' | 'hd' | 'trash' | 'text' | 'font'

/** Splits an icon key into its kind prefix and id. */
const idOf = (key: string) => key.slice(key.indexOf(':') + 1)

export function initIcons(
  desktop: VfDesktop,
  {
    windows,
    folders,
    apps,
    savedPos = () => null,
    showError,
  }: {
    windows: WindowManager
    folders: FolderWindows
    /** The registry's actions by id, read at each open. */
    apps: Apps
    savedPos?: (key: string) => Point | null
    showError: (message: string) => void
  }
) {
  const desktopField = desktop.querySelector('#desktop-icons') as VfIconField
  const teardown: (() => void)[] = []
  const on = (el: EventTarget, type: string, fn: (e: Event) => void, opts?: boolean) => {
    el.addEventListener(type, fn, opts)
    teardown.push(() => el.removeEventListener(type, fn, opts))
  }

  /** Icons in every container: the desktop field and open folder windows. */
  const allIcons = () => [...desktop.querySelectorAll<VfIcon>('vf-icon[data-key]')]
  const iconsIn = (root: Element) => [...root.querySelectorAll<VfIcon>(':scope > vf-icon[data-key]')]
  const iconByKey = (key: string) =>
    desktop.querySelector<VfIcon>(`vf-icon[data-key="${CSS.escape(key)}"]`)
  const keyOf = (icon: VfIcon) => icon.dataset.key as string
  const posOf = (icon: VfIcon): Point => ({ left: icon.left ?? 0, top: icon.top ?? 0 })

  // Selection.
  const selectionListeners = new Set<() => void>()
  const movedListeners = new Set<() => void>()
  const notifySelection = () => {
    for (const fn of selectionListeners) fn()
  }
  on(desktop, 'vf-select', notifySelection)

  // A press in the desktop field makes the Finder front. shell/windows.ts
  // handles the rest of the desktop host.
  on(desktopField, 'pointerdown', () => desktop.clearActive())

  // Clear the icon selection when another application's window becomes active.
  teardown.push(
    shell.subscribe(() => {
      if (shell.get().frontApp === FINDER) return
      const lit = allIcons().filter((icon) => icon.selected)
      if (!lit.length) return
      for (const icon of lit) icon.selected = false
      notifySelection()
    })
  )

  // Workaround: vf-icon deselects on any outside pointerdown, including presses
  // on the menu bar, menus and dialogs. The document capture listener records
  // the selected icons. It is registered at wire-up so it runs before the
  // icons' own listeners, which attach on selection. The desktop capture
  // listener runs later in the same dispatch and re-selects them.
  const CHROME = 'vf-menu-bar, vf-menu, vf-dialog'
  let held: VfIcon[] = []
  on(
    document,
    'pointerdown',
    (e) => {
      held = e.composedPath().some((n) => n instanceof Element && n.matches(CHROME))
        ? allIcons().filter((icon) => icon.selected)
        : []
    },
    true
  )
  on(
    desktop,
    'pointerdown',
    () => {
      if (!held.length) return
      for (const icon of held) icon.selected = true
      held = []
      notifySelection()
    },
    true
  )

  // Positions.
  /** Icon positions from folder windows closed this session, by key. */
  const remembered = new Map<string, Point>()
  /** Items filed but not yet rendered in their new container: the drop
   *  position, or null for the next free cell. Their saved position belongs to
   *  the old container and is ignored. */
  const pending = new Map<string, Point | null>()
  teardown.push(
    folders.onWillClose((_id, field) => {
      for (const icon of iconsIn(field)) remembered.set(keyOf(icon), posOf(icon))
    })
  )

  // Lattices.
  /** A container's lattice: the desktop's, or a folder window's at its
   *  current viewport width. */
  const gridFor = (folder: string | null): Lattice =>
    folder == null
      ? desktopLattice(desktop.width, desktop.height)
      : folderLattice(folders.viewportOf(folder)?.width ?? 0)
  const rootOf = (folder: string | null): VfIconField | null =>
    folder == null ? desktopField : (folders.fields().find(([id]) => id === folder)?.[1] ?? null)
  /** The first lattice cell no icon in `root` but `self` overlaps. A cell is
   *  taken when any icon's 64px cell covers part of it, so off-lattice icons
   *  also block it. */
  function nextFree(root: Element, folder: string | null, self: VfIcon | null = null): Point {
    const grid = gridFor(folder)
    const taken = iconsIn(root)
      .filter((icon) => icon !== self)
      .map(posOf)
    for (let slot = 0; slot < 4096; slot++) {
      const p = latticeSlot(grid, slot)
      const blocked = taken.some(
        (t) => Math.abs(t.left - p.left) < ICON_CELL && Math.abs(t.top - p.top) < ICON_CELL
      )
      if (!blocked) return p
    }
    return latticeSlot(grid, 0)
  }

  /** Write a position onto an icon. On the desktop it is snapped and clamped
   *  on-raster below the menu bar, so a position saved on a larger raster stays
   *  reachable. In a window it is kept at or past the plane's origin. */
  function place(icon: VfIcon, folder: string | null, pos: Point) {
    if (folder == null) {
      const k = systemPxQuantum(icon)
      const down = (v: number) => Math.floor(v / k) * k
      const minTop = Math.ceil(MENU_BAR / k) * k
      icon.left = clamp(snapSys(pos.left, icon), 0, Math.max(0, down(desktop.width - ICON_CELL)))
      icon.top = clamp(snapSys(pos.top, icon), minTop, Math.max(minTop, down(desktop.height - ICON_CELL)))
    } else {
      icon.left = snapSys(Math.max(0, pos.left), icon)
      icon.top = snapSys(Math.max(0, pos.top), icon)
    }
  }

  // Icons.
  /** Install or swap an icon's 32×32 art. */
  function setArt(icon: VfIcon, src: string) {
    let img = icon.querySelector('vf-img > img') as HTMLImageElement | null
    if (!img) {
      const wrap = document.createElement('vf-img')
      wrap.slot = 'large'
      wrap.width = 32
      wrap.height = 32
      img = document.createElement('img')
      img.alt = ''
      wrap.append(img)
      icon.append(wrap)
    }
    if (img.getAttribute('src') !== src) img.src = src
  }

  function makeIcon(key: string, label: string, root: Element, folder: string | null, kind: Kind): VfIcon {
    const icon = document.createElement('vf-icon')
    icon.dataset.key = key
    icon.label = label
    icon.width = 64
    icon.selectable = true
    icon.movable = true
    icon.editable = kind !== 'trash' && kind !== 'hd'
    // data-folder marks a drop target: folders, Macintosh HD and the Trash.
    if (kind === 'folder' || kind === 'hd' || kind === 'trash') icon.dataset.folder = idOf(key)
    root.append(icon) // before place(): the snap reads the live scale
    // Precedence: a pending filing, a remembered position, a saved one, then
    // the default.
    const fallback = () =>
      kind === 'trash' ? trashDefault(desktop.width, desktop.height) : nextFree(root, folder, icon)
    const pos = pending.has(key)
      ? (pending.get(key) ?? fallback())
      : (remembered.get(key) ?? savedPos(key) ?? fallback())
    pending.delete(key)
    remembered.delete(key)
    place(icon, folder, pos)
    return icon
  }

  /** A rename that storage refused puts the old name back. */
  const renamed = (icon: VfIcon, rename: (label: string) => Promise<unknown>) => (e: Event) => {
    const { label, previous } = (e as CustomEvent<{ label: string; previous: string }>).detail
    rename(label).catch(() => {
      icon.label = previous
    })
  }

  // Each open reads the icon's box at the gesture, for the window's zoom rects.
  function wire(icon: VfIcon, kind: Kind, id: string) {
    const from = () => icon.cellRect()
    if (kind === 'text') {
      icon.addEventListener('vf-open', () => void apps['text-viewer']?.open(id, { from: from() }))
      icon.addEventListener('vf-change', renamed(icon, (l) => files.renameItem('text', id, l)))
    } else if (kind === 'font') {
      icon.addEventListener('vf-open', () => void apps['font-viewer']?.open(id, { from: from() }))
      icon.addEventListener('vf-change', renamed(icon, (l) => files.renameItem('font', id, l)))
    } else {
      icon.addEventListener('vf-open', () => folders.open(id, { from: from() }))
      icon.addEventListener('vf-change', renamed(icon, (l) => files.renameFolder(id, l)))
    }
  }

  // Reconciler.
  // Each root holds exactly the icons of its container's items. A moved item is
  // removed and re-created in its new root if that root is open. An icon's open
  // ghost follows its window, and stays while a closing window's zoom rects run
  // into it (holdGhost): the count of holds by key.
  const ghostHolds = new Map<string, number>()
  const folderArt = (st: FilesState, kind: Kind) =>
    kind === 'hd'
      ? PLACEHOLDER_ART
      : kind === 'trash'
        ? itemCount(st, TRASH)
          ? trashFullArtUrl
          : trashArtUrl
        : folderArtUrl
  function sync() {
    const st = files.get()
    const roots: [string | null, VfIconField][] = [[null, desktopField], ...folders.fields()]
    for (const [folder, root] of roots) {
      const kids = childrenOf(st, folder)
      const wanted = new Map<string, { kind: Kind; name: string; id: string }>()
      for (const f of kids.folders) {
        const kind: Kind = f.id === HD ? 'hd' : f.id === TRASH ? 'trash' : 'folder'
        wanted.set(`${FOLDER}${f.id}`, { kind, name: f.name, id: f.id })
      }
      for (const t of kids.texts) wanted.set(`${TEXT}${t.id}`, { kind: 'text', name: t.name, id: t.id })
      for (const t of kids.fonts) wanted.set(`${FONT}${t.id}`, { kind: 'font', name: t.name, id: t.id })
      for (const icon of iconsIn(root)) if (!wanted.has(keyOf(icon))) icon.remove()
      for (const [key, { kind, name, id }] of wanted) {
        let icon = root.querySelector<VfIcon>(`:scope > vf-icon[data-key="${CSS.escape(key)}"]`)
        if (!icon) {
          icon = makeIcon(key, name, root, folder, kind)
          wire(icon, kind, id)
        }
        if (icon.label !== name) icon.label = name
        const holding = ghostHolds.has(key)
        if (kind === 'text') {
          setArt(icon, textArtUrl)
          icon.open = holding || windows.isOpen(key)
        } else if (kind === 'font') {
          setArt(icon, PLACEHOLDER_ART)
          icon.open = holding || windows.isOpen(key)
        } else {
          setArt(icon, folderArt(st, kind))
          icon.open = holding || folders.isOpen(id)
        }
      }
      // The field's size is the window's scroll range.
      if (folder != null) folders.fit(folder)
    }
  }
  teardown.push(files.subscribe(sync), folders.onChange(sync), windows.onWindows(sync))
  sync()

  // Filing.
  /** What the pointer is over, skipping the dragged icons. elementsFromPoint
   *  also returns covered elements, so the stack is read only down to the
   *  first vf-window. `win` is that window, `window` the folder it shows (null
   *  for another application's), and `desktop` is true where no window covers
   *  the point. */
  const under = (x: number, y: number, skip: Element[]) => {
    const stack = document.elementsFromPoint(x, y).filter((el) => !skip.includes(el))
    const front = stack.findIndex((el) => el.localName === 'vf-window')
    const seen = front < 0 ? stack : stack.slice(0, front)
    const folderIcon =
      (seen.find(
        (el) => el.localName === 'vf-icon' && (el as HTMLElement).dataset.folder != null
      ) as VfIcon | undefined) ?? null
    const win = front < 0 ? null : (stack[front] as VfWindow)
    return {
      folderIcon,
      folder: folderIcon ? (folderIcon.dataset.folder as string) : null,
      win,
      window: win ? folders.folderOf(win) : null,
      desktop: !win && stack.includes(desktop),
    }
  }
  /** Whether a set can be filed into `folder`. A set holding Macintosh HD or
   *  the Trash never can, and a folder never goes into itself or a
   *  descendant. */
  const canFile = (icons: VfIcon[], folder: string | null) => {
    if (icons.some((icon) => icon.dataset.folder === TRASH || icon.dataset.folder === HD)) return false
    if (folder == null) return true
    const st = files.get()
    return icons.every((icon) => {
      const f = icon.dataset.folder
      return f == null || (f !== folder && !isInside(st, folder, f))
    })
  }
  /** The folder icon with `target` set, or null. */
  let target: VfIcon | null = null
  const highlight = (next: VfIcon | null) => {
    if (target === next) return
    if (target) target.target = false
    target = next
    if (target) target.target = true
  }
  /**
   * Move a set into a container. Each key's landing (null: the next free cell)
   * goes into `pending` for the reconciler, then the model is updated. An item
   * already in `folder` does not move and its landing is dropped.
   */
  async function file(entries: { icon: VfIcon; at: Point | null }[], folder: string | null) {
    for (const { icon, at } of entries) {
      const key = keyOf(icon)
      pending.set(key, at)
      remembered.delete(key)
    }
    try {
      for (const { icon } of entries) {
        const key = keyOf(icon)
        const id = idOf(key)
        const moved = key.startsWith(FOLDER)
          ? await files.moveFolder(id, folder)
          : await files.moveItem(key.startsWith(TEXT) ? 'text' : 'font', id, folder)
        if (!moved) pending.delete(key)
      }
    } catch (err) {
      for (const { icon } of entries) pending.delete(keyOf(icon))
      showError(`The items couldn’t be moved: ${(err as Error).message}.`)
    }
  }
  on(desktop, 'vf-drag', (e) => {
    const { clientX, clientY, icons } = (e as CustomEvent<VfIconDragDetail>).detail
    const hit = under(clientX, clientY, icons)
    highlight(hit.folderIcon && canFile(icons, hit.folder) ? hit.folderIcon : null)
  })
  on(desktop, 'vf-drag-cancel', () => highlight(null))
  on(desktop, 'vf-drop', (e) => {
    const leader = e.target as VfIcon
    const { clientX, clientY, x, y, icons } = (e as CustomEvent<VfIconDragDetail>).detail
    const hit = under(clientX, clientY, icons)
    highlight(null)
    const from = folders.folderOf(leader) // null for the desktop
    // Each member's drop point: its box offset by the leader's delta. Measured
    // before anything moves.
    const lead = leader.getBoundingClientRect()
    const landings = icons.map((icon) => {
      const r = icon.getBoundingClientRect()
      return { icon, x: r.left + (x - lead.left), y: r.top + (y - lead.top) }
    })
    if (hit.folder != null) {
      // Onto a folder icon: file into its next free cells if allowed.
      e.preventDefault()
      if (canFile(icons, hit.folder)) {
        void file(
          landings.map(({ icon }) => ({ icon, at: null })),
          hit.folder
        )
      }
      return
    }
    if (hit.win && hit.window == null) {
      // Over another application's window: nothing moves.
      e.preventDefault()
      return
    }
    if (hit.win && hit.window != null && hit.window !== from) {
      // Into a folder window from elsewhere: at each drop point on its plane.
      e.preventDefault()
      if (!canFile(icons, hit.window)) return
      const win = hit.win
      void file(
        landings.map(({ icon, x: lx, y: ly }) => {
          const p = win.placementAt(lx, ly)
          return { icon, at: { left: Math.max(0, p.left), top: Math.max(0, p.top) } }
        }),
        hit.window
      )
      return
    }
    if (hit.desktop && from != null) {
      // From a window onto the desktop: at each drop point, below the menu bar.
      e.preventDefault()
      void file(
        landings.map(({ icon, x: lx, y: ly }) => {
          const p = desktop.placementAt(lx, ly)
          return { icon, at: { left: Math.max(0, p.left), top: Math.max(MENU_BAR, p.top) } }
        }),
        null
      )
    }
    // Otherwise the drop is within the source container and the kit moves it.
  })

  /** Per-icon nine-slice pin, with the left/top this path last wrote. A
   *  mismatch means the icon was dragged or is new, so its pin is re-derived.
   *  Re-deriving from the snapped position on every event would drift. */
  const pins = new WeakMap<VfIcon, { pin: Pin } & Point>()
  const CELL: Size = { width: ICON_CELL, height: ICON_CELL }
  /** Re-pin every desktop icon on a raster resize, with the nine-slice pin in
   *  ICON_FRAME and the 64px cell as a fixed size. No clamp, so resizing back
   *  restores every position. */
  const repinIcons = (before: Size, after: Size) => {
    // dragIcons([]) finishes a Clean Up walk synchronously, so the pins read
    // the icons' final positions.
    void desktopField.dragIcons([])
    for (const icon of iconsIn(desktopField)) {
      const cur = { ...posOf(icon), ...CELL }
      let rec = pins.get(icon)
      const pin = !rec || rec.left !== cur.left || rec.top !== cur.top ? pinOf(cur, before, ICON_FRAME) : rec.pin
      const pos = pinTo(pin, after, ICON_FRAME, { size: CELL })
      icon.left = snapSys(pos.left, icon)
      icon.top = snapSys(pos.top, icon)
      rec = { pin, left: icon.left, top: icon.top }
      pins.set(icon, rec)
    }
  }
  teardown.push(windows.onRaster(repinIcons))

  const api = {
    /** Every known position by key: live icons over remembered ones, and null
     *  for an item filed but not yet rendered. desktop-state.ts merges it. */
    positions(): Record<string, Point | null> {
      const out: Record<string, Point | null> = {}
      for (const [key, p] of remembered) out[key] = p
      for (const key of pending.keys()) out[key] = null
      for (const icon of allIcons()) out[keyOf(icon)] = posOf(icon)
      return out
    },
    /** The box a window showing `key` closes into, in viewport CSS px: the
     *  item's icon, else the nearest folder around it whose icon is rendered.
     *  Null once the item's record is gone. */
    iconBox(key: string): DOMRect | null {
      const own = iconByKey(key)?.cellRect()
      if (own) return own
      const st = files.get()
      const id = idOf(key)
      const within = key.startsWith(FOLDER)
        ? st.folders.find((f) => f.id === id)?.parent
        : key.startsWith(TEXT)
          ? st.texts.find((t) => t.id === id)?.folder
          : st.fonts.find((t) => t.id === id)?.folder
      if (within === undefined) return null
      for (const folder of enclosingFolders(st, within)) {
        const box = iconByKey(`${FOLDER}${folder}`)?.cellRect()
        if (box) return box
      }
      return null
    },
    /** Keeps `key`'s icon drawn open until `until` settles, while a closing
     *  window's zoom rects run into it. */
    holdGhost(key: string, until: Promise<unknown>): void {
      ghostHolds.set(key, (ghostHolds.get(key) ?? 0) + 1)
      sync()
      const release = () => {
        const n = ghostHolds.get(key)
        if (n == null) return // disposed
        if (n > 1) ghostHolds.set(key, n - 1)
        else ghostHolds.delete(key)
        sync()
      }
      until.then(release, release)
    },
    /** Select an item's icon and open its rename box. */
    startRename(key: string): void {
      const icon = iconByKey(key)
      if (!icon) return
      icon.setSelected(true)
      icon.startEditing()
    },
    /** The selected icons' keys, excluding Macintosh HD and the Trash, in
     *  listing order: folders, text files, then fonts. */
    selection(): string[] {
      const lit = new Set(allIcons().filter((icon) => icon.selected).map(keyOf))
      const st = files.get()
      return [
        ...st.folders.filter((f) => f.id !== HD && f.id !== TRASH).map((f) => `${FOLDER}${f.id}`),
        ...st.texts.map((t) => `${TEXT}${t.id}`),
        ...st.fonts.map((t) => `${FONT}${t.id}`),
      ].filter((key) => lit.has(key))
    },
    /** The selected icons' keys, Macintosh HD and the Trash included. */
    selectedKeys(): string[] {
      return allIcons().filter((icon) => icon.selected).map(keyOf)
    },
    /** Open every selected icon, the route a double-click or a tap pair takes.
     *  Several open a beat apart, so each window's zoom rects finish before
     *  the next begin; one opens at once, and so do all of them under reduced
     *  motion. An icon gone by its turn is skipped. */
    async openSelection(): Promise<void> {
      const beat = prefersReducedMotion() ? 0 : OPEN_BEAT_MS
      for (const [i, key] of api.selectedKeys().entries()) {
        if (i && beat) await new Promise((done) => setTimeout(done, beat))
        iconByKey(key)?.dispatchEvent(new CustomEvent('vf-open'))
      }
    },
    /** Make `keys` the selection and clear every other icon. */
    select(keys: string[]): void {
      const want = new Set(keys)
      for (const icon of allIcons()) icon.setSelected(want.has(keyOf(icon)))
      notifySelection()
    },
    /** Select every icon in a container's field (null: the desktop). */
    selectAll(folder: string | null): void {
      const root = rootOf(folder)
      if (!root) return
      api.select(iconsIn(root).map(keyOf))
    },
    /** Move every icon of one container (null: the desktop) to the nearest
     *  free cell of its lattice. The kit's dragIcons walks them in fill order. */
    async cleanUp(folder: string | null): Promise<void> {
      const root = rootOf(folder)
      if (!root) return
      const grid = gridFor(folder)
      const icons = iconsIn(root)
      const cells = cleanUpOnto(grid, icons.map(posOf))
      const moves = icons
        .map((icon, i) => ({ icon, ...(cells[i] as Point) }))
        .sort((a, b) => fillOrder(grid, a, b))
      await root.dragIcons(moves)
      if (folder != null) folders.fit(folder)
      for (const fn of movedListeners) fn()
    },
    /** Icons moved without a pointer gesture (a finished Clean Up). Returns the
     *  unsubscribe. */
    onMoved(fn: () => void): () => void {
      movedListeners.add(fn)
      return () => {
        movedListeners.delete(fn)
      }
    },
    /** The selection changed. Returns the unsubscribe. */
    onSelectionChange(fn: () => void): () => void {
      selectionListeners.add(fn)
      return () => {
        selectionListeners.delete(fn)
      }
    },
    dispose(): void {
      for (const fn of teardown) fn()
      selectionListeners.clear()
      movedListeners.clear()
      ghostHolds.clear()
      highlight(null)
      // Remove the icons so an HMR re-init starts without stale listeners.
      // Folder windows' icons go with folders.dispose().
      desktopField.replaceChildren()
    },
  }
  return api
}

export type Icons = ReturnType<typeof initIcons>
