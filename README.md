# Fishing Frenzy 2

A voiced maths adventure about parallelograms, in two parts that play as one journey (as in Fishing Frenzy):

1. **The front page** is Popo's live "Fishing Frenzy 2" banner (`parts/fishing`): Popo on his raft, the logo, Play.
2. **Swiftee's parallelogram lesson** (`parts/lesson`): on the lake floor a seashell opens, its pearl blows up the
   lesson's card and Swiftee, in her diving mask, dives in. 59 screens: from a trapezium to a parallelogram, its sides,
   angles and diagonals, three checkpoints and a recall. Each screen moves on by itself once its voice is done; a
   screen that asks for something waits for it.
3. **Popo's parallelogram nets** (`parts/fishing`): eight nets, each a property of the parallelogram to set before the
   net drops, to "The End"; Play Again goes back to the front page.

## Run it

Static files, no build step: `python3 -m http.server 8000` at this folder's root, then open http://localhost:8000/.

- `?dev=1`: one panel (bottom left, folds with the backtick key) that jumps to the front page, any lesson screen or any
  part of the fishing game.
- `?start=fishing`: Play skips the lesson. `?debug`: `window.lessonDebug` in the lesson, `window.popoDebug` in the game.
- `parts/lesson/index.html?solo`: the lesson on its own page.

## How it fits together

`index.html` and `shell/journey.js` are the journey: the fishing game plays in one full-window frame (its banner is
the front page), the lesson in another laid over it, and they hand over to each other with a dissolve. Every part loads
`shell/bridge.js` first, which connects it to the journey: the Play tap unlocks one AudioContext and one `<audio>` in
the journey's page and the lesson plays its voice through them, so it needs no tap of its own. Each part's README
describes its game.

## Deploy

On Vercel: no build command, no output folder. `vercel.json` makes browsers revalidate each file; `.vercelignore`
leaves the tests, tools and docs out.

## Tests (Python Playwright)

- `python3 tests/lesson.py [chromium|webkit] [WxH] [touch]`: the whole lesson with real taps and drags.
- `python3 tests/journey.py`: the journey, from the banner's Play to the fishing and back.
