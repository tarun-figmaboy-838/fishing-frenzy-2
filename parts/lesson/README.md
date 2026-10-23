# Parallelogram lesson

Swiftee's parallelogram lesson: part of **Fishing Frenzy 2** (the repository's README). Swiftee, in her diving mask,
turns a trapezium into a parallelogram on an underwater card, then explores its sides, angles and diagonals, with three
checkpoints along the way. Lengths and angles are measured live from the shape on screen.

> **In the journey** the lesson plays after the fishing game's banner (Play), in its own frame over the game: the
> seashell on the lake floor opens, its pearl blows the card up, Swiftee dives in and the lesson begins. It has no
> Next, Back or screen list: each screen moves on by itself once its voice and animations are done, and a screen that
> asks for something waits for it. After Swiftee's goodbye she swims off and Popo's fishing begins. `?dev=1` on the
> journey's page jumps to any screen; `?debug` exposes `window.lessonDebug`.

## Run it

Static files, no build step. Serve the repository (`python3 -m http.server 8000` at its root) and open
http://localhost:8000/ for the whole journey. Opened directly, `parts/lesson/index.html` goes to the journey (which
starts with it); `parts/lesson/index.html?solo` plays the lesson on its own page, from a Next on the lake to its score
card. The stage is 1920 × 1080, letterboxed to any window; mouse, touch and pen all work.

## The lesson (storyboard "Parallelogram_Pages_5_to_56", PDF pages 1–52 → 53 screens)

