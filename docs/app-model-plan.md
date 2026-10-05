# Plan: the application model

**Status:** drafted 2026-09-27. Every decision taken 2026-09-27 (§6): as
recommended, except decision 4, which takes sprite-machine's whole Finder
with storage, backup and Restore Default Files, and decision 14, which
discards the uncommitted Arrange Windows change (done; the patch is kept
outside the repo). Steps 1 to 7 landed 2026-09-27, uncommitted; the gates are
green and every eye check in §8 is open. Changes from the design as drafted:
new windows take the first cascade slot no window of any application holds
(`windows.freeSlot()`); applications install their own Apple menu items
(`deps.appleMenu`), so the shell names none; the About box links Vintage
Frames with a `vf-button href`; the alerts carry `public/icons/alert.png`. The
ask: _"this project was an
early draft for using the vintage frames components to implement a system 7
like desktop env... it's fallen woefully out of date however. Please take a
look at the sibling project ./sprite-machine which has a much more mature and
up to date usage of the latest vintage frames dependency - as well as a much
more mature os framework - including an application model where each app
owns its windows and has its code implemented within a dedicated app
directory... i'd like you to bring system7web fully to up to date, bringing
over the document reader app and the desktop pattern setting app... and
creating a font viewer app.. we can retire the windows we've created that
we're no longer using..."_

The short version: system7web stops being a specimen sheet and becomes a
small System 7 with four applications (the Finder, the Text Viewer, Desktop
Patterns and a new Font Viewer) over the shell sprite-machine already
proved: a window manager every application declares its windows to, a menu
bar that shows the front application's menus, and one desktop state that
brings the session back on reload. The shell, the Finder with its IndexedDB
library, the Text Viewer and Desktop Patterns are ported from sprite-machine
into TypeScript. The Font Viewer grows out of today's Character Set window.
Every specimen window is retired, and the kit goes from 0.2.0 to 0.12.6.

## 1. Where things stand

**system7web** pins `vintage-frames ^0.2.0`, ten minor versions behind the
published 0.12.6. It is one 636-line `src/main.ts` over one 1257-line
`index.html`: eleven specimen windows and dialogs, a twelve-icon launcher
cluster that opens them, two decorative Finder icons, one global menu bar,
and the Character Set window over the imported strike collection. Windows are
hidden and un-hidden in place; nothing persists.

Kit changes since 0.2.0 that touch what this repo keeps:

- `vf-dialog` has no body inset, no `buttons` slot, and `heading` on a plain
  frame only names the dialog (0.8.0). Dialogs place their children.
- `vf-window` and `vf-scroll-area` have no body inset and no `flush`
  (0.6.0). A window body's inset is a `vf-stack pad`.
- New and used here: the `header` and `status` slots, `outline-drag`,
  `show({ from })` / `hide({ to })` zoom rects, `vf-icon-field` with the
  rubber band and the icon drag, `dragIcons` for Clean Up, `vf-desktop
  pattern` and `PATTERN_NAMES`, `clearActive()` / `activeWindow` /
  `vf-activate`, `light-dismiss`, `vf-menu-bar shortcuts`.

**sprite-machine** (kit ^0.12.3) is four applications over one shell:

| Layer | Files | Role |
| --- | --- | --- |
| Registry | `src/apps/index.js` | the applications in bar order, the default (Finder) |
| Application | `src/apps/<id>/` | `index.js` (id, name, menus, `init({ menus, deps })` → actions + dispose), `menus.html`, `windows.html` (templates), `windows.js` (lifecycle, close and zoom meaning), `layout.js` (pure placement) |
| Shell | `src/shell/windows.js` | `adopt` / `dismiss`, the front application, the nine-slice resize rule, Arrange Windows, the `onLayout` / `onWindows` / `onRaster` / `beforeFront` signals |
| | `src/shell/layout.js` | landmarks, `WINDOW_ORIGIN`, the cascade, `centeredBox`, `nearBox`, `pinOf` / `pinTo` |
| | `src/shell/menu-bar.js` | the always-present menu, the front app's menus swapped in and out, the shared dialogs, `deps.apps` |
| | `src/shell/desktop-state.js` | one versioned localStorage key: icon positions, window pins with depth, the active window, the pattern, `greet`, `seeded` |
| | `clock.js`, `desktop-pattern.js` | the menu-bar clock; `shell.desktopPattern` → `vf-desktop pattern` |
| State | `src/state/files.js`, `backup.js`, `clipboard.js`, `store.js`, `shell.js` | the library over IndexedDB, the backup format, the Finder's clipboard, the observable store, `frontApp` and `desktopPattern` |
| Boot | `src/boot/curtain.js`, `restore.js`, `params.js` | the startup curtain, reopening the last session's windows, `?fresh` |

