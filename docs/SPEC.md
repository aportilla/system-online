# The desktop — what's on it and why

`index.html` + `src/`, served by `vite` from the repo root. A System 7 desktop
with four applications (the Finder, the Text Viewer, Desktop Patterns and the
Font Viewer) over the shell `vintage-frames/shell`, built on nothing but the
published `vintage-frames` package and held to the same contract as anyone
else's app. The shell's own behavior (the window manager, the menu bar, the
catalog, the stock Finder, the saved session) is the kit's and documented
there, in its `docs/SHELL.md`; this spec covers what SystemOnline puts on it.

## The shell

`index.html` is one `<vf-desktop>`: the menu bar with the Apple menu, the
desktop's icon field and the About box, under the kit's page-drawn cursor and
a startup curtain that lifts once the kit's faces have loaded. `src/main.ts`
starts the shell over it with the four applications, fitted to the viewport,
the catalog in IndexedDB (database `system-online`) and the session in
localStorage (`system-online:desktop`).

1. **Applications.** Each is one directory under `src/apps/` (`finder`,
   `text-viewer`, `desktop-patterns`, `font-viewer`) exporting a function that
   returns the shell's `defineApp` definition: an id, a name, its menus
   (`menus.html`), its alerts (`dialogs.html`), the catalog kinds it opens,
   and `init(ctx)`. Its windows are made from `windows.html` (`windows.ts`),
   and a zoom box's column is pure geometry (`layout.ts`).
   `src/apps/windows.ts` holds what the windows and dialogs share. No
   application calls another.
2. **The menu bar** holds the Apple menu, then the front application's menus,
   then the clock. The front application is the active window's, or the Finder
   while none is active.

   ```
   Finder            │ Apple  File  Edit  View  Special          5:31 PM │
   Text Viewer       │ Apple  File  Edit  View                   5:31 PM │
   Desktop Patterns  │ Apple  File  View                         5:31 PM │
   Font Viewer       │ Apple  File  Edit  View  Size             5:31 PM │
   ```

   The browser keeps ⌘W, ⌘Q and ⌘N, so Close and Quit take ⌃W and ⌃Q.
   While an application's alert is up, the bar shows that application's
   menus, whichever is front.
3. **The Apple menu** is the page's: _About SystemOnline…_, a rule, then the
   items applications install in it (Desktop Patterns), the way a control
   panel sat in the Apple Menu Items folder.
4. **Windows.** A window that shows a file opens out of its icon and closes
   back into it; a window opened from a menu comes and goes at once. Every
   movable window drags as an outline (`outline-drag`). New windows cascade;
   a resize re-pins every window and desktop icon, and View → Arrange Windows
   (⌘J), in every application, puts the windows back.
5. **The session** keeps every window's box, which were open and which was
   active, the desktop pattern, and the About box's Show at startup (`greet`).
   A reload reopens the windows that were open. `?fresh=1` neither reads nor
   writes it, and keeps no catalog.
6. **The About box** (Apple menu → About SystemOnline…, `src/about.ts`) is a
   `frame="plain" light-dismiss` dialog with the version and HEAD's commit
   date, a link button to Vintage Frames on npm, and **Show at startup**,
   which greets a load that reopens no window.

## The library

The shell's catalog, with Macintosh HD and the Trash as its volumes and two
kinds of SystemOnline's own (`src/state/kinds.ts`).

7. **A text file** (kind `text`) keeps its words, or the key of a text the app
   ships (`src/texts/`), whose words are always the app's. **A font
   suitcase** (kind `font`) keeps its family; the strikes are the app's
   (`public/fonts/imported/`), and its size is their bytes.
8. **The defaults** (`src/state/defaults.ts`): Read Me on the desktop, and in
   Macintosh HD a Fonts folder of one suitcase per family and About the Fonts.
   They are the catalog's seed, stored once; **Special → Restore Default
   Files** stores any missing since, a trashed or renamed one counting as
   present.
9. **Back Up All Files…** downloads the library as one zip whose tree reads as
   the desktop (`macintosh-hd/`, `trash/`, folders as directories, texts as
   `.txt`) with a `desktop.json` manifest (`src/state/backup.ts`); fonts are
   manifest rows alone, and each row keeps its icon's place. **Restore from
   Backup…**, or the zip dropped on the page, asks whether to Add it beside
   the desktop, at free cells, or Replace the desktop with it, at its places.
   The manifest names Macintosh HD `hd`, so backups from before the catalog
   still restore.
10. Without IndexedDB (a private window) the desktop holds Macintosh HD and
    the Trash, and every command that would store explains why it can't.

## The Finder

11. The kit's stock Finder: icons, folder windows, renaming, filing by drag,
    Copy and Paste, Clean Up, Empty Trash…. SystemOnline gives it its art
    (the folder, the Trash and its mark, a text file's icon for a generic
    document, and the caution art its alerts carry; the app icon stands in for
    Macintosh HD and the suitcases), its volumes and its seed, and adds to
    Special: _Restore Default Files_, then _Back Up All Files…_ and _Restore
    from Backup…_, whose alerts it holds (`dialogs.html`).

## The Text Viewer

12. One window per text file: `movable outline-drag resizable zoomable
    scrollbars="vertical"`, 440 × 320, the text verbatim in one body-face
    paragraph that keeps its line breaks and wraps at the window. The zoom box
    toggles a reading column at most 520 wide. File: _Close_, _Quit_ (every
    text window). Edit: _Copy_ (greyed without a selection in a text window),
    _Select All_. View: _Arrange Windows_.

## Desktop Patterns

13. Apple menu → Desktop Patterns opens one fixed, centered panel: a preview
    well, a 13 × 3 chooser of the kit's 38 patterns, and a default **Set
    Desktop Pattern**. A click (or the arrow keys) previews a pattern and rings
    its cell, 1px black over the edge and 1px white inside; only the button
    sets the desktop's, which the session keeps. Closing discards an unset
    choice. Every piece is a kit element, the ring eight 1px `vf-container`s.
    File: _Close_, _Quit_. View: _Arrange Windows_.

## The Font Viewer

14. One window per suitcase: `movable outline-drag resizable zoomable
    scrollbars="vertical"`, titled with the suitcase's name. It sets System 7's
    sample line, _How razorback-jumping frogs can level six piqued gymnasts!_,
    in every strike of the family, smallest first, then under a rule every
    character the chosen strike carries (ASCII, accented Latin, the rest),
    each paragraph in the strike itself at its rect and measured pitch, so
    nothing on it is another font's fallback. The status strip names the
    strike and counts its characters. It opens on the strike nearest 12.
15. The **Size** menu lists the active window's strikes, _9 Point_ … (_16
    Pixels_ for a family the collection still names by line height), the
    current one checked. Strikes load on demand through the FontFace API
    (`strikes.ts`) under the wristwatch; a missing woff2 says so in place.
    File: _Close_, _Quit_. Edit: _Copy_, _Select All_. View: _Arrange
    Windows_. See [FONTS.md](FONTS.md) for the collection.

## The one CSS rule

The page may use small amounts of **layout** CSS but NO aesthetic CSS — looks
come from the components. Every caption is a `vf-label`, every run of copy a
`vf-paragraph`, every box a `vf-container` or a stack, and `src/desktop.css`
holds only the apple's nudge, the text body's wrapping and the Font Viewer's
smoothing token.

`src/page.css` is the other half: the page-level CSS a component cannot reach
from its shadow root (the black behind the desktop, the scroll suppression that
keeps `fitWithin` from oscillating). `vintage-frames` ships no stylesheet
whatsoever, so both files are this repo's own work — that is the kit's design,
not an omission.
