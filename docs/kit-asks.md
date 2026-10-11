# Kit asks

What SystemOnline has asked of vintage-frames and still waits on. Each ask
is a doc in the kit's `feature-requests/`, written from here. That folder
isn't tracked in the kit's repo, so the docs live on this machine alone, and
this list keeps what changes here when each one ships.

**At each vintage-frames release**, check it against this list (`npm view
vintage-frames version`, and the kit's log since the last bump here). Take
up here what it shipped, as each entry says, and strike the entry. The
kit's own sessions build the asks; publishing to npm is yours.

## Waiting

### `store-helpers.md`, for 0.17.1

The App Store plan's step 2 (asks 10 to 12): `compareVersions` and
`inspectAppFile` from `shell/pure`, a reader that refuses a version it
can't compare, an optional `description` in the manifest, and `BOX_SCALE`.

When it ships:

- system-online-app-index: `vintage-frames` to `^0.17.1`.
  `scripts/versions.ts` goes; the build takes `compareVersions` and
  `inspectAppFile` from the kit, says why it refuses a file, and lists each
  version's description.
- meteors-app: `src/app.ts` gains Meteors' description, and Meteors 0.1.1
  goes to the index.
- Here: nothing until the App Store.

### `runtime-installs.md`, not yet written

The App Store plan's step 3, one minor: installing app files at runtime
(asks 1 to 9), signatures (13), and the site's index handed to applications
(14). It's the next doc to write, from the plan's §5.

### `system-folder.md`

Desktop behavior from the catalog, as System 7's came from the disk. A
System Folder on the startup disk holds Apple Menu Items, whose contents
are the Apple menu, flat and by name, and Startup Items, which open at
every boot. Aliases of applications and documents come with it (Make
Alias, ⌘M, names in italics), and `ctx.systemItem` retires. Whether it
rides in the runtime-installs minor or one of its own is open.

When it ships, here:

- The Finder's settings name the System Folder, Apple Menu Items and
  Startup Items, and give their art: the System Folder marked with a small
  Macintosh, and each special folder's. The art is yours to draw.
- The defaults: Desktop Patterns gets an icon of its own, in a Control
  Panels folder in the System Folder, and stops calling `ctx.systemItem`.
  Apple Menu Items holds aliases of Desktop Patterns and the App Store, and
  Startup Items is empty.
- A desktop from before gets the default aliases once, at its first boot
  after the change, so its Apple menu keeps Desktop Patterns.
- SPEC §2's Apple menu clause: About SystemOnline…, a rule, then Apple Menu
  Items by name. It also says a control panel sat in the Apple Menu Items
  folder; it sat in Control Panels.
- The App Store plan: App Store… is an alias in Apple Menu Items, not an
  item the store adds.

### `folder-aliases-and-submenus.md`

After `system-folder.md`: aliases of folders and the startup disk (opening
one opens the original, and a drop on one files into it), and a folder or a
folder alias in Apple Menu Items as a submenu, so the Apple menu can refer
to a folder of applications kept anywhere. Submenus come to `vf-menu` for
every menu.

When it ships, here:

- The defaults can take the period's route to Desktop Patterns: an alias of
  the Control Panels folder in Apple Menu Items, making Apple ▸ Control
  Panels ▸ Desktop Patterns.
