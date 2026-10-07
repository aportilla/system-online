# Plan: the Meteors game

**Status:** drafted 2026-10-06. Decisions 2, 5 and 6 were taken 2026-10-06 as
recommended: the meteors alone, with no sound, hyperspace or saucers; outlines
made per meteor; the best score kept. The rest stand as recommended.

Steps 1 to 6 (§5) landed 2026-10-06, uncommitted. Steps 1 to 3 made an early
check-in, the ship flying among the first wave. Step 4 added shooting and
hits, step 5 the ship being hit, its ships and game over, and step 6 the best
score. The gates are green. The build differs from the design as drafted in
six ways:

- `SCREEN` moved from `game.ts` to `field.ts`, since `game.ts` now imports
  the field.
- Outlines have 11, 9 or 7 corners by size, not 10.
- Each size's numbers sit in one `METEOR` table.
- `plot` rounds to whole px itself.
- A shot hits along its whole move that step, not just where it lands. At up
  to 7 px a step it could otherwise step over a small meteor.
- A saved best is read back through `bestOf`, so a garbled one reads as none.

Driven in headless Chromium, every canvas px is black or white. The pause
rule holds for P, a desktop press, a click on the screen, and the alert's
Cancel. Space held fires once, and spraying shots splits meteors and runs the
score up. Played to the end, each lost ship counts down the reserve under the
score and comes back at the center. The last one brings GAME OVER, then the
title screen with the game's score as its best, which a reload keeps.

Three things turned up that aren't the game's, all dating from ad6b388. Two
are fixed, 2026-10-06:

- Meteors' window didn't reopen on a reload, because the session keeps
  windows by item and it had none. Its item is now Meteors' own key, so it
  reopens on the title screen, and closing still falls back to its icon.
- `?fresh=1` kept no catalog, so it had no Meteors icon (nor Read Me). It now
  keeps the catalog in memory: the desktop a first visit sees, which a reload
  forgets.

The third wasn't real. A white seam inside the window's left edge at 2× and
3× showed only in headless Chromium's captures; real browsers don't show it
(2026-10-07).

The ask:
_"i'd like to actually implement a simple version of the game… a basic
asteroids like clone… should we go with raw canvas, or take on a dep like
three js?"_

The short version: Meteors' placeholder becomes a small Asteroids. It gets a
ship that turns, thrusts and fires, and meteors in three sizes that split when
shot. Around them come waves, a score, three ships and game over, a pause that
follows the keyboard focus, and a best score kept with the session. It stays on
today's 320 × 240 1-bit screen, drawn with **raw canvas and no new
dependency**. A rasterizer of our own, a few dozen lines of pure code, draws
the field into a bit buffer, and the buffer goes onto the canvas once a frame.
three.js would double the JavaScript the site ships just to draw a few dozen
1px outlines, and its lines are no closer to the 1-bit look than the 2D
context's (§3). The rules stay pure and run under Node.

## 1. Where things stand

Meteors landed in ad6b388 as the frame of a game:

| File | What it does |
| --- | --- |
| `index.ts` | the application: its icon opens one fixed window, centered, out of the icon; Q or Escape in a game asks _End this game…?_ (`dialogs.html`) |
| `windows.html` | the window, 322 × 260, its body a `vf-container` holding a 320 × 240 canvas, magnified `pixelated` (`desktop.css`) |
| `screen.ts` | the canvas as a 1-bit surface: `fill`, and text in the kit's faces cut into 1-bit glyph sprites |
| `game.ts` | pure: `Game` (the title screen, or a game `ticks` steps in), `step`, `commandFor` (what a key asks), and the fixed 60-a-second clock (`stepsDue`, at most 250 ms made up a frame) |
| `windows.ts` | the wiring: the title screen drawn on change, the clock from one animation frame to the next, the alert, keys from the focused screen, the pointer on the title menu |
| `test/meteors.test.mjs` | the title keys, the end key, the clock |

All of it stays. What goes is the placeholder: `{ screen: 'playing', ticks }`
and `drawGame`, the time a game has run.

