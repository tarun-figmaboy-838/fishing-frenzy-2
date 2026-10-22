# Parallelogram — interactive lesson

One continuous, playable lesson: Swiftee turns a trapezium into a parallelogram, then explores its sides, angles and
diagonals, followed by five checks (CFUs) and a score screen. Lengths and angles are measured live from the shape.

## Folder structure

```
Parallalogram main/
├── index.html          the game: open this (double-click, or Live Server)
├── assets/             images, audio, screen-list thumbnails
├── css/                stage.css (page shell) · game.css (game styles)
├── js/                 config.js · lesson-data.js (all lesson content) · game-engine.js · motion.js · swiftee.js · walker.js · vendor/
├── swiftee-assets/     Swiftee sprite sheets + manifest
├── dev/                not needed to play
│   ├── README.md           this file
│   ├── qa/                 automated tests
│   ├── tools/              thumbnail / sprite-manifest builders
│   ├── canvas-source/      single-file copy for a Claude Design canvas (still the trapezium version)
│   └── backup-trapezium/   the original trapezium lesson files
└── source-files/       loose source images and sounds (not used by the game)
```

To ship or host the game, upload index.html with assets/, css/, js/ and swiftee-assets/.

Script load order (in `index.html`): `dc-runtime.js` → `gsap.min.js` → `config.js` → `lesson-data.js` → `swiftee-manifest.js` → `swiftee.js` → `walker.js` → `motion.js` → `game-engine.js`,
then `stage-fit.js` at the end of the body.

## Run it

| How | Steps |
|---|---|
| Open from disk | Double-click `index.html` (works offline; fonts need internet, otherwise system fonts are used). |
| Local server | `python3 -m http.server 8765` in the game folder (where index.html is), then open `http://localhost:8765/`. |
| Host on the web | Upload the folder as-is: static files only, no build step. |

Stage: 1920 × 1080 (16:9), letterboxed to any window: desktop, laptop, tablet landscape.
Mouse, touch and pen all work.

## Editing

- **Words, lines, hints, feedback, CFU answers** → `js/lesson-data.js`
- **Snapping, drag limits, pacing, idle hints, stars** → `js/config.js`
- **Shape colours** (sides, fill, highlighter band / bead / rings) → `CONFIG.palette` in `js/config.js`
- **Swiftee's expression on a line** → the line's `m` in `js/lesson-data.js` (default `talking`)
- **Swiftee's reactions** (idle, thinking time, praise, correct, wrong, idle hint, end) → `CONFIG.swiftee` in `js/config.js`
- **Colours, sizes, animations** → `css/game.css`
- **Layout / positions of screen elements** → `index.html` (inside `<x-dc>`)
- **Behaviour** → `js/game-engine.js` (sections: timers · audio · narration · idle hints · flow · ruler ·
  geometry · lesson interactions · CFU · render)

`LESSON` step fields: `lines` (`t` text, `s` spoken text, `chips`), `task` (extLegs, extBases, tapBases, tapLegs,
measure, dragB, tapAngles, dragD90, tapAD, dragD, dragC), `hint`, `idle`, `after`, `autoNext`,
`f` display flags, and for checks `cfu`, `opts` (`ok` / `fb`), `ok`.

## Lesson state map (storyboard "Parallelogram_Pages_5_to_56", PDF pages 1–52 → 59 screens)

