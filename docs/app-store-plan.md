# Plan: the App Store

**Status:** drafted 2026-10-10. Step 1 is under way: its repo,
`system-online-app-index`, is pushed, and its Cloudflare project is next.
Step 2's kit ask is written (`store-helpers.md`), and step 3's,
`runtime-installs.md`, is the next to write; `docs/kit-asks.md` tracks
both.
Decisions 1, 2, 6, 9 and 17, 11's sideloading and 4's repo were taken
2026-10-10; the rest are recommended (§6). Decision 6 makes the store an
application of its own, an app file SystemOnline ships installed and
signed by your key. Decision 17 makes trust each site's setting, so a
desktop on another domain can run open, or sign its own applications. The
steps changed the same day (§4). The store's
helpers, asks 10 to 12, left the runtime minor for a kit patch of their
own, step 2, since each only adds. The packages plan's step 6 joined
step 3, since no other kit minor is queued. Signatures joined step 3 as
well: under decision 9 only what your key signed is offered an update, so
every file installed at runtime is signed from the first. The ask: _"i was
thinking of maybe building an app-store app - that would display the images
and metadata for all of the apps that i'm developing and publishing... as i
create apps and publish them to github/npm i could update an RSS or JSON
source of truth that the app-store app would read and display
so that anyone viewing a system-online virtal desktop and using hte app
store app would see the latest ( compatible ) available apps they can
install. People could of course sideload their own apps by dropping them
onto their desktops and installing them into the virtal system... but we'd
have a canonical source of apps that I provide that can be updated live
without a redeployment of system-online or an update to the app-store
app"_, then, on the boxes in color and the store itself: _"I'm ok with spots
of color - these kinds of anachronisms or part of system-onlines delight.
Likewise the app-store in system-online will be a kind of time-travel
magic :)"_

The short version: your applications get an index of their own, and
SystemOnline gets an App Store that reads it. The index is a repo and a
host apart from the site: each published app file at a path that never
changes, and an `index.json` built from the files, so the listing can't
disagree with them. Publishing is a file committed there, and nothing here
is redeployed. The App Store is an application of its own: an app file like
any other, which SystemOnline ships installed and signed by your key. It
reads the index, shows each application this desktop's kit can run as its
box, in color, and installs one through the same door a dropped file takes.
In the background it finds the updates for the applications your key
signed and lists them, and a click installs one, or all of them: nothing
updates without asking. With a build for each kit already published, that
is what makes a kit minor survivable for installed applications. The store
stands on the packages plan's Phase 3, installing app files at runtime,
and this plan takes Phase 3 up: its mechanics as kit asks (§5), the site's
side here.

"The index", not "the catalog": the catalog is the shell's record of what
is where, and the store writes to it.

Checking the idea against the kit and this site shaped it in eight ways:

- **Applications are fixed when the shell starts.** `createShell` reads its
  `apps` once, registers their kinds and runs every `init` before the boot
  reads the catalog. An application installed from the store, or from a
  drop, needs the shell to take one after it has started: the packages
  plan's ask 8 is the store's foundation, not a detail.
- **An installed application's icon needs its manifest.** The `app` kind
  takes its art from the registered definitions and falls back to `''`, so
  an application that didn't load, on the wrong kit say, shows the generic
  document art and opens nothing.
- **A new manifest field doesn't break an older reader.** `manifestOf`
  copies the six fields it knows and drops the rest, so a 0.17 reader takes
  a file with a `description`. Today's writer drops it too, since
  `writeAppFile` writes the checked manifest: the field is a kit change, but
  not a new format.
- **Two of the kit's helpers stay inside.** `satisfies` rests on a
  `compareSemver` that isn't exported, and the store's newest-build rule
  needs one. `inspectAppFile` says why a file isn't an app file, where
  `readAppFile` returns null, and the index's build wants the reason.
- **There's room for the files.** The catalog is in IndexedDB, so keeping
  each installed application's whole file is no strain. Meteors' is
  11.7 KB.
- **Backups leave applications out.** `backup.ts` treats an application's
  icon as the system's, not a file, and a Replace puts the built-in ones
  back. An installed application is a file the visitor chose, and a backup
  that left it out would lose it. The packages plan's sketch already
  carries app files in backups; with the store, a restore is one more door
  into the desktop, and goes through the same check.
