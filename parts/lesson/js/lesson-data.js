// =====================================================================
// LESSON — every screen of the Parallelogram storyboard (PDF pages 1–52), in play order.
// `pdf` on each step is the storyboard page it implements (feedback pages are the finished state of their question).
//
//   lines: narration (t = on-screen text, \n = line break in the bubble, s = optional spoken text;
//          keep: 1 + s = voice only, the bubble keeps the previous line;
//          glow = sides drawn bolder while the line is spoken, e.g. ['AB', 'CD']; glowAt: 'word' = wait for that word;
//          pulse: 1 + pulseAt = the shape zooms once on that word; growAt = the shape comes forward on that word;
//          cues = board moments on a spoken word: [{ at: 'word', glow: [sides] | null, hi: card text, chip, pulse, ms }];
//          a cue's tags: [{ t, k }] = the name tag of each of its pairs (match, matchAng, halfSlide), built as that pair's
//          slide lands; merge: { from: [tags], into: tag } = those tags fly into a new one; a line's tagsWithSupp: its
//          chips come one with each 180° demo (f.supp);
//          a cue's mark: [sides] = those sides' parallel arrows wait for the cue and pop on as its glow's light passes them;
//          meet: [two sides] = carried on until they meet (until: 'word' = they meet as that word is said); meetPulse = they beat;
//          chips = cards shown with the line; m = Swiftee's expression (default talking; reactions in CONFIG.swiftee)
//          holdM: 1 = Swiftee keeps the m pose while she speaks (e.g. waves hello) instead of the talking loop
//   skin:  'intro' = the opening look (storyboard pages 1-8): white bubble, light-blue shape with a thin blue outline
//   task:  dragB  = drag B until BC ∥ AD (the trapezium becomes a parallelogram; snaps when close); showAnswer = the
//          line said when a drag is missed after CONFIG.reveal.afterTips tips (B then moved into place: a glideB cue),
//          answerAfter = the lines once it is there (instead of after)
//          measure (+auto) = Swiftee walks every side with her tape measure
//          measureAngles (+auto) = Swiftee measures every angle with a protractor (js/angle-walker.js)
//          tapEq  = tap the corner whose angle equals ∠ref (want = the right corner, wrong = tip for a wrong tap)
//          handOnce: 1 = one demo gesture of the hand once the instruction ends
//          connect = draw both diagonals: drag (or tap, tap) from a corner to the opposite corner
//   enterCues: [{ at0: ms, ...a word cue }] = board moments as the screen opens, before its line (voiceDelay)
//   own: 1 = Swiftee's own thought ("There is something interesting..."): she stays and says it in her bubble, the
//          shape beside her, as on the measuring screens (not the narration plate)
//   opts:  answer buttons (ok = right; fb = tip for a wrong one; soloOk: 1 = once right, only the right answer stays,
//          centred; okGlow: [[sides], ...] = side pairs pulse in turn after it; calmOk: 1 = no confetti; okCues = word cues on
//          the feedback line; an option's emph = the parts that grow as it is picked right). multi: 1 = select every right answer
//          (req: false = right but not needed to finish). grid: 1 = the four-shape picture grid
//   fill:  answer boxes: blanks [{ id, pre, post, ans }], tiles [...] (the choices: a tap on a box opens them in a row
//          under it). match: 1 = segment tiles dragged (or tapped) into the boxes, each once, checked as pairs (pairs)
//   cp:    checkpoint challenge (scored: right on the first try), cpTitle = its name (in the ?dev=1 panel)
//   fig:   the checkpoint's own drawing on the board: P (corners), sides / angles / halves labels ('?' = unknown),
//          diag = draw the diagonals
//   f:     board display flags: noLetters, par (arrows on AB, CD), par2 (arrows on AD, BC), sideLen / legLen (lengths),
//          lenSeq (lengths appear pair by pair: AB + CD, then AD + BC), ticks (equal-side marks), arcs (angle arcs),
//          pairCol (equal angles share a colour), supp (supplementary demo pairs, in turn),
//          diag, O, split (diagonal halves in four colours), halfPairs (equal halves share a colour), hticks, halves (cards)
//   flow:  explanation screens move on by themselves (CONFIG.flow.advanceMs after the voice); questions wait for the
//          learner; autoNext (ms) = move on this soon after the last line (recall sequence)
// =====================================================================
const PG = { par: 1, par2: 1 };                       // both pairs of sides marked parallel
const LENS = { sideLen: 1, legLen: 1 };               // all four side lengths (measured from the shape)
const DIAG = { diag: 1, O: 1 };                       // the two diagonals and their meeting point O
const PRACTICE = { practice: 1 }; // (its tags, if it makes any, under the shape like every screen's: over its answers while they show)
// checkpoint figures (board coordinates; the board's top-left is stage 651,104)
const deg = Math.PI / 180;
const tilt = (a) => ({ A: { x: 90, y: 112 }, B: { x: 390, y: 112 },
  C: { x: 390 + 170 * Math.cos(a * deg), y: 112 + 170 * Math.sin(a * deg) }, D: { x: 90 + 170 * Math.cos(a * deg), y: 112 + 170 * Math.sin(a * deg) } });
