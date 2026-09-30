# The desktop — what's on it and why

`index.html` + `src/`, served by `vite` from the repo root. A System 7 desktop
with four applications (the Finder, the Text Viewer, Desktop Patterns and the
Font Viewer) over one shell, built on nothing but the published
`vintage-frames` package and held to the same contract as anyone else's app.
The application model is sprite-machine's, ported (docs/app-model-plan.md).

## The shell

`index.html` is one `<vf-desktop>` fitted to the viewport at boot: the menu
bar, the desktop's icon field and the shared dialogs, under the kit's
page-drawn cursor and a startup curtain that lifts once the kit's faces have
loaded. Each application authors its windows in its own directory and appends
them on open.

1. **Applications.** Each is one directory under `src/apps/` (`finder`,
   `text-viewer`, `desktop-patterns`, `font-viewer`) holding its menus
   (`menus.html`, a fragment of `vf-menu` elements), its windows
   (`windows.html` templates, `windows.ts` lifecycle, `layout.ts` pure
   placement) and an `index.ts` exporting an id, a name, the fragment and
   `init({ menus, deps })`, which returns the application's actions and a
   dispose. `src/apps/index.ts` lists the four. Applications import
   `src/shell/`, never the reverse, and call one another through
   `deps.apps`, read at pick time.
2. **The front application** is the application of the desktop's active
   window, or the Finder when none is active. `shell/windows.ts` writes it to
   `shell.frontApp` from the `app` each owner passes to `windows.adopt`. A
   press on the desktop or its icon field calls `desktop.clearActive()`, so
   the Finder comes forward.
3. **The menu bar** holds the Apple menu, then the front application's menus,
   then the clock. `shell/menu-bar.ts` parses each fragment once and moves the
   same nodes on and off the bar, so item state is kept and a detached menu's
   key equivalents are off: only the front application's items fire. The bar's
   accessible name is the front application's.

   ```
   Finder            │ Apple  File  Edit  View  Special          5:31 PM │
   Text Viewer       │ Apple  File  Edit  View                   5:31 PM │
   Desktop Patterns  │ Apple  File  View                         5:31 PM │
   Font Viewer       │ Apple  File  Edit  View  Size             5:31 PM │
   ```

   Key equivalents come from the kit's `shortcuts` (Ctrl stands in for ⌘
   off-Mac). The browser keeps ⌘W, ⌘Q and ⌘N, so Close and Quit take ⌃W and ⌃Q.
   Every handler returns while a dialog is open, since key equivalents fire
   app-wide.
4. **The Apple menu** is on the bar in every application: _About
   SystemOnline…_, a rule, then the items applications install in it through
   `deps.appleMenu` (Desktop Patterns), the way a control panel sat in the
   Apple Menu Items folder.
5. **The clock** shows the time, updated on the minute; a press shows the
   date for three seconds. It takes no focus and keeps the icon selection.
6. **Windows.** Every window enters through `windows.adopt` with its
   application, placement, saved pin, resize policy, a box it keeps across a
   resize, and the item it shows, and leaves through `windows.dismiss(win,
   to)`. Every movable window drags as an outline (`outline-drag`). A window
   that shows a file opens out of its icon and closes back into it with the
   kit's zoom rects (`show({ from })`, `hide({ to })`), the icon ghosted until
   they land; a window opened from a menu comes and goes at once. New windows
   cascade from `WINDOW_ORIGIN` into the first slot no open window holds,
   whatever its application.
7. **The resize rule.** On a browser resize every window and every desktop
   icon re-pins by the nine-slice pin (`shell/layout.ts` `pinOf` / `pinTo`):
   an edge near a raster edge keeps its offset, an edge in the middle keeps its
   fraction, nothing clamps, so a shrink and grow-back returns everything
   exactly. A resizable window larger than the open area shrinks to fit.
8. **View → Arrange Windows** (⌘J), in every application, re-applies every
   window's placement; it is greyed while every visible window sits at its
   own.
9. **The desktop state** (`shell/desktop-state.ts`, one versioned
   localStorage key) holds the icon positions, every window's box as a pin
   with its depth while open, the active window, the desktop pattern, the About
   box's Show at startup and whether the default files have been stored. A
   reload reopens the windows that were open, deepest first, the active one
   last. `?fresh=1` neither reads nor writes it, and uses no library.
10. **The About box** (Apple menu → About SystemOnline…) is a `frame="plain"
    light-dismiss` dialog with the version and HEAD's commit date, a link
    button to Vintage Frames on npm, and **Show at startup**, which greets a
    load that reopens no window.

## The library

`src/state/files.ts` over IndexedDB (`src/storage/db.ts`, database
`system-online`): folders, text files and fonts.

11. **Macintosh HD and the Trash** are containers with no record, always
    listed. Neither can be renamed, moved, copied or removed. Nothing can be
    made in the Trash; deleting is a move into it, and only Empty Trash…
    removes anything.
12. **A text file** stores its text, or the key of a text the app ships
    (`src/texts/`), whose words are always the app's. **A font** stores its
    family; the strikes are the app's (`public/fonts/imported/`), and its size
    is their bytes. A record whose built-in the app no longer ships is left
    out of the listing.