- **The site reads nothing from another origin today**, and sets no
  Content-Security-Policy. The store's fetch needs nothing on this side;
  the index's host has to send the CORS header.
- **Restore Default Files already restores applications' icons**, by id,
  through `missingDefaults`. With your applications installed rather than
  built in (§3.6), it restores the file with the icon.

## 1. Where things stand

**App files** are the kit's since 0.17.0 (docs/app-packages-plan.md): one
PNG whose picture is the application's box and whose chunks carry its
manifest and its code. `vintage-frames/build` writes them, and
`vintage-frames/shell/pure` reads them (`readAppFile`) and checks a version
against a range (`satisfies`, `VERSION`). Meteors is the one app file,
built in its own repo, meteors-app. Desktop Patterns leans on nothing here
and could be the next.

**Built in, at build time.** `main.ts` imports `apps/Meteors.png` through
the kit's `appFiles()`, which refuses a file whose `requires` the site's
kit doesn't meet, and bundles the code with the site's. A new version of
Meteors is a commit and a deploy here.

**Installed at runtime** is the packages plan's Phase 3 (§3.6 there), a
sketch: a dropped app file becomes the application's icon, Empty Trash
uninstalls it, backups carry it, the boot loads each installed file and
skips one that fails, and signatures guard what opens. Its kit asks are 8
to 13 there. It waits for the shell to leave experimental status (decision
18 there), since "installed applications that break on every minor make a
broken desktop". Step 6 there, the next kit minor through Meteors, hasn't
happened yet, and none is queued: the kit is at 0.17.0, and its next minor
will be this plan's step 3.

## 2. What the Mac had

- **Software came in a box**, off a shop's shelf or out of a mail-order
  catalog: printed packaging, in color, around disks for a black-and-white
  screen. The packages plan's box is that box.
- **Installing was copying.** An Installer, or a drag off the floppy, put
  the application on the disk. What was installed was what was on the
  disk, and the Trash took it away.
- **Updates came the same way**: a new disk in the mail, or a download from
  a bulletin board or an online service. Mac OS 9's Software Update (1999)
  fetched them on its own, and only Apple's.
- **The App Store came in 2008**, for the iPhone, and reached the Mac in
  2011. Today's Apple menu has an App Store… item.

The store is the one thing on this desktop the Mac never had, on purpose:
_"time-travel magic"_. Everything around it keeps the period's shape. An
application is a file, installing puts its icon on the disk, Empty Trash
takes it away, and the box is printed packaging, in color.

## 3. Design

**Who does what.** Desktop mechanics are the kit's: reading, checking,
loading, registering, updating and uninstalling an app file, checking its
signature against the keys a site gives it, and handing applications the
site's index and what's installed. The App Store is an application of its
own, in a repo of its own, keeping every rule an app file keeps: it reads
the index, chooses builds, lists updates, and installs through the kit.
SystemOnline holds the settings: the index's URL, its trust (the keys it
holds, and what a file none of them signed gets), and which applications a
new desktop comes with, the store among them. The index is a repo of its
own.

### 3.1 The index

**The repo**, `system-online-app-index`:

```
apps/<id>/<version>/<Name>.png   each published app file, as its build wrote it
scripts/listing.ts               the build's pure half: the files in, the listing or what it refuses out
scripts/build.ts                 reads and checks every file; dist/ is the files and index.json
scripts/add.ts                   files a built app file at its path; refuses a version already there
test/                            the build's contract
package.json                     vintage-frames as a dev dependency, for reading app files
_headers                         CORS, and how long each file may be cached
README.md                        publishing, and the order a kit bump takes
.github/workflows/ci.yml         the gates
```

**`index.json`**, built from the files:

```json
{
  "format": 1,
  "apps": [
    {
      "id": "meteors",
      "versions": [
        {
          "version": "0.1.0",
          "name": "Meteors",
          "author": "Adam Portilla",
          "description": "…",
          "requires": "^0.17.0",
          "icon": "data:image/png;base64,iVBORw0KGgo…",
          "file": "apps/meteors/0.1.0/Meteors.png",
          "bytes": 11755,
          "sha256": "…"
        }
      ]
    }
  ]
}
```

- `format` is the listing's own version, so a store can refuse one it
  doesn't know. A new format goes beside the old one, under a new name.
- Each version carries its manifest's fields but `format`, so the store
  chooses a build and lists an application without fetching every file.
