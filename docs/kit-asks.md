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

system-online-sdk 0.3.0 shipped `runtime-installs.md` on 2026-10-18: the
App Store plan's step 3, installing app files at runtime (asks 1 to 9),
signatures (13) and the site's index handed to applications (14).
SystemOnline moved onto it the same day and began the plan's step 4: the
shell holds SystemOnline's public key and asks about any other file, hands
applications the index's URL, and the Finder's new alerts are answered with
SystemOnline's own, every application still built in. The rest of step 4
asks nothing more of the SDK: each application's signed build in the index,
then nothing built in and each file in `apps/` the index's signed copy,
installed as a default; the built-in texts as the system's documentation,
served by path for a Text Viewer build that reads one; backups that carry
installed applications; then the plan's eye checks 2 to 4.

## Waiting

Nothing.
