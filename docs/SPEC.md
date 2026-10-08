# The desktop — what's on it and why

`index.html`, `src/` and `apps/`, served by `vite` from the repo root. A
System 7 desktop with five applications (the Finder, the Text Viewer, Desktop
Patterns, the Font Viewer and Meteors) over the shell `vintage-frames/shell`,
built on the published `vintage-frames` package and SystemOnline's own app
files, and held to the same contract as anyone else's app. The shell's own behavior (the window manager, the menu bar, the
catalog, the stock Finder, the saved session) is the kit's and documented
there, in its `docs/SHELL.md`; this spec covers what SystemOnline puts on it.

## The shell

`index.html` is one `<vf-desktop>`: the menu bar with the Apple menu, the
desktop's icon field and the About box, under the kit's page-drawn cursor and
a startup curtain that lifts once the kit's faces have loaded. `src/main.ts`
starts the shell over it with the five applications, fitted to the viewport,
the catalog in IndexedDB (database `system-online`) and the session in
localStorage (`system-online:desktop`).

1. **Applications.** Each is one directory under `src/apps/` (`finder`,
   `text-viewer`, `desktop-patterns`, `font-viewer`) exporting a function that
   returns the shell's `defineApp` definition: an id, a name, its menus
   (`menus.html`), its alerts (`dialogs.html`), its windows (`windows.html`,
   filled by `windows.ts`), the catalog kinds it opens, and `init(ctx)`. A
   zoom box's column is pure geometry (`layout.ts`); the window manager runs
   the box. `src/apps/windows.ts` holds what the windows and dialogs share.
   No application calls another. **Meteors** comes from its app file,
   `apps/Meteors.png`, built in its own repo (meteors-app): a PNG whose
   picture is its box and whose chunks carry its manifest, icon and code. The
   kit's `appFiles()` (`vite.config.ts`) builds it in, refusing a file whose
   kit range this site's kit doesn't meet, and the page's one copy of the kit
   serves its code. The Finder's defaults take its id and name from the
   manifest.
2. **The menu bar** holds the Apple menu, then the front application's menus,
   then the clock. The front application is the active window's, or the Finder
   while none is active.

   ```
   Finder            │ Apple  File  Edit  View  Special          5:31 PM │
   Text Viewer       │ Apple  File  Edit  View                   5:31 PM │
   Desktop Patterns  │ Apple  File  View                         5:31 PM │
   Font Viewer       │ Apple  File  Edit  View  Size             5:31 PM │
   Meteors           │ Apple  File  View                         5:31 PM │
   ```

   The browser keeps ⌘W, ⌘Q and ⌘N, so Close and Quit take ⌃W and ⌃Q.
   While an application's alert is up, the bar shows that application's
   menus, whichever is front.
3. **The Apple menu** is the page's: _About SystemOnline…_, a rule, then the
   items applications install in it (Desktop Patterns), the way a control
   panel sat in the Apple Menu Items folder.
4. **Windows.** A window that shows a file, or an application opened from its
   icon, opens out of the icon and closes back into it; a window opened from
   a menu comes and goes at once. An
   Option-click on a close box closes every window of its application. Every
   movable window drags as an outline (`outline-drag`). New windows cascade;
   a resize re-pins every window and desktop icon, and View → Arrange Windows
   (⌘J), in every application, puts the windows back.
5. **The session** keeps every window's box, which were open and which was
   active, the desktop pattern, the About box's Show at startup (`greet`), and
   Meteors' best score (`meteors-best`).
   A reload reopens the windows that were open. `?fresh=1` neither reads nor
   writes it, and keeps the catalog in memory: the desktop a first visit
   sees, gone on a reload.
6. **The About box** (Apple menu → About SystemOnline…, `src/about.ts`) is a
   `frame="plain" light-dismiss` dialog with the version and HEAD's commit
   date, a link button to Vintage Frames on npm, and **Show at startup**,
   which greets a load that reopens no window.

## The library