- `file` is relative to `index.json`. `bytes` and `sha256` let the store
  check what it fetched before installing it, so a cache that serves the
  wrong file installs nothing.
- Applications are listed by name, and each one's versions newest first.

**Built from the files.** The build reads each file with the kit's reader
and refuses, naming the file: one that isn't an app file, one whose id,
version or file name isn't its path's, and a second file for one id and
version. The manifest is the source of truth, so the listing can't say
anything the files don't.

**Publishing is a file.** `npm run add -- ../meteors-app/dist/Meteors.png`
reads the file's manifest, copies it to `apps/meteors/0.1.0/Meteors.png`,
and refuses a version that's already there, or a file the build would
refuse. A published version never changes, so a fix is a new version.
Commit and push, and Cloudflare builds and serves it. Nothing in
SystemOnline changes.

**The host** is a Cloudflare project of its own, built from the repo as
the site is, at a name such as `apps.portill.io`. Its headers:

- `Access-Control-Allow-Origin: *` on everything, since the store reads it
  from another origin. Anyone may read it: another site on the shell, an
  application's dev desktop.
- `index.json` revalidated on every fetch, so a publish shows at once.
- Each app file cached for a year as immutable, since its path never
  changes.
- No image optimization. Cloudflare's Polish strips image metadata, and an
  app file's chunks are metadata. The deploy's eye check reads a served
  file back as an app file.

Not GitHub releases: their downloads send no CORS header, so a page can't
fetch them. Not npm: the packages plan's decision 4 left it, and the index
has no use for a package.

### 3.2 Choosing a build

Pure, in the store's `src/listing.ts`, and tested under Node in its repo.

- For each application, the newest version whose `requires` this page's
  kit meets, `satisfies` against `VERSION`. An application with none is
  left off the shelf: the store shows only what this desktop runs.
- Against what's installed, an application reads **Install** (not
  installed), **Update** (an older version installed) or **Installed**
  (that version or a newer one).
- **Update** is for an application signed by a key the site holds. One
  installed unsigned, or signed by a key the site doesn't hold, was added
  by hand, and reads Installed whatever the index holds (§3.5).
- Updates go forward only, so a newer build installed by hand, a
  developer's own, stays. One exception: an installed application the boot
  skipped for its `requires`, at a version the index lists, is offered the
  newest build this kit runs even when that's older. Rolling the site back
  to an older kit then strands nothing.
- A listing it can't read, or of a format it doesn't know, is no index. An
  entry it can't read is left out and the rest stand. A `file` off the
  index's origin is refused.

### 3.3 The App Store

An application in an app file, in a repo of its own built as meteors-app
is: `src/app.ts`, `index.ts`, `menus.html`, `windows.html`, `windows.ts`
and the pure `listing.ts`, a dev desktop, its tests and CI. Its id,
`app-store`, never changes; the repo's name is yours, and
`system-online-app-store` would pair with the index. It keeps every rule
an app file keeps and holds no URL and no key of its own, so one store
file works on any desktop on the shell. SystemOnline ships it installed
(§3.6). Apple menu → **App Store…** opens it, as on today's macOS: an
alias of the store in the System Folder's Apple Menu Items, which
SystemOnline's defaults put there (the kit's `system-folder.md`). Until
that ships, the store adds the item itself with `ctx.systemItem`, as
Desktop Patterns does. Its icon opens it too, on a new desktop beside
Meteors', and is yours to draw.

- **What it reads from the kit** (asks 7 and 14): the site's index URL, and
  each installed application's manifest, its signature's standing and
  whether it loaded, with a signal when that changes. It installs with
  `ctx.install` (ask 1).
- **One window**, scrolling, laid out as a page of a mail-order catalog:
  each application a row, its box at the left, and at the right its name,
  version and author, its description, its size and its button. Those with
  an update come first, under a line that counts them, with Update All.
  The look is checked by eye.
- **The box on the grid.** The box is the file's own picture, in color
  (decision 1), and this is the one place the desktop shows it. The store
  draws it into a canvas on the grid, one of the frame's px to one system
  px, as Meteors draws its screen. The frame is drawn at 3×, so at a scale
  that's a multiple of 3 the box is the file's own pixels, and at any other
  each 3 × 3 block of the file averages to one system px. An `<img>` the
  browser scales would land off the grid at 2×, where a file px is two
  thirds of a device px.
