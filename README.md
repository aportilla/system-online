# SystemOnline

A Mac OS System 7 desktop in the browser: a menu bar, a Finder with folders,
aliases, a System Folder and a Trash, windows that open out of their icons,
and five applications, all on the 1-bit grid at true 72dpi size.

Use it at <https://system-online.portill.io/>.

Everything you see is drawn by [**vintage-frames**](https://www.npmjs.com/package/vintage-frames),
the System 7 component kit, and the desktop runs on
[**system-online-sdk**](https://www.npmjs.com/package/system-online-sdk)'s
shell: the window manager, the menu bar, the catalog of files with its System
Folder, the stock Finder, and the fonts every application sets type in. Both
are installed from npm like any other dependency. This repo is the *site*:
the applications, the shell's configuration, their content, and the imported
strike collection it serves as the system's fonts. Applications built in
repos of their own arrive as app files in `apps/`: Desktop Patterns, from
[desktop-patterns-app](https://github.com/aportilla/desktop-patterns-app),
the Font Viewer, from
[font-viewer-app](https://github.com/aportilla/font-viewer-app), and
Meteors, from [meteors-app](https://github.com/aportilla/meteors-app).

```sh
npm install
npm run dev        # http://localhost:5173/
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | static site to `dist/` |
| `npm run preview` | serve the built copy |
| `npm test` | unit tests for the pure logic (`node --test`) |
| `npm run typecheck` | `tsc` over the app and the Vite config |
| `npm run charset-manifest` | regenerate `src/charset-manifest.ts` from the strike collection |

## The applications

| | |
| --- | --- |
| **Finder** | the SDK's stock Finder (icons, folder windows, rename, filing by drag, aliases, the System Folder, the Trash, Copy and Paste, Clean Up), plus Back Up All Files… and Restore from Backup…, Restore Default Files |
| **Text Viewer** | read-me files, read-only |
| **Desktop Patterns** | Apple menu → Control Panels → Desktop Patterns: the kit's 38 patterns for the desktop, built in from its app file, `apps/Desktop Patterns.png` |
| **Font Viewer** | a font suitcase's sample line in every strike, and every character of one, built in from its app file, `apps/Font Viewer.png` |
| **Meteors** | its icon on the desktop: an Asteroids-style game on a 320 × 240 1-bit screen, built in from its app file, `apps/Meteors.png` |

Whichever window is in front, its application owns the menu bar. The Apple
menu lists what the System Folder's Apple Menu Items holds, what Startup
Items holds opens at every boot, and a font suitcase in its Fonts installs
that family for every application. The files and their icons' places live
in the browser's IndexedDB, and the windows and the desktop pattern in
localStorage; a reload reopens what was open. `?fresh=1` boots the desktop a
first visit sees, and saves nothing.

## Layout

```
index.html               the skeleton: desktop, menu bar, icon field, About box
src/main.ts              the composition root: the shell, its applications and its fonts
src/about.ts             the About box and the boot greeting
src/fonts.ts             the system's fonts: every family of the strike collection
src/apps/<id>/           one directory per application: menus, dialogs, windows, behavior
apps/                    app files of applications built in their own repos (Desktop Patterns.png, Font Viewer.png, Meteors.png)
src/state/               the library's kinds, its defaults, the backup format
src/texts/               the built-in read-me files
src/desktop.css          LAYOUT only
src/page.css             page-level CSS the components can't reach from a shadow root
public/icons/            icon art served verbatim
public/fonts/imported/   ~80 genuine Apple bitmap strikes, served verbatim
fonts/                   the converters that built them + the manifest generator
test/                    unit tests
docs/SPEC.md             what's on the desktop, clause by clause
docs/FONTS.md            the strike collection and its pipeline
```

## The one rule

The page may set **layout** — where a window sits, how wide a label column is —
and never **aesthetics**. No colors, borders, shadows, faces or sizes: those
come from the components, or they are a bug. `vintage-frames` ships no
stylesheet at all, by design, so `src/page.css` and `src/desktop.css` are this
repo's own work and stay within that line.

## Two kinds of type, kept apart

The components draw with `VF Display` and `VF Body` — the kit's **own re-drawn
strikes**, in the style of the faces Susan Kare designed for Apple's original
Macintosh, credited to her and Apple as designers but not Apple's files.

`public/fonts/imported/` is the opposite: ~80 **genuine Apple bitmap strikes**
under their own names, converted from classic font suitcases, which the
system serves and the Font Viewer shows. They moved here from the
vintage-frames repo on 2026-08-11 so the component kit distributes no Apple
artwork. See [docs/FONTS.md](docs/FONTS.md).

## Working on the shell or a component instead

The shell, the stock Finder and app files belong in
[aportilla/system-online-sdk](https://github.com/aportilla/system-online-sdk),
whose [docs](https://github.com/aportilla/system-online-sdk/tree/main/docs)
are the guides; component bugs and features belong in
[aportilla/vintage-frames](https://github.com/aportilla/vintage-frames). To see
a change here before it's published, `npm link` the package's checkout — but
note that the desktop consuming the *published* packages is the point of the
split: it exercises the same public API every other consumer gets.
