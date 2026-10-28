(function (PopoGame) {
'use strict';
const { clock, ease, Cancelled, state, PHASE, newToken, isCurrent, Fish, STORY, LEVELS, GOAL, NATURAL_FISH, HOOK_NETS, LESSON_SHAPE, STAGE_W, STAGE_H, geo, TUCK } = PopoGame;

function swallow(e) {
  if (!(e instanceof Cancelled)) throw e;
}

const between = (a, b) => a + Math.random() * (b - a);
// a different fish each time, in a random order
const shuffled = (list) => list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

// --- the opening ---------------------------------------------------------------
// Before the first line, a cartoon entrance: Popo zooms in rowing flat out (honk honk!), slams
// on the brakes with a screech, overshoots and springs back boing-boing, and in a poof the
// paddle is gone and his paws are on the winch's wheel (ta-da!).
async function popoArrives(game, token, { hop = true } = {}) {
  const { popo, fx, audio } = game;
  const reduced = fx.reduced;
  const from = -620;
  const overshoot = reduced ? 0 : 110;
  const stroke = 520; // frantic paddling
  const raftFront = () => popo.raftEnds().right + popo.travelShift;
  popo.travelShift = from;
  popo.startRowing(stroke);
  try {
    await clock.wait(120, token);
    audio.play('honk');
    audio.play('whoosh');
    audio.setTravel(true);
    let lastBlade = popo.paddleTip();
    let lastWake = 0;
    // a fish or two flee ahead of the speeding raft and leap out of its way
    if (!reduced) {
      shuffled(NATURAL_FISH).slice(0, Math.random() < 0.4 ? 1 : 2).forEach((key, i) => {
        clock.wait(i * 260, token).then(() => jump(game, token, key, between(430, 520) + i * 110, 1,
          { height: between(120, 170), ms: between(650, 800), scale: between(0.55, 0.7), speed: between(720, 840) })).catch(() => {});
      });
    }
    const zoom = reduced ? 1300 : 1500;
    await clock.tween(zoom, token, (t) => {
      const elapsed = t * zoom;
      popo.travelShift = from + (overshoot - from) * (t < 0.15 ? (t * t) / 0.3 : t - 0.075) / 0.925;
      popo.setRowingTime(elapsed);
      popo.tilt = -0.03 - popo.rowRig.sample(elapsed, stroke).power * 0.03; // leaning into it
      const blade = popo.paddleTip();
      if (lastBlade && blade && lastBlade.y < game.waterline && blade.y >= game.waterline) {
        const crossing = (game.waterline - lastBlade.y) / (blade.y - lastBlade.y);
        fx.splash(lastBlade.x + (blade.x - lastBlade.x) * crossing, game.waterline, false);
        audio.play('paddle');
      }
      lastBlade = blade;
      if (elapsed - lastWake > 160) {
        lastWake = elapsed;
        const stern = popo.raftEnds().left + popo.travelShift;
        fx.ripple(stern - 12, game.waterline + 6, 0.9);
        if (stern > 0) fx.splash(stern - 6, game.waterline, false); // spray kicked up behind
        fx.splash(stern + 340, game.waterline, false); // and off the bow
      }
    });
    audio.setTravel(false);
    const held = popo.rowing.time;
    if (overshoot) {
      // brakes! the raft screeches past the spot, squashing up in a fan of spray; fish swim
      // over to see what the fuss is about
      fishSaysHello(game, token);
      audio.play('skid');
      audio.play('woah');
      let lastSpray = 0;
      await clock.tween(520, token, (t) => {
        popo.travelShift = overshoot + 34 * Math.sin(t * Math.PI / 2);
        popo.tilt = 0.12 * Math.sin(t * Math.PI);
        popo.squash = 0.12 * Math.sin(t * Math.PI);
        popo.setRowingTime(held);
        if (t - lastSpray > 0.18) { lastSpray = t; fx.splash(raftFront() + 10, game.waterline, true); }
      });
      // ...and springs back onto it, boing-boing
      audio.play('boing');
      const back = overshoot + 34;
      let boinged = false;
      await clock.tween(820, token, (t) => {
        popo.travelShift = back * (1 - ease.outBack(t));
        popo.tilt = -Math.sin(t * Math.PI * 3) * 0.08 * (1 - t);
        popo.squash = -Math.sin(t * Math.PI * 3) * 0.1 * (1 - t);
        popo.setRowingTime(held);
        if (!boinged && t > 0.45) { boinged = true; audio.play('boing'); }
      });
    }
    popo.squash = 0;
    popo.tilt = 0;
    // ta-da: a poof, and the paddle has turned into the handwheel
    const head = popo.headTop();
    game.poof = { x: head.x + 30, y: head.y + 120, t: 0 };
    audio.play('poof');
    await clock.wait(130, token); // the swap happens inside the cloud
  } finally {
    // however the entrance ends (even cancelled by a restart), Popo is left sitting on his spot
    popo.idle();
    popo.travelShift = 0;
    popo.tilt = 0;
    popo.squash = 0;
    if (isCurrent(token)) audio.setTravel(false);
  }
  audio.play('tada');
  fx.sparkle(popo.headTop().x + 40, popo.headTop().y + 50, 18);
  await clock.wait(380, token);
  // a happy hop while the fish leap around him
  if (!hop) return;
  game.storyCue('hop');
  await clock.wait(900, token);
}

// One fish swims in from the edge of the water (from the left or right), leaps out with a
// splash each way, and swims on out of view on the other side.
async function jump(game, token, key, x0, dir, { height = 190, ms = 900, scale = 0.7, speed = 600 } = {}) {
  const { fx, audio } = game;
  const wl = game.waterline;
  const surface = wl + 30;
  const depth = wl + 110 + Math.random() * 70;
  const enterX = dir > 0 ? -80 : STAGE_W + 80;
  const exitX = dir > 0 ? STAGE_W + 80 : -80;
  const dx = speed * (ms / 1000) * 0.45; // the leap carries its run-up speed
  const fish = new Fish(key, enterX, depth, dir, scale);
  game.leapers.push(fish);
  let out = false;
  let back = false;
  let rippled = false;
  let lastBubble = 0;
  try {
    await clock.tween(Math.abs(x0 - enterX) / speed * 1000, token, (t) => {
      fish.x = enterX + (x0 - enterX) * t;
      const rise = Math.max(0, (t - 0.6) / 0.4); // swims level, then up toward the surface
      fish.y = depth + (surface - depth) * rise * rise;
      fish.pitch = -0.5 * rise;
      if (t - lastBubble > 0.15) { lastBubble = t; fx.puff(fish.x - dir * fish.w * 0.45, fish.y, -dir, 1); }
      if (!rippled && t > 0.9) { rippled = true; fx.ripple(x0, wl, 0.7); }
    });
    audio.play('leap');
    await clock.tween(ms, token, (t) => {
      fish.x = x0 + dir * dx * t;
      fish.y = surface - height * 4 * t * (1 - t);
      fish.pitch = Math.max(-0.8, Math.min(0.8, -(1 - 2 * t) * 0.9));
      if (!out && fish.y < wl) { out = true; fx.splash(fish.x, wl, false); audio.play('splashSmall'); }
      if (out && !back && t > 0.5 && fish.y > wl) { back = true; fx.splash(fish.x, wl, true); audio.play('splashSmall'); }
    });
    const x1 = fish.x;
    await clock.tween(Math.abs(exitX - x1) / speed * 1000, token, (t) => {
      fish.x = x1 + (exitX - x1) * t;
      const dive = Math.min(1, t / 0.25);
      fish.y = surface + (depth - surface) * (1 - (1 - dive) ** 2);
      fish.pitch = 0.6 * (1 - dive);
    });
  } finally {
    game.leapers = game.leapers.filter((f) => f !== fish);
  }
}

// A few fish swim in from either side and leap for joy beside the raft, each at its own
// moment, size, height and speed, then swim away. They run on their own.
function fishSaysHello(game, token) {
  const raft = game.popo.raftEnds().right;
  const count = 3 + Math.floor(Math.random() * 2);
  const fish = shuffled(NATURAL_FISH);
  let at = 0;
  for (let i = 0; i < count; i += 1) {
    at += between(100, 380);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x0 = between(raft + 150, raft + 640); // clear of the raft
    const opts = { height: between(110, 220), ms: between(700, 950), scale: between(0.55, 0.72), speed: between(560, 720) };
    clock.wait(at, token).then(() => jump(game, token, fish[i], x0, dir, opts)).catch(() => {});
  }
}

// The banner, played out on the lake itself: Popo zooms in from the left on his raft, a big fish
// leaps out of the water past him, and at the top of its leap the logo pops in; then the Play
// button bobs up out of the water (see TitleScreen).
async function banner(game) {
  const token = newToken();
  const { fx, title } = game;
  const reduced = fx.reduced;
  // Popo starts out of sight, off to the left (popoArrives brings him in)
  game.popo.travelShift = -620;
  try {
    state.phase = PHASE.TITLE;
    await clock.wait(reduced ? 100 : 350, token);
    popoArrives(game, token, { hop: false }).catch(swallow);
    // the logo pops in as he settles, then Play bobs up
    await clock.wait(reduced ? 1600 : 3600, token);
    title.showLogo();
    await clock.wait(reduced ? 200 : 2100, token);
    title.showPlay();
  } catch (e) {
    swallow(e);
  }
}

// The journey opens with the hook (Popo's tangling nets, the fish that makes a parallelogram of one, Swiftee's "Let's
// find out!"), then the lesson in the journey, then the first parallelogram net. From the banner Popo is already in his
// place, so the story starts as its logo clears away.
async function opening(game, { arrived = false } = {}) {
  const token = newToken();
  try {
    state.phase = PHASE.INTRO;
    game.instruct('');
    if (arrived) await clock.wait(game.fx.reduced ? 150 : 450, token);
    else await popoArrives(game, token);
    await hook(game, token);
    await onward(game, token, () => afterHook(game, token));
  } catch (e) {
    swallow(e);
  }
}

// On from a finished screen (the hook, a caught net) - unless the journey's Back / Next bar has been used (review):
// then the screen holds where it ended, and only the bar moves on.
async function onward(game, token, next) {
  if (game.review) { if (state.phase !== PHASE.INTRO) state.phase = PHASE.LEVEL_COMPLETE; return; }
  await next();
}

// Straight to the first parallelogram net, without the story (Play Again on the game's own page): its waters, its
// school, and its net let down.
async function startLevels(game) {
  const token = newToken();
  try {
    state.phase = PHASE.INTRO;
    const first = LEVELS.findIndex((l) => !l.warmup);
    if (LEVELS[first].location !== state.locationIndex) { state.locationIndex = LEVELS[first].location; game.applyLocation(); }
    const before = game.prepareLevel(first);
    game.fishIn();
    await clock.wait(400, token);
    await letNetDown(game, token, before);
    game.beginPuzzle();
  } catch (e) {
    swallow(e);
  }
}

// --- the net between catches ----------------------------------------------------------
// Popo winds the net up: he cranks, the ring rises to the pulley and the net gathers into a
// bundle under it, swaying as it goes.
const GATHER_ROPE = 160; // the rope gathering the net draws in, beyond the ring's own travel

async function windNetUp(game, token) {
  const { net, winch, audio, fx } = game;
  const ms = fx.reduced ? 700 : 1100;
  const from = winch.ropeOut;
  const to = Math.min(from, -TUCK); // a hauled-up bag already hangs high; it never drops to gather
  const pouch = net.pouch;
  let last = net.furl;
  net.locked = true;
  winch.working = -1;
  audio.crank(ms / 1000);
  await clock.tween(ms, token, (t) => {
    const k = ease.inOut(t);
    net.furl = k;
    net.pouch = pouch * (1 - k); // an emptied bag opens out as it gathers
    winch.setRopeOut(from + (to - from) * k);
    winch.turn(-(k - last) * GATHER_ROPE);
    last = k;
    net.swing = fx.reduced ? 0 : Math.sin(t * Math.PI * 3) * 0.035 * (1 - t);
  });
  net.swing = 0;
  net.pouch = 0;
  winch.working = 0;
}

// ...and lets it down: the bundle drops from the pulley and opens into the frame. `from` is the
// frame it was wound up in (the last net's), so it changes shape as it opens, never jumps.
async function letNetDown(game, token, from = null) {
  const { net, winch, audio, fx } = game;
  const ms = fx.reduced ? 700 : 1000;
  const after = net.points.map((p) => ({ ...p }));
  const before = from || after;
  const start = winch.ropeOut;
  let last = net.furl;
  net.points = before.map((p) => ({ ...p }));
  net.locked = true;
  winch.working = 1;
  audio.crank(ms / 1000);
  await clock.tween(ms, token, (t) => {
    const k = ease.inOut(t);
    net.furl = 1 - k;
    net.points = after.map((p, i) => geo.lerp(before[i], p, k));
    winch.setRopeOut(start * (1 - ease.outBack(t)));
    winch.turn((last - net.furl) * GATHER_ROPE);
    last = net.furl;
  });
  net.points = after;
  net.furl = 0;
  winch.setRopeOut(0);
  winch.working = 0;
}

// --- the puzzle -------------------------------------------------------------------
// A right frame: the corner (already on its exact place, the one stop that has the property)
// locks with a click, and no words say so - the shape does: the frame flashes, the property lights
// up step by step, the outline runs round it (as the hook's open net's did) and every corner
// sparkles, all while the net goes down: the child dropped it now, for the fish under it, so nothing
// holds it back. The plate clears (its question is answered).
function lockAnswer(game, result) {
  const { net, popo, fx, audio } = game;
  const level = LEVELS[state.level];
  net.solve(result.snap);
  audio.play('snap');
  const snapped = net.toStage(result.snap);
  fx.sparkle(snapped.x, snapped.y, 14);
  popo.react('happy', 1.2);
  net.showGlow(net.glowFor(level), level.type === 'parallelogram' ? 0.5 : 0.8);
  net.traceOutline(0.55, 0.35, 0.6);
  for (const p of net.points) { const at = net.toStage(p); fx.sparkle(at.x, at.y, 5); }
  audio.play('success');
  audio.play('shimmer');
  game.instruct('');
}

// After the hint the prompt returns, and the child carries on from the frame as they left it;
// its corner gives a wobble to say it's the one to fix.
function backToPuzzle(game, level) {
  const { net, ui, audio } = game;
  game.instruct(level.prompt, { voice: false, pace: 0.09 });
  net.locked = false;
  net.wobble = 1;
  audio.play('wobble');
  state.phase = PHASE.PUZZLE_READY;
  state.idleTime = state.misses >= 2 ? 1.5 : 0; // (after two misses the ghost hint comes sooner: 1.5 s of its 3)
  ui.showHandle(true);
  if (level.type === 'free') ui.setDrop('on'); else { ui.setAction('hidden'); game.focusOn(); } // (Check comes once the corner is moved)
}

// --- the nets after the lesson: Check, a tangle or a catch -------------------------------------
// The net goes down (payOut keeps the rope, the ring and the mesh together), splashing in and bubbling, over `ms`.
async function lowerNet(game, token, ms) {
  const { net, winch, popo, fx, audio } = game;
  const reduced = fx.reduced;
  const depth = game.catchDepth();
  const from = winch.ropeOut;
  const payOut = (length) => {
    winch.setRopeOut(length);
    net.origin = popo.transformPoint(winch.hang.x, winch.hang.y);
    net.drop = winch.ropeOut;
    net.ropePhase = winch.ropeOut;
  };
  winch.working = 1;
  audio.crank(ms / 1000);
  let splashed = net.ring().y + net.bottom() >= game.waterline;
  let lastBubble = 0;
  const sway = net.swing;
  await clock.tween(ms, token, (t) => {
    const k = ease.inOut(t); // (under way at once, as a winch paying out: no long hesitation before it moves)
    payOut(from + (depth - from) * k);
    net.swing = reduced ? 0 : (sway + Math.sin(t * Math.PI * 2) * 0.012) * (1 - t);
    const bottom = net.ring().y + net.bottom();
    if (!splashed && bottom >= game.waterline) {
      splashed = true;
      game.netSplash();
    }
    if (splashed && t - lastBubble > 0.12) {
      lastBubble = t;
      const corner = net.toStage(net.points[Math.random() < 0.5 ? 2 : 3]);
      fx.puff(corner.x, corner.y, 0, 1);
    }
  });
  net.swing = 0;
  winch.working = 0;
}

// ...and comes up, over `ms`: closing into a bag round a catch (`caught`), rising HAUL above its rest so the bag
// clears the water; empty, back to where it hangs.
async function raiseNet(game, token, caught, ms) {
  const { net, winch, popo, fx, audio } = game;
  const reduced = fx.reduced;
  const from = winch.ropeOut;
  const lift = caught.length ? HAUL : 0;
  const payOut = (length) => {
    winch.setRopeOut(length);
    net.origin = popo.transformPoint(winch.hang.x, winch.hang.y);
    net.drop = winch.ropeOut;
    net.ropePhase = winch.ropeOut;
  };
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  winch.working = -1;
  audio.crank(ms / 1000);
  let surfaced = net.ring().y + net.bottom() < game.waterline;
  await clock.tween(ms, token, (t) => {
    const k = smooth(t);
    payOut(from * (1 - k) - lift * k);
    if (caught.length) net.pouch = 0.55 + 0.45 * smooth(Math.min(1, t / 0.55));
    net.swing = reduced || !caught.length ? 0 : Math.sin(t * Math.PI * 2) * 0.026 * Math.sin(t * Math.PI);
    const bottom = net.ring().y + net.bottom();
    if (!surfaced && bottom < game.waterline) {
      surfaced = true;
      game.netSplash();
      audio.play('drip');
    }
    if (surfaced && Math.random() < 0.12) fx.drips(net.toStage(net.meshPoint(0.3 + Math.random() * 0.4, 1)));
  });
  winch.setRopeOut(-lift);
  winch.working = 0;
}

// Check: the frame is tested for the level's property. A right one locks and glows; a wrong one first shows what is
// off while the view is still in on it - the parts that don't match pulse red and the corner shakes - and the hint
// that will follow is read from the frame as it is (Net.missFor). Either way the net goes slowly down while the view,
// zoomed in for the drag, opens out again with it. Right, it sits open in the water with Catch for the child; wrong,
// it tangles (tangled) and the hint says which way to go.
async function checkNet(game) {
  const token = newToken();
  const { net, popo, fx, audio, ui } = game;
  const reduced = fx.reduced;
  try {
    const result = net.check();
    const right = result.ok;
    ui.showHandle(false);
    ui.setAction('hidden');
    const level = LEVELS[state.level];
    let hint = level.hint;
    if (right) lockAnswer(game, result);
    else {
      game.instruct('');
      audio.stopVoice();
      const miss = net.missFor(level);
      if (level.hints) hint = level.hints[miss.over ? 1 : 0];
      net.showMiss(miss.steps);
      net.wobble = 1;
      audio.play('wobble');
      popo.react('think', 1.2);
    }
    game.netRight = right;
    state.phase = PHASE.CHECKING;
    net.locked = true;
    popo.squash = 0.07; // Popo takes hold of the wheel
    await clock.wait(right ? (reduced ? 200 : 320) : (reduced ? 500 : net.miss.steps.length * net.miss.each * 1000), token);
    const down = reduced ? 1100 : 2400;
    game.focusOut(down);
    await lowerNet(game, token, down);
    if (!right) { await tangled(game, token, hint); return; }
    state.phase = PHASE.FISHING;
    state.idleTime = 0;
    ui.setAction('catch');
  } catch (e) {
    swallow(e);
  }
}

// A wrong net can't hold a shape: in the water the mesh crumples into a tangle (the fish under it dart away), Popo
// is baffled ("Whoopsie Doopsie!"), the hint (what is off and which way to go: checkNet) shows and Try again is the
// child's.
async function tangled(game, token, hint) {
  const { net, popo, fx, audio, ui } = game;
  state.phase = PHASE.TANGLED;
  state.misses += 1;
  for (const f of state.fish) if (!f.gone && !f.waiting && !f.caught && net.contains(f)) f.startle();
  audio.play('struggle');
  popo.react('think', 1.8);
  let lastPuff = 0;
  await clock.tween(fx.reduced ? 300 : 1000, token, (t) => {
    net.tangle = fx.reduced ? 1 : 1 - (1 - t) ** 3;
    net.swing = fx.reduced ? 0 : Math.sin(t * 46) * 0.045 * (1 - t);
    if (t - lastPuff > 0.15) {
      lastPuff = t;
      const p = net.toStage(net.meshPoint(0.2 + Math.random() * 0.6, 0.3 + Math.random() * 0.5));
      fx.puff(p.x, p.y, 0, 2, true);
    }
  });
  net.tangle = 1;
  net.swing = 0;
  audio.play('wobble');
  await game.say(STORY.oops, token);
  popo.react('think', 1.4);
  game.instruct(hint);
  ui.setAction('again');
}

// Try again: the tangled net comes up and is wound in, untangled while it's bundled, and comes down in the shape
// the level started with; the prompt returns and the child goes again.
async function tryAgain(game) {
  const token = newToken();
  const { net, fx, audio, ui } = game;
  const level = LEVELS[state.level];
  try {
    ui.setAction('hidden');
    state.phase = PHASE.TRANSITIONING;
    await raiseNet(game, token, [], fx.reduced ? 700 : 1300);
    await windNetUp(game, token);
    net.tangle = 0; // untangled while it's bundled up
    const bundle = net.toStage({ x: 0, y: net.bottom() });
    fx.sparkle(bundle.x, bundle.y - 30, 10);
    audio.play('puff');
    net.stopAt = Math.max(net.track.min, Math.min(net.track.max, level.start));
    net.points[net.movable] = net.stop(net.stopAt);
    net.drawn = null;
    net.touched = false;
    await letNetDown(game, token);
    backToPuzzle(game, level);
  } catch (e) {
    swallow(e);
  }
}

// Catch: the right net, open in the water, closes round whichever bunch is under it and comes up. Fish caught: the
// catch is Popo's and the next net follows; none: "Huh?!", and the net goes down again for another go.
async function catchNow(game) {
  const token = newToken();
  const { net, winch, popo, fx, audio, ui } = game;
  const reduced = fx.reduced;
  try {
    ui.setAction('hidden');
    state.phase = PHASE.CATCHING;
    const caught = state.fish.filter((f) => !f.gone && !f.leaving && !f.waiting && net.contains(f));
    if (caught.length) audio.play('bubbles');
    for (const f of caught) {
      f.catchAt(net.uvOf(net.toNet(f)));
      fx.puff(f.x, f.y, 0, 2, true);
      await clock.wait(70, token);
    }
    await clock.wait(reduced ? 250 : 420, token);
    if (caught.length) {
      // the mouth closes under the water before the loaded bag rises
      const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
      winch.working = -1;
      audio.crank(0.55);
      let gathered = 0;
      await clock.tween(reduced ? 300 : 550, token, (t) => {
        const k = smooth(t);
        net.pouch = 0.55 * k;
        winch.turn(-24 * (k - gathered));
        gathered = k;
      });
    }
    state.phase = PHASE.NET_RAISING;
    await raiseNet(game, token, caught, reduced ? 1100 : 1800);
    if (!caught.length) {
      popo.react('think', 1.2);
      audio.play('wobble');
      await game.say(STORY.empty, token);
      state.phase = PHASE.CHECKING;
      await lowerNet(game, token, reduced ? 700 : 1300);
      state.phase = PHASE.FISHING;
      state.idleTime = 0;
      ui.setAction('catch');
      return;
    }
    state.phase = PHASE.LEVEL_COMPLETE;
    state.caught += caught.length;
    popo.react('laugh', 1.6);
    audio.play('catch');
    const ring = net.ring();
    fx.sparkle(ring.x, ring.y + net.bottom() * 0.7, 16);
    for (const f of caught) f.wiggle();
    game.confettiFrom(ring.x, ring.y + net.bottom() * 0.6);
    audio.play('combo3');
    game.storyCue('hop');
    await clock.wait(reduced ? 300 : 800, token);
    await collectFish(game, caught, token);
    await onward(game, token, () => nextLevel(game, token));
  } catch (e) {
    swallow(e);
  }
}

// --- the catch ------------------------------------------------------------------------
// Hauled up with a catch, the ring rises this far above where it rests, so the bag the net
// closes into clears the water.
const HAUL = 42;

// Drop Net tests the frame for the level's property. A right one locks and goes
// down; a wrong one goes down all the same. In the water it nets whichever fish are under it as
// it lands, so the child drops it as fish swim beneath. Hauled up, it closes into a bag around
// its catch. A wrong net's catch breaks out; a right net that caught nothing comes up empty,
// still right, to be dropped again.
async function dropNet(game) {
  const token = newToken();
  const { net, winch, popo, fx, audio, ui } = game;
  const reduced = fx.reduced;
  try {
    const result = net.check();
    // once the frame has been right this level it stays right: only the timing is left to try
    const right = game.netRight || result.ok;
    ui.showHandle(false);
    ui.setDrop('hidden');
    if (right && !game.netRight) {
      lockAnswer(game, result);
    } else {
      game.instruct('');
      audio.stopVoice();
    }
    const justLocked = right && !game.netRight;
    game.netRight = right;
    state.phase = PHASE.NET_LOWERING;
    net.locked = true;
    popo.squash = 0.07; // Popo takes hold of the wheel
    // a right frame holds a moment, clicked into place and glowing, so the
    // child sees what was right before the net goes down
    await clock.wait(justLocked ? (reduced ? 300 : 650) : 200, token);

    const depth = game.catchDepth();
    // Update payout and its dependent geometry together, before splash/capture checks.
    const payOut = (length) => {
      winch.setRopeOut(length);
      net.origin = popo.transformPoint(winch.hang.x, winch.hang.y);
      net.drop = winch.ropeOut;
      net.ropePhase = winch.ropeOut;
    };
    const smooth = (t) => t*t*t*(t*(t*6-15)+10);
    const down = reduced ? 1100 : 1800;
    winch.working = 1;
    audio.crank(down / 1000);
    let splashed = false;
    let lastBubble = 0;
    const sway = net.swing; // carried on from the idle sway, so the net never jumps
    await clock.tween(down, token, (t) => {
      const k = smooth(t);
      payOut(depth * k);
      net.swing = reduced ? 0 : (sway + Math.sin(t * Math.PI * 2) * 0.012) * (1 - t);
      const bottom = net.ring().y + net.bottom();
      if (!splashed && bottom >= game.waterline) {
        splashed = true;
        game.netSplash();
      }
      if (splashed && t - lastBubble > 0.12) {
        lastBubble = t;
        const corner = net.toStage(net.points[Math.random() < 0.5 ? 2 : 3]);
        fx.puff(corner.x, corner.y, 0, 1);
      }
    });
    net.swing = 0;
    winch.working = 0;

    // the frame settles over whoever swam under it; each fish inside is netted in turn
    state.phase = PHASE.CATCHING;
    const caught = state.fish.filter((f) => !f.gone && !f.leaving && !f.waiting && net.contains(f));
    if (caught.length) audio.play('bubbles');
    for (const f of caught) {
      f.catchAt(net.uvOf(net.toNet(f)));
      fx.puff(f.x, f.y, 0, 2, true);
      await clock.wait(70, token);
    }
    await clock.wait(reduced ? 250 : 420, token);

    // Take up slack first: the mouth closes underwater before the loaded bag rises.
    if (caught.length) {
      winch.working = -1;
      audio.crank(0.55);
      let gathered = 0;
      await clock.tween(reduced ? 300 : 550, token, (t) => {
        const k = smooth(t);
        net.pouch = 0.55 * k;
        winch.turn(-24 * (k - gathered));
        gathered = k;
      });
    }

    // up it comes, closing into a bag around its catch, the fish sliding down into its belly
    state.phase = PHASE.NET_RAISING;
    const up = reduced ? 1100 : 1800;
    const lift = caught.length ? HAUL : 0;
    winch.working = -1;
    audio.crank(up / 1000);
    let surfaced = false;
    await clock.tween(up, token, (t) => {
      const k = smooth(t);
      payOut(depth * (1 - k) - lift * k);
      if (caught.length) net.pouch = 0.55 + 0.45 * smooth(Math.min(1, t / 0.55));
      net.swing = reduced || !caught.length ? 0 : Math.sin(t * Math.PI * 2) * 0.026 * Math.sin(t * Math.PI);
      const bottom = net.ring().y + net.bottom();
      if (!surfaced && bottom < game.waterline) {
        surfaced = true;
        game.netSplash();
        audio.play('drip');
      }
      if (surfaced && Math.random() < 0.12) fx.drips(net.toStage(net.meshPoint(0.3 + Math.random() * 0.4, 1)));
    });
    winch.setRopeOut(-lift);
    winch.working = 0;
    if (right) game.instruct(''); // (the catch speaks for itself)

    if (!right) {
      await netBreaks(game, caught, token);
      return;
    }
    if (!caught.length) {
      await emptyNet(game, token);
      return;
    }
    state.phase = PHASE.LEVEL_COMPLETE;
    state.caught += caught.length;
    popo.react('laugh', 1.6);
    audio.play('catch');
    const ring = net.ring();
    fx.sparkle(ring.x, ring.y + net.bottom() * 0.7, 16);
    for (const f of caught) f.wiggle();
    // no words: a burst of bright bubbles from the bag and a party toot, as in Fishing Frenzy
    game.confettiFrom(ring.x, ring.y + net.bottom() * 0.6);
    audio.play('combo3');
    game.storyCue('hop');
    // the warm-up: Popo cheers each catch (on the nets after the lesson the shape's own glow has said it: no words)
    const cheer = LEVELS[state.level].type === 'free' ? game.say(STORY.cheers[game.warmCatches % STORY.cheers.length], token) : null;
    if (cheer) cheer.catch(() => {});
    await clock.wait(fx.reduced ? 300 : 800, token);
    await collectFish(game, caught, token);
    if (cheer) await cheer;
    await onward(game, token, () => nextLevel(game, token));
  } catch (e) {
    swallow(e);
  }
}

// A right net that came up empty: the fish swam on before it landed. Popo is baffled ("Huh?!"),
// and Drop Net comes back for another try when fish are under the net; the frame stays right.
async function emptyNet(game, token) {
  const { popo, audio, ui } = game;
  popo.react('think', 1.2);
  audio.play('wobble');
  await game.say(STORY.empty, token);
  state.phase = PHASE.PUZZLE_READY;
  state.idleTime = 0;
  ui.setDrop('on');
}

// A wrong net can't hold its catch: the fish thrash in the bag until it tears, and they drop
// back into the sea. The level's hint shows while Popo winds the net up and lets it down
// (mended, if it tore), in the shape the child left it.
async function netBreaks(game, caught, token) {
  const { net, popo, fx, audio } = game;
  const level = LEVELS[state.level];
  state.phase = PHASE.NET_BREAKING;
  if (caught.length) {
    // the catch thrashes, and the net jerks on its rope
    audio.play('struggle');
    let next = 0;
    await clock.tween(fx.reduced ? 500 : 1000, token, (t) => {
      if (t >= next) {
        next += 0.25;
        for (const f of caught) f.wiggle();
      }
      // jerks that grow, and still at the very end so the tear starts from rest
      net.swing = fx.reduced ? 0 : Math.sin(t * 50) * 0.03 * Math.min(1, 0.3 + 0.8 * t) * Math.min(1, (1 - t) * 8);
    });
    net.swing = 0;
    // ...until the bag tears
    audio.play('rip');
    popo.react('think', 1.8);
    const hole = net.toStage(net.tearHole().centre);
    for (const x of [-40, 0, 40]) fx.drips({ x: hole.x + x, y: hole.y });
    net.burst = { t: 0 };
    await clock.tween(220, token, (t) => { net.tear = 1 - (1 - t) ** 2; });
    net.tear = 1;
    audio.play('woah');
    await Promise.all([...caught.map((f, i) => escape(game, f, i, hole, token)), game.say(STORY.oops, token)]);
  } else {
    await game.say(STORY.oops, token);
  }
  state.misses += 1;
  popo.react('think', 1.4);
  // the hint stays up a moment after it's said; it may be cancelled (a restart) before it's
  // awaited, so its rejection is handled here too
  const shown = game.instruct(level.hint);
  const hinted = clock.wait(Math.max(1800, shown * 1000 + 800), token);
  hinted.catch(() => {});
  const torn = net.tear > 0;
  await windNetUp(game, token);
  if (torn) {
    // mended while it's bundled up
    net.tear = 0;
    const bundle = net.toStage({ x: 0, y: net.bottom() });
    fx.sparkle(bundle.x, bundle.y - 30, 10);
    audio.play('puff');
  }
  await letNetDown(game, token);
  await hinted;
  backToPuzzle(game, level);
}

// A netted fish wriggles free through the tear: out of the mesh in a little hop the way its lane
// swims, down into the sea with a splash, and on to its lane's depth to swim with its school
// again (the Sea eases it back into its place in the lane).
async function escape(game, f, i, hole, token) {
  const { fx, audio } = game;
  const waterline = game.waterline;
  await clock.wait(i * 110, token);
  const from = { x: f.x, y: f.y };
  const dir = f.lane ? f.lane.dir : (Math.sign(hole.x - from.x) || 1);
  const entry = { x: from.x + dir * between(20, 60), y: waterline + 8 };
  const land = { x: entry.x + dir * between(60, 120), y: f.lane ? f.lane.y : entry.y + 60 };
  const hop = between(30, 60);
  f.caught = null;
  f.dir = dir;
  await clock.tween(between(480, 620), token, (t) => {
    f.x = from.x + (entry.x - from.x) * t;
    // up in a hop, then falling faster and faster
    f.y = from.y - hop * 4 * t * (1 - t) + (entry.y - from.y) * t * t;
    const fall = -hop * 4 * (1 - 2 * t) + 2 * (entry.y - from.y) * t;
    f.pitch = Math.max(-0.7, Math.min(1.1, fall / 500));
  });
  fx.splash(entry.x, waterline, false);
  fx.ripple(entry.x, waterline + 4, 0.8);
  audio.play('splashSmall');
  await clock.tween(between(600, 800), token, (t) => {
    const k = 1 - (1 - t) ** 2;
    f.x = entry.x + (land.x - entry.x) * k;
    f.y = entry.y + (land.y - entry.y) * k;
    f.pitch = 0.9 * (1 - k);
  });
  // swimming again, from exactly where it is (on its float, so it never jumps)
  f.frozen = false;
  f.pitch = 0;
  f.lastY = f.y;
  f.baseY = f.y - Math.sin(f.driftPhase) * f.driftAmp;
  f.speed = f.lane ? f.lane.speed : 50;
  f.puffs += 2;
}

// Fish hop from their exact mesh position into the moving bucket, then pass behind
// its rim. The whole fish remains intact; no instant flip or visible disappearance.
async function collectFish(game, fish, token) {
  const { popo, fx, audio } = game;
  const batch = { left: fish.length, total: fish.length };
  const flights = fish.map((f, i) => clock.wait(i * 150, token).then(() => {
    const from = { x: f.x, y: f.y };
    f.caught = null;
    f.flying = true;
    const duration = Math.max(780, Math.min(1150, Math.abs(from.x-popo.bucketPoint().x)*1.2));
    return clock.tween(duration, token, (t) => {
      const bucket = popo.bucketPoint();
      const k = t*t*(3-2*t);
      const peak = { x:(from.x+bucket.x)/2, y:Math.min(from.y,bucket.y)-130 };
      f.x = (1-k)*(1-k)*from.x + 2*(1-k)*k*peak.x + k*k*bucket.x;
      f.y = (1-k)*(1-k)*from.y + 2*(1-k)*k*peak.y + k*k*(bucket.y+10);
      f.scale = 1 - 0.65*k;
      f.landing = t > 0.82;
      const sink = Math.max(0,(t-0.88)/0.12);
      f.alpha = 1-sink*sink*(3-2*sink);
    }).then(() => {
      f.gone = true;
      const bucket = popo.bucketPoint();
      fx.sparkle(bucket.x, bucket.y-10, 8);
      audio.play('collect');
      // ...and up to the counter
      game.flyToCounter(f, batch);
    });
  }));
  await Promise.all(flights);
}

// --- the hook before the lesson (STORY.hook, H1-H10) ---------------------------------------------------------------
// Popo goes fishing with a net that isn't a parallelogram: in the water its corners pull unevenly, the frame twists and
// the mesh tangles - three times, quicker each time. Then a leaping fish knocks the third net's corner onto the
// parallelogram's place; that net stays open in the water, a school swims into it and the catch comes up. Swiftee names
// the shape, Popo wonders what it is, and "Let's find out!" carries the net's outline into the lesson's first shape (in
// the journey) - or, on the game's own page, the first net follows. Every moment the story needs is scripted (the leap,
// the bump, the school, the catch); the sea's own schools swim on round them. Nothing can be pressed meanwhile.

// a hook net's corners, in net coordinates (levels.js HOOK_NETS: x, and dy from the frame's top or bottom edge)
function hookNet(net, shape) {
  const ys = net.solved.map((p) => p.y), top = Math.min(...ys), bottom = Math.max(...ys);
  return shape.map(([x, dy], i) => ({ x, y: (i < 2 ? top : bottom) + dy }));
}

// Popo winds the rope in a touch with a crank of his wheel, gripping it: the beat before he lets the net go.
async function readyNet(game, token, ms) {
  const { winch, popo, audio } = game;
  const from = winch.ropeOut;
  popo.squash = 0.07;
  winch.working = -1;
  audio.crank(ms / 1000);
  await clock.tween(ms, token, (t) => { winch.setRopeOut(from - 16 * Math.sin((t * Math.PI) / 2)); });
  winch.working = 0;
}

// The wrong net in the water: its corners are pulled unevenly - one after another (`pull.order`), each its own way and
// distance (`pull.by`, and the lean `pull.twist` the uneven pulls add up to) - so the frame loses its shape and the mesh
// tangles; the net is never turned or shrunk as a whole, and the sling stays on its corners. The fish under it dart off.
async function tangleNet(game, token, ms, pull) {
  const { net, fx, audio } = game;
  const from = net.points.map((p) => ({ ...p }));
  const c = { x: from.reduce((t, p) => t + p.x, 0) / 4, y: from.reduce((t, p) => t + p.y, 0) / 4 };
  const lean = (p) => ({ x: c.x + (p.x - c.x) * Math.cos(pull.twist) - (p.y - c.y) * Math.sin(pull.twist), y: c.y + (p.x - c.x) * Math.sin(pull.twist) + (p.y - c.y) * Math.cos(pull.twist) });
  const to = from.map((p, i) => { const q = lean(p); return { x: q.x + pull.by[i][0], y: q.y + pull.by[i][1] }; });
  const order = pull.order || [0, 1, 2, 3], LAG = 0.17, SPAN = 1 - LAG * 3;
  audio.play('tangle');
  for (const f of state.fish) if (!f.gone && !f.waiting && !f.caught && net.contains(f)) f.startle();
  let lastPuff = 0;
  await clock.tween(ms, token, (t) => {
    net.points = from.map((p, i) => {
      const k = fx.reduced ? Math.min(1, t * 2) : ease.inOut(Math.min(1, Math.max(0, (t - order.indexOf(i) * LAG) / SPAN)));
      return geo.lerp(p, to[i], k);
    });
    net.tangle = fx.reduced ? Math.min(1, t * 2) : 1 - (1 - t) ** 2;
    net.swing = fx.reduced ? 0 : Math.sin(t * 30) * 0.035 * (1 - t);
    if (t - lastPuff > 0.16) {
      lastPuff = t;
      const p = net.toStage(net.meshPoint(0.2 + Math.random() * 0.6, 0.3 + Math.random() * 0.5));
      fx.puff(p.x, p.y, 0, 2, true);
    }
  });
  net.points = to;
  net.swing = 0;
}

// Out of the water the tangle shakes out and the net takes its next shape (`to`), wobbling on its rope.
async function reshapeNet(game, token, ms, to) {
  const { net, fx, audio } = game;
  const from = net.points.map((p) => ({ ...p })), tangle = net.tangle;
  audio.play('wobble');
  await clock.tween(ms, token, (t) => {
    const k = ease.inOut(t);
    net.points = from.map((p, i) => geo.lerp(p, to[i], k));
    net.tangle = tangle * (1 - k);
    net.swing = fx.reduced ? 0 : Math.sin(t * Math.PI * 4) * 0.03 * (1 - t);
  });
  net.points = to.map((p) => ({ ...p }));
  net.tangle = 0;
  net.swing = 0;
}

// One wrong try: the crank, down into the water, the tangle, a little "wah-wah" and Popo's puzzled tilt, a moment
// tangled in the water, and up it comes, tangled. `pace` under 1 is quicker.
async function wrongTry(game, token, pull, pace) {
  const { popo, audio, fx } = game;
  const q = fx.reduced ? 0.6 : 1;
  await readyNet(game, token, 450 * pace * q);
  await lowerNet(game, token, 1800 * pace * q);
  await tangleNet(game, token, 1700 * pace * q, pull);
  audio.play('fail');
  popo.react('think', 1.6);
  await clock.wait(450 * pace * q, token);
  await raiseNet(game, token, [], 1400 * pace * q);
}

// H6: a fish swims up under the net, leaps, and its nose bumps corner C: the corner swings over onto `to` (B + D - A,
// the parallelogram's place) and settles there, the rope wobbling, while the fish drops back with a splash and swims off.
async function fishBumpsCorner(game, token, to) {
  const { net, fx, audio } = game;
  const wl = game.waterline, corner = () => net.toStage(net.points[2]), q = fx.reduced;
  const c0 = corner();
  // (a giant of the sea's own fish, four times the school that follows it into the net: its leap is the moment to watch)
  const fish = new Fish(NATURAL_FISH[Math.floor(Math.random() * NATURAL_FISH.length)], 0, 0, -1, 2);
  fish.x = c0.x + 300 + fish.w;
  fish.y = wl + 130 + fish.h / 2;
  game.leapers.push(fish);
  // its nose, from its middle (the art faces right; dir turns it and pitch tilts it, as Fish.draw does): the leap tops
  // out with the nose on the corner, however big the fish
  const nose = (pitch) => { const a = pitch * fish.dir; return { x: fish.dir * 0.45 * fish.w * Math.cos(a), y: fish.dir * 0.45 * fish.w * Math.sin(a) }; };
  try {
    // it comes in under the water, rising towards the corner
    const start = { x: fish.x, y: fish.y }, launch = { x: c0.x + fish.w * 0.55 + 40, y: wl + fish.h * 0.2 };
    await clock.tween(q ? 400 : 900, token, (t) => {
      const k = ease.inOut(t);
      fish.x = start.x + (launch.x - start.x) * k;
      fish.y = start.y + (launch.y - start.y) * k;
      fish.pitch = -0.45 * k;
      if (Math.random() < 0.3) fx.puff(fish.x + fish.w * 0.4, fish.y, 1, 1);
    });
    // the leap: one arc out of the water, the fish tilting with its flight, its nose meeting the corner just before
    // the top of the arc - so the hit is seen
    audio.play('leap');
    fx.splash(launch.x, wl, true);
    const from = { x: fish.x, y: fish.y }, n = nose(-0.6), hit = { x: c0.x - n.x, y: c0.y - n.y }, top = hit.y - 70;
    await clock.tween(q ? 250 : 640, token, (t) => {
      const u = 1 - t;
      fish.x = from.x + (hit.x - from.x) * t;
      fish.y = u * u * from.y + 2 * u * t * top + t * t * hit.y; // (a parabola through its peak)
      fish.pitch = -0.95 + 0.35 * t;
    });
    // the hit: a moment's stillness, the fish squashed against the corner, a burst of sparks and the bump
    audio.play('bump');
    fx.sparkle(c0.x, c0.y, 14);
    fx.puff(c0.x, c0.y, 0, 3, true);
    fish.squash = q ? 0 : 1;
    await clock.wait(q ? 0 : 160, token);
    // the push: the corner slides to its new place along the hit and the net swings and settles; the fish bounces off
    // and tumbles back into the water with a big splash
    const was = { ...net.points[2] }, fall = { x: fish.x, y: fish.y };
    let back = false;
    await clock.tween(q ? 400 : 1000, token, (t) => {
      net.points[2] = geo.lerp(was, to, q ? t : ease.out(t));
      net.swing = q ? 0 : -0.05 * Math.sin(t * Math.PI * 2.5) * (1 - t);
      fish.squash = Math.max(0, 1 - t * 5);
      fish.x = fall.x + 110 * t;
      fish.y = fall.y - 70 * t + 560 * t * t;
      fish.pitch = -0.6 + 2.2 * t; // (a tumble)
      if (!back && fish.y > wl) { back = true; fx.splash(fish.x, wl, true); fx.ripple(fish.x, wl + 4, 1.4); audio.play('splashBig'); } // (a big fish, a big splash)
    });
    fx.sparkle(corner().x, corner().y, 6); // (the corner where it stays)
    net.points[2] = { ...to };
    net.swing = 0;
    const gone = { x: fish.x, y: fish.y };
    fish.dir = 1;
    clock.tween(1300, token, (t) => { fish.x = gone.x + 760 * t; fish.y = gone.y + (wl + 170 - gone.y) * Math.min(1, t * 2); fish.pitch = 0.3 * (1 - t); })
      .then(() => { game.leapers = game.leapers.filter((f) => f !== fish); }).catch(() => {});
  } catch (e) {
    game.leapers = game.leapers.filter((f) => f !== fish);
    throw e;
  }
}

// H7: a school swims in from the right and slows to a stop right inside the open net: each fish has its own place in
// the net (three staggered rows of four, a little uneven), so the whole school always ends up in it. Its fish keep a
// lane of their own, which the sea leaves alone.
const SCHOOL_SLOTS = [0.3, 0.52, 0.74].flatMap((v, row) => [0.2, 0.4, 0.6, 0.8].map((u) => [u + (row % 2 ? 0.05 : -0.05), v]));
async function schoolSwimsIn(game, token, ms) {
  const { net } = game;
  const lane = { dir: -1, y: net.toStage(net.meshPoint(0.5, 0.5)).y, speed: 0 };
  const kinds = shuffled(NATURAL_FISH).slice(0, 3);
  const fish = SCHOOL_SLOTS.map(([u, v], i) => {
    const at = net.toStage(net.meshPoint(u + (Math.random() - 0.5) * 0.04, v + (Math.random() - 0.5) * 0.05));
    const f = new Fish(kinds[i % kinds.length], at.x, at.y, -1, 0.44 + Math.random() * 0.08);
    f.lane = lane;
    f.depth = at.y - lane.y;
    f.home = at.x;
    f.lag = Math.random() * 0.18; // (they come in as a school, not in step)
    return f;
  });
  const shift = STAGE_W + 120 - Math.min(...fish.map((f) => f.home));
  fish.forEach((f) => { f.x = f.home + shift; f.speed = 160; });
  state.fish.push(...fish);
  game.audio.play('bubbles');
  await clock.tween(ms, token, (t) => {
    for (const f of fish) {
      const k = 1 - (1 - Math.min(1, Math.max(0, (t - f.lag) / (1 - f.lag)))) ** 3;
      f.x = f.home + shift * (1 - k);
      f.speed = 160 * (1 - k) + 6;
    }
  });
  return fish;
}

// The catch: the net closes round whoever is in it, gathers its mouth under the water and comes up a full bag.
async function hookCatch(game, token) {
  const { net, winch, popo, fx, audio } = game;
  popo.squash = 0.07;
  const caught = state.fish.filter((f) => !f.gone && !f.leaving && !f.waiting && !f.caught && net.contains(f));
  if (caught.length) audio.play('bubbles');
  for (const f of caught) {
    f.catchAt(net.uvOf(net.toNet(f)));
    fx.puff(f.x, f.y, 0, 2, true);
    await clock.wait(45, token);
  }
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  winch.working = -1;
  audio.crank(0.55);
  let gathered = 0;
  await clock.tween(fx.reduced ? 300 : 550, token, (t) => {
    const k = smooth(t);
    net.pouch = 0.55 * k;
    winch.turn(-24 * (k - gathered));
    gathered = k;
  });
  winch.working = 0;
  await raiseNet(game, token, caught, fx.reduced ? 1100 : 1700);
  return caught;
}

// The emptied bag lets down to where the net hangs and opens out into its frame again.
async function openBag(game, token, ms) {
  const { net, winch, fx, audio } = game;
  const from = winch.ropeOut, pouch = net.pouch;
  winch.working = 1;
  audio.crank(ms / 1000);
  await clock.tween(ms, token, (t) => {
    const k = ease.inOut(t);
    net.pouch = pouch * (1 - k);
    winch.setRopeOut(from * (1 - k));
    net.swing = fx.reduced ? 0 : Math.sin(t * Math.PI * 2) * 0.02 * (1 - t);
  });
  net.pouch = 0;
  winch.setRopeOut(0);
  winch.working = 0;
  net.swing = 0;
}

async function hook(game, token) {
  const { net, popo, fx, audio } = game;
  const H = STORY.hook, N = HOOK_NETS, q = fx.reduced;
  const say = (line) => { const p = game.say(line, token); p.catch(() => {}); return p; };
  audio.setDuckSfx(true);
  try {
    state.phase = PHASE.INTRO;
    game.instruct('');
    game.ui.showHandle(false);
    game.ui.setDrop('hidden');
    net.locked = true; // (no knob, readings or letters: a net, not a lesson, yet)
    // H1: the sea and its schools; the net comes down off the boom in its first shape and hangs over the water
    game.fishIn();
    net.points = hookNet(net, N.wrong[0]);
    const h1 = say(H.h1);
    await clock.wait(q ? 100 : 300, token);
    await letNetDown(game, token);
    await h1;
    // H2: Popo can't wait (a hop on "Let's"); he grips his wheel and cranks before the drop
    popo.react('happy', 1.2);
    const h2 = say(H.h2);
    await clock.wait(q ? 100 : 700, token);
    await readyNet(game, token, q ? 300 : 520);
    await h2;
    // H3: down it goes; its corners pull unevenly, one after another, it twists and tangles, and it hangs there a
    // moment, tangled, for the child to see; up it comes, tangled (each step slow enough to follow)
    await lowerNet(game, token, q ? 900 : 2000);
    await tangleNet(game, token, q ? 500 : 1900, N.pulls[0]);
    audio.play('fail');
    popo.react('think', 2);
    await clock.wait(q ? 200 : 600, token);
    const h3 = say(H.h3);
    await raiseNet(game, token, [], q ? 800 : 1500);
    await h3;
    // H4: two more shapes, each a little quicker, as the narrator says so (but never too quick to see)
    const h4 = say(H.h4);
    await reshapeNet(game, token, q ? 350 : 800, hookNet(net, N.wrong[1]));
    await wrongTry(game, token, N.pulls[1], 0.9);
    await reshapeNet(game, token, q ? 300 : 700, hookNet(net, N.wrong[2]));
    await wrongTry(game, token, N.pulls[2], 0.8);
    await h4;
    // H5: Popo looks at his tangled net and wonders; then he shakes it out
    popo.react('think', 2.6);
    audio.play('hmm');
    await say(H.h5);
    await reshapeNet(game, token, q ? 350 : 800, hookNet(net, N.wrong[2]));
    // H6: a fish leaps and knocks corner C onto the parallelogram's place; Popo sees it change
    await clock.wait(q ? 100 : 500, token);
    await fishBumpsCorner(game, token, hookNet(net, N.right)[2]);
    popo.react('think', 1.1);
    audio.play('bloop');
    await clock.wait(q ? 200 : 900, token);
    // ...and lets it down again: this time it stays open (no twist, no tangle), and its edge is outlined for a moment
    await readyNet(game, token, q ? 250 : 500);
    await lowerNet(game, token, q ? 900 : 2000);
    net.traceOutline(0.55, 0.35, 0.6);
    audio.play('shimmer');
    for (const p of net.points) { const st = net.toStage(p); fx.sparkle(st.x, st.y, 4); }
    popo.react('happy', 1.4);
    await say(H.h6);
    // H7: a school swims into the open net; Popo closes it and hauls up the catch, and cheers
    await schoolSwimsIn(game, token, q ? 1200 : 2600);
    await clock.wait(q ? 100 : 250, token);
    const caught = await hookCatch(game, token);
    for (const f of state.fish) if (f.lane && f.lane.speed === 0 && !f.caught && !f.gone) { f.leaving = true; f.speed = 140; } // (any of the school it missed swim on)
    state.caught += caught.length;
    popo.react('laugh', 1.8);
    audio.play('catch');
    const ring = net.ring();
    fx.sparkle(ring.x, ring.y + net.bottom() * 0.7, 12);
    game.storyCue('hop');
    const h7 = say(H.h7);
    await clock.wait(q ? 200 : 450, token);
    await collectFish(game, caught, token);
    await openBag(game, token, q ? 500 : 900);
    await h7;
    // H8: Swiftee swoops in beside Popo and names the shape; its outline is traced on the net as she says it
    await swifteeArrives(game, H.h8, token);
    // H9: Popo turns to her, then back to his net
    popo.react('think', 2.2);
    await say(H.h9);
    // H10
    await say(H.h10);
  } finally {
    audio.setDuckSfx(false);
  }
}

// After "Let's find out!": in the journey the net's outline becomes the lesson's first shape as the lesson comes in
// (netToLesson); then, the lesson over, the wave brings Popo back and Swiftee welcomes him. On the game's own page
// Swiftee flies off and the net winds up. Either way the first parallelogram net follows.
async function afterHook(game, token) {
  const { net, winch } = game;
  if (game.embedded && game.lessonAfter) {
    await netToLesson(game, token);
    await game.lessonTime(token, { fromNet: true });
    // (while the lesson played Popo was away; his net was wound up meanwhile, out of sight)
    net.alpha = 1;
    net.tangle = 0;
    net.furl = 1;
    winch.setRopeOut(-TUCK);
    await waveIn(game, token);
    await welcome(game, token);
  } else {
    swifteeDeparts(game, token, { up: true }).catch(() => {});
    await windNetUp(game, token);
  }
  state.fish = state.fish.filter((f) => !f.gone && !f.caught);
  const first = LEVELS.findIndex((l) => !l.warmup);
  game.audio.play('complete');
  await clock.wait(400, token);
  if (LEVELS[first].location !== state.locationIndex) await rowTo(game, LEVELS[first].location, token);
  const before = game.prepareLevel(first);
  game.spawnSchool();
  await letNetDown(game, token, before);
  game.beginPuzzle();
}

// H10's way into the lesson: Swiftee dives into the water; the HUD steps away and the scene dims while the net's four
// edges are traced over it in the lesson's blue; the camera glides down through the water (the lesson's own camera,
// its opening's dive, so the lesson takes over without a jump) while the mesh fades away and the outline - its four
// corners kept - glides into the lesson's first shape, just where the lesson draws it (levels.js LESSON_SHAPE). The
// lesson then comes in over it with that shape already there. (Drawn on the curtain, over the scene: Game.drawHookFx.)
async function netToLesson(game, token) {
  const { net, fx, audio } = game;
  const q = fx.reduced;
  swifteeDives(game, token).catch(() => {});
  game.ui.fadeHud(true);
  const corners = () => net.points.map((p) => net.toStage(p));
  const H = game.hookFx = { dim: 0, pts: corners(), trace: 0, dots: 0, line: 6, alpha: 1 };
  audio.play('shimmer');
  await clock.tween(q ? 300 : 900, token, (t) => {
    const k = ease.inOut(t);
    H.dim = 0.42 * k;
    H.trace = k;
    H.pts = corners();
  });
  const from = corners(), to = LESSON_SHAPE.points;
  await clock.tween(q ? 400 : 1400, token, (t) => {
    const k = ease.inOut(t);
    if (!q) game.setCamera({ zoom: 1 + 0.85 * k, pan: 1 - k });
    H.pts = from.map((p, i) => geo.lerp(p, to[i], k));
    H.line = 6 + (LESSON_SHAPE.line - 6) * k;
    H.dots = Math.min(1, t * 1.6);
    net.alpha = 1 - k;
  });
  game.setCamera({ zoom: 1.85, pan: 0 });
  audio.play('snap');
}

// Swiftee dives into the water in front of the net, with a splash (the lesson's Swiftee wears her diving mask).
async function swifteeDives(game, token) {
  const bird = game.swiftee;
  if (!bird) return;
  // (nearly straight down, and never across the net, which is about to be traced)
  const net = game.net, netRight = Math.max(...net.points.map((p) => net.toStage(p).x));
  const from = { x: bird.x, y: bird.y }, to = { x: Math.max(from.x - 60, netRight + 150), y: game.waterline + 80 };
  bird.onDownstroke = () => game.audio.play('flap');
  game.audio.play('whoosh');
  try {
    await clock.tween(game.fx.reduced ? 400 : 900, token, (t) => {
      const k = t * t;
      bird.x = from.x + (to.x - from.x) * k;
      bird.y = from.y + (to.y - from.y) * k - 50 * Math.sin(t * Math.PI);
      bird.lean = 0.9 * t;
      bird.flapRate = 16 + 12 * t;
      if (bird.y > game.waterline && game.swiftee === bird) {
        game.fx.splash(bird.x, game.waterline, true);
        game.audio.play('splashSmall');
        game.swiftee = null;
      }
    });
  } finally {
    if (game.swiftee === bird) game.swiftee = null;
  }
}

// Swiftee swoops in from the right and settles into a hover beside Popo, facing him; then she speaks (she is always
// there before her bubble is). `lines`: one line, or several said one after another.
async function swifteeArrives(game, lines, token) {
  const { popo, fx, audio } = game;
  const from = { x: STAGE_W + 140, y: 120 };
  // she hovers in the open sky to the right, clear of the crane and of the net if it hangs open
  const head = popo.headTop(), net = game.net;
  const netRight = net.visible && net.furl < 0.5 ? Math.max(...net.points.map((q) => net.toStage(q).x)) : 0;
  const to = { x: Math.min(STAGE_W - 170, Math.max(head.x + 720, netRight + 190)), y: Math.max(170, head.y - 20) };
  const bird = new PopoGame.Swiftee(from.x, from.y);
  bird.onDownstroke = () => audio.play('flap');
  game.swiftee = bird;
  audio.play('whoosh');
  await clock.tween(fx.reduced ? 1200 : 2400, token, (t) => {
    const k = ease.out(t);
    bird.x = from.x + (to.x - from.x) * k;
    // a swoop: dips on the way in and pulls up into the hover
    bird.y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 80;
    bird.lean = 0.32 * (1 - t) ** 1.5;
    bird.flapRate = 11 + 9 * (1 - t);
    if (Math.random() < 0.25 * (1 - t)) fx.sparkle(bird.x + 70, bird.y + (Math.random() - 0.5) * 60, 1);
  });
  bird.lean = 0;
  bird.onDownstroke = null;
  for (const line of [].concat(lines)) await game.say(line, token);
}

// "Let's find out!": Swiftee twirls and flies off over Popo's head, up and out of the top left, to the lesson (where
// she dives in). `up`: after her welcome she flies off up and out of the top right instead.
async function swifteeDeparts(game, token, { up = false } = {}) {
  const bird = game.swiftee;
  if (!bird) return;
  const from = { x: bird.x, y: bird.y };
  const to = up ? { x: STAGE_W + 240, y: -160 } : { x: -240, y: -140 };
  bird.twirl();
  bird.onDownstroke = () => game.audio.play('flap');
  game.audio.play('whoosh');
  try {
    await clock.tween(game.fx.reduced ? 500 : 1250, token, (t) => {
      const k = t * t;
      bird.x = from.x + (to.x - from.x) * k;
      bird.y = from.y + (to.y - from.y) * k - 70 * Math.sin(k * Math.PI);
      bird.lean = (up ? 0.3 : -0.3) * t;
      bird.flapRate = 16 + 10 * t;
      if (Math.random() < 0.3) game.fx.sparkle(bird.x + 50, bird.y + (Math.random() - 0.5) * 40, 1);
    });
  } finally {
    if (game.swiftee === bird) game.swiftee = null;
  }
}

const AWAY = 2600; // Popo's travelShift while the wave has him: off the right of the stage

// After the lesson the wave rolls in from the left with Popo riding its crest, leaves him on its back as it passes
// his spot and lowers him to the water there, and rolls on; then a happy hop, and a few fish leap to say hello.
async function waveIn(game, token) {
  const { popo, fx, audio } = game;
  const wave = new PopoGame.Wave(game);
  const ends = popo.raftEnds(), mid = (ends.left + ends.right) / 2;
  let dropped = -1, landed = false;
  popo.idle();
  game.wave = wave;
  try {
    wave.sound(audio);
    await clock.tween(wave.ms, token, (t) => {
      wave.set(t);
      if (wave.rise > 0.1 && Math.random() < 0.7) fx.ripple(wave.faceX() + 20 + Math.random() * 160, game.waterline + 4, 0.6 + Math.random() * 0.6);
      const seat = wave.seat();
      if (dropped < 0) { // riding the crest
        popo.travelShift = seat.x - mid;
        popo.dip = seat.y - game.waterline + Math.sin(t * 30) * 5;
        popo.tilt = -0.26 + Math.sin(t * 24) * 0.06;
        if (seat.x >= mid) { dropped = t; audio.play('woah'); }
      } else { // left on the back of the wave, which lowers him to the water as it rolls on
        const r = Math.min(1, ((t - dropped) * wave.ms) / 700);
        popo.travelShift = (1 - r) * Math.sin(r * Math.PI) * 40;
        popo.dip = Math.min(0, wave.backTop(mid) - game.waterline + 30 * r);
        popo.tilt = -0.26 * (1 - r) + Math.sin(r * Math.PI * 2) * 0.1 * (1 - r);
        if (!landed && popo.dip > -12) {
          landed = true;
          audio.play('skid');
          fx.splash(ends.right, game.waterline, true);
          fx.splash(ends.left, game.waterline, true);
        }
      }
      if (popo.dip < -40 && Math.random() < 0.35) fx.splash(mid + popo.travelShift - 80, game.waterline + popo.dip + 60, false);
    });
  } finally {
    game.wave = null;
    popo.travelShift = 0;
    popo.dip = 0;
    popo.tilt = 0;
  }
  audio.play('tada');
  fx.sparkle(popo.headTop().x + 40, popo.headTop().y + 50, 18);
  await clock.wait(380, token);
  game.storyCue('hop');
  fishSaysHello(game, token);
  await clock.wait(700, token);
}

// Back from the lesson: Swiftee swoops in from the right with her welcome ("Great job! Now, let's help Popo catch
// some fish!") and flies off again, up and out.
async function welcome(game, token) {
  await swifteeArrives(game, STORY.welcome, token);
  await clock.wait(300, token);
  await swifteeDeparts(game, token, { up: true });
  await clock.wait(250, token);
}

// ?start=lesson: the lesson came first, with Popo away on the wave; now it brings him back, Swiftee welcomes him and
// the parallelogram nets begin (no warm-up after the lesson).
async function backFromLesson(game) {
  const token = newToken();
  try {
    state.phase = PHASE.INTRO;
    game.instruct('');
    game.popo.travelShift = AWAY;
    await clock.wait(game.fx.reduced ? 150 : 500, token);
    await waveIn(game, token);
    await welcome(game, token);
    const first = LEVELS.findIndex((l) => !l.warmup);
    const before = game.prepareLevel(first);
    game.spawnSchool();
    await letNetDown(game, token, before);
    game.beginPuzzle();
  } catch (e) {
    swallow(e);
  }
}

// On to the next net: Popo winds the empty net up, rows to new waters when the level moves on,
// and lets the net down in its new shape while the next school swims in. After the last net,
// the celebration.
async function nextLevel(game, token) {
  const next = state.level + 1;
  state.phase = PHASE.TRANSITIONING;
  await windNetUp(game, token);
  if (next >= LEVELS.length) {
    await celebrate(game, token);
    return;
  }
  // the warm-up: the same plain net comes down again, the school topped up, until its catches are in
  const level = LEVELS[state.level];
  if (level.warmup && ++game.warmCatches < level.drops) {
    game.spawnSchool();
    await letNetDown(game, token);
    game.beginPuzzle();
    return;
  }
  // the fish the net missed swim on and are joined by more for the next net (rowing to new
  // waters, they come along); only for the golden school do they swim off out of the sea, as
  // the golden fish swim in behind them
  state.fish = state.fish.filter((f) => !f.gone && !f.caught);
  const golden = Boolean(LEVELS[next].rare) && !LEVELS[state.level].rare;
  if (golden) {
    for (const f of state.fish) f.swimAway();
    game.strays.push(...state.fish.filter((f) => !f.gone));
    state.fish = [];
  }
  game.audio.play('complete');
  await clock.wait(500, token);
  if (LEVELS[next].location !== state.locationIndex) await rowTo(game, LEVELS[next].location, token);
  const before = game.prepareLevel(next);
  game.spawnSchool();
  await letNetDown(game, token, before);
  // the golden school rushing in: Popo can't believe his eyes
  if (golden) await game.say(STORY.golden, token);
  game.beginPuzzle();
}

async function rowTo(game, nextIndex, token) {
  const { popo, fx, audio, net } = game;
  try {
    await game.prepareTransition(nextIndex, token);
  } catch (e) {
    // the next scenery couldn't load: arrive without the row rather than get stuck
    if (!isCurrent(token)) throw new Cancelled();
    game.finishTransition(nextIndex);
    return;
  }
  audio.setTravel(true);
  const fromWater = game.waterline;
  const toWater = game.locationWaterline(nextIndex);
  const duration = fx.reduced ? 1800 : 3400;
  const stroke = duration / (fx.reduced ? 1 : 2);
  popo.startRowing(stroke);
  let lastBlade = popo.paddleTip();
  let lastSplashStroke = -1;
  let lastWake = 0;
  try {
    await clock.tween(duration, token, (t) => {
      const k = ease.inOut(t);
      game.transition.k = k;
      game.setWaterline(fromWater + (toWater - fromWater) * k);
      const elapsed = t * duration;
      popo.setRowingTime(elapsed);
      // every pull drives the raft forward and lifts the bow a little; it settles as the blade lifts
      const surge = popo.rowRig.sample(elapsed, stroke).power;
      const pace = Math.sin(t * Math.PI);
      popo.travelShift = pace * (18 + surge * 24);
      popo.tilt = -pace * (0.012 + surge * 0.014);
      net.swing = -pace * 0.04; // the net trails a little behind the moving raft
      const blade = popo.paddleTip();
      const strokeIndex = Math.floor(elapsed / stroke);
      if (strokeIndex !== lastSplashStroke && lastBlade.y < game.waterline && blade.y >= game.waterline) {
        lastSplashStroke = strokeIndex;
        const crossing = (game.waterline - lastBlade.y) / (blade.y - lastBlade.y);
        fx.splash(lastBlade.x + (blade.x - lastBlade.x) * crossing, game.waterline, false);
        audio.play('paddle');
      }
      lastBlade = blade;
      if (elapsed - lastWake > 380 && t > 0.06 && t < 0.94) {
        lastWake = elapsed;
        fx.ripple(popo.raftEnds().left + popo.travelShift - 12, game.waterline + 6, 0.7);
      }
    });
  } finally {
    popo.idle();
    popo.travelShift = 0;
    popo.tilt = 0;
    net.swing = 0;
    if (isCurrent(token)) audio.setTravel(false);
  }
  game.finishTransition(nextIndex);
  await clock.wait(250, token);
}

// After the eighth net: Popo cheers ("Wow! What a catch!") and the end screen closes in on him,
// as in Fishing Frenzy.
async function celebrate(game, token) {
  const { popo, fx, audio, net, ui } = game;
  state.phase = PHASE.GAME_COMPLETE;
  game.instruct('');
  ui.showHandle(false);
  ui.setDrop('hidden');
  audio.play('tada');
  popo.react('laugh', 2.2);
  const ring = net.ring();
  for (let i = 0; i < 4; i += 1) {
    clock.wait(i * 180, token).then(() => {
      fx.sparkle(ring.x + (Math.random() - 0.5) * 400, ring.y + 60 + Math.random() * 160, 10);
    }).catch(() => {});
  }
  for (const line of STORY.complete) await game.say(line, token);
  await clock.wait(300, token);
  await theEnd(game, token);
}

// The End, as in Fishing Frenzy: a circle closes in on Popo and his raft over the live scene,
// everything around it a warm, slowly turning sunburst; it glides with him to the middle as he laughs,
// and closes on him, a cartoon's ending. Then the card comes in on the sunburst: the catch counts up against the
// goal as its bar fills, bubbles rise from its trophy, and Play Again springs in.
async function theEnd(game, token) {
  const { popo, audio, ui, fx } = game;
  const reduced = fx.reduced;
  const head = popo.headTop();
  const raft = popo.raftEnds();
  const deck = popo.anchor.y + 24;
  const centre = { x: (raft.left + raft.right) / 2, y: (head.y + deck) / 2 };
  const r = Math.max(...[{ x: raft.left, y: deck }, { x: raft.right, y: deck }, head].map((p) => geo.distance(p, centre))) + 14;
  // the scene's left edge must stay outside the circle as it glides
  centre.x = Math.max(centre.x, r + 4);
  const ending = game.ending = { x: centre.x, y: centre.y, r: 1500, pan: { x: 0, y: 0 }, t: 0, laugh: true, laughIn: 0, giggles: 2 };
  ui.el.pause.style.visibility = 'hidden'; // nothing to pause on the end screen
  audio.play('iris');
  await clock.tween(reduced ? 400 : 950, token, (t) => { ending.r = 1500 + (r - 1500) * ease.inOut(t); });
  // it glides with him to the middle (the sunburst's rays then spread from behind the card), and closes on him there
  const to = { x: STAGE_W / 2, y: STAGE_H / 2 };
  await clock.tween(reduced ? 300 : 750, token, (t) => {
    const k = ease.inOut(t);
    ending.pan = { x: (to.x - centre.x) * k, y: (to.y - centre.y) * k };
  });
  await clock.wait(reduced ? 200 : 700, token);
  ending.laugh = false;
  audio.play('iris');
  await clock.tween(reduced ? 250 : 450, token, (t) => { ending.r = r * (1 - ease.inOut(t)); });
  game.announceComplete();
  audio.play('tada');
  ui.setCatch(game.landed, 'cheer');
  await clock.wait(reduced ? 100 : 250, token);
  // the run's catch against the goal (the Master Catch): it counts up from nought as the bar fills, ticking every few
  // fish; then a puff of bubbles from the trophy, or, the goal reached, a stream of them and the star lit
  ui.showGoal(GOAL);
  audio.play('bloop');
  await clock.wait(reduced ? 200 : 650, token);
  const n = game.landed;
  let shown = 0;
  if (!reduced && n) {
    await clock.tween(Math.min(1800, 600 + n * 16), token, (t) => {
      const k = Math.round(n * ease.out(t));
      if (k === shown) return;
      if (Math.floor(k / 3) > Math.floor(shown / 3)) audio.play('count');
      shown = k;
      ui.countGoal(k, GOAL);
    });
  }
  const won = ui.endGoal(n, GOAL);
  const cup = ui.goalCup();
  audio.play(won ? 'tada' : 'bloop');
  game.confettiFrom(cup.x, cup.y, won ? 26 : 10);
  if (won) {
    audio.play('combo3');
    for (let i = 1; i <= 2; i += 1) clock.wait(i * 320, token).then(() => game.confettiFrom(cup.x, cup.y, 18)).catch(() => {});
  }
  await clock.wait(reduced ? 300 : 600, token);
  ui.showAgain(true);
  audio.play('bloop');
}

// Play Again: the card goes and the circle (if it's open) closes to nothing, the game is set up afresh out of
// sight, and the circle opens again on the first net (Game.updateEnding) - or, in the journey
// (title), on the banner from its start.
async function closeCurtain(game, { title = false } = {}) {
  const token = newToken();
  const ending = game.ending;
  ending.closing = true;
  ending.laugh = false;
  game.ui.showAgain(false);
  game.ui.hideGoal();
  game.audio.play('iris');
  const from = ending.r;
  try {
    await clock.tween(game.fx.reduced ? 250 : 500, token, (t) => {
      ending.r = from * (1 - t * t * t);
    });
  } catch (e) {
    swallow(e);
    return;
  }
  if (title) game.title.replay();
  else game.reset();
  game.ending = { x: STAGE_W / 2, y: STAGE_H / 2, r: 0, pan: { x: 0, y: 0 }, t: 0, opening: true };
  if (!title) startLevels(game);
}

Object.assign(PopoGame, { banner, opening, onward, startLevels, backFromLesson, dropNet, checkNet, catchNow, tryAgain, rowTo, celebrate, closeCurtain, letNetDown, hook, afterHook, swifteeArrives, swifteeDeparts, waveIn, welcome, AWAY });
})(window.PopoGame = window.PopoGame || {});