Every screen carries its storyboard page as `pdf` in `js/lesson-data.js`. A question and its "That's correct!" page
are one screen (the feedback is that screen's finished state); each checkpoint page is three challenge screens.
The original trapezium files are kept in `dev/backup-trapezium/`.

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
| 52–58 | 51–52 | animated recall on the same parallelogram: definition, parallel, equal sides, equal angles, supplementary, bisect |
| 59 | — | stars (first-try score over the 9 checkpoint challenges), Play again |

Geometry: 1 cm = 60 board px. The opening trapezium (CD 6 cm, AD 3 cm, ∠D 70°) becomes, when B is dragged, the
storyboard's parallelogram: AB = CD = 6 cm, AD = BC = 3 cm, ∠A = ∠C = 110°, ∠B = ∠D = 70° — all measured live.

Interaction rules: answers, corners and tiles are locked (dimmed) while Swiftee gives the instructions; Next stays
locked until a question or task is finished; wrong answers wobble orange with a tip and can be retried; no tick
icons are used anywhere (right answers turn green, with the correct sound and confetti).

Voice-over: every line is recorded (118 clips, Hindi-accented English, Ogg Opus in `assets/vo/`, 2.4 MB) - see
**[dev/VOICEOVER.md](VOICEOVER.md)** for how the clips were made, how the game plays them and how to remake one. Where a clip
cannot play (older Safari / iPad, `?vo=0`) the device's built-in voice speaks the line instead. Browsers allow audio only
after the first tap, so on a fresh load screen 1 may type without its voice; the first tap anywhere unlocks it.
(`dev/vo-manifest.csv` / `build-vo-manifest.js` are the older pre-recording list, superseded by `dev/tools/vo_script.json`.)

## Behaviour notes

- **Narration** plays the recorded clip for each line (`js/voice.js`); without one it uses the device's built-in speech
  voice, and with neither, words still reveal on a timer.
  On-screen words follow the voice's word events, at most one word ahead. Mute and replay are top right / on the bubble.
- **Geometry rules**: the bases stay parallel (corners only slide sideways); the shape cannot cross itself,
  a base cannot collapse, and angles stay between about 35° and 145°. The pair sums shown are always exactly 180°.
- **Locks**: Next unlocks only when the task is done; Next/Back ignore double taps; drags, the ruler and
  the CFU 4 check lock while they animate; idle hints (after 9 s, at most 3) never interrupt a drag.
- **Score**: a check counts only if it was right on the first try.

## QA (all passing on this build)

Requires Node 18+ and Playwright (`npm i -D playwright`). Start `python3 -m http.server 8765` in the game folder (where index.html is) first.

```
node dev/qa/logic-test.js                          # headless: plays every state and CFU through the engine
node dev/qa/playthrough.js mouse fake 1920x1080    # real browser playthrough + layout audit + console check
node dev/qa/playthrough.js touch none 1024x768     # input: mouse|touch · speech: fake|none|native · any WxH
python3 dev/qa/make-debug.py && node dev/qa/geometry-sweep.js   # drags every corner through its whole range, checks collisions
```

Verified at 1920×1080, 1440×810, 1366×768, 1280×720, 1180×820 (touch) and 1024×768 (touch):
61 checks per playthrough (59 without the simulated voice), layout audit clean, geometry sweep clean,
no console errors or warnings. Screenshots and reports go to `qa-shots/`.

## QA (all passing on this build)

Requires Node 18+ and Playwright (`npm i -D playwright`). Start `python3 -m http.server 8765` in the game folder (where index.html is) first.

```
node dev/qa/logic-test.js
node dev/qa/playthrough.js mouse fake 1920x1080     # input: mouse|touch · speech: fake|none|native · any WxH
python3 dev/qa/make-debug.py && node dev/qa/geometry-sweep.js
```

## Known limits

- Fonts (Baloo 2, Nunito) load from Google Fonts; offline, system fonts are used and the layout still fits.
- Voice quality depends on the device's installed voices.
- `js/vendor/dc-runtime.js` bundles React; the game's own code (config, lesson data, engine) is plain JavaScript.

## Swiftee

Swiftee reacts to what is being said. Each narration line can name an expression (`m`); everything else comes from `CONFIG.swiftee`:

| Moment | Expression |
|---|---|
| Greeting | `waving` |
| Explaining | `talking` |
| Asking the learner to do something, asking a check question | `curious` |
| Wondering aloud ("What happens if we add…?"), check question open | `thinking` |
| A discovery ("Woah! The sides meet.", "They do not meet.") | `surprised` |
| Task done, praise | `happy` |
| Check answered correctly, lesson complete | `celebrating` |
| Wrong answer or tap | `confused` (encouraging) |
| Idle hint | `curious` |
| Nobody talking | `blinking` |

Every expression plays its start once, loops, then plays its stop before the next one, so changes never jump.
An expression stays at least `minHoldMs` and about as long as the line takes to read, even with the sound off.
Sheets load from `swiftee-assets/` (@2x only when Swiftee is drawn larger than 300 device pixels), and
`prefers-reduced-motion` shows still poses. If the sheets can't load, the still image stays.
After replacing the sheets, run `node dev/tools/build-swiftee-manifest.js`.

`canvas-source/Main.dc.html` keeps the still Swiftee: the canvas copy can't load the sprite sheets.

## Hand nudge

When a tap or drag is expected and nothing is touched for `CONFIG.hand.idleMs` (8 s) after Swiftee stops talking,
a hand (`assets/images/hand-nudge.webp`) shows exactly where: the next side or corner to tap, the point to drag
(sliding the way that reaches the goal), or the Next button once a step is finished. A soft ring pulses from the
fingertip on each press. Any touch hides it; it returns only if the learner is idle again (at most
`CONFIG.hand.maxShows` times per step). On checks it never points at an answer: the open options glow together,
and on the labelling check it only presses a label. Targets are read from the page (`data-qa`), so the hand
stays on target if the layout changes.

## Spotlight layout (not used in the lesson)

`layout: 'spotlight'` on a step centres and enlarges the shape with a soft glow and moves Swiftee (mirrored, `pose`) to the
right. It was removed from the flow after "Woah! The sides meet." but is kept for reuse; position and size are `CONFIG.spotlight`.

## Focus screen

"Let's extend them." is its own instruction-only screen (`extendSay`: `autoAdvance`, `locked`: no Next, no Back) that moves on
as soon as the voice-over ends. The tapping screen that follows (`extend`, `layout: 'focus'`, no line of its own) opens with that
bubble fading out while the shape glides to centre stage. Back skips over screens that move on by themselves. The two sides to tap carry a pulsing yellow band (off once tapped); after 5 s with no
touch the hand presses the next side. Whenever Swiftee speaks again on this screen ("Woah! The sides meet.", a wrong-tap tip) the shape
steps back to make room for the bubble, then returns to centre when it fades. Spoken idle reminders are skipped here: the
hand guides instead. Timings and position: `CONFIG.focus` in `js/config.js`.

## Screen flow (no Next button)

There is no Next button for now (`CONFIG.flow.showNext: false` in `js/config.js` brings it back). A finished screen moves on
by itself `CONFIG.flow.advanceMs` (2.5 s) after its last line and voice-over end:

- narration screens: 2.5 s after Swiftee finishes;
- tasks: once done, after the praise line ("Woah! The sides meet.", "Perfect!") + 2.5 s;
- checks: after the correct answer and Swiftee's explanation + 2.5 s (a wrong answer never moves on);
- "Let's extend them." (`autoAdvance: 1`): immediately; a step's `autoAdvance` (ms) overrides the wait;
- lesson complete: stays (Play again).

If Swiftee starts talking again before the move (a tip, a hint), the wait restarts when that line ends. There is no Back button
either (`CONFIG.flow.showBack`); when shown, it skips instruction-only (`locked`) screens. The hand nudge only points at Next when the button is shown.

## Top navigation

Every screen has **Back** and **Next** in the top-right corner (`.topnav` in `index.html`, `.navbtn` in `css/game.css`), alongside
the automatic move-on. Back is greyed out on the first screen and skips instruction-only (`locked`) screens; Next is greyed out
on Lesson complete. Next works even before a task is done; skipping an unfinished drag task applies its result first (equal
legs, a right angle at A), so the screens after it still match the shape (`navNext()` in `js/game-engine.js`).

## Screen list

**Screens · N** (top-left) opens a panel of snapshots of every screen; tap one to open that screen directly (the shape is
rebuilt as if the earlier screens were done, see `jumpTo()`). The lesson does not move on while the panel is open.
Snapshots live in `assets/thumbs/NN.webp`; after changing screens run `node dev/tools/build-thumbs.js` (needs Chrome or Edge).

## Lip-sync and word timing

The voice is the clock for every line (`say()` in `js/game-engine.js`). With a recorded clip, each word appears at its share of
the clip's length (see dev/VOICEOVER.md); with the device voice, as below. Nothing shows until the voice starts; Swiftee switches to her
`talking` animation at that instant (`SwifteeMascot.talk()`), moves her beak only while the voice speaks, closes it when it ends and
then shows the line's expression (`m`) for `CONFIG.swiftee.reactMs`. Each word appears when the voice reaches it: word-boundary
events are mapped to exact word offsets in the spoken text. Voices without boundary events use a paced reveal that starts with the
voice and learns its real speed after each line (`paceK`). With no voice at all, words and beak run on the paced timing.

## Measuring trip (screen 13)

Automatic (`auto: 1` on the step): after "Let's measure the sides of this trapezium." Swiftee flies onto corner A (`flapping`, shrinking
to `CONFIG.walker.size`) and measures A → B → C → D → A by herself. On each side she walks with her feet on the line (`measuring`), pulling a
tape out of the tape measure in her hand: the tape is anchored at the side's first corner, lies just outside the side with half-cm ticks and
cm numbers, and rises into her hand (exact per-frame hand points: `CONFIG.walker.tips`). The length label appears at the corner, the tape
stays laid out until the next side starts, and after the fourth side she flies home and the screen moves on. Code: `js/walker.js`,
`autoMeasure()` / `measureLeg()` in `js/game-engine.js`; timings in `CONFIG.walker`. The walk sheet comes from the draft
`swiftee-assets/source/drafts/swiftee-measuring-draft.png` via `node dev/tools/build-measuring-sheet.js <png> 4 2` + `node dev/tools/build-swiftee-manifest.js`.

## Water background (all screens)

One shared Canvas 2D layer (`canvas.water-bg` in `index.html`, drawn by `js/water.js`) sits behind every screen; it
replaced the winter picture and the snowfall (`js/snowfall.js` is no longer loaded). It shows
`assets/water background theme.png`, fitted to the stage by height so the water line is exactly where it is in the
painting (about 23 px of its width falls beyond each side of the 16:9 stage).

- **Water**: the painting is scaled once into an offscreen canvas; each frame copies it 1:1 and redraws only the water
  surface band and the underwater area in thin rows, each nudged sideways on two slow sine waves (the painted ripples
  and light lines refract; sky, mountains and shoreline never move). Soft light shafts breathe and drift, a few glints
  sparkle on the surface, and bubbles rise from the bubble spots in the painting.
- **Grass**: `node dev/tools/build-water.js` cuts the grass tufts out of the painting (green-led pixels on the sea
  floor) into `assets/images/water-grass-N.png`, fills the water in behind them (`assets/images/water-bg.webp`) and
  writes `js/water-manifest.js`. Each tuft is drawn in thin slices and rows that bend more toward the tip, so the base
  stays planted and neighbouring blades sway slightly out of step. Re-run the tool after changing the painting.
- **Behaviour**: one `requestAnimationFrame` loop for the whole session (screen changes never restart it); time only
  runs while frames are drawn, so a hidden tab resumes smoothly; on a slow device it draws every other frame; still for
  `prefers-reduced-motion` and in thumbnail captures. Measured: 60 fps in headless Chrome (software rendering).
