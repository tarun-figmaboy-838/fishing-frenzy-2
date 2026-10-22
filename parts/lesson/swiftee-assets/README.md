# Swiftee — character sprite sheets

Engine-agnostic sprite sheets generated from the Rive rig, built so that **any
frame of any animation can be dropped in anywhere and the character will not
shift a pixel.**

```
source/rive/swiftee.riv   ──▶  build/render_rive.mjs   ──▶  build/pack_spritesheets.py  ──▶  spritesheets/ atlas/ poses/
     82 animations              headless Rive render          uniform-grid packing
```

## The one thing that matters

| | |
|---|---|
| **Cell** | `512×512` @2x, `256×256` @1x — identical for every frame of every animation |
| **Pivot** | exact cell centre, `(0.5, 0.5)` — matches every engine's default |
| **Layout** | strict uniform grid, left→right then top→bottom |
| **Frame rate** | 20 fps |
| **Trimming** | none, deliberately |

Every frame is rendered through the *same* mapping from the artboard to the cell,
so the character's registration is preserved across all 82 animations. Swap
`waving_012` for `sleeping_031` and nothing jumps. That is the whole point of
the pipeline, and it is why frames are **not** trimmed — per-frame trimming
saves atlas space but gives every frame its own offset, destroying exactly this
property.

Because the grid is uniform, an engine only needs the cell size to slice a
sheet. The JSON is a convenience, never a requirement.

## Layout

```
spritesheets/{2x,1x}/swiftee_<anim>@<scale>.webp  one sheet per animation
atlas/{2x,1x}/swiftee_<anim>@<scale>.json         TexturePacker JSON-Hash
atlas/swiftee.manifest.json                       master index — read this first
poses/swiftee_poses@1x.webp + .json               all 82 stills on one sheet
poses/still/swiftee_<anim>.webp                   individual stills, full 512px
preview/index.html                                open in a browser to pick frames
source/rive/swiftee.riv                           the rig — single source of truth
source/rive/swiftee_*.riv                         secondary UI compositions (see below)
build/                                            the pipeline
```

## Format and size

12 MB of shipped assets for 1618 frames across 82 animations. Two compression
decisions get it there, both measured rather than assumed:

**Palettise, then compress losslessly.** The art is flat-shaded vector, so a
256-entry palette with per-entry alpha is visually indistinguishable from
RGBA8888 — and it also makes the encoder's job far easier. On one sheet:
palette → lossless WebP is 60 KB, raw RGBA → lossless WebP is 124 KB, raw RGBA →
PNG is 236 KB.

**Lossless WebP, never lossy.** Counter-intuitive, but lossy WebP is the wrong
tool for this art. These sheets are flat colour over mostly-transparent cells,
and lossy VP8 burns bits on DCT blocks inside fully transparent regions.
Measured across real sheets, lossy WebP came out **2–4× larger** than the
palettised PNG *and* visibly degraded (rms 22–38). Lossless WebP is
byte-identical output at ~65% of the PNG size:

| | @2x | @1x |
|---|---|---|
| palettised PNG8 | 6.8 MB | 4.8 MB |
| lossless WebP | **4.8 MB** | **3.1 MB** |

> **Engine caveat.** Godot 4, every modern browser, Phaser and Pixi read WebP
> natively. **Unity, Unreal and GameMaker do not** — they need a plugin, or PNG.
> Rebuild as PNG with `python3 build/pack_spritesheets.py --format png`; the
> pixels are identical either way.

Pass `--lossless` to skip palettisation and keep true RGBA (much bigger).
Atlas JSON is written compact, since it is machine-read — that is 164 files.

## Start / loop / stop

The rig ships transitions, not just loops. 26 of the animations are full states:

```json
"waving": { "start": "wave_start", "loop": "waving", "stop": "wave_stop" }
```

Play `wave_start` once → loop `waving` as long as you like → play `wave_stop`
once. `atlas/swiftee.manifest.json` resolves all 26, including the awkward ones
(`Callstart` for `Calling`, `Sleep Start` for `Sleeping`) that no suffix rule
would catch.

States: calling, celebrating, confident, confused, curious, daydreaming, driving,
excited, focussed, happy, laptop, learning, listening, love, peeping, playful,
proud, puzzleing, reading, relieved, sleeping, surprised, talking, thinking,
waving, writing.