## 2. The game we copy

Asteroids (Atari, 1979) puts a ship in the middle of a field that wraps at
every edge. The ship turns, thrusts and fires, and has hyperspace. Asteroids
come in three sizes. A large one splits into two medium ones, a medium into
two small, and a small one is gone, for 20, 50 and 100 points. An extra ship
comes every 10,000 points, each wave is bigger than the last, and saucers
shoot back. The arcade drew white vector lines on a black screen, the same
palette as ours, which is why the game suits a 1-bit screen.

The first cut takes the ship, the shots, the three sizes, the waves, the
score, the ships and game over. Hyperspace, the saucers and sound wait (§10).

## 3. Rendering: raw canvas, not three.js

The screen is 1-bit, whole px (SPEC §16). The question is what draws a few
dozen outlines on it sixty times a second. Neither ready-made line drawing
gets there:

- **The 2D context's `stroke()`** antialiases, and nothing turns that off
  (`imageSmoothingEnabled` covers images only). Thresholding its output, as
  `screen.ts` does for glyphs, leaves uneven lines: a pixel doubled here,
  dropped there.
- **WebGL, under three.js**, draws lines one pixel wide, aliased if asked.
  Wider lines are unsupported almost everywhere. Which pixels a line lights
  is the GPU's rasterization rule, not one we choose or can test. The HUD's
  text is the kit's faces through `screen.ts`, a 2D context, so it would need
  a second canvas over the GL one.

What does get there is drawing the pixels ourselves, as QuickDraw did into a
1-bit bitmap. That means a 320 × 240 bit buffer, Bresenham lines into it, and
one `putImageData` a frame. It's a few dozen lines of pure code, so its
contract is tested under Node like the rest of the rules.

| | Raw canvas, our raster | three.js |
| --- | --- | --- |
| The 1-bit look | by construction | aliased GPU lines; the text on a second canvas |
| JavaScript shipped | a few KB of our own | +515 KB minified, +127 KB gzipped |
| Under `npm test` | the raster's contract | nothing below the rules |
| A window's lifecycle | nothing to free | a WebGL context to dispose of at each close, since browsers cap live contexts |

The three.js figure is measured. It's r185 (sprite-machine's copy),
tree-shaken to a `WebGLRenderer`, an `OrthographicCamera` and `LineSegments`,
then minified. Of three we'd use a camera, a scene and line segments; its 3D
math, lighting, materials and loaders would ride along unused. The whole site
today is 508 KB minified, 159 KB gzipped, so three alone would about double
it. A dynamic import could hold it back until Meteors opens, but not make it
smaller. And SPEC's first paragraph says the desktop is built on nothing but
the published `vintage-frames` package. Raw canvas keeps that true.

three is the right call for a real 3D scene, which is why sprite-machine uses
it. Its 3D View has an orbit camera and shadow maps, and renders a mesh round
a ring of yaws into a sprite sheet. If Meteors ever wants a perspective field,
that's the time. Nothing here rules it out, because the rules don't know how
they're drawn.

## 4. Design

### 4.1 The modules

| File | | Holds |
| --- | --- | --- |
| `game.ts` | changed, pure | the screens, what each key asks, the step, the clock |
| `field.ts` | new, pure | the field: the ship, shots, meteors, debris, the score and ships, the waves, the seeded generator |
| `raster.ts` | new, pure | the bit buffer, and lines and outlines into it, wrapping at the edges |
| `screen.ts` | changed | `present(bits)`, the buffer onto the canvas; text as today |
| `draw.ts` | new | what each screen looks like: the title (moved out of `windows.ts`), the field, the HUD, PAUSED and GAME OVER |
| `windows.ts` | changed | the wiring: the keys held, the clock, the pause rule |
| `index.ts` | changed | the best score, through `ctx.state` |

`raster.ts` stands apart from `screen.ts` because `screen.ts` imports the kit
and touches the DOM, and the raster's tests run under Node.

### 4.2 The screens and the keys (`game.ts`)

