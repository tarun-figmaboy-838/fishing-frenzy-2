// =====================================================================
// MOTION — the lesson's choreographed animations, on GSAP (js/vendor/gsap.min.js).
// Everything a screen starts runs inside one gsap.context: Motion.clear() (called on every screen change) kills it
// and reverts every inline style it set, so a screen never inherits half-finished motion from the one before.
// Only unbound style properties are animated (opacity, transform, filter, stroke-width, text-shadow): the template
// runtime binds left/top and stroke colour, so the two never fight. Hover/tap feedback stays in CSS.
// prefers-reduced-motion: entrances jump to their end state.
// =====================================================================
(function () {
  const G = window.gsap;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const $ = (sel) => Array.from(document.querySelectorAll('.stage ' + sel));
  // glow tint: the palette's highlighter colour (CONFIG.palette.hl)
  const hex = ((window.CONFIG && CONFIG.palette && CONFIG.palette.hl) || '#fbbf24').replace('#', '');
  const RGB = [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16)).join(',');
  const tint = (a) => 'rgba(' + RGB + ',' + a + ')';
  const GLOW = () => 'drop-shadow(0px 0px 6px ' + tint(0.6) + ')', NOGLOW = () => 'drop-shadow(0px 0px 0px ' + tint(0) + ')';
  // one shared feel for every entrance: soft ease-out with a hint of overshoot, 90% -> 100% scale
  const ENTER = { duration: 0.6, ease: 'back.out(1.3)' };
  let ctx = G ? G.context(() => {}) : null;
  const add = (fn) => (ctx ? ctx.add(fn) : null);
  // An angle sweeps open from its first arm to its second (Fishing Frenzy's lesson): its wedge's path ("M vertex
  // L arm-start A r r 0 0 sweep arm-end Z") is rebuilt as the sweep grows, and put back as drawn at the end (or by
  // clear(), if a screen change cuts it short)
  const sweeps = [];
  const sweep = (w, at, dur) => {
    const d0 = w.getAttribute('d'), n = ((d0 || '').match(/-?\d+(\.\d+)?/g) || []).map(Number);
    if (n.length < 11) return;
    const vx = n[0], vy = n[1], sx = n[2], sy = n[3], R = n[4], f = n[8], a1 = Math.atan2(sy - vy, sx - vx);
    let da = Math.atan2(n[10] - vy, n[9] - vx) - a1;
    if (f === 1) { while (da < 0) da += Math.PI * 2; } else { while (da > 0) da -= Math.PI * 2; }
    const rec = { w: w, d0: d0, done: false }, r1 = (v) => Math.round(v * 10) / 10;
    const set = (t) => { const a = a1 + da * t;
      w.setAttribute('d', 'M' + vx + ',' + vy + ' L' + sx + ',' + sy + ' A' + R + ',' + R + ' 0 0 ' + f + ' ' + r1(vx + R * Math.cos(a)) + ',' + r1(vy + R * Math.sin(a)) + ' Z'); };
    const end = () => { if (!rec.done) { rec.done = true; if (w.getAttribute('d') !== d0) w.setAttribute('d', d0); } };
    sweeps.push(rec);
    set(0.001);
    const p = { t: 0 };
    add(() => G.to(p, { t: 1, delay: at, duration: dur, ease: 'power1.inOut', onUpdate: () => { if (!rec.done) set(Math.max(0.001, p.t)); }, onComplete: end }));
  };
  // the labels are centred on their point by CSS (translate -50% -50%); GSAP keeps that while it owns the transform
  const centred = (els) => G.set(els, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
  // every element any Motion animation touches (Motion.clear wipes their animated properties on screen change)
  const ANIMATED = '.tag.snum, .tag.vlab, .edge, .vdot, .shape-fill, .outline-settle, .pop-g, .par-ch';
  const ANIMATED_SVG = '.edge, .vdot, .shape-fill, .outline-settle, svg g.pop-g, .par-ch';

  const Motion = {
    reduced: reduced,
    // stop everything the current screen started and put every element back as the stylesheet draws it.
    // revert() alone is not enough: it restores each tween's recorded "before" state, and when one tween started
    // from another's end (letters faded out, then flown back in) that "before" can be a hidden state, which then
    // leaks into every later screen. So afterwards every property GSAP animates is wiped from every element it
    // can touch (the runtime's own bindings - left/top, stroke colour, transform-origin - are left alone).
    clear() {
      const fx = document.querySelector('.stage svg.math-fx'); if (fx) fx.innerHTML = ''; // (the maths in motion: gone with the screen)
      this.meetEls = null;
      if (ctx) ctx.revert();
      sweeps.splice(0).forEach((r) => { if (!r.done && r.w.isConnected) r.w.setAttribute('d', r.d0); r.done = true; });
      const els = $(ANIMATED); // (none yet before the lesson's first screen: GSAP warns about an empty target)
      if (G && els.length) G.set(els, { clearProps: 'opacity,transform,filter,textShadow,strokeWidth,translate,rotate,scale' });
      // GSAP pins SVG origins to 0 0 whenever it touches an SVG element (even while clearing), so drop that by hand
      $(ANIMATED_SVG).forEach((el) => el.style.removeProperty('transform-origin'));
      ctx = G ? G.context(() => {}) : null;
    },

    // screen 1: once the pen has closed the outline, a soft glow settles round it and the fill fades in
    hideFill() { if (G) add(() => G.set($('.shape-fill'), { opacity: 0 })); },
    settle() {
      if (!G) return;
      add(() => {
        const tl = G.timeline();
        tl.fromTo($('.outline-settle'), { opacity: 0 }, { opacity: 0.75, duration: 0.45, ease: 'sine.out' })
          .to($('.outline-settle'), { opacity: 0, duration: 0.85, ease: 'sine.inOut' })
          .to($('.shape-fill'), { opacity: 1, duration: 0.9, ease: 'sine.out' }, 0.1);
        return tl;
      });
    },

    // screen 2: numbers 1 left, 2 top, 3 right, 4 bottom - each glides in from its own side, one after another;
    // onLand(i) fires as number i settles (its side then gives the voice-sync grow)
    sideNums(onLand) {
      const els = ['.tag.snum.n1', '.tag.snum.n2', '.tag.snum.n3', '.tag.snum.n4'].map((s) => $(s)[0]).filter(Boolean);
      if (!G || !els.length) { els.forEach((e, i) => onLand && onLand(i)); return; }
      const from = [{ x: -46 }, { y: -46 }, { x: 46 }, { y: 46 }];
      add(() => {
        centred(els);
        const tl = G.timeline({ delay: 0.45 });
        els.forEach((el, i) => {
          tl.fromTo(el, Object.assign({ opacity: 0, scale: 0.9, x: 0, y: 0 }, from[i]),
            Object.assign({ opacity: 1, scale: 1, x: 0, y: 0 }, ENTER, reduced ? { duration: 0 } : {}), i * 1.0)
            .call(() => onLand && onLand(i), null, i * 1.0 + 0.5);
        });
        return tl;
      });
    },

    // screen 3: the previous shape fades out, then the four sides fly in - top from above, right from the right,
    // bottom from below, left from the left - each a glowing stroke that settles into the outline, starting just
    // before the previous one lands; a glow settles on the closed outline, then the corner dots and the fill fade in
    // onLand(i): side i has landed (its sound); onSettle(): the closed outline starts to glow
    assemble(onLand, onSettle) {
      if (!G) { [0, 1, 2, 3].forEach((i) => onLand && onLand(i)); if (onSettle) onSettle(); return; }
      const sides = [['.eAB', 0, -64], ['.eBC', 64, 0], ['.eCD', 0, 64], ['.eDA', -64, 0]];
      add(() => {
        const tl = G.timeline();
        const edges = sides.map((s) => $(s[0])[0]).filter(Boolean), dots = $('.vdot'), fill = $('.shape-fill'), labels = $('.board .tag.vlab');
        tl.to(edges.concat(dots, fill, labels), { opacity: 0, duration: 0.3, ease: 'sine.out' }, 0);
        sides.forEach((s, i) => {
          const el = $(s[0])[0]; if (!el) return;
          // immediateRender off: the side keeps fading out with the old shape until its own entrance starts
          tl.fromTo(el, { opacity: 0, x: s[1], y: s[2], strokeWidth: 7, filter: GLOW() },
            { opacity: 1, x: 0, y: 0, duration: reduced ? 0 : 0.55, ease: 'power3.out', immediateRender: false }, 0.45 + i * 0.6)
            .to(el, { strokeWidth: 5, filter: NOGLOW(), duration: 0.3, ease: 'sine.out' }, '>-0.05') // (every side 5, as Fishing Frenzy's)
            .call(() => onLand && onLand(i), null, 0.45 + i * 0.6 + (reduced ? 0 : 0.3)); // power3.out: ~95% there at 0.3 s
        });
        tl.call(() => onSettle && onSettle(), null, 3.0)
          .fromTo($('.outline-settle'), { opacity: 0 }, { opacity: 0.75, duration: 0.45, ease: 'sine.out' }, 3.0)
          .to($('.outline-settle'), { opacity: 0, duration: 0.85, ease: 'sine.inOut' }, '>')
          .to(dots, { opacity: 1, duration: 0.45, ease: 'sine.out' }, 3.1)
          .to(fill, { opacity: 1, duration: 0.9, ease: 'sine.out' }, 3.1);
        return tl;
      });
    },

    // screen 3: while the sides assemble, the whole shape is held slightly small and soft (it is still forming).
    // Applied only once the previous shape has faded out (assemble's 0.3 s exit), so the size change is never seen
    // and screen 2 -> 3 hands over without a jump.
    holdSmall(cx, cy) {
      if (!G) return;
      const g = $('svg g.pop-g')[0], d = $('div.pop-g')[0];
      add(() => {
        const tl = G.timeline();
        if (g) tl.set(g, { scale: 0.88, opacity: 0.85, svgOrigin: cx + ' ' + cy }, 0.32);
        if (d) tl.set(d, { scale: 0.88, opacity: 0.85, transformOrigin: cx + 'px ' + cy + 'px' }, 0.32);
        return tl;
      });
    },
    // ...then, on Swiftee's cue, it comes forward once: 88% -> 100%, opacity up, a soft glow that swells and settles.
    // Ends exactly at scale 1 / opacity 1 / no glow, and stays still.
    growIn(cx, cy) {
      if (!G) return;
      const g = $('svg g.pop-g')[0], d = $('div.pop-g')[0];
      add(() => {
        const tl = G.timeline(), dur = reduced ? 0 : 0.9;
        const held = g && +G.getProperty(g, 'scale') < 0.99; // (held small by holdSmall: comes up to size; else one soft beat)
        if (g && !held) tl.to(g, { scale: 1.04, svgOrigin: cx + ' ' + cy, duration: dur * 0.45, ease: 'sine.out', yoyo: true, repeat: 1 }, 0);
        if (d && !held) tl.to(d, { scale: 1.04, transformOrigin: cx + 'px ' + cy + 'px', duration: dur * 0.45, ease: 'sine.out', yoyo: true, repeat: 1 }, 0);
        if (g && held) {
          tl.to(g, { scale: 1, opacity: 1, svgOrigin: cx + ' ' + cy, duration: dur, ease: 'power2.out' }, 0)
            .fromTo(g, { filter: 'drop-shadow(0px 0px 0px ' + tint(0) + ')' },
              { filter: 'drop-shadow(0px 0px 12px ' + tint(0.45) + ')', duration: dur * 0.45, ease: 'sine.out', yoyo: true, repeat: 1 }, 0);
        }
        if (d && held) tl.to(d, { scale: 1, opacity: 1, transformOrigin: cx + 'px ' + cy + 'px', duration: dur, ease: 'power2.out' }, 0);
        if (g) tl.fromTo(g, { filter: 'drop-shadow(0px 0px 0px ' + tint(0) + ')' }, { filter: 'drop-shadow(0px 0px 12px ' + tint(0.45) + ')', duration: dur * 0.45, ease: 'sine.out', yoyo: true, repeat: 1 }, 0);
        return tl;
      });
    },

    // "We call this a trapezium": the shape (and its labels) zooms up once about its own centre and eases back
    // ---------- the maths in motion (stage px, from the engine's boardToStage): drawn on an overlay svg over the board,
    // wiped by clear(). Each returns how long it runs (ms) ----------
    fx() {
      let svg = document.querySelector('.stage svg.math-fx');
      if (!svg) {
        const stage = document.querySelector('.stage'); if (!stage) return null;
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'math-fx'); svg.setAttribute('viewBox', '0 0 1280 720'); svg.setAttribute('aria-hidden', 'true');
        stage.appendChild(svg);
      }
      return svg;
    },
    mk(tag, attrs, parent) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.keys(attrs || {}).forEach((k) => { if (k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); });
      (parent || this.fx()).appendChild(el);
      return el;
    },
    // equal sides: a glowing copy of side a lifts off, glides onto its opposite b (a slide: every point moves the same
    // way, the same distance) and fits it exactly, beats once, rests there so the fit can be seen, and fades. Paced to
    // be followed: the lift, a slow glide, the beat, the rest
    // lab { t, from, to, px, col }: the side's length rides along with it, from its own place onto the opposite's
    slideMatch(a, b, col, lab) {
      if (!G || reduced || !this.fx()) return 0;
      const ln = this.mk('line', { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2, stroke: col || a.col || '#1e7bff', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0, 'class': 'math-copy' });
      const tx = lab ? this.mk('text', { x: lab.from.x.toFixed(1), y: lab.from.y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': lab.px.toFixed(1), 'font-weight': 900,
        'font-family': "Nunito, 'Noto Sans Math', system-ui, sans-serif", fill: lab.col || '#1656e0', stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke', opacity: 0, text: lab.t }) : null;
      add(() => {
        const tl = G.timeline({ onComplete: () => { ln.remove(); if (tx) tx.remove(); } })
          .to(ln, { opacity: 1, 'stroke-width': 11, duration: 0.35 })
          .to(ln, { attr: { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 }, duration: 1.4, ease: 'power2.inOut' }, 0.45)
          .to(ln, { 'stroke-width': 14, duration: 0.22, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.9)
          .to(ln, { opacity: 0, duration: 0.45 }, 2.75);
        if (tx) tl.to(tx, { opacity: 1, duration: 0.3 }, 0.15).to(tx, { attr: { x: lab.to.x, y: lab.to.y }, duration: 1.4, ease: 'power2.inOut' }, 0.45).to(tx, { opacity: 0, duration: 0.45 }, 2.75);
        return tl;
      });
      return 3200;
    },
    // equal angles: a copy of the wedge at one corner turns a half-turn about the shape's centre O and lands exactly on
    // the opposite corner's wedge - the reason they are equal: a parallelogram turned half-way round its centre fits
    // itself, carrying each angle onto the one opposite. O shows as a dot while the copy turns round it. (Without O: the
    // copy travels across, turning on the way.)
    spinMatch(src, dst, O) {
      if (!G || reduced || !this.fx()) return 0;
      const g = this.mk('g', { 'class': 'math-glow' });
      const R = src.R, v = src.v, a1 = Math.atan2(src.u1.y, src.u1.x), a2 = Math.atan2(src.u2.y, src.u2.x), f = src.f, r1 = (n) => n.toFixed(1);
      this.mk('path', { d: 'M' + r1(v.x) + ',' + r1(v.y) + ' L' + r1(v.x + R * Math.cos(a1)) + ',' + r1(v.y + R * Math.sin(a1)) + ' A' + R + ',' + R + ' 0 0 ' + f + ' ' + r1(v.x + R * Math.cos(a2)) + ',' + r1(v.y + R * Math.sin(a2)) + ' Z',
        fill: src.col, 'fill-opacity': 0.95, stroke: '#fff', 'stroke-width': 2 }, g);
      if (O) {
        const origin = r1(O.x) + ' ' + r1(O.y);
        const dot = this.mk('circle', { cx: r1(O.x), cy: r1(O.y), r: 6, fill: '#fff', stroke: '#123b63', 'stroke-width': 3, opacity: 0 });
        add(() => G.timeline({ onComplete: () => { g.remove(); dot.remove(); } })
          .set(g, { rotation: 0, opacity: 0, svgOrigin: origin })
          .to([g, dot], { opacity: 1, duration: 0.35 })
          .to(g, { rotation: 180, duration: 1.7, ease: 'power2.inOut', svgOrigin: origin }, 0.5)
          .to(g, { opacity: 0.55, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 2.25)
          .to([g, dot], { opacity: 0, duration: 0.45 }, 2.9));
        return 3400;
      }
      // (svgOrigin: the corner itself, in the svg's coordinates - a px transformOrigin would be the group's box corner)
      const origin = r1(v.x) + ' ' + r1(v.y);
      add(() => G.timeline({ onComplete: () => g.remove() })
        .set(g, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 0, svgOrigin: origin })
        .to(g, { opacity: 1, scale: 1.2, duration: 0.35, svgOrigin: origin })
        .to(g, { x: dst.v.x - v.x, y: dst.v.y - v.y, rotation: 180, duration: 1.6, ease: 'power2.inOut', svgOrigin: origin }, 0.4)
        .to(g, { scale: 1, duration: 0.3, ease: 'back.out(2)', svgOrigin: origin }, 2.0)
        .to(g, { opacity: 0, duration: 0.45 }, 2.8));
      return 3300;
    },
    // A mask that keeps a drawing off every word on the stage - the corner letters, the lengths and angle sizes, the
    // name cards and the instruction plate - with a little air round each (stage px), so a line passes behind them
    // with a gap instead of through them
    wordMask(pad) {
      const svg = this.fx(), stage = document.querySelector('.stage');
      if (!svg || !stage) return null;
      const sr = stage.getBoundingClientRect(), k = sr.width / 1280 || 1, PAD = pad == null ? 7 : pad;
      const id = 'fx-words-' + Math.random().toString(36).slice(2, 8);
      let defs = svg.querySelector('defs');
      if (!defs) defs = this.mk('defs', {});
      const mask = this.mk('mask', { id: id, maskUnits: 'userSpaceOnUse', x: -400, y: -400, width: 2080, height: 1520 }, defs);
      this.mk('rect', { x: -400, y: -400, width: 2080, height: 1520, fill: '#fff' }, mask);
      stage.querySelectorAll('.tag:not(.off), .chip, .bubble, .opt, .blank, .tile').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden' || +getComputedStyle(el).opacity === 0) return;
        this.mk('rect', { x: ((r.left - sr.left) / k - PAD).toFixed(1), y: ((r.top - sr.top) / k - PAD).toFixed(1), width: (r.width / k + 2 * PAD).toFixed(1), height: (r.height / k + 2 * PAD).toFixed(1), rx: 8, fill: '#000' }, mask);
      });
      return { url: 'url(#' + id + ')', remove: () => mask.remove() };
    },
    // two sides that are not parallel, carried on: each dashed line grows from its side's corner, in the side's own colour
    // and weight, steadily for dur s until the two meet; there the meeting point pops and pings twice (stage px; kept
    // off the words with a hair of air: wordMask). meetPulse() beats them once; unmeet() fades them away.
    meet(lines, at, dur) {
      if (!this.fx()) return 0;
      this.unmeet(true);
      dur = dur || 1.3;
      const words = this.wordMask(3), g = this.mk('g', { 'class': 'math-meet' });
      if (words) g.setAttribute('mask', words.url);
      this.meetEls = { g: g, words: words };
      const lns = lines.map((l) => this.mk('line', { x1: l.x1.toFixed(1), y1: l.y1.toFixed(1), x2: l.x1.toFixed(1), y2: l.y1.toFixed(1), stroke: l.col || '#1e7bff', 'stroke-width': (l.w || 4).toFixed(1),
        'stroke-dasharray': (2.4 * (l.w || 4)).toFixed(1) + ' ' + (1.8 * (l.w || 4)).toFixed(1), 'stroke-linecap': 'round' }, g));
      const ring = this.mk('circle', { cx: at.x.toFixed(1), cy: at.y.toFixed(1), r: 8, fill: 'none', stroke: '#ff7a00', 'stroke-width': 3, opacity: 0 });
      const dot = this.mk('circle', { cx: at.x.toFixed(1), cy: at.y.toFixed(1), r: 0, fill: '#ff7a00', stroke: '#fff', 'stroke-width': 3 });
      Object.assign(this.meetEls, { dot: dot, ring: ring, lines: lns, w: lines.map((l) => l.w || 4) });
      if (!G || reduced) { lns.forEach((ln, i) => { ln.setAttribute('x2', lines[i].x2); ln.setAttribute('y2', lines[i].y2); }); dot.setAttribute('r', 8); return 0; }
      add(() => {
        const tl = G.timeline();
        lns.forEach((ln, i) => tl.to(ln, { attr: { x2: lines[i].x2, y2: lines[i].y2 }, duration: dur, ease: 'sine.inOut' }, 0));
        tl.to(dot, { attr: { r: 11 }, duration: 0.22, ease: 'back.out(2.5)' }, dur).to(dot, { attr: { r: 8 }, duration: 0.2 }, dur + 0.22)
          .fromTo(ring, { attr: { r: 8 }, opacity: 0.95 }, { attr: { r: 34 }, opacity: 0, duration: 0.7, ease: 'sine.out', repeat: 1, repeatDelay: 0.1, immediateRender: false }, dur);
        return tl;
      });
      return Math.round((dur + 0.45) * 1000);
    },
    meetPulse() {
      const m = this.meetEls;
      if (!m || !G || reduced) return;
      add(() => G.timeline()
        .to(m.lines, { attr: { 'stroke-width': (i) => (m.w[i] * 1.7).toFixed(1) }, duration: 0.25, ease: 'sine.out', yoyo: true, repeat: 1 }, 0)
        .to(m.dot, { attr: { r: 11 }, duration: 0.25, ease: 'sine.out', yoyo: true, repeat: 1 }, 0));
    },
    unmeet(now) {
      const m = this.meetEls; this.meetEls = null;
      if (!m) return;
      const gone = () => { m.g.remove(); m.dot.remove(); m.ring.remove(); if (m.words) m.words.remove(); };
      if (now || !G || reduced) { gone(); return; }
      add(() => G.to([m.g, m.dot, m.ring], { opacity: 0, duration: 0.35, onComplete: gone }));
    },
    pop(cx, cy) {
      if (!G || reduced) return;
      const g = $('svg g.pop-g')[0], d = $('div.pop-g')[0];
      add(() => {
        const tl = G.timeline();
        if (g) tl.fromTo(g, { scale: 1 }, { scale: 1.07, svgOrigin: cx + ' ' + cy, duration: 0.28, ease: 'sine.out', yoyo: true, repeat: 1, repeatDelay: 0.04 }, 0);
        if (d) tl.fromTo(d, { scale: 1 }, { scale: 1.07, transformOrigin: cx + 'px ' + cy + 'px', duration: 0.28, ease: 'sine.out', yoyo: true, repeat: 1, repeatDelay: 0.04 }, 0);
        return tl;
      });
    }
  };
  window.Motion = Motion;
})();