- **Reading the index** happens when the window opens, and once after the
  boot (§3.5). Until it answers, the window says it's reading; when it
  can't be reached, the window says so, with Try Again. Installed
  applications are untouched either way.
- **Install** and **Update** check the fetched file against its `bytes`
  and `sha256` and hand it to the shell's install (§3.4). A new
  application's icon lands at the desktop's next free cell, an updated one
  keeps its place, and the row reads Installed. Without storage, install
  answers why, and the store says it can't install on this desktop.
- **Menus**: File: Close ⌃W, Quit ⌃Q. View: Arrange Windows ⌘J.
- Under `?fresh=1` an install is in memory, and a reload forgets it with
  everything else.

### 3.4 Installing

**One door, the kit's.** The store, a dropped or pasted file, a restored
backup and a new desktop's defaults all hand bytes to the shell's install
(§5, ask 1). The store has no install of its own, and the packages plan's
Phase 3 is the same door from the Finder's side.

- **Installing** reads and checks the file (its format, its `requires` and
  its signature), keeps it beside an `app` item, loads the code and
  registers the application: its kinds, menus, dialogs and `init`. The
  icon goes where the file was dropped, at a default's home, or, from the
  store, at the desktop's next free cell.
- **Replacing** an installed application with a file a visitor brings asks
  first, signed or not, as the Finder asked before replacing an item with
  the same name. It's how an application added by hand is updated.
- **Uninstalling** is Empty Trash with the icon in it: the file goes with
  the item, and the store's row reads Install again.
- **Backups carry installed applications**, as `.png` entries named for
  them, so an unzipped backup shows each one as its box. A restore installs
  them through the same door. SPEC §9's rule, that an application's icon is
  the system's and left out, holds for the built-in applications alone.

### 3.5 Updates

Nothing updates without asking (decision 9). Once the boot is done, the
store reads the index in the background, its window open or not, and lists
an update for each installed application your key signed that §3.2 reads
as Update. A click installs one, and Update All every one listed, through
the same door as an install (§3.4).

- **One the boot skipped** for its `requires` loads as its update installs,
  so its icon opens this session. Until then, opening it says why (ask 5),
  and when the store lists its update, offers the App Store.
- **One that loaded** takes the new file at once, and its new code runs
  from the next load.
- **One added by hand**, unsigned or signed by a key the site doesn't hold,
  is offered no update. It's replaced by hand (§3.4).
- **The store itself** is listed like any application, and updating it is
  a click too; its new code runs from the next load.
- Applications the index doesn't list are left alone, and a check that
  can't reach the index says nothing: the next boot tries again.

**A kit bump** then goes in this order:

1. Each application builds on the new kit, a minor for the moved range, and
   is published. The index holds a build for each kit.
2. The defaults in `apps/` are rebuilt, since the site's build refuses the
   bump without them, and `npm run check-index` names any application in
   the index with no build for the new kit.
3. The site deploys. At a visitor's first boot after it, each application
   on the old range is skipped, the store among them. Opening the store
   offers SystemOnline's own copy of it, rebuilt in step 2 (ask 5); a click
   restores it, and it lists the others' new builds as updates. A click, or
   Update All, installs them, and they load.

A visitor offline keeps the icon, which says why it won't open (ask 5),
until the store reaches the index. This answers what the packages plan's
decision 18 waited for: with the index, a minor that breaks an installed
application finds its replacement already published, a click away.

### 3.6 Your applications, installed

Meteors stops being built in, and Meteors and the App Store are installed
applications a new desktop comes with (decisions 6 and 8). The store lists
their updates as it does any other's, so a new version of either is a
publish, never a deploy. Your _"updated live without a redeployment of
system-online"_ then holds for every application you make, the store
included.

- `apps/` keeps the default copies, the index's signed files, so a default
  is offered its updates as any installed application is. The kit's file
  form of `appFiles()` (ask 8) gives the site each file and its manifest,
  checked against the kit at build as `?app` is, without building the code
  in.
- The Finder's defaults carry each application's file. A new desktop
  installs Meteors and the store from them, and Restore Default Files
  reinstalls a trashed one.
- A desktop from before has Meteors' icon and no file. Its first boot after
  the change gives the icon the default's file, once, so the icon, its
  place and the best score carry over. It has no store either, and gets
  one, once, as a new desktop does.
- The system's own applications stay built in: the Finder, the Text Viewer
  and the Font Viewer, which are SystemOnline's library, and Desktop
  Patterns, until it's an app file.
