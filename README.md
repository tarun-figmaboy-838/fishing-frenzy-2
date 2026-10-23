# Fishing Frenzy 2

A voiced maths adventure about parallelograms: part 2 of Fishing Frenzy, played the way part 1 is, as one journey:

1. **The front page** is Popo's live "Fishing Frenzy 2" banner (`parts/fishing`): Popo on his raft, the logo, Play.
2. **The warm-up** (`parts/fishing`): Popo fishes with his net on the winch; the child just taps Drop Net as fish swim
   under it, three catches, Popo cheering each. Then the problem: a giant fish grabs the net and pulls it out of square
   before it breaks free ("Whoa! A giant fish!", "Come on, big fish!", "Huh?! I haven't seen that one before!");
   Swiftee swoops in with "Let's find out!" and Next, and the giant wave carries Popo away.
3. **Swiftee's parallelogram lesson** (`parts/lesson`), played over the game's own lake, as in part 1: the game goes on
   drawing its water and fish under the lesson's see-through frame, and the lesson's camera glides the game's view down
   to the sand, where a seashell opens, its pearl blows up the
   lesson's card and Swiftee, in her diving mask, dives in. 59 screens: from a trapezium to a parallelogram, its sides,
   angles and diagonals, three checkpoints and a recall. Each screen moves on by itself once its voice is done; a
   screen that asks for something waits for it.
4. **Popo's parallelogram nets** (`parts/fishing`): the wave brings Popo back, Swiftee welcomes him ("Great job!"), and
   eight nets, each a property to set before the net drops, asked as the
   lesson asks it; then "The End", and Play Again goes back to the front page.

Two voices only: Popo's, and Swiftee's studio voice for every other line in both parts.

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
