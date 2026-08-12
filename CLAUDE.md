# system7web

A System 7 desktop simulation built on the `vintage-frames` npm package. This
repo is the application; the components live in the sibling
[vintage-frames](https://github.com/aportilla/vintage-frames) repo and arrive
here as a published dependency.

## Commands

- `npm run dev` — Vite dev server (note the base path: `/system7web/`)
- `npm run build` / `npm run preview` / `npm run typecheck`
- `npm run charset-manifest` — regenerate `src/charset-manifest.ts` after
  rebuilding the strike collection (needs the `/tmp/fontenv` venv; see
  docs/FONTS.md)

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

- `index.html` — the desktop as markup; `src/main.ts` — its behavior
- `docs/SPEC.md` — what's on the desktop, clause by clause (this was §7 of the
  kit's spec before the split)
- `docs/FONTS.md` — the imported strike collection, its two converters, and
  the point-size naming scheme
- `fonts/*.py` — the collection pipeline: `dfont-to-bdf.py` → `import-bdf.py`
  → `charset-manifest.py`
