// =====================================================================
// WATER - the lake behind the lesson's card is the fishing game's own lake: its first waters (Snowy Bay,
// assets/images/lake.webp, with its open-water mask lake-water.png) rolling through the game's water pass
// (js/water-gl.js: waves on the surface, refraction growing with depth, a caustic net and light shafts, the weed on the
// lake floor swaying), so the lesson plays on the very lake the warm-up was fished on, as Fishing Frenzy's lesson plays
// over its game's lake. The view starts as the game frames that lake (the painting 170 px down the stage, sky above
// it), so the game's empty lake dissolves into the lesson's without a seam; the opening then glides the camera down to
// the sand, where the seashell lies (Water.pan, 1 -> 0), and dives after the card (Water.dive, zoomed about the bottom
// middle). Without WebGL the painting is drawn still on canvas.water-bg.
// Time only advances while frames are drawn, so a hidden tab resumes without a jump. Still for prefers-reduced-motion,
// and in the journey until the lesson begins (it waits unseen behind the game). A slow device draws every other frame.
// =====================================================================
(function () {
  var W = 1672, H = 941, CW = 1920, CH = 1080, K = CW / W; // the game's world, and the canvas it is drawn on
  var SHIFT = 170, WATERLINE = 388, SEABED = 805; // the game's framing of the lake (parts/fishing/src/stage.js, levels.js)
  // the weed the water pass bends: the game's for these waters (parts/fishing/src/effects.js PLANTS[0], painting px)
  var WEED = [[5, 145, 680, 845], [205, 292, 735, 815], [1360, 1518, 704, 854], [1550, 1658, 760, 859]];
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var lake = new Image(), mask = new Image(), ready = 0;
  lake.onload = mask.onload = function () { ready++; };
  lake.src = 'assets/images/lake.webp';
  mask.src = 'assets/images/lake-water.png';
  lake.waterMask = mask; // (the water pass waves only the open water: the shore, ice and mountains stay put)

  var cv = null, ctx = null, t = 0, last = 0, slow = 0, skip = false, staticDone = false, zoom = 1, pan = 1;
  var glCv = null, GL = null, glOn = false;
  // the water pass draws at half size, stretched to the stage: soft painted water, mostly behind the card, looks the
  // same, and a tablet's GPU shades a quarter of the pixels (canvas.water-gl in index.html is 960 x 540). It is found
  // once the page's markup is drawn (the template runtime renders it after this script runs), and again if replaced.
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
  function canvas() {
    if (cv && cv.isConnected) return cv;
    cv = document.querySelector('canvas.water-bg');
    ctx = cv ? cv.getContext('2d') : null;
    staticDone = false;
    return cv;
  }
  window.Water = {
    // the camera's dive after the card (js/opening.js): zoomed about the bottom middle of the page
    dive: function (z) { if (z !== zoom) { zoom = z; staticDone = false; if (glCv) glCv.style.transform = z === 1 ? '' : 'scale(' + z + ')'; } },
    // the camera's glide from the game's view (1) down to the sand (0)
    pan: function (p) { if (p !== pan) { pan = p; staticDone = false; } }
  };
  function scene(motion) {
    var s = SHIFT * pan; // the painting this far down the stage (the game's view at pan 1)
    if (glScene()) {
      glOn = GL.ok && GL.render({
        from: lake, to: null, mix: 0, time: t, waterline: WATERLINE + s, seabed: SEABED + s, shift: s, amplitude: motion ? 1 : 0,
        plants: WEED.map(function (p) { return { left: p[0], right: p[1], top: p[2] + s, root: p[3] + s }; })
      });
      GL.show(glOn);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    if (glOn) { cv.style.background = 'none'; return; }
    // no WebGL: the painting, still, under a band of the game's sky
    ctx.setTransform(zoom, 0, 0, zoom, (CW / 2) * (1 - zoom), CH * (1 - zoom));
    ctx.fillStyle = '#2a86e0';
    ctx.fillRect(0, 0, CW, s * K + 2);
    ctx.drawImage(lake, 0, s * K, CW, CH);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    var c = canvas();
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; // capped: a hidden tab resumes where it left off
    last = now;
    if (!c || !ctx || ready < 2) return;
    // in the journey the lesson waits unseen behind the game until it begins: no water to animate (or pay for) till then
    var unseen = window.Journey && Journey.embedded && !Journey.begun;
    if (reduced || unseen) { if (!staticDone) { scene(false); staticDone = true; } return; }
    staticDone = false;
    // slow device: draw every other frame (time still runs at full speed)
    slow = slow * 0.95 + dt * 0.05;
    skip = slow > 0.024 ? !skip : false;
    t += dt;
    if (!skip) scene(true);
  }
  requestAnimationFrame(frame);
})();
