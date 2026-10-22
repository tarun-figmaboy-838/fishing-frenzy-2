// =====================================================================
// CONFIG — tuning values for the board, snapping, pacing and limits.
// =====================================================================
const CONFIG = {
  pxPerCm: 60,                       // board scale: 1 cm = 60 board px
  // shape palette (Fishing Frenzy's lesson look: bright blue lines, an ice-white fill, teal legs once the parallel pair is
  // found). line = every side and corner ring; slate = the trapezium's legs once its parallel pair is found; pair2 = the
  // second parallel pair (AD, BC) once both pairs are marked, so the two pairs read apart; hl / hlRing = the gold of a
  // named corner's ring; ink = dark navy for marks on the lines and card text; panel = the cards' face. vA..vD = each
  // corner's own colour (its angle arc, its half of a diagonal); once opposite angles / halves are shown equal, A and C
  // share vA and B and D share vB. Applied on load as CSS variables (--pg-line, --pg-fill, --pg-vA ...) for css/game.css.
  palette: { pair2: '#7C3AED', line: '#1E7BFF', slate: '#00B8A9', fill: '#E4FBFF', dot: '#1E7BFF', hl: '#FFD43B', hlRing: '#FFB800', ink: '#123B63', panel: '#FFF8EC',
    vA: '#e11d48', vB: '#7c3aed', vC: '#0284c7', vD: '#059669' },
  // opening shape: the storyboard's symmetric trapezium (pages 1-8): CD 6 cm, both legs 3 cm, base angles 70°, centred in
  // the panel. Dragging B until BC ∥ AD makes the parallelogram of the storyboard: AB = CD = 6 cm, AD = BC = 3 cm,
  // ∠A = ∠C = 110°, ∠B = ∠D = 70°
  start: { D: 40, C: 400, baseY: 322, height: 180 * Math.sin(70 * Math.PI / 180), legAD: 3, legBC: 3 },
  // dragging B keeps the shape readable: the top side at least minTop long, B within maxLegRun of C and left of maxTopX
  limits: { minTop: 90, maxLegRun: 243, maxTopX: 496 },
  // side markings (board px, scaled with the shape): parallel chevrons - half depth, half width, spacing between two;
  // equal-length ticks - half length, spacing; gap = how far each kind sits from the midpoint when a side has both;
  // labelGap = a length label's distance from its side
  marks: { arrowDepth: 6, arrowWing: 7.5, arrowStep: 8, tickHalf: 8, tickStep: 5.5, gap: 18, labelGap: 17 },
  // dropdown answers: one option's height, the menu's narrowest width, the lowest it may reach (stage px), close and
  // wrong-answer display times (ms)
  dropdown: { itemH: 46, minW: 120, maxBottom: 706, closeMs: 180, wrongMs: 1000 },
  snap: { parallelPx: 16 },          // B let go this close to its place snaps into the parallelogram
  // recorded sound effects (others are synthesised): 'good' = every correct action (with the confetti), 'bad' = every wrong one
  sounds: { good: 'assets/audio/correct.mp3', bad: 'assets/audio/incorrect.mp3' },
  soundVolume: 0.9,
  // a part named in the voice-over grows (CSS .emph, ~0.3 s in / 0.3 s out) and holds this long before easing back
  emph: { holdMs: 650 },
  // screen 1 build: the pen starts with the voice and takes ofLine of the spoken line (minMs..maxMs), so the outline
  // closes as Swiftee finishes and the fill fades in on her last word; delayMs + 2.5 s = start anyway if no voice
  // begins; rushMs = how fast it closes if the voice ends early; settleMs = the outline's glow
  // (the side numbers' and the assembly's own timings live with their GSAP timelines in js/motion.js)
  build: { pxPerMs: 0.36, delayMs: 450, settleMs: 1300, ofLine: 0.85, minMs: 1600, maxMs: 3600, rushMs: 450 },
  // idle hints: after idleMs with nothing done, Swiftee says the screen's idle line (at most idleMaxHints times)
  timing: { idleMs: 9000, idleMaxHints: 3 },
  // flow: a finished screen moves on advanceMs after its last line (voice-over) ends (explanation screens by themselves; a
  // question or task waits for the learner, then moves on after its feedback). In the journey, the lesson hands over to
  // the fishing handOffMs after Swiftee's goodbye.
  flow: { advanceMs: 1600, handOffMs: 1800 },
  // the narration plate: a line longer than maxChars is shown in parts, none shorter than minChars (lineParts)
  plate: { maxChars: 50, minChars: 12 },
  // the supplementary-angle demo: the copied angle slides from its own corner onto the shared side (CSS .supp)
  supp: { stepMs: 2600 },
  // the card (game-engine sceneFit / belowH / optRow): every screen stacks the shape and what sits under it, centred on it
  card: {
    scale: 1.67,                     // the shape's one size on every screen (board px -> stage px; the first screens' size)
    top: 96, topChips: 148, bottom: 682, // the stack's room: under the question plate (or under tags above the shape) to the sand
    maxW: 1160, introCx: 770, introW: 760, measureCx: 728, measureW: 940, // widths; screen 1 and the measuring walk sit right of Swiftee
    padX: 40, padTop: 34, padBottom: 34, lenPadX: 30, lenPadY: 26, // room round the shape for letters / lengths (board px)
    optGap: 16, optH: 74, optWrapH: 48, optGapX: 12, fillH: 56, tileH: 52, // answers under the shape (stage px)
    chipGap: 8, chipLane: 70, rowsH: 135, chipTopQ: 92, // name tags: gap, one row, two rows, tags above the shape
    optW: 620, pillPad: 40, pillPadLong: 28, pillMin: 200, rowMax: 1040 }, // answer pills (see optRow)
  board: { x: 640, y: 104 },         // the board's top-left on the stage
  // screen 14's measuring walk: her size on the shape, her spot on the sand (feet) and size there, her walking pace,
  // ms per cm along a side, the pause on each corner, the wait before she sets off and after she is home again
  walker: { size: 110, homeX: 244, homeY: 639, homeSize: 259, strollPxPerMs: 0.42, msPerCm: 380, pauseMs: 550, startMs: 850, homeMs: 850,
    tips: [[488, 272], [484, 281], [494, 273], [489, 270], [486, 278], [483, 279], [491, 281], [489, 281]] }, // tape exit per walk frame (@2x cell px)
  hand: { idleMs: 8000, showMs: 4400, maxShows: 4, // hand nudge: wait with no touch, time on screen, showings per step
    onceDelayMs: 500, onceMs: 2300 },                 // handOnce screens: a single demo gesture this long after the line ends
  stars: [[8, 3], [5, 2], [0, 1]],   // [checkpoint challenges right on the first try >=, stars] (9 challenges)
  // Swiftee's expressions (states in js/swiftee-manifest.js). A narration line's own m wins; these cover reactions and
  // the pose held between lines.
  swiftee: {
    base: 'swiftee-assets/',
    talk: 'talking',       // default while a line is spoken
    idle: 'blinking',      // between lines and while the learner works on a task
    waiting: 'thinking',   // a check question is open: thinking time
    praise: 'happy',       // a task is completed
    correct: 'celebrating',// a check is answered correctly
    wrong: 'confused',     // a wrong answer or tap: encouraging, never punishing
    nudge: 'curious',      // idle hint
    done: 'happy',         // the lesson-complete screen, after the closing line
    reactMs: 1600,         // how long the line's expression shows after speaking (lip-sync talks during the voice)
    minHoldMs: 900
  }
};