Standalone clips: blinking, flapping, drive_away, honk, wake, reset.

## Picking a pose — `preview/index.html`

Open it in a browser (plain `file://`, no server needed). It samples the sheets
exactly the way an engine does — uniform cells, pivot dead centre — so what you
see is what you ship. Tick as many animations as you like in the sidebar and
they all play together.

Three modes:

* **Grid** — every selected animation as its own card, playing in sync. Each
  card has its own scrubber, and parking one card leaves the others running, so
  you can hold a pose next to a moving one.
* **Overlay** — all selections stacked in one viewport, each layer hue-shifted
  with a legend. This is the registration check: if the pivot holds, the
  heads sit on top of each other.
* **Chain** — plays each selection's real `start → loop → loop → stop`
  sequence, labelling the active phase, so you can audition a transition
  before wiring it up.

Everything on the toolbar applies live: **fps** (1–60), **size** (96–512px,
which swaps in the @2x sheets above 256), **flip**, **background** (checker,
dark, light, and two brand-clashing colours to catch edge fringing), and
**guides** — teal crosshair for the shared pivot, amber line for the baseline
the standing character rests on. `↔` in the sidebar marks the animations that
travel out of the cell.

**Click any sprite** to copy an engine-ready reference for the exact frame on
screen — sheet path, atlas path, grid, cell rect, plus Phaser/Unity/Godot
lines — matched to the scale you are actually viewing:

```
waving_014  —  @2x, 512px cell, pivot centre
sheet : spritesheets/2x/swiftee_waving@2x.webp
atlas : atlas/2x/swiftee_waving@2x.json
grid  : 6 x 5   frame 14 of 30  (col 2, row 2)
rect  : x=1024 y=1024 w=512 h=512
```

Keys: `space` play/pause, `r` restart, `f` flip, `g` guides. The full state
lives in the URL hash, so a selection can be bookmarked or pasted to someone
else. The set dropdown switches to the secondary compositions.

For a single still, `poses/still/swiftee_<anim>.webp` is already cell-aligned,
so it drops into a scene at the same position as any animated frame.

## Using it

Frame `i` sits at `col = i % cols`, `row = i / cols`, so its rect is
`(col * cell, row * cell, cell, cell)`. `cols` is in the manifest and in each
atlas under `meta.grid`.

**Unity** — rebuild as PNG first (`--format png`), then drop the sheet in, set Sprite Mode `Multiple`, Sprite Editor →
Slice → Grid By Cell Size, `512 × 512`, Pivot `Center`. Set Filter Mode
`Bilinear` and, for pixel-exact display, Compression `None`.

**Godot 4** — `Sprite2D` with the sheet as texture, enable `Region`, or use
`AnimatedSprite2D` → `SpriteFrames` → Add frames from sheet, `hframes = cols`,
`vframes = rows`. Leave `centered = true`.

**Phaser 3** — the atlas JSON loads directly:
```js
this.load.atlas('swiftee_waving',
  'spritesheets/2x/swiftee_waving@2x.webp',
  'atlas/2x/swiftee_waving@2x.json');
// frame names are waving_000 … waving_029, already in order
this.anims.create({ key: 'waving', frameRate: 20, repeat: -1,
  frames: this.anims.generateFrameNames('swiftee_waving', {
    prefix: 'waving_', start: 0, end: 29, zeroPad: 3 }) });
this.add.sprite(x, y, 'swiftee_waving').setOrigin(0.5).play('waving');
```

**Pixi / Cocos** — same JSON-Hash format; `Assets.load` the atlas and use the
frame names.

**Unreal (Paper2D)** — rebuild as PNG (`--format png`), import it, `Sprite Actions → Extract Sprites` with
grid `512 × 512`, then build a Flipbook at 20 fps.

**Web / CSS** — steps() animation over a single row is awkward on a 2D grid, so
drive `background-position` from JS, or use the `preview/index.html` logic:
`background-size: cols*100% rows*100%`, then position by cell index.

**Collision and floor alignment** — each animation carries
`opaqueBoundsUnion` (its ink box in @2x cell pixels) for tight hitboxes, and
`manifest.baselineY` gives the standing idle's foot line at `y = 449` of 512
(87.7% down the cell). Align that to your ground rather than the cell edge.

