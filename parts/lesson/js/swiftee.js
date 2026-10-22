// =====================================================================
// SWIFTEE — sprite-sheet mascot driven by swiftee-assets/atlas/swiftee.manifest.json.
//   play(state)  switch expression. A state with a start/loop/stop triad plays its start once,
//                loops, and plays its stop before the next expression begins.
//   Frames come from uniform grids (cell, cols from the manifest) with a shared centre pivot,
//   so any frame can follow any other without the bird moving. Drawn on one canvas; the still
//   image underneath stays visible until the first frame is ready (or if the sheets can't load).
// =====================================================================
window.SwifteeMascot = class SwifteeMascot {
  constructor(opts) {
    this.base = opts.base || 'swiftee-assets/';
    this.find = opts.find;                  // () => the .swiftee container in the stage
    this.idle = opts.idle || 'blinking';
    this.minHoldMs = opts.minHoldMs || 900; // an expression stays at least this long, so quick lines don't flicker
    this.fadeMs = 140;                      // cross-fade used when a loop is cut mid-cycle
    this.sheets = {};                       // anim -> { img, ready, info }
    this.target = this.idle;
    this.cur = null;
    this.fade = null;
    this.alive = true;
    this.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.loop = this.loop.bind(this);
    // js/swiftee-manifest.js (generated) works from file://; otherwise read the manifest itself
    if (window.SWIFTEE_MANIFEST) { setTimeout(() => { if (this.alive) this.init(window.SWIFTEE_MANIFEST); }, 0); return; }
    fetch(this.base + 'atlas/swiftee.manifest.json')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((m) => { if (this.alive) this.init(m); })
      .catch(() => {}); // no manifest (e.g. opened from file://): the still image stays
  }

  init(m) {
    this.m = m;
    this.frameMs = 1000 / (m.fps || 20);
    this.preload(this.target);
    this.cur = this.enter(this.target);
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }
  destroy() { this.alive = false; }

  // ---------- public ----------
  play(state) {
    if (!state) return;
    if (this.m && !this.m.states[state] && this.m.standalone.indexOf(state) < 0) return;
    if (state === this.target) return;
    this.target = state;
    if (this.m) this.preload(state);
  }
  // Lip-sync: talk(true) cuts straight to the talking loop (beak moving) the moment the voice starts;
  // talk(false, next) closes the beak (talk_stop) and goes on to `next`. Neither waits for minHoldMs.
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
  // mirror horizontally (the art faces right; on the right of the screen Swiftee should face left)
  setFlip(on) { this.flip = !!on; this.cv = null; }
  // fetch sheets ahead of time so a reaction never waits on the network
  warm(states) { if (!this.m) { this.pending = states; return; } states.forEach((s) => this.preload(s)); }

  // ---------- sheets ----------
  scale() {
    if (this.sc) return this.sc;
    const el = this.canvas();
    const px = el ? el.getBoundingClientRect().width * (window.devicePixelRatio || 1) : 0;
    this.sc = px > 300 ? '2x' : '1x'; // @1x is a 256px cell; only pay for @2x when it is drawn larger
    return this.sc;
  }
  parts(state) {
    const s = this.m.states[state];
    return s ? { start: s.start, loop: s.loop, stop: s.stop } : { loop: state };
  }
  preload(state) {
    const p = this.parts(state);
    [p.start, p.loop, p.stop].forEach((a) => a && this.sheet(a));
    if (this.pending) { const q = this.pending; this.pending = null; this.warm(q); }
  }
  sheet(anim) {
    if (this.sheets[anim]) return this.sheets[anim];
    const info = this.m.scales[this.scale()].sheets[anim];
    if (!info) return null;
    const img = new Image(), sh = { img: img, ready: false, info: info };
    img.decoding = 'async';
    img.onload = () => { sh.ready = true; };
    img.src = this.base + info.image;
    this.sheets[anim] = sh;
    return sh;
  }

  // ---------- sequencing ----------
  enter(state) {
    const p = this.parts(state);
    if (p.start && !this.reduced) return this.clip(state, 'start', p.start);
    return this.clip(state, 'loop', p.loop);
  }
  clip(state, phase, anim) {
    const a = this.m.animations[anim] || {};
    const n = this.m.scales[this.scale()].sheets[anim].frames;
    const fms = a.fps ? 1000 / a.fps : this.frameMs; // an animation may set its own frame rate (e.g. the measuring walk)
    return { state: state, phase: phase, anim: anim, n: n, pp: !!a.pingpong, i: 0, t0: performance.now(), fms: fms };
  }
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

  loop(now) {
    if (!this.alive) return;
    requestAnimationFrame(this.loop);
    const c = this.cur;
    if (!c) return;
    // hold until the needed sheet is decoded; the current frame keeps showing meanwhile
    if (!this.ready(c)) { this.sheet(c.anim); this.last = now; return; }
    if (this.reduced) {
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
  step(now) {
    const c = this.cur;
    const held = now - c.t0 >= this.minHoldMs;
    // a long loop may be cut mid-cycle (cross-faded) once it has been seen long enough
    if (c.phase === 'loop' && this.target !== c.state && held && c.i > 0) {
      const nx = this.advance(now);
      if (nx) { this.swap(nx, now); return; }
    }
    c.i++;
    if (c.i < this.len(c)) return;
    c.i = 0;
    if (c.phase === 'loop' && (this.target === c.state || !held)) return; // wrap
    const nx = this.advance(now);
    if (nx) { this.cur = nx; this.sheet(nx.anim); }
  }
  swap(nx, now) {
    const c = this.cur;
    this.fade = { anim: c.anim, f: this.frameOf(c), t0: null }; // clock starts when the new clip first draws
    this.cur = nx;
    this.sheet(nx.anim);
  }

  // ---------- drawing ----------
  canvas() {
    if (this.cv && this.cv.isConnected) return this.cv;
    const root = this.find && this.find();
    this.root = root || null;
    this.cv = root ? root.querySelector('canvas') : null;
    this.ctx = null;
    return this.cv;
  }
  blit(ctx, anim, f, alpha) {
    const sh = this.sheets[anim];
    if (!sh || !sh.ready) return false;
    const cell = sh.info.cell, cols = sh.info.cols;
    const sx = (f % cols) * cell, sy = Math.floor(f / cols) * cell;
    ctx.globalAlpha = alpha;
    ctx.setTransform(this.flip ? -1 : 1, 0, 0, 1, this.flip ? ctx.canvas.width : 0, 0);
    ctx.drawImage(sh.img, sx, sy, cell, cell, 0, 0, ctx.canvas.width, ctx.canvas.height);
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
      else this.blit(ctx, this.fade.anim, this.fade.f, 1 - t); // old frame fades out under the new one, drawn at full strength: the body never turns see-through
    }
    if (this.blit(ctx, c.anim, this.frameOf(c), a) && !this.drawn) {
      this.drawn = true;
      if (this.root) this.root.setAttribute('data-live', '');
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
};