The shell's catalog, with Macintosh HD and the Trash as its volumes, two
kinds of SystemOnline's own (`src/state/kinds.ts`), and the shell's own `app`
kind: an application's icon, which opens it.

7. **A text file** (kind `text`) keeps its words, or the key of a text the app
   ships (`src/texts/`), whose words are always the app's. **A font
   suitcase** (kind `font`) keeps its family; the strikes are the app's
   (`public/fonts/imported/`), and its size is their bytes.
8. **The defaults** (`src/state/defaults.ts`): Read Me and Meteors' icon on
   the desktop, and in Macintosh HD a Fonts folder of one suitcase per family
   and About the Fonts.
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
   still restore. An application's icon is the system's, not a file: a backup
   leaves it out, and a Replace puts it back at a free cell.
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

## Meteors

Built in from `apps/Meteors.png`. Its source, and the files named here, are
the meteors-app repo's `src/`.

16. Meteors' icon on the desktop (`art/meteors.png`: a ship firing at a rock
    on a little black screen) opens one fixed, centered window, 322 × 260,
    out of the icon and back into it, the icon drawn open while it runs. A
    reload reopens it, on the title screen. The
    window's whole body is the game's screen: a 320 × 240 canvas at one canvas px per
    system px, in a `vf-container` of that size that holds it on the device
    grid, magnified `pixelated` so each system px is a whole square of device
    px. Every frame is 1-bit, black and white only: the field is drawn into
    a 1-bit raster of the app's own, whole-px lines that wrap at the edges
    (`raster.ts`), and its text is the kit's faces cut into 1-bit glyphs
    (`screen.ts`). The rules are pure (`game.ts`, `field.ts`).
17. The title screen offers **New Game** and **Quit**, highlighted by the
    arrows or the pointer and chosen by Return, Space or a click; Quit quits.
    Under them is the best score, once there is one.
    **Q** or **Escape** in a game stops it and asks _End this game and go
    back to the main menu?_: Return ends it and goes back to the title
    screen, Escape or Cancel goes back to the game as it was. Keys held with
    ⌃, ⌘ or ⌥ are the menu bar's. File: _Close_, _Quit_. View: _Arrange
    Windows_.
18. A game runs on a fixed 60-a-second step over a field that wraps at every
    edge, its random draws from a generator seeded at New Game. ← and → turn
    the ship, ↑ thrusts it, and it coasts, slowing; Space fires, one shot a
    press, four in flight at most. Meteors come in waves from the edges, four
    large at first and two more a wave up to eleven, each a jagged outline of
    its own, and a cleared field brings the next wave two seconds on. A shot
    splits a large meteor into two medium and a medium into two small, and
    takes a small one out, for 20, 50 and 100 points. A meteor that hits the
    ship goes the same way, and the ship breaks up. A game has three ships
    and one more every 10,000 points, the score at the top left and the ships
    in reserve under it. A lost ship comes back at the center two seconds on,
    once nothing is near it. Losing the last one is GAME OVER, three seconds
    over the drifting field, then the title screen, and the game's score
    counts toward the best; a game ended early doesn't. The game runs only while
    its screen has the keyboard focus: losing it to another window, the
    desktop, a menu, the alert or another tab pauses the game, as **P** does,
    and P or a click on the screen resumes it.

## The one CSS rule

The page may use small amounts of **layout** CSS but NO aesthetic CSS — looks
come from the components. Every caption is a `vf-label`, every run of copy a
`vf-paragraph`, every box a `vf-container` or a stack, and `src/desktop.css`
holds only the text body's wrapping and the Font Viewer's smoothing token and
row breaking. Meteors' screen carries its pixelated magnification itself, on
its canvas, so the game leans on no stylesheet of the site's.

`src/page.css` is the other half: the page-level CSS a component cannot reach
from its shadow root (the black behind the desktop, the scroll suppression that
keeps `fitWithin` from oscillating). `vintage-frames` ships no stylesheet
whatsoever, so both files are this repo's own work — that is the kit's design,
not an omission.
