# Prompt: add Swiftee to the learning flow

Unzip this folder into your game repo, then paste everything in the box below
into Claude Code from your repo root.

---

You have a folder of character animation assets called **Swiftee** — a friendly
bird mascot — somewhere in this repo (look for `swiftee-assets/`, or a directory
containing `atlas/swiftee.manifest.json`). Your job is to wire Swiftee into the
**learning part of this game** so the character reacts with a suitable
expression at each meaningful moment.

## Step 1 — read before you write

1. Read `<swiftee>/README.md` and `<swiftee>/atlas/swiftee.manifest.json`.
   **The manifest is the single source of truth** for frame counts, grid
   dimensions, sheet paths and state names. Never hardcode a frame count or a
   grid size you did not read from it — parse it, or generate a typed constants
   file from it.
2. Then explore *this* repo and tell me what you found before changing
   anything: the engine/framework, the rendering approach, where the learning
   flow lives, and which events in it are candidates for a reaction (answer
   submitted, answer graded, hint requested, lesson complete, streak, idle,
   and so on).

## Step 2 — the invariants that make this work

The sheets were built so **any frame of any animation is interchangeable**. Do
not break that:

- **Uniform grid.** Every frame is one cell, laid out left→right then
  top→bottom. Frame `i` is at `col = i % cols`, `row = i / cols`, rect
  `(col*cell, row*cell, cell, cell)`.
- **Cell**: 512px (`@2x`) / 256px (`@1x`). One size for every animation.
- **Pivot is the exact cell centre** `(0.5, 0.5)`. This matches engine defaults
  (Unity `Center`, Godot `centered=true`, Phaser `setOrigin(0.5)`). Keep it —
  it is why swapping expressions never makes the character jump.
- **Do not trim, crop, re-pack, re-scale or re-export the sheets.** Trimming
  saves atlas bytes and destroys the shared pivot.
- **Baseline** `y = 449` of 512 (87.7% down the cell) is where the standing
  character's feet are. Align *that* to your ground, not the cell edge.
- Sheets are **lossless WebP**. Godot 4, browsers, Phaser and Pixi read it
  natively. **Unity, Unreal and GameMaker do not** — if this is one of those,
  regenerate as PNG first with
  `python3 build/pack_spritesheets.py --format png` (identical pixels) and use
  those. Say so before you do it.

## Step 3 — build one component, not scattered sprite code

Create a single reusable mascot component that fits this codebase's existing
conventions — same language, same state/animation patterns, same file layout as
comparable components already here. It should expose roughly:

- `play(state)` — switch expression
- an idle/default expression it returns to
- a queue so a one-shot reaction plays out and then settles back

**Play the full triad.** Most expressions ship as `start → loop → stop`, listed
in `manifest.states`. Play `<x>_start` once, loop `<x>`, then play `<x>_stop`
once before switching away. Cutting from one loop straight into another skips
the transition the animator drew and looks jerky. Frame rate is **20 fps**
(`manifest.fps`). Animations with `"pingpong": true` play forward then reverse.

Then wire that component into the learning events you found in Step 2.

## Step 4 — which expression for which moment

26 states plus 6 standalone clips. Use this mapping; adapt it to the moments
that actually exist in this game rather than forcing all of them in.

| learning moment | expression |
|---|---|
| lesson intro, greeting the student | `waving` |
| neutral idle (student reading the screen) | `blinking` — cheapest loop, good default |
| student reading a long passage | `reading` |
| question shown, thinking time | `thinking` |
| timed task, deep concentration | `focussed` |
| student typing an answer | `writing` |
| listening to the student (mic / voice input) | `listening` |
| narrating or explaining | `talking` — only 8 frames, loop it while speech plays |
| correct answer | `happy` |
| correct answer on a streak | `celebrating` |
| lesson or level complete | `proud` |
| big reward moment | `excited` — 72 frames, use sparingly |
| wrong answer, first attempt | `confused` — encouraging, never punishing |
| wrong answer, student is stuck | `puzzleing`, then offer a hint |
| a hint is available | `curious` |
| tip peeking in from a screen edge | `peeping` — leaves the cell by design |
| unexpected reveal | `surprised` |
| got it right after struggling | `relieved` |
| encouragement, affection | `love` |
| gamified break, light moment | `playful` |
| device- or screen-based lesson | `laptop` |
| generic study context | `learning` |
| grabbing attention, incoming prompt | `calling` |
| idle ~30s | `daydreaming` |
| idle a long time / session end | `sleeping`, then `wake` to come back |
| transition between lessons | `driving`, then `drive_away` to exit |
| flying transition | `flapping` |

Notes: `sleeping` and `driving` have no `_stop` — leave them via `wake` and
`drive_away`. `reset` is a 3-frame neutral pose if you need to hard-reset.

There is also `<swiftee>/poses/` — one still per animation, already cell-aligned
— for static placements like a lesson card or an avatar, and
`<swiftee>/source/rive/swiftee.riv`, the 374 KB vector rig containing all 82
animations, if this engine has a Rive runtime and you would rather not ship
sprite sheets at all. Mention that option if it applies.

## Step 5 — verify, do not assume

- Run the game (or its tests) and confirm the expressions actually appear at the
  right moments. Report what you saw.
- Confirm the character does not shift position when expressions change. If it
  jumps, the pivot or the cell size is wrong — recheck against the manifest.
- Confirm the sheets load in this engine's asset pipeline.

## Guardrails

- **Do not change the learning logic, pedagogy, scoring or content.** You are
  adding a reactive mascot layer on top of what exists.
- Do not restyle or re-lay-out existing UI to accommodate the character. Fit it
  into the space available and ask if there is nowhere sensible to put it.
- Do not add a heavy animation dependency if the engine can already blit a
  sprite sheet.
- If the learning flow is unclear or there are several plausible places to hook
  in, stop and ask rather than guessing.
- Keep it performant: reuse one texture per animation, do not decode sheets
  every frame, and prefer `@1x` unless the mascot renders larger than 256px.

Start with Step 1 and report back before implementing.
