// =====================================================================
// CARD LIFE — the sea card lives, as the game's lake does (canvas.card-life, over the card and under the stage):
// sunlight beams drift down through its water, the surface ripples, bubbles rise from the seaweed and the sand, the
// seaweed sways, and light glints on the sand. It moves with the card (Opening.card(): the card's place and size),
// fades in once the card has landed and out as it closes. Off for prefers-reduced-motion (the painting stays still).
// =====================================================================
(function () {
  const W = 1672, TAU = Math.PI * 2;
  const IW = 1618, IH = 828; // the painting's own pixels (assets/images/sea-card.webp): everything below is drawn in them
  const WATER = { x: 24, y: 22, w: 1570, h: 784, r: 46 }; // the water inside the card's frame
  // the seaweed (left and right corners): a band of the painting redrawn in thin slices, each slid sideways by its
  // height above the base, so the fronds sway from their roots (the water round them is one colour, so it never shows)
  const WEED = [
    { x: 26, w: 150, top: 596, base: 724, amp: 4.2, ph: 0 },
    { x: 1420, w: 174, top: 612, base: 744, amp: 4.6, ph: 2.1 },
  ];
  const BEAMS = [
    { x: 330, w: 70, lean: 150, a: 0.075, sp: 0.21, ph: 0 },
    { x: 640, w: 120, lean: 190, a: 0.06, sp: 0.17, ph: 1.7 },
    { x: 990, w: 80, lean: 170, a: 0.07, sp: 0.24, ph: 3.1 },
    { x: 1270, w: 110, lean: 200, a: 0.055, sp: 0.19, ph: 4.4 },
  ];
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduced) return;
  const ART = new Image(); ART.src = 'assets/images/sea-card.webp';
  const rnd = (a, b) => a + Math.random() * (b - a);

  let cv = null, ctx = null, last = 0, t = 0, life = 0, due = 0, slow = 0, skip = false, drawn = false;
  const bubbles = [], glints = [];
  function canvas() {
    if (cv && cv.isConnected) return cv;
    cv = document.querySelector('canvas.card-life'); ctx = cv ? cv.getContext('2d') : null;
    return cv;
  }
  // a bubble from the seaweed or the sand, mostly at the card's sides (the shape and the answers hold its middle)
  function spawn() {
    const side = Math.random();
    const x = side < 0.42 ? rnd(50, 250) : side < 0.84 ? rnd(1370, 1570) : rnd(300, 1320);
    const r = Math.random() < 0.25 ? rnd(6, 9.5) : rnd(2.6, 5.5);
    bubbles.push({ x: x, y: rnd(700, 748), r: r, vy: 34 + r * 6 + rnd(0, 18), sway: rnd(4, 11), ph: rnd(0, TAU), t: 0 });
    if (Math.random() < 0.2) for (let i = 1; i <= 3; i++) bubbles.push({ x: x + rnd(-4, 4), y: 744 + i * 16, r: rnd(2, 3.4), vy: 52 + rnd(0, 10), sway: rnd(3, 6), ph: rnd(0, TAU), t: -i * 0.18 });
  }
  function update(dt) {
    t += dt;
    due -= dt;
    while (due <= 0) { due += rnd(0.28, 0.75); spawn(); }
    bubbles.forEach((b) => { b.t += dt; if (b.t > 0) b.y -= b.vy * dt; });
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].y < 70) bubbles.splice(i, 1);
    if (glints.length < 7 && Math.random() < dt * 2.2) glints.push({ x: rnd(180, 1440), y: rnd(742, 792), s: rnd(5, 9), t: 0, d: rnd(0.9, 1.6) });
    glints.forEach((g) => { g.t += dt; });
    for (let i = glints.length - 1; i >= 0; i--) if (glints[i].t > glints[i].d) glints.splice(i, 1);
  }
  function waterPath(c) {
    const { x, y, w, h, r } = WATER;
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function drawBeams(c, a) {
    c.globalCompositeOperation = 'lighter';
    BEAMS.forEach((B) => {
      const k = 0.55 + 0.45 * Math.sin(t * B.sp * TAU * 0.5 + B.ph), sx = B.x + Math.sin(t * B.sp + B.ph) * 26;
      const g = c.createLinearGradient(0, 0, 0, 640);
      g.addColorStop(0, 'rgba(255, 255, 240, ' + (B.a * k * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255, 255, 240, 0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(sx - B.w * 0.3, 0); c.lineTo(sx + B.w * 0.3, 0); c.lineTo(sx + B.lean + B.w, 640); c.lineTo(sx + B.lean - B.w, 640); c.closePath(); c.fill();
    });
    c.globalCompositeOperation = 'source-over';
  }
  // the surface: three bright ripples running along the painted waves at the top
  function drawSurface(c, a) {
    [[62, 7, 0.9, 0.2], [98, 6, -0.7, 0.15], [134, 5, 0.55, 0.11]].forEach(([y0, amp, sp, al], i) => {
      const g = c.createLinearGradient(WATER.x, 0, WATER.x + WATER.w, 0);
      const s = 'rgba(255, 255, 255, ', m = (al * a).toFixed(3);
      g.addColorStop(0, s + '0)'); g.addColorStop(0.12, s + m + ')'); g.addColorStop(0.88, s + m + ')'); g.addColorStop(1, s + '0)');
      c.strokeStyle = g; c.lineWidth = 3.2 - i * 0.6; c.lineCap = 'round';
      c.beginPath();
      for (let x = WATER.x; x <= WATER.x + WATER.w; x += 14) {
        const y = y0 + Math.sin(x / 150 + t * sp * 1.6 + i) * amp + Math.sin(x / 61 - t * sp) * amp * 0.35;
        if (x === WATER.x) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    });
  }
  function drawWeed(c) {
    if (!(ART.complete && ART.naturalWidth)) return;
    WEED.forEach((S) => {
      const hgt = S.base - S.top;
      for (let y = S.top; y < S.base; y += 3) {
        const u = (S.base - y) / hgt; // 0 at the roots, 1 at the band's top (above the tips: open water)
        const prof = Math.pow(u, 1.25) * (1 - Math.max(0, (u - 0.86) / 0.14));
        const dx = S.amp * prof * Math.sin(t * 1.55 + S.ph - u * 1.9) + S.amp * 0.35 * prof * Math.sin(t * 0.7 + S.ph * 1.3);
        if (Math.abs(dx) < 0.05) continue;
        c.drawImage(ART, S.x, y, S.w, 3, S.x + dx, y, S.w, 3);
      }
    });
  }
  // bubbles as the fishing game draws its own (a soft body, a thin rim, a bright highlight), fading near the surface
  function drawBubbles(c, a) {
    bubbles.forEach((b) => {
      if (b.t < 0) return;
      const f = a * Math.min(1, b.t / 0.4) * Math.max(0, Math.min(1, (b.y - 70) / 120)), x = b.x + Math.sin(b.t * 2.1 + b.ph) * b.sway;
      if (f <= 0) return;
      c.beginPath(); c.arc(x, b.y, b.r, 0, TAU);
      c.fillStyle = 'rgba(225, 248, 255, ' + (0.22 * f).toFixed(3) + ')'; c.fill();
      c.lineWidth = 1.3; c.strokeStyle = 'rgba(255, 255, 255, ' + (0.6 * f).toFixed(3) + ')'; c.stroke();
      c.beginPath(); c.arc(x - b.r * 0.36, b.y - b.r * 0.36, b.r * 0.3, 0, TAU);
      c.fillStyle = 'rgba(255, 255, 255, ' + (0.85 * f).toFixed(3) + ')'; c.fill();
    });
  }
  // sunlight glinting on the sand: small four-point twinkles that swell and fade
  function drawGlints(c, a) {
    c.globalCompositeOperation = 'lighter';
    glints.forEach((g) => {
      const k = Math.sin((g.t / g.d) * Math.PI), s = g.s * (0.6 + 0.4 * k), al = (0.5 * k * a).toFixed(3);
      c.fillStyle = 'rgba(255, 250, 225, ' + al + ')';
      c.beginPath(); c.moveTo(g.x, g.y - s); c.quadraticCurveTo(g.x, g.y, g.x + s, g.y); c.quadraticCurveTo(g.x, g.y, g.x, g.y + s);
      c.quadraticCurveTo(g.x, g.y, g.x - s, g.y); c.quadraticCurveTo(g.x, g.y, g.x, g.y - s); c.fill();
    });
    c.globalCompositeOperation = 'source-over';
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (document.hidden || !canvas() || !window.Opening || !Opening.card) return;
    const v = Opening.card();
    // in once the card has landed, out (quickly) as it closes
    life = v && v.open ? Math.min(1, life + dt / 0.9) : Math.max(0, life - dt / 0.25);
    if (life <= 0 || !v || v.k <= 0) { if (drawn) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); drawn = false; } return; }
    update(dt);
    // a slow device draws every other frame (as js/opening.js and js/water.js do)
    slow = slow * 0.95 + dt * 0.05;
    skip = slow > 0.024 ? !skip : false;
    if (skip) return;
    const SC = cv.width / W, k = (v.k * v.w) / IW;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(SC * k, 0, 0, SC * k, SC * (v.x - (IW / 2) * k), SC * (v.y - (IH / 2) * k));
    ctx.save(); waterPath(ctx); ctx.clip();
    const a = life * life * (3 - 2 * life);
    ctx.globalAlpha = a;
    drawWeed(ctx);
    ctx.globalAlpha = 1;
    drawBeams(ctx, a);
    drawSurface(ctx, a);
    drawGlints(ctx, a);
    drawBubbles(ctx, a);
    ctx.restore();
    drawn = true;
  }
  requestAnimationFrame(frame);
})();
