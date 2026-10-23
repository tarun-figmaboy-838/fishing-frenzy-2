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
// The first net is the warm-up, before the lesson (as Fishing Frenzy's shape fishing is): just fun, nothing to set -
// Popo's usual net, a rectangle, and the child taps Drop Net when fish swim under it (`type: 'free'`), `drops` times,
// Popo cheering each catch. Then the journey's problem (sequences.js, mystery): a giant fish grabs the net and pulls it
// out of square before it breaks free; Popo has never seen that shape, and Swiftee flies in with "Let's find out!". The eight nets after the lesson teach the parallelogram.
// Every line on the plate (prompt, praise, hint) is one Swiftee has recorded - the lesson's own, or Fishing Frenzy's -
// so the whole game is heard in her voice and Popo's only (voice-data.js). `both`: both pairs of sides light up.
const LEVELS = [
  { title: 'Warm-up', warmup: true, type: 'free', drops: 3, corner: 'C', along: 'DC',
    width: 420, height: 200, angleA: 90, start: 0, // Popo's net as it is: a rectangle, nothing to set
    location: 0, fish: 4, hintDelay: 4,
    prompt: "Now, let's help Popo catch some *fish!*", praise: '', hint: '' },
  { title: 'Make it Parallel', type: 'parallel', sides: ['BC', 'AD'], corner: 'B', along: 'AB',
    width: 440, height: 200, lean: 60, start: -5, // slides along AB (so AB stays parallel to CD), from the left of its place
    location: 0, fish: 3, hintDelay: 3.5,
    prompt: 'Drag vertex B to make BC *parallel* to AD.',
    praise: 'Well done! Now BC is parallel to AD.',
    hint: 'Drag B to the right until BC leans the same way as AD.' },
  { title: 'Complete the Parallelogram', type: 'parallel', sides: ['AB', 'CD'], both: true, corner: 'C', along: 'BC',
    width: 440, height: 210, lean: -60, start: -6, // slides along BC (so BC stays parallel to AD), from B's side
    location: 0, fish: 4, hintDelay: 5,
    prompt: 'What if we made the other pair of opposite sides *parallel* too?',
    praise: 'Now both pairs of opposite sides are parallel.',
    hint: 'Look for *parallel* sides!' },
  { title: 'Match the Opposite Side', type: 'length', side: 'CD', reference: 'AB', metres: { AB: 7 }, corner: 'C', along: 'DC',
    width: 420, height: 200, lean: 50, start: -6, // CD starts at about 5 cm
    location: 1, fish: 4, hintDelay: 5,
    prompt: 'In this parallelogram, AB = *7 cm*. What is the length of CD?',
    praise: "That's right! Opposite sides are equal, so CD = 7 cm.",
    hint: 'CD is opposite AB. Opposite sides of a parallelogram are equal.' },
  { title: 'Use Both Side Properties', type: 'sides', metres: { AB: 8, BC: 5 }, corner: 'D', along: 'BD',
    width: 380, height: 230, lean: 60, start: -7, // slides along the diagonal, toward B (AB and BC stay as they are)
    location: 1, fish: 5, hintDelay: 6,
    prompt: 'In this parallelogram, AB = *8 cm* and BC = *5 cm*. Find the lengths of CD and AD.',
    praise: 'Brilliant! CD = AB = 8 cm and AD = BC = 5 cm.',
    hint: 'CD is opposite AB, and AD is opposite BC.' },
  { title: 'Match the Opposite Angle', type: 'angle', vertex: 'C', reference: 'A', degrees: 68, corner: 'C', along: 'DC',
    width: 420, height: 210, angleA: 68, start: -7, // angle C starts near 100 degrees
    location: 2, fish: 5, hintDelay: 6,
    prompt: 'In this parallelogram, ∠A = *68°*. What is the measure of ∠C?',
    praise: "That's right! Opposite angles are equal, so ∠C = 68°.",
    hint: '∠C is opposite ∠A. What do you know about opposite angles?' },
  { title: 'Make the Adjacent Angle', type: 'supplementary', vertex: 'B', reference: 'A', degrees: 72, corner: 'B', along: 'AB',
    width: 420, height: 210, angleA: 72, start: 8, // angle B starts near 85 degrees
    location: 2, fish: 6, hintDelay: 6,
    prompt: 'In this parallelogram, ∠A = *72°*. What is the measure of ∠B?',
    praise: 'Correct! 72° + 108° = 180°.',
    hint: '∠B is next to ∠A. Adjacent angles add up to 180°.' },
  { title: 'Balance the Diagonals', type: 'diagonals', metres: { AB: 6 }, corner: 'C', along: 'DC',
    width: 440, height: 210, lean: 50, start: -8, // along DC, so both diagonals' halves change as it slides
    location: 3, fish: 7, hintDelay: 7,
    prompt: 'Each diagonal is divided into two equal parts by the *other*.',
    praise: 'Perfect! AO = OC, BO = OD, so the diagonals bisect each other.',
    hint: 'OC is the other half of AC, and OD is the other half of BD.' },
  { title: 'Final Catch', type: 'parallelogram', metres: { AB: 6 }, corner: 'D', along: 'BD',
    width: 400, height: 210, lean: 30, rotate: -7, start: -9, // slides along the diagonal, toward B
    location: 3, fish: 9, rare: true, hintDelay: 9,
    prompt: 'A *parallelogram* is a quadrilateral with two pairs of opposite sides parallel.',
    praise: 'You *did* it!',
    hint: 'So, in any parallelogram, opposite sides are parallel and equal.' },
];

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

