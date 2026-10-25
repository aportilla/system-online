# The desktop — what's on it and why

`index.html`, `src/`, `apps/` and `public/`, served by `vite` from the repo
root. A System 7 desktop with six applications (the Finder, the App Store,
the Text Viewer, Desktop Patterns, the Font Viewer and Meteors) over the
shell of the published `system-online-sdk` package, drawn with the published
`vintage-frames` elements, the Finder built in and the rest installed from
SystemOnline's own app files, and held to the same contract as anyone else's
site. The shell's own behavior (the window manager, the menu
bar, the catalog and its System Folder, the stock Finder, the system's fonts,
the saved session) is the SDK's and documented there, in its `docs/SHELL.md`;
this spec covers what SystemOnline puts on it.

## The shell

`index.html` is one `<vf-desktop>`: the menu bar with the Apple menu, the
desktop's icon field and the About box, under the kit's page-drawn cursor and
a startup curtain that lifts once the kit's faces have loaded. `src/main.ts`
starts the shell over it with the Finder and the system's fonts
(`src/fonts.ts`), fitted to the viewport, the catalog and the installed
applications in IndexedDB (database `system-online`) and the session in
localStorage (`system-online:desktop`), and gives it SystemOnline's trust,
its public key (clause 11), and the index of app files at `apps.portill.io`,
which the shell hands applications (`VITE_INDEX` names another at build).

1. **Applications.** The Finder is the one directory under `src/apps/`
   (`finder`): SystemOnline's configuration of the SDK's stock Finder
   (clause 11), its alerts asked through `src/apps/windows.ts`, and the one
   application the shell is handed. No application calls another, and none
   other is built in: **the App Store**, **the Text Viewer**, **Desktop
   Patterns**, **the Font Viewer** and **Meteors** are installed at runtime
   from their app files, `apps/App Store.png`, `apps/Text Viewer.png`,
   `apps/Desktop Patterns.png`, `apps/Font Viewer.png` and
   `apps/Meteors.png`, each built in its own repo
   (system-online-app-store-app, text-viewer-app, desktop-patterns-app,
   font-viewer-app, meteors-app) and each the index's signed copy: a PNG
   whose picture is its box and whose chunks carry its manifest, icon, code
   and signature. The SDK's `appFiles()` (`vite.config.ts`) serves each byte
   for byte with its manifest (`?app-file`), refusing a file built at an app
   API level this site's SDK doesn't run or whose signature doesn't hold,
   and the defaults install each (clause 8); its code loads against the
   page's one copy of the kit and the SDK. More install from app files
   (clause 11).
2. **The menu bar** holds the Apple menu, then the front application's menus,
   then the clock. The front application is the active window's, or the Finder
   while none is active.

   ```
   Finder            │ Apple  File  Edit  View  Special          5:31 PM │
   App Store         │ Apple  File  View                         5:31 PM │
   Text Viewer       │ Apple  File  Edit  View                   5:31 PM │
   Desktop Patterns  │ Apple  File  View                         5:31 PM │
   Font Viewer       │ Apple  File  Edit  View  Size             5:31 PM │
   Meteors           │ Apple  File  View                         5:31 PM │
   ```

   The browser keeps ⌘W, ⌘Q and ⌘N, so Close and Quit take ⌃W and ⌃Q.
   While an application's alert is up, the bar shows that application's
   menus, whichever is front.
3. **The Apple menu** is the page's and the System Folder's: _About
   SystemOnline…_, a rule, then what the System Folder's Apple Menu Items
   holds, by name, a folder or an alias of one as a submenu of what it holds.
   A new desktop's Apple Menu Items holds an alias of the System Folder's
   Control Panels, so the menu reads Apple ▸ Control Panels ▸ Desktop
   Patterns, as System 7.5's did: control panels lived in the Control Panels
   folder, and the Apple menu reached them through its alias. Beside it is
   App Store…, an alias of the store's icon, as today's macOS has the item.
   Choosing an
   entry opens it as a double-click would. What Startup Items holds opens at
   every boot; a new desktop's is empty.