Every screen carries its storyboard page as `pdf` in `js/lesson-data.js`. A question and its "That's correct!" page
are one screen (the feedback is that screen's finished state); each checkpoint page is three challenge screens.

| Screens | PDF | What happens |
|---|---|---|
| 1–4 | 1–4 | quadrilateral recap (outline draws itself, sides numbered), trapezium: one pair of opposite sides parallel |
| 5 | 5–6 | Which pair of sides are parallel? AB ∥ CD / AD ∥ BC → "That's correct! AB ∥ CD." |
| 6–7 | 7–8 | What if the other pair were parallel too? → learner drags B (demo hand first); BC ∥ AD arrows appear live, snaps |
| 8–10 | 9–11 | both pairs parallel (AB, CD then AD, BC highlighted with the voice) → "Parallelogram" → definition |
| 11–14 | 12–15 | Are the sides equal? Swiftee measures every side; 6 cm pair, then 3 cm pair appear |
| 15 | 16–17 | What do you notice? All sides equal / Opposite sides equal |
| 16–18 | 18–20 | opposite sides are equal; parallel and equal (AB ∥ CD, AD ∥ BC, AB = CD, AD = BC) |
| 19–21 | 21 | **Checkpoint 1**: find the parallelograms (select all: A, C) · AB = 7 → CD · AB = 8, BC = 5 → CD, AD |
| 22–26 | 22–26 | angles measured: ∠A = ∠C = 110°, ∠B = ∠D = 70° |
| 27–28 | 27–30 | tap the angle equal to ∠A (∠C), equal to ∠D (∠B); equal angles share a colour |
| 29 | 31 | opposite angles are equal |
| 30–32 | 32–34 | ∠A and ∠D: a copy of ∠A slides to D and fills the straight line with ∠D (110° + 70° = 180°) |
| 33 | 35 | Which other angles add up to 180°? (select all: ∠B & ∠C, ∠A & ∠B) |
| 34 | 36 | all four adjacent pairs, demonstrated one after another |
| 35–37 | 37 | **Checkpoint 2**: ∠A = 68° → ∠C · ∠A = 72° → ∠B · ∠A = 65° → ∠B, ∠C, ∠D |
| 38–40 | 38–40 | learner draws both diagonals (drag or tap corner to opposite corner; a side gets a tip) |
| 41–45 | 41–45 | AC and BD, point O, four coloured segments, their lengths |
| 46 | 46–47 | drag the segments into equal pairs (OA = OC, OB = OD) |
| 47–48 | 48–49 | equal halves share a colour and tick marks → diagonals bisect each other |
| 49–51 | 50 | **Checkpoint 3**: AO = 6 → OC · AO = 5, BO = 3 → OC, OD · choose the true statements |
| 52 | 51–52 | the summary, as Fishing Frenzy's (`js/summary.js`): one glassy bubble per idea (definition, parallel, equal sides, equal angles, supplementary, bisect) in the middle of the card, Swiftee peeking over it to say its line, the bubbles gathering into albums at the sides; then Next (in the journey, the hand-over) |
| 53 | — | Swiftee's goodbye; on the lesson's own page, the stars (first-try score over the 9 checkpoint challenges) and Play again |

Geometry: 1 cm = 60 board px. The opening trapezium (CD 6 cm, AD 3 cm, ∠D 70°) becomes, when B is dragged, the
storyboard's parallelogram: AB = CD = 6 cm, AD = BC = 3 cm, ∠A = ∠C = 110°, ∠B = ∠D = 70°, all measured live.

## How it plays (as Fishing Frenzy's lesson)

- **Swiftee** plays Fishing Frenzy's sprite sheets (`swiftee-assets/`, `js/swiftee.js`): each expression's loop, with a
  short cross-fade between them, and her beak moving only while her voice plays. She wears the yellow dive mask and
  snorkel on every frame (`js/dive-mask.js`, registered to her eyes by `js/mask-anchors.js`, composited by
  `js/costume.js`, with a raised wing redrawn over it: `js/scarf-occlusion.js`). She dives into the card with a trail of
  bubbles and a landing puff, and dives back wherever she returns after screens without her (the measuring walk, the
  goodbye); she speaks once she has landed. On screen 14 she walks onto the shape and measures each side with her tape
  (`js/walker.js`).
- **The narration plate.** On screens without Swiftee her line is the navy plate across the top of the card, key words
  in gold. The whole line sits on one line, each word popping in as the voice reaches it (as the game's own plate); the
  plate fits its line, measured on a hidden copy in its own type (`plateFit`, `CONFIG.plateMaxW`), and a line too long
  for the card is set smaller. A question comes back, shown not said, after a tip.
- **A lit side.** A side a line lights (a cue's `glow`) glows gold in its own colour with a soft light running along
  it, end to end, while it is talked about (css `.hl`); the other sides step back.
- **Dual coding.** As Swiftee says a part's name the part itself grows for a moment (`partCues` / `emphasize`): a
  side (AB, "A B", legs, bases, sides), an angle (∠A, angles: the wedges, or the corners before the angles are drawn),
  a length, a diagonal (AC, diagonals), point O, a half (AO, segments); a line's own `cues` add a glow, a name card, a
  pulse, an angle focus (`focus`: the named angles stay vivid, the others step back) or the sum card lifting (`hiEq`).
  While one card is lifted the others step back (`.chip.lo`); in the summary the albums step back while an idea is
  explained. Words appear as the clip's playhead reaches them (`vo_lines.js`), so every cue lands on its word.
- **One place for the shape.** Every screen keeps the same lane under the shape (two rows of name tags), so the shape
  has one centre and one size from screen to screen whatever comes and goes under it (`sceneFit`); only a block
  taller than the lane pulls it up, and the measuring screens and the first put it right of Swiftee.
- **The maths in motion** (`js/motion.js` fx, on an overlay over the board; a line's `cues`): equal sides slide onto
  each other (`match`), equal angles fly to the opposite corner turning a half-turn and fit (`matchAng`), the diagonals'
  halves fold about O onto each other (`fold`), parallel sides run out as dashed rails that never meet (`rails`); a
  checkpoint answered right pops a star over the shape. Screen 1's shape is drawn once by the pen and stays: no
  screen rebuilds it. The yellow marker pen redraws a side only when a cue lights it; a side a word names just grows.
- **The voice** (`docs/VOICEOVER.md`): every line is a recorded clip in Swiftee's studio voice; words appear as the
  clip's own playhead reaches them, and each clip starts just before its first word. One voice: while the recordings are
  on, a line whose clip cannot play shows silently, and the journey never uses the device's speech voice.
- **The named side**: a sunflower-yellow marker redraws it, a glowing pen tip running along it, while the other sides
  step back; named angles and corners grow. Parallel arrows, equal ticks and name tags arrive on their words.
- **Checks**: answers appear once the question has been asked; a wrong answer shakes with a tip and can be tried again;
  a right one turns green with the correct sound and confetti. A checkpoint counts if it was right first time.
- **Idle**: the hand shows what to tap or drag after 8 s with no touch; an instruction is said once, never again (as in Fishing Frenzy)
  (at most 3 times).

## Folder

```
index.html              the page and the lesson's markup (a template: {{bindings}} are filled by the engine)
css/stage.css, game.css the stage fit and every style of the lesson
js/
  vendor/               dc-runtime.js (template runtime, bundles React) and gsap.min.js
  config.js             tuning: shapes, limits, timings, sounds, Swiftee's reactions
  lesson-data.js        every screen as data, in play order (the comment at its top lists every option)
  game-engine.js        the lesson: narration, flow, geometry, drags, checks, values for the markup, the journey hooks
  motion.js             the GSAP animations a screen plays (cleared on every screen change)
  summary.js            screen 52: the summary bubbles (a port of Fishing Frenzy's)
  opening.js            the seashell, the pearl's bubble and the card, on the lake. In the journey the lake is the
                        fishing game's own, live under this see-through page (water.js passes the camera to it);
                        on its own page (?solo) water.js draws the same lake (lake-data.js, water-gl.js)
  card-life.js          the card lives, as the game's lake does: light beams, surface ripples, rising bubbles, swaying
                        seaweed and glints on the sand, drawn over the card (canvas.card-life) and moving with it
  swiftee.js, swiftee-manifest.js, walker.js    Swiftee and her measuring walk
  costume.js, dive-mask.js, mask-anchors.js, scarf-occlusion.js    her diving mask
  voice.js, vo_lines.js the voice-over player and its generated line -> clip map
  sfx.js, confetti.js, stage-fit.js
assets/                 images, the correct / incorrect sounds, vo/ (118 Ogg Opus clips)
swiftee-assets/         Swiftee's sprite sheets (the expressions the lesson plays)
docs/VOICEOVER.md       how the voice-over is made and played
tools/                  vo_build.js + vo_script.json (the voice-over)
VO_GENERATION_PROMPT.md the prompt used to voice the lines in the studio
```

## Editing

- **Words, cues, tasks, questions, feedback**: `js/lesson-data.js`. A line's text is also its clip's key, so a changed
  line needs a new recording (`docs/VOICEOVER.md`).
- **Timings, limits, the plate's parts, Swiftee's default reactions**: `js/config.js`
- **Swiftee's expression on a line**: the line's `m` in `js/lesson-data.js`
- **Colours, sizes, CSS animations**: `css/game.css`; scripted animations: `js/motion.js`
- **Where things sit**: `index.html` (inside `<x-dc>`); the shape's size and place on the card: `sceneFit` in the engine

## Tests

`python3 tests/lesson.py [chromium|webkit] [WxH] [touch]` (from the repository's root) plays the whole lesson in a real
browser with real taps and drags: a wrong answer first on every question, then the right one; the drag, the diagonals,
the answer boxes and the segment pairs; the score card; no Back, Next or screen list; no console error. Needs Python
Playwright.

## Limits

- Fonts (Baloo 2, Fredoka, Nunito, and Noto Sans Math for ∥ and ∠) load from Google Fonts.
- The voice-over is Ogg Opus (current Safari and iPadOS play it; WebKit 26.4 does in the tests). A browser that cannot
  play it shows the words silently in the journey, and uses the device's speech voice on the lesson's own page.