- The dev loop keeps working under `?fresh=1`: meteors-app's `copyTo`
  writes into `apps/`, and a fresh desktop installs each new file. A saved
  desktop keeps the copy it installed, as a visitor's does. Those builds
  are unsigned, so what's committed to `apps/` is the index's copy.

### 3.7 Trust

A loaded application runs with the page's whole reach: the catalog, the
session, every window. The index is a way to put code into every visitor's
page, so who can change it matters.

- **The index's URL is fixed at build**, a build constant beside the others
  in `vite.config.ts`, set from the environment in dev and never read from
  the address. A link that pointed the store elsewhere would present
  anyone's code as yours. SystemOnline hands it to the shell with its
  trust, and the kit hands it to the store (ask 14).
- **The store has no power of its own.** It's trusted as your applications
  are, signed by your key, and what it installs goes through the kit's
  door, where the site's trust decides. A store someone else wrote,
  installed here, could install nothing this desktop's trust wouldn't.
- **Trust is each site's setting** (decision 17). The kit checks every
  signature, and a site tells it which public keys it holds, any number or
  none, and what a file none of them signed gets: installed, refused, or
  asked about with the site's own alert. Without the setting, the shell
  installs any app file. A desktop on another domain can run open, or hold
  its own key and have with its applications what SystemOnline has with
  yours. SystemOnline holds your key and asks.
- **Signatures** (ask 13), from the first install: a third chunk, a
  signature over the manifest and the code, in Ed25519 through WebCrypto,
  which every major browser has had since Chrome 137 in 2025, so it needs
  no dependency. The chunk carries its public key, so a desktop tells a
  file signed by a key it doesn't hold from one changed since it was
  signed. `npm run add` signs with a key that never leaves your machine;
  the index's CI checks every file and never signs. The site holds the
  public keys, a list, so a deploy rotates one. A file is checked at every
  load, not only at install, so one changed in storage loses its
  standing.
  - Signed by a key the site holds: installs without asking, and is
    offered its updates (§3.5).
  - Unsigned, or signed by a key the site doesn't hold: added by hand.
    Here, a drop, a paste or a restore asks first, with an alert naming the
    application and its author, saying it comes from outside the index and
    will be able to read and change everything on this desktop, with Cancel
    and Install. It is offered no updates.
  - Signed, but changed since: refused, whatever a site's setting. The
    file is broken or forged.
- **What signatures buy**: the index's repo or host, taken over, can't put
  code on a desktop; your application passed around by hand still shows as
  yours; a changed file is caught. The site's own deploy holds the keys and
  stays the root of trust.
- **No sandbox.** An iframe per application would mean a copy of the kit
  in each and the window manager reaching across frames, which breaks the
  page's one copy of the kit (packages plan §1).

## 4. Steps

Each step ends with `npm test`, `npm run typecheck` and `npm run build`
green in the repo it touches.

1. **The index** (§3.1): the repo, the build and its tests, `npm run add`,
   CI, the Cloudflare project and its headers, and Meteors 0.1.0 published.
   Nothing changes on the desktop. It builds on 0.17.0, so until step 2 it
   orders versions with a copy of the kit's comparison, and refuses a file
   that isn't an app file without saying why.
2. **The store's helpers** (§5, asks 10 to 12): one kit patch, since each
   only adds, so nothing rebuilds. The index's build then takes
   `compareVersions` and `inspectAppFile` from the kit, and Meteors'
   description goes out with its next version.
3. **The kit installs at runtime and checks signatures** (§5, asks 1 to 9
   and 13): one minor, built against this site through a linked kit, then
   released, with `npm run add` signing on it. It is the packages plan's
   step 6 as well, since no other minor is queued: Meteors goes through this
   one, its build on the new range signed and published to the index, and
   what that costs an application is what §3.5 leans on.
4. **SystemOnline installs at runtime** (§3.4, §3.6, §3.7): a dropped app
   file installs, your key's without asking and anyone else's after the
   alert, and Empty Trash uninstalls it; Meteors becomes an installed
   default, from the index's signed copy; backups carry installed
   applications; the site holds your public key. This is the packages
   plan's Phase 3, done here.
5. **The App Store** (§3.2, §3.3): its repo, built as meteors-app is, with
   `listing.ts` and its tests; signed and published to the index; installed
   by default here, with its icon on a new desktop and App Store… in the
   Apple menu.