4. **Windows.** A window that shows a file, or an application opened from its
   icon, opens out of the icon and closes back into it; a window opened from
   a menu comes and goes at once. An
   Option-click on a close box closes every window of its application. Every
   movable window drags as an outline (`outline-drag`). New windows cascade;
   a resize re-pins every window and desktop icon, and View → Arrange Windows
   (⌘J), in every application, puts the windows back.
5. **The session** keeps every window's box, which were open and which was
   active, the desktop pattern, the About box's Show at startup (`greet`),
   whether the desktop has been given the System Folder's defaults
   (`system-folder`, clause 8), had its suitcases filed in Fonts
   (`fonts-folder`, clause 8) and been moved onto installed applications
   (`apps-installed`, clause 8), and Meteors' best score (`meteors-best`).
   A reload reopens the windows that were open. `?fresh=1` neither reads nor
   writes it, and keeps the catalog in memory: the desktop a first visit
   sees, gone on a reload.
6. **The About box** (Apple menu → About SystemOnline…, `src/about.ts`) is a
   `frame="plain" light-dismiss` dialog with the version and HEAD's commit
   date, a link button to Vintage Frames on npm, and **Show at startup**,
   which greets a load that reopens no window, decided once a desktop from
   before has been brought up to date (clause 8), since its windows reopen
   as its applications install.

## The library

The shell's catalog, with Macintosh HD and the Trash as its volumes, the
System Folder on Macintosh HD with Apple Menu Items, Startup Items and Fonts
in it, one kind of SystemOnline's own, the text file (`src/state/kinds.ts`),
and the shell's own three: `app`, an application's icon, which opens it,
`alias`, which stands for another item and opens it, and `font`, a font
suitcase.

