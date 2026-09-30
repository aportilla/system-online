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
gets one on its contract. A module under test imports no DOM, no kit and no
`?raw`, and its relative imports carry their `.ts` extension.

## Applications and the shell

The desktop is four applications — the Finder, the Text Viewer, Desktop
Patterns and the Font Viewer, one directory each under `src/apps/` — over one
shell. The model is sprite-machine's; keep it:

- **Application behavior lives in its application's directory**: its menus
  (`menus.html`, `index.ts`) and its windows — markup (`windows.html`),
  lifecycle and what the close and zoom boxes mean (`windows.ts`), placement
  (`layout.ts`, pure). `src/shell/` holds only what every application shares:
  the window manager, the menu bar, the desktop geometry and state.
- **Primitives in the shell, choices in the application.** Shell code that
  names an application or a kind of window is in the wrong place.
- **The arrows point one way**: `src/apps/` imports `src/shell/`, never the
  reverse. An application reaches the shell through `deps` and the window
  manager's declarations and signals.
- **Cross-application calls** go through `deps.apps`, read at pick time.
- Comments are short and direct: label a section or state a non-obvious
  constraint. A larger change starts as a plan in `docs/<topic>-plan.md`
  (docs/app-model-plan.md is the model).

## Invariants — don't break, don't re-litigate

- **Layout CSS only.** `src/desktop.css` positions and sizes; it never sets a
  color, border, shadow, face or size. All aesthetics come from the
  components. `src/page.css` is the page-level half — the black behind the
  desktop, the scroll suppression `fitWithin` needs — and that is the host
  page's job because the kit ships no stylesheet at all.
- **Never reach into the kit's internals.** Import from `vintage-frames` only,
  never a deep path into its `dist/`. If something the desktop needs isn't
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

- `index.html` — the skeleton (desktop, menu bar, icon field, shared
  dialogs); `src/main.ts` — the composition root
- `src/shell/` — the shell; `src/apps/<id>/` — the applications;
  `src/state/` — the library (IndexedDB), the backup format, the clipboard
- `docs/SPEC.md` — what's on the desktop, clause by clause
- `docs/app-model-plan.md` — the plan the application model was built from
- `docs/FONTS.md` — the imported strike collection, its two converters, and
  the point-size naming scheme
- `fonts/*.py` — the collection pipeline: `dfont-to-bdf.py` → `import-bdf.py`
  → `charset-manifest.py`
