# Plan: application packages

**Status:** drafted 2026-10-07. Decision 1 was taken 2026-10-07 as
recommended: Phase 1 now. Steps 1 and 2 landed 2026-10-07, and the gates are
green. Two things go past §3.1 as drafted: `BEST` is no longer
exported, since nothing outside Meteors reads it, and `windows.ts`'s header
comment moved off `desktop.css` with the rule.

The route then changed, 2026-10-07: _"i'm not sure about publishing apps to
npm seperatly... can we have apps exist as local bundles? i wonder if we can
make apps portable as a png image with the app code sidecared inside the
file..."_, then _"this is the route i want to go"_. An application ships as
one PNG, its app file, and SystemOnline builds app files in from `apps/`
(decisions 4 and 5, taken). That replaces a route through npm, in which an
application's repo published a package with the kit as a peer dependency.

The app file's picture then became a box, 2026-10-07: _"our packager would
composite the boxart image we use, and include the icon image within the
payload"_, then _"we'll put the app name on the box art.. i want app authors
to have some leeway to provide their own boxart - which will be placed onto a
standardized frame ( our 'box' template ) ... with a plain icon stamp as the
fallback if no poster art is provided"_, with Atari's 2600 Asteroids box as
the reference (decision 6, taken).

Then the box took a PICO-8 cartridge as its model, 2026-10-07: _"our art
will look something like the pico8... a standardized frame with some
metadata about the platform, app name and version number and the author,
with a dedicatd area for artwork provided by the user. i don't think we need
to require the icon on the artwork area, that's something the app author can
do if they choose."_ The frame names the platform, the application, its
version and its author around the author's artwork (decision 6), and the
icon is on the box only if the author puts it there (decision 10, taken over
the recommendation). The app file keeps its chunks over PICO-8's pixels
(decision 7, taken as recommended). Phases 2 and 3 are written for boxed app
files. The rest of §6 is open.

Phase 1's eye checks (§8, 1 to 3) were driven in headless Chromium against
the dev server, and all hold:

- At 1×, 2× and 3× the canvas's computed style is `display: block` and
  `image-rendering: pixelated`, from its own attribute, and no stylesheet
  rule names `.meteors-screen`. Every px of the screen is black or white, at
  3 and 4 device px a canvas px under 2× and 3×. With smoothing turned back
  on as a control, the same screens show 9,904 and 26,185 gray px.
- Q in a game opens the alert, its 32 × 32 art loaded from `art/alert.png`,
  and Escape goes back to the game.
- A saved best of 1230 shows on the title screen, outlasts the boot's write
  and a reload, and `?fresh=1` shows none and leaves it stored. On a profile
  with no best, a game played to game over kept its 90 points as the best,
  through a reload.
- No "already registered" warning. The console's warnings are Lit's dev
  mode and the kit's own: `vf-icon`'s update warning comes as well when only
  Read Me is opened.

The ask: _"i'm interested in the idea of breaking the 'apps' out to their own
individual repos, maybe even having their own package bundles that can by
loaded individually via an 'app store' like expierience... i imagine a
prebuild package would have to declare it's vintage frames shell version
compatibility so that we can safely load it and let it call our vintage
frames apis... so if i wanted to build a new app - i'd create a fresh repo -
add a dev dependency on vintage frames - build the app according to a
strongly typed app interface and then publish the built package somewhere -
either github hosted or as a file i would drop into an /apps dir on this
repo, then on boot we'd just "install the apps" and they'd be available in
the system... I'm just shooting from the hip thinking about ease of
development going forward."_

The short version: an application ships as one file, its app file: a PNG
whose picture is the application's box and whose chunks carry its manifest,
its icon and its code, the way a Mac application's resource fork carried its
code beside its icons. The box is for people outside the desktop:
SystemOnline's standard frame, after PICO-8's cartridges, with the platform
and the application's name, version and author drawn in the kit's type,
around the author's artwork, or the icon stamped large when there is none.
The desktop never reads the picture; it takes the icon from the manifest. SystemOnline keeps app files in `apps/` and builds them in, so
a release is a file copied into this repo, with no npm and no publishing.
Phase 1 cut Meteors' ties to the site. Phase 2 gets the kit's type as data,
for the frame's text, proves the format and the box here on Meteors, moves them
into the kit's pure entry, then moves Meteors to a repo of its own whose
build writes `Meteors.png`. A small Vite plugin here reads an app file,
checks the kit range its manifest requires, and hands Vite the code, which
then imports this site's own copy of the kit. For ease of development, an
application's repo runs it on a desktop of its own, and its build is the
release. Phase 3 installs the same file at runtime: dropped on the desktop
it becomes the application's icon, and Empty Trash uninstalls it. That
waits for the shell to leave experimental status. The kit's minors changed
what an application is twice in the last week, and installed applications
that break on every minor make a broken desktop.