// A level's sea holds three schools of fish, never one of fewer than eight, each its own size - a shoal of small fish
// (8 to 16), a school of middling ones (8 to 11) and one of big ones (8 or 9) - each a mix of kinds (three or four of
// them, every fish its own) and sizes, the three swimming one way in a spaced line (see Sea), so they never run into
// each other and the child picks which to catch. No two levels in a row open with the same kinds.
const BUNCHES = 3;
const BUNCH_SIZES = [0.48, 0.6, 0.72];  // the bunches' fish sizes: small, middling, big (three clouds fit round the sea)
const BUNCH_COUNTS = [[8, 16], [8, 11], [8, 9]]; // ...and how many of each: never a school of fewer than eight
let lastKinds = [];
function bunchesFor(level) {
  let pool = shuffle(NATURAL_FISH);
  if (pool.slice(0, 3).every((key) => lastKinds.includes(key))) pool = [NATURAL_FISH.find((key) => !lastKinds.includes(key)) || pool[0], ...pool.slice(1)];
  lastKinds = pool.slice(0, 3);
  const order = shuffle([0, 1, 2]); // which lane gets which bunch
  return order.map((b, i) => {
    const [lo, hi] = BUNCH_COUNTS[b], n = 3 + Math.floor(Math.random() * 2); // (its kinds: three or four)
    return { kinds: pool.slice(i * 4, i * 4 + n), key: pool[i * 4], count: lo + Math.floor(Math.random() * (hi - lo + 1)), size: BUNCH_SIZES[b] + (Math.random() - 0.5) * 0.04 };
  });
}

// Story lines, delivered word by word. *Stressed* words land bigger with a boing, and a cue
// fires a moment in the scene when its word appears (see Game.storyCue).
const STORY = {
  intro: [
    { who: 'narrator', text: 'Popo *loves* fishing.', cue: { word: 1, do: 'hop' } },
    { who: 'narrator', text: 'And today…' },
    { who: 'narrator', text: 'he wants to catch *all* kinds of fish!', cue: { word: 4, do: 'fishIn' } },
  ],
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
  // the warm-up's end, the journey's problem (as Fishing Frenzy's mystery fish): a giant fish grabs the net, Popo heaves,
  // and it breaks free, leaving the net pulled out of square into a shape Popo has never seen
  mystery: {
    whoa: { who: 'popo', text: 'Whoa! A *giant* fish!', cue: { word: 0, do: 'exclaim' } },
    heave: { who: 'popo', text: 'Come *on*, big fish!' },
    huh: { who: 'popo', text: 'Huh?!', cue: { word: 0, do: 'wonder' } },
    after: { who: 'popo', text: "I haven't seen *that* one before!" },
    // stays up beside Swiftee until Next is pressed
    swiftee: { who: 'swiftee', text: "Let's find *out!*", cue: { word: 2, do: 'twirl' }, stay: true },
  },
  // after the lesson: the giant wave has brought Popo back, and Swiftee swoops in from it
  welcome: [
    { who: 'swiftee', text: '*Great* job!', cue: { word: 0, do: 'twirl' } },
  ],
};

// the parallelogram nets (the warm-up is not one of them)
const NETS = LEVELS.filter((l) => !l.warmup).length;

Object.assign(PopoGame, { LOCATIONS, LEVELS, NETS, NATURAL_FISH, STORY, shuffle, bunchesFor });
})(window.PopoGame = window.PopoGame || {});