7. **A text file** (kind `text`) keeps its own words, or, for a system
   document, the path the site serves its words at: Read Me and About the
   Fonts, the system's documentation, listed in `src/texts/` and served from
   `public/texts/` at `/texts/<key>.txt`, revalidated at every fetch
   (`public/_headers`), so their words are always this deploy's. **A font
   suitcase** (kind `font`, the shell's) keeps its family, which is the
   system's: SystemOnline serves every family of its collection
   (`src/fonts.ts`), each strike from `public/fonts/imported/`, and a
   suitcase's size is its strikes' bytes. One directly in the System Folder's
   Fonts installs its family; one anywhere else is a file the Font Viewer
   still opens.
8. **The defaults** (`src/state/defaults.ts`): Read Me, Meteors and the App
   Store on the desktop; About the Fonts, the Text Viewer and the Font Viewer
   in Macintosh HD; one suitcase per family in the System Folder's Fonts; and
   in the System Folder a Control Panels folder holding Desktop Patterns,
   which Apple Menu Items holds an alias of, beside App Store…, an alias of
   the store's icon. Each application is installed from its app file at its
   home, its icon named by its manifest. They are the catalog's seed, stored
   once; **Special → Restore Default Files** stores any missing since, an
   application installed again from its file, a trashed or renamed one
   counting as present, a suitcase back in Fonts, and makes the Control
   Panels folder again where it is gone. An alias counts while it stands for
   a folder named Control Panels, or an icon of the store, wherever either
   is. A desktop from before the System Folder is given its defaults once, at
   its first boot after it, so its Apple menu keeps Desktop Patterns. A
   desktop from before nothing was built in had Meteors' and Desktop
   Patterns' icons with no file, and its system documents by key: at its
   first boot after it, once the boot is done, its keys become paths, those
   icons are given their files, keeping their places, their aliases and
   Meteors' best score, and the Text Viewer, the Font Viewer and the App
   Store are installed at their homes, with App Store…, once. An application
   the visitor removed stays removed, and one the visitor installed stays as
   it is. Each application's windows from the last visit reopen as it
   installs. A desktop from before Fonts kept its
   suitcases in a Fonts folder in Macintosh HD: at its first boot after it,
   once, each suitcase directly in that folder moves into the System Folder's
   Fonts, keeping its id and its place, so an open font window and its
   aliases follow, and the folder, emptied, goes to the Trash. One that still
   holds anything else stays, and a suitcase anywhere else stays where it is.
9. **Back Up All Files…** downloads the library as one zip whose tree reads as
   the desktop (`macintosh-hd/`, `trash/`, folders as directories, a
   visitor's texts as `.txt`) with a `desktop.json` manifest
   (`src/state/backup.ts`); fonts and system documents are manifest rows
   alone, a document's keeping its key, and each row keeps its icon's place.
   A restore gives a system document the path the site serves its key at; an
   older backup's, whose words are in its entry, keeps its words once the
   site no longer serves its key, and one with neither is left out and
   counted. **Restore from
   Backup…**, or the zip dropped on the page, asks whether to Add it beside
   the desktop, at free cells, or Replace the desktop with it, at its places.
   The manifest names Macintosh HD `hd`, so backups from before the catalog
   still restore. The System Folder and its three folders are directories
   with no manifest row, as Macintosh HD and the Trash are, so what they hold
   comes back into them. A backup from before Fonts restores the suitcases
   in its Macintosh HD → Fonts into Fonts, and leaves that folder out when
   nothing else is in it. A suitcase whose family the system doesn't serve
   is left out and counted. A backup carries no applications yet: a Replace
   leaves no icon of any, so the shell uninstalls each, and the defaults
   install the system's again at their homes. Aliases are left out too, and a
   Replace puts back the defaults' alone.
10. Without IndexedDB (a private window) the desktop holds Macintosh HD, its
    System Folder and the Trash, and every command that would store explains
    why it can't.

## The Finder

11. The SDK's stock Finder: icons, folder windows, renaming, filing by drag,
    aliases (File → Make Alias, ⌘M, their names in italics), Copy and Paste,
    Clean Up, Empty Trash…. SystemOnline gives it its art (the folder; the
    System Folder, Apple Menu Items and Startup Items, each the folder marked
    with a small Macintosh, an apple and a happy Macintosh; Fonts, the
    folder's until its own is drawn; the Trash and its mark; a text file's
    icon for a generic document; and the caution art its alerts carry; the app
    icon stands in for Macintosh HD and the suitcases), its volumes, its
    System Folder with Fonts, and its seed, and adds to Special:
    _Restore Default Files_, then _Back Up All Files…_ and _Restore from
    Backup…_, whose alerts it holds (`dialogs.html`).

    An app file dropped or pasted on the desktop or into a folder installs
    its application, its icon where the file was let go, through the shell
    and SystemOnline's trust (`src/main.ts`). A file SystemOnline's key
    signed installs without asking; any other asks first, in SystemOnline's
    own alert (`src/apps/finder/installs.ts`), which says nobody vouches for
    it and that it can read and change everything on the desktop, Cancel
    the default. One whose application is already here asks to replace it,
    saying when the copy won't be offered updates; one the shell refuses
    says why, and so does an application's icon that won't open. Empty
    Trash with an application's last icon in it uninstalls it; its documents
    stay where they are, drawn plain, and opening one says the application
    that opens it could not be found, until it's installed again. A backup
    doesn't carry applications yet, so a Replace uninstalls them, and the
    defaults come back (clause 9).

## The Text Viewer

Installed from `apps/Text Viewer.png`, its icon in Macintosh HD, beside
About the Fonts. Its source is the text-viewer-app repo's `src/`. It
registers the `text` kind and opens it, and is handed nothing: a system
document's words it fetches from the document's path at each open,
revalidating, so a deploy's edit shows at the next. One the site no longer
serves says in its alert that its text is no longer part of this desktop,
and one it can't reach, offline say, that it can't be read now. A system
document weighs nothing in Empty Trash's alert.

12. One window per text file: `movable outline-drag resizable zoomable
    scrollbars="vertical"`, 440 × 320, the text verbatim in one body-face
    paragraph that keeps its line breaks and wraps at the window. The zoom box
    toggles a reading column at most 520 wide. File: _Close_, _Quit_ (every
    text window). Edit: _Copy_ (greyed without a selection in a text window),
    _Select All_. View: _Arrange Windows_.

## Desktop Patterns

Installed from `apps/Desktop Patterns.png`. Its source, and the files named
here, are the desktop-patterns-app repo's `src/`.

13. Desktop Patterns' icon in the System Folder's Control Panels
    (`art/desktop-patterns.png`: three pattern tiles, fanned), or Apple ▸
    Control Panels ▸ Desktop Patterns, opens one fixed, centered panel, out of
    the icon when opened from it: a preview well, a 13 × 3 chooser of the
    kit's 38 patterns, and a default **Set Desktop Pattern**. A click (or the
    arrow keys) previews a pattern and rings its cell, 1px black over the edge
    and 1px white inside; only the button sets the desktop's, which the
    session keeps. Closing discards an unset choice. Every piece is a kit
    element, the ring eight 1px `vf-container`s. File: _Close_, _Quit_. View:
    _Arrange Windows_.

## The Font Viewer

Installed from `apps/Font Viewer.png`, its icon in Macintosh HD. Its source,
and the files named here, are the font-viewer-app repo's `src/`. It opens
the shell's `font` kind
without owning it, and takes each family and its strikes from the system
(`ctx.fonts`), so it carries no strikes of its own.

14. One window per suitcase, wherever the suitcase is: `movable outline-drag
    resizable zoomable scrollbars="vertical"`, titled with the suitcase's
    name. It sets System 7's sample line, _How razorback-jumping frogs can
    level six piqued gymnasts!_, in every strike of the family, smallest
    first, then under a rule every character the chosen strike carries
    (ASCII, accented Latin, the rest), each paragraph in the strike itself at
    its rect and measured pitch, so nothing on it is another font's
    fallback. The status strip names the strike and counts its characters.
    It opens on the strike nearest 12. A suitcase whose family the system
    doesn't serve says so in an alert instead.
15. The **Size** menu lists the active window's strikes, _9 Point_ … (_16
    Pixels_ for a family the collection still names by line height), the
    current one checked. The system loads each strike on demand through the
    FontFace API, under the wristwatch; one that doesn't load says so in
    place. File: _Close_, _Quit_. Edit: _Copy_, _Select All_. View: _Arrange
    Windows_. See [FONTS.md](FONTS.md) for the collection.