Checking a first sketch of this plan against the kit's source changed it in
eight ways:

- **Per-app state needs no kit change.** `ctx.state.set()` takes any key, and
  `bestOf` reads a best that was never set as none, so `main.ts`'s default for
  `meteors-best` can simply go. Keys share one namespace with the site's own,
  so an application prefixes its keys with its id, as `meteors-best` already
  does.
- **No shell API version apart from the kit's.** An application depends on
  the whole kit, not only the shell: its windows are component markup, and
  0.16.0 changed `vf-window`'s `closable` default. The kit's semver range is
  the honest declaration, and the kit's PUBLISHING.md already makes each 0.x
  minor the breaking step.
- **The kit already sizes an alert to its message**, in `composeAlert` (the
  kit's `src/shell/alert.ts`), for the Finder. It isn't exported. Meteors
  doesn't need it: its alert's copy is fixed.
- **A document without its application is handled.** The catalog keeps an
  item whose kind no application registers and leaves it out of the listing.
  What isn't handled is an application's own icon without the application: it
  shows the generic document art and opens nothing.
- **A built file dropped into the site is a good source**: same origin,
  nothing to configure. App files (§3.2) grew from it.
- **No import check here.** The repo of its own enforces Meteors' boundary,
  one step later.
- **Meteors leans on the site twice more than the sketch saw**: its canvas
  rule is in `src/desktop.css`, and its alert's art is `/icons/alert.png` from
  `public/`. A package can count on neither.
- **One broken application stops the desktop.** An `init` that throws stops
  `createShell`. That's fine for applications built together, and not for one
  loaded at runtime.

## 1. Where things stand

**The contract.** An application is an `AppDefinition` from
`vintage-frames/shell`: an id, a name, its icon, its menus, dialogs and
windows as markup, the catalog kinds it opens, and `init(ctx)`, which reaches
everything else through `AppContext`. `defineApp<Actions>` types the actions
`init` returns. Nothing in the contract names SystemOnline.

**What each application reaches outside its directory**, since Phase 1:

| Application | Outside its directory | An app file? |
| --- | --- | --- |
| Finder | `src/state/`, `src/texts/`, `src/lib/`, `charset-manifest.ts`, the Text Viewer's art, Meteors' id, the shared `ask()`, `public/icons/` | no: it is SystemOnline's configuration of the kit's Finder |
| Text Viewer | `state/kinds.ts`, `src/texts/`, the shared `ask()` and selection helpers, `.text-body` in `desktop.css`, `public/icons/` | not while its kind and texts are SystemOnline's |
| Font Viewer | `state/kinds.ts`, `charset-manifest.ts`, `public/fonts/imported/`, `public/icons/`, the shared `ask()` and selection helpers, `.font-specimen` and `.font-charset` in `desktop.css` | no: it views SystemOnline's font collection |
| Desktop Patterns | nothing | yes |
| Meteors | nothing | yes |

**One copy of the kit.** Custom elements register once per page. A second
copy of `vintage-frames` skips its registrations with a warning (the kit's
`src/define.ts`), and its module-level singletons, "the grid-snap scheduler,
applyScale() and the focus-modality tracker", reach only that copy's
components. An application uses the page's copy and never bundles its own.
Lit comes with the kit, which imports `lit`, `lit/decorators.js` and three of
Lit's directives.

**The kit's pace.** SystemOnline has taken the kit from 0.14.0 to 0.16.2
since 2026-09-29. Two of those releases changed what an application is:
0.15.0 (applications own their alerts) and 0.16.0 (the kit runs zoom, Quit
and window markup, and `vf-window`'s `closable` defaults to false). SHELL.md
keeps the shell experimental "until sprite-machine runs on all of it".

**The build.** Vite 8's library mode always inlines imported assets
(`shouldInline` returns true under `build.lib`), and a `?raw` import is a
string, so an application's art and markup ride inside its JavaScript. An
entry with no dynamic import builds to one module. A CSS import is split out
to a stylesheet of its own that every consumer would have to load, so an
application imports none.

**PNG.** A PNG is a signature and then a run of chunks, each a length, a
four-letter type, its data and a CRC-32 over type and data. A text chunk
changes no pixel: a decoder that doesn't care for it skips it. The pieces to
read and write chunks are here already: `src/lib/zip.ts` has the same CRC-32,
and the platform's compression streams do zlib in browsers and in Node.
SystemOnline's art is all 32 × 32, 8-bit RGBA PNG, non-interlaced.

**The faces.** `VF Display` and `VF Body` reach the page as woff2, inside the
kit's JavaScript. Their source of truth is a plaintext glyph manifest in the
kit's repo (`fonts/VF-Display.glyphs.txt`): each character's advance and
placement, and its ink as a field of `#` and `.`. The manifests aren't in the
published package, so a build has no way to draw the kit's type without a
browser.

## 2. The System 7 model we copy

- **An application is one file.** Its resource fork holds its code, icons,
  menus, dialogs, alerts and version, so the file is the whole application.
  It arrives by being copied to the disk, off a floppy or by an Installer,
  and leaves by being dragged to the Trash. What's installed is what's on the
  disk.
- **A fork can be lost.** A Mac file copied to a disk or a server that knew
  nothing of forks lost its resource fork, and with it the application.
  BinHex and StuffIt wrapped files for the trip.
- **Software came in a box, on disks.** The box was printed packaging, in
  color, for software that ran in black and white, and each disk's label
  named the application, its version and its maker. They were what you saw
  in the store; the icon was what the Finder showed. A publisher kept one
  frame for every title.
- **An application checks what it runs on.** One that needs a newer System
  says so in an alert when it is opened.
- **A document needs its application.** Opening one whose application isn't
  on the disk brings an alert saying the application couldn't be found.
- **The alert icons are the System's.** Stop, note and caution are resources
  in the System file, and every application's alerts draw them.

An app file has the same shape. Its picture is the box, its chunks are the
resource fork with the icon in it, and anything that re-encodes the picture
is the disk that drops the fork. Phase 2 builds app files in, and Phase 3
installs them as System 7 did (§3.6).

## 3. Design

### 3.1 Phase 1: Meteors leans on nothing here

Three changes, all in this repo:

- **The best score's default goes.** `main.ts`'s `extra` drops `[BEST]: 0`,
  and `BEST` leaves its import. Nothing changes for a player: a best that was
  never set reads as 0 through `bestOf`, as it does today.
- **The canvas's rule moves onto the canvas.** `display: block;
  image-rendering: pixelated` becomes a `style` attribute on the canvas in
  `windows.html`, and the Meteors section leaves `src/desktop.css`. It's the
  screen's own layout, and a package can't count on a site's stylesheet.
- **The alert carries its art.** A copy of `alert.png` goes in `art/`,
  imported as the icon is, and `init` sets it on the end-game alert's `img`,
  which loses its `src`. A package can't count on a site's `public/`.

After this, Meteors imports only the kit's three entries and its own files.
SystemOnline names Meteors twice: in `main.ts`'s list of applications, and in
the Finder's defaults, which put its icon on a new desktop.

### 3.2 The app file

**One PNG**, named for its application: `Meteors.png`. Its picture is the
application's box (§3.3), for people outside the desktop: in a file manager,
a mail client, on GitHub. The desktop never reads the picture.

**Two chunks before `IEND`**, both `iTXt`, PNG's standard text chunk, which
any PNG tool reads:

| Keyword | Compressed | Holds |
| --- | --- | --- |
| `vintage-frames.app` | no | the manifest, as JSON |
| `vintage-frames.code` | yes, zlib | the application's code, one ES module |

**The manifest:**

```json
{
  "format": 1,
  "id": "meteors",
  "name": "Meteors",
  "version": "0.1.0",
  "requires": "^0.16.2",
  "author": "Adam Portilla",
  "icon": "data:image/png;base64,iVBORw0KGgo…"
}
```

- `format` is the app file's own version, so a reader can refuse a file it
  doesn't know.
- `requires` is the kit range the code runs on, in npm's syntax.
- `author` is who made it, for the box.
- `icon` is the application's 32 × 32 icon, its PNG as it is. The desktop
  draws this one, so an application's icon shows without its code running,
  which Phase 3 leans on.

**The code** is the application's own library build (§1), ES format, with the
kit's three entries left out, so it imports them by name. Its default export
is the application's factory, `meteors()` today. Its art and markup are
inlined, and it is one module, any dynamic import built in.

**Reading** checks the PNG signature and every chunk's CRC, requires both
chunks and a `format` it knows, and inflates the code. A PNG without them is
a picture, not an application.

**Writing** takes the finished box, drops any app chunks already there, and
adds the two before `IEND`. It never re-encodes the picture.

**Size.** Meteors' source is 45 KB with its comments. Minified and
compressed, its code chunk should come to a few KB. A box of pixel art adds a
few KB more, and painted artwork a few hundred.

**What strips it**: anything that re-encodes the picture or strips its
metadata, such as an image optimizer, a chat app that recompresses uploads,
or an optimizer in front of a site. PICO-8 keeps its cartridges in the
pixels instead, which outlasts a metadata stripper (§6, decision 7). An app
file travels as a file: in a repo, as a download, by email.

**Where the format lives**: one pure module, with `readAppFile`,
`writeAppFile` and `satisfies` (a version against a range), over a PNG module
of its own. It runs in the build, under Node's tests, and in the browser for
Phase 3. It's proved here first (`src/lib/app-file.ts` and `png.ts`), then
goes to the kit's `vintage-frames/shell/pure` (§5), so the packager in an
application's repo and the reader here are one implementation.

### 3.3 The box

A PICO-8 cartridge, for SystemOnline: one frame every application shares,
naming the platform and the application around the author's artwork.

**The frame** is SystemOnline's, drawn once: `box/frame.png`, the picture,
and `box/frame.json`, its slots. Its size is the frame's own. PICO-8's
cartridge is 160 × 205, and drawn at 3× a frame that size reads in a mail
client's preview. Everything fixed is drawn into the picture: the platform,
SystemOnline and where it lives, the border, the artwork's backdrop, and,
once Phase 3 lands, how to install the file. The frame is yours to draw;
step 4 starts from a plain placeholder. The packager fills the slots:

| Slot | What the packager puts there |
| --- | --- |
| artwork | the author's artwork, or the stamp |
| text | a line in one of the kit's faces, at the frame's scale and in its ink, with the manifest's fields in it: `{name} (v{version})`, `by {author}`, or fixed text such as "SystemOnline application" |

**The artwork** is the author's, and optional: any PNG at the slot's size,
or the slot's size divided by a whole number, which the packager magnifies
by that number, so pixel art drawn small stays crisp. Any other size is
refused, naming the slot's. What it shows is the author's call: the icon is
on it only if they put it there. Without artwork, **the stamp** takes its
place: the icon magnified 8× on the slot's backdrop.

**Color.** The box is packaging, not the screen, so it can be in color, as
Mac software's boxes were for software that ran in black and white. The
frame's palette is the frame's; artwork can be anything.

**The text** is drawn from the kit's strikes, VF Display or VF Body as the
slot says, a glyph at a time, the way QuickDraw drew a bitmap font. A line
too long for its slot is shortened with an ellipsis. A character the strike
lacks is refused, naming it. The strikes come from the kit, as data (§5),
since the manifests aren't published (§1).

**The compositor** is pure, beside the format: a PNG reader and writer for
the forms art comes in (8-bit and indexed, non-interlaced; 16-bit and
interlaced files are refused, naming what to save them as), pasting by
alpha, whole-multiple magnification, and text from a strike it's handed. It
needs no canvas and no dependency, as Meteors draws into a raster of its
own. It's proved here, then goes to the kit (§5).

**Where the frame lives**: here, in `box/`. An application's repo carries a
copy, which the application template brings. A box is packaging: one built
in an older frame still installs.

**Meteors' box** starts with the stamp. Its artwork is yours to draw, or a
frame of the game's own screen, as a PICO-8 label is its game's.

### 3.4 Phase 2: Meteors as an app file

**The kit's type first** (step 3): the faces' strikes as data (§5), so the
packager can draw names.

**Proved here** (step 4). Meteors' source stays where it is.
`src/apps/meteors/app.ts` holds Meteors' id, name, version and author.
`index.ts` takes its id and name from it, and the packager reads all four,
so the manifest can't drift from the definition. `index.ts` also gains its
default export. `vite.meteors.config.ts` builds Meteors as a library,
composes its box from the frame, the manifest and any artwork, and writes
`apps/Meteors.png`, and `npm run build:meteors` runs it. `main.ts` builds
Meteors in from `apps/Meteors.png?app`. Until step 7, a change to the game
means running `build:meteors` again, or the site keeps the old build.

**The `?app` plugin**, in `vite.config.ts` beside the build constants:

- An import of `*.png?app` reads the file and refuses one that isn't an app
  file.
- It checks `requires` against the installed kit and fails the build, naming
  the application and both versions, when they don't meet. It's npm's peer
  check, moved into the file.
- It hands Vite the code. Vite resolves the code's kit imports to this site's
  own copy, so the page still has one copy of the kit.
- The import's default export is the factory, its definition given the
  manifest's icon, and it also exports the manifest. `src/env.d.ts` types
  both.
- It watches the file, so a new `Meteors.png` reloads the dev server's page.

**The repo**, `system-online-meteors` (step 6):

```
package.json              vintage-frames as a dev dependency; build → dist/Meteors.png
vite.config.ts            the library build, then the box and the kit's writer
tsconfig.json             SystemOnline's
box/                      a copy of SystemOnline's frame
index.html, dev/main.ts   the dev desktop
src/                      today's src/apps/meteors/, after step 4, any artwork in art/
test/                     today's three Meteors test files, imports re-pointed to ../src/
docs/meteors-plan.md      moved from here
.github/workflows/ci.yml  the three gates
```

- **Each manifest field has one source**: `id`, `name`, `version` and
  `author` from `src/app.ts`, `requires` from the range of the
  `vintage-frames` dev dependency, the kit the game is built and checked
  against, and `icon` from the art the code imports.
- **No publishing.** `npm run build` writes `dist/Meteors.png`, and the
  release is that file, copied into SystemOnline's `apps/`.
- **Each kit minor** moves the dev dependency's range, gets a look at the game
  on the new kit, and a build. SystemOnline's build refuses the new kit until
  the new `Meteors.png` is in `apps/`.
- **The dev desktop.** `npm run dev` in the repo serves a bare desktop:
  `index.html` holds a `vf-desktop` with a menu bar, an Apple menu and the
  icon field, as SystemOnline's does. `dev/main.ts` imports `vintage-frames`
  first and starts the shell with the kit's Finder over `memoryStorage()`,
  seeded with Meteors' icon, and Meteors from its source. The Finder's art is
  borrowed from SystemOnline. Most work on the game happens here.
- **On the real desktop before a release**, the repo's build can watch and
  write straight into SystemOnline's `apps/`, and the plugin reloads the
  page.

**SystemOnline's side** (step 7):

- `apps/Meteors.png` from the repo's build, in place of step 4's.
- The Finder's defaults take Meteors' id from the manifest.
- `src/apps/meteors/`, its three tests, `vite.meteors.config.ts` and
  `build:meteors` go, and `docs/meteors-plan.md` moves with the game.
- The docs: SPEC's opening (§6, decision 20), §1's list of directories, §16's
  file names and a clause on `apps/` and `box/`; README's tree; CLAUDE.md's
  "Applications and the shell" and "Where things are".

**Continuity.** Meteors keeps the id `meteors`, the window's item `meteors`
and the session key `meteors-best`. A visitor's icon and its place, the
window's place and the best score all carry over.

### 3.5 What an application in an app file relies on

The rules, in CLAUDE.md since step 2:

- **Imports**: `vintage-frames`, `vintage-frames/shell`,
  `vintage-frames/shell/pure` and its own files. It composes the kit's
  elements and brings no Lit of its own.
- **Art** is imported, so the build inlines it. No page paths.
- **Layout** sits on its own elements. No site stylesheet, and no CSS import.
- **Session keys** carry its id, are read back defensively as `bestOf` does,
  and nothing breaks when `ctx.state` is null.
- **Nothing site-specific through the context**: no `ctx.services`, and no
  `ctx.apps`. SPEC already says no application calls another.
- **Its kinds are named after its id**, since the shell doesn't refuse two
  registrations of one kind (§5).
- **Its id never changes.** Saved icons, windows and sessions name it.

### 3.6 Phase 3: installing app files at runtime

A sketch. Phase 3 gets its own plan once the shell leaves experimental
status.

- **The same file.** What Phase 2 builds in, Phase 3 installs by hand, as
  System 7 did (§2).
- **Installing**: a file dropped on the desktop or pasted is offered to the
  kinds' `claim`, and the shell's `app` kind claims an app file. It keeps the
  file and puts the application's icon where it was dropped, drawn from the
  manifest. What's installed is what's on the disk.
- **The box at the door.** The alert that asks whether to install a file can
  show its box: the file is the picture.
- **Uninstalling**: Empty Trash with the icon in it drops the file
  (`onRemove`).
- **Sharing**: Copy puts the file on the system clipboard (`export`).
- **Backups** carry app files as `.png` entries, so an unzipped backup shows
  each application as its box. That changes SPEC §9's rule that an
  application's icon is the system's and left out.
- **The boot** reads the catalog, loads each installed app file whose
  `requires` the kit meets, registers its kinds, lists, and then reopens the
  session. One that fails to load, doesn't match or throws in `init` is
  skipped, and the rest boot. Its icon stays, and opening it says why.
- **The kit's names.** Loaded at runtime, the code goes through no bundler,
  so its imports of the kit's three entries have to be pointed at the kit the
  page runs: through an import map, or by the loader pointing the three names
  at the kit the shell hands over. Phase 3's plan picks.
- **Trust.** A loaded app file runs with the whole page's reach: the catalog,
  the session, every window. App files carry a third chunk, a signature over
  the manifest and code. SystemOnline holds your public key and checks it
  with WebCrypto, and a file it can't verify doesn't open. Built-in app files
  need none: they're committed.
- **Sources**: dropped and pasted files first. Later perhaps a read-only
  volume of software whose icons copy to Macintosh HD, as off a floppy. A
  server that hosts app files serves them unmodified, with no image optimizer
  in front.

## 4. Steps

Each step ends with `npm test`, `npm run typecheck` and `npm run build` green
in the repo it touches.

1. **Meteors leans on nothing here** (§3.1), with SPEC's "The one CSS rule"
   and the comments in `windows.html` and `desktop.css` brought along.
   _Landed._
2. **The rules** (§3.5) in CLAUDE.md's "Applications and the shell".
   _Landed._
3. **The kit's type** (§5): the faces' strikes as data, and SystemOnline's
   kit bump to take them.
4. **The format and the box, proved here** (§3.2 to §3.4): `src/lib/png.ts`,
   `app-file.ts` and `box.ts` with their tests, a placeholder frame in
   `box/`, Meteors' `app.ts` and default export, `vite.meteors.config.ts`
   writing `apps/Meteors.png`, the `?app` plugin, and `main.ts` building
   Meteors in from its app file. The eye checks in §8.
5. **The format and the box in the kit** (§5): step 4's modules in
   `vintage-frames/shell/pure`, with `VERSION`. SystemOnline moves onto them,
   and its own copies go.
6. **The repo** (§3.4): scaffolded, with the source and tests moved, the dev
   desktop, CI, a copy of the frame, and a build that writes
   `dist/Meteors.png`.
7. **SystemOnline takes the file** (§3.4).
8. **The next kit minor** goes through the pilot: Meteors' range and build,
   then SystemOnline's bump. What it took goes in this plan's status, and
   decides whether a second application moves before the shell settles.

## 5. Kit asks

Each goes to the kit as `feature-requests/<name>.md`, as autoselect and the
app kind did.

For Phase 2:

1. **The faces' strikes as data** (step 3): each character's advance,
   placement and ink, for VF Display and VF Body, from a DOM-free entry, built
   from the glyph manifests along with the faces. A build can then draw the
   kit's type without a browser.
2. **The app file format and the box** (step 5): `readAppFile`,
   `writeAppFile`, `satisfies` and the compositor (§3.2, §3.3), from step 4's
   modules and tests.
3. **`VERSION`** (step 5), the kit's own, in `shell/pure`, for checking
   `requires`.

Worth raising now, though none blocks Phase 2:

4. **Refuse a duplicate.** `createShell` takes two applications with one id,
   or two registrations of one kind, without a word. `app(id)` finds the
   first, `apps` holds the last one's actions, and the last kind wins, the
   shell's own `app` kind included. A throw would catch it at the first boot.
5. **An application's icon without its application.** The `app` kind's art
   falls back to `''`, so the Finder draws its generic document art (here the
   text-file icon), and opening it does nothing. It wants application art,
   and an alert when opened, as System 7 gave a document without its
   application.
6. **The alert sized to its message.** `composeAlert` does it for the Finder
   and isn't exported. SystemOnline's `ask()` (`src/apps/windows.ts`) repeats
   its arithmetic for authored alerts, and so would every application in an
   app file whose message varies.
7. **The system's alert art, handed to applications.** The site already gives
   the Finder its caution art. Passed on through `ctx`, an application's alert
   would need neither its own copy nor a page path.

For Phase 3:

8. **Loading app files in the boot**, between reading the catalog and
   reopening the session.
9. **Isolation**: an `init` that throws, or a reopen that rejects, takes down
   that application alone. Today the first stops `createShell`, and the
   second rejects `ready` with the rest of the session unopened.
10. **The kit's names for loaded code** (§3.6).
11. **App files in the `app` kind**: `claim`, `export` and `onRemove` for
    them, the icon drawn from the manifest, and the file kept beside the
    item.
12. **Signatures**: the site's public keys, and a file that can't be verified
    not opening.
13. **Uninstalling while running**: the application's windows close, its
    menus and kinds go, and its documents leave the listing.

## 6. Decisions

1. **Phase 1 now.** Three small changes that hold whatever happens to the
   rest. _Taken 2026-10-07 as recommended._
2. **Meteors first**, over Desktop Patterns, which leans on nothing already
   but tries less of the contract: no icon, no session key, no alert, no art.
   _Recommended._
3. **Its own repo, Meteors alone**, over stopping at step 4, with Meteors'
   source here built into its app file, or over waiting for the shell to
   settle. One application's build per kit minor is a cost small enough to
   measure, and the move reverses cleanly: the repo's `src/` drops back into
   `src/apps/meteors/` unchanged. No second application moves until step 8
   or the shell's status says so. _Recommended._
4. **App files, not npm**: an application ships as one PNG (§3.2). _Taken
   2026-10-07._
5. **Built in from `apps/`**, through the `?app` plugin, with installing at
   runtime left to Phase 3. _Taken 2026-10-07._
6. **The box** (§3.3): the picture is a box in SystemOnline's standard frame,
   after PICO-8's cartridges, naming the platform and the application's
   name, version and author around the author's artwork, or the icon's stamp
   without any. The icon the desktop draws rides in the manifest. _Taken
   2026-10-07._
7. **`iTXt` chunks**, over chunk types of our own, or PICO-8's way of hiding
   a cartridge in the low two bits of every pixel's channels. Any PNG tool
   reads chunks, decoders skip them, and the art stays exact. Pixels would
   outlast a tool that strips metadata, but they put noise in the art,
   compress worse, need every pixel decoded to read them, and hold about a
   byte a pixel before the noise shows: some 288 KB in a 480 × 615 box,
   where one chunk holds up to 2 GB. _Taken 2026-10-07 as recommended._
8. **The frame's text drawn from the kit's strikes**, over a canvas library in
   the build or each application drawing its own: no dependency, and the
   kit's own type on every box. _Recommended._
9. **Artwork at the slot's size or a whole fraction of it**, over scaling any
   size to fit, which smooths pixel art. _Recommended._
10. **No icon required on the box.** The artwork is the author's, and the
    icon is on it only if they put it there. _Taken 2026-10-07, over the
    recommendation of the icon small on every box._
11. **Color on the box**, as Mac software's boxes had. _Recommended._
12. **The frame in `box/`, copied into each application's repo**, over
    fetching it at build time or a package of its own. _Recommended._
13. **The format and the box in the kit's `shell/pure`**, after step 4 proves
    them here, over a copy in each repo or a package of their own. The
    packager and the reader want one implementation, and Phase 3's loader is
    the kit's. _Recommended._
14. **`requires` against the kit's `VERSION`**, over reading the installed
    kit's `package.json`, which bends the rule that the site imports the
    kit's three entries only. Step 4 reads the `package.json` until step 5
    brings `VERSION`. _Recommended._
15. **Names**: the repo `system-online-meteors`, and the file `Meteors.png`,
    named as its application is. `Meteors.app.png` would say what it is in a
    list of attachments, but where extensions are hidden it reads as
    `Meteors.app`, a Mac application bundle it isn't. _Recommended._
16. **`requires` of one kit minor**, from the dev dependency's range, and
    Meteors at 0.x: a minor when the range moves, a patch for the game alone.
    _Recommended._
17. **The same id and keys** (§3.4, continuity). _Recommended._
18. **Phase 3 waits** for the shell to leave experimental status, then gets
    its own plan. _Recommended._
19. **Signed app files in Phase 3**, over opening any dropped file.
    _Recommended._
20. **SPEC's opening**: "built on nothing but the published `vintage-frames`
    package" becomes "built on the published `vintage-frames` package and
    SystemOnline's own app files". _Recommended._

## 7. Tests

By the policy: contracts, not wiring. Each module is step 4's, then the
kit's from step 5.

- Phase 1 added none. `meteors.test.mjs` already reads a best that was never
  set as none.
- **PNG**:
  - each form art comes in reads to the same pixels, and 16-bit and
    interlaced files are refused, naming what to save them as;
  - what the writer writes reads back pixel for pixel.
- **The app file**:
  - a written app file reads back its manifest and code, its manifest's icon
    is the icon's file byte for byte, and its other chunks are the box's;
  - writing over an app file replaces its app chunks rather than adding a
    second pair;
  - a PNG without them, a broken CRC, a missing chunk or an unknown `format`
    reads as no application;
  - `satisfies`: a caret range on 0.x takes its minor's patches and nothing
    past them, and on 1.x and up, its major's.
- **The box**, against a small frame and strike made in the test:
  - a text slot draws its line with the manifest's fields in it, each
    glyph's ink where the strike puts it, at the slot's scale and in its
    ink; a line too long is shortened with an ellipsis; a character the
    strike lacks is refused;
  - artwork at the slot's size lands as it is, artwork at a whole fraction
    is magnified to fill the slot, and any other size is refused, naming the
    slot's;
  - with no artwork, the stamp: the icon at the frame's multiple, centered,
    pasted by its alpha;
  - everything outside the slots is the frame's, untouched.
- The `?app` plugin, the library build and the packager's wiring are checked
  by eye.
- Step 7 moves `meteors.test.mjs`, `meteors-field.test.mjs` and
  `meteors-raster.test.mjs` to the new repo, with their imports re-pointed
  from `../src/apps/meteors/` to `../src/`, run by the same `node --test`.
- Phase 3's plan says its own.

## 8. Eye checks

After Phase 1, in `npm run dev` (done, in the status):

1. Meteors' screen is crisp at 1×, 2× and 3×: the inline rule took.
2. Q in a game brings the alert, with its art.
3. A best score survives a reload, and `?fresh=1` starts with none.

After step 4:

4. `apps/Meteors.png` shows Meteors' box, its name, version and author
   legible and the stamp in its artwork area, in a browser, in the Mac's
   Finder and Quick Look, and as an attachment in a mail client.
5. Test artwork at a whole fraction of the slot comes out crisp.
6. The desktop shows Meteors' 32 × 32 icon, from the manifest.
7. Under `npm run dev` and `npm run preview`, Meteors from its app file plays
   as before: the window out of its icon, the alert with its art, the best
   kept across a reload.
8. A copy of the file whose `requires` leaves out the installed kit fails the
   build, naming Meteors and both versions.
9. A new `Meteors.png` while `npm run dev` runs reloads the page with it.
10. The console shows no "already registered on this page" warning: one copy
    of the kit.

After Phase 2:

11. On the repo's dev desktop, the icon opens Meteors out of itself, the game
    plays, Q asks, Quit quits, and the window closes back into the icon.
12. SystemOnline with the repo's `Meteors.png` plays as in 7, and a profile
    from before keeps the icon's place, the window's place and the best
    score.
13. After the merge, the deployed site has Meteors.

## 9. Follow-ups

- **An application template**, from the pilot's repo, for the next
  application, the frame included.
- **Meteors' artwork**: yours to draw, or a frame of the game's own screen.
- **Desktop Patterns as an app file**, once step 8 or the shell's status
  says so.
- **Phase 3's plan.**
- **The code without its icon.** The manifest carries the icon, so the build
  needn't inline it a second time.
- **An inline source map** in the code chunk, for debugging an app file in
  place.
- **Kinds in the manifest**, with their art, so an installed application's
  documents list before its code loads, as a Mac application's bundle
  resource (`BNDL`) told the Finder its documents' icons.
- **The Text Viewer as an app file**, if its text kind ever stops being
  SystemOnline's alone.
- **A `ctx.state` scoped to an application**, prefixing its keys, if two ever
  collide.
- **Typed `ctx.apps`**, if an application ever calls another.

## 10. Files touched

Phase 1, landed:

- **New**: `src/apps/meteors/art/alert.png`, a copy of
  `public/icons/alert.png`.
- **Changed**: `src/main.ts`, `src/apps/meteors/index.ts`, `windows.ts`,
  `windows.html` and `dialogs.html`, `src/desktop.css`, `docs/SPEC.md`,
  `CLAUDE.md`.

Step 3:

- **In the kit**: the strikes as data, built from the glyph manifests, their
  export and tests.
- **Here**: `package.json` and `package-lock.json` for the kit bump.

Step 4:

- **New**: `src/lib/png.ts`, `src/lib/app-file.ts`, `src/lib/box.ts`,
  `test/png.test.mjs`, `test/app-file.test.mjs`, `test/box.test.mjs`,
  `box/frame.png`, `box/frame.json`, `src/apps/meteors/app.ts`,
  `vite.meteors.config.ts`, `apps/Meteors.png`.
- **Changed**: `vite.config.ts` (the `?app` plugin), `src/env.d.ts`,
  `src/main.ts`, `src/apps/meteors/index.ts`, `package.json`
  (`build:meteors`), `tsconfig.node.json` (the new config).

Step 5:

- **In the kit**: the format, the compositor and `VERSION` in `src/shell/`,
  exported from `shell/pure` and `shell`, with tests and SHELL.md.
- **Here**: `package.json` and `package-lock.json` for the kit bump, and
  `vite.config.ts` and `vite.meteors.config.ts` onto the kit's modules.
  `src/lib/png.ts`, `app-file.ts` and `box.ts` and their tests are removed.

Steps 6 and 7:

- **New**: the `system-online-meteors` repo.
- **Changed**: `apps/Meteors.png`, from the repo's build;
  `src/apps/finder/index.ts`; `docs/SPEC.md`, `README.md`, `CLAUDE.md`.
- **Removed**: `src/apps/meteors/`, `test/meteors.test.mjs`,
  `test/meteors-field.test.mjs`, `test/meteors-raster.test.mjs`,
  `vite.meteors.config.ts` and `build:meteors`.
- **Moved**: `docs/meteors-plan.md`, to the new repo.
