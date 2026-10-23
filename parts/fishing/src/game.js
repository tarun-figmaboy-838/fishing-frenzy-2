(function (PopoGame) {
'use strict';
const { assets, preloadBackground, clock, ease, Effects, WaterScene, surfaceWave, PAN_OVERLAP, Sea, refreshShadows, refreshDeep, LOCATIONS, LEVELS, NETS, bunchesFor, Popo, Winch, Net, TUCK, opening, startLevels, backFromLesson, dropNet, checkNet, catchNow, tryAgain, closeCurtain, Cancelled, STAGE_W, STAGE_H, SCENE_SHIFT, raftAnchor, state, PHASE, resetProgress, newToken, isCurrent, TitleScreen } = PopoGame;

const HINT_REPEAT = 7;    // seconds of idling between hints once one has been shown
const NET_CLEARANCE = 40; // the net's bottom edge hangs this far above the water
const SCHOOL_TOP = 46;    // the school keeps this far below the surface
const FOCUS = { zoom: 1.7, inMs: 900 }; // the view zooms in on the net this much, this fast, as a net comes down (applyFocus)
const SCHOOL_MARGIN = 26; // and this far inside the net's footprint
const TICK_GAP = 90;      // ms between measurement ticks while dragging
const SWIM_BEYOND = 320;  // the school swims round a loop reaching this far past the sea's ends (out of sight), long enough for three schools with water between
const READ_PACE = 0.26;   // seconds a word stays new when a line is shown without its recording
const QUICK_PACE = 0.09;  // ...and when a line the child has just heard comes back

// How long a word takes to say, roughly, in letters: a symbol or a number is read as words
// ("∠" angle, "=" is, "°" degrees, "m" metres, 180 one hundred eighty), a capital letter on its
// own is spelled out, and punctuation adds a beat.
function sayLength(text) {
  const bare = text.replace(/[^a-z0-9']/gi, '');
  let n = /^[A-Z]{1,2}$/.test(bare) ? bare.length * 3 : bare.replace(/[0-9]/g, '').length;
  for (const digits of bare.match(/[0-9]+/g) || []) n += [0, 4, 8, 16, 20][Math.min(4, digits.length)];
  n += (text.match(/∠/g) || []).length * 5 + (text.match(/=/g) || []).length * 2 + (text.match(/°/g) || []).length * 7;
  if (/^m[.,]?$/.test(text)) n = 6;
  return Math.max(2, n) + (text.endsWith('…') ? 5 : /[.!?:]$/.test(text) ? 3 : text.endsWith(',') ? 2 : 0);
}

// When each word of a recorded line is said: the recording shared out by the words' lengths.
function spokenTimes(words, seconds) {
  const total = words.reduce((sum, w) => sum + sayLength(w.text), 0);
  let at = 0;
  return words.map((w) => {
    const t = (at / total) * seconds * 0.88;
    at += sayLength(w.text);
    return t;
  });
}

// When each word of a line shown without its recording appears: a steady pace, a pause after
// punctuation and a comic beat before each new line.
function readingTimes(words, pace) {
  let at = 0;
  return words.map((w, i) => {
    if (i && w.newLine) at += pace;
    const t = at;
    at += pace + (/[.!?:]$/.test(w.text) ? pace : w.text.endsWith(',') ? pace / 2 : 0);
    return t;
  });
}

// The end screen's curtain: a warm sunburst with slowly turning rays everywhere but a circle,
// which is framed in dark brown and cream.
function drawSunburst(ctx, x, y, r, turn) {
  const far = Math.hypot(Math.max(x, STAGE_W - x), Math.max(y, STAGE_H - y)) + 40;
  if (r >= far) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, STAGE_W, STAGE_H);
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip('evenodd');
  const glow = ctx.createRadialGradient(x, y, r, x, y, far);
  glow.addColorStop(0, '#ffb347');
  glow.addColorStop(0.18, '#ff6f61');
  glow.addColorStop(0.45, '#d9437f');
  glow.addColorStop(1, '#4b2a9b');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i += 1) {
    const a = turn + (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, far, a, a + Math.PI / 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  if (r > 1) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#3b1d00';
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#fff3d6';
    ctx.stroke();
  }
}

// Twinkles either side of The End on the end screen, from its middle.
const ENDING_TWINKLES = [[-420, -50], [-370, 40], [-440, 95], [400, -60], [440, 30], [370, 100], [-300, -110]];

class Game {
  constructor({ stage, ui, audio }) {
    this.stage = stage;
    this.ui = ui;
    this.audio = audio;
    this.popo = new Popo();
    this.winch = new Winch();
    this.net = new Net();
    this.fx = new Effects();
    // the net in focus (applyFocus): t 0..1 toward want, the zoom about (ox, oy) in stage px
    this.focus = { t: 0, want: 0, ox: STAGE_W / 2, oy: STAGE_H / 2, ms: FOCUS.inMs, z: 1 };
    this.ui.unzoom = (p) => this.unzoom(p);
    this.ui.zoomed = (p) => { const f = this.focus; return { x: f.ox + (p.x - f.ox) * f.z, y: f.oy + (p.y - f.oy) * f.z, z: f.z }; };
    this.water = new WaterScene(document.getElementById('water'));
    this.raftRippleIn = 1;
    this.dialogue = null;
    this.leapers = [];
    this.sea = new Sea();  // the school's lanes in these waters
    this.strays = [];      // fish swimming out of the sea as the golden school swims in
    this.deep = [];        // far fish in the deep water, scenery only (refreshDeep)
    this.delivery = null;  // the words of the instruction plate still to appear
    this.netRight = false; // the frame has been proven right this level; only the timing is left
    this.ending = null;    // the end screen: its circle, the scene's pan, The End (see theEnd)
    this.landed = 0;       // fish counted this game (the counter at the top left)
    this.fliers = [];      // caught fish flying from the bucket up to the counter
    this.confetti = [];    // bubble confetti: a catch's bright bubbles bursting up and popping
    this.handShown = false;
    this.poof = null;
    this.ambient = [];
    this.hop = null;
    this.waterQuality = 1;
    this.frameAvg = 1 / 60;
    this.slowFor = 0;
    this.surfaceColors = [];
    this.transition = null;
    this.fishArea = null;
    this.hint = null;
    this.hintShown = false;
    this.drag = null;
    this.lastTick = { value: null, at: 0 };
    this.lastFrame = 0;
    this.running = false;
    this.loopId = 0;
    // in the journey (shell/bridge.js; see main.js): Play hands over to the lesson, and the game holds after its
    // banner until the shell says
    this.embedded = !!(window.Journey && window.Journey.embedded);
    this.holding = false;
    this.lessonAfter = false; // the lesson follows the warm-up (sequences.js mystery, Game.lessonTime)
    this.afterLesson = false; // ?start=lesson: the lesson came first, so the story starts with the wave bringing Popo back
    this.breakEnds = null;    // the lesson's break, while it plays
    this.swiftee = null;      // Swiftee, flying in at the warm-up's end and after the lesson (src/swiftee.js)
    this.wave = null;         // the giant wave carrying Popo off to the lesson and back (../shared/wave.js)
    this.awaitingNext = null; // Next is up (the warm-up's end): its tap moves the story on
    this.warmCatches = 0;     // the warm-up's catches so far (LEVELS[0].drops of them before its problem)
    this.camera = { zoom: 1, pan: 1 }; // the lesson's camera over this lake (setCamera)
    ui.setScale(stage.scale);
    this.applyLocation();
    this.title = new TitleScreen(this); // the banner's logo and Play button (src/title.js)
  }

  // --- lifecycle ------------------------------------------------------------
  // The world renders behind the start screen as soon as the art is ready.
  showIdleScene() {
    if (!this.running) {
      this.running = true;
      this.lastFrame = performance.now();
      const id = ++this.loopId; // (a loop stopped and started again in one frame must not run twice)
      requestAnimationFrame((t) => this.loop(t, id));
    }
    if (state.phase === PHASE.TITLE) this.title.begin();
  }

  // Play: the banner was the lake itself with Popo already in his place, so as its logo clears
  // away the story simply begins (opening, without his arrival).
  start() {
    this.audio.init();
    this.audio.resume();
    this.audio.fetchLaterVoices();
    this.audio.startMusic();
    this.ui.hideStart();
    this.ui.showHud();
    if (this.afterLesson) { this.afterLesson = false; backFromLesson(this); }
    else opening(this, { arrived: true });
    this.showIdleScene();
  }

  restart() {
    this.reset();
    opening(this);
  }

  // From the end screen, the circle closes and opens again on the first net (closeCurtain). In the
  // journey the shell takes it back to its banner instead (backToTitle), and a new lesson.
  playAgain() {
    if (this.ending && this.embedded) {
      if (this.ending.closing) return;
      this.ending.closing = true; // (once)
      this.ui.showAgain(false);
      window.Journey.finish({ levels: NETS, fish: state.caught }); // inside the tap
      return;
    }
    if (this.ending) {
      if (!this.ending.closing) closeCurtain(this);
      return;
    }
    this.reset();
    startLevels(this);
  }

  // Cancels every sequence and clears the scene back to the first location, ready to play.
  reset() {
    newToken();
    clock.cancelAll();
    this.fx.clearTransient();
    this.audio.stopEffects();
    this.audio.stopVoice();
    this.audio.setTravel(false);
    this.transition = null;
    this.ui.showPause(false);
    this.ui.showAgain(false);
    this.ui.hideNext();
    this.ui.hideHand();
    this.ui.showHandle(false);
    this.ui.setDrop('hidden');
    this.ui.setAction('hidden');
    this.focusReset();
    this.swiftee = null;
    this.wave = null;
    this.awaitingNext = null;
    this.warmCatches = 0;
    const muted = state.muted;
    resetProgress();
    state.muted = muted;
    this.audio.resume();
    this.popo = new Popo();
    this.winch = new Winch();
    this.net = new Net();
    this.net.textScale = this.labelScale();
    this.net.sharpRes = this.textureRes();
    // until Popo lets it down, the net hangs wound up in a bundle under the boom's pulley
    this.net.visible = true;
    this.net.furl = 1;
    this.winch.setRopeOut(-TUCK);
    this.ambient = [];
    this.leapers = [];
    this.strays = [];
    this.deep = [];
    this.sea = new Sea();
    this.hop = null;
    this.poof = null;
    this.hint = null;
    this.drag = null;
    this.netRight = false;
    this.ending = null;
    this.landed = 0;
    this.fliers = [];
    this.confetti = [];
    this.ui.setCatch(0);
    this.endLine();
    this.instruct('');
    // a restart from the pause card must hand back the HUD and the net's corner
    this.ui.el.hud.inert = false;
    this.ui.el.hits.inert = false;
    this.ui.el.pause.style.visibility = '';
    this.applyLocation();
    this.prepareLevel(0);
  }

  // --- in the journey (shell/journey.js) ----------------------------------------
  // Play, inside its tap: the banner clears away as ever, and the shell's sound unlocks. The shell answers at once
  // with story; only with ?start=lesson does the lesson come first, and the game holds there, its music stopped.
  handOver() {
    this.holding = true;
    window.Journey.play();
    if (!this.holding) return;
    state.phase = PHASE.INTRO;
    this.ui.hideStart();
    this.audio.stopMusic();
  }

  // The lesson covers the game: it stops drawing (sequences wait with the clock) and every sound.
  hide() {
    this.running = false;
    this.audio.hold(true);
  }

  // In the journey the lesson plays over this lake, as Fishing Frenzy's plays over its game's: the game goes on drawing
  // its water and fish under the lesson's card, silent, its buttons away and Popo off with the giant wave (he is
  // already, after the warm-up; with ?start=lesson or a dev jump he goes now), and the lesson's camera moves its view.
  backdrop() {
    this.audio.hold(true);
    this.ui.el.hud.hidden = true;
    this.ui.showHandle(false);
    this.ui.setDrop('hidden');
    this.ui.setAction('hidden');
    this.ui.hideHand();
    this.focusReset();
    this.endLine();
    this.popo.travelShift = PopoGame.AWAY;
    this.showIdleScene();
  }

  // The lesson's camera: its glide down from this view to the sand (pan 1 -> 0: the painting drawn up to SCENE_SHIFT
  // higher, so its sea floor shows) and its dive after the card (zoom, about the bottom middle of the stage).
  setCamera({ zoom = 1, pan = 1 } = {}) {
    this.camera = { zoom, pan };
    const k = this.stage.scale, scene = this.ui.el.scene.style;
    if (zoom === 1) { scene.transform = ''; return; }
    scene.transformOrigin = `${((STAGE_W / 2) * k).toFixed(1)}px ${(STAGE_H * k).toFixed(1)}px`;
    scene.transform = `scale(${zoom.toFixed(4)})`;
  }

  // --- the net in focus ---------------------------------------------------------------------
  // As a net comes down the view zooms in on it by itself (as the lesson's camera dives: the scene, the net's corner
  // and the hint hand scale together about the net's middle), so the child sets the corner on a big net; Check opens
  // the view out again as the net goes down (focusOut over that time). The HUD (the plate, the buttons) stays as it is.
  // The zoom fits the net and the whole of its corner's track (every stop the corner can reach), with a margin, so
  // nothing the child needs leaves the screen: as much as FOCUS.zoom, less where the track is wide, about a point
  // chosen so the fitted box sits inside the stage (scaling about a point off the box's middle slides it along).
  focusOn() {
    this.focus.want = 1;
    this.focus.fit = true; // (measured on the zoom's first frame, once the net's place on the stage is fresh)
  }

  fitFocus() {
    const net = this.net, f = this.focus, PAD = 70;
    const pts = [...net.points, net.stop(net.track.min), net.stop(net.track.max), { x: 0, y: 0 }].map((q) => net.toStage(q));
    const x0 = Math.min(...pts.map((q) => q.x)) - PAD, x1 = Math.max(...pts.map((q) => q.x)) + PAD;
    const y0 = Math.min(...pts.map((q) => q.y)) - PAD, y1 = Math.max(...pts.map((q) => q.y)) + PAD;
    const z = Math.max(1.05, Math.min(FOCUS.zoom, STAGE_W / (x1 - x0), STAGE_H / (y1 - y0)));
    const place = (lo, hi, size) => { // the origin that keeps [lo, hi] on screen at zoom z: between its two bounds, nearest its middle
      const c = (lo + hi) / 2;
      const min = (hi * z - size) / (z - 1), max = (lo * z) / (z - 1);
      return min > max ? c : Math.max(min, Math.min(max, c));
    };
    f.ox = place(x0, x1, STAGE_W);
    f.oy = place(y0, y1, STAGE_H);
    f.zoom = z;
    f.ms = FOCUS.inMs;
  }

  // While the view is in on the net the lights go down on the scene behind it (the sky, the sea and its fish), evenly,
  // and the net, the raft and Popo stay lit, so the net is plainly what to look at; it comes and goes with the zoom.
  drawFocusDim(ctx) {
    const f = this.focus, k = f.t * f.t * (3 - 2 * f.t);
    if (k <= 0.01) return;
    ctx.save();
    ctx.fillStyle = `rgba(2, 12, 40, ${(0.48 * k).toFixed(3)})`;
    ctx.fillRect(-STAGE_W, -STAGE_H, STAGE_W * 3, STAGE_H * 3);
    ctx.restore();
  }

  focusOut(ms) {
    this.focus.ms = ms || FOCUS.inMs;
    this.focus.want = 0;
  }

  focusReset() {
    this.focus.t = 0;
    this.focus.want = 0;
    this.applyFocus(0);
  }

  // a stage point as the pointer sees it on the zoomed view, back to where it is in the scene
  unzoom(p) {
    const f = this.focus, z = f.z;
    if (z === 1) return p;
    return { x: f.ox + (p.x - f.ox) / z, y: f.oy + (p.y - f.oy) / z };
  }

  applyFocus(dt) {
    const f = this.focus;
    if (f.fit && f.want === 1 && f.t === 0) { f.fit = false; this.fitFocus(); }
    if (f.t !== f.want) {
      const step = dt / Math.max(0.001, f.ms / 1000);
      f.t = f.want > f.t ? Math.min(f.want, f.t + step) : Math.max(f.want, f.t - step);
    }
    const k = this.fx.reduced ? f.want : f.t * f.t * (3 - 2 * f.t);
    const z = 1 + ((f.zoom || FOCUS.zoom) - 1) * k;
    if (z === f.z && z === 1) return;
    f.z = z;
    if (this.camera.zoom !== 1) return; // (the lesson's camera has the view)
    const s = this.stage.scale, origin = `${(f.ox * s).toFixed(1)}px ${(f.oy * s).toFixed(1)}px`, tf = z === 1 ? '' : `scale(${z.toFixed(4)})`;
    for (const el of [this.ui.el.scene, this.ui.el.hits]) {
      el.style.transformOrigin = origin;
      el.style.transform = tf;
    }
    if (this.hint) { // (the hint hand places itself through the zoom, UI.moveHand)
      if (this.hint.drag) this.advanceHand(0);
      else if (this.hintAt) this.pointAt(this.hintAt, true);
    }
  }

  // Shown again without the story (a ?dev=1 jump): drawing again, with the music if it was playing.
  wake() {
    this.setCamera({ zoom: 1, pan: 1 }); // (the lesson's camera may have left the view down in the water)
    this.ui.el.hud.hidden = false;
    this.popo.travelShift = 0;
    this.audio.hold(false);
    this.showIdleScene();
  }

  // On from the banner as Play goes on (the narrator, the first school, the warm-up net): at once, or after the lesson
  // (?start=lesson, args.afterLesson: the wave brings Popo back and the parallelogram nets begin). args.lesson: the
  // lesson follows the warm-up.
  story(args) {
    const held = this.holding;
    this.holding = false;
    this.lessonAfter = !!(args && args.lesson);
    this.afterLesson = !!(args && args.afterLesson);
    this.setCamera({ zoom: 1, pan: 1 }); // (after a lesson its camera may have left the view a hair off)
    this.ui.el.hud.hidden = false;
    this.audio.hold(false);
    if (state.phase === PHASE.TITLE) this.title.leave(); // (a ?dev=1 lesson jump came from the banner)
    else if (!held) { this.showIdleScene(); return; }   // (or from a level: it carries on)
    this.start();
  }

  // In the journey the lesson comes once the giant wave has carried Popo off (sequences.js, mystery): the game tells
  // the shell, which plays the lesson over its empty lake. Resolves (true) when the shell says `resume` (goOn), or at
  // once (false) off the journey.
  lessonTime(token) {
    if (!this.embedded || !this.lessonAfter) return Promise.resolve(false);
    this.lessonAfter = false;
    return new Promise((resolve) => {
      this.breakEnds = () => { if (isCurrent(token)) resolve(true); };
      window.Journey.finish({ intro: true, warmup: true, fish: state.caught });
    });
  }

  // Next is up beside Swiftee: resolves on its tap (next)
  awaitNext(token) {
    return new Promise((resolve) => {
      this.awaitingNext = { resolve, token };
      this.nextNudge = 3;
      this.ui.showNext();
      this.audio.play('bloop');
    });
  }

  next() {
    const w = this.awaitingNext;
    if (!w || state.paused) return;
    this.awaitingNext = null;
    this.ui.hideNext();
    this.audio.play('ui');
    this.endLine(false);
    if (isCurrent(w.token)) w.resolve();
  }

  // The lesson is over: the game wakes, and after the first net goes on to the next (the break's end).
  goOn() {
    this.setCamera({ zoom: 1, pan: 1 });
    this.ui.el.hud.hidden = false;
    this.audio.hold(false);
    this.showIdleScene();
    const ends = this.breakEnds;
    this.breakEnds = null;
    if (ends) ends();
  }

  // The banner again from its start (after Play Again, or the dev panel's Front page). From the end screen its circle
  // closes and opens again on the banner.
  backToTitle() {
    this.holding = false;
    this.lessonAfter = false;
    this.afterLesson = false;
    this.breakEnds = null;
    this.awaitingNext = null;
    this.ui.hideNext();
    this.swiftee = null;
    this.wave = null;
    this.audio.hold(false);
    this.showIdleScene();
    if (this.ending && !this.ending.opening) { closeCurtain(this, { title: true }); return; }
    this.title.replay();
  }

  dispose() {
    this.running = false;
    newToken();
    clock.cancelAll();
    this.audio.setTravel(false);
    this.transition = null;
    this.fx.clearTransient();
    this.audio.stopEffects();
    this.audio.stopMusic();
    this.endLine();
    this.ui.hideHand();
    this.ui.showHandle(false);
    state.phase = PHASE.TITLE;
  }

  applyLocation() {
    const loc = LOCATIONS[state.locationIndex];
    this.setWaterline(this.locationWaterline(state.locationIndex));
    this.fx.setLocation(loc.background);
    if (state.locationIndex + 1 < LOCATIONS.length) preloadBackground(LOCATIONS[state.locationIndex + 1].background);
  }

  locationWaterline(index) {
    return LOCATIONS[index].waterline + SCENE_SHIFT;
  }

  setWaterline(y) {
    this.waterline = y;
    this.fx.setWaterline(y);
    const a = raftAnchor(y);
    this.popo.setAnchor(a.x, a.y);
    // where the net's ring hangs at rest, with the raft still
    this.netRest = { x: a.x + this.winch.hang.x, y: a.y + this.winch.hang.y };
    this.area = { left: 40, right: STAGE_W - 40, top: y + SCHOOL_TOP, bottom: STAGE_H - 30 };
  }

  // --- levels -----------------------------------------------------------------
  // Sets up a level's net under the boom and the water its school keeps to. Returns the
  // frame the net had before, so a transition can morph from it.
  prepareLevel(index) {
    state.level = index;
    const level = LEVELS[index];
    const net = this.net;
    const before = net.points.map((p) => ({ ...p }));
    // the corner's track stays clear of the raft and inside the stage
    net.setLevel(level, this.waterline - NET_CLEARANCE - this.netRest.y, {
      left: this.popo.raftEnds().right + 44 - this.netRest.x, right: STAGE_W - 48 - this.netRest.x,
    });
    const span = net.innerSpan();
    const top = this.waterline + SCHOOL_TOP;
    // the water right under the net, down to where the lowered net reaches...
    this.fishArea = {
      left: this.netRest.x + span.left + SCHOOL_MARGIN, right: this.netRest.x + span.right - SCHOOL_MARGIN,
      top, bottom: top + (span.bottom - span.top) - 8, // (three lanes of fish fit under the net)
    };
    // ...and the school roams the whole sea at that depth, so the net catches whoever is under it
    // when it lands: the child drops it as fish swim beneath
    this.swimArea = { left: -SWIM_BEYOND, right: STAGE_W + SWIM_BEYOND, top: this.fishArea.top, bottom: this.fishArea.bottom };
    // the lake's own life, there from the banner on: far shadows, and far fish in the deep water
    // under the school, down to the sea floor
    this.ambient = refreshShadows(this.ambient, 4, this.area);
    this.deep = refreshDeep(this.deep, 6, { top: this.swimArea.bottom + 24, bottom: STAGE_H - 26 });
    this.hintShown = false;
    this.handShown = false;
    return before;
  }

  // Fills these waters' school for the level: the fish already swimming stay, glide to the
  // new lane depths and are joined by newcomers; each level's school swims a little quicker.
  spawnSchool() {
    const level = LEVELS[state.level];
    const pace = (58 + 13 * state.level) * (level.rare ? 1.15 : 1); // quicker net by net
    state.fish = this.sea.stock(state.fish, this.swimArea, bunchesFor(level), { rare: level.rare, pace });
  }

  // The first school swims in on the narrator's cue (or straight away on Play Again).
  fishIn() {
    if (state.fish.length) return;
    this.spawnSchool();
    this.audio.play('bloop');
  }

  beginPuzzle() {
    const level = LEVELS[state.level];
    state.phase = PHASE.PUZZLE_READY;
    state.idleTime = 0;
    state.misses = 0;
    // the warm-up's net has nothing to set (Popo's plain net: no knob, marks or letters); only Drop Net, and its
    // instruction is said once, as its first net comes down
    const free = level.type === 'free';
    this.net.locked = free;
    this.netRight = free;
    this.lastTick = { value: this.net.stopAt, at: 0 };
    this.popo.idle();
    this.ui.showHandle(!free);
    this.ui.setDrop(free ? 'on' : 'hidden'); // (the nets check and catch with their own button: onAction)
    this.ui.setAction('hidden');
    if (!free) this.focusOn(); // the net down: the view comes in on it
    this.instruct(level.prompt, { voice: !(free && this.warmCatches) });
  }

  // Reads a line aloud (when it has a recording) for children who can't read it yet. Returns
  // the recording's length in seconds, so text changes can wait for it.
  speak(text) {
    return this.dialogue ? 0 : this.audio.speak('narrator', text);
  }

  // --- text delivery ------------------------------------------------------------
  // The instruction plate (a prompt, praise or hint) comes word by word, in time with the voice
  // when the line is read aloud, or at a reading pace when it isn't. Words pop in, stressed ones
  // boing, and the plate bounces as each new sentence starts. Returns how long that takes, in
  // seconds.
  instruct(text, { voice = true, pace = READ_PACE } = {}) {
    return this.deliver(this.ui.setInstruction(text), text, voice, pace);
  }

  deliver(words, text, voice, pace) {
    this.delivery = null;
    if (!words.length) return 0;
    const seconds = voice ? this.speak(text) : 0;
    const times = seconds ? spokenTimes(words, seconds) : readingTimes(words, pace);
    this.delivery = { times, next: 0, t: 0 };
    this.updateDelivery(0);
    return Math.max(seconds, times[times.length - 1] + pace);
  }

  // The prompt read again (the first hint): its words stay on the plate and each gives a little
  // bounce as it is said, so the child can follow along. (A prompt still arriving is delivered
  // afresh instead.)
  reread(text) {
    const shown = this.ui.delivered;
    if (this.delivery || !shown || shown.plate !== this.ui.el.instruction || !shown.words.length) {
      this.instruct(text);
      return;
    }
    const seconds = this.speak(text);
    const times = seconds ? spokenTimes(shown.words, seconds) : readingTimes(shown.words, READ_PACE);
    this.delivery = { times, next: 0, t: 0, bounce: true };
  }

  updateDelivery(dt) {
    const d = this.delivery;
    if (!d) return;
    d.t += dt;
    while (d.next < d.times.length && d.t >= d.times[d.next]) {
      if (d.bounce) this.ui.bounceWord(d.next);
      else this.ui.showWord(d.next);
      d.next += 1;
    }
    if (d.next >= d.times.length) this.delivery = null;
  }

  // How far the ring must drop for the net's bottom edge (its higher corner, on a tilted net)
  // to pass under the whole school.
  catchDepth() {
    return this.fishArea.bottom + 14 - (this.netRest.y + this.net.innerSpan().bottom);
  }

  // The net breaking the surface: splashes under its bottom corners and in the middle.
  netSplash() {
    const [, , c, d] = this.net.points.map((p) => this.net.toStage(p));
    for (const x of [d.x + 20, (c.x + d.x) / 2, c.x - 20]) this.fx.splash(x, this.waterline, false);
    this.fx.ripple((c.x + d.x) / 2, this.waterline + 4, 1.4);
    this.audio.play('splashSmall');
  }

  announceComplete() {
    const detail = { levels: NETS, fish: state.caught };
    window.dispatchEvent(new CustomEvent('popo:complete', { detail }));
    if (window.parent !== window) window.parent.postMessage({ type: 'popo:complete', ...detail }, '*');
  }

  // --- input ----------------------------------------------------------------
  onDragStart(point) {
    if (state.paused || state.phase !== PHASE.PUZZLE_READY || this.netRight) return;
    state.phase = PHASE.DRAGGING;
    this.stopHint();
    const handle = this.net.points[this.net.movable];
    const local = this.net.toNet(point);
    // the corner keeps its offset from the pointer, so it never jumps under the finger
    this.drag = { dx: handle.x - local.x, dy: handle.y - local.y };
    this.audio.play('grab');
  }

  onDragMove(point) {
    if (state.phase !== PHASE.DRAGGING) return;
    const local = this.net.toNet(point);
    this.net.moveHandle({ x: local.x + this.drag.dx, y: local.y + this.drag.dy });
    this.tickMeasure();
  }

  // A soft click each time the corner reaches a new stop, throttled so a fast drag doesn't rattle.
  tickMeasure() {
    const value = this.net.stopAt;
    const now = performance.now();
    if (value === this.lastTick.value) return;
    this.lastTick.value = value;
    if (now - this.lastTick.at < TICK_GAP) return;
    this.lastTick.at = now;
    this.audio.play('tick');
  }

  // Let go, the corner stays exactly where the child put it; Drop Net tells whether it's right.
  onDragEnd() {
    if (state.phase !== PHASE.DRAGGING) return;
    this.drag = null;
    state.phase = PHASE.PUZZLE_READY;
    state.idleTime = 0;
    if (this.net.touched) this.ui.setAction('check'); // the corner set: Check is the child's
  }

  onNudge(dx, dy) {
    if (state.paused || state.phase !== PHASE.PUZZLE_READY || this.netRight) return;
    this.stopHint();
    state.idleTime = 0;
    // an arrow key moves the corner a stop along its track, whichever way the track points it
    const { dir } = this.net.along;
    const along = dx * dir.x + dy * dir.y;
    if (Math.abs(along) < 0.3 * Math.hypot(dx, dy)) return;
    this.onStep(Math.sign(along));
  }

  // A tap on an arrow beside the knob (or an arrow key): one stop on or back along the track.
  onStep(steps) {
    if (state.paused || state.phase !== PHASE.PUZZLE_READY || this.netRight) return;
    this.stopHint();
    state.idleTime = 0;
    this.net.stepHandle(steps);
    this.tickMeasure();
    if (this.net.touched) this.ui.setAction('check');
  }

  // Drop Net, right or wrong: a wrong net goes down all the same (see dropNet).
  onDrop() {
    if (state.paused || state.phase !== PHASE.PUZZLE_READY) return;
    this.stopHint();
    this.audio.play('ui');
    dropNet(this);
  }

  // The nets' one button: Check (the corner set), Catch (a right net open in the water, a bunch under it), Try again
  // (a tangled net).
  onAction() {
    if (state.paused) return;
    const mode = this.ui.actionMode;
    if (mode === 'check' && state.phase === PHASE.PUZZLE_READY) { this.stopHint(); this.audio.play('ui'); checkNet(this); }
    else if (mode === 'catch' && state.phase === PHASE.FISHING) { this.stopHint(); this.audio.play('ui'); catchNow(this); }
    else if (mode === 'again' && state.phase === PHASE.TANGLED) { this.audio.play('ui'); tryAgain(this); }
  }

  // Tapping the water is just for fun: bubbles, a soft bloop, and curious fish come to look.
  onWaterTap(point) {
    if (state.phase === PHASE.TITLE && this.title.tap(point)) return;
    if (state.paused || state.phase === PHASE.GAME_COMPLETE || point.y < this.waterline) return;
    this.fx.puff(point.x, point.y, 0, 5, true);
    if (point.y < this.waterline + 40) this.fx.ripple(point.x, this.waterline, 0.6);
    this.audio.play('bloop');
    for (const f of state.fish) {
      if (f.gone || f.waiting) continue;
      if (Math.hypot(f.x - point.x, f.y - point.y) < 300) f.lookAt(point);
    }
    this.fishReacts(point);
  }

  puffFrom(fish, count, big = false) {
    this.fx.puff(fish.x + fish.dir * fish.w * 0.42 * fish.scale, fish.y + fish.h * 0.1 * fish.scale, fish.dir, count, big);
  }

  // The fish nearest a tap does something silly: a somersault and a giggle, a burst of
  // bubbles, or a quick dart away. Never the same trick twice running, and not too often.
  fishReacts(point) {
    const now = performance.now();
    let near = null;
    let best = 230;
    for (const f of [...state.fish, ...this.ambient]) {
      if (f.gone || f.frozen || f.leaving || f.waiting || !f.flip) continue;
      const d = Math.hypot(f.x - point.x, f.y - point.y);
      if (d < best && (f.reactedAt || 0) < now - 1200) { best = d; near = f; }
    }
    if (!near) return;
    near.reactedAt = now;
    const tricks = ['flip', 'bubbles', 'shiver'].filter((t) => t !== this.lastTrick);
    const trick = tricks[Math.floor(Math.random() * tricks.length)];
    this.lastTrick = trick;
    if (trick === 'flip') {
      near.flip();
      this.audio.play('giggle');
    } else if (trick === 'bubbles') {
      near.wiggle();
      this.puffFrom(near, 8, true);
      this.audio.play('bubbles');
    } else {
      near.startle(point);
      this.audio.play('puff');
    }
  }

  onPlayHover(on) {
    if (state.phase === PHASE.TITLE) this.title.hover(on);
  }

  onPlayPress() {
    if (state.phase === PHASE.TITLE) this.title.press();
  }

  // Play: the button pops, the logo clears away and the game begins.
  pressPlay() {
    if (state.phase !== PHASE.TITLE || !this.title.armed) return;
    this.audio.init();
    this.audio.resume();
    this.title.leave();
    if (this.embedded) this.handOver();
    else this.start();
  }

  togglePause() {
    if (state.phase === PHASE.TITLE || state.phase === PHASE.GAME_COMPLETE || this.holding) return;
    state.paused = !state.paused;
    if (state.paused && state.phase === PHASE.DRAGGING) {
      this.drag = null;
      state.phase = PHASE.PUZZLE_READY;
    }
    this.ui.showPause(state.paused);
    this.ui.el.hud.inert = state.paused; // nothing behind the pause card can be pressed
    this.ui.el.hits.inert = state.paused;
    if (!state.paused) this.ui.el.pause.focus({ preventScroll: true });
    if (state.paused) this.audio.suspend();
    else this.audio.resume();
    if (!state.paused) this.lastFrame = performance.now();
  }

  toggleSound() {
    state.muted = !state.muted;
    this.audio.setMuted(state.muted);
    this.ui.setSound(state.muted);
    try { localStorage.setItem('popo-muted', state.muted ? '1' : '0'); } catch (e) { /* storage may be unavailable */ }
  }

  resize() {
    this.stage.resize();
    this.ui.setScale(this.stage.scale);
    this.net.textScale = this.labelScale();
    this.net.sharpRes = this.textureRes();
    // keep the bubble, the corner and the hint on their marks even while paused
    if (this.dialogue && this.dialogue.who !== 'narrator') this.placeSpeech();
    this.placeHandle();
    this.ui.showRotateHint(this.stage.portrait);
    this.syncWaterCanvas();
  }

  // Texture pixels per stage pixel the screen can show: no more than it has (a small or
  // standard screen needs one), at most two.
  textureRes() {
    return Math.max(1, Math.min(2, this.stage.scale * this.stage.dpr));
  }

  // The net's labels are drawn in stage pixels; on a small screen the stage shrinks, so they
  // grow to stay about 14 CSS pixels or more.
  labelScale() {
    return Math.max(1, 0.64 / this.stage.scale);
  }

  // The painting is STAGE_W pixels wide, so the water pass never renders more pixels than
  // that; on big or Retina screens the browser scales it up. waterQuality drops on slow devices.
  syncWaterCanvas() {
    const c = this.stage.canvas;
    const k = Math.min(1, STAGE_W / c.width) * this.waterQuality;
    this.water.resize(Math.round(c.width * k), Math.round(c.height * k), c.style.width, c.style.height);
  }

  watchFrameRate(dt) {
    this.frameAvg = this.frameAvg * 0.97 + dt * 0.03;
    this.slowFor = this.frameAvg > 0.026 ? this.slowFor + dt : 0;
    if (this.slowFor > 2 && this.waterQuality > 0.6) {
      this.waterQuality = 0.6;
      this.slowFor = 0;
    }
  }

  // --- hints ------------------------------------------------------------------
  // Left alone for a while: on the first net the hand shows the drag once, along the way to
  // where the corner belongs; later nets swell their measurements instead, so the child
  // reasons rather than copies. No hint says whether the net is right: Drop Net does. Any
  // touch cancels a hint.
  updateHint(dt) {
    // a right net open in the water: the timing is the child's, but left a while, the hand shows where Catch is
    if (state.phase === PHASE.FISHING) {
      if (this.hint) { if ((this.hint.t += dt) > 2.4) { this.stopHint(); state.idleTime = 0; } return; }
      state.idleTime += dt;
      if (state.idleTime > HINT_REPEAT) this.pointAt(this.ui.el.action);
      return;
    }
    // (a right corner with Check up still gets the hand, on Check; a right corner without it needs no hint)
    if (state.phase !== PHASE.PUZZLE_READY || (this.netRight && this.ui.actionMode !== 'check' && LEVELS[state.level].type !== 'free')) return;
    if (this.hint) {
      if (this.hint.drag) this.advanceHand(dt);
      else if ((this.hint.t += dt) > 2.4) { this.stopHint(); state.idleTime = 0; }
      return;
    }
    state.idleTime += dt;
    const delay = this.hintShown ? HINT_REPEAT : LEVELS[state.level].hintDelay;
    if (state.idleTime > delay) this.showHint();
  }

  // A quiet spell brings the pointing hand, never the voice again: the instruction is said once, as its net comes
  // down (as in Fishing Frenzy). The hand shows how the corner slides (two stops the right way, never all the way to
  // its place) and the plate gives a nudge; on later nets the corner's marks pulse instead of a second hand.
  showHint() {
    if (LEVELS[state.level].type === 'free') { this.pointAt(this.ui.el.drop); return; }
    if (this.ui.actionMode === 'check') { this.pointAt(this.ui.el.action); return; } // the corner set: Check is next
    const drag = !this.handShown || state.level === 0;
    this.hint = { t: 0, drag };
    this.audio.play('hint');
    if (drag) {
      this.handShown = true;
      this.ui.showHand(true);
    } else {
      this.net.hintPulse = 2.4;
    }
    this.ui.pulseInstruction();
    this.hintShown = true;
  }

  // The hand taps a button: Drop Net (the warm-up), Check or Catch
  pointAt(el, again = false) {
    if (el.hidden || !el.getBoundingClientRect().width) return;
    const p = this.ui.buttonPoint(el, this.ui.buttonLow(el)); // (a bottom pill: on its middle)
    if (!again) this.ui.showHand(false);
    this.ui.moveHand(p.x, p.y);
    if (again) return; // (placed again as the view moves)
    this.hint = { t: 0, drag: false };
    this.hintAt = el;
    this.audio.play('hint');
    this.ui.pulseInstruction();
    this.hintShown = true;
  }

  // The hand shows how the corner slides: two stops the right way along its track, never all the
  // way to its place.
  advanceHand(dt) {
    const h = this.hint;
    h.t += dt;
    const net = this.net;
    const from = net.handle();
    const to = net.toStage(net.stop(net.stopAt - Math.sign(net.stopAt) * Math.min(2, Math.abs(net.stopAt))));
    const k = ease.inOut(Math.min(1, Math.max(0, (h.t - 0.5) / 1.2)));
    this.ui.moveHand(from.x + (to.x - from.x) * k + 6, from.y + (to.y - from.y) * k + 6);
    if (h.t > 2.1) this.ui.fadeHand();
    if (h.t > 2.4) {
      this.stopHint();
      state.idleTime = 0;
    }
  }

  stopHint() {
    if (!this.hint) return;
    this.hint = null;
    this.hintAt = null;
    this.net.hintPulse = 0;
    this.ui.hideHand();
  }

  placeHandle() {
    const h = this.net.handle();
    this.ui.placeHandle(h.x, h.y);
    const arrows = this.net.arrowPoints(h);
    this.ui.placeSteps(arrows.back, arrows.on);
  }

  // --- travel -----------------------------------------------------------------
  async prepareTransition(nextIndex, token) {
    await preloadBackground(LOCATIONS[nextIndex].background);
    if (isCurrent(token)) this.transition = { from: state.locationIndex, to: nextIndex, k: 0 };
  }

  finishTransition(nextIndex) {
    this.transition = null;
    state.locationIndex = nextIndex;
    this.applyLocation();
  }

  // --- loop -------------------------------------------------------------------
  loop(now, id) {
    if (!this.running || id !== this.loopId) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    try {
      if (!state.paused && !document.hidden) this.update(dt);
      this.draw();
    } finally {
      requestAnimationFrame((t) => this.loop(t, id));
    }
  }

  // Shows one story line word by word, with comic pauses after punctuation and a boing on
  // *stressed* words. A line's cue fires when its word appears (or when a tap skips ahead).
  // Resolves once the line has been on screen long enough to read.
  say(line, token) {
    return new Promise((resolve, reject) => {
      if (this.dialogue) this.endLine();
      const words = line.text.split(' ').map((raw) => ({ text: raw.replace(/\*/g, ''), em: raw.includes('*') }));
      const narrator = line.who === 'narrator';
      this.dialogue = {
        words, who: line.who, cue: line.cue, cueDone: false, token, resolve, reject, stay: !!line.stay, settled: false,
        next: 0, wait: 0, held: 0,
        pace: narrator ? 0.21 : 0.17,
        hold: (narrator ? 1000 : 700) + line.text.length * (narrator ? 26 : 22),
      };
      this.ui.showLine(line.who, words);
      this.placeSpeech();
      const voiced = this.audio.speak(line.who, line.text);
      if (voiced) this.paceToVoice(this.dialogue, voiced);
      else if (narrator) this.audio.play('narrate');
    });
  }

  // Spreads the words over the recording by length, with a beat after punctuation, so each
  // word appears as it's spoken. The bubble stays up a moment after the voice finishes.
  paceToVoice(d, seconds) {
    d.times = spokenTimes(d.words, seconds);
    d.elapsed = 0;
    d.voiced = true;
    // after the voice ends, the line stays long enough for a young reader to finish it
    d.hold = (seconds - d.times[d.times.length - 1]) * 1000 + Math.max(1200, d.words.length * 170);
  }

  placeSpeech() {
    const bird = this.dialogue && this.dialogue.who === 'swiftee' && this.swiftee;
    if (bird) {
      const h = bird.head();
      this.ui.placeSpeech(h.x, h.y);
      return;
    }
    const head = this.popo.headTop();
    this.ui.placeSpeech(head.x + 36, head.y + 16);
  }

  endLine(cancelled = true) {
    const dialogue = this.dialogue;
    this.dialogue = null;
    this.ui.hideLines();
    if (dialogue && dialogue.voiced && cancelled) this.audio.stopVoice();
    if (dialogue) {
      if (cancelled) dialogue.reject(new Cancelled());
      else dialogue.resolve();
    }
  }

  revealWord(d, quiet) {
    const i = d.next;
    const word = d.words[i];
    this.ui.revealWord(i, word.em);
    const cued = d.cue && !d.cueDone && d.cue.word <= i;
    if (!quiet && !cued) {
      try { this.audio.play(word.em ? 'boing' : ({ popo: 'talk', swiftee: 'chirp' })[d.who] || 'word'); }
      catch (e) { /* Optional audio must not stall dialogue. */ }
    }
    if (cued) {
      d.cueDone = true;
      this.storyCue(d.cue.do);
    }
    d.next += 1;
    const last = word.text.slice(-1);
    d.wait += d.pace + (word.text.endsWith('…') ? 0.45 : '.!?'.includes(last) ? 0.3 : last === ',' ? 0.15 : 0) + (word.em ? 0.08 : 0);
  }

  skipDialogue() {
    const d = this.dialogue;
    if (!d || d.settled) return false;
    if (d.next < d.words.length) {
      while (d.next < d.words.length) this.revealWord(d, true);
    } else if (d.held >= 600) {
      d.held = d.hold;
    }
    return true;
  }

  updateDialogue(dt) {
    const d = this.dialogue;
    if (!d) return;
    if (!isCurrent(d.token)) {
      this.endLine();
      return;
    }
    if (d.next < d.words.length) {
      if (d.voiced) {
        d.elapsed += dt;
        while (d.next < d.words.length && d.elapsed >= d.times[d.next]) this.revealWord(d, true);
      } else {
        d.wait -= dt;
        while (d.wait <= 0 && d.next < d.words.length) this.revealWord(d, false);
      }
    } else {
      d.held += dt * 1000;
      if (d.held >= d.hold && !d.stay) {
        this.endLine(false);
        return;
      }
      // a `stay` line (Swiftee's "Let's find out!") resolves once read, and stays up until Next
      if (d.held >= d.hold && !d.settled) {
        d.settled = true;
        d.resolve();
      }
    }
    if (d.who !== 'narrator') this.placeSpeech();
  }

  // Moments in the scene that a story line can trigger on one of its words.
  storyCue(name) {
    if (name === 'hop') {
      this.hop = { t: 0 };
      this.audio.play('boing');
    } else if (name === 'fishIn') {
      this.fishIn();
    } else if (name === 'exclaim') {
      this.popo.react('happy', 1.2);
      this.audio.play('woah');
    } else if (name === 'wonder') {
      this.popo.react('think', 2.4);
      this.audio.play('hmm');
    } else if (name === 'twirl' && this.swiftee) {
      if (!this.fx.reduced) this.swiftee.twirl();
      this.fx.sparkle(this.swiftee.x, this.swiftee.y - 40, 8);
      this.audio.play('boing');
    } else if (name === 'hop' && this.swiftee && this.dialogue && this.dialogue.who === 'swiftee') {
      this.swiftee.hop();
    }
  }

  updateStoryFx(dt) {
    if (!this.hop) return;
    // a happy hop: up out of the water, then a splash down
    this.hop.t += dt;
    const k = this.hop.t / 0.5;
    if (k < 1) {
      this.popo.dip = -18 * Math.sin(Math.PI * k);
    } else {
      this.popo.dip = 0;
      this.hop = null;
      const raft = this.popo.raftEnds();
      this.fx.splash((raft.left + raft.right) / 2, this.waterline, false);
      this.fx.ripple(raft.right, this.waterline + 4, 0.8);
      this.audio.play('splashSmall');
    }
  }

  // A cartoon cloud: soft white puffs burst outward and fade, hiding a quick costume change.
  drawPoof(ctx) {
    const p = this.poof;
    if (!p) return;
    const k = Math.min(1, p.t / 0.6);
    const grow = 1 - (1 - k) ** 3;
    ctx.save();
    ctx.globalAlpha = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
    const puffs = [];
    for (let i = 0; i < 11; i += 1) {
      const a = (i / 11) * Math.PI * 2 + 0.3;
      const d = 30 + grow * (i % 2 ? 84 : 62);
      const r = (i % 3 === 0 ? 44 : 34) * (0.75 + grow * 0.45);
      puffs.push([p.x + Math.cos(a) * d * 1.15, p.y + Math.sin(a) * d * 0.75, r]);
    }
    puffs.push([p.x, p.y, 46 * (1 - grow * 0.6)]);
    // outline first, then shade, then the white faces, so the puffs merge into one cloud
    ctx.fillStyle = '#9fc4e4';
    for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#d6eaf8';
    for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x + 3, y + 5, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x - 2, y - 3, r * 0.92, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // The raft sits on the animated surface: it rises, falls and tilts with the waves under its
  // two ends, and sends out a small ripple now and then.
  rideWaves(dt) {
    const popo = this.popo;
    const ends = popo.raftEnds();
    const shift = popo.travelShift + popo.lean;
    const left = ends.left + shift;
    const right = ends.right + shift;
    if (this.water.ok) {
      const amp = this.fx.reduced ? 0.35 : 1;
      const t = this.fx.t;
      const yl = -surfaceWave(left, t) * amp;
      const yr = -surfaceWave(right, t) * amp;
      const yc = -surfaceWave((left + right) / 2, t) * amp;
      popo.waveY = (yl + yr + 2 * yc) / 4;
      popo.waveAngle = Math.atan2(yr - yl, right - left) * 0.85;
    } else {
      popo.waveY = Math.sin(popo.bobT * 1.65) * 2.4 * (this.fx.reduced ? 0.2 : 1);
      popo.waveAngle = 0;
    }
    this.raftRippleIn -= dt;
    if (this.raftRippleIn <= 0) {
      this.raftRippleIn = 1.4 + Math.random() * 1.4;
      this.fx.ripple(Math.random() < 0.5 ? left + 8 : right - 8, this.waterline + 4, 0.55);
    }
  }

  // Average colour of the painted water just below the surface, for the water over the raft.
  surfaceColor() {
    const index = LOCATIONS[state.locationIndex].background;
    if (this.surfaceColors[index]) return this.surfaceColors[index];
    const img = assets.backgrounds[index];
    if (!img) return null;
    let colour = [40, 170, 240];
    try {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 16;
      const cx = c.getContext('2d');
      cx.drawImage(img, 500, this.waterline - SCENE_SHIFT + 8, 800, 32, 0, 0, 400, 16);
      const d = cx.getImageData(0, 0, 400, 16).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
      colour = sum.map((v) => Math.round(v / (d.length / 4)));
    } catch (e) { /* a tainted canvas keeps the default colour */ }
    this.surfaceColors[index] = colour;
    return colour;
  }

  // Water lapping over the bottom of the raft, following the same waves, so the raft sits in
  // the water rather than on top of it. Fades out at both ends into the painted surface.
  drawRaftWater(ctx) {
    const colour = this.surfaceColor();
    if (!colour) return;
    const popo = this.popo;
    if (popo.dip < -30 || Math.abs(popo.travelShift) > STAGE_W) return; // up on the giant wave, or away with it
    const ends = popo.raftEnds();
    const shift = popo.travelShift + popo.lean;
    const x0 = Math.floor(ends.left + shift - 34);
    const x1 = Math.ceil(ends.right + shift + 34);
    const top = Math.floor(this.waterline - 16);
    const w = x1 - x0;
    const h = 60;
    const c = this.raftWaterCanvas || (this.raftWaterCanvas = document.createElement('canvas'));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    const t = this.fx.t;
    const amp = this.water.ok ? (this.fx.reduced ? 0.35 : 1) : 0;
    const lap = this.fx.reduced ? 0.4 : 1.6;
    const edge = (x) => this.waterline - (this.wave ? this.wave.lift(x) : 0) - surfaceWave(x, t) * amp + lap * Math.sin(x * 0.08 + t * 2.6) - top;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 5) g.lineTo(x, edge(x0 + x));
    g.lineTo(w, h);
    g.closePath();
    const [r, gr, b] = colour;
    const fill = g.createLinearGradient(0, 10, 0, h);
    fill.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0.88)`);
    fill.addColorStop(0.45, `rgba(${r}, ${gr}, ${b}, 0.62)`);
    fill.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
    g.fillStyle = fill;
    g.fill();
    g.beginPath();
    for (let x = 0; x <= w; x += 5) {
      const y = edge(x0 + x);
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    g.lineWidth = 7;
    g.stroke();
    g.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    g.lineWidth = 2.2;
    g.stroke();
    g.globalCompositeOperation = 'destination-in';
    const fade = g.createLinearGradient(0, 0, w, 0);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fade.addColorStop(0.13, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(0.87, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(c, x0, top);
  }

  update(dt) {
    this.title.update(dt);
    clock.update(dt);
    this.popo.update(dt);
    this.fx.update(dt);
    this.popo.waterResponse = this.fx.raftResponse(this.popo.anchor.x);
    this.rideWaves(dt);
    if (this.poof && (this.poof.t += dt) > 0.6) this.poof = null;
    if (this.swiftee) this.swiftee.update(dt);
    // waiting for Next, Swiftee gives a little hop and a chirp now and then
    if (this.awaitingNext && this.swiftee && !state.paused) {
      this.nextNudge -= dt;
      if (this.nextNudge <= 0) {
        this.nextNudge = 3.4;
        this.swiftee.hop();
        this.audio.play('chirp');
      }
    }
    this.updateDialogue(dt);
    this.updateDelivery(dt);
    if (this.ending) this.updateEnding(dt);
    this.updateFliers(dt);
    this.updateConfetti(dt);
    this.updateStoryFx(dt);
    this.watchFrameRate(dt);

    // the net hangs from the boom, so it rides the waves with the raft; Popo's wheel follows
    // the drum
    const { popo, winch, net } = this;
    net.origin = popo.transformPoint(winch.hang.x, winch.hang.y);
    net.drop = winch.ropeOut;
    net.ropePhase = winch.ropeOut;
    popo.setMachine(winch, dt);
    // hanging on its sling, the net sways a touch while it waits (easing into it, never with a
    // jump); it holds still for a drag
    const idle = state.phase === PHASE.PUZZLE_READY;
    if (idle && !this.fx.reduced) net.swing += (Math.sin(this.fx.t * 0.9) * 0.008 - net.swing) * Math.min(1, dt * 2);
    else if (state.phase === PHASE.DRAGGING) net.swing *= Math.max(0, 1 - dt * 6);
    net.update(dt);

    // the school and any fish swimming out of the sea share the lanes
    if (state.fish.length || this.strays.length) this.sea.steer([...state.fish, ...this.strays], this.swimArea, dt);
    for (const f of state.fish) {
      if (f.gone) continue;
      if (f.caught) {
        // netted fish hang in the mesh, swaying with the net, and slide into its bag as it closes
        const p = net.toStage(net.catchPoint(f.caught));
        f.x = p.x;
        f.y = p.y;
        f.update(dt, this.swimArea);
        continue;
      }
      f.update(dt, this.swimArea);
      if (f.waiting) continue; // still out of sight, waiting to swim in
      if (f.breath <= 0 && !f.frozen) {
        f.breath = 1.6 + Math.random() * 2.6;
        f.puffs += 1 + Math.floor(Math.random() * 3);
      }
      if (f.puffs > 0) {
        this.puffFrom(f, f.puffs);
        f.puffs = 0;
      }
      // the prize fish leave a glint now and then
      if (f.rare && Math.random() < dt * 0.6) this.fx.sparkle(f.x - f.dir * f.w * 0.3, f.y + (Math.random() - 0.5) * f.h * 0.5, 1);
    }
    for (const f of this.strays) f.update(dt, this.swimArea);
    if (this.strays.some((f) => f.gone)) this.strays = this.strays.filter((f) => !f.gone);
    if (this.ambient.some((f) => f.gone)) this.ambient = this.ambient.filter((f) => !f.gone);
    for (const f of this.ambient) f.update(dt, this.area);
    if (this.deep.some((d) => d.gone)) this.deep = this.deep.filter((d) => !d.gone);
    for (const d of this.deep) d.update(dt);
    if (state.phase === PHASE.PUZZLE_READY || state.phase === PHASE.DRAGGING) this.placeHandle();
    this.applyFocus(dt);
    this.updateHint(dt);
  }

  // The painting goes through the per-pixel water pass (src/water.js); without WebGL it is
  // drawn plainly. Returns the ambient drift the underwater effects follow during a row.
  drawBackground(ctx) {
    const index = LOCATIONS[state.locationIndex].background;
    const current = assets.backgrounds[index];
    if (!current) { preloadBackground(index); return 0; }
    const lift = SCENE_SHIFT * (1 - this.camera.pan);
    const k = this.transition ? this.transition.k : 0;
    const next = this.transition ? assets.backgrounds[LOCATIONS[this.transition.to].background] : null;
    if (this.water.ok) {
      this.syncWaterCanvas();
      const drawn = this.water.render({
        from: current, to: next, mix: k, time: this.fx.t, waterline: this.waterline - lift, shift: SCENE_SHIFT - lift,
        hump: this.wave ? this.wave.hump() : null, // the giant wave lifts the lake (../shared/wave.js)
        plants: lift ? this.fx.plantsFor(index).map((p) => ({ ...p, top: p.top - lift, root: p.root - lift })) : this.fx.plantsFor(index),
        amplitude: this.fx.reduced ? 0.35 : 1,
      });
      if (drawn) {
        this.water.show(true);
        return -Math.sin(k * Math.PI) * 18;
      }
    }
    this.water.show(false);
    this.drawPaintingPlain(ctx, current, next, k);
    return 0;
  }

  // Fallback for browsers without WebGL: the painting drawn plainly below a band of sky;
  // during a row the two paintings slide with depth parallax and a feathered seam.
  drawPaintingPlain(ctx, current, next, k) {
    const sky = ctx.createLinearGradient(0, 0, 0, SCENE_SHIFT);
    sky.addColorStop(0, '#1e78d8');
    sky.addColorStop(1, '#3a95ea');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, STAGE_W, SCENE_SHIFT + 1);
    ctx.save();
    ctx.translate(0, SCENE_SHIFT);
    if (next) this.drawParallaxPlain(ctx, current, next, k);
    else ctx.drawImage(current, 0, 0, STAGE_W, STAGE_H);
    ctx.restore();
  }

  featheredCopy(img) {
    if (this.featheredSource === img) return this.feathered;
    const c = document.createElement('canvas');
    c.width = STAGE_W;
    c.height = STAGE_H;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, STAGE_W, STAGE_H);
    const mask = cx.createLinearGradient(0, 0, PAN_OVERLAP, 0);
    mask.addColorStop(0, 'rgba(0, 0, 0, 0)');
    mask.addColorStop(1, 'rgba(0, 0, 0, 1)');
    cx.globalCompositeOperation = 'destination-in';
    cx.fillStyle = mask;
    cx.fillRect(0, 0, PAN_OVERLAP, STAGE_H);
    cx.fillStyle = '#000';
    cx.fillRect(PAN_OVERLAP, 0, STAGE_W - PAN_OVERLAP, STAGE_H);
    this.feathered = c;
    this.featheredSource = img;
    return c;
  }

  drawParallaxPlain(ctx, current, next, k) {
    const pan = STAGE_W - PAN_OVERLAP;
    const ox = -k * pan;
    ctx.drawImage(current, ox, 0, STAGE_W, STAGE_H);
    ctx.save();
    ctx.translate(ox + STAGE_W * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(current, 0, 0, STAGE_W, STAGE_H);
    ctx.restore();
    const smooth = (a, b, x) => { const v = Math.min(1, Math.max(0, (x - a) / (b - a))); return v * v * (3 - 2 * v); };
    ctx.globalAlpha = smooth(0, 0.07, k);
    ctx.drawImage(this.featheredCopy(next), ox + pan, 0, STAGE_W, STAGE_H);
    ctx.globalAlpha = smooth(0.93, 1, k);
    if (ctx.globalAlpha > 0) ctx.drawImage(next, 0, 0, STAGE_W, STAGE_H);
    ctx.globalAlpha = 1;
  }

  draw() {
    const ctx = this.stage.begin();
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    const lift = SCENE_SHIFT * (1 - this.camera.pan); // (the lesson's camera, gliding down to the sand)
    ctx.save();
    if (lift) ctx.translate(0, -lift);
    const offset = this.drawBackground(ctx);
    this.fx.drawWater(ctx, offset, state.fish);
    for (const f of this.ambient) f.draw(ctx);
    for (const d of this.deep) d.draw(ctx);
    for (const f of this.strays) f.draw(ctx);
    for (const f of state.fish) if (!f.flying) f.draw(ctx);
    for (const f of this.leapers) f.draw(ctx);
    this.fx.drawSplashLayer(ctx, false);
    this.drawFocusDim(ctx); // (zoomed in on the net: the scene so far goes dark, what follows stays lit)
    // the net hangs over the fish; its lifting rope comes down from the boom's end pulley
    const { popo, winch } = this;
    this.net.draw(ctx, { waterline: this.waterline, pulley: { hub: popo.transformPoint(winch.hub.x, winch.hub.y), exit: popo.transformPoint(winch.exit.x, winch.exit.y) } });
    // the raft, the machine on it and Popo at its wheel ride the waves as one; Popo is drawn
    // after the machine so his wheel's shaft meets the axle (rowing, he paddles behind it)
    const onRaft = (part) => {
      ctx.save();
      popo.applyTransform(ctx);
      ctx.translate(popo.anchor.x, popo.anchor.y);
      part();
      ctx.restore();
    };
    if (popo.rowing) {
      popo.draw(ctx);
      onRaft(() => winch.draw(ctx));
    } else {
      onRaft(() => { popo.drawRaftProp(ctx); winch.draw(ctx); });
      popo.draw(ctx);
    }
    // netted fish hop over the deck into the bucket
    for (const f of state.fish) if (f.flying) {
      ctx.save();
      if (f.landing) {
        const mouth = popo.bucketPoint();
        ctx.beginPath(); ctx.rect(0,0,STAGE_W,mouth.y+4); ctx.clip();
      }
      f.draw(ctx); ctx.restore();
    }
    if (this.wave) this.wave.drawFront(ctx); // the giant wave's foam and spray, over Popo
    this.drawRaftWater(ctx);
    if (this.swiftee) this.swiftee.draw(ctx);
    this.drawPoof(ctx);
    this.fx.drawFront(ctx);
    this.drawConfetti(ctx);
    this.drawFliers(ctx);
    ctx.restore();
    if (this.title.visible) this.title.draw(ctx);
    this.drawCurtain();
  }

  // --- the counter ---------------------------------------------------------------------
  // A fish that lands in the bucket pops back out as a little glowing copy of itself and arcs up
  // to the counter with a spin, trailing sparkles, as coins fly to a game's counter. When it
  // arrives the counter counts it with a gulp and a plink (every tenth fish, a big cheer), and
  // when the last of a catch arrives "+3" pops up beside it. They fly on the game's clock, so a
  // pause stops them mid-air.
  flyToCounter(fish, batch) {
    const reduced = this.fx.reduced;
    this.fliers.push({
      img: fish.img, box: fish.box, w: fish.w, h: fish.h, dir: fish.dir || 1, rare: fish.rare, batch,
      from: this.popo.bucketPoint(), t: 0, dur: reduced ? 0.35 : 0.85, trail: 0,
    });
  }

  updateFliers(dt) {
    if (!this.fliers.length) return;
    for (const fl of this.fliers) {
      fl.t += dt;
      fl.trail -= dt;
      if (fl.at && fl.trail <= 0 && !this.fx.reduced) {
        fl.trail = 0.05;
        this.fx.sparkle(fl.at.x, fl.at.y, 1);
      }
    }
    const arrived = this.fliers.filter((fl) => fl.t >= fl.dur);
    if (!arrived.length) return;
    this.fliers = this.fliers.filter((fl) => fl.t < fl.dur);
    for (const fl of arrived) {
      this.landed += 1;
      const cheer = this.landed % 10 === 0;
      this.ui.setCatch(this.landed, cheer ? 'cheer' : 'gulp');
      this.audio.play(cheer ? 'cheer' : 'count');
      fl.batch.left -= 1;
      if (!fl.batch.left) this.ui.floatGain(fl.batch.total);
    }
  }

  drawFliers(ctx) {
    if (!this.fliers.length) return;
    const to = this.ui.counterPoint();
    for (const fl of this.fliers) {
      const t = Math.min(1, fl.t / fl.dur);
      const k = t * t * (3 - 2 * t);
      const peak = { x: (fl.from.x + to.x) / 2 + 60, y: Math.min(fl.from.y, to.y) - 150 };
      const x = (1 - k) * (1 - k) * fl.from.x + 2 * (1 - k) * k * peak.x + k * k * to.x;
      const y = (1 - k) * (1 - k) * fl.from.y + 2 * (1 - k) * k * peak.y + k * k * to.y;
      fl.at = { x, y };
      // popping out of the bucket, then shrinking into the badge
      const s = (t < 0.15 ? 0.25 + (t / 0.15) * 0.3 : 0.55 - 0.3 * k) * (fl.rare ? 1.1 : 1);
      ctx.save();
      ctx.translate(x, y);
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, fl.w * s * 0.9);
      glow.addColorStop(0, 'rgba(255, 240, 150, 0.75)');
      glow.addColorStop(1, 'rgba(255, 240, 150, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, fl.w * s * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(this.fx.reduced ? 0 : -k * Math.PI * 2 * fl.dir);
      ctx.scale(fl.dir * s, s);
      const [x0, y0, x1, y1] = fl.box;
      ctx.drawImage(fl.img, x0, y0, x1 - x0, y1 - y0, -fl.w / 2, -fl.h / 2, fl.w, fl.h);
      ctx.restore();
    }
  }

  // --- bubble confetti (Fishing Frenzy's) ---------------------------------------------
  // A catch bursts out of the bag as bright bubbles that fly up, slow, drift and wobble, and pop
  // after a couple of seconds, a few at a time.
  confettiFrom(x, y, count = 30) {
    const colours = ['#ff7aa8', '#ffd166', '#7ee0ff', '#9cf28a', '#c9a7ff', '#ffa35c'];
    const n = this.fx.reduced ? 8 : count;
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 170 + Math.random() * 260;
      this.confetti.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 7 + Math.random() * 10, colour: colours[i % colours.length],
        life: 0, span: 1.8 + Math.random() * 0.9, wob: Math.random() * Math.PI * 2 });
    }
  }

  updateConfetti(dt) {
    if (!this.confetti.length) return;
    let popped = 0;
    for (const c of this.confetti) {
      const was = c.life;
      c.life += dt / c.span;
      c.vx *= 1 - Math.min(1, dt * 1.8);
      c.vy = c.vy * (1 - Math.min(1, dt * 1.8)) - 45 * dt;
      c.x += (c.vx + Math.sin(c.life * 9 + c.wob) * 18) * dt;
      c.y += c.vy * dt;
      if (was < 0.9 && c.life >= 0.9) popped += 1;
    }
    if (popped) this.audio.play('word');
    this.confetti = this.confetti.filter((c) => c.life < 1);
  }

  drawConfetti(ctx) {
    for (const c of this.confetti) {
      const pop = c.life > 0.9 ? 1 + (c.life - 0.9) * 4 : 1;
      const fade = c.life > 0.9 ? 1 - (c.life - 0.9) * 10 : Math.min(1, c.life * 12);
      const r = c.r * pop;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `${c.colour}77`;
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = c.colour;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c.x - r * 0.35, c.y - r * 0.35, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.restore();
    }
  }

  // --- the end screen ---------------------------------------------------------------
  // Its idle life, as in Fishing Frenzy: the rays turn, the letters bob, the twinkles glint and
  // Popo laughs on a loop. Reopening (Play Again), the circle widens until the new game is in
  // full view.
  updateEnding(dt) {
    const e = this.ending;
    e.t += dt;
    if (e.opening) {
      e.r += dt * (this.fx.reduced ? 5200 : 2600);
      if (e.r > 1950) this.ending = null;
      return;
    }
    if (e.laugh && (e.laughIn -= dt) <= 0) {
      e.laughIn = 1.7;
      this.popo.react('laugh', 1.6);
      if (e.giggles > 0) {
        e.giggles -= 1;
        this.audio.play('giggle');
      }
    }
  }

  // The curtain over the scene: a warm sunburst everywhere but the circle, slowly turning rays, a
  // dark and cream frame round the circle, and The End above it. The scene itself is moved
  // (panScene) so what's in the circle glides with it.
  drawCurtain() {
    const e = this.ending;
    if (!e && !this.curtainUp) return;
    const ctx = this.stage.beginCurtain();
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    this.curtainUp = Boolean(e);
    this.ui.panScene(e ? e.pan.x : 0, e ? e.pan.y : 0);
    if (!e) return;
    const x = e.x + e.pan.x;
    const y = e.y + e.pan.y;
    const r = Math.max(0, e.r);
    drawSunburst(ctx, x, y, r, this.fx.reduced ? 0 : e.t * 0.08);
    if (e.titleAt !== undefined) this.drawTheEnd(ctx, x, Math.max(120, y - r - 115), e.t - e.titleAt, e.fade ?? 1);
  }

  // "The End" in big outlined gold letters, each popping in a moment after the last and then
  // bobbing, with twinkles either side.
  drawTheEnd(ctx, cx, cy, t, alpha) {
    const text = 'The End';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 168px Fredoka, "Arial Rounded MT Bold", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const widths = [...text].map((ch) => ctx.measureText(ch).width);
    let left = cx - widths.reduce((sum, w) => sum + w, 0) / 2;
    [...text].forEach((ch, i) => {
      const k = Math.min(1, Math.max(0, (t - i * 0.08) / 0.4));
      const at = left + widths[i] / 2;
      left += widths[i];
      if (!k || ch === ' ') return;
      const bob = this.fx.reduced ? 0 : Math.sin(this.fx.t * 2.6 + i * 0.8) * 6;
      ctx.save();
      ctx.translate(at, cy + bob);
      const s = ease.outBack(k);
      ctx.scale(s, s);
      ctx.lineWidth = 18;
      ctx.strokeStyle = '#3b1d00';
      ctx.strokeText(ch, 0, 0);
      const fill = ctx.createLinearGradient(0, -70, 0, 70);
      fill.addColorStop(0, '#fffbe9');
      fill.addColorStop(1, '#ffc94d');
      ctx.fillStyle = fill;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    if (t > 0.6 && !this.fx.reduced) {
      ENDING_TWINKLES.forEach(([dx, dy], i) => {
        const k = Math.max(0, Math.sin(t * 1.7 + i * 1.9)) ** 4;
        if (k < 0.02) return;
        const x = cx + dx;
        const y = cy + dy;
        const r = 6 + k * 12;
        ctx.fillStyle = `rgba(255, 233, 168, ${k})`;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.quadraticCurveTo(x, y, x, y + r);
        ctx.quadraticCurveTo(x, y, x - r, y);
        ctx.quadraticCurveTo(x, y, x, y - r);
        ctx.fill();
      });
    }
    ctx.restore();
  }
}

Object.assign(PopoGame, { Game });
})(window.PopoGame = window.PopoGame || {});
