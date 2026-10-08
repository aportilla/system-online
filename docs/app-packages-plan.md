# Plan: application packages

**Status:** steps 1 to 5 landed 2026-10-07, and Meteors ships as an app file
from its own repo, meteors-app. Left: eye checks 4 and 5, decision 21, and
step 6 at the kit's next minor. The story so far:

Drafted 2026-10-07. Decision 1 was taken 2026-10-07 as
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

Meteors' repo was scaffolded 2026-10-07, as `meteors-app`
(github.com/aportilla/meteors-app): the source and tests, `app.ts` and the
default export, the dev desktop and CI, the gates green. In headless
Chromium its dev desktop's icon opens the game, Return starts one, and Q
asks with the alert's art. Its build stops at the code, `dist/meteors.js`,
until the kit writes app files.

The packer then moved into the kit, 2026-10-07: _"should the KIT have the
artwork generator method? Like we'd call a kit owned method with our custom
artwork bit and metadata and the KIT itself generates the full image? … the
kit could even host the app bundle method that takes our app code as well
and hands back the fully encoded image?"_, then _"we can bake the frame
resource into vintage-frames, that's our own thing... and this is more of a
dev-dependency isn't it? not a shipped thing for regular vintage frames web
component consumers"_. The kit writes app files from a build-only entry, its
frame included, and reads them, so an application's repo carries no frame
and no packer, and this site no reader of its own (decisions 12 and 13,
taken). Nothing is proved here first: the kit builds it against meteors-app
and this site. Steps 3 to 5 became one, step 3, and the steps after it moved
up. The kit asks are written, in the kit's `feature-requests/`.

Steps 3 and 4 landed 2026-10-07. vintage-frames 0.17.0 writes and reads app
files: `vintage-frames/build` has `appFile()`, `appFiles()`, `packApp` and a
placeholder frame, and `shell/pure` has `readAppFile`, `satisfies` and
`VERSION`. The kit's `docs/APP-FILES.md` is the guide. meteors-app moved to
`^0.17.0`, its `vite.config.ts` became one `appFile()` call, and `npm run
build` writes `dist/Meteors.png`, 11.75 KB. The kit's `readAppFile` reads it
back: the manifest is right, and the code imports only `vintage-frames` and
`vintage-frames/shell`. The box shows the stamp, the name, the version and
the author. Next is step 5, SystemOnline taking the file (§4).

Step 5 landed 2026-10-07, merged to `main` as a34884b and deployed. The kit
is `^0.17.0`, `appFiles()` builds Meteors in from `apps/Meteors.png`, and
Meteors' source, tests and plan are gone from here. The gates are green, and
in headless Chromium eye checks 6 to 10, 12 and 13 hold (§8): on
system-online.portill.io, Meteors comes from its app file. Phase 2 has two
eye checks left, 4's Finder, Quick Look and mail and 5's test artwork, and
one decision open, 21, what the frame names. Step 6 waits for the kit's next
minor.

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
the kit's standard frame, after PICO-8's cartridges, with the platform
and the application's name, version and author drawn in the kit's type,
around the author's artwork, or the icon stamped large when there is none.
The desktop never reads the picture; it takes the icon from the manifest. SystemOnline keeps app files in `apps/` and builds them in, so
a release is a file copied into this repo, with no npm and no publishing.
Phase 1 cut Meteors' ties to the site. Phase 2 has the kit write and read
app files, from a build-only entry that regular consumers never import: the
frame, the kit's type as data, the compositor, a Vite plugin that makes an
application's build write its app file, and a second plugin that builds app
files into a site. That one checks the kit range each manifest requires and
hands Vite the code, which then imports the site's own copy of the kit.
Meteors moves to a repo of its own whose build writes `Meteors.png`, and this
site builds it in. For ease of development, an application's repo runs it on
a desktop of its own, and its build is the release. Phase 3 installs the same file at runtime: dropped on the desktop
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

