// =====================================================================
// WATER — the live background behind every screen (one shared Canvas 2D layer, canvas.water-bg in index.html).
// The painted scene (js/water-manifest.js, built by tools/build-water.js) is redrawn each frame with:
//   · the water surface gently refracting: the surface band is redrawn in thin rows, each nudged sideways on two
//     slow sine waves, so the painted ripples ripple (the shoreline and mountains stay still)
//   · the underwater light lines shimmering the same way, much more softly
//   · soft light shafts from the surface that breathe and drift
//   · a few glints on the surface and bubbles rising from the sea-floor bubble spots
//   · the grass, cut out of the painting, swaying on a gentle current: anchored at its base, tips moving most, each
//     blade group on its own speed and phase
// The picture is fitted to the stage by height, so the water line sits exactly where it is in the painting (about
// 23 px of the painting's width is beyond each side of the 16:9 stage; that overscan also hides the row shifts).
// Where WebGL works the painting runs through the fishing games' own water pass instead (js/water-gl.js, canvas.water-gl:
// rolling waves, refraction growing with depth, a caustic net on the sand, light shafts and glints, as on their lakes),
// and this canvas only adds the swaying grass and the rising bubbles over it.
// Time only advances while frames are drawn, so a hidden tab resumes without a jump. Static for
// prefers-reduced-motion, and in the journey until the lesson begins (it waits unseen behind the game). If the frame rate drops, it draws every other frame.
// =====================================================================
(function () {
  var M = window.WATER_MANIFEST;
  if (!M) return;
  var CW = 1920, CH = 1080;                         // canvas pixels (the stage is drawn at 1.5x)
  var K = CH / M.h, DW = M.w * K, OX = (CW - DW) / 2; // painting px -> canvas px; fitted by height, centred
  // the painting scaled once to canvas size (BASE): every frame copies it 1:1, so nothing that should stay still is
  // ever resampled again (only the rows that ripple move, by fractions of a pixel)
  var BW = Math.ceil(DW), BX = Math.round(OX), BASE = null;
  var WATER = { top: 98, crest: 178, floor: M.h };   // painting rows: shoreline, wave crest line, bottom
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  var bg = new Image(), ready = 0, need = 1 + M.grass.length;
  bg.onload = function () { ready++; };
  bg.src = M.src;
  var grass = M.grass.map(function (g, i) {
    var im = new Image(); im.onload = function () { ready++; }; im.src = g.src;
    // a blade group: its own speed and phase; the shared current reaches groups further right a little later
    return { im: im, g: g, w1: rnd(0.55, 0.8), w2: rnd(1.1, 1.5), ph: rnd(0, 6.28) + g.x * 0.006, amp: Math.min(3.2, Math.max(1.2, g.h * 0.13)) };
  });

  // light shafts under the painted ones (painting x), surface glints and bubble spots (from the painting)
  var SHAFTS = [{ x: 92, w: 46, a: 0.06, p: 7.1, s: 0.08 }, { x: 512, w: 70, a: 0.07, p: 9.3, s: 0.06 }, { x: 950, w: 56, a: 0.06, p: 8.2, s: 0.07 }];
  var SPOTS = [{ x: 1160, y: 440, every: [3.5, 6] }, { x: 1148, y: 505, every: [4.5, 7.5] }, { x: 92, y: 538, every: [5, 8] }];
  var glints = [], bubbles = [];
  for (var i = 0; i < 16; i++) glints.push(newGlint(true));
  SPOTS.forEach(function (s) { s.next = rnd(0.5, s.every[0]); });
  function newGlint(any) {
    var y = rnd(WATER.top + 10, WATER.crest - 4);
    return { x: rnd(0, M.w), y: y, w: rnd(6, 16) * (0.6 + (y - WATER.top) / (WATER.crest - WATER.top)), life: rnd(1.6, 3.2), age: any ? rnd(0, 3) : 0 };
  }

  var cv = null, ctx = null, t = 0, last = 0, slow = 0, skip = false, staticDone = false, zoom = 1;
  // the WebGL water pass (js/water-gl.js), and the painting fitted to its world (1672 x 941) as this canvas fits it
  var glCv = null, GL = null, PAINT = null, glOn = false;
  // found once the page's markup is drawn (the template runtime renders it after this script runs), and again if the
  // canvas is replaced
  // (the lake's water pass draws at half size, stretched to the stage: soft painted water, mostly behind the card,
  // looks the same, and a tablet's GPU shades a quarter of the pixels; canvas.water-gl in index.html)
  function glScene() {
    var c = document.querySelector('canvas.water-gl');
    if (c !== glCv) {
      glCv = c; GL = null; glOn = false;
      try { if (c && window.PopoGame && PopoGame.WaterScene) GL = new PopoGame.WaterScene(c); } catch (e) { GL = null; }
      if (GL && !GL.ok) GL = null;
      if (c && zoom !== 1) c.style.transform = 'scale(' + zoom + ')';
    }
    return GL;
  }
  var WORLD = window.PopoGame || {}, WATERLINE = 250; // the painted surface in the world (its crest is at painting row 178)
  function painting() {
    if (PAINT) return PAINT;
    var w = WORLD.STAGE_W, h = WORLD.STAGE_H, k = h / M.h;
    PAINT = document.createElement('canvas'); PAINT.width = w; PAINT.height = h;
    var c = PAINT.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(bg, (w - M.w * k) / 2, 0, M.w * k, h);
    return PAINT;
  }
  // the session's opening dives the camera under the water (zoom about the bottom middle of the page)
  window.Water = { dive: function (z) { if (z !== zoom) { zoom = z; staticDone = false; if (glCv) glCv.style.transform = z === 1 ? '' : 'scale(' + z + ')'; } } };
  function canvas() {
    if (cv && cv.isConnected) return cv;
    cv = document.querySelector('canvas.water-bg');
    ctx = cv ? cv.getContext('2d') : null;
    staticDone = false;
    return cv;
  }
  var X = function (px) { return OX + px * K; }, Y = function (py) { return py * K; };
  // the light-shaft beam, drawn once: pale blue, strongest in the middle and at the top (alpha 0.1 at full)
  var SHAFT = null;
  function shaftSprite() {
    if (SHAFT) return SHAFT;
    SHAFT = document.createElement('canvas'); SHAFT.width = 64; SHAFT.height = 256;
    var c = SHAFT.getContext('2d'), h = c.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(190,240,255,0)'); h.addColorStop(0.5, 'rgba(190,240,255,0.1)'); h.addColorStop(1, 'rgba(190,240,255,0)');
    c.fillStyle = h; c.fillRect(0, 0, 64, 256);
    var v = c.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.15, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'destination-in'; c.fillStyle = v; c.fillRect(0, 0, 64, 256);
    return SHAFT;
  }
  function base() {
    if (BASE) return BASE;
    BASE = document.createElement('canvas'); BASE.width = BW; BASE.height = CH;
    var b = BASE.getContext('2d'); b.imageSmoothingQuality = 'high'; b.drawImage(bg, 0, 0, DW, CH);
    return BASE;
  }

  // the painting redrawn in thin rows from y0 to y1 (painting px); dx(y) = sideways shift in canvas px
  function rows(y0, y1, step, dx) {
    var B = base(), cy0 = Math.round(Y(y0)), cy1 = Math.round(Y(y1));
    for (var cy = cy0; cy < cy1; cy += step) {
      var h = Math.min(step, cy1 - cy);
      ctx.drawImage(B, 0, cy, BW, h, BX + dx(cy / K), cy, BW, h);
    }
  }
  function scene(motion) {
    // the camera (js/opening.js): zoomed about the bottom middle, the sand, as it dives under the surface
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // the lake through the fishing games' water pass; over it, only the grass and the bubbles
    if (glScene() && motion) {
      glOn = GL.ok && GL.render({ from: painting(), to: null, mix: 0, time: t, waterline: WATERLINE, plants: [], amplitude: 1 });
      GL.show(glOn);
      if (glOn) { cv.style.background = 'none'; ctx.clearRect(0, 0, CW, CH); }
    }
    ctx.setTransform(zoom, 0, 0, zoom, (CW / 2) * (1 - zoom), CH * (1 - zoom));
    ctx.globalCompositeOperation = 'source-over';
    if (!glOn) ctx.drawImage(base(), BX, 0);
    if (motion && !glOn) {
      // surface: still at the shoreline, strongest across the waves, settling below the crest
      rows(WATER.top + 2, WATER.crest + 14, 2, function (y) {
        var f = Math.min(1, (y - WATER.top) / 38) * (y > WATER.crest ? Math.max(0.25, 1 - (y - WATER.crest) / 14) : 1);
        return f * 3.2 * (0.65 * Math.sin(y * 0.21 + t * 1.15) + 0.35 * Math.sin(y * 0.073 - t * 0.7));
      });
      // under the water: the painted light lines shimmer softly
      rows(WATER.crest + 14, WATER.floor, 3, function (y) {
        return 1.3 * (0.6 * Math.sin(y * 0.045 + t * 0.9) + 0.4 * Math.sin(y * 0.017 - t * 0.55));
      });
    }
    // light shafts: a soft beam (fades out sideways and downward, no hard edges), slanted, breathing and drifting
    var SH = shaftSprite(), top = Y(WATER.crest - 2), H = Y(520) - top;
    ctx.globalCompositeOperation = 'lighter';
    if (!glOn) SHAFTS.forEach(function (s, i) {
      var a = motion ? s.a * (0.55 + 0.45 * Math.sin(t * 6.283 / s.p + i * 2)) : s.a * 0.6, sway = motion ? Math.sin(t * s.s * 6.283 + i) * 8 : 0;
      var w = s.w * K * 2.2, lean = -60;
      ctx.globalAlpha = a / 0.1;
      ctx.save(); // (on top of the camera)
      ctx.transform(w / SH.width, 0, lean / SH.height, H / SH.height, X(s.x) + sway - w / 2, top);
      ctx.drawImage(SH, 0, 0);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    if (motion && !glOn) {
      // glints on the surface: short soft streaks that fade in and out
      glints.forEach(function (g) {
        var u = g.age / g.life, a = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 0.5;
        if (a <= 0.01) return;
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(X(g.x), Y(g.y), g.w * K * 0.5, 1.6, 0, 0, 6.283); ctx.fill();
      });
    }
    ctx.globalCompositeOperation = 'source-over';
    // bubbles: rising with a little wobble, fading as they near the surface
    bubbles.forEach(function (b) {
      var a = Math.min(1, b.age / 0.6) * Math.min(1, (b.y - WATER.crest) / 60) * 0.75;
      if (a <= 0) return;
      var x = X(b.x + Math.sin(b.age * b.wf + b.ph) * 2.2), y = Y(b.y), r = b.r * K;
      ctx.strokeStyle = 'rgba(225,248,255,' + a.toFixed(3) + ')'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.8).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(0.8, r * 0.28), 0, 6.283); ctx.fill();
    });
    // grass: each blade group in thin vertical slices (blades) and rows; rows bend more toward the tip, so the base
    // stays planted; neighbouring slices run a little out of step, like separate blades in the same current
    grass.forEach(function (G) {
      var g = G.g, im = G.im, SL = 4, ns = Math.max(1, Math.ceil(g.w / SL));
      for (var si = 0; si < ns; si++) {
        var sx = si * SL, sw = Math.min(SL, g.w - sx), w1 = G.w1 * (1 + si * 0.07), ph = G.ph + si * 0.55;
        for (var r = 0; r < g.h; r++) {
          var up = 1 - (r + 0.5) / g.h, bend = Math.pow(up, 1.6);
          var dx = motion ? G.amp * bend * (0.75 * Math.sin(t * w1 + ph) + 0.25 * Math.sin(t * G.w2 + ph * 1.7)) : 0;
          ctx.drawImage(im, sx, r, sw, 1, X(g.x + sx + dx), Y(g.y + r), sw * K, K + 0.6);
        }
      }
    });
  }
  function step(dt) {
    t += dt;
    glints.forEach(function (g, i) { g.age += dt; if (g.age > g.life) glints[i] = newGlint(false); });
    SPOTS.forEach(function (s) {
      s.next -= dt;
      if (s.next <= 0) { s.next = rnd(s.every[0], s.every[1]); bubbles.push({ x: s.x, y: s.y, r: rnd(1.1, 2.3), v: rnd(16, 26), wf: rnd(1.5, 2.6), ph: rnd(0, 6.28), age: 0 }); }
    });
    for (var i = bubbles.length - 1; i >= 0; i--) { var b = bubbles[i]; b.age += dt; b.y -= b.v * dt; if (b.y < WATER.crest + 4) bubbles.splice(i, 1); }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    var c = canvas();
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; // capped: a hidden tab resumes where it left off
    last = now;
    if (!c || !ctx || ready < need) return;
    // in the journey the lesson waits unseen behind the game until it begins: no water to animate (or pay for) till then
    var unseen = window.Journey && Journey.embedded && !Journey.begun;
    var still = reduced || unseen;
    if (still) { if (!staticDone) { scene(false); staticDone = true; } return; }
    staticDone = false;
    // slow device: draw every other frame (time still runs at full speed)
    slow = slow * 0.95 + dt * 0.05;
    skip = slow > 0.024 ? !skip : false;
    step(dt);
    if (!skip) scene(true);
  }
  requestAnimationFrame(frame);
})();