| Screen | Holds | A step | Leaves for |
| --- | --- | --- | --- |
| title | the highlighted item | stands still | a game, on New Game |
| playing | the field; paused or not | runs the field, unless paused | game over, when the last ship is lost; the title, on End Game |
| game over | the field; the steps left | runs the field, with no ship | the title, after 3 s |

| Key | Title | Playing | Paused |
| --- | --- | --- | --- |
| ← → | | turn | |
| ↑ | highlight up | thrust | |
| ↓ | highlight down | | |
| Space | choose | fire | |
| Return | choose | | |
| P | | pause | resume |
| Q, Escape | | ask to end | ask to end |

A click on the paused screen resumes too. Game over takes no keys, so a held
Space can't skip it. A key held with ⌃, ⌘ or ⌥ stays the menu bar's, as
today.

Two kinds of key reach the game:

- **Commands** go through `commandFor`, as today, plus P.
- **Controls** go through `controlFor`, which is new. `windows.ts` holds a
  control down from its keydown to its keyup.

A shot is a fresh press. A key repeat never fires, so the Space that chose New
Game doesn't fire, and holding Space fires once. Each step takes
`{ turn, thrust, fire }`, and a press is used up by the first step after it.

### 4.3 The field (`field.ts`)

A field holds:

- the ship: position, velocity and heading, or none while a respawn is
  pending;
- the ships in reserve;
- the shots, each with its steps left;
- the meteors: size, position, velocity and outline;
- the debris;
- the score and the wave;
- two waits in steps, for the respawn and for the next wave;
- the generator's state.

Positions are system px as floats, and velocities are px a step.

A step, in order:

1. The ship turns, thrusts, coasts (slowed by drag) and moves.
2. A fresh press fires from the nose while fewer than four shots fly. A shot
   leaves at the ship's velocity plus its own.
3. Shots, meteors and debris move. Shots and debris age out.
4. A shot that hits a meteor takes it out. A large meteor leaves two medium
   ones and a medium leaves two small, each in a new direction. A small one
   leaves only debris. The size's points go on the score.
5. A meteor that hits the ship goes the same way, with its points, and the
   ship breaks into debris. With ships left, a respawn is pending. With none,
   the game is over.
6. Every 10,000 points adds a ship.
7. Once the field is empty, the next wave comes 2 s later. The first wave is
   4 large meteors, each wave adds 2, up to 11. They start along the edges,
   clear of the ship.
8. A pending ship comes back at the center, nose up, after 2 s and once no
   meteor is within 40 px of it.

Everything moves on the torus. A position wraps at each edge, and a hit is
measured the shorter way round, so a meteor half off the right edge can be hit
on the left. Hits are circles: the ship is a circle of 4 px, and a meteor a
circle a little inside its outline, so a graze reads fair. A shot hits along
its whole move that step, as the meteor saw it, so a fast shot can't step over
a small meteor between steps. The ship's own shots never hit it.

Every random draw comes from a generator seeded at New Game and carried in
the field: a meteor's place, direction, speed and outline. The generator is
mulberry32, a dozen lines. A step is a pure function of the game and the
input, so a test replays a game exactly. A step returns a new field, as
`step()` returns a new game today. A few dozen small objects a step are
nothing at 60 a second.

Starting numbers, all tuned by eye in step 7:

| | |
| --- | --- |
| Ship | about 11 × 8 px; turns 5° a step, a full circle in 1.2 s; thrust 0.06 px a step², top speed 3 px a step; drag × 0.99 a step |
| Shots | 2 × 2 px; 4 px a step faster than the ship; 45 steps of life; 4 in flight |
| Meteors | radius 14, 8 and 4 px; speeds 0.3–0.7, 0.6–1.2 and 0.9–1.6 px a step; 20, 50 and 100 points |
| Ships | 3, and one more every 10,000 points |

### 4.4 Drawing (`raster.ts`, `screen.ts`, `draw.ts`)

A frame clears the bits, draws the field into them and `present()`s them. Then
it sets the text over them, as the title screen does today.