13. **The defaults**: Read Me on the desktop, and in Macintosh HD a Fonts
    folder of one suitcase per family and About the Fonts. A new profile
    stores them once; **Special → Restore Default Files** stores any missing
    since, a trashed or renamed one counting as present.
14. **Back Up All Files…** downloads the library as one zip whose tree reads as
    the desktop (`macintosh-hd/`, `trash/`, folders as directories, texts as
    `.txt`) with a `desktop.json` manifest; fonts are manifest rows alone.
    **Restore from Backup…**, or the zip dropped on the page, asks whether to
    Add it beside the desktop or Replace the desktop with it.
15. Without IndexedDB (a private window) the desktop holds Macintosh HD and
    the Trash, and every command that would store explains why it can't.

## The Finder

16. **Icons.** Every item has a `vf-icon` in its container's field: the
    desktop's filled field, or the field of its folder's open window. The
    desktop lattice runs down the right edge from Macintosh HD, with the Trash
    in the bottom-right corner; a new item takes its container's first free
    cell, and a saved position wins. Rename in place (not Macintosh HD or the
    Trash), the rubber band, and one selection across every container are the
    kit's. A press on the menu bar keeps the selection (a bridge: the kit's
    icon clears it on any outside press).
17. **Filing is the drag.** A drop onto a folder icon files the set at its next
    free cells, into another folder's window where each outline was let go,
    and from a window onto the desktop the same. The folder under the pointer
    wears `target`. A folder never goes into itself or a descendant, Macintosh
    HD and the Trash never move, and a drop over another application's window
    does nothing.
18. **Folder windows** are `movable outline-drag resizable scrollbars="both"`,
    the item count in the header (with the trash mark in the Trash and a
    trashed folder), the field sized to hold every icon.
19. **Menus.** File: _Open_ ⌘O (the selection, a beat apart), _New Folder_,
    _Close_ ⌃W. Edit: _Copy_ ⌘C and _Paste_ ⌘V (item references, the names on
    the system clipboard; a paste copies folders whole and names copies
    "Name copy", "Name copy 2"), _Select All_ ⌘A; all three greyed while a
    text field has focus. View: _Arrange Windows_ ⌘J. Special: _Clean Up
    Desktop_ / _Window_ (the kit's walk to the nearest free cells), _Empty
    Trash…_ (an alert with the count and the K they use), _Restore Default
    Files_, _Back Up All Files…_, _Restore from Backup…_.

## The Text Viewer

20. One window per text file: `movable outline-drag resizable zoomable
    scrollbars="vertical"`, 440 × 320, the text verbatim in one body-face
    paragraph that keeps its line breaks and wraps at the window. The zoom box
    toggles a reading column at most 520 wide. A rename retitles it; emptying
    its file from the Trash closes it. File: _Close_, _Quit_ (every text
    window). Edit: _Copy_ (greyed without a selection in a text window),
    _Select All_. View: _Arrange Windows_.

## Desktop Patterns

21. Apple menu → Desktop Patterns opens one fixed, centered panel: a preview
    well, a 13 × 3 chooser of the kit's 38 patterns, and a default **Set
    Desktop Pattern**. A click (or the arrow keys) previews a pattern and rings
    its cell, 1px black over the edge and 1px white inside; only the button
    sets the desktop's, which persists. Closing discards an unset choice. Every
    piece is a kit element, the ring eight 1px `vf-container`s. File: _Close_,
    _Quit_. View: _Arrange Windows_.

## The Font Viewer

22. One window per suitcase: `movable outline-drag resizable zoomable
    scrollbars="vertical"`, titled with the suitcase's name. It sets System 7's
    sample line, _How razorback-jumping frogs can level six piqued gymnasts!_,
    in every strike of the family, smallest first, then under a rule every
    character the chosen strike carries (ASCII, accented Latin, the rest),
    each paragraph in the strike itself at its rect and measured pitch, so
    nothing on it is another font's fallback. The status strip names the
    strike and counts its characters. It opens on the strike nearest 12.
23. The **Size** menu lists the active window's strikes, _9 Point_ … (_16
    Pixels_ for a family the collection still names by line height), the
    current one checked. Strikes load on demand through the FontFace API
    (`strikes.ts`) under the wristwatch; a missing woff2 says so in place.
    File: _Close_, _Quit_. Edit: _Copy_, _Select All_. View: _Arrange
    Windows_. See [FONTS.md](FONTS.md) for the collection.

## The one CSS rule

The page may use small amounts of **layout** CSS but NO aesthetic CSS — looks
come from the components. Every caption is a `vf-label`, every run of copy a
`vf-paragraph`, every box a `vf-container` or a stack, and `src/desktop.css`
holds only the apple's nudge, the clock's place, the text body's wrapping and
the Font Viewer's smoothing token.

`src/page.css` is the other half: the page-level CSS a component cannot reach
from its shadow root (the black behind the desktop, the scroll suppression that
keeps `fitWithin` from oscillating). `vintage-frames` ships no stylesheet
whatsoever, so both files are this repo's own work — that is the kit's design,
not an omission.