**Where the format lives**: in the kit, in two halves by where they run
(§5). Reading (`readAppFile`, `satisfies` for a version against a range, and
the kit's `VERSION`) is pure and small, in `vintage-frames/shell/pure`: it
runs in a site's build now and in the shell's loader in Phase 3. Writing
(`writeAppFile`, the PNG encoder and the box) is in `vintage-frames/build`, a
build-only entry no page imports. The packer in an application's repo and
the reader here are one implementation, the kit's.

### 3.3 The box

A PICO-8 cartridge, for the shell's applications: one frame every
application shares, naming the platform and the application around the
author's artwork.

**The frame** is the kit's, drawn once and shipped in its build entry: a
picture and its slots. Its size is the frame's own. PICO-8's
cartridge is 160 × 205, and drawn at 3× a frame that size reads in a mail
client's preview. Everything fixed is drawn into the picture: the platform,
SystemOnline and where it lives, the border, the artwork's backdrop, and,
once Phase 3 lands, how to install the file. Which platform it names is
decision 21. The frame is yours to draw. Until then the kit ships a plain
placeholder: a white card 480 × 615, drawn at 3×, with a 384 × 384 artwork
area, the name in the display face and the version and author in the body
face. The packer fills the slots:

| Slot | What the packer puts there |
| --- | --- |
| artwork | the author's artwork, or the stamp |
| text | a line in one of the kit's faces, at the frame's scale and in its ink, with the manifest's fields in it: `{name} (v{version})`, `by {author}`, or fixed text such as "SystemOnline application" |

**The artwork** is the author's, and optional: any PNG at the slot's size,
or the slot's size divided by a whole number, which the packer magnifies
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
lacks is refused, naming it. The strikes are the kit's, as data (§5), since
the manifests aren't published (§1), so the type and the compositor ship
together.

**The compositor** is the kit's, beside the writer: a PNG reader and writer for
the forms art comes in (8-bit and indexed, non-interlaced; 16-bit and
interlaced files are refused, naming what to save them as), pasting by
alpha, whole-multiple magnification, and text from a strike it's handed. It
needs no canvas and no dependency, as Meteors draws into a raster of its
own.

**Where the frame lives**: in the kit, so an application's repo carries none,
and a new frame reaches an application at its next build on a kit that has
it. A box is packaging: one built in an older frame still installs.

**Meteors' box** starts with the stamp. Its artwork is yours to draw, or a
frame of the game's own screen, as a PICO-8 label is its game's.

### 3.4 Phase 2: Meteors as an app file

**The kit first** (step 3): its asks (§5), in one minor, built against
meteors-app and this site through a linked kit before it's released.

**The packing plugin**, `appFile()` from `vintage-frames/build`, in an
application's repo's `vite.config.ts`:

- It sets Vite's library mode: the entry, ES format, one module, the kit's
  entries left out.
- It fails the build on a bundle that breaks §3.5, naming what broke it: CSS
  emitted, more than one chunk, or Lit bundled in.
- It assembles the manifest, each field from one source: `id`, `name`,
  `version` and `author` from the application's `app.ts`, `requires` from
  the range of the repo's `vintage-frames` dev dependency, the kit the game
  is built and checked against, and `icon` from the icon's file.
- It composes the box in the kit's frame from the manifest and any artwork,
  adds the manifest and the code, and writes `dist/<name>.png`.

**The reading plugin**, `appFiles()` from `vintage-frames/build`, in this
site's `vite.config.ts` beside the build constants:

- An import of `*.png?app` reads the file and refuses one that isn't an app
  file.
- It checks `requires` against the kit's `VERSION` and fails the build,
  naming the application and both versions, when they don't meet. It's npm's
  peer check, moved into the file.
- It hands Vite the code. Vite resolves the code's kit imports to this site's
  own copy, so the page still has one copy of the kit.
- The import's default export is the factory, its definition given the
  manifest's icon, and it also exports the manifest. The kit types both.
- It watches the file, so a new `Meteors.png` reloads the dev server's page.

**The repo**, `meteors-app` (step 4, landed 2026-10-07):

```
package.json              vintage-frames as a dev dependency; build → dist/Meteors.png
vite.config.ts            the kit's appFile()
tsconfig.json             SystemOnline's
index.html, dev/main.ts   the dev desktop, its Finder art in dev/art/
src/                      today's src/apps/meteors/, with app.ts and a default export; any artwork in art/
test/                     today's three Meteors test files, imports re-pointed to ../src/
docs/meteors-plan.md      moved from here
.github/workflows/ci.yml  the three gates
```

- **Each manifest field has one source** (above). `src/app.ts` holds
  Meteors' id, name, version and author, `index.ts` takes its id and name
  from it, and `package.json` carries no version of its own.
- **No publishing.** `npm run build` writes `dist/Meteors.png`, and the
  release is that file, copied into SystemOnline's `apps/`.
- **Each kit minor** moves the dev dependency's range, gets a look at the game
  on the new kit, and a build. SystemOnline's build refuses the new kit until
  the new `Meteors.png` is in `apps/`.
- **The dev desktop.** `npm run dev` in the repo serves a bare desktop:
  `index.html` holds a `vf-desktop` with a menu bar, an Apple menu and the
  icon field, as SystemOnline's does. `dev/main.ts` imports `vintage-frames`
  first and starts the shell with the kit's Finder over `memoryStorage()`,
  seeded with Meteors' icon, and Meteors from its source; `?save=1` keeps the
  catalog and the session. The Finder's art is borrowed from SystemOnline.
  Most work on the game happens here.
- **On the real desktop before a release**, the repo's build can watch and
  write straight into SystemOnline's `apps/` (`vite build --watch`, with
  `appFile()`'s `copyTo`), and the reading plugin reloads the page.

**SystemOnline's side** (step 5):

- The kit bump, `appFiles()` in `vite.config.ts`, and the `?app` types in
  `tsconfig.json`.
- `apps/Meteors.png` from the repo's build, and `main.ts` building Meteors in
  from `apps/Meteors.png?app`.
- The Finder's defaults take Meteors' id from the manifest.
- `src/apps/meteors/` and its three tests go, and `docs/meteors-plan.md`
  moves with the game.
- The docs: SPEC's opening (§6, decision 20), §1's list of directories, §16's
  file names and a clause on `apps/`; README's tree; CLAUDE.md's
  "Applications and the shell" and "Where things are".

**Continuity.** Meteors keeps the id `meteors`, the window's item `meteors`
and the session key `meteors-best`. A visitor's icon and its place, the
window's place and the best score all carry over.

### 3.5 What an application in an app file relies on

The rules, in CLAUDE.md since step 2. The kit's packing plugin fails a build
on the ones a bundle shows: its imports, Lit, CSS.

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
3. **The kit writes and reads app files** (§5): the faces' strikes as data,
   `VERSION`, and app files: the reader in `shell/pure`, and the writer, the
   box, the frame (a placeholder first) and both plugins in
   `vintage-frames/build`. One minor, built against meteors-app and this site
   through a linked kit, then released. _Landed 2026-10-07, in vintage-frames
   0.17.0._
4. **The repo** (§3.4): scaffolded, with the source and tests moved, the dev
   desktop and CI, and a build that writes `dist/Meteors.png` through
   `appFile()`. _Landed 2026-10-07, as `meteors-app`, on `^0.17.0`._
5. **SystemOnline takes the file** (§3.4). _Landed 2026-10-07, merged and
   deployed; eye checks 4 and 5 are left:_
   - **The kit**: `vintage-frames` to `^0.17.0`.
   - **The plugin**: `appFiles()` in `vite.config.ts`, and
     `vintage-frames/build/client` beside `vite/client` in `tsconfig.json`'s
     `types`.
   - **The file**: `apps/Meteors.png`, copied from meteors-app's `dist/`.
   - **The wiring**: `main.ts` takes Meteors from `../apps/Meteors.png?app`
     in place of `./apps/meteors/index.ts`. The Finder's defaults
     (`src/apps/finder/index.ts`) take its id and name from that import's
     `manifest` in place of `METEORS`.
   - **What goes**: `src/apps/meteors/`, `test/meteors.test.mjs`,
     `meteors-field.test.mjs` and `meteors-raster.test.mjs`, and
     `docs/meteors-plan.md`, which meteors-app already carries.
   - **The docs**: SPEC's opening (decision 20), §1's list of directories,
     the Meteors clauses' file names and a clause on `apps/`; README's tree
     and its Meteors row; CLAUDE.md's "Applications and the shell" (Meteors
     comes from `apps/`, not `src/apps/`), "Where things are", and its
     kit-imports invariant, which gains `vintage-frames/build` for the Vite
     config.
   - **The checks**: the three gates, then §8's eye checks 4 to 10 and 12
     before the merge, and 13 after it.