- **The raster** is 320 × 240 bytes, 1 for ink. `plot` wraps its point into
  the screen. So `line` (Bresenham, both ends inked) and `outline` (a closed
  polygon) wrap at the edges without asking, and a meteor across an edge
  shows on both sides.
- **Shapes stay rigid.** An outline's center is rounded once, and its points
  are whole px from it. A meteor drifts without changing shape, and the
  ship's outline changes only as it turns.
- **The look** is white ink on black, like the title screen. The ship is an
  "A" in outline, with a flame that flickers while it thrusts. Each meteor is
  its own jagged outline, 11, 9 or 7 corners by size, made when it spawns.
  Shots are 2 × 2 px and debris single px.
- **The HUD** puts the score at the top left in the display face, with the
  ships in reserve drawn as small ships under it. PAUSED (_Click or press P
  to continue_) and GAME OVER are each centered on a black plate so they read
  over the field. The title screen gains a _Best_ line.
- **`present(bits)`** writes one reused `ImageData`, white for ink and black
  for the rest, with one `putImageData`.

A frame is drawn only when a step ran, so a 120 Hz display still draws 60
frames a second.

### 4.5 Pausing (`windows.ts`)

Keys reach the game only while its screen has the keyboard focus, as today,
so the game runs only while it has the focus. The screen loses the focus
whenever the player turns to anything else:

- another window or the desktop, because the window manager moves the focus
  with the active window;
- a menu, because a press on its title focuses it. Arrow keys in an open menu
  then walk the menu and never turn the ship.
- the end-game alert;
- another tab or application. The window's `blur` and a hidden
  `visibilitychange` pause the game too, in case the screen hears nothing.

A `focusout` on the screen pauses the game and drops the keys held, since
their `keyup`s will land elsewhere. Coming back doesn't resume the game by
itself; P does, or a click on the screen. The click also gives the screen the
focus, which a menu command or a press on the desktop leaves elsewhere. The
alert is the one exception: Cancel goes back to the game as it was, running
or paused. The pause rule is the playing screen's. Game over runs out its 3 s
regardless.

### 4.6 The best score (`index.ts`, `src/main.ts`)

The best is a site key on the saved session, as the About box's `greet` is.
`BEST` is exported from `index.ts`, its default 0 sits in `main.ts`'s `extra`,
and the app reads and sets it through `ctx.state`. A game counts once its last
ship is lost. End Game and closing the window abandon it. Under `?fresh=1`
the best lasts only for the visit.

## 5. Steps

Each step ends with `npm test`, `npm run typecheck` and `npm run build` green.

1. **The raster.** `raster.ts` and `present()`, with their tests. _Landed._
2. **The meteors drifting.** `field.ts` with the first wave, each meteor in an
   outline of its own, drifting and wrapping. The playing screen holds a
   field, and `draw.ts` lands with the title moved in. _Landed._
3. **The ship.** Flight among the meteors: turning, thrust and coasting. The
   keys held, P and the pause rule land with it. _Landed: the check-in._
4. **Shots and hits.** Firing, splitting, the score, debris, and the waves
   after the first. The game is playable. _Landed._
5. **Ships and the end.** The ship hit, the respawn, extra ships, game over,
   and the HUD's ships. _Landed._
6. **The best score.** _Landed._
7. **Tuning and docs.** The numbers in §4.3 by feel; SPEC §16 to §18 for the
   game; README's Meteors row; the header comments.

## 6. Kit asks

None needed. One is worth raising:

- **Handing the focus back after a menu command.** The bar gives the focus to
  the menu's title, so keys stop reaching the active window until a click:
  Meteors' P, and any application's own keys. Handing it back to where it was
  before the press would fix that for every application.

A second, the canvas on the device grid, was withdrawn 2026-10-07 with the
seam it was about (Status).

## 7. Decisions

Decisions 2, 5 and 6 were taken 2026-10-06. The rest stand as recommended.

1. **Raw canvas with a raster of our own, no three.js** (§3). _Recommended._
2. **The first cut** is the ship, shots, three sizes of meteor, waves, the
   score, ships with one more every 10,000, and game over. Hyperspace, the
   saucers and sound come later (§10). _Taken as recommended._
