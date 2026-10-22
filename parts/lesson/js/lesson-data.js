// =====================================================================
// LESSON — every screen of the Parallelogram storyboard (PDF pages 1–52), in play order.
// `pdf` on each step is the storyboard page it implements (feedback pages are the finished state of their question).
//
//   lines: narration (t = on-screen text, \n = line break in the bubble, s = optional spoken text;
//          keep: 1 + s = voice only, the bubble keeps the previous line;
//          glow = sides drawn bolder while the line is spoken, e.g. ['AB', 'CD']; glowAt: 'word' = wait for that word;
//          pulse: 1 + pulseAt = the shape zooms once on that word; growAt = the shape comes forward on that word;
//          cues = board moments on a spoken word: [{ at: 'word', glow: [sides] | null, hi: card text, chip, pulse, ms }];
//          chips = cards shown with the line; m = Swiftee's expression (default talking; reactions in CONFIG.swiftee)
//          holdM: 1 = Swiftee keeps the m pose while she speaks (e.g. waves hello) instead of the talking loop
//   skin:  'intro' = the opening look (storyboard pages 1-8): white bubble, light-blue shape with a thin blue outline
//   task:  dragB  = drag B until BC ∥ AD (the trapezium becomes a parallelogram; snaps when close)
//          measure (+auto) = Swiftee walks every side with her tape measure
//          tapEq  = tap the corner whose angle equals ∠ref (want = the right corner, wrong = tip for a wrong tap)
//          connect = draw both diagonals: drag (or tap, tap) from a corner to the opposite corner
//   opts:  answer buttons (ok = right; fb = tip for a wrong one; soloOk: 1 = once right, only the right answer stays,
//          centred; okGlow: [[sides], ...] = side pairs pulse in turn after it; calmOk: 1 = no confetti). multi: 1 = select every right answer
//          (req: false = right but not needed to finish). grid: 1 = the four-shape picture grid
//   fill:  blanks to fill with number tiles: blanks [{ id, pre, post, ans }], tiles [...] (drag a tile onto a blank,
//          or tap a tile to fill the highlighted blank). match: 1 = each tile once, blanks checked as pairs (pairs)
//   cp:    checkpoint challenge (scored: right on the first try), cpTitle = its heading on the board
//   fig:   the checkpoint's own drawing on the board: P (corners), sides / angles / halves labels ('?' = unknown),
//          diag = draw the diagonals
//   f:     board display flags: noLetters, par (arrows on AB, CD), par2 (arrows on AD, BC), sideLen / legLen (lengths),
//          lenSeq (lengths appear pair by pair: AB + CD, then AD + BC), ticks (equal-side marks), arcs (angle arcs),
//          pairCol (equal angles share a colour), eq: 'AD' (live ∠A + ∠D card), supp (supplementary demo pairs, in turn),
//          diag, O, split (diagonal halves in four colours), halfPairs (equal halves share a colour), hticks, halves (cards)
//   flow:  explanation screens move on by themselves (CONFIG.flow.advanceMs after the voice); questions wait for the
//          learner; autoNext (ms) = move on this soon after the last line (recall sequence)
// =====================================================================
const PG = { par: 1, par2: 1 };                       // both pairs of sides marked parallel
const LENS = { sideLen: 1, legLen: 1 };               // all four side lengths (measured from the shape)
const DIAG = { diag: 1, O: 1 };                       // the two diagonals and their meeting point O
const PRACTICE = { practice: 1, optTop: 486, chipTop: 88, boardShiftY: -16 };
// checkpoint figures (board coordinates; the board's top-left is stage 651,104)
const deg = Math.PI / 180;
const tilt = (a) => ({ A: { x: 90, y: 112 }, B: { x: 390, y: 112 },
  C: { x: 390 + 170 * Math.cos(a * deg), y: 112 + 170 * Math.sin(a * deg) }, D: { x: 90 + 170 * Math.cos(a * deg), y: 112 + 170 * Math.sin(a * deg) } });
const FIG_SIDES = { A: { x: 150, y: 112 }, B: { x: 440, y: 112 }, C: { x: 380, y: 282 }, D: { x: 90, y: 282 } };
const CP = { cp: 1, optTop: 488 };
// checkpoints with answer boxes and number tiles (two rows, ~124 px): start higher so the tiles stay inside the panel
const FILL_CP = { optTop: 440, boardShiftY: -24 };

