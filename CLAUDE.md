# SystemOnline

A System 7 desktop simulation built on two npm packages: `system-online-sdk`,
the shell that runs applications over one desktop, and `vintage-frames`, the
elements it draws with. This repo is the site: the shell's configuration,
the default applications' app files and the system's documents. The
packages live in the sibling
[system-online-sdk](https://github.com/aportilla/system-online-sdk) and
[vintage-frames](https://github.com/aportilla/vintage-frames) repos and arrive
here as published dependencies, moved together: `vintage-frames` at the range
the SDK's peer dependency names.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` / `npm run preview`
- The gates: `npm test`, `npm run typecheck`, `npm run build`. CI runs all
  three on every push and pull request. Every push to `main` deploys to
  system-online.portill.io (Cloudflare builds it from the repo, reading the
  Node version from `.nvmrc`); the deploy does not wait on CI.
- `npm run charset-manifest` — regenerate `src/charset-manifest.ts` after
  rebuilding the strike collection (needs the `/tmp/fontenv` venv; see
  docs/FONTS.md)

## Tests

Unit tests only, and only for pure logic (`test/*.test.mjs`, run by
`node --test`, importing the TypeScript source through Node's type
stripping). No browser tests, and nothing that asserts markup, copy,
constants or what the kit or the SDK renders: the look and the wiring are
checked by eye. The default for a change is no new test; a new pure function
with rules gets one on its contract. A module under test imports no DOM,
nothing of either package but `system-online-sdk/pure`, and no `?raw`, and
its relative imports carry their `.ts` extension.

## Applications and the shell

The desktop is six applications — the Finder, configured in
`src/apps/finder/` and the one built in, and the App Store, the Text Viewer,
Desktop Patterns, the Font Viewer and Meteors, installed at runtime from
their app files in `apps/` — over `system-online-sdk`'s shell
(experimental). Its guides are the SDK's docs:
`GUIDE.md` for a site, `SHELL.md` for the shell, `APP-FILES.md` for app files
(`../system-online-sdk/docs/` in a checkout beside this one). The window
manager, the menu bar, the catalog and its System Folder, the stock Finder,
the system's fonts, the saved session and installing applications are the
SDK's; this repo holds the shell's configuration, the families it serves
its system among it, and the default applications' files. Keep it that
way:

- **Application behavior lives in its application's directory**: its
  definition, menus and kinds (`index.ts`, `menus.html`), its alerts
  (`dialogs.html`, held by the shell under it and asked with `ctx.ask`), what
  goes in its windows (`windows.html`, `windows.ts`), and a zoom box's column
  (`layout.ts`, pure). The Finder is the stock one, configured in
  `src/apps/finder/` with its art, volumes, System Folder, seed, and the
  Special commands and dialogs it adds through `extend`.
  `src/apps/windows.ts` holds what the applications' windows and dialogs
  share. The shell composes no UI: every alert is an application's, and the
  About box is the page's.
- **The Apple menu is the System Folder's**, and so are the installed fonts.
  Below About, the shell lists what Apple Menu Items holds. An application
  gets into it through the defaults (`src/state/defaults.ts`), as an alias
  filed there, never by adding an item itself. A family is installed the
  same way, by a suitcase filed directly in Fonts.
- **Desktop mechanics belong in the SDK.** If an application needs the shell
  to do something it doesn't, that's a change to the SDK, asked for in its
  `feature-requests/`, not a window manager or Finder rebuilt here. An ask
  about an element goes to vintage-frames.
- **The library's kind is the text file** (`src/state/kinds.ts`), small
  data on a catalog item: its own words, or the path of a system document,
  Read Me say, whose words are SystemOnline's, served from `public/texts/`
  and listed in `src/texts/`, so each deploy updates them on every desktop.
  The Text Viewer registers the `text` kind from its app file and fetches a
  system document's words at each open; it's handed nothing. A font
  suitcase is
  the system's, the shell's `font` kind: its family is one this repo serves
  its system (`src/fonts.ts`, from the strike collection), and the Font
  Viewer opens it without owning it. The pure modules in `src/state/` take
  the catalog's ids, kinds and selectors from `system-online-sdk/pure`, the
  SDK's DOM-free entry, so they run under Node.
- **Cross-application calls**, if one is ever needed, go through `ctx.apps`,
  read at the call.
- **App files** in `apps/` are the default applications, each built in a
  repo of its own and each the index's signed copy: `App Store.png` from
  system-online-app-store-app, `Desktop Patterns.png` from
  desktop-patterns-app, `Font Viewer.png` from font-viewer-app,
  `Meteors.png` from meteors-app, and `Text Viewer.png` from
  text-viewer-app. Nothing is built in from them: the SDK's `appFiles()`
  (`vite.config.ts`) serves each byte for byte with its manifest
  (`import x, { manifest } from '../apps/<Name>.png?app-file'`), and fails
  the build on a file built at an app API level this site's SDK doesn't run
  or whose signature doesn't hold. The Finder's defaults install each at its
  home (`src/apps/finder/index.ts`), and a new desktop's seed, Restore
  Default Files and a backup's Replace all install through the shell's
  door. A new version is made in its repo, signed and published to the
  index with its `npm run add`, and the index's copy copied over, never
  built here; an SDK release that raises `APP_API_OLDEST` waits for each
  app file built on it (the SDK's `GUIDE.md` § Moving to a new release). The
  rules an application in an app file keeps are the SDK's (`APP-FILES.md`
  § The rules an application keeps).
- **Installing at runtime**: an app file dropped or pasted in the Finder
  installs through the SDK's door, against the trust in `src/main.ts`:
  SystemOnline's public key, which the index's `scripts/signing.ts` holds
  too. A file it signed installs without asking, any other after the
  Finder's alert, which SystemOnline answers (`src/apps/finder/installs.ts`).
  The private key is a file on the machine that signs, never in a repo, and
  a session never prints it or puts its text in a command.
- Comments are short and direct: label a section or state a non-obvious
  constraint. A larger change starts as a plan in `docs/<topic>-plan.md`
  (docs/app-model-plan.md is the model).

## Invariants — don't break, don't re-litigate

- **Layout CSS only.** `src/desktop.css` positions and sizes; it never sets a
  color, border, shadow, face or size. All aesthetics come from the
  components. `src/page.css` is the page-level half — the black behind the
  desktop, the scroll suppression `fitWithin` needs — and that is the host
  page's job because the kit ships no stylesheet at all.
- **Never reach into the packages' internals.** Import from
  `vintage-frames`, `system-online-sdk` and `system-online-sdk/pure` only,
  and in `vite.config.ts` `system-online-sdk/build`, never a deep path into
  either's `dist/`. If something the desktop needs isn't exported, that's a
  change to make in the SDK's repo, or vintage-frames' for an element, not to
  route around here.
- **Two kinds of type, kept apart.** `VF Display`/`VF Body` come from the
  package and are the kit's *own re-drawn strikes* — credit Susan Kare and
  Apple as the original designers, never call them Apple's files.
  `public/fonts/imported/` is the opposite: genuine Apple strikes under their
  own names, which this repo serves as the system's fonts. Never describe
  one as the other.
- Everything is authored in **system pixels** on the 1-bit grid; a component
  renders one system px as a whole number of device px. Layout here is
  authored in system px too and multiplied by `--vf-scale` in `calc()`.
- `dist/` is a build output — regenerate, don't hand-edit. So is
  `src/charset-manifest.ts` (`npm run charset-manifest`).

## Commits

Concise messages: a summary line plus at most a few sentences. No co-author
or generated-by trailers.

## Where things are

- `index.html` — the skeleton (desktop, menu bar, icon field, About box);
  `src/main.ts` — the composition root, which starts the shell;
  `src/about.ts` — the About box
- `src/apps/finder/` — the Finder; `src/state/` — the library's kind,
  its defaults, the System Folder's among them, the one-time moves of a
  desktop from before, and the backup format; `src/fonts.ts` — the system's
  fonts, every family of the strike collection
- `src/texts/` — the system's documents, each one's key, name and home;
  `public/texts/` — their words, served at `/texts/<key>.txt` and
  revalidated at every fetch (`public/_headers`)
- `apps/` — the default applications' app files, the index's signed copies:
  `App Store.png`, from system-online-app-store-app, `Desktop Patterns.png`,
  from desktop-patterns-app, `Font Viewer.png`, from font-viewer-app,
  `Meteors.png`, from meteors-app, and `Text Viewer.png`, from
  text-viewer-app
- `docs/SPEC.md` — what's on the desktop, clause by clause
- `docs/app-model-plan.md` — the plan the application model was first built
  from, here; the shell has since moved into the kit, and from there to
  system-online-sdk
- `docs/app-packages-plan.md` — app files: applications as boxed PNGs, built
  in their own repos and, until the App Store plan's step 4, built in here
- `docs/app-store-plan.md` — the App Store: an index of app files, and a
  store that reads it; under way, and its status says where
- `docs/kit-asks.md` — what this site has asked of the SDK and the kit and
  waits on, and what changes here when each ships; check it at each
  system-online-sdk or vintage-frames bump
- `docs/FONTS.md` — the imported strike collection, its two converters, and
  the point-size naming scheme
- `fonts/*.py` — the collection pipeline: `dfont-to-bdf.py` → `import-bdf.py`
  → `charset-manifest.py`
