# system7web

A Mac OS System 7 desktop in the browser — menu bar, movable windows, dialogs,
Finder icons, a utility palette and a drawn pointer, all on the 1-bit grid at
true 72dpi size.

Everything you see is drawn by [**vintage-frames**](https://www.npmjs.com/package/vintage-frames),
the System 7 component kit, installed from npm like any other dependency. This
repo is the *application*: layout, behavior, content, and the imported strike
collection the Character Set window browses.

```sh
npm install
npm run dev        # http://localhost:5173/system7web/
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | static site to `dist/` |
| `npm run preview` | serve the built copy under the deploy's base path |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run charset-manifest` | regenerate `src/charset-manifest.ts` from the strike collection |

## Layout

```
index.html               the desktop, authored as markup
src/main.ts              behavior only — menus, launchers, window open/close
src/desktop.css          LAYOUT only: window placement, gaps, scroll heights
src/page.css             page-level CSS the components can't reach from a shadow root
public/icons/            the System 7 icon crops
public/fonts/imported/   ~80 genuine Apple bitmap strikes, served verbatim
fonts/                   the converters that built them + the manifest generator
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
Character Set window browses. They moved here from the vintage-frames repo on
2026-08-11 so the component kit distributes no Apple artwork. See
[docs/FONTS.md](docs/FONTS.md).

## Working on a component instead

Component bugs and features belong in
[aportilla/vintage-frames](https://github.com/aportilla/vintage-frames). To see
a change here before it's published, `npm link` the kit's checkout — but note
that the desktop consuming the *published* package is the point of the split:
it exercises the same public API every other consumer gets.
