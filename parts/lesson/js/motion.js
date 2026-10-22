// =====================================================================
// MOTION — the lesson's choreographed animations, on GSAP (js/vendor/gsap.min.js).
// Everything a screen starts runs inside one gsap.context: Motion.clear() (called on every screen change) kills it
// and reverts every inline style it set, so a screen never inherits half-finished motion from the one before.
// Only unbound style properties are animated (opacity, transform, filter, stroke-width, text-shadow): the template
// runtime binds left/top and stroke colour, so the two never fight. Hover/tap feedback stays in CSS.
// prefers-reduced-motion: entrances jump to their end state, value tweens still run (they carry the lesson state).
// =====================================================================
(function () {
  const G = window.gsap;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const $ = (sel) => Array.from(document.querySelectorAll('.stage ' + sel));
  // glow tint: the palette's highlighter colour (CONFIG.palette.hl); resting edge width follows the screen's look
  // (the opening screens, skin 'intro', are thinner)
  const intro = () => !!document.querySelector('.stage.skin-intro');
  const hex = ((window.CONFIG && CONFIG.palette && CONFIG.palette.hl) || '#fbbf24').replace('#', '');
  const RGB = [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16)).join(',');
  const tint = (a) => 'rgba(' + RGB + ',' + a + ')';
  const GLOW = () => 'drop-shadow(0px 0px 6px ' + tint(0.6) + ')', NOGLOW = () => 'drop-shadow(0px 0px 0px ' + tint(0) + ')';
  // one shared feel for every entrance: soft ease-out with a hint of overshoot, 90% -> 100% scale
  const ENTER = { duration: 0.6, ease: 'back.out(1.3)' };
  let ctx = G ? G.context(() => {}) : null;
  const add = (fn) => (ctx ? ctx.add(fn) : null);
  // the labels are centred on their point by CSS (translate -50% -50%); GSAP keeps that while it owns the transform
  const centred = (els) => G.set(els, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
  // every element any Motion animation touches (Motion.clear wipes their animated properties on screen change)
  const ANIMATED = '.tag.snum, .tag.vlab, .edge, .vdot, .shape-fill, .outline-settle, .pop-g, .par-ch';
  const ANIMATED_SVG = '.edge, .vdot, .shape-fill, .outline-settle, svg g.pop-g, .par-ch';

  const Motion = {
    ok: !!G,
    reduced: reduced,
    // stop everything the current screen started and put every element back as the stylesheet draws it.
    // revert() alone is not enough: it restores each tween's recorded "before" state, and when one tween started
    // from another's end (letters faded out, then flown back in) that "before" can be a hidden state, which then
    // leaks into every later screen. So afterwards every property GSAP animates is wiped from every element it
    // can touch (the runtime's own bindings - left/top, stroke colour, transform-origin - are left alone).
    clear() {
      if (ctx) ctx.revert();
      const els = $(ANIMATED); // (none yet before the lesson's first screen: GSAP warns about an empty target)
      if (G && els.length) G.set(els, { clearProps: 'opacity,transform,filter,textShadow,strokeWidth,translate,rotate,scale' });
      // GSAP pins SVG origins to 0 0 whenever it touches an SVG element (even while clearing), so drop that by hand
      $(ANIMATED_SVG).forEach((el) => el.style.removeProperty('transform-origin'));
      ctx = G ? G.context(() => {}) : null;
    },

    // a tween on plain values (pen position, trace length...): onUpdate(value) each frame, onDone at the end
    value(from, to, duration, ease, onUpdate, onDone) {
      if (!G) { onUpdate(to); if (onDone) onDone(); return; }
      const o = { v: from };
      add(() => G.to(o, { v: to, duration: duration, ease: ease, onUpdate: () => onUpdate(o.v), onComplete: onDone }));
    },
    // a pause that dies with the screen
    wait(seconds, fn) { if (!G) { fn(); return; } add(() => G.delayedCall(seconds, fn)); },

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
            Object.assign({ opacity: 1, scale: 1, x: 0, y: 0 }, ENTER, reduced ? { duration: 0 } : {}), i * 0.65)
            .call(() => onLand && onLand(i), null, i * 0.65 + 0.5);
        });
        return tl;
      });
    },

    // the corner letters come softly back, A -> B -> C -> D (screen 4, as Swiftee invites a closer look)
    labelsIn() {
      const els = $('.board .tag.vlab');
      if (G && els.length) add(() => G.to(els, { opacity: 1, duration: reduced ? 0 : 0.45, stagger: 0.15, ease: 'sine.out', overwrite: 'auto' }));
    },

    // soft exit (no cut) for labels leaving with the screen change, e.g. numbers and letters on screen 3
    fadeOut(sel) { const els = $(sel); if (G && els.length) add(() => G.to(els, { opacity: 0, duration: 0.35, ease: 'sine.out' })); },

    // screen 3: a corner letter arrives on its voice cue from its own corner, then a soft glow settles on it once
    letterIn(k, onLand) {
      const el = $('.tag.vlab.c' + k)[0];
      if (!G || !el) { if (onLand) onLand(); return; }
      const d = { A: [-44, -44], B: [44, -44], C: [44, 44], D: [-44, 44] }[k];
      add(() => {
        centred(el);
        const tl = G.timeline();
        tl.fromTo(el, { opacity: 0, x: d[0], y: d[1], scale: 0.9 }, Object.assign({ opacity: 1, x: 0, y: 0, scale: 1, overwrite: 'auto' }, ENTER, { duration: reduced ? 0 : 0.55 }))
          .call(() => onLand && onLand(), null, 0.48)
          .fromTo(el, { textShadow: '0px 0px 0px ' + tint(0) }, { textShadow: '0px 0px 10px ' + tint(0.8), duration: 0.4, ease: 'sine.out', yoyo: true, repeat: 1 }, 0.45);
        return tl;
      });
    },

    // screen 4: the previous shape fades out, then the four sides fly in - top from above, right from the right,
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
          tl.fromTo(el, { opacity: 0, x: s[1], y: s[2], strokeWidth: intro() ? 5.5 : 7, filter: GLOW() },
            { opacity: 1, x: 0, y: 0, duration: reduced ? 0 : 0.55, ease: 'power3.out', immediateRender: false }, 0.45 + i * 0.6)
            .to(el, { strokeWidth: intro() ? 3.5 : 5, filter: NOGLOW(), duration: 0.3, ease: 'sine.out' }, '>-0.05')
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

    // screen 4: while the sides assemble, the whole shape is held slightly small and soft (it is still forming).
    // Applied only once the previous shape has faded out (assemble's 0.3 s exit), so the size change is never seen
    // and screen 3 -> 4 hands over without a jump.
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
        if (g) {
          tl.to(g, { scale: 1, opacity: 1, svgOrigin: cx + ' ' + cy, duration: dur, ease: 'power2.out' }, 0)
            .fromTo(g, { filter: 'drop-shadow(0px 0px 0px ' + tint(0) + ')' },
              { filter: 'drop-shadow(0px 0px 12px ' + tint(0.45) + ')', duration: dur * 0.45, ease: 'sine.out', yoyo: true, repeat: 1 }, 0);
        }
        if (d) tl.to(d, { scale: 1, opacity: 1, transformOrigin: cx + 'px ' + cy + 'px', duration: dur, ease: 'power2.out' }, 0);
        return tl;
      });
    },

    // screen 10: the shape scales up into place (86% -> 100%, fading in), then its corner letters come in one by one
    // and the parallel arrows settle on last
    enterShape(cx, cy) {
      if (!G) return;
      const g = $('svg g.pop-g')[0], d = $('div.pop-g')[0], labels = $('.board .tag.vlab'), marks = $('.par-ch'), k = reduced ? 0 : 1;
      add(() => {
        const tl = G.timeline();
        tl.set(labels.concat(marks), { opacity: 0 }, 0);
        if (g) tl.fromTo(g, { scale: 0.86, opacity: 0, svgOrigin: cx + ' ' + cy }, { scale: 1, opacity: 1, svgOrigin: cx + ' ' + cy, duration: 0.7 * k, ease: 'power2.out' }, 0);
        if (d) tl.fromTo(d, { scale: 0.86, opacity: 0, transformOrigin: cx + 'px ' + cy + 'px' }, { scale: 1, opacity: 1, transformOrigin: cx + 'px ' + cy + 'px', duration: 0.7 * k, ease: 'power2.out' }, 0);
        tl.to(labels, { opacity: 1, duration: 0.35 * k, stagger: 0.08 * k, ease: 'sine.out' }, 0.55 * k)
          .to(marks, { opacity: 1, duration: 0.4 * k, ease: 'sine.out' }, 0.8 * k);
        return tl;
      });
    },

    // "We call this a trapezium": the shape (and its labels) zooms up once about its own centre and eases back
    pop(cx, cy) {
      if (!G || reduced) return;
      const g = $('svg g.pop-g')[0], d = $('div.pop-g')[0];
      add(() => {
        const tl = G.timeline();
        if (g) tl.fromTo(g, { scale: 1 }, { scale: 1.07, svgOrigin: cx + ' ' + cy, duration: 0.28, ease: 'sine.out', yoyo: true, repeat: 1, repeatDelay: 0.04 }, 0);
        if (d) tl.fromTo(d, { scale: 1 }, { scale: 1.07, transformOrigin: cx + 'px ' + cy + 'px', duration: 0.28, ease: 'sine.out', yoyo: true, repeat: 1, repeatDelay: 0.04 }, 0);
        return tl;
      });
    },

    // dragged the wrong way: that side gives one short, small wiggle about its middle
    wiggle(side) {
      const el = $('.e' + side)[0];
      if (!G || !el || reduced) return;
      add(() => G.timeline()
        .to(el, { rotation: 1.6, transformOrigin: '50% 50%', duration: 0.09, ease: 'sine.out' })
        .to(el, { rotation: -1.4, duration: 0.11, ease: 'sine.inOut' })
        .to(el, { rotation: 0.8, duration: 0.1, ease: 'sine.inOut' })
        .to(el, { rotation: 0, duration: 0.12, ease: 'sine.out' }));
    }
  };
  window.Motion = Motion;
})();