Its rules come across as they are: application behavior lives in its
application's directory; the shell holds only primitives, never a choice or a
name belonging to one application; `src/apps/` imports `src/shell/`, never the
reverse; cross-application calls go through `deps.apps`, read at pick time.

## 2. The System 7 model we copy

- **Applications own windows, and the menu bar is the front application's.**
  Clicking a window brings its application forward and the bar swaps to its
  menus. With no window active the Finder is front over the bare desktop.
- **The Apple menu is always there**, with About and the control panels. The
  Desktop Patterns control panel (System 7.5; General Controls before it) set
  the desktop's 8×8 pattern.
- **The Finder** shows the startup disk at the top of the right edge and the
  Trash in the bottom-right corner. Folders open into windows whose zoom
  rects grow out of the icon and shrink back into it. Items are renamed in
  place, filed by dragging, deleted by dragging to the Trash, and gone for
  good only at Empty Trash.
- **A read-me opens in TeachText**: a plain, read-only window over the text.
- **A font opens into a sample window.** Double-clicking a font in System 7
  showed "How razorback-jumping frogs can level six piqued gymnasts!" set in
  it. The Font Viewer is that window, extended with the strike's full
  character set and a Size menu over the family's strikes.

## 3. Design

### 3.1 The tree

```
index.html                      the skeleton: vf-desktop, the menu bar (Apple menu
                                + clock), the desktop icon field, the shared dialogs
src/main.ts                     composition root
src/page.css, src/desktop.css   page CSS and layout CSS, as today
src/env.d.ts                    build constants
src/boot/                       curtain, params (?fresh), restore
src/state/                      store, shell, files, backup, clipboard, defaults
src/storage/db.ts               IndexedDB
src/lib/                        zip, download, system clipboard
src/texts/                      the built-in text files
src/shell/                      windows, layout, menu-bar, clock, desktop-pattern,
                                desktop-state
src/drop-target.ts              a backup dropped on the page
src/apps/index.ts               registry
src/apps/finder/                index, menus.html, windows.html, windows, icons,
                                layout, backup, art
src/apps/text-viewer/           index, menus.html, windows.html, windows, layout
src/apps/desktop-patterns/      index, menus.html, windows.html, windows
src/apps/font-viewer/           index, menus.html, windows.html, windows, layout,
                                strikes, specimen
src/charset-manifest.ts         generated, unchanged
test/*.test.mjs                 pure-logic unit tests (§7)
```

The port is TypeScript under this repo's `strict` tsconfig, formatted the way
`src/main.ts` is today (no semicolons), with sprite-machine's short, dry
comments. Relative imports carry their `.ts` extension, so Node can run the
pure modules under test.

Application art is imported as modules, so Vite hashes it and prefixes the
`/system7web/` base; a `?raw` fragment never names a `public/` path. The fonts
stay in `public/fonts/imported/`, loaded by URL off `import.meta.env.BASE_URL`.

### 3.2 The shell

Ported module by module. What changes is what was sprite-machine's own:

| Module | Change from sprite-machine |
| --- | --- |
| `shell/layout.ts` | `TOP_RESERVE` is the menu bar's 20; there is no options strip. `WINDOW_ORIGIN` re-derived. |
| `shell/windows.ts` | As is, with the `KIT_MIN_*` mirror of vf-window's grow floor (§5). |
| `shell/menu-bar.ts` | The always-present menu is the Apple menu. Shared dialogs: About, Storage Unavailable, and an error alert standing in for sprite-machine's status-line errors. |
| `state/shell.ts` | App ids `finder`, `text-viewer`, `desktop-patterns`, `font-viewer`. No `appActive`. |
| `shell/desktop-state.ts` | Key `system7web:desktop`, version 1, so no migrations: `icons`, `windows`, `active`, `pattern`, `greet`, `seeded`. |
| `boot/params.ts` | `?fresh=1` alone: no library, no desktop state read or written. |
| `boot/restore.ts` | Reopens `folder:`, `text:` and `font:` keys through each owner. |
| the rest | As is. |

Key equivalents follow sprite-machine: `shortcuts` on the bar, and Close,
Quit and New take ⌃W, ⌃Q and ⌃N because the browser keeps ⌘W, ⌘Q and ⌘N.

### 3.3 The library

`state/files.ts` is sprite-machine's files slice without documents: IndexedDB
database `system7web`, stores `folders`, `texts` and `fonts`.

- **Folders** and **text files** as in sprite-machine: a text record holds its
  `text`, or `builtin`, the key of a text the app ships.
- **Fonts** are records `{id, name, folder, createdAt, modifiedAt, family}`.
  The strikes are the app's (`CHARSET_FAMILIES`, `public/fonts/imported/`), so
  a record carries only the family; a record whose family the app no longer
  ships is left out of the listing. A font's size is its strikes' woff2
  bytes, measured at build time in `vite.config.ts`.
- **Two containers have no record**: the **Trash** (as in sprite-machine) and
  **Macintosh HD** (`hd`), both always listed. Neither can be renamed, moved,
  copied or removed. Things can be made in Macintosh HD, not in the Trash.
- Everything else is sprite-machine's: `childrenOf`, `isInside`,
  `isTrashed`, `descendantsOf`, `copyName`, create, rename, move (a folder
  never into itself or a descendant), copy with subtrees, `emptyTrash`,
  `clearLibrary` and `importArchive`.

**The defaults** (`state/defaults.ts`): Read Me on the desktop, About the Fonts
in Macintosh HD, and a Fonts folder in Macintosh HD holding one suitcase per
family (25). A new profile stores them once (`seeded`). **Special → Restore
Default Files** stores the ones missing, a text by key and a font by family,
with a trashed or renamed one counting as present; a missing font goes into
the Fonts folder in Macintosh HD, made again if it is gone.

**The backup** (`state/backup.ts`, `apps/finder/backup.ts`, `lib/zip.ts`):
sprite-machine's format under its own name (`system7web-desktop`, v1):
`desktop.json` plus a tree of directories and `.txt` entries mirroring the
desktop, `macintosh-hd/` and `trash/` included. Fonts are manifest rows alone.
**Back Up All Files…** downloads it; **Restore from Backup…** (or a `.zip`
dropped on the page) asks Add or Replace, as sprite-machine does. A font row
whose family isn't shipped is skipped and counted.

### 3.4 The Finder

sprite-machine's Finder, less the documents:

- **Icons** (`icons.ts`): the reconciler over each container's field (the
  desktop and every open folder window), positions saved by key, the next
  free lattice cell for anything new, the desktop lattice down the right edge
  with Macintosh HD first and the Trash in the corner, the nine-slice re-pin
  on a raster resize, rename in place (not Macintosh HD or the Trash), filing
  by drag with `target` on the folder under the pointer, the open ghost,
  `iconBox` and `holdGhost` for the zoom rects, and the bridge that keeps the
  selection across a menu-bar press (§5).
- **Folder windows** (`windows.ts`): `movable outline-drag resizable
  scrollbars="both"`, the item count in the header with the trash mark in the
  Trash and trashed folders, the field sized to its extent, cascaded from
  `WINDOW_ORIGIN`, pins remembered and saved, out of the icon and back in.
- **Menus**: File (Open ⌘O, New Folder; Close ⌃W), Edit (Copy ⌘C, Paste ⌘V,
  Select All ⌘A), View (Arrange Windows ⌘J), Special (Clean Up Desktop /
  Window, Empty Trash…; Restore Default Files; Back Up All Files…, Restore
  from Backup…). Copy and Paste carry item references and put the names on
  the system clipboard; a pasted image or outside text does nothing (§9).
