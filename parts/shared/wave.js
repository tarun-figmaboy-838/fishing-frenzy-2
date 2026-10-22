// The giant wave that carries Popo between the two fishing lakes (the journey: fishing 1's waveAway, fishing 2's
// waveIn). It is the lake itself: the water pass (src/water.js, uHump / uLean) lifts the painted surface into a
// travelling hump with a long gentle back, a short steep front and a crest that leans forward over the face, filled
// with the lake's own water, lit and foaming in the shader. This controls it: where the crest is, how high it stands
// (swelling up as it comes in, sinking back as it leaves), and where Popo rides on it; the game hands hump() to the
// water pass each frame while game.wave is set, and drawFront() adds the spray, fizz and the splash at the foot over
// Popo. The sequence drives the time with set(t) from its tween.
(function () {
  const { STAGE_W: W } = PopoGame;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sm = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

  class Wave {
    constructor(game, { ms = 3600, height = 430, back = 560, front = 190, lean = 120 } = {}) {
      this.game = game;
      this.ms = ms;
      this.height = height;
      this.back = back;
      this.front = front;
      this.leanMax = lean;
      this.yw = game.waterline || 610;
      this.t = 0;
      this.x0 = -back - 300; // the crest: from off the left...
      this.x1 = W + front + 700; // ...to off the right
      this.spray = Array.from({ length: 90 }, () => ({ ph: Math.random(), vx: rnd(0.4, 1.6), vy: rnd(0.3, 1.5), r: rnd(1.5, 5) }));
      this.fizz = Array.from({ length: 30 }, () => ({ u: Math.random(), d: rnd(-260, 60), r: rnd(2.5, 7), ph: rnd(0, 6.3) }));
    }
    set(t) { this.t = Math.max(0, Math.min(1, t)); }
    get k() { return (this.t * this.ms) / 1000; } // seconds in
    get e() { return sm(this.t); }
    // how high it stands: swelling up over the first fifth of its run, sinking back over the last
    get rise() { return sm(this.t / 0.22) * sm((1 - this.t) / 0.22); }
    get h() { return this.height * this.rise; }
    get crestX() { return this.x0 + this.e * (this.x1 - this.x0); }
    get lean() { return this.leanMax * this.rise; }
    get gone() { return this.crestX - this.back * 2.2 >= W; } // off the right, tail and all
    // the hump for the water pass
    hump() { return { x: this.crestX, h: this.h, back: this.back, front: this.front, lean: this.lean }; }
    // how far the surface is lifted at stage x (as the shader's hump())
    lift(x) {
      const h = this.h;
      if (h <= 0) return 0;
      const dx = x - this.crestX, w = dx < 0 ? this.back : this.front;
      return h * Math.exp(-(dx * dx) / (w * w));
    }
    surfaceAt(x) { return this.yw - this.lift(x); }
    crestTop() { return this.yw - this.h; }
    backTop(x) { return this.surfaceAt(x); }
    faceX() { return this.crestX + this.front * 1.6; } // where the face runs into the water
    // where a rider sits: on the crest, a little behind its top
    seat() { const x = this.crestX - 40; return { x, y: this.surfaceAt(x) + 28 }; }
    // the water pass paints the wave; nothing to draw under Popo
    draw() {}
    // over Popo: spray flung ahead of the crest, fizz in the water under the face, and the splash at the foot
    drawFront(ctx) {
      const k = this.k, r = this.rise, yw = this.yw, fx = this.faceX();
      if (r <= 0.02) return;
      const tipX = this.crestX + this.lean * 0.7, tipY = this.crestTop() + 10;
      ctx.save();
      for (const s of this.spray) {
        const age = (k * 0.9 + s.ph) % 1, x = tipX + s.vx * age * 360 * r, y = tipY - s.vy * age * 240 * r + 640 * age * age;
        if (y > this.surfaceAt(x) + 10) continue;
        ctx.beginPath(); ctx.arc(x, y, s.r * (1 - age * 0.5), 0, TAU); ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - age) * r) + ')'; ctx.fill();
      }
      for (let i = 0; i < 12; i += 1) {
        const a = k * 6 + i * 0.7, rad = (9 + (i % 3) * 8 + Math.sin(a) * 4) * r;
        ctx.beginPath(); ctx.arc(fx + 10 + i * 16 + Math.sin(a) * 7, yw - 10 + Math.cos(a * 0.8) * 11, rad, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * r) + ')'; ctx.fill();
      }
      for (const f of this.fizz) {
        const y = yw + 20 + f.u * 260, x = fx + f.d + Math.sin(k * 4 + f.ph) * 7;
        ctx.beginPath(); ctx.arc(x, y - ((k * 70 + f.ph * 40) % 90), f.r, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,' + (0.25 * r) + ')'; ctx.fill();
      }
      ctx.restore();
    }
    // the roar: a swell of filtered noise rising to the middle, with a low rumble under it, through the game's mixer
    sound(audio) {
      const c = audio && audio.ctx;
      if (!c || audio.muted) return;
      try {
        const start = c.currentTime, dur = this.ms / 1000 + 0.3, out = audio.master || c.destination;
        const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        src.buffer = buf; src.loop = true;
        f.type = 'lowpass'; f.Q.value = 0.8;
        f.frequency.setValueAtTime(260, start);
        f.frequency.exponentialRampToValueAtTime(2800, start + dur * 0.5);
        f.frequency.exponentialRampToValueAtTime(320, start + dur);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(0.5, start + dur * 0.42);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        src.connect(f); f.connect(g); g.connect(out);
        src.start(start); src.stop(start + dur + 0.05);
        const o = c.createOscillator(), og = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(88, start); o.frequency.exponentialRampToValueAtTime(42, start + dur);
        og.gain.setValueAtTime(0.0001, start); og.gain.linearRampToValueAtTime(0.16, start + dur * 0.4); og.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(og); og.connect(out); o.start(start); o.stop(start + dur + 0.05);
      } catch (e) { /* no sound */ }
    }
  }
  PopoGame.Wave = Wave;
})();