6. **The next kit minor** goes through the pilot: Meteors' range and build,
   then SystemOnline's bump. What it took goes in this plan's status, and
   decides whether a second application moves before the shell settles.
   _Next, when the kit's next minor ships._

## 5. Kit asks

Each goes to the kit as `feature-requests/<name>.md`, as autoselect and the
app kind did.

For Phase 2, all in step 3, written 2026-10-07 and shipped the same day in
0.17.0:

1. **The faces' strikes as data** (`strikes-as-data.md`): each character's
   advance, placement and ink, for VF Display and VF Body, built from the
   glyph manifests along with the faces, for the packer to draw the kit's
   type without a browser. They come from the build entry.
2. **App files** (`app-files.md`): the format (§3.2), the box and the kit's
   frame (§3.3), and both plugins (§3.4). Reading (`readAppFile`,
   `satisfies`) is in `shell/pure`; writing, the box, `packApp`, `appFile()`
   and `appFiles()` are in `vintage-frames/build`, a build-only entry, with
   `vite` an optional peer. Regular consumers never import it.
3. **`VERSION`** (`version-export.md`), the kit's own, in `shell/pure`, for
   checking `requires`.

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
3. **Its own repo, Meteors alone**, over keeping Meteors' source here, built
   into its app file, or over waiting for the shell to settle. One
   application's build per kit minor is a cost small enough to measure, and
   the move reverses cleanly: the repo's `src/` drops back into
   `src/apps/meteors/` unchanged. No second application moves until step 6
   or the shell's status says so. _Recommended._
