// =====================================================================
// SFX — the lesson's small sound effects, synthesised with Web Audio (no files): crisp, tiny, exactly timed and
// pitchable, so a sequence (the four sides landing, the side numbers) can rise musically. Every effect stays well
// below the voice-over (peaks ~0.05-0.2) so it decorates an animation without competing with the narration.
// Sfx.play(audioContext, kind, { f: pitch Hz, v: volume x }) - called through the engine's sfx() (mute applies).
//   pop     bubble pop: quick downward pitch drop on a soft body + a tiny click (a thing appears / lands)
//   tick    tiny click (a mark pops onto a line: parallel chevrons, equal ticks; a corner as the pen passes it)
//   pluck   soft rounded note (angle arcs drawing in)
//   glint   faint upward sparkle (a side lights up on its word)
//   chime   two-note bell (the shape's name arrives)
//   shimmer soft rising bell arpeggio (an outline closes and settles)
//   tap     soft click (taps, drags)        snap  two-step click up (a part snaps into place)
// =====================================================================
(function () {
  let noise = null;
  const noiseBuf = (ctx) => {
    if (noise && noise.sampleRate === ctx.sampleRate) return noise;
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  };
  // one voice: oscillator (type, f0 -> f1 over glide s) through a gain envelope (attack a, exponential decay d)
  const tone = (ctx, t, o) => {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || 0.05));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.peak, t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.a || 0.004) + o.d);
    let out = g;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
    osc.connect(g); out.connect(ctx.destination);
    osc.start(t); osc.stop(t + (o.a || 0.004) + o.d + 0.05);
  };
  // a very short filtered noise burst: the "click" of a pop or tick
  const click = (ctx, t, peak, hp, dur) => {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf(ctx); f.type = 'highpass'; f.frequency.value = hp || 2000;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.012));
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t); src.stop(t + 0.05);
  };
  // a soft band of noise sweeping from f0 to f1 Hz over dur s (water, air: the bubble rising, Swiftee's whoosh)
  const sweep = (ctx, t, dur, f0, f1, peak) => {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf(ctx); src.loop = true; f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t); src.stop(t + dur + 0.05);
  };
  const KINDS = {
    pop: (ctx, t, f, v) => {
      tone(ctx, t, { f0: f * 2.1, f1: f, glide: 0.045, peak: 0.16 * v, a: 0.003, d: 0.13 });
      tone(ctx, t, { type: 'triangle', f0: f / 2, f1: f / 2.4, glide: 0.06, peak: 0.05 * v, a: 0.004, d: 0.07 });
      click(ctx, t, 0.05 * v, 2500, 0.008);
    },
    tick: (ctx, t, f, v) => {
      tone(ctx, t, { f0: f * 2.6, f1: f * 1.8, glide: 0.02, peak: 0.07 * v, a: 0.002, d: 0.045 });
      click(ctx, t, 0.03 * v, 4000, 0.006);
    },
    pluck: (ctx, t, f, v) => tone(ctx, t, { type: 'triangle', f0: f, peak: 0.09 * v, a: 0.004, d: 0.22, lp: f * 3 }),
    glint: (ctx, t, f, v) => {
      tone(ctx, t, { f0: f * 1.7, f1: f * 2.5, glide: 0.09, peak: 0.035 * v, a: 0.012, d: 0.16 });
      tone(ctx, t + 0.05, { f0: f * 3.4, peak: 0.015 * v, a: 0.01, d: 0.14 });
    },
    chime: (ctx, t, f, v) => {
      [[0, f], [0.09, f * 1.5]].forEach(([dt, fr]) => {
        tone(ctx, t + dt, { f0: fr, peak: 0.075 * v, a: 0.005, d: 0.75 });
        tone(ctx, t + dt, { f0: fr * 2.01, peak: 0.022 * v, a: 0.005, d: 0.4 });
      });
    },
    shimmer: (ctx, t, f, v) => {
      [1, 1.26, 1.5, 2].forEach((m, i) => {
        tone(ctx, t + i * 0.07, { f0: f * m, peak: 0.045 * v, a: 0.006, d: 0.55 });
        tone(ctx, t + i * 0.07, { f0: f * m * 2.01, peak: 0.012 * v, a: 0.006, d: 0.3 });
      });
    },
    tap: (ctx, t, f, v) => { tone(ctx, t, { f0: f * 1.4, f1: f, glide: 0.03, peak: 0.07 * v, a: 0.002, d: 0.06 }); click(ctx, t, 0.025 * v, 3000, 0.006); },
    // the Lanternfish Parade: soft entry bubbles, a trail shimmer, and a warm panel chime
    bubbles: (ctx, t, f, v) => { [0, 0.11, 0.19, 0.3].forEach((dt, i) => tone(ctx, t + dt, { f0: f * (1 + i * 0.18), f1: f * (1.5 + i * 0.2), glide: 0.05, peak: 0.05 * v, a: 0.003, d: 0.07 })); },
    whoosh: (ctx, t, f, v) => sweep(ctx, t, 0.75, 500, 3000, 0.06 * v),
    // the opening (js/opening.js): the shell's two rattles, its lid swinging open, the bubble rising, the card landing
    rattle: (ctx, t, f, v) => { [0, 0.07, 0.15].forEach((dt, i) => { tone(ctx, t + dt, { type: 'triangle', f0: f * (1 - i * 0.06), f1: f * 0.7, glide: 0.03, peak: 0.08 * v, a: 0.002, d: 0.06 }); click(ctx, t + dt, 0.04 * v, 1800, 0.01); }); },
    shellOpen: (ctx, t, f, v) => { tone(ctx, t, { type: 'triangle', f0: f * 0.5, f1: f, glide: 0.35, peak: 0.07 * v, a: 0.02, d: 0.45, lp: f * 4 }); tone(ctx, t + 0.28, { f0: f * 2, peak: 0.04 * v, a: 0.006, d: 0.6 }); },
    rise: (ctx, t, f, v) => { sweep(ctx, t, 2.4, 300, 2400, 0.05 * v); [0.2, 0.7, 1.2, 1.7].forEach((dt, i) => tone(ctx, t + dt, { f0: f * (1 + i * 0.25), f1: f * (1.6 + i * 0.25), glide: 0.06, peak: 0.035 * v, a: 0.003, d: 0.08 })); },
    land: (ctx, t, f, v) => { tone(ctx, t, { type: 'triangle', f0: f * 0.25, f1: f * 0.18, glide: 0.12, peak: 0.1 * v, a: 0.004, d: 0.25 }); [1, 1.25, 1.5].forEach((m, i) => tone(ctx, t + 0.05 + i * 0.06, { f0: f * m, peak: 0.035 * v, a: 0.006, d: 0.5 })); },
    snap: (ctx, t, f, v) => {
      tone(ctx, t, { f0: f, f1: f * 1.15, glide: 0.03, peak: 0.1 * v, a: 0.002, d: 0.08 });
      tone(ctx, t + 0.06, { f0: f * 1.5, f1: f * 1.7, glide: 0.03, peak: 0.1 * v, a: 0.002, d: 0.12 });
      click(ctx, t, 0.04 * v, 2500, 0.008);
    }
  };
  // each effect's natural pitch (Hz) when none is given
  const BASE = { rattle: 420, shellOpen: 520, rise: 600, land: 880, bubbles: 700, whoosh: 1000, pop: 640, tick: 1400, pluck: 660, glint: 1200, chime: 1046.5, shimmer: 1046.5, tap: 700, snap: 990 };
  window.Sfx = {
    // a rising major arpeggio (C5 E5 G5 C6 E6) for sequences: notes[i]
    notes: [523.25, 659.25, 783.99, 1046.5, 1318.5],
    has(kind) { return !!KINDS[kind]; },
    play(ctx, kind, o) {
      if (!ctx || !KINDS[kind] || ctx.state === 'closed') return;
      o = o || {};
      try { KINDS[kind](ctx, ctx.currentTime + (o.delay || 0) + 0.005, o.f || BASE[kind], o.v == null ? 1 : o.v); } catch (e) {}
    }
  };
})();
