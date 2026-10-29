(function (PopoGame) {
'use strict';

// The eight nets, the four fishing locations and the story lines.

// waterline: where the water meets the sky in the painting (the stage shifts the painting down,
// see SCENE_SHIFT). Levels move on to the next location as they go.
const LOCATIONS = [
  { name: 'Snowy Bay', background: 0, waterline: 388 },
  { name: 'Iceberg Cove', background: 1, waterline: 390 },
  { name: 'Glacier Pass', background: 2, waterline: 387 },
  { name: 'Northern Waters', background: 3, waterline: 388 },
];

// The corners are A top-left, B top-right, C bottom-right and D bottom-left, clockwise. Each
// level's solved net is a parallelogram: `width`, `height` and `lean` (how far the top edge
// sits to the right of the bottom edge), or `angleA` instead of a lean. `corner` is the one
// the child moves. It never stretches freely: it slides along a track through its place, the
// line of the side or diagonal named in `along` (a diagonal runs toward the opposite corner),
// clicking from stop to stop, and `start` is how many stops from its place it begins (negative
// toward the first corner named). The track is chosen so dragging changes what the level is about.
// `metres` gives a side's length in centimetres (the lesson's unit, so the nets ask what Swiftee asks there), which
// sets the scale of every measurement shown; with two, both show as given.
// Each level teaches one property; `type` picks the check (see Net.check).
// The first net is the warm-up's (`type: 'free'`: nothing to set, Drop Net, `drops` catches). The story no longer
// plays it as a level: its 420 x 200 frame is the one the hook's nets hang from (HOOK_NETS, sequences.js hook), and the
// hook goes straight on to the first parallelogram net. The eight nets after the lesson teach the parallelogram.
// Every line on the plate (a prompt, a hint) is one Swiftee has recorded - the lesson's own, or Fishing Frenzy's -
// so the whole game is heard in her voice and Popo's only (voice-data.js). `both`: both pairs of sides light up.
// Every prompt is what to do (drag this to make that: short, so its one-line plate stays readable on a phone, the
// values given being on the net itself); `hints` are a wrong net's two lines, said after it tangles:
// what is off and which way to go, [the part set is under, over] what it should be (Net.missFor reads which from the
// frame itself, so a hint is always true there).
const LEVELS = [
  { title: 'Warm-up', warmup: true, type: 'free', drops: 3, corner: 'C', along: 'DC',
    width: 420, height: 200, angleA: 90, start: 0, // Popo's net as it is: a rectangle, nothing to set
    location: 0, fish: 4,
    prompt: "Now, let's help Popo catch some *fish!*", hint: '' },
  { title: 'Make it Parallel', type: 'parallel', sides: ['BC', 'AD'], corner: 'B', along: 'AB',
    width: 440, height: 200, lean: 60, start: -5, // slides along AB (so AB stays parallel to CD), from the left of its place
    location: 0, fish: 3,
    prompt: 'Drag vertex B to make BC *parallel* to AD.',
    hints: ['AB is shorter than CD. Make AB *longer*.', 'AB is longer than CD. Make AB *shorter*.'] },
  { title: 'Complete the Parallelogram', type: 'parallel', sides: ['AB', 'CD'], both: true, corner: 'C', along: 'BC',
    width: 440, height: 210, lean: -60, start: -6, // slides along BC (so BC stays parallel to AD), from B's side
    location: 0, fish: 4,
    prompt: 'Drag vertex C to make AB *parallel* to CD.',
    hints: ['BC is shorter than AD. Make BC *longer*.', 'BC is longer than AD. Make BC *shorter*.'] },
  { title: 'Match the Opposite Side', type: 'length', side: 'CD', reference: 'AB', metres: { AB: 7 }, corner: 'C', along: 'DC',
    width: 420, height: 200, lean: 50, start: -6, // CD starts at about 5 cm
    location: 1, fish: 4,
    prompt: 'Drag vertex C to make CD *equal* to AB.',
    hints: ['Opposite sides are equal. Make CD *longer*.', 'Opposite sides are equal. Make CD *shorter*.'] },
  { title: 'Use Both Side Properties', type: 'sides', metres: { AB: 8, BC: 5 }, corner: 'D', along: 'BD',
    width: 380, height: 230, lean: 60, start: -7, // slides along the diagonal, toward B (AB and BC stay as they are)
    location: 1, fish: 5,
    prompt: 'Drag vertex D so that opposite sides are *equal*.',
    hints: ['Opposite sides are equal. Make CD and AD *longer*.', 'Opposite sides are equal. Make CD and AD *shorter*.'] },
  { title: 'Match the Opposite Angle', type: 'angle', vertex: 'C', reference: 'A', degrees: 68, corner: 'C', along: 'DC',
    width: 420, height: 210, angleA: 68, start: -7, // angle C starts near 100 degrees
    location: 2, fish: 5,
    prompt: 'Drag vertex C to make ∠C *equal* to ∠A.',
    hints: ['Opposite angles are equal. Make ∠C *bigger*.', 'Opposite angles are equal. Make ∠C *smaller*.'] },
  { title: 'Make the Adjacent Angle', type: 'supplementary', vertex: 'B', reference: 'A', degrees: 72, corner: 'B', along: 'AB',
    width: 420, height: 210, angleA: 72, start: 8, // angle B starts near 85 degrees
    location: 2, fish: 6,
    prompt: 'Drag vertex B so that ∠A and ∠B add up to *180°*.',
    hints: ['Adjacent angles add up to 180°. Make ∠B *bigger*.', 'Adjacent angles add up to 180°. Make ∠B *smaller*.'] },
  { title: 'Balance the Diagonals', type: 'diagonals', metres: { AB: 6 }, corner: 'C', along: 'DC',
    width: 440, height: 210, lean: 50, start: -8, // along DC, so both diagonals' halves change as it slides
    location: 3, fish: 7,
    prompt: 'Drag vertex C so that the diagonals *bisect* each other.',
    hints: ['The diagonals bisect each other. Make OC *longer*.', 'The diagonals bisect each other. Make OC *shorter*.'] },
  { title: 'Final Catch', type: 'parallelogram', metres: { AB: 6 }, corner: 'D', along: 'BD',
    width: 400, height: 210, lean: 30, rotate: -7, start: -9, // slides along the diagonal, toward B
    location: 3, fish: 9, rare: true,
    prompt: 'Drag vertex D to make a *parallelogram*.',
    hints: ['Opposite sides are equal. Make CD *longer*.', 'Opposite sides are equal. Make CD *shorter*.'] },
];

// The catch to go for over the eight nets, the Master Catch: the most a run can net is about 95 (the biggest bunch
// each time, caught whole), so it takes good choices and good timing, and a run that falls short has a reason to go
// again (The End shows the catch against it: Game.theEnd, UI.showGoal).
const GOAL = 75;

// Play Again brings new nets (Game.playAgain): the same eight lessons in the same order, but each net its own shape
// (a little wider or taller, leaning more or less, the corner starting elsewhere on its track), the final net turned
// a little differently, and the tour of the waters starting one lake on, so a second game is never the first again.
const BASE_LEVELS = LEVELS.map((l) => ({ ...l }));
function freshLevels(run) {
  const vary = (v, lo, hi) => v * (lo + Math.random() * (hi - lo));
  LEVELS.splice(0, LEVELS.length, ...BASE_LEVELS.map((b) => {
    const l = { ...b };
    if (!run || b.warmup) return l;
    if (Object.keys(b.metres || {}).length > 1) {
      // a net that gives more than one side's length (AB = 8 cm and BC = 5 cm) keeps its shape, only its size changes,
      // so every length it gives stays true of it (AB sets the scale; reshaped, BC came out 4.8 to 5.4 cm)
      const k = vary(1, 0.92, 1.08);
      l.width = Math.round(b.width * k);
      l.height = Math.round(b.height * k);
      if (b.lean !== undefined) l.lean = Math.round(b.lean * k);
    } else {
      l.width = Math.round(vary(b.width, 0.92, 1.08));
      l.height = Math.round(vary(b.height, 0.92, 1.08));
      if (b.lean !== undefined) l.lean = Math.round(vary(b.lean, 0.7, 1.3));
    }
    if (b.rotate !== undefined) l.rotate = b.rotate + Math.round((Math.random() - 0.5) * 6);
    l.start = Math.sign(b.start) * Math.max(4, Math.abs(b.start) + (Math.random() < 0.5 ? -1 : 1));
    l.location = (b.location + run) % LOCATIONS.length;
    return l;
  }));
  return LEVELS;
}

// The fish Popo nets, drawn in assets/sprites/fish-natural.webp (tools/build-assets.py).
const NATURAL_FISH = Object.keys(PopoGame.FISH_NATURAL_ATLAS.boxes);

function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A level's sea holds one school of fish - 10 to 14 middling ones, a mix of kinds (three or four of them, every fish its
// own) and sizes - so the child's whole task is the moment: Catch as it swims under the net. It swims quicker net by
// net (Game.spawnSchool). No two levels in a row open with the same kinds.
const SCHOOL_SIZES = [0.48, 0.6];  // its fish's size: small (the hook's sea), middling (the nets)
const SCHOOL_COUNT = [10, 14];     // ...and how many
let lastKinds = [];
function bunchesFor(level) {
  let pool = shuffle(NATURAL_FISH);
  if (pool.slice(0, 3).every((key) => lastKinds.includes(key))) pool = [NATURAL_FISH.find((key) => !lastKinds.includes(key)) || pool[0], ...pool.slice(1)];
  lastKinds = pool.slice(0, 3);
  const [lo, hi] = SCHOOL_COUNT, n = 3 + Math.floor(Math.random() * 2); // (its kinds: three or four)
  // (the hook's sea - the warm-up net's - is small fish, the size of the school that swims into its net, so no fish
  // there looks giant beside it)
  const size = level && level.warmup ? SCHOOL_SIZES[0] : SCHOOL_SIZES[1];
  return [{ kinds: pool.slice(0, n), key: pool[0], count: lo + Math.floor(Math.random() * (hi - lo + 1)), size: size + (Math.random() - 0.5) * 0.04 }];
}

// Story lines, delivered word by word. *Stressed* words land bigger with a boing, and a cue
// fires a moment in the scene when its word appears (see Game.storyCue).
const STORY = {
  // Popo only reacts, as he does in Fishing Frenzy (his lines are his recordings from there):
  // a catch, a wrong net, a right net that came up empty, the golden school, and the end
  oops: { who: 'popo', text: 'Whoopsie Doopsie!' },
  empty: { who: 'popo', text: 'Huh?!' },
  golden: { who: 'popo', text: '*Woah!*', cue: { word: 0, do: 'hop' } },
  complete: [{ who: 'popo', text: '*Wow!*', cue: { word: 0, do: 'hop' } }, { who: 'popo', text: 'What a *catch!*' }],
  // the warm-up's catches: Popo cheers each one (his recordings from Fishing Frenzy)
  cheers: [
    { who: 'popo', text: 'Great *catch!*' },
    { who: 'popo', text: '*Wow!*' },
    { who: 'popo', text: 'Ha ha *ha!*' },
  ],
  // the hook before the lesson (sequences.js hook): Popo's net keeps tangling until a leaping fish knocks its corner into
  // a parallelogram, which stays open and makes the catch; Swiftee names the shape and the lesson finds out why. These
  // ten lines only, in this order (h1 ... h10); `tail`: how long a line stays up after its voice (ms), short, so the
  // story keeps moving
  hook: {
    h1: { who: 'narrator', text: 'Popo was out fishing today.', tail: 500 },
    h2: { who: 'popo', text: "Let's catch lots of *fish!*", cue: { word: 0, do: 'hop' }, tail: 300 },
    h3: { who: 'popo', text: 'Oh no! This net got *tangled.*', tail: 500 },
    h4: { who: 'narrator', text: 'Popo tried different net shapes, but they kept getting *tangled.*', tail: 300 },
    h5: { who: 'popo', text: 'I need a net that stays *open* in the water!', tail: 400 },
    h6: { who: 'popo', text: 'Hey! This one stayed *open!*', tail: 400 },
    h7: { who: 'popo', text: 'It worked! What *shape* is this?', tail: 400 },
    h8: { who: 'swiftee', text: 'This shape is called a *parallelogram.*', cue: { word: 5, do: 'trace' }, tail: 500 },
    h9: { who: 'popo', text: 'Parallelogram? What *shape* is that?', tail: 400 },
    h10: { who: 'swiftee', text: "Let's find *out!*", cue: { word: 2, do: 'twirl' }, tail: 300 },
  },
  // after the lesson: the giant wave has brought Popo back, and Swiftee swoops in from it
  welcome: [
    { who: 'swiftee', text: '*Great* job!', cue: { word: 0, do: 'twirl' } },
  ],
};

// The hook's nets, on the warm-up's net (its 420 x 200 frame): A top-left, B top-right, C bottom-right, D bottom-left,
// each [x, dy] - x from the ring, dy from the frame's top (A, B) or bottom (C, D) edge (never below it: the net hangs
// clear of the water). Three wrong ones, simple and convex but with no sides parallel, which tangle in the water; then
// the leaping fish knocks the third one's corner C onto B + D - A, and the net is a parallelogram (AB and DC level and
// equal, AD and BC both leaning 60), which stays open.
const HOOK_NETS = {
  wrong: [
    [[-140, 16], [160, -10], [250, 0], [-270, -12]], // (narrow at the top, flaring out)
    [[-230, 30], [200, -36], [240, -4], [-262, -14]], // (lopsided: short on the left, tall on the right)
    [[-200, 0], [220, 0], [300, -24], [-260, 0]], // (the parallelogram but for corner C, flared out to the right)
  ],
  right: [[-200, 0], [220, 0], [160, 0], [-260, 0]],
  // each tangle's uneven pull on the corners: the order the corners give way in (A 0, B 1, C 2, D 3), how far each is
  // pulled (px), and the lean (radians) the pulls add up to - a different failure each time
  pulls: [
    { order: [2, 1, 3, 0], twist: 0.2, by: [[16, 10], [-12, 26], [-36, -14], [30, -24]] },
    { order: [0, 3, 1, 2], twist: -0.24, by: [[24, 18], [10, -12], [-30, -20], [-6, -30]] },
    { order: [3, 2, 0, 1], twist: 0.26, by: [[-10, 26], [-26, 8], [-16, -34], [34, -10]] },
  ],
};
// the parallelogram nets (the warm-up is not one of them)
const NETS = LEVELS.filter((l) => !l.warmup).length;

Object.assign(PopoGame, { LOCATIONS, LEVELS, NETS, GOAL, freshLevels, NATURAL_FISH, STORY, HOOK_NETS, shuffle, bunchesFor });
})(window.PopoGame = window.PopoGame || {});
