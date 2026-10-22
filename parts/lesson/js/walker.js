// =====================================================================
// SWIFTEE WALKER — the measuring trip on screen 13. Swiftee flies (flapping) from her spot onto the shape,
// walks along a side with her tape measure (measuring), waits on the corner, and flies home at the end.
// Drawn on its own small canvas in stage coordinates; frames come from the same manifest sheets as the mascot,
// with feet registered on the sheets' baseline so she stands exactly on the side line.
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
    if (this.m) ['measuring', 'flapping'].forEach((a) => this.sheet(a));
    requestAnimationFrame(this.loop);
  }
  sheet(a) {
    if (this.sheets[a]) return this.sheets[a];
    const info = this.m && this.m.scales['2x'].sheets[a];
    if (!info) return null;
    const img = new Image(), s = { img: img, info: info, ready: false };
    img.onload = () => { s.ready = true; };
    img.src = this.base + info.image;
    return (this.sheets[a] = s);
  }
  el() { const e = document.querySelector('.walker'); if (e !== this.e) { this.e = e; this.ctx = null; } return e; }

  // ---------- moves (each runs to completion, then calls back) ----------
  // fly along an arc from `from` to `to` (feet points, stage px), size tweening between s0 and s1
  fly(from, to, s0, s1, ms, done) {
    this.visible = true; this.anim = 'flapping'; this.playing = true;
    const lift = Math.min(170, 60 + Math.hypot(to.x - from.x, to.y - from.y) * 0.25);
    const c = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
    this.flip = to.x < from.x;
    this.run(ms, (t) => {
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, u = 1 - e;
      this.pos = { x: u * u * from.x + 2 * u * e * c.x + e * e * to.x, y: u * u * from.y + 2 * u * e * c.y + e * e * to.y };
      this.size = s0 + (s1 - s0) * e;
    }, done);
  }
  // walk in a straight line, reporting progress (0..1) every frame
  walk(from, to, ms, progress, done) {
    this.visible = true; this.anim = 'measuring'; this.playing = true;
    this.flip = to.x < from.x - 1;
    this.run(ms, (t) => {
      this.pos = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      if (progress) progress(t);
    }, () => { this.playing = false; this.frame = 0; if (done) done(); });
  }
  // stage point where the tape leaves the tape measure in her hand (per-frame, from CONFIG.walker.tips @2x cell px)
  tip() {
    if (!this.pos) return null;
    const T = CONFIG.walker.tips, t = T[this.frame % T.length], S = this.size, base = (this.m.baselineY && this.m.baselineY.normalized) || 0.877;
    const dx = (t[0] / 512 - 0.5) * S * (this.flip ? -1 : 1), dy = (t[1] / 512 - base) * S;
    return { x: this.pos.x + dx, y: this.pos.y + dy };
  }
  stand(p) { this.visible = true; this.anim = 'measuring'; this.playing = false; this.frame = 0; this.pos = p; this.size = CONFIG.walker.size; }
  hide() { this.visible = false; this.moves = []; this.playing = false; }
  run(ms, step, done) {
    const t0 = performance.now();
    this.moves = [{ t0: t0, ms: Math.max(1, ms), step: step, done: done }];
    step(0);
  }

  // ---------- frame loop ----------
  loop(now) {
    requestAnimationFrame(this.loop);
    const mv = this.moves[0];
    if (mv) {
      const t = Math.min(1, (now - mv.t0) / mv.ms);
      mv.step(t);
      if (t >= 1) { this.moves.shift(); if (mv.done) mv.done(); }
    }
    const a = this.m && this.m.animations[this.anim], fps = (a && a.fps) || 20, sh = this.sheet(this.anim);
    if (this.playing && sh && now - this.last >= 1000 / fps) { this.frame = (this.frame + 1) % sh.info.frames; this.last = now; }
    this.draw();
  }
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
    const ctx = this.ctx || (this.ctx = cv.getContext('2d'));
    const cell = sh.info.cell, cols = sh.info.cols, f = this.frame % sh.info.frames;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 512, 512);
    ctx.setTransform(this.flip ? -1 : 1, 0, 0, 1, this.flip ? 512 : 0, 0);
    ctx.drawImage(sh.img, (f % cols) * cell, Math.floor(f / cols) * cell, cell, cell, 0, 0, 512, 512);
  }
};