## Meteors

Installed from `apps/Meteors.png`. Its source, and the files named here, are
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

## The App Store

Installed from `apps/App Store.png`, its icon on the desktop and App Store…
in the Apple menu. Its source, and the files named here, are the
system-online-app-store-app repo's `src/`. It holds no URL or key of its
own: the shell hands it the index at `apps.portill.io`, and it installs and
uninstalls through the shell's door, under SystemOnline's trust (clause 11).

19. One window, **App Store**, two lists, each a page of a mail-order
    catalog, an application a row: its box at the left, the file's own
    picture in color, on the grid (`picture.ts`), and at the right its name,
    version and author, its description, its size and its buttons.
    **Available** is every application in the index, offering the newest
    build this desktop runs and saying when a newer one needs a newer
    system, each reading **Install**, **Update** (an older version
    installed, signed by SystemOnline's key) or **Installed**. **Installed**
    is every application installed here, from the index or not, each with
    **Uninstall…**, which asks first; those with an update come first, with
    **Update All**. A fetched file is checked against the index's size and
    SHA-256 before its box is drawn or it's installed. The index is read
    when the window opens and once after the boot, so the window opens on
    Installed when the index has an update. File: _Close_, _Quit_. View:
    _Available_, _Installed_, _Arrange Windows_.

## The one CSS rule

The page may use small amounts of **layout** CSS but NO aesthetic CSS — looks
come from the components. Every caption is a `vf-label`, every run of copy a
`vf-paragraph`, every box a `vf-container` or a stack, and `src/desktop.css`
holds no rule. The Text Viewer's body keeps its line breaks and wraps by its
own style, the Font Viewer sets its smoothing token and row breaking on its
own elements, and Meteors' screen carries its pixelated magnification
itself, on its canvas, so none leans on a stylesheet of the site's.

`src/page.css` is the other half: the page-level CSS a component cannot reach
from its shadow root (the black behind the desktop, the scroll suppression that
keeps `fitWithin` from oscillating). `vintage-frames` ships no stylesheet
whatsoever, so both files are this repo's own work — that is the kit's design,
not an omission.
