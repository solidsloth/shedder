# Shed builder — v0.4

Parametric shed designer. Give it dimensions, get exact stud placement, a cut
list, and (eventually) step-by-step build instructions.

**[Open the designer →](https://solidsloth.github.io/shedder/)** — runs entirely
in the browser, nothing to install.

This version covers **steps 1–4 of the plan**: the data model, wall stud
layout, corner posts, plates, the cut list, **openings** (doors and windows
with king/jack studs, span-sized headers, sills, and cripples), the **roof** —
gable and shed types with rafter cuts, birdsmouths, and a ridge — and now the
**floor**: skids, joists, rim joists, and blocking. Sheathing and instructions
come next.

## Layout

```
src/core/framing.ts   the engine — pure functions, no DOM, no framework
test/framing.test.ts  56 tests, node:test
test/theme.test.ts    6 tests — the two halves of theming can't share code,
                      so these pin the contract between them
index.html            Vite entry — just a mount point
src/demo/             the React UI
  App.tsx               state, layout, the sheet
  Controls.tsx          the sidebar
  OpeningsEditor.tsx    doors and windows
  FloorPlan.tsx         plan view of the floor frame
  WallElevation.tsx     one wall, looking at it from outside
  RoofSection.tsx       rafter section and cut figures
  CornerDetail.tsx      corner post, plan view
  CutList.tsx           every stick
  svg.tsx               dimension lines, hatch, readouts, width + scan hooks
  form.ts               control state ⇄ ShedSpec
  theme.tsx             light/dark/system + the toggle
  style.css             theme tokens + the sheet's own styles
src/components/ui/    shadcn components (generated, yours to edit)
vite.config.js        build config + the single-file inliner
build/index.html      ← the built demo
```

**The engine has no imports, and nothing in the UI computes a framing
dimension.** That split is the point: `framing.ts` is plain TypeScript with no
React in it anywhere, so the planned React Native version reuses it untouched
and only `src/demo/` gets rewritten. Every number on screen — including screen
positions like `elevBottom` and the rafter outline polygons — comes out of the
engine.

## Two visual registers

The UI deliberately runs two looks at once, and `style.css` is organised around
the split:

- **Chrome** — sidebar, title block, warnings, cut list. Sans-serif, shadcn
  components on Tailwind, light warm-neutral surfaces. This is the tool.
- **Sheet** — everything inside `.sheet`. Keeps the drafting palette and
  monospace: paper ground, pine members, drafting dimension lines. This is the
  drawing.

They share one accent, the drafting green (`--mark`, which is also shadcn's
`--primary`), so the contrast reads as intentional rather than as two designs
bolted together. The practical payoff is that the drawings look like *output*
instead of more page.

shadcn components are generated into `src/components/ui/` — they are source in
this repo, not a dependency, so retheming them is just editing them. There is no
webfont: `shadcn init` pulls in Geist, which emits five `.woff2` files and would
break the single-file build, so it was removed in favour of a system sans stack.

## Light, dark, and system

The toggle in the sidebar picks **light**, **dark**, or **system**. System is
the default and a live setting, not just the opening guess: while it is
selected the page keeps following the OS, so a machine that flips to dark in
the evening flips the drawing with it, no reload. An explicit choice is
absolute and persists in `localStorage` under `shedder:theme`.

A blocking script in `index.html` resolves the theme **before first paint**, so
a dark-mode visitor never sees a white flash. It duplicates a few lines of
`theme.tsx` by necessity — it has to run before any module loads. The two must
agree on the storage key, the class name, and what to do with an unrecognised
stored value, or you get a flash of the wrong theme; there is a test for exactly
that (see below).

**Dark is a repaint of the sheet, not an inversion.** Inverting would have made
the wood grey and the drawing unreadable. Instead the ground goes dark and warm,
the members stay recognisably pine — slightly deeper so they don't glare — and
the drafting layer moves to a bright teal that plays the role the dark green
plays in daylight. Chrome and sheet share that accent in both themes:
`--primary` and `--mark` are always the same colour.

Every colour the drawings use is a token, and the SVG components set **no**
colours inline — the hatch pattern, the footprint outline, and the corner-detail
envelopes are all classes. That is what makes the dark theme a palette swap
instead of a second set of rules, and it is worth preserving: a literal `#hex`
in a `.sheet` rule or a `fill="#..."` in a component is a light-coloured patch
waiting to appear on a dark ground.

## Commands

```sh
npm run dev       # vite dev server, hot reload
npm test          # node --experimental-strip-types --test
npm run typecheck # tsc --noEmit  (the test runner strips types without checking them)
npm run build     # vite build -> build/index.html
npm run preview   # serve the built file
```

Node 22 runs the engine's TypeScript directly for tests, so `npm test` needs no
build step. `tsc` never emits anything now — Vite compiles, tsc only checks.

**The build is still one self-contained file.** `vite.config.js` folds the CSS
and JS back into `build/index.html`, so it works both as a GitHub Pages upload
and opened straight off disk over `file://` — a normal Vite build would break
the second one, because `file://` blocks ES modules loaded from a separate
`assets/` file. It costs about 430 KB (130 KB gzipped): React, Radix, and the
compiled Tailwind. Adding a shadcn component adds to that, so it is worth
checking the number after `npm run build` rather than adding them freely.

## Pointing at pieces

Hovering a member fills the readout strip under its drawing. That used to be
mouse-only. Each drawing is now focusable, the **arrow keys** step through its
pieces, and **Escape** clears — so the same information reaches keyboard users.
The readout is an `aria-live` region, so a screen reader announces each piece as
you land on it. Wall plates are skipped on hover (they are big background slabs
that would steal every pointer event) but the keyboard walk still reaches them.

## Conventions in the engine

**Units.** Everything is decimal inches. `formatLength(92.625)` gives
`7' 8-5/8"`; `parseLength("8' 6\"")` gives `102`.

**Wall local frame.** `x` runs along the wall from its left end viewed from
outside; `y` runs across the thickness from the exterior face. A 2x4 on edge is
`w: 1.5, d: 3.5`.

**Through vs butt walls.** One pair of walls runs the full outside dimension;
the other pair fits between them and is `2 × 3.5"` shorter. Switchable with
`throughWalls`.

**Stud layout.** Field stud centers land on exact multiples of the spacing, so
4' sheathing seams fall dead center on a stud. The end stud sits flush with the
wall end, which makes the first bay short — that is correct, not a bug.

Butt walls shift their layout by the wall thickness (`layoutReference:
'building-corner'`) so seams stay aligned as sheathing wraps the corner. Set it
to `'wall-end'` if you plan to sheathe each wall separately, flush to its ends.

**Cap plates.** The upper top plate laps the corner: through walls hold back
3.5" at each end, butt walls run 3.5" long at each end to cover. The demo draws
them in their true lapped position.

**Plate splicing.** Plates longer than the stock length split over a stud
center. The staggering rule (cap splices ≥ 4' from top-plate splices) is
currently a warning, not enforced.

**Openings.** Sizes are rough openings — RO sizing from the unit is on you
(typically unit + 2", but check the unit's spec). An opening is placed by its
RO **center** along the wall; it does not snap to the stud grid. King studs
flank the RO (full height, they join `studCenters` so plates may splice over
them), jacks carry the header at the RO edges, and the header spans jack to
jack — cut length `RO + 3"`.

Door RO height is measured from the **bottom of the wall**; the bottom plate
runs through the opening and gets cut out after the wall is standing (the
engine emits a warning saying so). Window ROs start at `sillHeight` with a
single flat 2x rough sill directly below, fitted between the jacks.

Cripples above the header — and below a window sill — stay on the o.c. layout
grid, so sheathing nailing lines continue straight through the opening. Field
studs that would land inside the opening assembly give way to it; studs just
outside survive.

**Headers.** Doubled 2x on edge with a ½" plywood spacer. Sized off the span
via `DEFAULT_HEADER_TABLE` — see the caveat below. Overridable per wall
(`headerTable`) or per opening (`headerSize`). A span beyond the table draws
with the largest size and warns that it wants an engineered header. In a 2x6
wall the header sets flush to the exterior; the note says to furr or insulate
the interior gap.

**Elevation.** Every member carries `elevBottom`/`elevHeight` (inches above
the bottom of the wall), so the drawing layer never computes a vertical
position.

**Roof section frame.** `x` runs horizontally across the span, 0 at the low (or
left) wall's *exterior face*; `y` is vertical, 0 at the *top of that wall's top
plate*, up positive. So rafter tails dip to negative `y` and the ridge sits at
positive `y`. `layoutRoof` returns `profiles` — the finished rafter outlines as
polygons, birdsmouth included — plus `ridgeSection` and `plateSections`, so the
drawing layer only maps coordinates.

**Pitch and rafter cuts.** Pitch is rise per 12" of run, the way it's spoken
("4/12" is `pitch: 4`). Everything else follows: `slopeFactor = √(1+(pitch/12)²)`,
rafter stock length = total run × slopeFactor. Because both plumb cuts are
vertical and parallel, the top and bottom edges are the same length — the stock
length is unambiguous. A plumb cut measures `rafter depth ÷ cos(pitch)`, which
is why it's always longer than the board is deep.

**Ridge deduction.** Each rafter's run is shortened by half the ridge board's
thickness so the plumb cut lands on the ridge board's *face*, not its
centerline. The ridge defaults one nominal size deeper than the rafter so the
plumb cut gets full bearing — that default is convention, and at steep pitches
it isn't enough, so the engine checks `ridge depth ≥ plumb cut length` and warns.

**Birdsmouth.** The seat cut runs the full wall thickness for complete bearing;
the heel then falls out of the pitch (`heel = seat × pitch/12`). The notch
depth is checked against 1/3 of the rafter depth and **warns rather than
silently shrinking the seat** — under-bearing quietly is worse than a flag.

On a shed roof the notch at the high wall mirrors the low one but its plumb
face lands on the plate's *inner* edge: the rafter rises toward that eave, so
that's where the notch is deepest. That geometry also means the high wall is
taller by `(span − seat) × pitch/12`, not `span × pitch/12`. `layoutRoof`
**reports** that delta and warns; it never reaches into a `WallSpec` and
changes a height behind your back.

**Rafter layout.** Same rule as the studs — end rafters flush with the building
ends, field rafters on exact multiples of the spacing, so 4' roof sheathing
seams land on a rafter. Rafters are laid out independently of the wall studs;
stacking them over studs is a nicety most shed builds skip.

**Floor plan frame.** `x` runs across the building's *width*, `y` across its
*depth*, both 0 at the outside face of the framing. Elevation is measured from
the **bottom of the skids** — so 0 is the plane the whole shed bears on, and the
deck lands at `deckHeight`. The floor frames to the same outside rectangle as
the walls, so a bottom plate sits flush over the rim joist and sheathing runs
straight past the joint.

**Skids set the span.** Skids lie wide-face-down under the joists, running at
right angles to them, so the **clear gap between skids** is the span that
matters — not the shed's depth. A 12×8 on three skids has joists spanning about
3'3", not 8'. That is the number checked against the span table, and it is why
`skidCount` is the most load-relevant input on the floor.

**Joist layout.** Same rule as the studs and the rafters — end joists flush with
the floor edges, field joists on exact multiples of the spacing, so 4' decking
seams land on a joist. `joistAxis` picks which dimension the joists run along;
skids swap with it. Rim joists cap the joist ends and run the full length, which
makes the joists the "butt" pieces of the same through/butt split the walls use,
and they splice over a joist center.

**Treated stock.** Skids are always pressure treated — they are in ground
contact. Joists, rims, and blocking follow `treatedJoists`. Every `Member` now
carries its own `treated` flag, so the cut list keeps treated and untreated
sticks of the same size on separate lines without knowing what kind of assembly
they came from.

**Blocking** defaults to none, which is normal for a skid floor at these spans.
Rows run straight across rather than staggered, so one end of each piece gets
toe-nailed.

## A caveat worth keeping

Corner detailing has real regional variation and the three options here are
common conventions, not the only correct ones. The geometry is documented with
explicit coordinates in `cornerPost()` so it is easy to adjust to whatever you
actually build.

The same goes — more strongly — for `DEFAULT_HEADER_TABLE`. It is a shed-grade
rule of thumb for a doubled 2x header under a light roof load, **not an
engineering stamp**. Header sizing varies with snow load, roof span, and local
code; check a real span table before building and swap in your own table where
it disagrees.

**Nothing sizes a rafter for load.** The roof engine does the geometry — how
long, what angle, where the cuts go — and takes the rafter size as an input. It
will happily cut you a 2x4 rafter spanning 16'. Rafter sizing depends on span,
spacing, species, and snow load; get it from a span table. The 1/3-depth
birdsmouth guideline is likewise common practice, not code text.

`DEFAULT_JOIST_SPANS` is the same kind of animal. The numbers are rule-of-thumb
clear spans in the neighbourhood of what's published for a 40 psf live / 10 psf
dead floor in No. 2 softwood at L/360 — **check a current span table for the
species and grade you're actually buying** and pass your own in
`FloorSpec.joistSpanTable` where it disagrees. Unlike the header table this one
only ever *warns*: it never picks a joist size for you. On a skid floor it is
mostly a guard against a gross error, since every size in the table clears a 4'
skid spacing comfortably.

**Nothing below the skids exists.** No blocks, piers, gravel, footing depth,
frost line, or soil bearing — the floor assumes the skids are already sitting
level on something adequate. Whether that something is adequate is entirely
outside the model.

## Not in the floor yet

No decking — that arrives with sheathing. No joist hangers (the joists bear on
the skids rather than hanging off the rims, so none are needed as drawn), no
notching or bolting the joists down to the skids, no doubled joists under a
partition or a heavy point load, and no framed opening in the floor.

## Not in the roof yet

Common rafters only. No hips, no dormers, no rake (gable-end) overhang with
ladder framing, no boxed soffits, and no gable-end wall framing — the triangle
above the top plate at each gable end is not studded out. Rafter tails get a
plumb cut and stay exposed.

## Next

1. **Sheathing and fasteners** — wall, roof, and floor decking panel layout,
   waste factor, nail counts. The layout grids are already built to suit it:
   studs, rafters, and joists all put a member under every 4' seam.
2. **Instructions** — order the model into build steps, floor first.
3. **Gable-end framing** — studs in the gable triangle; needed before the
   walls-plus-roof model is actually buildable.

## License

Copyright (C) 2026 Mark Escher.

Licensed under the **GNU Affero General Public License v3.0 or later** — see
[LICENSE](LICENSE). In short: use it, modify it, share it, but derivative works
must stay under the AGPL, and if you run a modified version as a network
service you must offer its source to that service's users.

The warranty disclaimer in sections 15–16 of the license is not boilerplate
here. Read "A caveat worth keeping" above: this program does geometry, not
engineering, and it will hand you a framing plan that cannot carry its own
roof if you ask it to. Verify every load-bearing dimension against a current
span table and your local code before you cut anything.
