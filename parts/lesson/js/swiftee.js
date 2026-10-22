// =====================================================================
// SWIFTEE — the mascot: plays her expression sprite sheets on one canvas (listed in js/swiftee-manifest.js).
//   play(state)     change expression (after minHoldMs, with a short cross-fade)
//   talk(on, next)  lip-sync: beak moving while the voice plays, then `next`
// Every sheet is a uniform grid with the same centre, so any frame can follow any other without the bird jumping.
// The still image underneath stays visible until the first frame is drawn (or if the sheets cannot load).
// =====================================================================
window.SwifteeMascot = class SwifteeMascot {
  constructor(opts) {
    this.base = opts.base || 'swiftee-assets/';
    this.find = opts.find;                  // () => the .swiftee container in the stage
    this.idle = opts.idle || 'blinking';
    this.minHoldMs = opts.minHoldMs || 900; // an expression stays at least this long, so quick lines don't flicker
    this.fadeMs = 140;                      // cross-fade between clips
    this.sheets = {};                       // anim -> { ready, info, pages }
    this.target = this.idle;
    this.cur = null;
    this.fade = null;
    this.alive = true;
    this.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.loop = this.loop.bind(this);
    // the sheets are listed in js/swiftee-manifest.js (a script, so it also loads from file://); without it the still
    // image stays
    if (window.SWIFTEE_MANIFEST) setTimeout(() => { if (this.alive) this.init(window.SWIFTEE_MANIFEST); }, 0);
  }

  // manifest ready: start the idle expression and the frame loop
  init(m) {
    this.m = m;
    this.frameMs = 1000 / (m.fps || 20);
    this.preload(this.target);
    this.cur = this.enter(this.target);
    this.last = performance.now();
    requestAnimationFrame(this.loop);
    this.onResize = () => this.regrade();
    addEventListener('resize', this.onResize);
  }
  destroy() { this.alive = false; if (this.onResize) removeEventListener('resize', this.onResize); }

  // ---------- public ----------
  // set the next expression; step() switches to it once the current one has had minHoldMs
  play(state) {
    if (!state) return;
    if (this.m && !this.m.states[state] && this.m.standalone.indexOf(state) < 0) return;
    if (state === this.target) return;
    this.target = state;
    if (this.m) this.preload(state);
  }
  // lip-sync: talk(true) cuts to the talking loop as soon as the voice starts; talk(false, next) plays talk_stop
  // (beak closing), then `next`. Neither waits for minHoldMs
  talk(on, next) {
    if (!this.m || !this.m.states.talking) { if (!on && next) this.play(next); return; }
    const now = performance.now();
    if (on) {
      this.target = 'talking';
      if (this.cur && this.cur.state === 'talking' && this.cur.phase !== 'stop') return;
      this.preload('talking');
      if (this.cur) this.swap(this.clip('talking', 'loop', this.parts('talking').loop), now);
      return;
    }
    this.target = next || this.idle;
    this.preload(this.target);
    if (this.cur && this.cur.state === 'talking') {
      const stop = this.parts('talking').stop;
      this.swap(stop && !this.reduced ? this.clip('talking', 'stop', stop) : this.enter(this.target), now);
    }
  }
  // load sheets ahead of time so a reaction never waits on the network (queued until the manifest is in)
  warm(states) { if (!this.m) { this.pending = states; return; } states.forEach((s) => this.preload(s)); }

  // ---------- sheets ----------
  // @1x cells are 256 px; load @2x only when she is drawn bigger. Her size on screen depends on the stage's fit to the
  // window, so the stage is fitted first (before js/stage-fit.js's own timer has run, she would measure at full size)
  scale() {
    if (this.sc) return this.sc;
    const el = this.canvas();
    if (window.fitStage) window.fitStage();
    const px = el ? el.getBoundingClientRect().width * (window.devicePixelRatio || 1) : 0;
    this.sc = px > 300 ? '2x' : '1x';
    return this.sc;
  }
  // the window grew (a phone turned to landscape, a window maximised): move up to the @2x sheets if she is now drawn
  // bigger. Never back down to @1x, which would only fetch the sheets again. Both scales have the same frames, so the
  // clip carries on; the last frame stays on screen until its @2x sheet is in
  regrade() {
    if (this.sc !== '1x') return;
    this.sc = null;
    if (this.scale() === '1x') return;
    const anims = Object.keys(this.sheets);
    this.sheets = {}; this.ctx = null; this.fade = null;
    anims.forEach((a) => this.sheet(a));
  }
  // the clips an expression uses. Most sheets' own start/stop clips are pre-blended between two poses (half see-through,
  // doubled outlines), so those expressions switch by cross-fade instead. Talking keeps its start/stop: those frames
  // are clean and open and close the beak
  parts(state) {
    const s = this.m.states[state];
    if (!s) return { loop: state };
    return state === 'talking' ? { start: s.start, loop: s.loop, stop: s.stop } : { loop: s.loop };
  }
  // start loading every sheet an expression needs, plus any list queued by warm()
  preload(state) {
    const p = this.parts(state);
    [p.start, p.loop, p.stop].forEach((a) => a && this.sheet(a));
    if (this.pending) { const q = this.pending; this.pending = null; this.warm(q); }
  }
  sheet(anim) {
    if (this.sheets[anim]) return this.sheets[anim];
    const info = this.m.scales[this.scale()].sheets[anim];
    if (!info) return null;
    // a paged sheet (info.pages: too many frames for one image) is ready once every page has loaded
    const pages = (info.pages || [{ image: info.image, cols: info.cols, first: 0, frames: info.frames }]).map((p) => {
      const pg = Object.assign({ img: new Image(), ready: false }, p);
      pg.img.decoding = 'async';
      pg.img.onload = () => { pg.ready = true; sh.ready = pages.every((x) => x.ready); };
      pg.img.src = this.base + p.image;
      return pg;
    });
    const sh = { ready: false, info: info, pages: pages };
    this.sheets[anim] = sh;
    return sh;
  }

  // ---------- sequencing ----------
  // an expression's first clip: its start clip if it has one, else its loop
  enter(state) {
    const p = this.parts(state);
    if (p.start && !this.reduced) return this.clip(state, 'start', p.start);
    return this.clip(state, 'loop', p.loop);
  }
  // a clip is one sheet, played once (start, stop) or looped; pingpong plays it forwards then back
  clip(state, phase, anim) {
    const a = this.m.animations[anim] || {};
    const n = this.m.scales[this.scale()].sheets[anim].frames;
    const fms = a.fps ? 1000 / a.fps : this.frameMs; // an animation may set its own frame rate (e.g. the measuring walk)
    return { state: state, phase: phase, anim: anim, n: n, pp: !!a.pingpong, i: 0, t0: performance.now(), fms: fms };
  }
  // clip length in steps, and the sheet frame for the current step
  len(c) { return c.pp ? Math.max(1, c.n * 2 - 2) : c.n; }
  frameOf(c) { return c.pp && c.i >= c.n ? c.n * 2 - 2 - c.i : c.i; }
  ready(c) { const s = this.sheets[c.anim]; return !!(s && s.ready); }

  // decide what follows the clip that just finished (or is being cut short)
  advance(now) {
    const c = this.cur, p = this.parts(c.state);
    const leaving = this.target !== c.state;
    if (c.phase === 'start') return this.clip(c.state, 'loop', p.loop);
    if (c.phase === 'loop') {
      if (!leaving) return null; // keep looping
      if (p.stop && !this.reduced) return this.clip(c.state, 'stop', p.stop);
      return this.enter(this.target);
    }
    return this.enter(this.target); // a stop finished
  }

  // frame loop: wait for the sheet, step the clip at its frame rate, draw
  loop(now) {
    if (!this.alive) return;
    requestAnimationFrame(this.loop);
    const c = this.cur;
    if (!c) return;
    // hold until the needed sheet is decoded; the current frame keeps showing meanwhile
    if (!this.ready(c)) { this.sheet(c.anim); this.last = now; return; }
    if (this.reduced) { // reduced motion: hold one frame, switch expressions after minHoldMs
      if (this.target !== c.state && now - c.t0 >= this.minHoldMs) { this.swap(this.enter(this.target), now); }
      this.draw(now);
      return;
    }
    const fms = c.fms || this.frameMs;
    const el = now - this.last;
    if (el < fms) { if (this.fade || !this.drawn) this.draw(now); return; }
    let steps = Math.floor(el / fms);
    if (steps > 3) { steps = 1; this.last = now; } // tab was hidden: don't race to catch up
    else this.last += steps * fms;
    for (let k = 0; k < steps; k++) this.step(now);
    this.draw(now);
  }
  // move the current clip on by one frame
  step(now) {
    const c = this.cur;
    const held = now - c.t0 >= this.minHoldMs;
    // once it has been held long enough, a loop can be left mid-cycle (with a cross-fade)
    if (c.phase === 'loop' && this.target !== c.state && held && c.i > 0) {
      const nx = this.advance(now);
      if (nx) { this.swap(nx, now); return; }
    }
    c.i++;
    if (c.i < this.len(c)) return;
    c.i = 0;
    if (c.phase === 'loop' && (this.target === c.state || !held)) return; // wrap
    const nx = this.advance(now);
    if (nx) { if (nx.state !== c.state) this.swap(nx, now); else { this.cur = nx; this.sheet(nx.anim); } } // a new expression cross-fades in
  }
  // switch to clip nx, keeping the old frame for the cross-fade
  swap(nx, now) {
    const c = this.cur;
    this.fade = { anim: c.anim, f: this.frameOf(c), t0: null }; // clock starts when the new clip first draws
    this.cur = nx;
    this.sheet(nx.anim);
  }

  // ---------- drawing ----------
  // find the canvas again if the stage re-rendered it
  canvas() {
    if (this.cv && this.cv.isConnected) return this.cv;
    const root = this.find && this.find();
    this.root = root || null;
    this.cv = root ? root.querySelector('canvas') : null;
    this.ctx = null;
    this.drawn = false; // a replacement canvas needs its own data-live reveal
    return this.cv;
  }
  // draw sheet frame f (from whichever page holds it) over the whole canvas
  blit(ctx, anim, f, alpha) {
    const sh = this.sheets[anim];
    if (!sh || !sh.ready) return false;
    const cell = sh.info.cell, pg = sh.pages.find((p) => f >= p.first && f < p.first + p.frames) || sh.pages[0], i = f - pg.first;
    const sx = (i % pg.cols) * cell, sy = Math.floor(i / pg.cols) * cell;
    ctx.globalAlpha = alpha;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (window.Costume) Costume.frame(ctx, pg.img, sx, sy, cell, anim, f, 0, 0, ctx.canvas.width, ctx.canvas.height); // her diving mask (js/costume.js)
    else ctx.drawImage(pg.img, sx, sy, cell, cell, 0, 0, ctx.canvas.width, ctx.canvas.height);
    return true;
  }
  draw(now) {
    const cv = this.canvas();
    if (!cv) return;
    if (!this.ctx) {
      const size = this.scale() === '2x' ? 512 : 256;
      if (cv.width !== size) { cv.width = size; cv.height = size; }
      this.ctx = cv.getContext('2d');
    }
    const ctx = this.ctx, c = this.cur;
    // the next clip's sheet is still loading: keep the last frame on screen rather than going blank
    if (!this.ready(c)) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    let a = 1;
    if (this.fade) {
      if (this.fade.t0 === null) this.fade.t0 = now;
      const t = (now - this.fade.t0) / this.fadeMs;
      if (t >= 1) this.fade = null;
      else this.blit(ctx, this.fade.anim, this.fade.f, 1 - t); // the old frame fades out under the new one, which is drawn solid, so she never looks see-through
    }
    if (this.blit(ctx, c.anim, this.frameOf(c), a) && !this.drawn) {
      this.drawn = true;
      if (this.root) this.root.setAttribute('data-live', ''); // CSS then hides the still image
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
};