4. **App files, not npm**: an application ships as one PNG (§3.2). _Taken
   2026-10-07._
5. **Built in from `apps/`**, through the kit's `?app` plugin, with
   installing at runtime left to Phase 3. _Taken 2026-10-07._
6. **The box** (§3.3): the picture is a box in the kit's standard frame,
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
12. **The frame in the kit**, shipped in its build entry, over a copy in
    `box/` here and in each application's repo. _Taken 2026-10-07, over the
    recommendation of the copies._
13. **The whole packer in the kit**, over the format and the compositor alone
    with each repo wiring them. Reading stays small in `shell/pure` for
    Phase 3's loader; writing, the box and both plugins are in
    `vintage-frames/build`, a dev-time entry no page imports. The kit builds
    it against meteors-app and this site, over proving it here first and
    moving it. _Taken 2026-10-07._
14. **`requires` against the kit's `VERSION`**, over reading the installed
    kit's `package.json`, which bends the rule that the site imports the
    kit's three entries only. It ships with the plugin that checks it.
    _Recommended._
15. **Names**: the file `Meteors.png`, named as its application is.
    `Meteors.app.png` would say what it is in a list of attachments, but
    where extensions are hidden it reads as `Meteors.app`, a Mac application
    bundle it isn't. _Recommended._ The repo is `meteors-app`, over
    `system-online-meteors`. _Taken 2026-10-07._
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
21. **What the frame names.** The platform is drawn into the kit's frame. It
    can name SystemOnline, or the shell, since any desktop on the shell can
    load an app file. _Open: the frame is yours to draw._

## 7. Tests

By the policy: contracts, not wiring. Each module is the kit's (step 3), and
these are the tests `app-files.md` asks for.

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
- The two plugins and the library build are checked by eye, from
  meteors-app's build and this site's.
- `meteors.test.mjs`, `meteors-field.test.mjs` and `meteors-raster.test.mjs`
  are in meteors-app since step 4, with their imports re-pointed from
  `../src/apps/meteors/` to `../src/`, run by the same `node --test`. Step 5
  removes them here.
- Phase 3's plan says its own.

## 8. Eye checks

After Phase 1, in `npm run dev` (done, in the status):

1. Meteors' screen is crisp at 1×, 2× and 3×: the inline rule took.
2. Q in a game brings the alert, with its art.
3. A best score survives a reload, and `?fresh=1` starts with none.

After step 5:

4. `apps/Meteors.png` shows Meteors' box, its name, version and author
   legible and the stamp in its artwork area, in a browser, in the Mac's
   Finder and Quick Look, and as an attachment in a mail client. _Seen as an
   image 2026-10-07, from meteors-app's build; the Finder, Quick Look and
   mail are still to do._