const LESSON = {
  steps: [
    // ---------- Part 1 · quadrilateral -> trapezium -> parallelogram (pages 1-11) ----------
    // the outline draws itself while Swiftee says the line and closes on her last word; the plain shape, as on page 1
    // (she waves hello as she speaks)
    { pdf: 1, id: 'intro', build: 1, skin: 'intro', lines: [{ m: 'waving', holdM: 1, t: 'We learnt about quadrilaterals\nearlier.' }], f: { noLetters: 1, noDots: 1 } },
    { pdf: 2, id: 'quadSides', sideNums: 1, skin: 'intro', lines: [{ m: 'happy', t: 'Any polygon with 4 sides is\ncalled a quadrilateral.' }], f: { noLetters: 1, noDots: 1 } },
    // screens 3-4: the name caption is a word cue, as on screen 10 - "Trapezium" pops in exactly as Swiftee says it and
    // the outline glows once. Screen 4 never lights up AB/CD on "parallel": screen 5 asks which pair is parallel.
    { pdf: 3, id: 'special', assemble: 1, voiceDelay: 3000, skin: 'intro', lines: [{ m: 'happy', t: 'This is a special type of\nquadrilateral called Trapezium.', growAt: 'special',
      cues: [{ at: 'trapezium', chip: { t: 'Trapezium', k: 'name' }, glow: ['AB', 'BC', 'CD', 'DA'], ms: 1300 }] }], f: { noLetters: 1, noDots: 1 } },
    { pdf: 4, id: 'onePair', skin: 'intro', lines: [{ t: 'A trapezium has one pair of\nopposite sides parallel.',
      cues: [{ at: 'trapezium', chip: { t: 'Trapezium', k: 'name' }, glow: ['AB', 'BC', 'CD', 'DA'], pulse: 1, ms: 1300 }] }], f: { noLetters: 1, noDots: 1 } },
    Object.assign({ pdf: '5-6', id: 'askPar', skin: 'intro', lines: [{ m: 'curious', t: 'Which pair of sides are\nparallel to each other?' }],
      // right answer: AD ∥ BC folds away and AB ∥ CD settles alone in the centre, green (storyboard page 6)
      ok: "That's correct! AB ∥ CD.", soloOk: 1, okF: { par: 1 }, f: { noDots: 1 },
      opts: [
        { id: 'AB', t: 'AB ∥ CD', ok: true },
        { id: 'AD', t: 'AD ∥ BC', fb: 'Look again. AD and BC lean towards each other, so they would meet if we made them longer.' }
      ] }, PRACTICE),
    { pdf: 7, id: 'whatIf', skin: 'intro', lines: [{ m: 'thinking', t: 'What if we made the other pair\nof opposite sides parallel too?', glow: ['DA', 'BC'] }], f: { par: 1, noDots: 1 } },
    // one demo hand once the instruction ends, then the learner drags B; BC ∥ AD snaps it into a parallelogram
    { pdf: 8, id: 'dragPar', skin: 'intro', lines: [{ m: 'curious', t: 'Drag vertex B to make\nBC parallel to AD.' }],
      task: 'dragB', handOnce: 1, hint: 'Drag point B along the top side', idle: 'Drag B to the right until BC leans the same way as AD.',
      after: [{ m: 'happy', t: 'Well done! Now BC is\nparallel to AD.' }], f: { par: 1, noDots: 1 } },
    { pdf: 9, id: 'bothPar', lines: [
      { m: 'surprised', t: 'Now both pairs of opposite\nsides are parallel.', glow: ['AB', 'CD'], chips: [{ t: 'AB ∥ CD', k: 'white' }] },
      { keep: 1, s: 'A D is parallel to B C.', glow: ['DA', 'BC'], chips: [{ t: 'AD ∥ BC', k: 'white' }] }], f: PG },
    // screen 9 (storyboard page 10): the cards come in under the shape with the voice, as on screen 10 - "We": AB ∥ CD
    // pops in as AB and CD glow; "this": AD ∥ BC as AD and BC glow (the shape she points at); "Parallelogram": the
    // name lands on its own row below the pair, the whole outline glows once and the shape pulses
    { pdf: 10, id: 'defPg', chipRows: 1, boardShiftY: -48, chipTop: 428,
      lines: [{ t: 'We call this a Parallelogram.', cues: [
        { at: 'we', chip: { t: 'AB ∥ CD', k: 'white' }, glow: ['AB', 'CD'], hi: 'AB ∥ CD' },
        { at: 'this', chip: { t: 'AD ∥ BC', k: 'white' }, glow: ['DA', 'BC'], hi: 'AD ∥ BC' },
        { at: 'parallelogram', chip: { t: 'Parallelogram', k: 'name' }, glow: ['AB', 'BC', 'CD', 'DA'], pulse: 1, ms: 1300 }] }], f: PG },
    // screen 10 (storyboard page 11): the shape scales up, then letters, arrows and the two pair cards; as Swiftee
    // says it, AB + CD glow with their card, then AD + BC with theirs; "parallelogram" pops the name card in on its
    // own row and the whole outline glows once
    { pdf: 11, id: 'defFull', enterGrow: 1, chipRows: 1, boardShiftY: -48, chipTop: 428,
      enterChips: [{ t: 'AB ∥ CD', k: 'white' }, { t: 'AD ∥ BC', k: 'white' }],
      lines: [{ t: 'A quadrilateral where both pairs\nof opposite sides are parallel is\ncalled a parallelogram.', cues: [
        { at: 'pairs', glow: ['AB', 'CD'], hi: 'AB ∥ CD' },
        { at: 'sides', glow: ['DA', 'BC'], hi: 'AD ∥ BC' },
        { at: 'called', glow: null },
        { at: 'parallelogram', chip: { t: 'Parallelogram', k: 'name' }, glow: ['AB', 'BC', 'CD', 'DA'], pulse: 1, ms: 1300 }] }],
      f: PG },

    // ---------- Part 2 · opposite side lengths (pages 12-20) ----------
    { pdf: 12, id: 'lengthsQ', lines: [{ m: 'thinking', t: 'But what about the\nside lengths?' }], f: PG },
    { pdf: 13, id: 'equalQ', lines: [{ m: 'thinking', t: 'Are they equal too?' }], f: PG },
    { pdf: 14, id: 'measure', lines: [{ m: 'curious', t: "Let's measure them." }], task: 'measure', auto: 1, f: PG },
    // the lengths come in pair by pair: AB and CD (6 cm) together, then AD and BC (3 cm)
    { pdf: 15, id: 'interesting', lines: [{ m: 'surprised', t: 'There is something\ninteresting about\nthe lengths.' }],
      lenSeq: [[700, ['AB', 'CD']], [2300, ['DA', 'BC']]], f: Object.assign({ lenSeq: 1 }, PG, LENS) },
    Object.assign({ pdf: '16-17', id: 'askSides', lines: [{ m: 'curious', t: 'What do you notice\nabout the sides?' }],
      // right answer: the other option folds away, this one settles green in the centre, then AB + CD and AD + BC
      // pulse in turn; the correct sound, no confetti (storyboard page 17)
      ok: "That's correct! Opposite\nsides are equal.", soloOk: 1, calmOk: 1, okGlow: [['AB', 'CD'], ['DA', 'BC']], okF: { ticks: 1 },
      opts: [
        { id: 'all', t: 'All sides are equal', fb: 'Look at the lengths again. AB is 6 cm, but AD is only 3 cm.' },
        { id: 'opp', t: 'Opposite sides are equal', ok: true }
      ], f: LENS }, PRACTICE),
    { pdf: 18, id: 'oppEq', lines: [{ m: 'happy', t: 'In any parallelogram,\nopposite sides are of\nequal lengths.', chips: [{ t: 'AB = CD', k: 'gold' }, { t: 'AD = BC', k: 'gold' }] }],
      f: Object.assign({ ticks: 1 }, LENS) },
    { pdf: 19, id: 'soAny', lines: [{ t: 'So, in any parallelogram…', glow: ['AB', 'CD', 'DA', 'BC'],
      chips: [{ t: 'AB ∥ CD', k: 'white sm' }, { t: 'AD ∥ BC', k: 'white sm' }, { t: 'AB = CD', k: 'white sm' }, { t: 'AD = BC', k: 'white sm' }] }],
      f: Object.assign({ ticks: 1 }, PG, LENS) },
    { pdf: 20, id: 'sidesSum', lines: [{ m: 'happy', t: 'So, in any parallelogram,\nopposite sides are\nparallel and equal.',
      chips: [{ t: 'AB ∥ CD', k: 'white sm' }, { t: 'AD ∥ BC', k: 'white sm' }, { t: 'AB = CD', k: 'white sm' }, { t: 'AD = BC', k: 'white sm' }] }],
      f: Object.assign({ ticks: 1 }, PG, LENS) },

    // ---------- Checkpoint 1 · Are you ready? (page 21) ----------
    Object.assign({ pdf: 21, id: 'cp1a', grid: 1, multi: 1, cpTitle: 'Checkpoint 1 · Find the Parallelograms',
      lines: [{ m: 'curious', t: 'Which of these are\nparallelograms? Select\nall that apply.' }],
      hint: 'Tap every shape with two pairs of parallel sides', idle: 'Look for shapes where both pairs of opposite sides are parallel.',
      ok: 'Yes! Shapes A and C both have\ntwo pairs of parallel sides.',
      opts: [
        { id: 'A', ok: true },
        { id: 'B', fb: 'Shape B is a trapezium. Only one pair of its sides is parallel.' },
        { id: 'C', ok: true },
        { id: 'D', fb: 'Shape D has five sides, so it is not even a quadrilateral.' }
      ] }, CP),
    Object.assign({ pdf: 21, id: 'cp1b', cpTitle: 'Checkpoint 1 · Find the Missing Side',
      lines: [{ m: 'curious', t: 'In this parallelogram,\nAB = 7 cm. What is the\nlength of CD?' }],
      hint: 'Drag a number into the box', idle: 'CD is opposite AB. Opposite sides of a parallelogram are equal.',
      ok: "That's right! Opposite sides\nare equal, so CD = 7 cm.",
      fig: { P: FIG_SIDES, sides: { AB: '7 cm', CD: '? cm' }, ticks: 1 },
      fill: { blanks: [{ id: 'CD', pre: 'CD =', post: 'cm', ans: '7' }], tiles: ['3.5', '7', '14'],
        fb: { '3.5': 'CD is not half of AB. Opposite sides of a parallelogram are equal.', '14': 'CD is not double AB. Opposite sides of a parallelogram are equal.' } } }, CP, FILL_CP),
    Object.assign({ pdf: 21, id: 'cp1c', cpTitle: 'Checkpoint 1 · Find the Missing Sides',
      lines: [{ m: 'curious', t: 'In this parallelogram,\nAB = 8 cm and BC = 5 cm.\nFind the lengths of\nCD and AD.' }],
      hint: 'Drag a number into each box', idle: 'CD is opposite AB, and AD is opposite BC.',
      ok: 'Brilliant! CD = AB = 8 cm\nand AD = BC = 5 cm.',
      fig: { P: FIG_SIDES, sides: { AB: '8 cm', BC: '5 cm', CD: '?', DA: '?' }, ticks: 1 },
      fill: { blanks: [{ id: 'CD', pre: 'CD =', post: 'cm', ans: '8' }, { id: 'AD', pre: 'AD =', post: 'cm', ans: '5' }], tiles: ['3', '5', '8', '13'],
        fb: { any: 'Look at which side is opposite. CD is opposite AB, and AD is opposite BC.' } } }, CP, FILL_CP),

    // ---------- Part 4 · opposite angles (pages 22-31) ----------
    { pdf: 22, id: 'sidesDone', lines: [{ m: 'happy', t: 'We learnt all about the\nsides of a parallelogram.' }] },
    { pdf: 23, id: 'angles', lines: [{ m: 'thinking', t: 'But what about its angles?\nAre they equal too?' }] },
    { pdf: 24, id: 'measureAng', lines: [{ m: 'curious', t: "Let's measure the angles\nand find out." }] },
    // the four arcs and their sizes draw in one after another
    { pdf: 25, id: 'interestingAng', lines: [{ m: 'surprised', t: 'There is something\ninteresting here too.' }], f: { arcs: 'ABCD' } },
    { pdf: 26, id: 'someEq', lines: [{ t: 'Some angles are equal\nto one another.' }], f: { arcs: 'ABCD' } },
    { pdf: '27-28', id: 'tapEqA', lines: [{ m: 'curious', t: 'Tap the angle which is\nequal to ∠A.', glow: [] }], task: 'tapEq', ref: 'A', want: 'C',
      wrong: 'Not quite. Compare its size with ∠A. Look at the corner opposite A.', hint: 'Tap the corner whose angle matches ∠A',
      idle: 'Find the angle that is the same size as ∠A, and tap it.',
      after: [{ m: 'happy', t: "That's correct! ∠A is\nequal to ∠C.", chips: [{ t: '∠A = ∠C', k: 'gold' }] }], f: { arcs: 'ABCD' } },
    { pdf: '29-30', id: 'tapEqD', lines: [{ m: 'curious', t: 'Tap the angle which is\nequal to ∠D.' }], task: 'tapEq', ref: 'D', want: 'B',
      wrong: 'Not quite. Compare its size with ∠D. Look at the corner opposite D.', hint: 'Tap the corner whose angle matches ∠D',
      idle: 'Find the angle that is the same size as ∠D, and tap it.',
      after: [{ m: 'happy', t: "That's correct! ∠D is\nequal to ∠B.", chips: [{ t: '∠D = ∠B', k: 'gold' }] }], f: { arcs: 'ABCD', pairA: 1 } },
    { pdf: 31, id: 'oppAng', lines: [{ m: 'happy', t: 'So in any parallelogram,\nthe pairs of opposite\nangles are also equal.',
      chips: [{ t: '∠A = ∠C', k: 'gold' }, { t: '∠D = ∠B', k: 'gold' }] }], f: { arcs: 'ABCD', pairCol: 1 } },

    // ---------- Part 5 · adjacent angles (pages 32-36) ----------
    { pdf: 32, id: 'seeElse', lines: [{ m: 'thinking', t: 'But I see something\nelse too.' }], f: { arcs: 'ABCD' } },
    { pdf: 33, id: 'lookAD', lines: [{ m: 'curious', t: 'Look at ∠A and ∠D.' }], f: { arcs: 'AD' } },
    // ∠A slides down to D: with ∠D it fills the straight line through D (110° + 70° = 180°)
    { pdf: 34, id: 'sumAD', lines: [{ m: 'surprised', t: 'They add up to make 180°.' }], f: { arcs: 'ABCD', eq: 'AD', supp: ['AD'] } },
    Object.assign({ pdf: 35, id: 'askAdj', multi: 1, lines: [{ m: 'curious', t: 'Which other angles\nadd up to 180°?' }],
      hint: 'Tap every pair that adds up to 180°', idle: 'Add the two angles in each card. Which pairs make 180°?',
      ok: 'Yes! ∠B + ∠C = 180° and\n∠A + ∠B = 180°.', okChips: [{ t: '∠B + ∠C = 180°', k: 'gold sm' }, { t: '∠A + ∠B = 180°', k: 'gold sm' }],
      opts: [
        { id: 'BC', t: '∠B & ∠C', ok: true },
        { id: 'BD', t: '∠B & ∠D', fb: '∠B and ∠D are opposite angles. 70° + 70° is not 180°.' },
        { id: 'AB', t: '∠A & ∠B', ok: true },
        { id: 'AD', t: '∠A & ∠D', ok: true, req: false, fb: 'Yes, but we found that pair already! Find the other pairs.' }
      ], f: { arcs: 'ABCD' } }, PRACTICE, { optTop: 446, optWrap: 1, boardShiftY: -28 }),
    { pdf: 36, id: 'adjRule', lines: [{ m: 'happy', t: 'All the adjacent angles\nof this parallelogram\nadd up to 180°.',
      chips: [{ t: '∠A + ∠D = 180°', k: 'white sm' }, { t: '∠A + ∠B = 180°', k: 'white sm' }, { t: '∠B + ∠C = 180°', k: 'white sm' }, { t: '∠C + ∠D = 180°', k: 'white sm' }] }],
      f: { arcs: 'ABCD', supp: ['AD', 'AB', 'BC', 'CD'] } },

    // ---------- Checkpoint 2 · Let's use what we learnt! (page 37) ----------
    Object.assign({ pdf: 37, id: 'cp2a', cpTitle: 'Checkpoint 2 · Find the Opposite Angle',
      lines: [{ m: 'curious', t: 'In this parallelogram,\n∠A = 68°. What is the\nmeasure of ∠C?' }],
      idle: '∠C is opposite ∠A. What do you know about opposite angles?', hint: 'Tap an answer',
      ok: "That's right! Opposite angles\nare equal, so ∠C = 68°.",
      fig: { P: tilt(68), angles: { A: '68°', C: '?' } },
      opts: [
        { id: '68', t: '68°', ok: true },
        { id: '112', t: '112°', fb: '112° would add up with ∠A to 180°. But ∠C is opposite ∠A, not next to it.' },
        { id: '90', t: '90°', fb: 'Look again. Opposite angles of a parallelogram are equal.' }
      ] }, CP),
    Object.assign({ pdf: 37, id: 'cp2b', cpTitle: 'Checkpoint 2 · Find the Adjacent Angle',
      lines: [{ m: 'curious', t: 'In this parallelogram,\n∠A = 72°. What is the\nmeasure of ∠B?' }],
      idle: '∠B is next to ∠A. Adjacent angles add up to 180°.', hint: 'Tap an answer',
      ok: 'Correct! 72° + 108° = 180°.',
      fig: { P: tilt(72), angles: { A: '72°', B: '?' } },
      opts: [
        { id: '72', t: '72°', fb: '∠B is next to ∠A, not opposite it. Adjacent angles add up to 180°.' },
        { id: '108', t: '108°', ok: true },
        { id: '180', t: '180°', fb: '180° is the sum of ∠A and ∠B, not ∠B by itself.' }
      ] }, CP),
    Object.assign({ pdf: 37, id: 'cp2c', cpTitle: 'Checkpoint 2 · Find All the Angles',
      lines: [{ m: 'curious', t: 'In this parallelogram,\n∠A = 65°. Find the measures\nof ∠B, ∠C and ∠D.' }],
      hint: 'Drag a number into each box', idle: 'Opposite angles are equal, and adjacent angles add up to 180°.',
      ok: 'Amazing! ∠B = 115°, ∠C = 65°\nand ∠D = 115°.',
      fig: { P: tilt(65), angles: { A: '65°', B: '?', C: '?', D: '?' } },
      fill: { blanks: [{ id: 'B', pre: '∠B =', post: '°', ans: '115' }, { id: 'C', pre: '∠C =', post: '°', ans: '65' }, { id: 'D', pre: '∠D =', post: '°', ans: '115' }],
        tiles: ['25', '65', '115', '180'],
        fb: { any: '∠C is opposite ∠A, so they are equal. ∠B and ∠D are next to ∠A, so each adds with 65° to make 180°.' } } }, CP, FILL_CP),

    // ---------- Part 7 · diagonals (pages 38-49) ----------
    { pdf: 38, id: 'explored', lines: [{ m: 'happy', t: 'We have explored all about\nthe sides and angles of\na parallelogram.' }] },
    { pdf: 39, id: 'diagIntro', lines: [{ m: 'curious', t: "Let's learn about its\ndiagonals." }] },
    { pdf: 40, id: 'drawDiag', lines: [{ m: 'curious', t: 'Draw all the diagonals\nof this parallelogram.' }], task: 'connect', handOnce: 1,
      hint: 'Drag from one corner to the opposite corner', idle: 'A diagonal joins two opposite corners. Drag from A to C.',
      wrong: 'That is a side. A diagonal joins two opposite corners.',
      after: [{ m: 'happy', t: 'Great! You drew both\ndiagonals.' }] },
    { pdf: 41, id: 'diagNames', lines: [{ t: 'AC and BD are the diagonals\nof this parallelogram.' }], f: { diag: 1 } },
    { pdf: 42, id: 'meetO', lines: [{ t: 'They meet each other\nat point O.' }], f: DIAG },
    // each diagonal splits into its two halves (four colours)
    { pdf: 43, id: 'segs', lines: [{ t: 'Each diagonal divides\nthe other into\n2 segments.' }], f: Object.assign({ split: 1 }, DIAG) },
    { pdf: 44, id: 'measureSeg', lines: [{ m: 'curious', t: "Let's measure each segment." }], f: Object.assign({ split: 1, halves: 1 }, DIAG) },
    { pdf: 45, id: 'compare', lines: [{ m: 'thinking', t: "Let's compare the lengths\nof these segments." }], f: Object.assign({ split: 1, halves: 1 }, DIAG) },
    Object.assign({ pdf: '46-47', id: 'matchSeg', lines: [{ m: 'curious', t: 'Drag the segments to\ntheir correct place.' }],
      hint: 'Drag a segment into a box', idle: 'Compare the lengths. Which two segments are the same length?',
      ok: "That's correct! The segments\nof the same diagonal\nare equal.", okChips: [{ t: 'OA = OC', k: 'gold' }, { t: 'OB = OD', k: 'gold' }], okF: { halfPairs: 1, hticks: 1 },
      fill: { match: 1, blanks: [{ id: 'p1a', pair: 1 }, { id: 'p1b', pair: 1 }, { id: 'p2a', pair: 2 }, { id: 'p2b', pair: 2 }], tiles: ['OA', 'OB', 'OC', 'OD'],
        pairs: [['OA', 'OC'], ['OB', 'OD']], fb: { any: 'Those two are not the same length. Look at the lengths again.' } },
      f: Object.assign({ split: 1, halves: 1 }, DIAG) }, { optTop: 448, chipTop: 105, boardShiftY: -16 }),
    { pdf: 48, id: 'bisectEq', lines: [{ t: 'Each diagonal is divided\ninto two equal parts\nby the other.', chips: [{ t: 'OA = OC', k: 'gold' }, { t: 'OB = OD', k: 'gold' }] }],
      f: Object.assign({ halfPairs: 1, hticks: 1 }, DIAG) },
    { pdf: 49, id: 'bisect', lines: [{ m: 'happy', t: 'So the diagonals of\na parallelogram bisect\neach other.', pulse: 1, pulseAt: 'bisect', chips: [{ t: 'Diagonals bisect each other.', k: 'name' }] }],
      f: Object.assign({ halfPairs: 1, hticks: 1 }, DIAG) },

    // ---------- Checkpoint 3 · Let's use the diagonals! (page 50) ----------
    Object.assign({ pdf: 50, id: 'cp3a', cpTitle: 'Checkpoint 3 · Find the Other Half',
      lines: [{ m: 'curious', t: 'In this parallelogram,\nAO = 6 cm. What is the\nlength of OC?' }],
      idle: 'O is where the diagonals meet. The diagonals bisect each other.', hint: 'Tap an answer',
      ok: 'Yes! The diagonals bisect each\nother, so OC = AO = 6 cm.',
      fig: { P: FIG_SIDES, diag: 1, halves: { A: '6 cm' }, hticks: 1 },
      opts: [
        { id: '3', t: '3 cm', fb: 'OC is not half of AO. The diagonals bisect each other, so OC is the same length as AO.' },
        { id: '6', t: '6 cm', ok: true },
        { id: '12', t: '12 cm', fb: '12 cm would be the whole diagonal AC. OC is only one half of it.' }
      ] }, CP),
    Object.assign({ pdf: 50, id: 'cp3b', cpTitle: 'Checkpoint 3 · Find Both Halves',
      lines: [{ m: 'curious', t: 'In this parallelogram,\nAO = 5 cm and BO = 3 cm.\nFind the lengths of\nOC and OD.' }],
      hint: 'Drag a number into each box', idle: 'OC is the other half of AC, and OD is the other half of BD.',
      ok: 'Well done! OC = AO = 5 cm\nand OD = BO = 3 cm.',
      fig: { P: FIG_SIDES, diag: 1, halves: { A: '5 cm', B: '3 cm' }, hticks: 1 },
      fill: { blanks: [{ id: 'OC', pre: 'OC =', post: 'cm', ans: '5' }, { id: 'OD', pre: 'OD =', post: 'cm', ans: '3' }], tiles: ['3', '5', '6', '10'],
        fb: { any: 'OC is the other half of AC, so it equals AO. OD is the other half of BD, so it equals BO.' } } }, CP, FILL_CP),
    Object.assign({ pdf: 50, id: 'cp3c', multi: 1, cpTitle: 'Checkpoint 3 · Choose the Correct Statements',
      lines: [{ m: 'curious', t: 'Which of the following are\ntrue for this parallelogram?\nSelect all that apply.' }],
      hint: 'Tap every true statement', idle: 'The diagonals bisect each other. Which statements say that?',
      ok: 'Perfect! AO = OC, BO = OD,\nso the diagonals bisect\neach other.',
      fig: { P: FIG_SIDES, diag: 1, hticks: 1 },
      opts: [
        { id: 'aooc', t: 'AO = OC', ok: true },
        { id: 'bood', t: 'BO = OD', ok: true },
        { id: 'aobo', t: 'AO = BO', fb: 'AO and BO are parts of different diagonals, so they need not be equal.' },
        { id: 'acbd', t: 'AC = BD', fb: 'The two diagonals of this parallelogram have different lengths.' },
        { id: 'bis', t: 'The diagonals bisect each other.', ok: true, wide: 1 }
      ] }, CP, { optTop: 392, optWrap: 1, boardShiftY: -40 }),

    // ---------- Part 9 · recall (pages 51-52): the properties replayed on the same parallelogram, one by one ----------
    { pdf: 51, id: 'recall', lines: [{ m: 'happy', t: "Let's recall what we learnt\nabout parallelograms." }], f: DIAG },
    { pdf: 52, id: 'recDef', autoNext: 900, lines: [{ t: 'A parallelogram is a quadrilateral\nwith two pairs of opposite\nsides parallel.', pulse: 1, pulseAt: 'parallelogram',
      chips: [{ t: 'Parallelogram', k: 'name' }] }], f: PG },
    { pdf: 52, id: 'recPar', autoNext: 900, lines: [{ t: 'Opposite sides are parallel.', glow: ['AB', 'CD'], chips: [{ t: 'AB ∥ CD', k: 'white' }] },
      { keep: 1, s: 'B C is parallel to A D.', glow: ['BC', 'DA'], chips: [{ t: 'BC ∥ AD', k: 'white' }] }], f: PG },
    { pdf: 52, id: 'recEq', autoNext: 900, lines: [{ t: 'Opposite sides are equal.', chips: [{ t: 'AB = CD', k: 'gold' }, { t: 'BC = AD', k: 'gold' }] }],
      lenSeq: [[300, ['AB', 'CD']], [1500, ['DA', 'BC']]], f: Object.assign({ ticks: 1, lenSeq: 1 }, LENS) },
    { pdf: 52, id: 'recAng', autoNext: 900, lines: [{ t: 'Opposite angles are equal.', chips: [{ t: '∠A = ∠C', k: 'gold' }, { t: '∠B = ∠D', k: 'gold' }] }], f: { arcs: 'ABCD', pairCol: 1 } },
    { pdf: 52, id: 'recSupp', autoNext: 900, lines: [{ t: 'Adjacent angles are\nsupplementary.', s: 'Adjacent angles are supplementary. They add up to 180 degrees.',
      chips: [{ t: '∠A + ∠B = 180°', k: 'gold sm' }, { t: '∠B + ∠C = 180°', k: 'gold sm' }] }], f: { arcs: 'ABCD', supp: ['AB', 'BC'] } },
    { pdf: 52, id: 'recDiag', lines: [{ t: 'Diagonals bisect each other.', chips: [{ t: 'AO = OC', k: 'gold' }, { t: 'BO = OD', k: 'gold' }] }],
      f: Object.assign({ halfPairs: 1, hticks: 1 }, DIAG) },
    { id: 'end', end: 1, lines: [{ m: 'celebrating', t: 'Amazing work! You know all\nabout parallelograms now.' }] }
  ],
  // (the old trapezium label-matching check; kept empty so its engine code stays inert)
  cfu4: { labels: [], slots: [] }
};
