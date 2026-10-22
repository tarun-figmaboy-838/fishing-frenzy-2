// Scales the 1920x1080 stage to fit the window (letterboxed, centred).
(function () {
  function fit() {
    var r = document.getElementById('dc-root');
    if (!r) return;
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    r.style.transform = 'scale(' + s + ')';
    r.style.left = ((innerWidth - 1920 * s) / 2) + 'px';
    r.style.top = ((innerHeight - 1080 * s) / 2) + 'px';
  }
  addEventListener('resize', fit);
  addEventListener('orientationchange', fit);
  var n = 0, t = setInterval(function () { fit(); if (++n > 40) clearInterval(t); }, 50);
})();