- **Alerts** in `index.html`: Empty Trash, the Restore question, Restore
  failed.

### 3.5 The Text Viewer

Ported whole: one window per text file, `movable outline-drag resizable
zoomable scrollbars="vertical"`, 440 × 320, the text verbatim in one
body-face paragraph under `.text-body`, the zoom box toggling the reading
column, out of its icon and back in, following renames, closing when its
file is emptied from the Trash. Menus: File (Close ⌃W, Quit ⌃Q), Edit (Copy ⌘C,
Select All ⌘A), View (Arrange Windows ⌘J).

The built-in texts: **Read Me**, a tour of the desktop and its four
applications, and **About the Fonts**, the user-facing half of
`docs/FONTS.md`: the kit's own re-drawn faces against the collection's genuine
Apple strikes, never one described as the other.

### 3.6 Desktop Patterns

Ported: Apple menu → Desktop Patterns opens one fixed-size, centered panel
(248 × 304): a 222 × 160 preview well, a 13 × 3 chooser of the kit's 38
patterns in 16px cells, and a default **Set Desktop Pattern** button. A cell
click previews and rings it; only the button sets `shell.desktopPattern`,
which the painter writes to `vf-desktop` and the desktop state persists.
Closing discards an unset choice. Menus: File (Close ⌃W, Quit ⌃Q), View
(Arrange Windows ⌘J).

The body is built from kit elements alone: each cell a `vf-container
pattern`, `role="radio"` in a `role="radiogroup"` with a roving tab stop, and
the ring a `rule`d white `vf-container` framing the cell's pattern 2px in. No
Lit, no page CSS.

### 3.7 The Font Viewer

New, and the Character Set window's successor. A suitcase's open calls
`apps['font-viewer'].open(id, { from })`.

- **One window per suitcase**, keyed `font:<id>`, titled with its name:
  `movable outline-drag resizable zoomable scrollbars="vertical"`, cascaded,
  pinned and restored like any window, out of its icon and back in, following
  renames and closing when the suitcase is emptied from the Trash.
- **The body**: the System 7 sample line, _How razorback-jumping frogs can
  level six piqued gymnasts!_, once per strike, smallest first; a rule; then
  the chosen strike's character set in three rows (ASCII, accented Latin, the
  rest), each row a `vf-paragraph` carrying the strike's family, rect and
  measured pitch as tokens.
- **The status strip** names the strike and counts its characters.
- **The Size menu** lists the active window's strikes (_9 Point_…; _16 Pixels_
  for a family still named by line height), the current one checked, rebuilt
  on each activation. A window opens on the strike nearest 12.
- **Loading** (`strikes.ts`): each strike registered once through `FontFace`
  under its own family name at weights 100–900, `aria-busy` on the window
  while it loads, and the window explaining itself when a woff2 is missing.
- **Menus**: File (Close ⌃W, Quit ⌃Q), Edit (Copy ⌘C, Select All ⌘A), Size,
  View (Arrange Windows ⌘J).

### 3.8 The Apple menu, the About box, the clock

The bar reads: the apple, the front application's menus, the clock.

- **Apple menu**: _About system7web…_, a rule, _Desktop Patterns_.
- **The About box**: a `frame="plain" light-dismiss` dialog, the app's icon
  beside **system7web**, the version and HEAD's commit date, a credit line, a
  blurb linking Vintage Frames, and **Show at startup** (`greet`). It is the
  boot greeting when the session reopens nothing.
- **The clock**: the time on the minute, the date for three seconds on a
  press.

### 3.9 What's retired

| Kind | Retired |
| --- | --- |
| Windows | Format, Controls, DragThing 2.9 Installer, DragThing Read Me, New HTML Document, Find File, New (Photoshop), Desk Accessories palette; Character Set becomes the Font Viewer |
| Dialogs | Page Setup, Preferences, the Erase Disk alert; the About box is rebuilt |
| Menus | today's File, Edit, View and Special, each replaced by the front application's |
| Desktop | the twelve launcher icons; Macintosh HD and the Trash become the library's |
| Code | all of today's `main.ts` but the Character Set's strike loading and specimen |
| CSS | every `desktop.css` rule but the apple nudge and `.charset` |
| Art | the nine DA icons; `alert.png` stays for the alerts, `app-icon*.png` until real art replaces them |

