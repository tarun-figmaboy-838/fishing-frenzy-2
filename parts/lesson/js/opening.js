// =====================================================================
// OPENING — how the session begins, as the Fishing Frenzy journey begins its lesson (reference: parts/fishing-2
// src/pearl.js, src/game.js, src/sequences.js lessonCard): on the sand of the lake a seashell fades in, rattles twice
// and swings open on its glowing pearl; the lake dims; the pearl blows a bubble that swells, lets go and rises,
// growing, while the camera dives under the surface after it; mid-screen it pops and out springs the lesson's card -
// the sea card (assets/images/sea-card.webp) - with the gentlest overshoot. The shell and the pearl's
// light then fade, and the lesson plays on the card.
//
// Two canvases at page level, drawn in the journey's world units (1672 x 941; the page is 1920 x 1080):
//   canvas.op-scene    in the lake, zoomed with the camera's dive: the dim, shadow fish, rising bubbles, the shell,
//                      the pearl's light and gold motes
//   canvas.op-curtain  over the lake, in screen space: the pearl's beam, the bubble and the card
// The lesson's 1280 x 720 stage sits centred on the card at 1:1 (index.html: page 225, 126, scale 1.1483).
//   Opening.play(sound, done)  the whole opening;  Opening.instant()  straight to the open card
// The camera's dive moves the water background too (window.Water.dive, js/water.js).
// =====================================================================
(function () {
  const W = 1672, H = 941, SCALE = 1920 / W, TAU = Math.PI * 2;
  const overGame = !!(window.Journey && Journey.embedded); // the journey: over the fishing game's own lake (js/water.js)
  // the card: the coral cove painting at the reference card's width, its own proportions (1672 x 941)
  const CARD = { x: 836, y: 470, w: 1494, h: 1494 * 828 / 1618 }; // the card keeps the sea card's own proportions
  const PEARL = { x: 836, y: 929, size: 1.12 };
  const BUBBLE = { radius: 290, seed: 62, blow: 0.3, pop: 0.78 };
  const DIVE_ZOOM = 1.85, DIM = 0.55, DIM_OPEN = 0.25, SEABED_Y = 805, PAN = 170; // PAN: the game's framing (water.js) // DIM_OPEN: the lake round the open card, lighter so its water shows moving
  const ART = new Image(); ART.src = 'assets/images/sea-card.webp'; // the sea card (assets/Sea Card.png, 1618 x 828, transparent corners)
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ease = {
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };

  // ---------- the seashell (reference pearl.js) ----------
  const SHELL = { rim: [0, -30], rx: 74, ry: 15, fan: 82, ribs: 11, spread: 0.36, pearl: [0, -39], pearlR: 23 };
  const EDGE = '#a4513f';
  function fanPath(ctx, R) {
    const a0 = Math.PI + SHELL.spread, step = (Math.PI - 2 * SHELL.spread) / SHELL.ribs;
    ctx.beginPath(); ctx.moveTo(-15, 4); ctx.lineTo(-19, -5);
    ctx.lineTo(Math.cos(a0) * R * 0.98, Math.sin(a0) * R * 0.98);
    for (let i = 0; i < SHELL.ribs; i += 1) {
      const a = a0 + step * (i + 0.5), b = a0 + step * (i + 1);
      ctx.quadraticCurveTo(Math.cos(a) * R * 1.07, Math.sin(a) * R * 1.07, Math.cos(b) * R * 0.98, Math.sin(b) * R * 0.98);
    }
    ctx.lineTo(19, -5); ctx.lineTo(15, 4); ctx.closePath();
  }
  function fanRibs(ctx, R, outside) {
    const a0 = Math.PI + SHELL.spread, step = (Math.PI - 2 * SHELL.spread) / SHELL.ribs;
    for (let i = 0; i < SHELL.ribs; i += 1) {
      const a = a0 + step * (i + 0.5);
      ctx.beginPath(); ctx.moveTo(0, -2);
      ctx.lineTo(Math.cos(a - step * 0.5) * R, Math.sin(a - step * 0.5) * R);
      ctx.lineTo(Math.cos(a - step * 0.08) * R * 1.02, Math.sin(a - step * 0.08) * R * 1.02);
      ctx.closePath();
      ctx.fillStyle = outside ? 'rgba(200, 96, 74, 0.22)' : 'rgba(230, 160, 170, 0.14)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -4);
      ctx.lineTo(Math.cos(a + step * 0.12) * R * 0.97, Math.sin(a + step * 0.12) * R * 0.97);
      ctx.lineWidth = outside ? 2.2 : 1.6;
      ctx.strokeStyle = outside ? 'rgba(255, 246, 236, 0.75)' : 'rgba(255, 255, 255, 0.6)'; ctx.stroke();
    }
  }
  function drawLid(ctx, sy) {
    const R = SHELL.fan, outside = sy < 0;
    ctx.save();
    ctx.translate(SHELL.rim[0], SHELL.rim[1] - SHELL.ry);
    ctx.scale(1, Math.abs(sy) < 0.02 ? 0.02 * Math.sign(sy || 1) : sy);
    fanPath(ctx, R);
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, R * 1.05);
    if (outside) { g.addColorStop(0, '#fff3e3'); g.addColorStop(0.55, '#ffc7a6'); g.addColorStop(1, '#f4977f'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#fff1ec'); g.addColorStop(1, '#f6c9cf'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    fanRibs(ctx, R, outside);
    if (outside) {
      for (const k of [0.45, 0.68, 0.86]) {
        ctx.beginPath(); ctx.arc(0, 0, R * k, Math.PI + SHELL.spread, TAU - SHELL.spread);
        ctx.lineWidth = 1.4 / Math.max(0.2, Math.abs(sy)); ctx.strokeStyle = 'rgba(190, 90, 70, 0.22)'; ctx.stroke();
      }
    } else {
      const sheen = ctx.createLinearGradient(-R, -R, R, 0);
      sheen.addColorStop(0, 'rgba(180, 220, 255, 0)'); sheen.addColorStop(0.45, 'rgba(190, 225, 255, 0.28)');
      sheen.addColorStop(0.6, 'rgba(255, 220, 240, 0.28)'); sheen.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = sheen; ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 1.4);
    }
    ctx.restore();
    fanPath(ctx, R);
    ctx.restore();
    ctx.lineWidth = 2.6; ctx.strokeStyle = EDGE; ctx.stroke();
  }
  function bowlPath(ctx) {
    const cx = SHELL.rim[0], cy = SHELL.rim[1], rx = SHELL.rx, ry = SHELL.ry, n = SHELL.ribs + 1;
    ctx.beginPath(); ctx.moveTo(cx - rx, cy);
    for (let i = 0; i < n; i += 1) {
      const t1 = Math.PI - ((i + 0.5) / n) * Math.PI, t2 = Math.PI - ((i + 1) / n) * Math.PI;
      ctx.quadraticCurveTo(cx + Math.cos(t1) * rx * 0.97, cy + Math.sin(t1) * ry * 0.55, cx + Math.cos(t2) * rx, cy + Math.sin(t2) * ry);
    }
    ctx.bezierCurveTo(cx + rx + 2, cy + 18, cx + 40, 4, cx, 4);
    ctx.bezierCurveTo(cx - 40, 4, cx - rx - 2, cy + 18, cx - rx, cy);
    ctx.closePath();
  }
  function drawBowl(ctx, inside) {
    const cx = SHELL.rim[0], cy = SHELL.rim[1], rx = SHELL.rx, ry = SHELL.ry;
    if (inside) {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
      g.addColorStop(0, '#e9a3a3'); g.addColorStop(0.6, '#ffd6d0'); g.addColorStop(1, '#fff1ea');
      ctx.fillStyle = g; ctx.fill();
    }
    bowlPath(ctx);
    const g = ctx.createLinearGradient(0, cy, 0, 4);
    g.addColorStop(0, '#ffd5bb'); g.addColorStop(1, '#ee9480');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    const n = SHELL.ribs + 1;
    for (let i = 1; i < n; i += 1) {
      const x = cx - rx + (i / n) * rx * 2;
      ctx.beginPath(); ctx.moveTo(x, cy + 8); ctx.quadraticCurveTo(x * 0.7, cy + 24, x * 0.35, 8);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255, 240, 228, 0.6)'; ctx.stroke();
    }
    ctx.restore();
    bowlPath(ctx); ctx.lineWidth = 2.6; ctx.strokeStyle = EDGE; ctx.stroke();
  }
  function drawPearl(ctx, size) {
    const px = SHELL.pearl[0], py = SHELL.pearl[1], r = SHELL.pearlR * size;
    const g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#fff7f0'); g.addColorStop(0.85, '#f1dbe4'); g.addColorStop(1, '#d9c0d3');
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(150, 110, 135, 0.8)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(px - r * 0.36, py - r * 0.4, r * 0.26, r * 0.15, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx.fill();
  }
  function drawShell(ctx, x, y, size, s) {
    const sy = -0.4 + 1.33 * s.open;
    ctx.save();
    ctx.translate(x, y); ctx.scale(size, size);
    ctx.globalAlpha *= s.alpha;
    ctx.save(); ctx.scale(1, 0.16);
    const shadow = ctx.createRadialGradient(0, 0, 6, 0, 0, 92);
    shadow.addColorStop(0, 'rgba(18, 42, 80, 0.32)'); shadow.addColorStop(1, 'rgba(18, 42, 80, 0)');
    ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0, 0, 92, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.rotate(s.rock);
    ctx.scale(1 + 0.05 * s.squash, 1 - 0.08 * s.squash);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (sy > 0) { drawLid(ctx, sy); drawBowl(ctx, true); drawPearl(ctx, s.pearl); drawBowl(ctx, false); }
    else {
      drawBowl(ctx, true); drawBowl(ctx, false); drawLid(ctx, sy);
      if (s.leak > 0) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= s.leak;
        ctx.beginPath(); ctx.ellipse(SHELL.rim[0], SHELL.rim[1] + 1, SHELL.rx - 8, SHELL.ry, 0, 0.15, Math.PI - 0.15);
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255, 228, 150, 0.9)'; ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawPearlLight(ctx, x, y, size, k, t) {
    if (k <= 0) return;
    const px = x + SHELL.pearl[0] * size, py = y + SHELL.pearl[1] * size;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.save(); ctx.translate(x, y + 2); ctx.scale(1, 0.18);
    const sand = ctx.createRadialGradient(0, 0, 10, 0, 0, 190);
    sand.addColorStop(0, 'rgba(255, 220, 170, ' + 0.3 * k + ')'); sand.addColorStop(1, 'rgba(255, 228, 180, 0)');
    ctx.fillStyle = sand; ctx.fillRect(-190, -190, 380, 380);
    ctx.restore();
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i - 2) * 0.42 + (reduced ? 0 : Math.sin(t * 0.6 + i * 1.7) * 0.06);
      const len = (150 + 40 * Math.sin(t * 0.9 + i)) * k;
      const ray = ctx.createLinearGradient(px, py, px + Math.cos(a) * len, py + Math.sin(a) * len);
      ray.addColorStop(0, 'rgba(255, 232, 180, ' + 0.16 * k + ')'); ray.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a - 0.07) * len, py + Math.sin(a - 0.07) * len);
      ctx.lineTo(px + Math.cos(a + 0.07) * len, py + Math.sin(a + 0.07) * len);
      ctx.closePath(); ctx.fillStyle = ray; ctx.fill();
    }
    const halo = ctx.createRadialGradient(px, py, size * 20, px, py, 46 + 74 * k);
    halo.addColorStop(0, 'rgba(255, 236, 190, ' + 0.3 * k + ')'); halo.addColorStop(0.4, 'rgba(255, 214, 150, ' + 0.18 * k + ')');
    halo.addColorStop(1, 'rgba(255, 222, 160, 0)');
    ctx.fillStyle = halo; ctx.fillRect(px - 130, py - 130, 260, 260);
    ctx.restore();
  }
  // ---------- the bubble (reference game.js drawBubble) ----------
  function drawBubble(ctx, x, y, r, t, still, k) {
    if (r <= 0 || (k != null && k <= 0)) return;
    ctx.save();
    ctx.globalAlpha *= k == null ? 1 : k;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    body.addColorStop(0, 'rgba(255, 255, 255, 0.04)'); body.addColorStop(0.8, 'rgba(200, 235, 255, 0.03)');
    body.addColorStop(1, 'rgba(210, 240, 255, 0.22)');
    ctx.fillStyle = body; ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const turn = still ? 0 : t * 0.8;
    const rim = ctx.createLinearGradient(x + Math.cos(turn) * r, y + Math.sin(turn) * r, x - Math.cos(turn) * r, y - Math.sin(turn) * r);
    rim.addColorStop(0, 'rgba(140, 230, 255, 0.75)'); rim.addColorStop(0.35, 'rgba(255, 190, 240, 0.7)');
    rim.addColorStop(0.65, 'rgba(255, 236, 150, 0.7)'); rim.addColorStop(1, 'rgba(150, 255, 215, 0.75)');
    ctx.lineWidth = Math.max(1.5, r * 0.035); ctx.strokeStyle = rim; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, Math.PI * 1.08, Math.PI * 1.42);
    ctx.lineWidth = Math.max(1.5, r * 0.06); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + r * 0.42, y + r * 0.44, Math.max(1, r * 0.06), 0, TAU);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fill();
    ctx.restore();
  }

  // ---------- state ----------
  const S = {
    on: false, t: 0, pan: 1, dive: 0, dim: 0, glow: 0, beam: 0, flash: 0, emerge: 0, close: 0, open: false, spawning: false,
    shell: { alpha: 0, open: 0, rock: 0, squash: 0, leak: 0, pearl: 1 }, motes: [], pops: [], fish: [], bubbles: [], bubbleDue: 0
  };
  // the lake's fish, as the fishing game's (parts/fishing/src/fish.js: refreshShadows, refreshDeep): four soft shadow
  // fish with wagging tails, and six small real fish in the haze of the deep water. (Drawn only on the lesson's own
  // page: in the journey the lesson plays over the game's lake, and its own fish swim there.)
  for (let i = 0; i < 4; i++) {
    const depth = Math.random();
    S.fish.push({ x: Math.random() * W, y: 460 + Math.random() * 260, v: (22 + Math.random() * 30) * (1.2 - depth * 0.5) * (Math.random() < 0.5 ? -1 : 1),
      k: 0.5 + (1 - depth) * 0.6, depth: depth, wag: Math.random() * 8, ph: Math.random() * TAU });
  }
  S.real = [];
  for (let i = 0; i < 6; i++) S.real.push({ key: null, x: Math.random() * W, y: 600 + Math.random() * 180, v: (22 + Math.random() * 22) * (Math.random() < 0.5 ? -1 : 1),
    k: 0.46 + Math.random() * 0.14, haze: 0.42 + Math.random() * 0.14, ph: Math.random() * TAU });
  const zoom = () => (reduced ? (S.dive > 0 ? DIVE_ZOOM : 1) : 1 + (DIVE_ZOOM - 1) * S.dive);
  const screenOf = (x, y) => { const z = zoom(); return [W / 2 + (x - W / 2) * z, H + (y - H) * z]; };
  const pearlScreen = () => screenOf(PEARL.x + SHELL.pearl[0] * PEARL.size, PEARL.y + SHELL.pearl[1] * PEARL.size);

  // the bubble and the card by emerge 0..1 (reference recallBubble)
  // the game's shadow fish (parts/fishing/src/fish.js shadowPath / shadowSprites): eight tail positions, drawn once,
  // each a blurred silhouette (drawn far off the canvas, only its shadow lands in the cell: soft edges everywhere)
  const SHADOW = { w: 128, h: 64, frames: 8 };
  let shadowSheet = null;
  function shadowPath(ctx, wag) {
    const c = Math.cos(wag), s = Math.sin(wag);
    const tail = (x, y) => [-34 + (x + 34) * c - y * s, (x + 34) * s + y * c];
    ctx.beginPath();
    ctx.moveTo(46, 0);
    ctx.bezierCurveTo(40, -17, 8, -23, -18, -14);
    ctx.bezierCurveTo(-28, -10, -34, -5, -36, 0);
    ctx.bezierCurveTo(-34, 5, -28, 10, -18, 14);
    ctx.bezierCurveTo(8, 23, 40, 17, 46, 0);
    ctx.closePath();
    const pts = [[-34, 0], [-58, -19], [-51, 0], [-58, 19]].map(([x, y]) => tail(x, y));
    ctx.moveTo(...pts[0]);
    for (const q of pts.slice(1)) ctx.lineTo(...q);
    ctx.closePath();
    ctx.moveTo(-4, -19);
    ctx.quadraticCurveTo(6, -33, 18, -18);
    ctx.closePath();
  }
  function shadowSprites() {
    if (shadowSheet) return shadowSheet;
    const c = document.createElement('canvas');
    c.width = SHADOW.w * SHADOW.frames;
    c.height = SHADOW.h;
    const ctx = c.getContext('2d');
    for (let i = 0; i < SHADOW.frames; i += 1) {
      ctx.save();
      ctx.translate(i * SHADOW.w + SHADOW.w / 2 + 4 - 4000, SHADOW.h / 2);
      ctx.shadowColor = 'rgb(6, 40, 96)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 4000;
      ctx.fillStyle = '#000';
      shadowPath(ctx, Math.sin((i / SHADOW.frames) * TAU) * 0.3);
      ctx.fill();
      ctx.restore();
    }
    shadowSheet = c;
    return c;
  }
  // the game's real fish (its fish sheet and atlas, parts/fishing), loaded only on the lesson's own page
  const REAL = { img: null, boxes: null, scale: 1 };
  if (!overGame) {
    const data = document.createElement('script');
    data.src = '../fishing/src/sprite-data.js';
    data.onload = () => {
      const A = window.PopoGame && PopoGame.FISH_NATURAL_ATLAS;
      if (!A) return;
      const img = new Image();
      img.onload = () => { REAL.boxes = A.boxes; REAL.scale = A.scale || 1; REAL.img = img; const keys = Object.keys(A.boxes); S.real.forEach((f, i) => { f.key = keys[(i * 5) % keys.length]; }); };
      img.src = '../fishing/assets/sprites/fish-natural.webp';
    };
    document.head.appendChild(data);
  }
  function drawFish(ctx) {
    const sheet = shadowSprites();
    S.fish.forEach((f) => {
      const frame = Math.floor(f.wag) % SHADOW.frames;
      ctx.save();
      ctx.globalAlpha = 0.2 + (1 - f.depth) * 0.22;
      ctx.translate(f.x, f.y + Math.sin(S.t * 0.9 + f.ph) * 6);
      ctx.scale(Math.sign(f.v) * f.k, f.k);
      ctx.drawImage(sheet, frame * SHADOW.w, 0, SHADOW.w, SHADOW.h, -SHADOW.w / 2, -SHADOW.h / 2, SHADOW.w, SHADOW.h);
      ctx.restore();
    });
    if (!REAL.img) return;
    S.real.forEach((f) => {
      const b = f.key && REAL.boxes[f.key];
      if (!b) return;
      const w = (b[2] - b[0]) * REAL.scale * f.k, h = (b[3] - b[1]) * REAL.scale * f.k;
      ctx.save();
      ctx.globalAlpha = f.haze;
      ctx.translate(f.x, f.y + Math.sin(S.t * 1.1 + f.ph) * 3);
      ctx.scale(Math.sign(f.v), 1);
      ctx.drawImage(REAL.img, b[0], b[1], b[2] - b[0], b[3] - b[1], -w / 2, -h / 2, w, h);
      ctx.restore();
    });
  }

  // the lesson over (Opening.close): the card shrinks into a bubble, which floats up and pops
  function closingAt() {
    const small = (BUBBLE.radius * 1.55) / CARD.w, k = S.close;
    const shrink = Math.min(1, k / 0.55), rise = Math.max(0, (k - 0.55) / 0.45);
    return {
      x: CARD.x + (reduced ? 0 : Math.sin(rise * Math.PI * 2) * 16 * rise), y: CARD.y - 560 * rise * rise,
      radius: BUBBLE.radius * Math.min(1, shrink * 1.6), card: 1 - (1 - small) * ease.inOut(shrink)
    };
  }
  function bubbleAt(sx, sy) {
    if (S.close > 0) return closingAt();
    const small = (BUBBLE.radius * 1.55) / CARD.w;
    if (S.emerge <= 0) return { x: sx, y: sy, radius: 0, card: 0 };
    const blow = Math.min(1, S.emerge / BUBBLE.blow);
    if (blow < 1) {
      const radius = 6 + (BUBBLE.seed - 6) * (reduced ? blow : ease.out(blow));
      const wobble = reduced ? 0 : Math.sin(blow * Math.PI * 4) * 0.06 * (1 - blow);
      return { x: sx, y: sy - radius * (1 - wobble), radius: radius, card: small * (radius / BUBBLE.radius) * blow };
    }
    const rise = Math.min(1, (S.emerge - BUBBLE.blow) / (BUBBLE.pop - BUBBLE.blow));
    if (rise < 1) {
      const k = reduced ? rise : ease.inOut(rise), radius = BUBBLE.seed + (BUBBLE.radius - BUBBLE.seed) * k, startY = sy - BUBBLE.seed;
      return { x: sx + (CARD.x - sx) * k + (reduced ? 0 : Math.sin(rise * Math.PI * 2) * 18 * (1 - k)), y: startY + (CARD.y - startY) * k, radius: radius, card: small * (radius / BUBBLE.radius) };
    }
    const spring = Math.min(1, (S.emerge - BUBBLE.pop) / (1 - BUBBLE.pop));
    const settle = 1 + 1.5 * Math.pow(spring - 1, 3) + 0.5 * Math.pow(spring - 1, 2);
    return { x: CARD.x, y: CARD.y, radius: 0, card: small + (1 - small) * (reduced ? 1 : settle) };
  }

  // ---------- drawing ----------
  let sc = null, cu = null, scx = null, cux = null;
  function canvases() {
    if (sc && sc.isConnected && cu && cu.isConnected) return true;
    sc = document.querySelector('canvas.op-scene'); cu = document.querySelector('canvas.op-curtain');
    scx = sc && sc.getContext('2d'); cux = cu && cu.getContext('2d');
    return !!(scx && cux);
  }
  function drawScene() {
    const ctx = scx, z = zoom();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, sc.width, sc.height);
    if (!S.on) return;
    ctx.setTransform(SCALE * z, 0, 0, SCALE * z, SCALE * (W / 2) * (1 - z), SCALE * H * (1 - z));
    ctx.translate(0, PAN * S.pan); // (the camera's glide from the game's view down to the sand, as the lake: js/water.js)
    if (!overGame) drawFish(ctx); // (over the game's lake, the game's own fish swim there)
    // bubbles as the fishing game draws its own (parts/fishing/src/effects.js drawWater): a soft body, a thin rim and a
    // bright highlight
    S.bubbles.forEach((b) => {
      const a = Math.min(1, b.t / 0.4) * Math.max(0, Math.min(1, (b.y - 120) / 160)), x = b.x + Math.sin(b.t * 2 + b.ph) * b.sway;
      ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, TAU);
      ctx.fillStyle = 'rgba(220, 245, 255, ' + (0.16 * a).toFixed(3) + ')'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.4 * a).toFixed(3) + ')'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, TAU);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.75 * a).toFixed(3) + ')'; ctx.fill();
    });
    if (S.shell.alpha > 0) {
      drawShell(ctx, PEARL.x, PEARL.y, PEARL.size, S.shell);
      drawPearlLight(ctx, PEARL.x, PEARL.y, PEARL.size, S.glow * S.shell.alpha * Math.min(1, S.shell.open * 2), S.t);
    }
    if (S.motes.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      S.motes.forEach((m) => { const a = Math.sin(Math.min(1, m.life / 1.3) * Math.PI); ctx.fillStyle = 'rgba(255, 214, 120, ' + 0.85 * a + ')'; ctx.beginPath(); ctx.arc(m.x, m.y, 2.6, 0, TAU); ctx.fill(); });
      ctx.restore();
    }
  }
  function drawBeam(ctx, sx, sy, top) {
    const half = CARD.w / 2;
    const wave = (k) => (reduced ? 0 : Math.sin(S.t * 2.2 + k * 9) * 6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.moveTo(sx - 6, sy - 4);
    for (let i = 1; i <= 10; i += 1) { const k = i / 10; ctx.lineTo(sx - 6 + (CARD.x - half - sx + 6) * k + wave(k), sy + (top - sy) * k); }
    for (let i = 10; i >= 1; i -= 1) { const k = i / 10; ctx.lineTo(sx + 6 + (CARD.x + half - sx - 6) * k - wave(k + 0.5), sy + (top - sy) * k); }
    ctx.lineTo(sx + 6, sy - 4); ctx.closePath();
    const cone = ctx.createLinearGradient(0, sy, 0, top);
    cone.addColorStop(0, 'rgba(255, 238, 200, ' + 0.55 * S.beam + ')'); cone.addColorStop(0.5, 'rgba(255, 210, 235, ' + 0.22 * S.beam + ')');
    cone.addColorStop(1, 'rgba(170, 235, 255, ' + 0.14 * S.beam + ')');
    ctx.fillStyle = cone; ctx.fill();
    const core = ctx.createLinearGradient(0, sy, 0, top);
    core.addColorStop(0, 'rgba(255, 252, 235, ' + 0.7 * S.beam + ')'); core.addColorStop(1, 'rgba(255, 252, 235, 0)');
    ctx.beginPath(); ctx.moveTo(sx - 4, sy - 4); ctx.lineTo(CARD.x - half * 0.2, top); ctx.lineTo(CARD.x + half * 0.2, top); ctx.lineTo(sx + 4, sy - 4); ctx.closePath();
    ctx.fillStyle = core; ctx.fill();
    ctx.restore();
  }
  // the card: the painting with a soft drop shadow (and the arrival's flash)
  function drawCard(ctx, x, y, k) {
    if (!(ART.complete && ART.naturalWidth)) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(k, k);
    // the sea card has its own rounded, transparent corners: its shadow follows them
    ctx.shadowColor = 'rgba(0, 20, 60, 0.35)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    ctx.drawImage(ART, -CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h);
    ctx.shadowColor = 'transparent';
    if (S.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 * S.flash;
      ctx.drawImage(ART, -CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h);
    }
    ctx.restore();
  }
  function drawCurtain() {
    const ctx = cux;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cu.width, cu.height);
    if (!S.on) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    // the lake dims round the card (on the curtain, which is drawn once while nothing on it moves, rather than over
    // the moving scene every frame: a full-screen gradient each frame was a tablet's heaviest paint)
    if (S.dim > 0) {
      const dim = ctx.createRadialGradient(CARD.x, CARD.y, 300, CARD.x, CARD.y, 1100);
      dim.addColorStop(0, 'rgba(4, 14, 40, ' + 0.46 * S.dim + ')'); dim.addColorStop(1, 'rgba(4, 14, 40, ' + 0.62 * S.dim + ')');
      ctx.fillStyle = dim; ctx.fillRect(0, 0, W, H);
    }
    const p = pearlScreen(), sx = p[0], sy = p[1];
    if (S.beam > 0) drawBeam(ctx, sx, sy, CARD.y + CARD.h / 2 - 20);
    const b = bubbleAt(sx, sy);
    if (b.card > 0) drawCard(ctx, b.x, b.y, b.card);
    if (b.radius > 0) drawBubble(ctx, b.x, b.y, b.radius, S.t, reduced);
    S.pops.forEach((q) => drawBubble(ctx, q.x, q.y, q.r * (1 - 0.3 * q.life), S.t + q.r, true, 1 - q.life));
  }

  // ---------- the clock ----------
  let last = 0, running = false, staticDrawn = false, dimDrawn = -1, slow = 0, skip = false;
  function update(dt) {
    S.t += dt;
    if (S.spawning && !reduced && Math.random() < dt * 30) {
      const p = [PEARL.x + SHELL.pearl[0] * PEARL.size, PEARL.y + SHELL.pearl[1] * PEARL.size];
      S.motes.push({ x: p[0] + (Math.random() - 0.5) * 30, y: p[1], vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 70, life: 0 });
    }
    S.motes.forEach((m) => { m.life += dt; m.x += m.vx * dt; m.y += m.vy * dt; });
    S.motes = S.motes.filter((m) => m.life < 1.3);
    S.pops.forEach((q) => { q.life += dt / 0.7; q.x += q.vx * dt; q.y += q.vy * dt; });
    S.pops = S.pops.filter((q) => q.life < 1);
    S.fish.forEach((f) => { f.x += f.v * dt; f.wag += dt * (5 + Math.abs(f.v) / 12); if (f.x < -90) f.x = W + 90; if (f.x > W + 90) f.x = -90; });
    S.real.forEach((f) => { f.x += f.v * dt; if (f.x < -70) f.x = W + 70; if (f.x > W + 70) f.x = -70; });
    if (S.open && !reduced) {
      S.bubbleDue -= dt;
      while (S.bubbleDue <= 0) {
        S.bubbleDue += 0.09 + Math.random() * 0.16;
        const r = 1.5 + Math.random() * 3; // (the game's own bubble sizes)
        S.bubbles.push({ x: 400 + Math.random() * 872, y: SEABED_Y + 6 + Math.random() * 30, r: r, vy: 46 + r * 7 + Math.random() * 20, ph: Math.random() * TAU, sway: 6 + Math.random() * 10, t: 0 });
      }
    }
    S.bubbles.forEach((b) => { b.t += dt; b.y -= b.vy * dt; });
    S.bubbles = S.bubbles.filter((b) => b.y > 100);
  }
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!canvases() || document.hidden) return;
    update(dt);
    if (window.Water && Water.dive) { Water.dive(zoom()); Water.pan(S.pan); }
    // once the card is up, a slow device draws the shadow fish and bubbles every other frame (as js/water.js does)
    slow = slow * 0.95 + dt * 0.05;
    skip = S.open && slow > 0.024 ? !skip : false;
    if (!skip) drawScene();
    // once the card is up and still, the curtain only needs drawing once
    if (!(S.open && staticDrawn && !S.pops.length && S.flash <= 0 && S.beam <= 0 && S.dim === dimDrawn)) { drawCurtain(); staticDrawn = S.open; dimDrawn = S.dim; }
  }
  function run() { if (running) return; running = true; last = 0; requestAnimationFrame(frame); }

  const tween = (ms, f) => new Promise((ok) => {
    const t0 = performance.now();
    const step = (now) => { const t = Math.min(1, (now - t0) / ms); f(t); if (t < 1) requestAnimationFrame(step); else ok(); };
    requestAnimationFrame(step);
  });
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  function burst(x, y, r) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + Math.random() * 0.3, sp = 120 + Math.random() * 160;
      S.pops.push({ x: x + Math.cos(a) * r * 0.9, y: y + Math.sin(a) * r * 0.9, r: 5 + Math.random() * 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0 });
    }
  }
  let busy = false, tok = 0; // tok: instant() ends an opening that is still playing
  const Opening = {
    get open() { return S.open; },
    instant() {
      tok++; busy = false;
      S.on = true; S.open = true; staticDrawn = false; S.spawning = false;
      Object.assign(S.shell, { alpha: 0, open: 1, rock: 0, squash: 0, leak: 0, pearl: 1 });
      Object.assign(S, { pan: 0, dim: DIM_OPEN, emerge: 1, beam: 0, glow: 0, dive: 1, flash: 0 });
      if (!(ART.complete && ART.naturalWidth)) ART.addEventListener('load', () => { staticDrawn = false; }, { once: true });
      run();
    },
    // The lesson is over (as in Fishing Frenzy): the card shrinks into its bubble, which floats up and pops, while the
    // camera rises back up through the water to the lake's surface - the game's own view - for the journey to dissolve
    // back into the game. done: once the camera is up.
    async close(sound, done) {
      const my = ++tok, live = () => my === tok;
      const tw = (ms, f) => tween(ms, (t) => { if (live()) f(t); }).then(live);
      const q = reduced, snd = (k) => { try { if (live() && sound) sound(k); } catch (e) {} };
      busy = true;
      S.open = false; // (the curtain is drawn every frame again)
      const dive0 = S.dive, pan0 = S.pan, dim0 = S.dim;
      snd('bubbles');
      const up = tw(q ? 400 : 2200, (t) => { const k = ease.inOut(t); S.dive = dive0 * (1 - k); S.pan = pan0 + (1 - pan0) * k; S.dim = dim0 * (1 - k); });
      if (!await tw(q ? 300 : 1400, (t) => { S.close = t; })) return;
      const b = closingAt();
      burst(b.x, b.y, b.radius); snd('pop');
      S.close = 0; S.emerge = 0;
      await up;
      busy = false;
      if (live() && done) done();
    },
    async play(sound, done) {
      if (S.on || busy) { if (done) done(); return; }
      busy = true;
      const my = ++tok, live = () => my === tok;
      // a tween that stops writing once instant() has taken over; after it, an ended opening goes no further
      const tw = (ms, f) => tween(ms, (t) => { if (live()) f(t); }).then(live);
      const q = reduced, snd = (k) => { try { if (live() && sound) sound(k); } catch (e) {} };
      S.on = true; run();
      // the lesson opens on the lake as the game left it; the camera glides down through the water to the sand
      if (!await tw(q ? 300 : 1600, (t) => { S.pan = 1 - ease.inOut(t); })) return;
      // the seashell appears on the sand, rattles twice, gathers itself and swings open on its pearl
      snd('bubbles');
      if (!await tw(350, (t) => { S.shell.alpha = t; })) return;
      await wait(250);
      for (let i = 0; i < 2; i += 1) {
        snd('rattle');
        if (!await tw(q ? 220 : 340, (t) => { S.shell.rock = q ? 0 : 0.08 * Math.sin(t * Math.PI * 2) * (i ? -1 : 1); S.shell.leak = 0.35 + 0.3 * (i + t); })) return;
      }
      S.shell.rock = 0;
      if (!await tw(q ? 60 : 150, (t) => { S.shell.squash = Math.sin((t * Math.PI) / 2); })) return;
      snd('shellOpen');
      if (!await tw(q ? 350 : 900, (t) => { S.shell.squash = 1 - t; S.shell.open = q ? t : ease.outBack(t); S.shell.leak = 1 - t; S.glow = 0.6 * t; })) return;
      // the pearl brightens and the lake dims round it
      snd('shimmer');
      if (!await tw(q ? 350 : 1000, (t) => { S.shell.pearl = 1 + 0.16 * Math.sin(t * Math.PI); S.glow = 0.6 + 0.4 * t; S.dim = ease.inOut(t) * DIM; })) return;
      // the pearl blows the card up in a bubble, which pops mid-screen, while the camera dives after it
      snd('rise');
      S.spawning = true;
      let popped = false;
      if (!await tw(q ? 600 : 2700, (t) => {
        S.emerge = t; S.beam = Math.min(1, t * 2); S.dive = ease.inOut(Math.min(1, t * 1.25));
        if (!popped && t >= BUBBLE.pop) { popped = true; burst(CARD.x, CARD.y, BUBBLE.radius); snd('pop'); }
      })) return;
      S.spawning = false;
      snd('land');
      // the card lands; the shell and the pearl's light fade with it (nothing left below the card once it is open)
      if (!await tw(600, (t) => { S.flash = 1 - t; S.beam = 1 - t; S.glow = 1 - t; S.shell.alpha = 1 - t; })) return;
      // the lake round the card lightens again, so its water is seen rolling behind the lesson
      tw(900, (t) => { S.dim = DIM + (DIM_OPEN - DIM) * ease.inOut(t); });
      S.open = true; busy = false;
      if (done) done();
    }
  };
  window.Opening = Opening;
})();