## Animations that leave the cell

The cell is framed to the artboard, which is the frame the character was
composed in. Six animations deliberately travel out of it:
`driving`, `drive_away`, `peeping_start`, `peeping_stop`, `sleep_start`, `wake`.

That is authored intent — the bird drives off-screen, or peeps up from below the
frame — and a Rive runtime rendering the artboard clips them identically. Sizing
one shared cell to contain the driving animation would shrink the character to
roughly half size in all 82 cells, which is a bad trade. `manifest.exitsCell`
lists them.

## Rebuilding

```bash
cd build && npm install          # playwright-core + @rive-app/canvas-advanced
node render_rive.mjs             # 82 animations → build/.cache/frames/
cd .. && python3 build/pack_spritesheets.py
python3 build/make_preview.py
```

Useful flags:

```bash
node render_rive.mjs --fps 30              # more frames, bigger sheets
node render_rive.mjs --cell 384            # 768px @2x cells
node render_rive.mjs --only Waving,Happy   # iterate on a few
python3 build/pack_spritesheets.py --format png       # for Unity / Unreal
python3 build/pack_spritesheets.py --lossless         # skip palettisation
python3 build/pack_spritesheets.py --max-texture 2048 # older mobile GPUs
python3 build/pack_spritesheets.py --frames           # also emit loose frames
```

### Reclaiming disk

Two directories are build machinery, not assets, and both regenerate:

| | size | regenerate with |
|---|---|---|
| `build/.cache/` | ~90 MB | `cd build && node render_rive.mjs` (offline, ~45 s) |
| `build/node_modules/` | 21 MB | `cd build && npm install` (needs network) |

`build/.cache/` is deleted — repacking in a different format needs it back, so
re-render first. Both are gitignored.

If you need to go smaller still, the levers in order of effect:

* **fps** — `--fps 12` cuts 1618 frames to ~970, so roughly 40% off the sheets.
  These are gentle idle loops, so 12 fps holds up better than you would expect.
* **one scale** — dropping @2x saves 4.8 MB. Edit `SCALES` in
  `build/pack_spritesheets.py`.
* **fewer animations** — `--only` on the renderer builds just the states you
  ship.

Raising `--fps` can push a long animation past the texture limit — a 4096px
sheet holds 8×8 cells at 512px. The packer then splits into pages
(`swiftee_excited_p0@2x.webp`, `_p1`) rather than shrinking the cell, so the
shared pivot survives. `excited` is already paged at 20 fps.

## Should you use sprite sheets at all?

Worth knowing before you commit: **`source/rive/swiftee.riv` is 374 KB and
contains all 82 animations, resolution-independent, with state-machine
transitions.** The sprite sheets are 13 MB and fixed at 512px and 20 fps. Rive's
runtimes are MIT-licensed and free for commercial use, with no royalties, and
exist for Unity, Unreal, Flutter, iOS, Android and web.

Use the sprite sheets when you want zero runtime dependencies, GPU-cheap
blitting, or an engine path with no Rive runtime. Use the `.riv` directly when
you want crisp rendering at any scale, smooth state transitions, or the smaller
download. Both are here; they are not mutually exclusive.

## Secondary sets

`source/rive/swiftee_{eye_blink,fin_animate,jump,home,home_lip_sync,motion}.riv`
are separate compositions, not character poses — avatar tiles with a background
plate, and scene widgets like the bird bursting through paper. Each has its own
artboard (`500×500`, `334×263`, `393×270`), so each gets its own cell, and
**frames from these sets are not interchangeable with the main character set.**

They are built under their own prefixes: `spritesheets/jump/`, `atlas/motion/`,
and so on, and appear as separate sets in the preview. Rebuild one with:

```bash
node render_rive.mjs --riv source/rive/swiftee_jump.riv \
  --cache-dir .cache/swiftee_jump --fit measured
python3 build/pack_spritesheets.py --cache-dir build/.cache/swiftee_jump --prefix jump
```

Note that `eye_blink`, `fin_animate` and `jump` are hard-clipped at their
artboard in the source file — the bird's body is cut off flat at the bottom by
design, since they are framed as head-and-shoulders avatar tiles.