const FIG_SIDES = { A: { x: 150, y: 112 }, B: { x: 440, y: 112 }, C: { x: 380, y: 282 }, D: { x: 90, y: 282 } };
// checkpoint 3b: AO = 5 cm and BO = 3 cm, so AC is drawn the longer diagonal (halves about 208 : 124, as 5 : 3)
const FIG_HALVES = { A: { x: 70, y: 112 }, B: { x: 350, y: 112 }, C: { x: 450, y: 282 }, D: { x: 170, y: 282 } };
const CP = { cp: 1 };

const LESSON = {
  steps: [
    // ---------- Part 1 · quadrilateral -> trapezium -> parallelogram (pages 1-11) ----------
    // the outline draws itself while Swiftee says the line and closes on her last word; the plain shape, as on page 1
    // (she waves hello as she speaks)
    { pdf: 1, id: 'intro', build: 1, skin: 'intro', lines: [{ m: 'waving', holdM: 1, t: 'We learnt about quadrilaterals\nearlier.' }], f: { noLetters: 1 } },
    { pdf: 2, id: 'quadSides', sideNums: 1, skin: 'intro', lines: [{ m: 'happy', t: 'Any polygon with 4 sides is\ncalled a quadrilateral.' }], f: { noLetters: 1 } },
    // screens 3-4: the shape screen 1 drew stays (never rebuilt); it comes forward once on "special" (growAt), and the
    // name caption is a word cue, as on screen 10 - "Trapezium" pops in exactly as Swiftee says it and the outline glows
    // once. Screen 4 never lights up AB/CD on "parallel": screen 5 asks which pair is parallel.
    // (no tracing: the shape comes forward on "special" and its name comes in on "trapezium")
    { pdf: 3, id: 'special', skin: 'intro', onlyCues: 1, lines: [{ m: 'happy', t: 'This is a special type of\nquadrilateral called trapezium.', growAt: 'special',
      cues: [{ at: 'trapezium', chip: { t: 'Trapezium', k: 'name' } }] }], f: { noLetters: 1 } },
    // (its one parallel pair lights once, on "pair" - not the other two sides, which are not parallel)
    { pdf: 4, id: 'onePair', skin: 'intro', onlyCues: 1, enterChips: [{ t: 'Trapezium', k: 'name' }],
      lines: [{ t: 'A trapezium has one pair of\nopposite sides parallel.', cues: [{ at: 'pair', light: ['AB', 'CD'], ms: 2200 }] }], f: { noLetters: 1 } },
    // (the question names no pair: on "pair" one pair of opposite sides lights, on "sides" the other - the two the
    // answers name - and "parallel" shows nothing, which would be the answer)
    Object.assign({ pdf: '5-6', id: 'askPar', skin: 'intro', noTrace: 1, // (the question is asked calmly: nothing on the shape lights or moves)
      lines: [{ m: 'curious', t: 'Which pair of sides are\nparallel to each other?' }],
      // right answer: AD ∥ BC folds away and AB ∥ CD settles alone in the centre, green (storyboard page 6)
      // right: AB is traced as it is said, its parallel marks popping on as the light passes them, then CD; wrong: AD, then BC, light as
      // they are said; on "lean" the card zooms out just enough, and they are carried on until they meet as "meet" is said
      ok: "That's correct! AB ∥ CD.", soloOk: 1, okF: { par: 1 },
      okCues: [{ at: 'ab', glow: ['AB'], mark: ['AB'] }, { at: 'cd', glow: ['AB', 'CD'], mark: ['CD'], ms: 1800 }],
      opts: [
        { id: 'AB', t: 'AB ∥ CD', ok: true },
        { id: 'AD', t: 'AD ∥ BC', fb: 'Look again. AD and BC lean towards each other, so they would meet if we made them longer.',
          fbCues: [{ at: 'ad', glow: ['DA'] }, { at: 'bc', glow: ['DA', 'BC'] }, { at: 'lean', meet: ['DA', 'BC'], until: 'meet' }, { at: 'longer', meetPulse: 1 }] }
      ] }, PRACTICE),
    { pdf: 7, id: 'whatIf', skin: 'intro', lines: [{ m: 'thinking', t: 'What if we made the other pair\nof opposite sides parallel too?', glow: ['DA', 'BC'] }], f: { par: 1 } },
    // one demo hand once the instruction ends, then the learner drags B; BC ∥ AD snaps it into a parallelogram, and BC
    // then AD are traced as they are said, their parallel marks popping on with the light
    { pdf: 8, id: 'dragPar', skin: 'intro', onlyCues: 1, lines: [{ m: 'curious', t: 'Drag vertex B to make\nBC parallel to AD.',
      cues: [{ at: 'B', emph: ['vB'] }, { at: 'parallel', light: ['BC', 'DA'], ms: 1500 }] }],
      task: 'dragB', handOnce: 1,
      after: [{ m: 'happy', t: 'Well done! Now BC is\nparallel to AD.', cues: [{ at: 'bc', glow: ['BC'], mark: ['BC'] }, { at: 'ad', glow: ['BC', 'DA'], mark: ['DA'], ms: 1800 }] }],
      // missed after two tips: the answer shown - AD lights, its copy slides across to C (the way BC must lean) and B
      // glides along AB until BC lies on it; then BC and AD are traced, their marks popping on
      showAnswer: { m: 'thinking', t: 'Watch! BC must lean\nthe same way as AD.', cues: [{ at: 'watch', glow: ['DA'] }, { at: 'lean', glideB: 1 }] },
      answerAfter: [{ m: 'happy', t: 'Now BC is parallel to AD.', cues: [{ at: 'bc', glow: ['BC'], mark: ['BC'] }, { at: 'ad', glow: ['BC', 'DA'], mark: ['DA'], ms: 1800 }] }], f: { par: 1 } },
    // both pairs shown, not spelt out: on "both" AB and CD are traced, their arrows beating as the light passes, and
    // their tag is built from them; on "sides" AD and BC, with theirs; on "parallel" the whole outline
    { pdf: 9, id: 'bothPar', chipTop: 428, onlyCues: 1, lines: [{ m: 'surprised', t: 'Now both pairs of opposite\nsides are parallel.', cues: [
      { at: 'both', glow: ['AB', 'CD'], beat: ['AB', 'CD'], chip: { t: 'AB ∥ CD', k: 'white', pop: 1 } },
      { at: 'sides', glow: ['DA', 'BC'], beat: ['DA', 'BC'], chip: { t: 'AD ∥ BC', k: 'white', pop: 1 }, ms: 1700 }] }], f: PG },
    // screen 9 (storyboard page 10): the cards come in under the shape with the voice, one row - "We": AB ∥ CD lifts;
    // "this": AD ∥ BC; "Parallelogram": the name lands beside them and the whole outline glows once
    { pdf: 10, id: 'defPg', chipTop: 428,
      // the two pair tags built on screen 8 stay; on "parallelogram" they merge into the name (no tracing)
      lines: [{ t: 'We call this a parallelogram.', cues: [
        { at: 'parallelogram', merge: { from: ['AB ∥ CD', 'AD ∥ BC'], into: { t: 'Parallelogram', k: 'name' } } }] }], f: PG },
    // screen 10 (storyboard page 11): screen 9's shape stays as it is (no rebuild) and the two pair cards come in; as
    // Swiftee says it, AB + CD glow with their card, then AD + BC with theirs; on "parallelogram" the name card (there
    // since screen 9, in the same row) lifts
    { pdf: 11, id: 'defFull', chipTop: 428,
      // (the name made on screen 10 stays; the definition is said with its sides lighting pair by pair)
      enterChips: [{ t: 'Parallelogram', k: 'name' }],
      lines: [{ t: 'A quadrilateral where both pairs\nof opposite sides are parallel is\ncalled a parallelogram.', cues: [
        { at: 'pairs', glow: ['AB', 'CD'] },
        { at: 'sides', glow: ['DA', 'BC'] },
        { at: 'called', glow: null, hi: null },
        { at: 'parallelogram', hi: 'Parallelogram', ms: 1400 }] }],
      f: PG },

    // ---------- Part 2 · opposite side lengths (pages 12-20) ----------
    // (the sides light on "lengths" / "equal": the question is about them, and nothing else is on the board yet)
    { pdf: 12, id: 'lengthsQ', lines: [{ m: 'thinking', t: 'But what about the\nside lengths?' }], f: PG }, // (no tracing)
    // (the narrator asks - on the plate, Swiftee not on the card; she comes with her own line on the next screen: "Let's
    // find out!")
    { pdf: 13, id: 'equalQ', lines: [{ narr: 1, t: 'Are they equal too?' }], f: PG },
    { pdf: 14, id: 'measure', lines: [{ m: 'curious', t: "Let's find out!" }], task: 'measure', auto: 1, f: PG },
    // the lengths come in pair by pair: AB and CD (6 cm) together, then AD and BC (3 cm)
    { pdf: 15, id: 'interesting', lines: [{ narr: 1, t: 'There is something\ninteresting about\nthe lengths.' }],
      lenSeq: [[700, ['AB', 'CD']], [2300, ['DA', 'BC']]], f: Object.assign({ lenSeq: 1 }, PG, LENS) },
    Object.assign({ pdf: '16-17', id: 'askSides', lines: [{ m: 'curious', t: 'What do you notice\nabout the sides?' }],
      // right answer: the other option folds away, this one settles green in the centre; as the line says it, AB + CD
      // and AD + BC light in turn on "opposite", their lengths in turn on "equal" (conceptCues); the correct sound, no
      // confetti (storyboard page 17)
      ok: "That's correct! Opposite\nsides are equal.", soloOk: 1, calmOk: 1, okF: { ticks: 1 },
      okCues: [{ at: 'Opposite', lightSeq: [['AB', 'CD'], ['DA', 'BC']], gap: 1000, hold: 1100 }], // (each pair of opposite sides once, as their ticks show they are equal)
      opts: [
        { id: 'all', t: 'All sides are equal', fb: 'Look at the lengths again. AB is 6 cm, but AD is only 3 cm.' },
        { id: 'opp', t: 'Opposite sides are equal', ok: true }
      ], f: LENS }, PRACTICE),
    // (no sides sliding: as it is said, the names of each pair of opposite sides fly from their sides and merge into
    // its tag - AB and CD into AB = CD, then AD and BC into AD = BC)
    { pdf: 18, id: 'oppEq', onlyCues: 1, lines: [{ cues: [{ at: 'opposite', chip: { t: 'AB = CD', k: 'gold', byName: 1 } }, { at: 'equal', chip: { t: 'AD = BC', k: 'gold', byName: 1 } }], m: 'happy', t: 'In any parallelogram,\nopposite sides are of\nequal lengths.' }],
      f: Object.assign({ ticks: 1 }, LENS) },
    { pdf: 20, id: 'sidesSum', onlyCues: 1, lines: [{ m: 'happy', t: 'So, in any parallelogram,\nopposite sides are\nparallel and equal.', cues: [
      // (one after another from "parallel": "equal" follows it too closely for a sequence of its own)
      { at: 'parallel', steps: [{ beat: ['AB', 'CD'], chip: { t: 'AB ∥ CD', k: 'gold', pop: 1 } }, { beat: ['DA', 'BC'], chip: { t: 'AD ∥ BC', k: 'gold', pop: 1 } },
        { emph: ['lAB', 'lCD'], chip: { t: 'AB = CD', k: 'gold', pop: 1 } }, { emph: ['lDA', 'lBC'], chip: { t: 'AD = BC', k: 'gold', pop: 1 } }], gap: 800 }] }], // (gold, as screen 16's)
      f: Object.assign({ ticks: 1 }, PG, LENS) },

    // ---------- Checkpoint 1 · Are you ready? (page 21) ----------
    Object.assign({ pdf: 21, id: 'cp1a', grid: 1, multi: 1, cpTitle: 'Checkpoint 1 · Find the Parallelograms',
      lines: [{ m: 'curious', t: 'Which of these are\nparallelograms? Select\nall that apply.' }],
      // (the tips speak of the shape just tapped - "this shape" - not of its letter)
      ok: 'Yes! Both these shapes have\ntwo pairs of parallel sides.',
      opts: [
        { id: 'A', ok: true },
        { id: 'B', fb: 'This shape is a trapezium. Only one pair of its sides is parallel.' },
        { id: 'C', ok: true },
        { id: 'D', fb: 'This shape has five sides, so it is not a quadrilateral.' }
      ] }, CP),
    // (each side traced, whole, as it is named: AB, then the side asked for; right: the opposite pair, on "Opposite")
    Object.assign({ pdf: 21, id: 'cp1b', handOnce: 1, onlyCues: 1, cpTitle: 'Checkpoint 1 · Find the Missing Side',
      lines: [{ m: 'curious', t: 'In this parallelogram,\nAB = 7 cm. What is the\nlength of CD?', cues: [{ at: 'AB = 7 cm.', light: ['AB'], ms: 1400 }, { at: 'CD?', light: ['CD'], ms: 1600 }] }],
      ok: "That's right! Opposite sides\nare equal, so CD = 7 cm.", okCues: [{ at: 'Opposite', light: ['AB', 'CD'], ms: 1800 }],
      fig: { P: FIG_SIDES, sides: { AB: '7 cm', CD: '? cm' } },
      fill: { blanks: [{ id: 'CD', pre: 'CD =', post: 'cm', ans: '7' }], tiles: ['3.5', '7', '14'],
        fb: { '3.5': 'CD is not half of AB. Opposite sides of a parallelogram are equal.', '14': 'CD is not double AB. Opposite sides of a parallelogram are equal.' } } }, CP),
    // (each given side traced, whole, as it is named - AB, then BC - and the two asked for together, so no light cuts
    // another short; right: CD, then AD, as they are said)
    Object.assign({ pdf: 21, id: 'cp1c', onlyCues: 1, cpTitle: 'Checkpoint 1 · Find the Missing Sides',
      lines: [{ m: 'curious', t: 'In this parallelogram,\nAB = 8 cm and BC = 5 cm.\nFind the lengths of\nCD and AD.', cues: [{ at: 'AB = 8 cm', light: ['AB'], ms: 1300 }, { at: 'BC = 5 cm.', light: ['BC'], ms: 1300 }, { at: 'of', lightSeq: [['CD'], ['DA']], gap: 1050, hold: 1300 }] }], // (CD, then AD - one at a time)
      ok: 'CD = 8 cm, AD = 5 cm.', okCues: [{ at: 'CD = 8 cm,', light: ['CD'], ms: 1150 }, { at: 'AD = 5 cm.', light: ['DA'], ms: 1400 }],
      fig: { P: FIG_SIDES, sides: { AB: '8 cm', BC: '5 cm', CD: '?', DA: '?' } },
      fill: { blanks: [{ id: 'CD', pre: 'CD =', post: 'cm', ans: '8' }, { id: 'AD', pre: 'AD =', post: 'cm', ans: '5' }], tiles: ['3', '5', '8', '13'],
        fb: { CD: 'CD is opposite AB, so CD = AB.', AD: 'AD is opposite BC, so AD = BC.' } } }, CP), // (each box its own tip)

    // ---------- Part 4 · opposite angles (pages 22-31) ----------
    { pdf: 22, id: 'sidesDone', lines: [{ m: 'happy', t: 'We learnt all about the\nsides of a parallelogram.' }] },
    { pdf: 23, id: 'angles', noTrace: 1, lines: [{ narr: 1, t: 'But what about its angles?\nAre they equal too?' }] }, // (the narrator asks: as screen 13)
    // Swiftee carries a protractor round A, B, C, D; each angle and its size come in as she measures it
    { pdf: 24, id: 'measureAng', lines: [{ m: 'curious', t: "Let's find out!" }], task: 'measureAngles', auto: 1 },
    // the four arcs and their sizes draw in one after another
    { pdf: 25, id: 'interestingAng', lines: [{ narr: 1, t: 'There is something\ninteresting here too.', cues: [{ at: 'here', emph: ['aA', 'aB', 'aC', 'aD'] }] }], f: { arcs: 'ABCD' } },
    { pdf: 26, id: 'someEq', lines: [{ t: 'Some angles are equal\nto one another.' }], f: { arcs: 'ABCD' } },
    // screens 26-27: the angle equal to ∠A is chosen from its name (the shape stays still: nothing on it is tapped, jumps or
    // is traced). Right: the two angles come forward, the others step back, and their names fly from the words just said
    // into the statement (∠A = ∠C), which completes as it lands
    Object.assign({ pdf: '27-28', id: 'tapEqA', onlyCues: 1, lines: [{ m: 'curious', t: 'Which angle is\nequal to ∠A?' }],
      ok: "That's correct! ∠A is\nequal to ∠C.", soloOk: 1,
      okCues: [{ at: 'equal', focus: ['A', 'C'], ms: 3400 }, { at: '∠C.', chip: { t: '∠A = ∠C', k: 'gold', byName: 1 } }],
      opts: [
        { id: 'B', t: '∠B', emph: ['aB'], fb: 'Not quite. Compare its size with ∠A. Look at the corner opposite A.' },
        { id: 'C', t: '∠C', emph: ['aC'], ok: true },
        { id: 'D', t: '∠D', emph: ['aD'], fb: 'Not quite. Compare its size with ∠A. Look at the corner opposite A.' }
      ], f: { arcs: 'ABCD' } }, PRACTICE),
    // (asked with nothing between the shape and the answers - screen 26's tag is no hint here; right: it comes back on
    // "equal", and this one's statement forms beside it on "∠B")
    Object.assign({ pdf: '29-30', id: 'tapEqD', onlyCues: 1, lines: [{ m: 'curious', t: 'Which angle is\nequal to ∠D?' }],
      ok: "That's correct! ∠D is\nequal to ∠B.", soloOk: 1,
      okCues: [{ at: 'equal', focus: ['D', 'B'], ms: 3400 }, { at: 'equal', chip: { t: '∠A = ∠C', k: 'gold', pop: 1 } }, { at: '∠B.', chip: { t: '∠D = ∠B', k: 'gold', byName: 1 } }],
      opts: [
        { id: 'A', t: '∠A', emph: ['aA'], fb: 'Not quite. Compare its size with ∠D. Look at the corner opposite D.' },
        { id: 'B', t: '∠B', emph: ['aB'], ok: true },
        { id: 'C', t: '∠C', emph: ['aC'], fb: 'Not quite. Compare its size with ∠D. Look at the corner opposite D.' }
      ], f: { arcs: 'ABCD', pairA: 1 } }, PRACTICE),
    // (the recap of screens 26-27, laid out as they are (PRACTICE: the tags keep their row, the shape its place): each
    // pair - its two angles and its tag - is pointed out in turn as it is said: ∠A and ∠C, then ∠D and ∠B)
    Object.assign({ pdf: 31, id: 'oppAng', onlyCues: 1, enterChips: [{ t: '∠A = ∠C', k: 'gold', pop: 1 }, { t: '∠D = ∠B', k: 'gold', pop: 1 }], lines: [{ m: 'happy', t: 'So in any parallelogram,\nthe pairs of opposite\nangles are also equal.',
      cues: [{ at: 'opposite', steps: [{ focus: ['A', 'C'], hi: '∠A = ∠C', ms: 1300 }, { focus: ['D', 'B'], hi: '∠D = ∠B', ms: 1300 }], gap: 1600 }] }], f: { arcs: 'ABCD', pairCol: 1 } }, PRACTICE),

    // ---------- Part 5 · adjacent angles (pages 32-36) ----------
    { pdf: 32, id: 'seeElse', own: 1, lines: [{ m: 'thinking', t: 'But I see something\nelse too.', cues: [{ at: 'something', emph: ['aA', 'aB', 'aC', 'aD'] }] }], f: { arcs: 'ABCD' } },
    { pdf: 33, id: 'lookAD', lines: [{ m: 'curious', t: 'Look at ∠A and ∠D.' }], f: { arcs: 'AD' } },
    // ∠A slides down to D: with ∠D it fills the straight line through D (110° + 70° = 180°)
    // "add": ∠A and ∠D stay vivid and the others step back; "180°": their sum card lifts
    { pdf: 34, id: 'sumAD', lines: [{ m: 'surprised', t: 'They add up to make 180°.', cues: [{ at: 'add', focus: ['A', 'D'], ms: 2200 }],
      chips: [{ t: '∠A + ∠D = 180°', k: 'white' }], tagsWithSupp: 1 }], f: { arcs: 'ABCD', supp: ['AD'] } }, // (its tag built with the demo: 110° + 70°, = 180°)
    Object.assign({ pdf: 35, id: 'askAdj', multi: 1, lines: [{ m: 'curious', t: 'Which other angles\nadd up to 180°?' }],
      // (each tag built as the voice says it)
      ok: 'Yes! ∠B + ∠C = 180° and\n∠A + ∠B = 180°.', okChips: [{ t: '∠B + ∠C = 180°', k: 'gold sm' }, { t: '∠A + ∠B = 180°', k: 'gold sm' }],
      okCues: [{ at: '∠B + ∠C = 180°', chip: { t: '∠B + ∠C = 180°', k: 'gold sm' } }, { at: '∠A + ∠B = 180°.', chip: { t: '∠A + ∠B = 180°', k: 'gold sm' } }],
      opts: [
        { id: 'BC', t: '∠B & ∠C', ok: true },
        { id: 'BD', t: '∠B & ∠D', fb: '∠B and ∠D are opposite angles. 70° + 70° is not 180°.' },
        { id: 'AB', t: '∠A & ∠B', ok: true },
        { id: 'AC', t: '∠A & ∠C', fb: '∠A and ∠C are opposite angles. 110° + 110° is not 180°.' }
      ], f: { arcs: 'ABCD' } }, PRACTICE),
    { pdf: 36, id: 'adjRule', lines: [{ m: 'happy', t: 'All the adjacent angles\nof this parallelogram\nadd up to 180°.', tagsWithSupp: 1, // (each pair's tag is built with its own 180° demo)
      chips: [{ t: '∠A + ∠D = 180°', k: 'white sm' }, { t: '∠A + ∠B = 180°', k: 'white sm' }, { t: '∠B + ∠C = 180°', k: 'white sm' }, { t: '∠C + ∠D = 180°', k: 'white sm' }] }],
      f: { arcs: 'ABCD', supp: ['AD', 'BA', 'BC', 'DC'] } }, // (each demo at the corner whose side carries on clear of the letters)

    // ---------- Checkpoint 2 · Let's use what we learnt! (page 37) ----------
    Object.assign({ pdf: 37, id: 'cp2a', cpTitle: 'Checkpoint 2 · Find the Opposite Angle',
      lines: [{ m: 'curious', t: 'In this parallelogram,\n∠A = 68°. What is the\nmeasure of ∠C?' }],
      ok: "That's right! Opposite angles\nare equal, so ∠C = 68°.",
      fig: { P: tilt(68), angles: { A: '68°', C: '?' } },
      opts: [
        { id: '68', t: '68°', ok: true },
        { id: '112', t: '112°', fb: 'Look again. Opposite angles of a parallelogram are equal.' },
        { id: '90', t: '90°', fb: 'Look again. Opposite angles of a parallelogram are equal.' }
      ] }, CP),
    Object.assign({ pdf: 37, id: 'cp2b', cpTitle: 'Checkpoint 2 · Find the Adjacent Angle',
      lines: [{ m: 'curious', t: 'In this parallelogram,\n∠A = 72°. What is the\nmeasure of ∠B?' }],
      ok: 'Correct! 72° + 108° = 180°.',
      fig: { P: tilt(72), angles: { A: '72°', B: '?' } },
      opts: [
        { id: '72', t: '72°', fb: '∠B is next to ∠A, not opposite it. Adjacent angles add up to 180°.' },
        { id: '108', t: '108°', ok: true },
        { id: '180', t: '180°', fb: '180° is the sum of ∠A and ∠B, not ∠B by itself.' }
      ] }, CP),
    Object.assign({ pdf: 37, id: 'cp2c', cpTitle: 'Checkpoint 2 · Find All the Angles',
      lines: [{ m: 'curious', t: 'In this parallelogram,\n∠A = 65°. Find the measures\nof ∠B, ∠C and ∠D.' }],
      ok: 'Amazing! ∠B = 115°, ∠C = 65°\nand ∠D = 115°.',
      fig: { P: tilt(65), angles: { A: '65°', B: '?', C: '?', D: '?' } },
      fill: { blanks: [{ id: 'B', pre: '∠B =', post: '°', ans: '115' }, { id: 'C', pre: '∠C =', post: '°', ans: '65' }, { id: 'D', pre: '∠D =', post: '°', ans: '115' }],
        tiles: ['25', '65', '115', '180'],
        // a tip for each wrong value in each box: what that value would mean, and the one fact that box needs
        fb: {
          'B:25': '25° + 65° is only 90°. ∠A and ∠B must add up to 180°.',
          'B:65': '∠B is next to ∠A, not opposite it. ∠A + ∠B = 180°.',
          'B:180': '180° is ∠A and ∠B together. Take away the 65° of ∠A.',
          'C:25': '∠C is opposite ∠A, so it is equal to ∠A, not 25°.',
          'C:115': '115° is the size of an angle next to ∠A. ∠C is opposite ∠A, so ∠C = ∠A.',
          'C:180': '∠C is opposite ∠A, so it is equal to ∠A, not 180°.',
          'D:25': '25° + 65° is only 90°. ∠A and ∠D must add up to 180°.',
          'D:65': '∠D is next to ∠A, not opposite it. ∠A + ∠D = 180°.',
          'D:180': '180° is ∠A and ∠D together. Take away the 65° of ∠A.' } } }, CP),

    // ---------- Part 7 · diagonals (pages 38-49) ----------
    { pdf: 38, id: 'explored', lines: [{ m: 'happy', t: 'We have explored all about\nthe sides and angles of\na parallelogram.' }] },
    { pdf: 39, id: 'diagIntro', noTrace: 1, lines: [{ m: 'curious', t: "Let's learn about its\ndiagonals." }] },
    { pdf: 40, id: 'drawDiag', handOnce: 1, lines: [{ m: 'curious', t: 'Draw all the diagonals\nof this parallelogram.' }], task: 'connect', handOnce: 1,
      wrong: 'That is a side. A diagonal joins two opposite corners.',
      after: [{ m: 'happy', t: 'Great! You drew both\ndiagonals.' }] },
    { pdf: 41, id: 'diagNames', lines: [{ t: 'AC and BD are the diagonals\nof this parallelogram.' }], f: { diag: 1 } },
    { pdf: 42, id: 'meetO', lines: [{ t: 'They meet each other\nat point O.', cues: [{ at: 'O.', showO: 1 }] }], f: { diag: 1, Oat: 1 } }, // (point O comes in as it is named)
    // each diagonal splits into its two halves (four colours)
    // (the diagonals plain, and on "segments" their four parts come in one at a time: OA and OC, then OB and OD)
    { pdf: 43, id: 'segs', onlyCues: 1, lines: [{ t: 'Each diagonal divides\nthe other into\n2 segments.',
      cues: [{ at: 'segments', steps: [{ half: 'A' }, { half: 'C' }, { half: 'B' }, { half: 'D' }], gap: 750 }] }], f: Object.assign({ split: 1, splitSeq: 1 }, DIAG) },
    // as screens 13 and 24: Swiftee asks what she will find out, says it, then walks the diagonals with her tape - A to
    // O to C, B to O to D - each half's length coming in as the tape lands on it
    { pdf: 44, id: 'measureSeg', onlyCues: 1, lines: [{ narr: 1, t: 'Are the two segments of\neach diagonal equal?' }, { m: 'curious', t: "Let's find out!" }], task: 'measure', segs: 1, auto: 1, f: Object.assign({ split: 1, halves: 1 }, DIAG) },
    { pdf: 45, id: 'compare', noTrace: 1, lines: [{ m: 'thinking', t: "Let's compare the lengths\nof these segments." }], f: Object.assign({ split: 1, halves: 1 }, DIAG) },
    // (the segments are dragged, never tapped, into the boxes; each equation is checked as soon as both its boxes are
    // filled. Right: as the line says it, each equation's boxes merge into its tag - OA = OC on "same", OB = OD on
    // "equal" - the tags the next screen keeps)
    Object.assign({ pdf: '46-47', id: 'matchSeg', noTrace: 1, onlyCues: 1, lines: [{ m: 'curious', t: 'Drag the segments to\ntheir correct place.' }],
      ok: "That's correct! The segments\nof the same diagonal\nare equal.", // (its four colours stay: they become two as the next screen opens)
      okCues: [{ at: 'same', boxMerge: 1 }, { at: 'equal', boxMerge: 2 }],
      fill: { match: 1, blanks: [{ id: 'p1a', pair: 1 }, { id: 'p1b', pair: 1 }, { id: 'p2a', pair: 2 }, { id: 'p2b', pair: 2 }], tiles: ['OA', 'OB', 'OC', 'OD'],
        pairs: [['OA', 'OC'], ['OB', 'OD']], fb: { any: 'Those two are not the same length. Look at the lengths again.' } },
      f: Object.assign({ split: 1, halves: 1 }, DIAG) }),
    // (in time with its line, once the shape has settled from screen 45: on "diagonal" each diagonal takes one colour,
    // its colour running from its corner through O to the other - AC, then BD; on "equal parts" their lengths become
    // their equal marks - AO's and OC's, then BO's and OD's. Screen 45's two tags stay)
    { pdf: 48, id: 'bisectEq', noTrace: 1, onlyCues: 1, voiceDelay: 800, enterChips: [{ t: 'OA = OC', k: 'gold', pop: 1 }, { t: 'OB = OD', k: 'gold', pop: 1 }],
      lines: [{ cues: [{ at: 'diagonal', steps: [{ paint: 'A' }, { paint: 'B' }], gap: 1150 }, { at: 'equal', steps: [{ toMarks: 'A' }, { toMarks: 'B' }], gap: 850 }], t: 'Each diagonal is divided\ninto two equal parts\nby the other.' }],
      f: Object.assign({ split: 1, halves: 1, hticks: 1, toMarks: 1, pairSeq: 1 }, DIAG) },
    { pdf: 49, id: 'bisect', noTrace: 1, lines: [{ m: 'happy', t: 'So the diagonals of\na parallelogram bisect\neach other.', pulse: 1, pulseAt: 'bisect',
      cues: [{ at: 'bisect', merge: { from: ['OA = OC', 'OB = OD'], into: { t: 'Diagonals bisect each other.', k: 'name' } } }] }], // (screen 48's two tags merge into it)
      f: Object.assign({ halfPairs: 1, hticks: 1 }, DIAG) },

    // ---------- Checkpoint 3 · Let's use the diagonals! (page 50) ----------
    Object.assign({ pdf: 50, id: 'cp3a', cpTitle: 'Checkpoint 3 · Find the Other Half',
      lines: [{ m: 'curious', t: 'In this parallelogram,\nAO = 6 cm. What is the\nlength of OC?' }],
      ok: 'Yes! O cuts AC in half,\nso OC = 6 cm.',
      fig: { P: FIG_SIDES, diag: 1, halves: { A: '6 cm' } },
      opts: [
        { id: '3', t: '3 cm', fb: 'OC is not half of AO. OC = AO.' },
        { id: '6', t: '6 cm', ok: true },
        { id: '12', t: '12 cm', fb: '12 cm is the whole of AC. OC is only half of it.' }
      ] }, CP),
    Object.assign({ pdf: 50, id: 'cp3b', cpTitle: 'Checkpoint 3 · Find Both Halves',
      lines: [{ m: 'curious', t: 'In this parallelogram,\nAO = 5 cm and BO = 3 cm.\nFind the lengths of\nOC and OD.' }],
      ok: 'Well done! OC = AO = 5 cm\nand OD = BO = 3 cm.',
      fig: { P: FIG_HALVES, diag: 1, halves: { A: '5 cm', B: '3 cm' } },
      fill: { blanks: [{ id: 'OC', pre: 'OC =', post: 'cm', ans: '5' }, { id: 'OD', pre: 'OD =', post: 'cm', ans: '3' }], tiles: ['3', '5', '6', '10'],
        fb: { OC: 'OC is the other half of AC, so OC = AO.', OD: 'OD is the other half of BD, so OD = BO.' } } }, CP), // (each box its own tip)
    // the two true statements are the whole idea: AO = OC and BO = OD is what "the diagonals bisect each other" means,
    // so it is not a fifth answer to pick - it is what the right answer shows. Each right pick lights its diagonal; once
    // both are found the equal halves take their pair colours and, as Swiftee says "bisect", fold onto each other about O
    Object.assign({ pdf: 50, id: 'cp3c', multi: 1, cpTitle: 'Checkpoint 3 · Choose the Correct Statements',
      lines: [{ m: 'curious', t: 'Which of the following are\ntrue for this parallelogram?\nSelect all that apply.' }],
      ok: 'Perfect! AO = OC, BO = OD,\nso the diagonals bisect\neach other.',
      // (the halves' equal ticks would be the answer: they come with it, okF)
      // (as it is said, AO slides onto OC, then BO onto OD - each fits: the diagonals bisect each other)
      okF: { halfPairs: 1, hticks: 1 }, okCues: [{ at: 'AO = OC,', halfSlide: ['A', 'C'] }, { at: 'BO = OD,', halfSlide: ['B', 'D'] }],
      // (a right pick: its two halves traced in turn, AO then OC, and their equal marks come - the statement seen on the
      // figure; hticks wait for them: toMarks)
      fig: { P: FIG_SIDES, diag: 1, hticks: 1, toMarks: 1 },
      opts: [
        { id: 'aooc', t: 'AO = OC', ok: true, pickCues: [{ pairTrace: 'A' }] },
        { id: 'bood', t: 'BO = OD', ok: true, pickCues: [{ pairTrace: 'B' }] },
        { id: 'aobo', t: 'AO = BO', fb: 'AO and BO are parts of different diagonals, so they need not be equal.' },
        { id: 'acbd', t: 'AC = BD', fb: 'The two diagonals of this parallelogram have different lengths.' }
      ] }, CP),

    // ---------- Part 9 · recall (pages 51-52): the summary, as Fishing Frenzy's (js/summary.js): one glassy bubble per
    // idea in the middle of the card, Swiftee peeking over it to say its line (the recap clips), the bubbles gathering
    // into albums at the sides, then Next (in the journey, the hand-over to the fishing) ----------
    { pdf: '51-52', id: 'recap', summary: 1, lines: [{ m: 'happy', t: "Let's recall what we learnt\nabout parallelograms." }] },
    { id: 'end', end: 1, lines: [{ m: 'celebrating', t: 'Amazing work! You know all\nabout parallelograms now.' }] }
  ]
};