3. **Keys**: ← → turn, ↑ thrust, Space fires once a press with four in
   flight, P pauses. _Recommended_, over holding Space to keep firing.
4. **Pausing**: any loss of the screen's focus pauses, and P or a click on
   the screen resumes. _Recommended_, over resuming as soon as the focus comes
   back. The window manager can hand the focus back without the player
   asking, which could drop them into a meteor before their hands are on the
   keys.
5. **Meteor outlines** made per meteor from the seed. _Taken as recommended._
6. **The best score** kept in the saved session and counted at game over.
   _Taken as recommended._
7. **Game over**: GAME OVER over the drifting field for 3 s, then the title
   screen. _Recommended._

## 8. Tests

By the policy: contracts, not the numbers. A test reads the tuning constants
it needs (`METEOR`, `SHIP`, `WAVE`, …) rather than restating them, so tuning
never breaks one.

- `raster`:
  - a line inks both ends and one px a step along its long axis;
  - a point past an edge, negative ones included, lands wrapped;
  - a line across an edge comes back on the other side.
- `field`:
  - positions wrap, and a hit across an edge counts;
  - a shot splits a large meteor into two medium and scores its points, and
    a small one vanishes;
  - a fifth shot waits for one of four to go, and one shot takes one meteor;
  - a fast shot can't step over a small meteor, and one passing wide misses;
  - shots and debris age out;
  - each 10,000 crossed adds one ship;
  - the respawn waits for a clear center;
  - an empty field brings the next wave, bigger, up to the cap, its meteors
    on the edges and clear of the ship;
  - the same seed and inputs give the same field.
- `game`:
  - P pauses and resumes;
  - losing the last ship is game over, which goes to the title after its
    time;
  - `controlFor`'s keys, none of them with ⌃, ⌘ or ⌥;
  - a saved best reads back as whole points above 0, anything else as none;
  - the title, end-key and clock tests as today.

## 9. Eye checks

In `npm run dev`, once the steps land:

1. Every frame is black and white at 1×, 2× and 3×: 1px lines, no gray.
2. The ship turns, thrusts and coasts. Everything wraps at all four edges,
   whole on both sides.
3. One shot a press, four at most. Large goes to medium, to small, to gone,
   and the score adds up.
4. A hit on the ship brings debris, the wait and the respawn at a clear
   center. Losing the last ship brings GAME OVER, the title and the best.
5. A click on another window, the desktop or a menu, or a switch to another
   tab, pauses the game. P resumes, and so does a click on the screen. The
   alert's Cancel goes back as it was.
6. ⌃W, ⌃Q and ⌘J in a game reach the menu bar, not the ship.
7. A reload keeps the best and reopens the window on the title screen;
   `?fresh=1` has Meteors on its desktop and forgets the best on a reload.
8. Steady at 60 steps a second on a 120 Hz display. A long stall jumps the
   game a quarter second at most.

## 10. Follow-ups

- **Hyperspace** on ↓: a jump to a random place, with a chance of not coming
  out.
- **The saucers**: the large one firing at random, the small one aiming.
- **Sound** through Web Audio: the heartbeat, the shots, the hits.
- **The ship's breakup** as its own lines drifting apart, the arcade's way.
- **A Game menu** with New Game and Pause, as a System 7 game had.
- **A high-score table** with initials.
- **Touch controls**, for a device with no keyboard.

## 11. Files touched

- **New**: `src/apps/meteors/field.ts`, `raster.ts`, `draw.ts`;
  `test/meteors-field.test.mjs`, `test/meteors-raster.test.mjs`.
- **Changed**: `src/apps/meteors/game.ts`, `screen.ts`, `windows.ts`,
  `index.ts`; `src/main.ts` (the best's default); `test/meteors.test.mjs`;
  `docs/SPEC.md`, `README.md`.
- **Unchanged**: `windows.html`, `menus.html`, `dialogs.html`,
  `src/desktop.css`, the art, and `package.json`: no new dependency.
