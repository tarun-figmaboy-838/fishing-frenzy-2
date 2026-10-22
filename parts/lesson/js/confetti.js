// =====================================================================
// CONFETTI — FLN animation kit confetti (styles: css/confetti.css, an exact copy of the game build).
// window.Confetti.burst() is called for every correct learner action (cheer() in js/game-engine.js; screens with
// calmOk get the sound and praise only). Each burst adds one .fx-layer over the whole window holding an .fx-confetti
// field of paper pieces; the layer removes itself once its last piece has fallen. Pieces are sized with the stage:
// --scale = min(window width / 1333, window height / 750). Off for prefers-reduced-motion.
// Each piece: .p falls (cfFall: --x, --fall, --delay, --drift, --dist) > .w glides and bobs (cfGlide: --rockT, --sway,
// --bob) > .f rocks (cfRock) or, for ~22%, tumbles end over end (cfTumble: --tilt, --yaw, --amp), with a bright front
// face (--c) and the same hue darkened behind (--c2). Glide and rock share --delay and --rockT, so the flip lands on
// the direction reversal.
// =====================================================================
(function () {
  var N = 110;                       // pieces per burst
  // the lesson's Soft Tangerine tones with festive accents that pop on the blue scene
  var COLORS = ['#DA7E20', '#FFAF53', '#FFD2A0', '#2EC4E6', '#7C3AED', '#E11D48', '#8BD64B', '#3B82F6'];
  var SHAPES = [['sq', 30], ['rc', 34], ['ln', 20], ['st', 16]]; // [class, weight]
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function () {
    var r = Math.random() * 100;
    for (var i = 0; i < SHAPES.length; i++) { r -= SHAPES[i][1]; if (r < 0) return SHAPES[i][0]; }
    return 'sq';
  };
  // the back face: the same hue, darkened
  var dark = function (hex) {
    var n = parseInt(hex.slice(1), 16), k = 0.68;
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v * k); });
    return 'rgb(' + c.join(',') + ')';
  };

  function burst() {
    if (reduced || !document.body) return;
    var W = window.innerWidth, H = window.innerHeight, scale = Math.min(W / 1333, H / 750);
    var layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.setProperty('--scale', scale.toFixed(3));
    var field = document.createElement('div');
    field.className = 'fx-confetti';
    var html = '', last = 0;
    for (var i = 0; i < N; i++) {
      var fall = rnd(2.6, 3.9), delay = rnd(0, 0.5), c = COLORS[i % COLORS.length];
      last = Math.max(last, fall + delay);
      html += '<span class="p" style="' +
        '--x:' + ((i + Math.random()) * (W / N)).toFixed(1) + 'px;--fall:' + fall.toFixed(2) + 's;--delay:' + delay.toFixed(2) + 's;' +
        '--drift:' + (rnd(-50, 50) * scale).toFixed(1) + 'px;--dist:' + Math.round(H + 60) + 'px;' +
        '--rockT:' + rnd(0.9, 1.5).toFixed(2) + 's;--sway:' + (rnd(8, 22) * scale).toFixed(1) + 'px;--bob:' + (rnd(5, 12) * scale).toFixed(1) + 'px;' +
        '--tilt:' + rnd(-40, 40).toFixed(0) + 'deg;--yaw:' + rnd(-35, 35).toFixed(0) + 'deg;--amp:' + rnd(48, 70).toFixed(0) + 'deg;' +
        '--z:' + rnd(0.8, 1.25).toFixed(2) + ';--dim:' + rnd(0.85, 1).toFixed(2) + ';--c:' + c + ';--c2:' + dark(c) + '">' +
        '<span class="w"><span class="f ' + pick() + (Math.random() < 0.22 ? ' tum' : '') + '"></span></span></span>';
    }
    field.innerHTML = html;
    layer.appendChild(field);
    document.body.appendChild(layer);
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, (last + 0.3) * 1000);
  }
  window.Confetti = { burst: burst };
})();