6. **Updates** (§3.5): the store's check after the boot, the updates it
   lists, Update and Update All, and `npm run check-index` for a kit bump.

## 5. Kit asks

Each goes to the kit as `feature-requests/<name>.md`, as the app files did.
Asks 1 to 5 and 9 are the packages plan's (4, 5 and 8 to 11 there), made
concrete by the store; 6 to 8 and 14 are new, and 13 is 12 there.

For installing at runtime, in one minor (step 3):

1. **Applications after the start** (8 and 11 there). An `install(bytes,
   where)`, on the shell and on `ctx`, reads an app file, checks its format
   and `requires`, keeps the file beside an `app` item, loads the code and
   registers the application, and resolves what happened: installed,
   updated, or refused and why. The `app` kind's `claim` calls it for a
   dropped or pasted file, so every door is one function.
2. **Installed applications in the boot** (8 there): loaded between reading
   the catalog and reopening the session. One that doesn't load is skipped,
   and the rest boot.
3. **Isolation** (9 there): an `init` that throws, or a reopen that
   rejects, takes down that application alone.
4. **The kit's names for loaded code** (10 there): the code's imports of
   the kit's three entries reach the page's copy, through an import map or
   the loader. The kit picks.
5. **The icon from the manifest** (5 and 11 there): an installed
   application's icon is drawn from its manifest whether its code loaded or
   not, and opening one that didn't load says why, with a way on the site
   can add: here, the App Store, when it lists the application's update,
   and for the store itself, SystemOnline's own copy.
6. **Updating in place**: installing a file whose application already has
   an icon keeps the icon, its place and the session's windows, and
   replaces the file, or gives the icon the file it lacked, only when told
   to, so the site can ask first. A loaded application takes the new code
   at its next load. Uninstalling while running is 13 there.
7. **What's installed**, on the shell and on `ctx`: each installed
   application's manifest, and whether it loaded or why not, with a signal
   when that changes. The store's buttons and its updates read it.
8. **Defaults that carry their files**: a seed or a site's command installs
   an app file, and `appFiles()` gains a form that hands the site a file's
   URL and manifest, checked against the kit as `?app` is, without building
   its code in.
9. **Refuse a duplicate** (4 there): with installs, one id from two sources
   is a real case.

Smaller, for the store, in a patch ahead of the minor (step 2), as
`store-helpers.md`:

10. **`compareVersions` and `inspectAppFile`** exported from `shell/pure`,
    beside `satisfies` and `readAppFile`, and a reader that refuses a
    `version` or `requires` it can't compare.
11. **`description`**: an optional manifest field, from `appFile()`'s
    `app`, kept by the reader where it's present.
12. **The box's scale**: a rule of the format, every frame drawn at 3×, or
    recorded in the file, so a desktop that shows a box can put it on its
    grid.

In the same minor (step 3), so every file installed at runtime is signed
from the first, and the store can be an app file:

13. **Signatures** (12 there): a third chunk, written by the build entry
    from any developer's private key and carrying its public key, and
    checked on every load. A site gives `createShell` its trust: the keys it
    holds, any number or none, and what a file none of them signed gets
    (installed, refused, or a question the site asks with its own alert).
    Without it, any app file installs. A signature that doesn't match its
    file is refused whatever the setting. The result is in what `install`
    answers and in what's installed (ask 7), which the store's updates
    read.
14. **The site's index, handed to applications**: `createShell` takes the
    index's URL beside its trust, and `ctx` hands it on, so a store in an
    app file holds no URL of its own and keeps every rule an app file
    keeps.

## 6. Decisions

1. **Spots of color.** The store shows each box as its file has it, in
   color, on the 1-bit desktop. _Taken 2026-10-10: "I'm ok with spots of
   color - these kinds of anachronisms or part of system-onlines delight."_
2. **An App Store, anachronism and all**, over a period mail-order catalog
   or a volume of software in the Finder. _Taken 2026-10-10: "the
   app-store in system-online will be a kind of time-travel magic"._
3. **JSON, built from the files**, over RSS or a list kept by hand. An Atom
   feed of releases can come from the same listing (§9). _Recommended._
4. **A repo and a host of their own**: `system-online-app-index`, deployed
   by Cloudflare as the site is, at a name such as `apps.portill.io`, so a
   publish never deploys the site. _The repo taken 2026-10-10, as
   `system-online-app-index`; the host's name is yours._
