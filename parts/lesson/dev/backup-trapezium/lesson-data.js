// =====================================================================
// LESSON — every learning state and check, in play order.
//   lines: narration (t = on-screen text, \n = line break in the bubble, s = optional spoken text (keep: 1 + s = voice only, the bubble keeps the previous line;
//          glow = sides that pulse yellow while the line is spoken, e.g. ['AB', 'CD'];
//          pulse: 1 = the shape zooms up once and returns to its size when the line's voice-over ends,
//          or as the pulseAt word is spoken (e.g. pulseAt: 'trapezium');
//          growAt: 'word' = the shape (held small by assemble) comes forward once to full size as that word is said;
//          glowAt: 'word' = glow/callout wait until that word is said (yellow then lingers ~1.5 s);
//          callout: 'bases' | 'legs' = a "Base"/"Legs" label with arrows to AB and CD appears as the voice starts and stays), chips = labels shown with the line,
//          m = Swiftee's expression while saying it; default talking. reactions in CONFIG.swiftee)
//   task:  what the learner must do before Next unlocks (extLegs, extBases, tapBases, tapLegs, measure,
//          dragA, dragAny (any corner, until the legs differ), dragFree (any corner, any move), drag90 (any corner to a right angle), tapAngles, dragD90, tapAD, dragD, dragC); hint = how-to Swiftee says if the learner stalls (unless idle is set)
//   navigation is manual (CONFIG.flow.autoAdvance false): screens change only on Next / Back. With it on, a finished
//   screen moves on CONFIG.flow.advanceMs after its last line; autoAdvance overrides that wait (ms)
//   handOnce: a single demo hand gesture as the screen opens, never repeated; wrongRight: { cm, side } = dragging the
//          corner right more than cm from its start wiggles that side once with the incorrect sound
//   assemble: 1 = the shape fades out and re-forms from its four sides, each flying in from its own direction
//          (top, right, bottom, left), then a settling glow, dots and fill (CSS .asm)
//   build: 1 = the panel starts empty and the shape draws itself (glowing pen D->A->B->C->D, then a settling glow and
//          the fill fading in) as the screen's first line starts (CONFIG.build)
//   labelsIn: 1 on a line = the corner letters (hidden by assemble) fade back in, A to D, as the line starts
//   voiceDelay: ms Swiftee waits before speaking, so an opening animation can finish first
//   locked: no Back either (an instruction-only screen with nothing to do)
//   after: lines played once the task is done
//   boardShift: px to slide the shape left (-) or right (+) on that screen (glides there and back)
//   layout: 'focus' = after the line the bubble fades (focusHold ms after the voice-over, default CONFIG.focus.holdMs)
//           and the shape moves to centre stage; the shape can only be tapped once it is there;
//           'top' = Swiftee small at top-left, bubble beside her at the top, shape large in the centre;
//           'spotlight' centres and enlarges the shape, moves Swiftee to the right (pose = held expression)
//   f:     board display flags (met = legs extended to where they meet, legGlow = legs highlighted, sideLen = base lengths shown too, baseExt, par, legsPurple, legLen, ticks, arcs, right, eq)
//   auto: 1 on the measure step = Swiftee measures every side by herself (no taps);
//         on extLegs / extBases = one side at a time, a glowing pink line draws along it, then its dotted extension draws on (no taps)
//   practice: a quick question with opts / ok / okChips that is not scored; noBoard: no shape; layout 'recap': the recap card
//   cfu:   check number; opts (ok / fb feedback), ok = praise line; qFocus: after the question the bubble fades,
//          the shape glides to the centre and the answers come in one by one below it
// =====================================================================
const LESSON = {
  steps: [
    // build: the shape draws itself edge by edge while Swiftee talks, then its fill fades in (screen 1);
    // autoNext: once she has finished, it flows straight on to the next screen (screens 1-3: one continuous intro)
    { id: 'intro', build: 1, autoNext: 900, lines: [{ m: 'waving', t: 'Remember we learnt about\nquadrilaterals earlier.' }] },
    // sideNums: the four sides get numbers 1-4 (top, right, bottom, left), each flying in from its own side
    { id: 'quadSides', sideNums: 1, autoNext: 900, lines: [{ m: 'happy', t: 'Any polygon with 4 sides\nis called a quadrilateral.' }] },
    // letterIn: the corner letters start hidden; letters: 1 on the line = each one flies in from its own corner exactly
    // as the voice says it (spoken "A, B, C, D", shown "ABCD")
    { id: 'quadName', letterIn: 1, autoNext: 900, lines: [{ m: 'happy', t: 'We can call it\nquadrilateral ABCD.', s: 'We can call it quadrilateral, A, B, C, D.', letters: 1 }] },
    // assemble: the shape re-forms from its four sides - top, right, bottom, left - each flying in from its own side
    // voiceDelay: she speaks once the outline has closed; growAt: on "special" the shape (held at 88% while it
    // assembled) comes forward once to full size with a soft glow; labelsIn: as the next line starts, A B C D fade
    // softly back in one by one
    { id: 'special', assemble: 1, voiceDelay: 3000, lines: [{ m: 'happy', t: 'This is a special type\nof quadrilateral.', growAt: 'special' },
      { m: 'curious', t: "Let's see what\nmakes it special.", labelsIn: 1 }] },
    { id: 'meet', lines: [{ m: 'curious', t: 'These two sides look like they will meet.' }], f: { legGlow: 1 } },
    // instruction only: nothing to tap, no Next/Back; moves on as soon as the voice-over ends
    { id: 'extendSay', autoAdvance: 1, locked: 1, lines: [{ m: 'curious', t: "Let's extend them." }], f: { legGlow: 1 } },
    // opens wordless with the shape at centre stage; no taps: D->A glows, then extends dotted past A; then
    // C->B the same way; both dotted lines stay
    { id: 'extend', layout: 'focus', lines: [], task: 'extLegs', auto: 1,
      after: [{ m: 'surprised', t: 'Woah! The sides meet.', s: 'Whoa! The sides meet.' }] },
    { id: 'other', layout: 'focus', focusHold: 2500, lines: [{ m: 'curious', t: "Let's check the other\npair of sides." }], task: 'extBases', auto: 1 }, // no taps: A->B glows then extends both ways, then D->C (same system as screen 4)
    { id: 'parallel', boardShift: -45, lines: [{ m: 'surprised', t: 'They do not meet.' }], f: { baseExt: 1 } },
    { id: 'abcd', lines: [{ t: 'This means the sides are parallel to each other.' },
      { keep: 1, s: 'A B is parallel to C D.', glow: ['AB', 'CD'], chips: [{ t: 'AB ∥ CD', k: 'white' }] }], f: { par: 1 } },
    { id: 'onePair', lines: [{ t: "So this quadrilateral has\none pair of parallel sides.", chips: [{ t: 'AB ∥ CD', k: 'white' }] }], f: { par: 1 } },
    { id: 'def', lines: [{ t: 'We call this a trapezium.', pulse: 1, pulseAt: 'trapezium', chips: [{ t: 'Trapezium', k: 'name' }] }], f: { par: 1 } },
    { id: 'defFull', lines: [{ t: 'A quadrilateral with at least\none pair of parallel sides\nis called a trapezium.', chips: [{ t: 'Trapezium', k: 'name' }] }], f: { par: 1 } },
    { id: 'bases', boardShift: -40, lines: [{ t: 'The parallel sides\nare called bases.', glow: ['AB', 'CD'], callout: 'bases' }], f: { par: 1 } },
    { id: 'legs', boardShift: -40, lines: [{ t: 'And the non-parallel sides\nare called legs.', glow: ['DA', 'BC'], glowAt: 'legs', callout: 'legs' }], f: { par: 1 } },
    { id: 'measure', lines: [{ m: 'curious', t: "Let's measure the sides\nof this trapezium." }], task: 'measure', auto: 1, hint: 'Tap the glowing side to measure it', idle: 'Tap the glowing side and I will measure it.', f: { par: 1, legsPurple: 1 } },
    { id: 'scalene', lines: [{ m: 'surprised', t: 'Woah! All the sides of\nthis trapezium are of\ndifferent lengths.', s: 'Whoa! All the sides of this trapezium are of different lengths.' }, { t: 'This type of trapezium which\nhas sides of different lengths\nis called a scalene trapezium.', chips: [{ t: 'Scalene trapezium', k: 'name' }] }],
      f: { par: 1, legsPurple: 1, legLen: 1, sideLen: 1 } },
    { id: 'equal', lines: [{ m: 'curious', t: "Let's change its\nshape a little." }], f: { par: 1, legsPurple: 1, legLen: 1, sideLen: 1 } },
    // the drag itself: Swiftee and the bubble move to the top, the shape takes centre stage
    { id: 'equalDrag', layout: 'top', lines: [{ m: 'curious', t: 'Drag vertex A so that both\nthe legs are of equal length.' }],
      // one demo hand as the line ends, then the learner drags alone. A dragged right (the wrong way: AD only grows)
      // -> right leg BC wiggles + incorrect sound. A can move at most ~0.75 cm right before B stops it, so the limit sits below that.
      // Equal legs on release -> snap + correct sound + praise (finishTask)
      task: 'dragA', handOnce: 1, wrongRight: { cm: 0.5, side: 'BC' }, hint: 'Drag point A along the top side', after: [{ m: 'happy', t: 'Perfect! Both legs are equal.' }],
      f: { par: 1, legsPurple: 1, legLen: 1, sideLen: 1 } },
    { id: 'iso', lines: [{ m: 'happy', t: 'Yay! Now the legs are of same lengths.' }, { t: 'A trapezium where legs are\nof same length is called\nan isosceles trapezium.', chips: [{ t: 'Isosceles trapezium', k: 'name' }] }],
      f: { par: 1, legsPurple: 1, legLen: 1, ticks: 1, sideLen: 1 } },
    // try it back: any corner may move; done once the legs differ again
    { id: 'scalDrag', layout: 'top', lines: [{ m: 'curious', t: 'Drag any vertex to make\nthis a scalene trapezium.' }],
      task: 'dragAny', hint: 'Drag any corner along its side', idle: 'Drag any corner so the legs are no longer equal.',
      after: [{ m: 'happy', t: 'Yes! Now it is a scalene trapezium.', chips: [{ t: 'Scalene trapezium', k: 'name' }] }],
      f: { par: 1, legsPurple: 1, legLen: 1, sideLen: 1 } },
    { id: 'sidesDone', lines: [{ m: 'happy', t: 'We know all about the sides\nof a trapezium.', chips: [{ t: 'Trapezium', k: 'name' }] }], f: { par: 1 } },
    { id: 'angles', lines: [{ m: 'curious', t: "Let's look at its angles." }], f: { par: 1, arcs: 'ABCD' } },
    { id: 'notice', lines: [{ m: 'thinking', t: 'Did you notice something?' }], f: { par: 1, arcs: 'ABCD' } },
    { id: 'sumAD', lines: [{ m: 'surprised', t: '∠A and ∠D add up to 180°.', glow: ['DA'], chips: [{ t: '∠A + ∠D = 180°', k: 'gold' }] }], f: { par: 1, arcs: 'ABCD' } },
    { id: 'supp', lines: [{ m: 'happy', t: 'That means they are\nsupplementary angles.', chips: [{ t: '∠A + ∠D = 180°', k: 'gold' }] }], f: { par: 1, arcs: 'ABCD' } },
    // quick practice question (not scored): pick the sum of ∠B and ∠C
    { id: 'askBC', practice: 1, optTop: 476, chipTop: 105, boardShiftY: -11, // question card on top, shape, answers below idle: 'Add ∠B and ∠C. They sit on the same leg, BC.',
      lines: [{ m: 'curious', t: 'What about ∠B and ∠C?', glow: ['BC'], chips: [{ t: '∠B + ∠C = ?', k: 'white' }] }],
      ok: 'Correct! ∠B and ∠C are\nsupplementary angles too.', okChips: [{ t: '∠B + ∠C = 180°', k: 'gold' }],
      opts: [
        { id: '90', t: '90°', fb: 'Not quite. Add the two angles on leg BC.' },
        { id: '180', t: '180°', ok: true },
        { id: '360', t: '360°', fb: '360° is all four angles. Just add ∠B and ∠C.' }
      ], f: { par: 1, arcs: 'ABCD' } },
    { id: 'whatIf', lines: [{ m: 'curious', t: 'What if we change the shape\nof this trapezium?' }], f: { par: 1, arcs: 'ABCD' } },
    { id: 'dragSum', layout: 'top', lines: [{ m: 'curious', t: 'Drag any vertex to change\nthe angles. Notice the\nsum of angles.' }],
      task: 'dragFree', hint: 'Drag any corner and watch the sums', idle: 'Drag any corner and watch the two sums.',
      after: [{ m: 'surprised', t: 'The angles changed, but\neach sum is still 180°!' }], f: { par: 1, arcs: 'ABCD', sums: 1 } },
    { id: 'always', lines: [{ m: 'happy', t: 'No matter the shape, the angles\nalways add up to 180°.', chips: [{ t: '∠A + ∠D = 180°', k: 'gold' }, { t: '∠B + ∠C = 180°', k: 'gold' }] }], f: { par: 1, arcs: 'ABCD' } },
    { id: 'rule', lines: [{ t: 'So in any trapezium,\nangles on the same leg\nalways add up to 180°.', chips: [{ t: '∠A + ∠D = 180°', k: 'gold' }, { t: '∠B + ∠C = 180°', k: 'gold' }] }], f: { par: 1, arcs: 'ABCD' } },
    { id: 'make90', layout: 'top', lines: [{ m: 'curious', t: 'Drag any vertex to make any angle 90°.' }],
      task: 'drag90', hint: 'Drag a corner until an angle is 90°', idle: 'Drag a corner slowly and stop when an angle shows 90°.',
      after: [{ m: 'happy', t: 'Great job! One of the angles\nis a right angle.' }], f: { par: 1, arcs: 'ABCD' } },
    { id: 'right', lines: [{ t: 'This type of trapezium where\none of the angles is a right angle\nis called a right angled trapezium.', pulse: 1, pulseAt: 'trapezium', chips: [{ t: 'Right trapezium', k: 'name' }] }],
      f: { par: 1, right: 1 } },
    { id: 'wellDone', noBoard: 1, lines: [{ m: 'celebrating', t: 'Great job! Now you know\nall about trapeziums.' }] },
    { id: 'recap', noBoard: 1, layout: 'recap', lines: [{ m: 'happy', t: "Let's recall what\nwe learnt today." }] },
    { id: 'cfu1', cfu: 1, idle: 'Look for the shape with exactly one pair of parallel sides.', hint: 'Check 1 of 5 · Which one is a trapezium?',
      lines: [{ m: 'curious', t: 'Which of these quadrilaterals is a trapezium? Look for one pair of parallel sides.' }],
      ok: 'Yes! This shape has exactly one pair of parallel sides.',
      opts: [
        { id: 'A', ok: true },
        { id: 'B', fb: 'Look at each side of this shape. No two sides are parallel, so it is not a trapezium.' },
        { id: 'C', fb: 'This shape has no parallel sides at all.' },
        { id: 'D', fb: 'Look at each side of this shape. No two sides are parallel, so it is not a trapezium.' }
      ] },
    { id: 'cfu2', cfu: 2, qFocus: 1, idle: 'Look closely at the marks on the legs.', hint: 'Check 2 of 5 · Which type of trapezium?', optTop: 376,
      lines: [{ m: 'curious', t: 'What type of trapezium is this?' }],
      ok: 'Right! The marks show its legs are equal, so it is an isosceles trapezium.',
      opts: [
        { id: 's', t: 'Scalene trapezium', fb: 'Look at the little marks on the legs. They tell us the legs are equal.' },
        { id: 'i', t: 'Isosceles trapezium', ok: true },
        { id: 'r', t: 'Right trapezium', fb: 'There are no right angles in this shape. Look at the legs instead.' }
      ] },
    { id: 'cfu3', cfu: 3, idle: 'Remember, angles on the same leg add up to 180°.', hint: 'Check 3 of 5 · Find the missing angle', optTop: 433,
      lines: [{ m: 'curious', t: 'In this trapezium, ∠A = 68°. What is the value of ∠D?' }],
      ok: 'Correct! 68° + 112° = 180°.',
      opts: [
        { id: 'a', t: '68°', fb: 'Angles on the same leg add up to 180°, so ∠D is not equal to ∠A.' },
        { id: 'b', t: '112°', ok: true },
        { id: 'c', t: '122°', fb: 'Check your subtraction: 180° − 68° = ?' },
        { id: 'd', t: '180°', fb: '180° is the sum of ∠A and ∠D, not ∠D by itself.' }
      ] },
    { id: 'cfu4', cfu: 4, idle: 'Drag a label onto a shape, or tap a label and then tap a box.', hint: 'Check 4 of 5 · Drag each label to its shape',
      lines: [{ m: 'curious', t: 'Label each trapezium with the correct type.' }],
      ok: 'Brilliant! You labelled all three trapeziums.' },
    { id: 'cfu5', cfu: 5, idle: 'BC is a leg. What do you know about the legs of an isosceles trapezium?', hint: 'Check 5 of 5 · Find the missing side', optTop: 427,
      lines: [{ m: 'curious', t: 'In an isosceles trapezium, AB = 6 cm, CD = 10 cm and AD = 5 cm. What is the length of BC?' }],
      ok: 'Yes! In an isosceles trapezium the legs are equal, so BC = 5 cm.',
      opts: [
        { id: 'a', t: '4 cm', fb: 'BC is a leg. In an isosceles trapezium, both legs are equal.' },
        { id: 'b', t: '5 cm', ok: true },
        { id: 'c', t: '6 cm', fb: '6 cm is the top base AB. BC is a leg, like AD.' },
        { id: 'd', t: '10 cm', fb: '10 cm is the bottom base CD. BC is a leg, like AD.' }
      ] },
    { id: 'end', end: 1, lines: [{ m: 'celebrating', t: 'Amazing work! You know all about trapeziums now.' }] }
  ],
  cfu4: {
    labels: [{ id: 'iso', t: 'Isosceles trapezium' }, { id: 'right', t: 'Right trapezium' }, { id: 'scal', t: 'Scalene trapezium' }],
    slots: [{ id: 's0', ans: 'scal', y: 170 }, { id: 's1', ans: 'iso', y: 274 }, { id: 's2', ans: 'right', y: 378 }]
  }
};
