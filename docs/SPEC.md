# The desktop — what's on it and why

`index.html` + `src/main.ts` + `src/desktop.css`, served by `vite` from the
repo root. It is both showcase and fidelity test — it recreates the System 7
reference screenshots using nothing but the `vintage-frames` package.

This section began life as §7 of the kit's own spec, back when the desktop and
the components shared a repo. It moved here on 2026-08-11 with the desktop
itself; the kit's SPEC now covers only the components, which is the whole point
of the split — this page is a *consumer* of the published API, held to the same
contract as anyone else's app.

1. Full-viewport `vf-desktop` with a `vf-menu-bar` on top: Apple menu (its bar
   title a slotted 16-px `vf-img` apple icon; about item), File (New Window ⌘N, Open… ⌘O, sep, Close ⌘W, Page Setup…,
   disabled Print, sep, Quit ⌘Q), Edit (Undo ⌘Z, sep, Cut/Copy/Paste), View
   (an exclusive check across "by Icon", "by Small Icon" and "by Name"; the two
   icon views really do switch every `vf-icon` between the family's two
   members), Special (Restart, Shut Down, sep, "Show All Windows" — reopens
   closed windows).
2. **"DragThing 2.9 Installer" window** — faithful to the screenshot: white
   content well (bordered) with welcome copy + bullet list, "Disk space
   available: 58,616K / Approximate disk space needed: 4,584K" caption row
   (the body face — System 7's fine print is Geneva 9 at its own size),
   `vf-fieldset legend="Install Location"` containing the folder
   text and a `vf-select` ("Macintosh HD"), and stacked `Quit` +
   `Install` (variant=default) buttons on the right. `movable zoomable`.
3. **"Format" dialog window** — faithful to the screenshot: Mode
   `vf-radio-group` (Hierarchical ⌘H … Don't Reorganize ⌘R, with "Source Format
   Profile" disabled; shortcut text right of labels), disabled "Selection Only"
   checkbox, Options checkboxes (3, all checked), Cancel ⌘. + Format
   (variant=default) buttons bottom-right. Rendered as a movable `vf-window`
   with no close box (closable=false), so its own Cancel/Format buttons are
   how it dismisses.
4. **"Controls" kitchen-sink window** — text field, password field, textarea,
   determinate progress animating 0→100 on a timer, indeterminate progress,
   button variants (normal/default/disabled), a `vf-swatch` palette row (the
   six-color wells plus the no-color checker), separator, multi-select
   `vf-list` (each row's `icon` slot carrying its DA's 16×16 small icon as a
   `vf-img`), `vf-scroll-area` with enough
   text to scroll, disabled control examples.
5. An alert: menu item Special → "Erase Disk…" opens a composed alert box —
   `vf-dialog frame="plain"` with this repo's own 32×32 alert icon
   (`public/icons/alert.png`) in a row `vf-stack` via `vf-img` — "Completely
   erase the disk named 'Macintosh HD'?" with Cancel / Erase buttons (Erase =
   default variant, closes the dialog). The kit ships no alert component; this
   page demonstrates the recipe.
6. All windows `movable`; desktop stacking/active management demonstrably
   works. Every window starts put away and opens from its own desktop
   launcher icon — a `vf-icon` per window and dialog, clustered
   around the top-left so the set stays on-canvas at any viewport size;
   `vf-open` centers the window on the raster as it currently stands and
   raises it (no window carries an authored position). Closing a window hides
   it (listen for `vf-close`, set `hidden`); the close-box-less modal
   lookalikes dismiss via their own OK/Cancel buttons instead; Special →
   Show All Windows un-hides everything, cascaded around the center.
7. **"Page Setup" modal dialog box** — File → Page Setup… opens a
   `vf-dialog frame="plain"` (dBoxProc double frame, heading drawn in
   content): Paper radio group in a fieldset, Reduce or Enlarge
   `vf-number-field`, Cancel / OK (default) buttons.
8. **"Desk Accessories" utility palette** — `vf-window variant="utility"
   movable flush`: a `vf-grid` of 3×3 26px cells holding 16×16 `vf-img` DA
   icons (one selected, inverted), frameless so the window's own border is the
   palette's, floating above the document windows on the desktop's utility
   tier and untouched by their active-state churn — the Group A archetype
   table's fifth recipe, live.
9. The **"DragThing Read Me"** window (item 2's copy points at it) carries the
   document-window archetype at full anatomy: `movable resizable
   scrollbars="both"`, the rails in the frame and the grow box in the corner
   cell.
10. **Finder icons on the desktop** — "Macintosh HD" and "Trash" as `vf-icon`,
    each slotting its art at both resource sizes, `selectable movable
    editable`. They sit under the windows the way desktop icons do, taking
    the column to the right of the launcher cluster — with `left`/`top` in
    system px, never a `right`/`bottom` anchor, which lands somewhere
    different at each density since the desktop is the viewport. View →
    "by Small Icon" drives them (launchers included).
11. **"Character Set" window** — a strike browser over the imported
    collection: a Font and a Size popup resolve to a woff2 under
    `public/fonts/imported/`, registered on demand under its own family name
    and set at its native rect. See [FONTS.md](FONTS.md).

## The one CSS rule

The page may use small amounts of **layout** CSS (positioning windows on the
desktop) but NO aesthetic CSS — looks must come from the components. That
includes the static text: every caption is a `vf-label` and every run of copy a
`vf-paragraph`, so `src/desktop.css` sets no face or size at all.

`src/page.css` is the other half: the page-level CSS a component cannot reach
from its shadow root (the black behind the desktop, the scroll suppression that
keeps `fitWithin` from oscillating). `vintage-frames` ships no stylesheet
whatsoever, so both files are this repo's own work — that is the kit's design,
not an omission.
