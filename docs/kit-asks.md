# Kit asks

What SystemOnline has asked of system-online-sdk and vintage-frames and still
waits on. An ask about the shell or app files is a doc in the SDK's
`feature-requests/`, and one about an element a doc in the kit's, written
from here; this list keeps what changes here when each one ships.

**At each system-online-sdk or vintage-frames release**, check it against
this list (`npm view system-online-sdk version`, `npm view vintage-frames
version`, and their logs since the last bump here). Take up here what it
shipped, as each entry says, and strike the entry. The SDK's and the kit's
own sessions build the asks; publishing to npm is yours.

The shell left vintage-frames for system-online-sdk 0.1.0, and SystemOnline
moved onto it on 2026-10-11. That move took up the three asks vintage-frames
shipped from 0.17.1 to 0.19.1: `store-helpers.md`, `system-folder.md` and
`folder-aliases-and-submenus.md`. The first also listed work for two other
repos: meteors-app's description shipped with Meteors 0.2.0, and
system-online-app-index took the store helpers in its own move onto the SDK,
on 2026-10-17.

system-online-sdk 0.2.0 shipped `system-fonts.md`, which font-viewer-app
asked for, and SystemOnline moved onto it the same day, taking up its own
`font-viewer-app-file.md` with the Font Viewer 0.2.0's app file: the system
serves the strike collection, a Fonts folder in the System Folder installs
it, and the built-in Font Viewer left.

## Waiting

### `runtime-installs.md`, not yet written

The App Store plan's step 3, one SDK minor: installing app files at runtime
(asks 1 to 9), signatures (13), and the site's index handed to applications
(14). It's the next doc to write, from the plan's §5, in the SDK's
`feature-requests/`.
