// =====================================================================
// SWIFTEE WALKER — screen 14: Swiftee measures each side with her tape measure.
// The engine drives it: stroll() from her spot to the shape, walk() along each side while the tape follows tip(),
// and stroll() home at the end. Drawn into the canvas of the small .walker element, which is placed in stage px.
// Frames come from the 'measuring' sheet in the Swiftee manifest, with her feet on its baseline so she stands on the line.
// =====================================================================
window.SwifteeWalker = class SwifteeWalker {
  constructor(base) {
    this.base = base || 'swiftee-assets/';
    this.m = window.SWIFTEE_MANIFEST;
    this.sheets = {};
    this.anim = 'measuring'; this.frame = 0; this.playing = false;
    this.pos = null; this.size = CONFIG.walker.size; this.flip = false; this.visible = false;
    this.moves = [];
    this.loop = this.loop.bind(this);
    this.last = performance.now();
    this.looping = false; // the frame loop runs only while she is out (run() starts it, hide() lets it stop)
    if (this.m) this.sheet('measuring');
  }
  // load a sheet once (always the @2x one)
  sheet(a) {
    if (this.sheets[a]) return this.sheets[a];
    const info = this.m && this.m.scales['2x'].sheets[a];
    if (!info) return null;
    const img = new Image(), s = { img: img, info: info, ready: false };
    img.onload = () => { s.ready = true; };
    img.src = this.base + info.image;
    return (this.sheets[a] = s);
  }
  // the .walker element; a new element (after a re-render) needs a new context
  el() { const e = document.querySelector('.walker'); if (e !== this.e) { this.e = e; this.ctx = null; } return e; }

  // ---------- moves: one at a time, done() is called when it ends ----------
  // stroll between her spot and the shape (eased), her size going from s0 to s1
  stroll(from, to, s0, s1, done) {
    this.visible = true; this.anim = 'measuring'; this.playing = true;
    this.flip = to.x < from.x - 1;
    const ms = Math.max(500, Math.hypot(to.x - from.x, to.y - from.y) / CONFIG.walker.strollPxPerMs);
    this.run(ms, (t) => {
      const e = t * t * (3 - 2 * t);
      this.pos = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      this.size = s0 + (s1 - s0) * e;
    }, () => { this.playing = false; this.frame = 0; if (done) done(); });
  }
  // walk a side at a steady pace, reporting progress (0..1) every frame
  walk(from, to, ms, progress, done) {
    this.visible = true; this.anim = 'measuring'; this.playing = true;
    this.flip = to.x < from.x - 1;
    this.run(ms, (t) => {
      this.pos = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      if (progress) progress(t);
    }, () => { this.playing = false; this.frame = 0; if (done) done(); });
  }
  // where the tape leaves the tape measure in her hand, in stage px (per frame, from CONFIG.walker.tips in @2x cell px)
  tip() {
    if (!this.pos) return null;
    const T = CONFIG.walker.tips, t = T[this.frame % T.length], S = this.size, base = (this.m.baselineY && this.m.baselineY.normalized) || 0.877;
    const dx = (t[0] / 512 - 0.5) * S * (this.flip ? -1 : 1), dy = (t[1] / 512 - base) * S;
    return { x: this.pos.x + dx, y: this.pos.y + dy };
  }
  hide() { this.visible = false; this.moves = []; this.playing = false; }
  // start a move: the frame loop calls step(t) with t from 0 to 1, then done()
  run(ms, step, done) {
    const t0 = performance.now();
    this.moves = [{ t0: t0, ms: Math.max(1, ms), step: step, done: done }];
    step(0);
    if (!this.looping) { this.looping = true; this.last = t0; requestAnimationFrame(this.loop); }
  }

  // ---------- frame loop ----------
  loop(now) {
    const mv = this.moves[0];
    if (mv) {
      const t = Math.min(1, (now - mv.t0) / mv.ms);
      mv.step(t);
      if (t >= 1) { this.moves.shift(); if (mv.done) mv.done(); }
    }
    const a = this.m && this.m.animations[this.anim], fps = (a && a.fps) || 20, sh = this.sheet(this.anim);
    if (this.playing && sh && now - this.last >= 1000 / fps) { this.frame = (this.frame + 1) % sh.info.frames; this.last = now; }
    this.draw();
    if (this.visible || this.moves.length) requestAnimationFrame(this.loop); else this.looping = false;
  }
  // place the element so her feet are on pos (feet at 0.877 of the cell unless the manifest says otherwise), then draw
  // the frame into its 512 px canvas, mirrored when she walks left
  draw() {
    const e = this.el();
    if (!e) return;
    if (!this.visible || !this.pos) { if (e.style.visibility !== 'hidden') e.style.visibility = 'hidden'; return; }
    const sh = this.sheet(this.anim);
    if (!sh || !sh.ready) return;
    const S = this.size, base = (this.m.baselineY && this.m.baselineY.normalized) || 0.877;
    e.style.visibility = 'visible';
    e.style.width = S + 'px'; e.style.height = S + 'px';
    e.style.left = (this.pos.x - S / 2) + 'px'; e.style.top = (this.pos.y - S * base) + 'px';
    const cv = e.querySelector('canvas');
    if (cv.width !== 512) { cv.width = 512; cv.height = 512; this.ctx = null; }
    if (!this.ctx) { this.ctx = cv.getContext('2d'); this.drawn = null; }
    const ctx = this.ctx, cell = sh.info.cell, cols = sh.info.cols, f = this.frame % sh.info.frames;
    // the picture changes only with the frame (about 10 a second) or her direction; moving her is the element's left / top
    const key = this.anim + ':' + f + ':' + this.flip;
    if (key === this.drawn) return;
    this.drawn = key;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 512, 512);
    ctx.setTransform(this.flip ? -1 : 1, 0, 0, 1, this.flip ? 512 : 0, 0);
    if (window.Costume) Costume.frame(ctx, sh.img, (f % cols) * cell, Math.floor(f / cols) * cell, cell, this.anim, f, 0, 0, 512, 512); // her diving mask
    else ctx.drawImage(sh.img, (f % cols) * cell, Math.floor(f / cols) * cell, cell, cell, 0, 0, 512, 512);
  }
};
