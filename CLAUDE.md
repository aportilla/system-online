# SystemOnline

A System 7 desktop simulation built on the `vintage-frames` npm package. This
repo is the application; the components live in the sibling
[vintage-frames](https://github.com/aportilla/vintage-frames) repo and arrive
here as a published dependency.

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
constants or what the kit renders: the look and the wiring are checked by
eye. The default for a change is no new test; a new pure function with rules
gets one on its contract. A module under test imports no DOM, nothing of the
kit but `vintage-frames/shell/pure`, and no `?raw`, and its relative imports
carry their `.ts` extension.

## Applications and the shell

The desktop is five applications — the Finder, the Text Viewer, Desktop
Patterns and the Font Viewer, one directory each under `src/apps/`, and
Meteors, built in from its app file in `apps/` — over the kit's shell, `vintage-frames/shell` (experimental; its guide is the kit's
`docs/SHELL.md`). The window manager, the menu bar, the catalog, the stock
Finder and the saved session are the kit's; this repo holds the applications
and the shell's configuration. Keep it that way:

- **Application behavior lives in its application's directory**: its
  definition, menus and kinds (`index.ts`, `menus.html`), its alerts
  (`dialogs.html`, held by the shell under it and asked with `ctx.ask`), what
  goes in its windows (`windows.html`, `windows.ts`), and a zoom box's column
  (`layout.ts`, pure). The Finder is the stock one, configured in
  `src/apps/finder/` with its art, volumes, seed, and the Special commands
  and dialogs it adds through `extend`. `src/apps/windows.ts` holds what the
  applications' windows and dialogs share. The shell composes no UI: every
  alert is an application's, and the About box is the page's.
- **Desktop mechanics belong in the kit.** If an application needs the shell
  to do something it doesn't, that's a change to the kit's shell, not a
  window manager or Finder rebuilt here.
- **The library's kinds are SystemOnline's**: a text file and a font suitcase
  (`src/state/kinds.ts`), small data on catalog items. The pure modules in
  `src/state/` take the catalog's ids and selectors from
  `vintage-frames/shell/pure`, the shell's DOM-free entry, so they run under
  Node.
- **Cross-application calls**, if one is ever needed, go through `ctx.apps`,
  read at the call.
- **App files** in `apps/` are applications built in repos of their own:
  `Meteors.png` is the meteors-app repo's `npm run build`. The kit's
  `appFiles()` (`vite.config.ts`) builds each in from
  `import x from '../apps/<Name>.png?app'`, and fails the build when a
  file's kit range doesn't take this site's kit. A change to one is made in
  its repo and its build copied over, never here; a kit bump here waits for
  each app file built on the new kit (docs/app-packages-plan.md).
- **Desktop Patterns leans on nothing here**, so it can ship as an app file
  as Meteors does. An application in an app file keeps to:
  - imports from the kit's three entries and its own files, and no Lit of
    its own;
  - art it imports, never a page path;
  - layout on its own elements, never in `desktop.css`;
  - session keys that carry its id, read back defensively, and nothing
    broken without a session;
  - nothing from `ctx.services` or `ctx.apps`;
  - kinds named after its id, and an id that never changes.
- Comments are short and direct: label a section or state a non-obvious
  constraint. A larger change starts as a plan in `docs/<topic>-plan.md`
  (docs/app-model-plan.md is the model).

## Invariants — don't break, don't re-litigate

- **Layout CSS only.** `src/desktop.css` positions and sizes; it never sets a
  color, border, shadow, face or size. All aesthetics come from the
  components. `src/page.css` is the page-level half — the black behind the
  desktop, the scroll suppression `fitWithin` needs — and that is the host
  page's job because the kit ships no stylesheet at all.
- **Never reach into the kit's internals.** Import from `vintage-frames`,
  `vintage-frames/shell` and `vintage-frames/shell/pure` only, and in
  `vite.config.ts` `vintage-frames/build`, never a deep path into its
  `dist/`. If something the desktop needs isn't
  exported, that's a change to make in the kit repo, not to route around here.
- **Two kinds of type, kept apart.** `VF Display`/`VF Body` come from the
  package and are the kit's *own re-drawn strikes* — credit Susan Kare and
  Apple as the original designers, never call them Apple's files.
  `public/fonts/imported/` is the opposite: genuine Apple strikes under their
  own names. Never describe one as the other.
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
- `src/apps/<id>/` — the applications; `src/state/` — the library's kinds,
  its defaults and the backup format
- `apps/` — app files of applications built in their own repos:
  `Meteors.png`, from meteors-app
- `docs/SPEC.md` — what's on the desktop, clause by clause
- `docs/app-model-plan.md` — the plan the application model was first built
  from, here; the shell has since moved into the kit
- `docs/app-packages-plan.md` — app files: applications as boxed PNGs, built
  in their own repos and built in here
- `docs/FONTS.md` — the imported strike collection, its two converters, and
  the point-size naming scheme
- `fonts/*.py` — the collection pipeline: `dfont-to-bdf.py` → `import-bdf.py`
  → `charset-manifest.py`
