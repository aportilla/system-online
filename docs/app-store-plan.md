# Plan: the App Store

**Status:** drafted 2026-10-10. Nothing has landed. Decisions 1 and 2, and
11's sideloading, were taken 2026-10-10; the rest are recommended (§6). The
ask: _"i was thinking of maybe building an app-store app - that would
display the images and metadata for all of the apps that i'm developing and
publishing... as i create apps and publish them to github/npm i could update
an RSS or JSON source of truth that the app-store app would read and display
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
is redeployed. The App Store is a built-in application. It reads the index,
shows each application this desktop's kit can run as its box, in color, and
installs one through the same door a dropped file takes. In the background
it keeps every installed application on the newest build its kit runs,
which is what makes a kit minor survivable for installed applications. The
store stands on the packages plan's Phase 3, installing app files at
runtime, and this plan takes Phase 3 up: its mechanics as kit asks (§5),
the site's side here.

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
happened yet.

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
loading, registering, updating and uninstalling an app file, and checking
its signature. SystemOnline holds the index's URL, the App Store, the
update rules, and which applications a new desktop comes with. The index
is a repo of its own.

### 3.1 The index

**The repo**, `app-index`:

```
apps/<id>/<version>/<Name>.png   each published app file, as its build wrote it
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
and refuses a version that's already there: a published version never
changes, so a fix is a new version. Commit and push, and Cloudflare builds
and serves it. Nothing in SystemOnline changes.

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

Pure, in `src/apps/app-store/listing.ts`, and tested under Node.

- For each application, the newest version whose `requires` this page's
  kit meets, `satisfies` against `VERSION`. An application with none is
  left off the shelf: the store shows only what this desktop runs.
- Against what's installed, an application reads **Install** (not
  installed), **Update** (an older version installed) or **Installed**
  (that version or a newer one).
- Updates go forward only, so a newer build installed by hand, a
  developer's own, stays. One exception: an installed application the boot
  skipped for its `requires`, at a version the index lists, takes the
  newest build this kit runs even when that's older. Rolling the site back
  to an older kit then strands nothing.
- A listing it can't read, or of a format it doesn't know, is no index. An
  entry it can't read is left out and the rest stand. A `file` off the
  index's origin is refused.

### 3.3 The App Store

A built-in application, in `src/apps/app-store/` and laid out as the
others are: `index.ts`, `menus.html`, `windows.html`, `windows.ts`, and the
pure `listing.ts`. Apple menu → **App Store…** opens it, as on today's
macOS, and so does its icon, on a new desktop beside Meteors'. Its icon is
yours to draw.

- **One window**, scrolling, laid out as a page of a mail-order catalog:
  each application a row, its box at the left, and at the right its name,
  version and author, its description, its size and its button. The look
  is checked by eye.
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
- **Install** checks the fetched file against its `bytes` and `sha256` and
  hands it to the shell's install (§3.4). The icon lands at the desktop's
  next free cell, and the row reads Installed. Without storage, install
  answers why, and the store says it can't install on this desktop.
- **Menus**: File: Close ⌃W, Quit ⌃Q. View: Arrange Windows ⌘J.
- Under `?fresh=1` an install is in memory, and a reload forgets it with
  everything else.

### 3.4 Installing

**One door, the kit's.** The store, a dropped or pasted file, a restored
backup and a new desktop's defaults all hand bytes to the shell's install
(§5, ask 1). The store has no install of its own, and the packages plan's
Phase 3 is the same door from the Finder's side.

- **Installing** reads and checks the file (its format, its `requires`,
  later its signature), keeps it beside an `app` item, loads the code and
  registers the application: its kinds, menus, dialogs and `init`. The
  icon goes where the file was dropped, at a default's home, or, from the
  store, at the desktop's next free cell.
- **Uninstalling** is Empty Trash with the icon in it: the file goes with
  the item, and the store's row reads Install again.
- **Backups carry installed applications**, as `.png` entries named for
  them, so an unzipped backup shows each one as its box. A restore installs
  them through the same door. SPEC §9's rule, that an application's icon is
  the system's and left out, holds for the built-in applications alone.

### 3.5 Updates

Once the boot is done, the store reads the index in the background, its
window open or not, and takes each installed application to the build §3.2
chooses:

- **One the boot skipped** for its `requires` is installed at once and
  loads, so its icon opens this session.
- **One that loaded** gets the new file now, and its new code runs from the
  next load.
- Applications the index doesn't list are left alone, and a check that
  can't reach the index says nothing: the next boot tries again.

**A kit bump** then goes in this order:

1. Each application builds on the new kit, a minor for the moved range, and
   is published. The index holds a build for each kit.
2. The defaults in `apps/` are rebuilt, since the site's build refuses the
   bump without them, and `npm run check-index` names any application in
   the index with no build for the new kit.
3. The site deploys. At a visitor's first boot after it, each application
   on the old range is skipped, the store installs its new build, and it
   loads.

A visitor offline at that boot keeps the icon, which says why it won't
open (ask 5), until a boot that reaches the index. This answers what the
packages plan's decision 18 waited for: with the index, a minor that breaks
an installed application finds its replacement already published.

### 3.6 Your applications, installed

Meteors stops being built in and becomes an installed application that a
new desktop comes with (decision 8). The store keeps it current as it does
any other, and a new version of Meteors is a publish, never a deploy. Your
_"updated live without a redeployment of system-online"_ then holds for
every application you make, the one on the desktop included.

- `apps/` keeps the default copies. The kit's file form of `appFiles()`
  (ask 8) gives the site each file and its manifest, checked against the
  kit at build as `?app` is, without building the code in.
- The Finder's defaults carry each application's file. A new desktop
  installs Meteors from it, and Restore Default Files reinstalls a trashed
  one.
- A desktop from before has Meteors' icon and no file. Its first boot after
  the change gives the icon the default's file, once, so the icon, its
  place and the best score carry over.
- The system's own applications stay built in: the Finder, the Text Viewer
  and the Font Viewer, which are SystemOnline's library; Desktop Patterns,
  until it's an app file; and the store.
- The dev loop keeps working under `?fresh=1`: meteors-app's `copyTo`
  writes into `apps/`, and a fresh desktop installs each new file. A saved
  desktop keeps the copy it installed, as a visitor's does.

### 3.7 Trust

A loaded application runs with the page's whole reach: the catalog, the
session, every window. The index is a way to put code into every visitor's
page, so who can change it matters.

- **The index's URL is fixed at build**, a build constant beside the others
  in `vite.config.ts`, set from the environment in dev and never read from
  the address. A link that pointed the store elsewhere would present
  anyone's code as yours.
- **Until signatures**, the store trusts its index by that URL, and a file
  a visitor brings, by a drop, a paste or a restore, asks first: an alert
  naming the application and its author, saying it comes from outside the
  index and will be able to read and change everything on this desktop,
  with Cancel and Install.
- **Signatures** (ask 13): a third chunk, a signature over the manifest and
  the code, in Ed25519 through WebCrypto, which every major browser has had
  since Chrome 137 in 2025, so it needs no dependency. `npm run add` signs
  with a key that never leaves your machine; the index's CI checks every
  file and never signs. The site holds the public keys, a list, so a deploy
  rotates one. A file is checked at every load, not only at install, so one
  changed in storage loses its standing.
  - Signed by a key the site holds: installs without asking.
  - Unsigned, or signed by a key the site doesn't hold: asks, as above.
  - Signed, but changed since: refused.
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
   Nothing changes on the desktop.
2. **A kit minor through Meteors**: the packages plan's step 6, with
   whichever minor ships first. It measures what a minor costs an
   application, which §3.5 leans on.
3. **The kit installs at runtime** (§5, asks 1 to 12): one minor, built
   against this site through a linked kit, then released.
4. **SystemOnline installs at runtime** (§3.4, §3.6): a dropped app file
   installs, with the alert, and Empty Trash uninstalls it; Meteors becomes
   an installed default; backups carry installed applications. This is the
   packages plan's Phase 3, done here.
5. **The App Store** (§3.2, §3.3): the application and `listing.ts`, with
   its tests; App Store… in the Apple menu and the icon on a new desktop.
6. **Updates** (§3.5): the store's check after the boot, and `npm run
   check-index` for a kit bump.
7. **Signatures** (§3.7): ask 13, `npm run add` signing, the site's keys,
   and the alert for anyone else's file.

## 5. Kit asks

Each goes to the kit as `feature-requests/<name>.md`, as the app files did.
Asks 1 to 5 and 9 are the packages plan's (4, 5 and 8 to 11 there), made
concrete by the store; 6 to 8 are new, and 13 is 12 there.

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
   not, and opening one that didn't load says why.
6. **Updating in place**: installing a file whose application already has
   an icon keeps the icon, its place and the session's windows, and
   replaces the file, or gives the icon the file it lacked. A loaded
   application takes the new code at its next load. Uninstalling while
   running is 13 there.
7. **What's installed**: each installed application's manifest, and
   whether it loaded or why not, with a signal when that changes. The
   store's buttons and its updates read it.
8. **Defaults that carry their files**: a seed or a site's command installs
   an app file, and `appFiles()` gains a form that hands the site a file's
   URL and manifest, checked against the kit as `?app` is, without building
   its code in.
9. **Refuse a duplicate** (4 there): with installs, one id from two sources
   is a real case.

Smaller, in the same minor, for the store:

10. **`compareVersions` and `inspectAppFile`** exported from `shell/pure`,
    beside `satisfies` and `readAppFile`.
11. **`description`**: an optional manifest field, from `appFile()`'s
    `app`, kept by the reader where it's present.
12. **The box's scale**: a rule of the format, every frame drawn at 3×, or
    recorded in the file, so a desktop that shows a box can put it on its
    grid.

Later (step 7):

13. **Signatures** (12 there): a third chunk, written by the build entry
    from a private key and checked on every load against the site's public
    keys, with the result in what `install` answers.

## 6. Decisions

1. **Spots of color.** The store shows each box as its file has it, in
   color, on the 1-bit desktop. _Taken 2026-10-10: "I'm ok with spots of
   color - these kinds of anachronisms or part of system-onlines delight."_
2. **An App Store, anachronism and all**, over a period mail-order catalog
   or a volume of software in the Finder. _Taken 2026-10-10: "the
   app-store in system-online will be a kind of time-travel magic"._
3. **JSON, built from the files**, over RSS or a list kept by hand. An Atom
   feed of releases can come from the same listing (§9). _Recommended._
4. **A repo and a host of their own**: `app-index`, deployed by Cloudflare
   as the site is, at a name such as `apps.portill.io`, so a publish never
   deploys the site. _Recommended; the names are yours._
5. **Every version kept and never replaced**, each at
   `apps/<id>/<version>/<Name>.png`. _Recommended._
6. **The store built in**, in `src/apps/app-store/`, over an app file. It
   holds this site's index URL and installs applications, and a store that
   updates itself is the one update that can strand the updater.
   _Recommended._
7. **Only what this desktop runs** (§3.2): an application with no build for
   this kit is left off the shelf. _Recommended._
8. **Your applications installed, not built in** (§3.6), over keeping
   Meteors built in with installed copies shadowing it. Applications load
   one way, and every one of yours updates without a deploy.
   _Recommended._
9. **Updates on their own** (§3.5): in the background, forward only but for
   the rollback case, the new code at the next load. _Recommended._
10. **Installing at runtime waits for the index and step 6, not for the
    shell's status**, which takes back the packages plan's decision 18
    (§3.5). _Recommended._
11. **Sideloading stays open**: anyone's app file installs from a drop.
    _Taken 2026-10-10: "People could of course sideload their own apps by
    dropping them onto their desktops and installing them into the virtal
    system."_ A file your key didn't sign asks first (§3.7), over the
    packages plan's decision 19, where it wouldn't open at all.
    _Recommended._
12. **Signatures after the store**: until then the store trusts its index
    by its fixed URL, and every file a visitor brings asks. _Recommended._
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

## 7. Tests

By the policy: contracts, not wiring.

- **Choosing a build** (`src/apps/app-store/listing.ts`,
  `test/listing.test.mjs`), importing nothing of the kit but
  `vintage-frames/shell/pure`:
  - a listing of an unknown format, or that isn't one, reads as no index;
    an entry that doesn't read is left out and the rest stand; a `file` off
    the index's origin is refused;
  - the newest version whose `requires` the kit meets is chosen,
    prereleases by `satisfies`' rule, and an application with none is left
    out;
  - Install, Update and Installed against what's installed; a newer build
    installed by hand stays; a skipped application at a version the index
    lists takes an older build, and one at a version it doesn't list
    stays.
- **The index's build**, in app-index: a folder of files reads to the
  listing; a file that isn't an app file, one whose manifest isn't its
  path's, and a second file for one id and version are each refused,
  naming the file.
- The kit's asks carry their own tests, in the kit.
- The store's window, installing, the updates' wiring and the host's
  headers are checked by eye.

## 8. Eye checks

After step 1:

1. The host serves `index.json` with Meteors 0.1.0, and a file fetched from
   it reads as an app file, byte for byte the committed one, with
   `Access-Control-Allow-Origin: *`.

After steps 3 and 4:

2. With Meteors trashed and the Trash emptied, its file dropped on the
   desktop asks, then installs: its icon where it was dropped, the game
   playing. Emptying the Trash with it in removes it again, and a reload
   doesn't bring it back.
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

After step 6:

8. Meteors 0.1.1 published to a local index: after the next boot the store
   reads Installed for 0.1.1, and the load after runs it, its icon, its
   window and the best score kept.
9. The kit-bump drill, through a linked kit: a desktop with Meteors on the
   old range boots on the new kit, Meteors is skipped, the store installs
   its new build, and it opens. With the index unreachable, its icon says
   why it won't.

After step 7:

10. A file `npm run add` signed installs without asking; an unsigned copy
    asks; a copy with one byte of its code changed is refused.

## 9. Follow-ups

- **Builds for the next kit fetched ahead**, so a kit bump finds them
  already on the disk, as a fat binary carried code for two processors.
- **An Atom feed** of releases, from the same listing, for feed readers.
- **The index's own page**: the boxes and their downloads, for people
  outside the desktop, who are who the box is for.
- **Release notes** per version, in the store.
- **Open** in the store's row once an application is installed.
- **A Software Update setting** for whether updates install on their own,
  as Mac OS 9's control panel had.
- **Other people's applications in the index**, by pull request, signed
  with your key on merge.
- **Reopening an application's windows** when it loads after the boot, as
  the boot would have.
- **Rows loaded as they scroll in**, once the index holds more than a
  handful.
- **Desktop Patterns as an app file**, then in the index.

## 10. Files touched

**app-index**, new (step 1): the repo as §3.1 lists it.

**The kit** (steps 3 and 7): the asks, as
`feature-requests/runtime-installs.md`, `store-helpers.md` and
`signatures.md`; then its shell, its build entry, their tests, SHELL.md and
APP-FILES.md.

**meteors-app**: `src/app.ts` gains its description.

**Here**:

- **New**: `src/apps/app-store/` (`index.ts`, `menus.html`, `windows.html`,
  `windows.ts`, `listing.ts`, `art/`), `test/listing.test.mjs`.
- **Changed**: `src/main.ts` (the store; Meteors an installed default);
  `src/apps/finder/index.ts` and `src/state/defaults.ts` (defaults that
  carry their files, and the store's icon); `src/apps/finder/backup.ts`
  and `src/state/backup.ts` (installed applications in backups);
  `vite.config.ts` and `src/env.d.ts` (the index's URL); `package.json`
  (`check-index`); `docs/SPEC.md`, `README.md`, and `CLAUDE.md` (six
  applications, the store's directory, this plan in "Where things are");
  `docs/app-packages-plan.md` (Phase 3 and decisions 18 and 19 point
  here).