## 4. Steps

Each step ends with `npm run typecheck`, `npm test` and `npm run build`
green. All landed 2026-09-27.

0. **Checkpoint.** Discard the working tree's Arrange Windows change. Done.
1. **Kit bump and harness.** `vintage-frames ^0.12.6`, `@types/node`, the
   tsconfig for `.ts` imports, `npm test`, the build constants.
2. **Pure modules.** `state/store`, `state/shell`, `state/files`,
   `state/backup`, `state/clipboard`, `state/defaults`, `lib/zip`,
   `shell/layout`, `shell/desktop-state`, `apps/finder/layout`, the texts, with
   their tests.
3. **The shell and the Finder**, retiring every specimen window at once: the
   new `index.html`, `main.ts`, window manager, menu bar, clock, pattern
   painter, desktop state, curtain, restore, storage, backup and drop target.
4. **The Text Viewer.**
5. **Desktop Patterns.**
6. **The Font Viewer.**
7. **Docs and CI.** `docs/SPEC.md` rewritten for the four applications,
   README, CLAUDE.md, `docs/FONTS.md`, and the Pages workflow's gates.

## 5. Kit asks

All four below shipped in vintage-frames 0.14.1.

Nothing new is required. Two bridges come across from sprite-machine:

1. **The selection across a chrome press.** `vf-icon` still clears its
   selection on any outside `pointerdown`, the menu bar included (0.12.6).
   The Finder re-selects around presses on `vf-menu-bar`, `vf-menu` and
   `vf-dialog`.
2. **vf-window's grow floor** (80 × 54) isn't exported; the shell mirrors it.

The Desktop Patterns ring composed from `vf-container`s as planned. Two asks
came out of building it:

3. **An unpatterned `vf-container` paints an inherited pattern.** The fill
   reads `--_vf-pattern-image`, an inheriting custom property set on every
   patterned box's shadow `.box`, the desktop's included, so a bare container
   anywhere in a window paints its nearest patterned ancestor's pattern.
   sprite-machine works around it with `pattern="white"`; here every ring strip
   and header states its pattern. An unpatterned box should paint nothing.
4. **A focus treatment for a page's own focusable kit elements.** The pattern
   cells are `vf-container`s with `role="radio"`, and keyboard focus draws the
   browser's own blue ring on them, which page CSS may not restyle here.

## 6. Decisions

All taken 2026-09-27.

1. **Retire every specimen window** in §3.9. _Taken as recommended._
2. **Port the shell to TypeScript.** _Taken as recommended._
3. **Copy the shell now; share it later** (§9). _Taken as recommended._
4. **The Finder**: sprite-machine's whole Finder over IndexedDB, with rename,
   folders, filing, the Trash, Copy and Paste, Back Up All Files…, Restore
   from Backup… and Restore Default Files. _Taken 2026-09-27, against the
   recommendation of a read-only catalog._
5. **Macintosh HD holding Fonts and About the Fonts; Read Me and the Trash on
   the desktop**, now as the defaults a new profile is given. _Taken as
   recommended._
6. **Keep the Trash.** _Taken as recommended_, and now a working one.
7. **One Font Viewer window per suitcase, with a Size menu.** _Taken as
   recommended._
8. **Desktop Patterns from kit elements alone.** _Taken as recommended._
9. **About system7web…** with version, date, credit and Show at startup.
   _Taken as recommended._
10. **sprite-machine's testing policy**, `node --test` on Node's type
    stripping, gating the Pages workflow. _Taken as recommended._
11. **Two built-in texts, Read Me and About the Fonts.** _Taken as
    recommended._
12. **Art**: sprite-machine's folder, text-file and Trash icons (your own);
    Macintosh HD and the suitcase are yours to draw, `app-icon.png` meanwhile.
    _Taken as recommended._