5. Test artwork at a whole fraction of the slot comes out crisp.
6. The desktop shows Meteors' 32 × 32 icon, from the manifest. _Holds: under
   `npm run dev` its art is the manifest's `data:` URL, where the other
   icons' are the site's paths._
7. Under `npm run dev` and `npm run preview`, Meteors from its app file plays
   as before: the window out of its icon, the alert with its art, the best
   kept across a reload. _Holds in both; the alert's art is inlined in the
   code._
8. A copy of the file whose `requires` leaves out the installed kit fails the
   build, naming Meteors and both versions. _Holds, with a copy requiring
   `^0.16.2` written by the kit's `writeAppFile`: "Meteors 0.1.0 requires
   vintage-frames ^0.16.2, and this site has 0.17.0."_
9. A new `Meteors.png` while `npm run dev` runs reloads the page with it.
   _Holds._
10. The console shows no "already registered on this page" warning: one copy
    of the kit. _Holds, under dev and preview._

After Phase 2:

11. On the repo's dev desktop, the icon opens Meteors out of itself, the game
    plays, Q asks, Quit quits, and the window closes back into the icon.
    _The first three driven in headless Chromium 2026-10-07._
12. SystemOnline with the repo's `Meteors.png` plays as in 7, and a profile
    from before keeps the icon's place, the window's place and the best
    score. _Holds: a profile made on the commit before, with the icon and
    the window moved and a best of 1230, reopens on step 5's branch with both in
    place and "Best 1230" on the title screen._
13. After the merge, the deployed site has Meteors. _Holds, 2026-10-07: the
    deploy serves the bundle the local build made, and with `?fresh=1`
    Meteors' icon opens the game, a game starts, and Q asks with the alert's
    art; the console is clean._

## 9. Follow-ups

- **An application template**, from the pilot's repo, for the next
  application. With the packer in the kit, it is the source, `app.ts`, a
  one-call `vite.config.ts` and the dev desktop.
- **The dev desktop from the kit**: `appFile()` could serve a bare desktop
  under `npm run dev`, its Finder art with it as the frame is, so a repo
  carries no `index.html`, `dev/main.ts` or `dev/art/`. It's now the largest
  piece every application's repo copies.
- **Meteors' artwork**: yours to draw, or a frame of the game's own screen.
  It goes in meteors-app as `art/box.png`, named in `appFile()`'s `artwork`.
- **A watch script in meteors-app**: `vite build --watch`, with `copyTo` at
  SystemOnline's `apps/`, for trying a change on the real desktop before a
  release.
- **Desktop Patterns as an app file**, once step 6 or the shell's status
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

Step 3, in the kit:

- **Asks**: `feature-requests/strikes-as-data.md`, `app-files.md` and
  `version-export.md`.
- **Landed** in 0.17.0: the strike modules, generated by
  `manifest-to-font.py`; the reader and `VERSION` in `src/shell/`, exported
  from `shell/pure` and `shell`; the build entry, `src/build/`, with the PNG
  writer, the placeholder frame, the compositor, `packApp` and both plugins;
  their tests, `docs/APP-FILES.md`, SHELL.md and PUBLISHING.md.

Step 4, meteors-app, landed:

- **Scaffolded**: the repo, from `src/apps/meteors/` and its three tests,
  with `src/app.ts`, the default export, the dev desktop and CI.
- **Then**: `vite.config.ts` onto `appFile()`, `package.json`'s kit range
  at `^0.17.0`, and `allowImportingTsExtensions` in `tsconfig.node.json` for
  the config's import of `src/app.ts`.

Step 5, here:

- **New**: `apps/Meteors.png`, from the repo's build.
- **Changed**: `package.json` and `package-lock.json` for the kit bump;
  `vite.config.ts` (`appFiles()`); `tsconfig.json` (the `?app` types);
  `src/main.ts`; `src/apps/finder/index.ts`; `docs/SPEC.md`, `README.md`,
  `CLAUDE.md`.
- **Removed**: `src/apps/meteors/`, `test/meteors.test.mjs`,
  `test/meteors-field.test.mjs`, `test/meteors-raster.test.mjs`.
- **Moved**: `docs/meteors-plan.md`, to meteors-app.