5. **Every version kept and never replaced**, each at
   `apps/<id>/<version>/<Name>.png`. _Recommended._
6. **The store an application of its own**, an app file SystemOnline ships
   installed and signed by your key, keeping every rule an app file keeps,
   over built in here or the kit's stock application. The kit hands it the
   site's index and installs through the site's trust, so it holds no URL
   and no power of its own, and another desktop runs it against its own
   index. A kit bump skips it as it does any application, and
   SystemOnline's own copy brings it back with a click. _Taken 2026-10-10:
   "can the app-store be an app itself? rather than baked into
   system-online or vintage-frames kit?", then "So the system-online
   instance would ship with the app-store pre-installed and trusted... but
   it follows the same standalone app rules as any other... presumably
   we'll need the kit to support appropriate interfaces of course"._
7. **Only what this desktop runs** (§3.2): an application with no build for
   this kit is left off the shelf. _Recommended._
8. **Your applications installed, not built in** (§3.6), over keeping
   Meteors built in with installed copies shadowing it. Applications load
   one way, and every one of yours updates without a deploy.
   _Recommended._
9. **Updates when asked** (§3.5): the store lists the updates for
   applications your key signed, forward only but for the rollback case,
   and a click installs one, or Update All every one listed; the new code
   runs from the next load. An application added by hand is offered none,
   and is replaced by hand. _Taken 2026-10-10, over updates on their own:
   "i don't ever want to update apps without asking - the app store should
   list which apps have updates available... signed apps should install
   with a click ( either individually or via an 'update all' mechanism )
   unsigned apps don't get automatic updates because they were manually
   added by the user. They can be replaced manually though"._
10. **Installing at runtime waits for the index and step 6, not for the
    shell's status**, which takes back the packages plan's decision 18
    (§3.5). _Recommended._
11. **Sideloading stays open**: anyone's app file installs from a drop.
    _Taken 2026-10-10: "People could of course sideload their own apps by
    dropping them onto their desktops and installing them into the virtal
    system."_ A file your key didn't sign asks first (§3.7), over the
    packages plan's decision 19, where it wouldn't open at all.
    _Recommended._
12. **Signatures from the first install** (step 3), over after the store.
    Updates rest on them (decision 9), and a file installed before them
    could never be offered one, since a published file never changes.
    _Recommended._
13. **The index's URL fixed at build**, never read from the address.
    _Recommended._
14. **The name, App Store**, your words for it, with App Store… in the Apple
    menu as on today's macOS, and an icon on a new desktop. It is Apple's
    name for its own store, as Finder is for its own Finder.
    _Recommended._
15. **The box on the grid** (§3.3), averaged at scales off a multiple of 3,
    over an `<img>` the browser scales. _Recommended._
16. **The description in the manifest** (ask 11), over the index alone, so
    it travels with a file passed by hand. _Recommended._
17. **Trust is each site's setting** (§3.7, ask 13), over the kit enforcing
    signatures: the keys a site holds, any number or none, and what a file
    none of them signed gets. Without the setting, any app file installs.
    Another desktop on the shell can run open, or sign its own
    applications and have with them what SystemOnline has with yours: its
    files install without asking and are offered their updates. A desktop
    that holds no key offers no updates, since nothing is vouched for.
    _Taken 2026-10-10: "i want the signed app enforcment to be optional -
    since other developers may want to run the shell to create a
    system-online like virtual desktop on their own domains... ideally they
    should be able to run their own app store and have the same trust
    relationship to their own published apps"._

## 7. Tests

By the policy: contracts, not wiring.

- **Choosing a build**, in the store's repo (`src/listing.ts`,
  `test/listing.test.mjs`), importing nothing of the kit but
  `vintage-frames/shell/pure`:
  - a listing of an unknown format, or that isn't one, reads as no index;
    an entry that doesn't read is left out and the rest stand; a `file` off
    the index's origin is refused;
  - the newest version whose `requires` the kit meets is chosen,
    prereleases by `satisfies`' rule, and an application with none is left
    out;
  - Install, Update and Installed against what's installed; Update only
    for an application signed by a key the site holds, never for one added
    by hand; a newer build installed by hand stays; a skipped application
    at a version the index lists is offered an older build, and one at a
    version it doesn't list isn't; Update All's count is the rows reading
    Update.