13. **Reopen the last session's windows on reload.** _Taken as recommended._
14. **Discard the uncommitted Arrange Windows change.** _Taken 2026-09-27,
    against the recommendation to commit it first._

## 7. Tests

By sprite-machine's policy: unit tests on pure contracts, no browser tests,
nothing asserting markup, copy, constants or what the kit renders. The look
and the wiring are checked by eye (§8). `npm test` runs `node --test` over
`test/*.test.mjs`, which import the TypeScript source directly (Node 22.18
and later strip types).

- `shell/layout`: the pin round-trip, struts and springs, the anchor rule,
  the cascade, `nearBox`.
- `apps/finder/layout`: the lattices, fill order, Clean Up.
- `shell/desktop-state`: a garbled or foreign blob reads as none, invalid pins
  drop, depth order, the defaults.
- `state/files`: the tree's rules over an in-memory storage: the two
  record-less containers, cycles refused, copy names, subtree copies, Empty
  Trash, unknown built-ins left out, `importArchive` in both modes.
- `state/backup`, `lib/zip`: the plan's paths and manifest, the manifest's
  refusals, the zip round-trip.
- `state/clipboard`, `state/defaults`: the paste source; which defaults are
  missing and where a font goes home.
- `apps/font-viewer/specimen`: the row split, the nearest strike, the Size
  labels.

## 8. Eye checks

In `npm run dev`, once the steps land:

1. The bar swaps menus as a Finder, text, pattern and font window each comes
   forward, and a desktop press brings the Finder back.
2. Macintosh HD, Fonts, a suitcase and Read Me each open out of their icon
   and close back into it, the icon ghosted until the rects land.
3. Rename, New Folder, filing into a folder and a folder window, Copy and
   Paste, dragging to the Trash, Empty Trash…, Restore Default Files.
4. Back Up All Files… downloads a zip that reads as the desktop when
   unzipped; Restore from Backup… adds it back or replaces the desktop with
   it; dropping it on the page asks the same question.
5. Window drags are outlines; ⌘J arranges and greys once arranged.
6. A browser resize carries windows and icons by the nine-slice rule; growing
   back returns them exactly.
7. The pattern chooser's ring reads on black, white and gray patterns; Set
   Desktop Pattern repaints the desktop and survives a reload.
8. Every Font Viewer strike is crisp at 1× and 2×, rows on the strike's own
   pitch; the Size menu follows the active window.
9. A reload reopens the same windows in the same order; with none open and
   Show at startup checked, the About box greets.
10. In a private window, the desktop shows Macintosh HD and the Trash, and
    New Folder explains that storage is unavailable.

## 9. Follow-ups

- **The Application menu** at the bar's right end: the front application's
  icon, Hide and Show All, and the running applications.
- **Finder views**: View → by Small Icon and by Name.
- **Text in**: a pasted or dropped `.txt` becoming a text file.
- **The Finder's name alerts** (`vf-name-too-long`, `vf-name-rejected`),
  refused silently as in sprite-machine.
- **The Font Viewer's size** remembered per suitcase.
- **Renaming Macintosh HD.**
- **A shared shell package** consumed by sprite-machine and system7web.
- **A drop overlay** for a backup dragged over the page, from kit elements.

## 10. Files touched

- **New**: `src/env.d.ts`, `src/boot/*`, `src/state/*`, `src/storage/*`,
  `src/lib/*`, `src/shell/*`, `src/texts/*`, `src/drop-target.ts`,
  `src/apps/**`, `test/*`.
- **Rewritten**: `index.html`, `src/main.ts`, `src/desktop.css`,
  `docs/SPEC.md`.
- **Edited**: `package.json`, `package-lock.json`, `tsconfig.json` (plus a
  new `tsconfig.node.json` for `vite.config.ts`), `vite.config.ts`,
  `.github/workflows/pages.yml`, `README.md`, `CLAUDE.md`, `docs/FONTS.md`,
  `fonts/charset-manifest.py` (its docstring).
- **Removed**: the nine DA icons and the old About logo
  (`vintage-frames.png`) in `public/icons/`.
- **Unchanged**: `src/page.css`, `src/charset-manifest.ts`, `fonts/`,
  `public/fonts/imported/`.