- **The index's build**, in system-online-app-index: a folder of files
  reads to the listing; a file that isn't an app file, one whose manifest
  isn't its path's, and a second file for one id and version are each
  refused, naming the file.
- The kit's asks carry their own tests, in the kit.
- The store's window, installing, the updates' wiring and the host's
  headers are checked by eye.

## 8. Eye checks

After step 1:

1. The host serves `index.json` with Meteors 0.1.0, and a file fetched from
   it reads as an app file, byte for byte the committed one, with
   `Access-Control-Allow-Origin: *`.

After steps 3 and 4:

2. With Meteors trashed and the Trash emptied, its signed file dropped on
   the desktop installs without asking: its icon where it was dropped, the
   game playing. Emptying the Trash with it in removes it again, and a
   reload doesn't bring it back. An unsigned build of it asks first, and a
   copy with one byte of its code changed is refused.
3. A new desktop (`?fresh=1`) has Meteors from its default; a desktop from
   before keeps Meteors' icon, its place and the best score.
4. A backup with an installed application restores it, asking as a drop
   does.

After step 5:

5. The store shows Meteors' box in color, crisp at 1×, 2× and 3×, its
   pixels on the grid, with its name, version, author, description, size,
   and Installed.
6. With Meteors trashed and the Trash emptied, Install puts its icon on the
   desktop at a free cell, and it opens.
7. Offline, the store says it can't reach the index, and every installed
   application still opens.
8. The store is an installed application: a new desktop has its icon, App
   Store… in the Apple menu opens it, and with it trashed and the Trash
   emptied, Restore Default Files brings it back.

After step 6:

9. A newer Meteors published to a local index: after the next boot nothing
   has changed on its own, and the store lists one update, Meteors, above
   the rest. Update installs it, and the load after runs it, its icon, its
   window and the best score kept. With two updates listed, Update All
   installs both.
10. An unsigned build of Meteors, dropped on a desktop that has the signed
    one, asks to replace it, and once it has, the store offers it no
    update.
11. The kit-bump drill, through a linked kit: a desktop with Meteors and
    the store on the old range boots on the new kit, both are skipped, and
    nothing installs on its own. Opening the store offers SystemOnline's
    copy, and a click restores it; it lists Meteors' new build, Update
    installs it, and it opens. With the index unreachable, Meteors' icon
    says why and offers nothing.

## 9. Follow-ups

- **Builds for the next kit fetched ahead**, so a kit bump finds them
  already on the disk, as a fat binary carried code for two processors.
- **An Atom feed** of releases, from the same listing, for feed readers.
- **The index's own page**: the boxes and their downloads, for people
  outside the desktop, who are who the box is for.
- **Release notes** per version, in the store.
- **Open** in the store's row once an application is installed.
- **The update count in the Apple menu**: App Store… 2 updates, as today's
  macOS shows it. With the menu the System Folder's, it needs the kit to
  let an application mark the entries that open it.
- **Other people's applications in the index**, by pull request, signed
  with your key on merge.
- **Reopening an application's windows** when it loads after the boot, as
  the boot would have.
- **Rows loaded as they scroll in**, once the index holds more than a
  handful.
- **Desktop Patterns as an app file**, then in the index.

## 10. Files touched

**system-online-app-index**, new (step 1): the repo as §3.1 lists it.

**The store's repo**, new (step 5): built as meteors-app is (§3.3), with
`src/listing.ts` and `test/listing.test.mjs`.

**The kit** (steps 2 and 3): the asks, as
`feature-requests/runtime-installs.md`, `store-helpers.md` and
`signatures.md`; then its shell, its build entry, their tests, SHELL.md and
APP-FILES.md.

**meteors-app**: `src/app.ts` gains its description.

**Here**:

- **New**: the store's signed file in `apps/`.
- **Changed**: `src/main.ts` (Meteors and the store installed defaults; the
  index's URL and the trust in the shell's settings);
  `src/apps/finder/index.ts` and `src/state/defaults.ts` (defaults that
  carry their files, and the store's icon); `src/apps/finder/backup.ts`
  and `src/state/backup.ts` (installed applications in backups);
  `vite.config.ts` and `src/env.d.ts` (the index's URL); `package.json`
  (`check-index`); `docs/SPEC.md`, `README.md`, and `CLAUDE.md` (the
  installed applications, the store among them, and this plan in "Where
  things are");
  `docs/app-packages-plan.md` (Phase 3 and decisions 18 and 19 point
  here).
