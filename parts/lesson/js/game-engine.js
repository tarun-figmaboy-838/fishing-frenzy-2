// =====================================================================
// GAME ENGINE — state, narration, geometry, interactions and rendering values.
// Loaded after js/vendor/dc-runtime.js (which provides DCLogic) and the data files.
// The markup in index.html binds to the values returned by renderVals().
// Inside the journey (shell/bridge.js, index.html at the root) the lesson plays after the fishing game's banner, in its
// own frame over the game: the journey's Play tap has unlocked the sound, so it begins straight away with its opening
// (the seashell and the card), and after its last line Swiftee swims off and the fishing begins. It has no Next, Back
// or screen list; ?dev=1 on the journey's page jumps to any screen. (Without a page - a headless test - no journey.)
// =====================================================================
const JOURNEY = typeof window !== 'undefined' && window.Journey && window.Journey.embedded ? window.Journey : null;
// the lesson's key words (reference KEY_WORDS, with the parallelogram's own terms)
const KEY_WORDS = /^(polygon|quadrilaterals?|trapeziums?|parallelograms?|parallel|bases?|legs?|sides?|opposite|adjacent|angles?|supplementary|vertex|vertices|equal|diagonals?|bisect|segments?|180°)$/;
window.TrapeziumGame = class TrapeziumGame extends DCLogic {
  constructor(props) {
    super(props);
    this.T = new Set();
    this.stepTok = 0;
    this.narrTok = 0;
    this.snaps = {};
    this.drag = null;
    this.state = this.fresh(false);
  }

  // ---------- data ----------
  get S() { return CONFIG.pxPerCm; }
  initP() {
    const S = this.S, c = CONFIG.start, H = c.height, yb = c.baseY, yt = yb - H;
    const ax = c.D + Math.sqrt((c.legAD * S) * (c.legAD * S) - H * H);
    const bx = c.C - Math.sqrt((c.legBC * S) * (c.legBC * S) - H * H);
    return { A: { x: ax, y: yt }, B: { x: bx, y: yt }, C: { x: c.C, y: yb }, D: { x: c.D, y: yb } };
  }
  fresh(started) {
    return {
      started: started, step: 0, P: this.initP(),
      line: '', reveal: 0, talking: false, bub: 'bubA',
      muted: this.state ? this.state.muted : false, done: true,
      opened: !!(this.state && this.state.opened), opening: !!(this.state && this.state.opening), // the card (js/opening.js)
      tap: {}, ang: {}, diag: {}, chips: [],
      moved: false, dragging: null, picks: {}, cfuFirst: true, results: {},
      hand: null, bubOff: false, glow: null, emph: {}
    };
  }
  steps() { return LESSON.steps; }
  // the screen's display flags; okF adds more once its question is answered (e.g. the parallel arrows)
  fl() { const st = this.cur(), s = this.state; return Object.assign({}, st.f || {}, s && s.done && st.okF ? st.okF : {}); }
  // the shape on the board: a checkpoint draws its own figure, every other screen the learner's shape
  shapeP() { const st = this.cur(); return st.fig ? st.fig.P : this.state.P; }
  // a question, task or check that waits for the learner
  asks(st) { return !!(st.task || st.opts || st.fill); }
  // while Swiftee gives a screen's instructions nothing can be answered, tapped or dragged yet
  busy() { return !!this.state.listen; }
  // the free-fill state of a fill / match check
  freshFill() { return { at: {}, locked: {}, sel: null, drag: null, checking: false, bad: {}, open: null, closing: false, menu: null }; }
  cur() { return this.steps()[this.state.step]; }

  // ---------- timers ----------
  tm(fn, ms) {
    const id = setTimeout(() => { this.T.delete(id); fn(); }, ms);
    this.T.add(id);
    return id;
  }
  clearT() { this.T.forEach((id) => clearTimeout(id)); this.T.clear(); }
  componentDidMount() {
    this.warmFonts();
    // Escape closes an open answer menu
    if (typeof document !== 'undefined') document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.state.fill && this.state.fill.open) this.ddClose(); });
    // the shape palette as CSS variables for css/game.css (--pg-sideA, --pg-fill, --pg-hl ...)
    const pal = CONFIG.palette || {};
    Object.keys(pal).forEach((k) => document.documentElement.style.setProperty('--pg-' + k, pal[k]));
    const C = CONFIG.swiftee;
    if (window.SwifteeMascot) {
      this.sw = new window.SwifteeMascot({ base: C.base, idle: C.idle, minHoldMs: C.minHoldMs, find: () => document.querySelector('.swiftee') });
      // every expression the lesson can ask for, so reactions never wait on the network
      const want = ['measuring', C.talk, C.waiting, C.praise, C.correct, C.wrong, C.nudge, C.done];
      LESSON.steps.forEach((st) => (st.lines || []).concat(st.after || []).forEach((L) => { if (L.m) want.push(L.m); }));
      this.sw.warm(want.filter((x, i) => want.indexOf(x) === i));
    }
    // on its own page the lesson waits on the lake for its Next tap: browsers only allow sound after a tap, so starting
    // on load played screen 1 silently and it moved on before the learner had touched anything. The clips load meanwhile.
    if (window.VO) VO.prefetch();
    if (JOURNEY) {
      if (JOURNEY.params.has('debug')) window.lessonDebug = this; // for tests (as the fishing game's popoDebug)
      if (JOURNEY.params.get('dev') === '1') JOURNEY.devScreens(this.steps().map((x, i) => ({ label: (i + 1) + ' ' + this.screenName(x), run: () => this.jumpTo(i) })));
      // the journey's Play has been tapped by the time the shell begins the lesson; begun for a ?dev=1 jump
      // (opts.jump), it leaves the opening out and the jump starts it
      JOURNEY.onBegin((opts) => { if (!(opts && opts.jump)) this.begin(); });
      JOURNEY.onDispose(() => this.leave());
      // ready once the page's pictures are in (the lake, the card, Swiftee)
      const ready = () => JOURNEY.ready();
      if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready, { once: true });
    } else if (new URLSearchParams(location.search).has('debug')) window.lessonDebug = this;
  }
  // the journey moves on: every voice, sound, timer and loop of the lesson stops for good
  leave() {
    this.stepTok++; this.narrTok++;
    this.clearT();
    this.cancelSpeech();
    if (this.wk) this.wk.hide();
    if (this.aw) this.aw.cancel();
    if (this.sw) this.sw.destroy();
    if (window.Motion) Motion.clear();
  }
  // a screen's name for the dev panel: checkpoints by their title, the rest by their opening line
  screenName(x) {
    if (x.end) return 'Lesson complete';
    if (x.cpTitle) return x.cpTitle.replace(/^Checkpoint (\d) · /, 'Check $1: ');
    const L = (x.lines || [])[0];
    return L && L.t ? L.t.replace(/\n/g, ' ') : x.id;
  }
  // after the lesson's last line: Swiftee swims off to the right, and the journey goes on to the fishing
  handOff() {
    if (!JOURNEY || this.handedOff) return;
    this.handedOff = true;
    this.depart();
    const results = Object.assign({}, this.state.results);
    setTimeout(() => JOURNEY.finish({ results: results }), Motion.reduced ? 0 : 1150);
  }
  // she crouches, then takes off out of the right of the card, rising as she goes
  depart() {
    const sw = typeof document !== 'undefined' && document.querySelector('.stage .swiftee'), G = window.gsap;
    this.setState({ bubOff: true });
    if (!sw || !G || Motion.reduced) return;
    this.pose('excited');
    this.sfx('whoosh');
    G.timeline()
      .to(sw, { y: 14, scaleY: 0.92, duration: 0.14, ease: 'sine.out', transformOrigin: '50% 90%' }, 0)
      .to(sw, { x: 1320, duration: 1.05, ease: 'power2.in' }, 0.14)
      .to(sw, { y: -360, scaleY: 1, duration: 1.05, ease: 'sine.out' }, 0.14)
      .to(sw, { rotation: 16, duration: 1.05, ease: 'power1.in' }, 0.14);
  }
  componentWillUnmount() { this.clearT(); this.cancelSpeech(); if (this.sw) this.sw.destroy(); }
  componentDidUpdate() {
    this.markSounds();
    this.fitBubble();
    if (window.Motion && Motion.sweepWedges) { Motion.sweepWedges(); Motion.glideMarks(); } // marks just shown sweep open / glide in (as Fishing Frenzy's)
  }

  // sounds for marks that appear with the board: parallel chevrons / equal ticks (a tick as they pop on) and angle arcs
  // (a soft pluck as each draws in, staggered like the arcs' own CSS delays .d0-.d3)
  markSounds() {
    const st = this.cur(), s = this.state;
    if (!s.started || !st || st.grid || st.end) { this.marks = null; return; }
    const f = st.fig ? { arcs: Object.keys(st.fig.angles || {}).join(''), ticks: st.fig.ticks || st.fig.hticks } : this.fl();
    const pg = this.isPg(this.shapeP());
    const m = { step: s.step, par: !!f.par, par2: !!(f.par2 || (st.task === 'dragB' && pg)), ticks: !!(f.ticks || f.hticks), arcs: (f.arcs || '').length };
    const p = this.marks;
    this.marks = m;
    if (!p) return;
    if ((m.par && !p.par) || (m.par2 && !p.par2) || (m.ticks && !p.ticks)) this.sfx('tick', { v: 0.9 });
    if (m.arcs > p.arcs) { // arcs that stay on screen from one screen to the next do not draw in again
      const N = window.Sfx ? Sfx.notes : [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < Math.min(4, m.arcs); i++) this.sfx('pluck', { f: N[i], v: 0.7, delay: 0.15 * i });
    }
  }
  // the shape a screen leaves behind once its task is done (for jumping straight to a later screen)
  taskResult(st, P) {
    P = this.clone(P);
    if (st.task === 'dragB') P.B.x = P.C.x + (P.A.x - P.D.x); // B dragged until BC is parallel to AD
    return P;
  }
  // ?dev=1: straight to screen i (a jump skips the opening)
  jumpTo(i) {
    if (!this.state.started) { this.openNow(); this.start(); if (i === 0) return; }
    if (i === this.state.step) return;
    let P = this.initP();
    this.snaps = {};
    for (let j = 0; j < i; j++) { this.snaps[j] = this.clone(P); P = this.taskResult(this.steps()[j], P); }
    this.setState({ P: P });
    this.sfx('tap');
    this.navAt = 0;
    this.goTo(i, true);
  }

  // Shrink-wraps the speech bubble to its widest line. Wrapped text otherwise leaves the box at its max width
  // even when every line is shorter. Measures in layout px (offsetLeft/offsetWidth ignore the stage scale);
  // hidden words still take their place, so the size is final from the first word of a line.
  warmFonts() {
    if (this._fontsWarm || typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
    this._fontsWarm = true;
    ['500 21px Fredoka', '600 21px Fredoka', '700 21px Fredoka', '700 26px "Baloo 2"', '800 26px "Baloo 2"', '600 20px Nunito', '700 20px Nunito', '800 20px Nunito', '900 20px Nunito']
      .forEach((f) => document.fonts.load(f).catch(() => {}));
    document.fonts.load('600 20px "Noto Sans Math"', '\u2225\u2220').catch(() => {}); // ∥ and ∠
  }
  // A solved checkpoint shows its finished figure: each '?' on the shape becomes the right value ('? cm' -> '7 cm',
  // '?' at an angle -> '115°'), taken from the answer box with the same name or from the right answer button.
  textW(text, font) {
    let m = this._measure;
    if (m === undefined) { try { m = document.createElement('canvas').getContext('2d') || null; } catch (e) { m = null; } this._measure = m; }
    if (!m) return text.length * (parseFloat(font.split(' ')[1]) || 22) * 0.56;
    m.font = font + ', system-ui, sans-serif'; return m.measureText(text).width;
  }
  figVal(st, key, raw) {
    if (!raw || raw.indexOf('?') < 0 || !this.state.done) return raw;
    const flip = { DA: 'AD', AD: 'DA', BC: 'CB', CD: 'DC' };
    const b = st.fill && (st.fill.blanks || []).find((x) => x.id === key || x.id === flip[key]);
    let v = b ? b.ans : null, unit = b ? (b.post || '').trim() : '';
    if (v == null && st.opts) {
      const o = st.opts.find((x) => x.ok), m = o && String(o.t).match(/^([\d.]+)\s*(.*)$/);
      if (m) { v = m[1]; unit = m[2]; }
    }
    if (v == null) return raw;
    if (raw.trim() === '?') return v + (unit === '°' ? '°' : unit ? ' ' + unit : '');
    return raw.replace('?', v);
  }
  // the half-diagonals a solved checkpoint found: from answer boxes named OC / OD, or (one answer button) the half
  // opposite the given one through O
  figHalves(st) {
    const fig = st.fig || {}, out = {};
    if (!fig.halves || !this.state.done) return out;
    ((st.fill && st.fill.blanks) || []).forEach((b) => { if (/^O[A-D]$/.test(b.id) && !fig.halves[b.id[1]]) out[b.id[1]] = b.ans + ' ' + ((b.post || 'cm').trim()); });
    const o = st.opts && st.opts.find((x) => x.ok), opp = { A: 'C', C: 'A', B: 'D', D: 'B' };
    if (o) Object.keys(fig.halves).forEach((k) => { if (!fig.halves[opp[k]] && !out[opp[k]]) out[opp[k]] = o.t; });
    return out;
  }
  fitBubble() {
    if (typeof document === 'undefined') return;
    const box = document.querySelector('.bubble'), txt = box && box.querySelector('.bubble-text');
    if (!txt) return;
    const key = (this.state.line || '') + '|' + txt.style.fontSize;
    if (key === this.fitKey) return;
    this.fitKey = key;
    box.style.width = '';
    if (!box.offsetWidth) { this.fitKey = null; return; } // hidden right now: fit when it shows
    const rows = {};
    txt.querySelectorAll('.w:not(.brk)').forEach((w) => {
      const r = rows[w.offsetTop] || (rows[w.offsetTop] = { l: Infinity, r: -Infinity });
      r.l = Math.min(r.l, w.offsetLeft); r.r = Math.max(r.r, w.offsetLeft + w.offsetWidth);
    });
    const widest = Math.max(0, ...Object.keys(rows).map((k) => rows[k].r - rows[k].l));
    if (!widest) return;
    const cs = getComputedStyle(box);
    const chrome = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    box.style.width = Math.ceil(widest + chrome + 3) + 'px';
    // a web font that finishes loading later is wider: fit again then
    if (!this.fontHook && document.fonts && document.fonts.addEventListener) {
      this.fontHook = true;
      document.fonts.addEventListener('loadingdone', () => { this.fitKey = null; this.fitBubble(); this.setState({ fontsAt: Date.now() }); }); // the answer row re-measures in the loaded font
      if (document.fonts.ready) document.fonts.ready.then(() => { this.fitKey = null; this.fitBubble(); });
    }
  }

  // ---------- Swiftee ----------
  pose(state) { if (this.sw) this.sw.play(state); }
  // what Swiftee does when nobody is talking
  restPose() {
    const C = CONFIG.swiftee, st = this.cur();
    if (this.state.measuring) return 'measuring'; // the tape-measure walk
    if (st.end) return C.done;
    if (st.cp && !this.state.done) return C.waiting;
    return C.idle;
  }
  // a short reaction that settles back on its own unless a line takes over
  react(state, ms) {
    this.pose(state);
    const tok = this.narrTok;
    this.tm(() => { if (tok === this.narrTok && !this.state.talking) this.pose(this.restPose()); }, ms || 1800);
  }

  // ---------- audio ----------
  synth() { try { return (typeof window !== 'undefined' && window.speechSynthesis) ? window.speechSynthesis : null; } catch (e) { return null; } }
  cancelSpeech() { if (window.VO) VO.stop(); const s = this.synth(); if (s) { try { s.cancel(); } catch (e) {} } }
  pickVoice() {
    const s = this.synth(); if (!s) return;
    let vs = [];
    try { vs = s.getVoices() || []; } catch (e) { vs = []; }
    const en = vs.filter((v) => /^en/i.test(v.lang));
    // Indian-English voices first (Neerja / Heera / Google en-IN), then other clear female English voices
    const pref = [/Neerja/i, /Heera/i, /Google .*Hindi|en-IN.*Google|Google.*India/i, /en-IN/i, /Google UK English Female/i, /Samantha/i, /Aria/i, /Jenny/i, /Female/i, /en-GB/i, /en-US/i];
    let pick = null;
    for (const re of pref) { pick = en.find((v) => re.test(v.name) || re.test(v.lang)); if (pick) break; }
    this.voice = pick || en[0] || null;
  }
  speechOf(t) {
    return t
      .replace(/\s*\n\s*/g, ' ') // bubble line breaks are layout only
      .replace(/∠\s?([A-D])/g, 'angle $1')
      .replace(/∥/g, ' is parallel to ')
      .replace(/\b(AB|BC|CD|AD|DC|AC|BD|OA|OB|OC|OD|AO|BO|CO|DO)\b/g, (m) => m.split('').join(' '))
      .replace(/&/g, ' and ')
      .replace(/(\d+)\s?cm\b/g, '$1 centimetres')
      .replace(/°/g, ' degrees')
      .replace(/−/g, ' minus ')
      .replace(/\+/g, ' plus ')
      .replace(/=/g, ' equals ')
      .replace(/…/g, ', ');
  }
  // recorded effects (CONFIG.sounds): decoded once into the audio context so they start the instant they are
  // called (in step with the confetti); an <audio> element covers pages opened from disk, where fetch is blocked
  loadSounds() {
    if (this.sndBuf) return;
    this.sndBuf = {}; this.sndEl = {};
    Object.keys(CONFIG.sounds || {}).forEach((k) => {
      const src = CONFIG.sounds[k];
      try { const a = new Audio(src); a.preload = 'auto'; this.sndEl[k] = a; } catch (e) {}
      if (!this.actx || typeof fetch === 'undefined') return;
      fetch(src).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, no) => this.actx.decodeAudioData(b, ok, no)))
        .then((buf) => { this.sndBuf[k] = buf; }).catch(() => {});
    });
  }
  playSound(kind) {
    try {
      const buf = this.sndBuf && this.sndBuf[kind];
      if (buf && this.actx) {
        const src = this.actx.createBufferSource(), g = this.actx.createGain();
        g.gain.value = CONFIG.soundVolume;
        src.buffer = buf; src.connect(g); g.connect(this.actx.destination); src.start();
        return true;
      }
      const el = this.sndEl && this.sndEl[kind];
      if (el) { const a = el.cloneNode(); a.volume = CONFIG.soundVolume; const p = a.play(); if (p && p.catch) p.catch(() => {}); return true; }
    } catch (e) {}
    return false;
  }
  // Which parts of the shape a line names, and at which word: [{ i, parts }]. Parts: 'aA'..'aD' angles,
  // 'AB' 'BC' 'CD' 'DA' sides, 'vA'..'vD' vertices. Only capitals count, so the article "A" is never a vertex.
  partCues(words) {
    const clean = (w) => (w || '').replace(/[^A-Za-z∠]/g, '');
    const side = (p, q) => ({ AB: 'AB', BA: 'AB', BC: 'BC', CB: 'BC', CD: 'CD', DC: 'CD', DA: 'DA', AD: 'DA' })[p + q];
    const one = (w) => /^[A-D]$/.test(w);
    const cues = [];
    words.forEach((raw, i) => {
      const w = clean(raw), prev = clean(words[i - 1]).toLowerCase(), next = clean(words[i + 1]);
      let parts = null, m;
      if ((m = /^∠([A-D])$/.exec(w))) parts = ['a' + m[1]];
      else if (/^[A-D]{2}$/.test(w) && side(w[0], w[1])) parts = [side(w[0], w[1])];
      else if (one(w) && /^(vertex|point|corner)$/.test(prev)) parts = ['v' + w];
      else if (one(w) && one(next) && !one(clean(words[i - 1])) && side(w, next)) parts = [side(w, next)]; // spoken "A B"
      else if (/^legs$/i.test(w)) parts = ['DA', 'BC']; // plural only: "a leg" names one, not both
      else if (/^bases$/i.test(w)) parts = ['AB', 'CD'];
      if (parts) cues.push({ i: i, parts: parts, done: false });
    });
    return cues;
  }
  // grow -> brief hold -> back (CSS transitions do the easing; same timing everywhere)
  emphasize(parts) {
    const tok = this.stepTok;
    this.setState({ emph: Object.assign({}, this.state.emph, parts.reduce((o, k) => { o[k] = 1; return o; }, {})) });
    this.tm(() => {
      if (tok !== this.stepTok) return;
      const e = Object.assign({}, this.state.emph); parts.forEach((k) => { delete e[k]; });
      this.setState({ emph: e });
    }, CONFIG.emph.holdMs);
  }
  // o: { f: pitch Hz, v: volume x, delay: s } for the synthesised effects (js/sfx.js)
  sfx(kind, o) {
    if (this.state.muted) return;
    if (CONFIG.sounds && CONFIG.sounds[kind] && this.playSound(kind)) return;
    if (!this.actx) return;
    if (window.Sfx && Sfx.has(kind)) { Sfx.play(this.actx, kind, o); return; }
    const ctx = this.actx;
    try {
      const now = ctx.currentTime;
      const N = {
        tap: [[700, 0, 0.07]], pop: [[520, 0, 0.07], [780, 0.06, 0.09]],
        good: [[660, 0, 0.12], [880, 0.1, 0.12], [1175, 0.2, 0.24]],
        snap: [[990, 0, 0.08], [1320, 0.07, 0.14]],
        bad: [[240, 0, 0.16], [190, 0.13, 0.22]]
      }[kind] || [];
      N.forEach((n) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = kind === 'bad' ? 'square' : 'triangle';
        o.frequency.value = n[0];
        const peak = kind === 'bad' ? 0.06 : 0.16;
        g.gain.setValueAtTime(0.0001, now + n[1]);
        g.gain.exponentialRampToValueAtTime(peak, now + n[1] + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + n[1] + n[2]);
        o.connect(g); g.connect(ctx.destination);
        o.start(now + n[1]); o.stop(now + n[1] + n[2] + 0.03);
      });
    } catch (e) {}
  }

  // ---------- narration ----------
  // One line of VO. The voice is the clock: nothing shows until it starts, each word appears as the voice
  // reaches it (word-boundary events mapped to exact word offsets), and Swiftee's beak moves only while it
  // speaks. Voices without boundary events fall back to a paced reveal that starts with the voice and holds
  // the last word until the voice ends. With no voice at all, the paced reveal and beak run on their own.
  say(L, done) {
    const keep = !!(L && L.keep); // voice-only: the bubble keeps showing the previous line
    if (!L || (!L.t && !keep) || (keep && !L.s)) { if (done) done(); return; }
    const text = keep ? this.state.line : L.t;
    const words = this.toWords(keep ? L.s : text);
    // spoken text, and where each displayed word starts in it
    let sp, offs = null;
    if (L.s) {
      sp = L.s;
      const toks = []; sp.replace(/\S+/g, (m, at) => { toks.push(at); return m; });
      if (toks.length === words.length) offs = toks;
    } else {
      const parts = words.map((w) => this.speechOf(w).trim());
      offs = []; let at = 0;
      parts.forEach((p) => { offs.push(at); at += p.length + 1; });
      sp = parts.join(' ');
    }
    const wordAt = (ci) => {
      if (offs) { let k = 0; while (k < offs.length && offs[k] <= ci) k++; return Math.max(1, k); }
      return Math.min(words.length, Math.floor((ci / Math.max(1, sp.length)) * words.length) + 1);
    };
    const setReveal = (n) => {
      if (!keep) this.setState({ reveal: n });
      if (atIdx >= 0 && n >= atIdx + 1) highlight();
      if (pAt >= 0 && n >= pAt + 1) firePulse();
      if (gAt >= 0 && n >= gAt + 1) fireGrow();
      emphCues.forEach((c) => { if (!c.done && n >= c.i + 1) { c.done = true; if (tok === this.narrTok) { this.emphasize(c.parts); focusAngles(c.parts); } } });
      cues.forEach((q) => { if (n >= q.i + 1) fireCue(q); });
    };
    // cues: board moments tied to a spoken word (exact match, punctuation ignored) - see runCue; any the voice never
    // reached all fire as the line ends
    const cues = (L.cues || []).map((c) => ({ c: c, i: words.map((w) => w.toLowerCase().replace(/[^a-z-]/g, '')).indexOf(c.at), done: false }));
    const fireCue = (q) => { if (q.done || tok !== this.narrTok) return; q.done = true; this.runCue(q.c); };
    // a part of the shape named in the line (∠A, AB, "A B", vertex A, legs, bases) grows briefly as the voice says it
    const emphCues = this.partCues(words);
    // angles named in the line join the focus as the voice says them; the rest fade back until shortly after the line
    const aNamed = {};
    const focusAngles = (parts) => {
      const ks = parts.filter((p) => /^a[A-D]$/.test(p)).map((p) => p[1]);
      if (!ks.length) return;
      ks.forEach((k) => { aNamed[k] = 1; });
      this.setState({ aFocus: Object.assign({}, aNamed) });
    };
    // pulse: the shape zooms once and returns to its size - on the pulseAt word as the voice says it, else as the line ends
    // (the last time the word is said: the name usually comes at the end, e.g. "...is called a right angled trapezium")
    const pAt = L.pulse && L.pulseAt ? words.map((w) => w.toLowerCase().replace(/[^a-z-]/g, '').indexOf(L.pulseAt) === 0).lastIndexOf(true) : -1;
    // growAt: the shape comes forward once (Motion.growIn) as that word is said - else as the line ends
    const gAt = L.growAt ? words.map((w) => w.toLowerCase().replace(/[^a-z-]/g, '').indexOf(L.growAt) === 0).indexOf(true) : -1;
    let grown = false;
    const fireGrow = () => {
      if (!L.growAt || grown || tok !== this.narrTok) return;
      grown = true;
      const P = this.state.P;
      Motion.growIn((P.A.x + P.B.x + P.C.x + P.D.x) / 4, (P.A.y + P.B.y + P.C.y + P.D.y) / 4);
    };
    let pulsed = false;
    const firePulse = () => {
      if (!L.pulse || pulsed || tok !== this.narrTok) return;
      pulsed = true;
      const P = this.state.P;
      Motion.pop((P.A.x + P.B.x + P.C.x + P.D.x) / 4, (P.A.y + P.B.y + P.C.y + P.D.y) / 4);
    };
    let cardShown = !(keep && L.chips); // (the glow below applies to any line)
    let glowOn = false;
    // glowAt: the highlight waits for that word
    const atIdx = L.glowAt ? words.findIndex((w) => w.toLowerCase().replace(/[^a-z-]/g, '').indexOf(L.glowAt) === 0) : -1;
    const highlight = () => {
      if (tok !== this.narrTok) return;
      if (L.glow && !glowOn) { glowOn = true; this.setState({ glow: L.glow }); }
    };
    const showCard = () => {
      if (tok !== this.narrTok) return;
      if (!cardShown) { cardShown = true; this.addChips(L.chips); }
      if (atIdx < 0) highlight();
    };
    const tok = ++this.narrTok;
    this.curLine = L;
    this.cancelSpeech();
    if (keep) this.setState({ talking: true, aFocus: null });
    else this.setState({ aFocus: null, line: text, reveal: 0, talking: true, bub: this.state.bub === 'bubA' ? 'bubB' : 'bubA', bubOff: false });
    if (L.m) this.preloadPose(L.m);
    let i = 0, rDone = false, sDone = false, fin = false, bMode = false, spoke = false, started = false, mouthOn = false, tStart = 0;
    let clipMs = 0; // a recorded clip's length at its play rate (0 = device voice / no voice: estimated pace)
    const live = () => tok === this.narrTok;
    const mouth = (on) => {
      if (!live() || on === mouthOn) return;
      mouthOn = on;
      if (!this.sw) return;
      if (L.holdM && L.m) { if (on) this.pose(L.m); return; } // keeps the line's pose (e.g. waving) instead of the beak loop
      this.sw.talk(on, on ? null : (L.m || this.restPose()));
    };
    const finish = () => {
      if (!live() || fin || !rDone || !sDone) return;
      fin = true; this.lineEnd = performance.now();
      mouth(false);
      highlight(); // in case the word was never reached (voice cut short)
      cues.forEach(fireCue); // likewise every word cue
      this.setState(Object.assign(keep ? { talking: false } : { talking: false, reveal: words.length }, L.glow && atIdx < 0 ? { glow: null } : {}));
      if (L.glow && atIdx >= 0) this.tm(() => { if (live()) this.setState({ glow: null }); }, 1500); // the word was the end: let it linger
      if (Object.keys(aNamed).length) this.tm(() => { if (live()) this.setState({ aFocus: null }); }, 1200);
      firePulse(); // no-op if the pulseAt word already fired it
      fireGrow(); // likewise for growAt
      if (this.cur().build) this.rushBuild(); // screen 1: the outline closes with the line
      // after speaking, Swiftee reacts with the line's expression for a beat, then settles
      if (L.m) this.tm(() => { if (live()) this.pose(this.restPose()); }, CONFIG.swiftee.reactMs);
      this.tm(() => { if (live() && done) done(); }, 420);
    };
    const revealAll = () => { if (!live()) return; i = words.length; setReveal(i); rDone = true; };
    // nominal time per word at u.rate; paceK learns the real voice speed from each finished line (fallback mode)
    const nominal = (w) => (170 + 48 * w.length + (/[.!?,…]$/.test(w) ? 160 : 0)) / 0.95;
    const pace = (w) => nominal(w) * (this.paceK || 1.18);
    // paced reveal: only when the voice gives no word positions; never shows the last word before the voice ends
    const tick = () => {
      if (!live() || rDone || bMode) return;
      // until the voice speed is learned, the last word waits for the voice to end; after that it follows the pace
      if (i < words.length - 1 || sDone || this.paceK) { i = Math.min(words.length, i + 1); setReveal(i); }
      if (i >= words.length) { rDone = true; finish(); return; }
      this.tm(tick, pace(words[i - 1] || ''));
    };
    const begin = () => { // the voice (or the silent fallback) has started
      if (!live() || started) return;
      started = true; tStart = performance.now();
      showCard(); mouth(true);
      // screen 1: the outline draws itself while this line is spoken and closes as it ends (fill fades in after)
      if (this.buildArmed && this.cur().build) {
        const lineMs = clipMs || words.reduce((t, w) => t + nominal(w), 0) * (this.paceK || 1.18);
        this.runBuild(Math.max(CONFIG.build.minMs, Math.min(CONFIG.build.maxMs, lineMs * CONFIG.build.ofLine)));
      }
      tick();
    };
    // the device's built-in voice (with none: the paced reveal). One voice for Swiftee: while her recorded voice is on, a
    // line whose clip cannot play shows its words silently rather than in the device's voice, and in the journey the
    // device's voice is never used (as in Fishing Frenzy's lesson)
    const device = () => {
      const s = this.synth();
      const canSpeak = !this.state.muted && s && typeof SpeechSynthesisUtterance !== 'undefined' && !JOURNEY && !(window.VO && VO.on);
      if (!canSpeak) {
        sDone = true; // no voice: words pace themselves and the beak moves while they appear
        this.tm(() => { begin(); }, 140);
        const silentEnd = () => { if (!live()) return; if (rDone) { mouth(false); finish(); } else this.tm(silentEnd, 120); };
        this.tm(silentEnd, 300);
        return;
      }
      const est = words.reduce((t, w) => t + nominal(w), 0) * 1.4;
      try {
        const u = new SpeechSynthesisUtterance(sp);
        if (this.voice) u.voice = this.voice;
        u.lang = (this.voice && this.voice.lang) || 'en-GB';
        u.rate = 0.95; u.pitch = 1.25;
        const end = () => {
          if (!live() || sDone) return;
          if (started && !bMode && tStart) { // learn this voice's speed; stay a touch slow so words never lead the voice
            const ratio = (performance.now() - tStart) / Math.max(1, words.reduce((t, w) => t + nominal(w), 0));
            if (ratio > 0.4 && ratio < 3) this.paceK = Math.max(0.6, 0.5 * (this.paceK || 1.18) + 0.5 * ratio * 1.06);
          }
          sDone = true; begin(); mouth(false); revealAll(); finish();
        };
        u.onstart = () => { spoke = true; begin(); };
        u.onend = end; u.onerror = end;
        u.onboundary = (ev) => {
          if (!live() || (ev.name && ev.name !== 'word')) return;
          bMode = true; begin();
          const k = wordAt(ev.charIndex || 0);
          if (k > i) { i = k; setReveal(i); }
        };
        // Chrome can drop an utterance queued in the same tick as cancel(); give it a beat.
        this.tm(() => { if (live()) { try { s.speak(u); } catch (e) { end(); } } }, 60);
        // a voice that never reports onstart: begin once the engine says it is speaking (or after a grace period)
        const kick = (n) => {
          if (!live() || started || sDone) return;
          let busy = false; try { busy = s.speaking && !s.pending; } catch (e) {}
          if (busy || n > 20) { begin(); return; }
          this.tm(() => kick(n + 1), 80);
        };
        this.tm(() => kick(0), 200);
        // watchdog: voices that never fire onend, or never start at all
        const watch = () => {
          if (!live() || sDone) return;
          let busy = true;
          try { busy = s.speaking || s.pending; } catch (e) { busy = false; }
          if (!busy && (spoke || started)) { end(); return; }
          this.tm(watch, 300);
        };
        this.tm(watch, 900);
        this.tm(() => { if (live() && !sDone) end(); }, est * 1.8 + 2500);
      } catch (e) { sDone = true; begin(); }
    };
    // recorded voice-over (js/voice.js): the clip is the clock. Words appear at the clip's pace - each word at its share
    // of the spoken characters, max(16, (seconds - 0.35) * 1000 / characters) ms per character - so word cues fire as
    // the voice says them; the line ends when the clip does (safety: what is left of it + 600 ms). A clip that never
    // starts (missing file, play() refused) hands the line to device() below, which shows its words silently.
    const voKey = keep ? L.s : text.replace(/\s*\n\s*/g, ' ').trim();
    if (!this.state.muted && window.VO && VO.has(voKey)) {
      const sec = VO.seconds(voKey), rate = VO.rate;
      clipMs = sec * 1000 / rate;
      // each displayed word's weight: its spoken length (numbers are said as words, so their digits weigh more)
      const wt = words.map((w) => this.speechOf(w).replace(/\d/g, 'xxxx').length + 1), tot = wt.reduce((a, b) => a + b, 0);
      const perCh = Math.max(16, (sec - 0.35) * 1000 / tot) / rate;
      const end = () => {
        if (!live() || sDone) return;
        sDone = true; begin(); mouth(false); revealAll(); finish();
      };
      const handed = VO.play(voKey, {
        start: () => {
          if (!live()) return;
          bMode = true; begin(); // bMode: no paced reveal - the timers below place every word
          // each word at its measured start in the clip (tools/vo_build.js); else at its share of the spoken characters
          const tw = VO.times(voKey), show = (k) => { if (live() && k + 1 > i) { i = k + 1; setReveal(i); } };
          if (tw && tw.length === words.length) {
            // follow the clip's own playhead (not a wall clock), so words stay with the voice through start-up lag or
            // buffering; the line ends where its speech does
            const sEnd = VO.speechEnd(voKey);
            const follow = () => {
              if (!live() || sDone) return;
              const ct = VO.now();
              if (ct >= 0) while (i < tw.length && tw[i] <= ct + 0.04) show(i);
              if (sEnd && ct >= sEnd) { end(); return; }
              this.tm(follow, 30);
            };
            follow();
          } else { let at = 0; wt.forEach((w, k) => { const ms = at * perCh; at += w; this.tm(() => show(k), ms); }); }
          this.tm(() => { if (live() && !sDone) { VO.stop(); end(); } }, clipMs + 600);
        },
        end: end,
        fail: () => { if (live() && !started) { clipMs = 0; device(); } }
      });
      if (handed) {
        // a clip that stalls before it starts: give the line to the device voice
        this.tm(() => { if (live() && !started && !sDone) { VO.stop(); clipMs = 0; device(); } }, 2500);
        return;
      }
      clipMs = 0;
    }
    device();
  }
  preloadPose(state) { if (this.sw && this.sw.m) this.sw.preload(state); }
  // Step narration queue. Interjections (feedback, idle hints, replay) play over it and then
  // the queue carries on with its next line, so a step's later lines and chips are never lost.
  // keep a number and its unit, and short equations, on one line ("5 cm", "AB = 6 cm" never split)
  toWords(t) { return t.replace(/(\d) (cm)\b/g, '$1\u00a0$2').replace(/ ([=+\u2212]) /g, '\u00a0$1\u00a0').split(/[ \t\n]+/).filter(Boolean); }
  // The narration plate shows a long line in short parts, each as the voice reaches it, so no screen carries a heavy
  // block of text: a line longer than CONFIG.plate.maxChars breaks after a sentence, else after a comma, else before a
  // joining word ("where", "so", "is called", "with"...), as near its middle as it can, never leaving a part shorter
  // than CONFIG.plate.minChars. Returns the index of each part's first word.
  lineParts(words) {
    const P = CONFIG.plate, len = (a, b) => words.slice(a, b).join(' ').length;
    const breakAt = (i) => { // how good a break before word i is (null: none)
      const prev = words[i - 1], next = words[i].toLowerCase().replace(/[^a-z]/g, ''), after = (words[i + 1] || '').toLowerCase();
      if (/[.!?…]$/.test(prev)) return 24;
      if (/[,;:]$/.test(prev)) return 12;
      if (/^(where|so|because|but|which|until|with|called)$/.test(next) || (next === 'is' && /^called/.test(after))) return 0;
      return null;
    };
    const cut = (a, b) => {
      if (len(a, b) <= P.maxChars) return [a];
      let best = null;
      for (let i = a + 1; i < b; i++) {
        const bonus = breakAt(i), l = len(a, i), r = len(i, b);
        if (bonus == null || l < P.minChars || r < P.minChars) continue;
        const score = Math.abs(l - r) - bonus;
        if (!best || score < best.s) best = { i: i, s: score };
      }
      return best ? cut(a, best.i).concat(cut(best.i, b)) : [a];
    };
    return cut(0, words.length);
  }
  // the screen's question or instruction (its last line), which the plate shows in full once it has been asked
  question(st) { const L = (st.lines || []).filter((x) => !x.keep && x.t).pop(); return L ? L.t : null; }
  playLines(lines, done) {
    this.q = { lines: lines || [], i: 0, done: done, tok: this.stepTok };
    this.qNext();
  }
  qNext() {
    const q = this.q;
    if (!q || q.tok !== this.stepTok) return;
    if (q.i >= q.lines.length) { this.q = null; if (q.done) q.done(); this.armIdle(); return; }
    const L = q.lines[q.i++];
    if (L.chips && !L.keep) this.addChips(L.chips); // a voice-only line shows its card in sync with the voice (say)
    this.say(L, () => this.qNext());
  }
  interject(L) {
    const tok = this.stepTok;
    this.say(L, () => {
      if (tok !== this.stepTok) return;
      if (this.q) { this.qNext(); return; }
      // a tip or hint on a question still open: the question comes back on the plate, shown, not said again
      const st = this.cur(), q = this.question(st);
      if (q && !this.state.done && this.asks(st) && this.isPlate(st) && this.state.line !== q) this.setState({ line: q, reveal: 999, bub: this.state.bub === 'bubA' ? 'bubB' : 'bubA' });
      this.armIdle(); this.maybeAdvance(true);
    });
  }
  // a word cue (line.cues): glow = sides drawn bolder and pulsing (null clears), hi = the card that lifts with them,
  // chip = a card that pops in, pulse = the shape zooms once, ms = clear the glow and lift again after this long
  runCue(c) {
    const tok = this.stepTok, P = this.state.P;
    if (c.chip) this.addChips([c.chip]);
    if (c.glow) this.sfx('glint', { v: 0.9 }); // a side (or the outline) lights up on its word
    if (c.glow !== undefined) this.setState({ glow: c.glow, chipHi: c.hi || null });
    if (c.pulse) Motion.pop((P.A.x + P.B.x + P.C.x + P.D.x) / 4, (P.A.y + P.B.y + P.C.y + P.D.y) / 4);
    if (c.ms) this.tm(() => { if (tok === this.stepTok) this.setState({ glow: null, chipHi: null }); }, c.ms);
  }
  addChips(cs) {
    const have = this.state.chips.map((c) => c.t), add = cs.filter((c) => have.indexOf(c.t) < 0);
    // a card arrives: the shape's name with a chime, any other card with a soft pop
    if (add.length) this.sfx(add.some((c) => /\bname\b/.test(c.k)) ? 'chime' : 'pop', { f: 880, v: 0.6 });
    this.setState({ chips: this.state.chips.concat(add) });
  }
  replay() {
    if (!this.state.started || !this.curLine) return;
    this.poke();
    this.interject(this.curLine);
  }
  toggleMute() {
    const m = !this.state.muted;
    this.setState({ muted: m });
    if (m) this.cancelSpeech();
  }

  // ---------- idle hints ----------
  needsInput() {
    const st = this.cur();
    return this.state.started && !this.state.done && this.asks(st);
  }
  armIdle() {
    this.armHand();
    if (this.idleId) { clearTimeout(this.idleId); this.T.delete(this.idleId); this.idleId = null; }
    if (!this.needsInput() || this.state.swAway || this.cur().auto) return;
    const tok = this.stepTok;
    this.idleId = this.tm(() => {
      this.idleId = null;
      if (tok !== this.stepTok || !this.needsInput()) return;
      if (this.state.swAway) return; // Swiftee is out measuring on the shape: no spoken reminder
      // (nor in the beat after a line ends: a tip's own end restores the question then)
      if (this.drag || this.walking || this.state.talking || (this.state.fill || {}).open || performance.now() - (this.lineEnd || 0) < 1000) { this.armIdle(); return; }
      if ((this.idleCount || 0) >= CONFIG.timing.idleMaxHints) return;
      this.idleCount = (this.idleCount || 0) + 1;
      const t = this.cur().idle;
      if (!t) return; // a question with no idle line (screens 5, 16): the hand / glowing answers nudge instead
      this.interject({ m: CONFIG.swiftee.nudge, t: t });
    }, CONFIG.timing.idleMs);
  }
  poke() { this.idleCount = 0; this.hideHand(); this.armIdle(); }

  // ---------- hand nudge ----------
  // After CONFIG.hand.idleMs with no touch while a tap or drag is expected, a hand shows exactly where
  // (and, for drags, which way). Any touch hides it and restarts the wait. On checks it never points at an
  // answer: the open options pulse together instead.
  handTarget() {
    const st = this.cur(), s = this.state, P = s.P;
    if (!s.started || st.end || s.done) return null;
    const t = st.task;
    if (t === 'tapEq') return null; // never the answer: the corners to try glow instead (.vp)
    if (t === 'connect') { // from a corner toward its opposite corner
      const a = s.diag.AC ? 'B' : 'A', b = this.opp(a), L = this.dist(P[a], P[b]) || 1, k2 = Math.min(130, L * 0.6) / L;
      return { qa: 'vtx-' + a, kind: 'drag', dx: Math.round((P[b].x - P[a].x) * k2), dy: Math.round((P[b].y - P[a].y) * k2) };
    }
    if (st.fill) return { qa: 'blank-' + this.activeBlank(), kind: 'tap' }; // never a tile: that would give the answer
    if (t === 'dragB') { // B slides toward its place (never further than 70 px, so the hand never gives the answer away)
      const dx = P.C.x + (P.A.x - P.D.x) - P.B.x;
      return { qa: 'vtx-B', kind: 'drag', dx: Math.abs(dx) < 12 ? 60 : Math.max(-70, Math.min(70, dx)), dy: 0 };
    }
    if (st.opts) return { kind: 'opts' };
    return null;
  }
  hideHand() { if (this.state.hand) this.setState({ hand: null }); }
  armHand(extraMs) {
    if (this.state.hand) return; // already showing: only a touch (poke) or its own timer takes it down
    if (this.handId) { clearTimeout(this.handId); this.T.delete(this.handId); this.handId = null; }
    // handOnce: one demo gesture as the screen opens, never again (and not at all once the learner has touched the shape)
    const once = !!this.cur().handOnce && !this.state.done;
    if (once && this.touched) return;
    if (!this.handTarget() || (this.handShown || 0) >= (once ? 1 : CONFIG.hand.maxShows)) return;
    const tok = this.stepTok;
    this.handId = this.tm(() => {
      this.handId = null;
      if (tok !== this.stepTok) return;
      // wait for Swiftee to finish and for hands to be off the board
      if (this.state.talking || this.drag || this.walking || (this.state.fill || {}).open) { this.armHand(); return; }
      if (once && this.touched) return;
      const T = this.handTarget();
      if (!T) return;
      let hand = { kind: T.kind, x: 0, y: 0, dx: T.dx || 0, dy: T.dy || 0, n: (this.handShown || 0), once: once };
      if (T.qa) {
        if (typeof document === 'undefined') return;
        const el = document.querySelector('[data-qa="' + T.qa + '"]'), stage = document.querySelector('.stage');
        if (!el || !stage) return;
        const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect(), sc = sr.width / 1280 || 1;
        if (!r.width && !r.height) return;
        hand.x = Math.round((r.left + r.width / 2 - sr.left) / sc);
        hand.y = Math.round((r.top + r.height / 2 - sr.top) / sc);
        // near the bottom edge the hand would run off the stage: point down onto the target's top instead
        if (hand.y + 75 > 715) { hand.down = true; hand.y = Math.round((r.top - sr.top) / sc) + 8; }
      }
      this.handShown = (this.handShown || 0) + 1;
      this.setState({ hand: hand });
      // a few presses, then step back; it returns only if the learner is still idle
      this.handId = this.tm(() => { this.handId = null; if (tok === this.stepTok) { this.setState({ hand: null }, () => this.armHand()); } }, once ? CONFIG.hand.onceMs : CONFIG.hand.showMs);
    }, (once ? CONFIG.hand.onceDelayMs : CONFIG.hand.idleMs) + (extraMs || 0));
  }
  // Browsers only allow audio after a user gesture, so the first tap unlocks it.
  rootDown(e) {
    const t = e && e.target, F = this.state.fill;
    if (F && F.open && !(t && t.closest && (t.closest('.dd-menu') || t.closest('.blank')))) this.ddClose();
    this.unlockAudio(); if (window.VO) VO.unlock(); if (this.state.started) this.poke(); }
  unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      // in the journey: the shell's context, unlocked by its Play tap (shell/bridge.js)
      if (!this.actx) this.actx = (JOURNEY && JOURNEY.audioContext()) || (AC ? new AC() : null);
      if (this.actx && this.actx.state === 'suspended') this.actx.resume();
    } catch (e) {}
    this.loadSounds();
  }

  // ---------- flow ----------
  start() {
    if (this.state.started && this.state.step === 0 && Date.now() - (this.navAt || 0) < 800) return;
    this.openNow(); // direct entry routes land on the stable lesson card
    this.unlockAudio();
    if (window.VO) { VO.unlock(); VO.prefetch(); } // every clip loads quietly; the first tap (rootDown) unlocks the voice-over
    const s = this.synth();
    if (s) { this.pickVoice(); try { s.onvoiceschanged = () => this.pickVoice(); } catch (e) {} }
    this.snaps = {};
    this.setState(this.fresh(true));
    this.goTo(0, true);
  }
  restart() { this.navAt = 0; this.start(); }
  // The learner's tap unlocks sound, then a lanternfish parade forms the lesson card before Swiftee arrives.
  begin() {
    if (this.state.started || this.state.opening) return;
    this.unlockAudio();
    if (window.VO) VO.unlock();
    if (!window.Opening || this.state.opened) { this.start(); return; }
    this.setState({ opening: true, line: '' });
    Opening.play((k) => this.sfx(k), () => {
      this.setState({ opened: true, opening: false }, () => this.arrive(() => { if (!this.state.started) this.start(); }));
    });
  }
  // straight to the open card (a jump to a screen, Next before the start)
  openNow() {
    if (this.state.opened) return;
    if (window.Opening) Opening.instant();
    this.setState({ opened: true, opening: false });
  }
  // Swiftee arrives on the open card (as in Fishing Frenzy's lesson): she dives in from above it, then the lesson begins
  arrive(then) { this.pose('happy'); this.dive(then); }
  // Swiftee dives in: from above the card, tipped forward like a diver, she plunges down - fast at first, slowing as the
  // water takes her - rights herself and lands softly on her spot, a trail of bubbles rising behind her and a little
  // puff as she lands. then() once she has landed
  dive(then) {
    const sw = typeof document !== 'undefined' && document.querySelector('.stage .swiftee'), G = window.gsap;
    const done = () => { if (then) then(); };
    if (this.diveTl) { this.diveTl.kill(); this.diveTl = null; }
    if (!sw || !G || Motion.reduced) { done(); return; }
    const stage = document.querySelector('.stage'), tok = this.stepTok;
    const bubble = (x, y, r) => {
      if (!stage || tok !== this.stepTok) return;
      const b = document.createElement('div');
      b.className = 'dive-bub';
      Object.assign(b.style, { left: x + 'px', top: y + 'px', width: 2 * r + 'px', height: 2 * r + 'px' });
      stage.appendChild(b);
      setTimeout(() => b.remove(), 1300);
    };
    const at = () => { const b = this.elBox(sw.querySelector('.swiftee-still') || sw); return b ? { x: b.x + b.w / 2, y: b.y + b.h * 0.45 } : null; };
    sw.classList.add('flying'); // (no CSS transition smooths the dive)
    G.set(sw, { x: 150, y: -640, rotation: 38, scale: 0.9, transformOrigin: '50% 50%' });
    this.sfx('whoosh');
    let last = 0;
    this.diveTl = G.timeline({ onComplete: () => {
      this.diveTl = null;
      G.set(sw, { clearProps: 'transform' }); sw.classList.remove('flying');
      const p = at(); if (p) for (let i = 0; i < 6; i += 1) bubble(p.x + (Math.random() - 0.5) * 120, p.y + 70 + Math.random() * 30, 4 + Math.random() * 6); // the landing puff
      this.sfx('pop'); done();
    } })
      .to(sw, { y: 0, duration: 1.6, ease: 'power2.out', onUpdate: () => { // the trail
        const now = Date.now(); if (now - last < 70) return; last = now;
        const p = at(); if (p) bubble(p.x + (Math.random() - 0.5) * 50, p.y - 20, 3 + Math.random() * 6);
      } }, 0)
      .to(sw, { x: 0, duration: 1.6, ease: 'sine.out' }, 0)
      .to(sw, { rotation: -7, duration: 1.1, ease: 'power1.out' }, 0)
      .to(sw, { rotation: 0, duration: 0.5, ease: 'sine.inOut' }, 1.1)
      .to(sw, { scale: 1, duration: 1.3, ease: 'power2.out' }, 0);
  }
  // an element's box in stage px (the stage is drawn scaled to the window)
  elBox(el) {
    const stage = typeof document !== 'undefined' && document.querySelector('.stage');
    if (!el || !stage) return null;
    const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect(), k = sr.width / 1280 || 1;
    return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
  }
  clone(P) { return JSON.parse(JSON.stringify(P)); }
  goTo(i, fwd) {
    const st = this.steps()[i];
    if (!st) return;
    this.clearT();
    const was = this.state.started ? this.cur() : null;
    this.fromPlate = !!(was && this.isPlate(was)); // Swiftee was off that screen: where she is back, she dives in
    if (this.diveTl) { this.diveTl.kill(); this.diveTl = null; const sw = document.querySelector('.stage .swiftee'); if (sw && window.gsap) { gsap.set(sw, { clearProps: 'transform' }); sw.classList.remove('flying'); } }
    Motion.clear(); // the previous screen's animations stop and leave no inline styles behind
    this.idleId = null; this.idleCount = 0; this.handId = null; this.handShown = 0; this.touched = false;
    if (this.wk) this.wk.hide();
    if (this.aw) this.aw.cancel();
    this.stepTok++; this.narrTok++;
    this.q = null;
    this.cancelSpeech();
    this.drag = null; this.conn = null; this.fd = null; this.walking = false; this.navAt = Date.now();
    let P;
    if (fwd || !this.snaps[i]) { P = this.clone(this.state.P); this.snaps[i] = this.clone(P); }
    else P = this.clone(this.snaps[i]);
    this.setState({
      step: i, P: P, aFocus: null, done: !this.asks(st), listen: !!(st.lines || []).length && this.asks(st), fill: this.freshFill(), conn: null,
      lenOn: was && was.task === 'measure' ? { AB: 1, CD: 1, DA: 1, BC: 1 } : {}, // (straight from the measuring walk the lengths stay up)
      supp: null, tap: {}, ang: {}, angIn: {}, diag: {}, chips: [],
      moved: false, dragging: null, picks: {}, cfuFirst: true, hand: null, bubOff: false, glow: null, chipHi: null, emph: {}, trace: null, build: null, measuring: null, tape: null, swAway: false, line: '', reveal: 0
    });
    this.pose(this.restPose());
    this.setState({}, () => this.stepMotion(st)); // once the new screen is drawn
    const lines = () => this.playLines(st.lines, () => {
      if (this.state.listen) this.setState({ listen: false }, () => this.armHand());
      if (st.task === 'measure' && st.auto) this.tm(() => this.autoMeasure(), 400);
      // screen 24: after her line her bubble fades, then she measures the angles with the protractor
      else if (st.task === 'measureAngles' && st.auto) this.tm(() => { this.setState({ bubOff: true }); this.tm(() => this.autoAngles(), 400); }, CONFIG.angleWalk.leadMs);
      else if (st.end && JOURNEY) this.tm(() => this.handOff(), CONFIG.flow.handOffMs); // on to the fishing
      else this.maybeAdvance(true);
    });
    // voiceDelay (ms): Swiftee waits for the screen's opening animation before she speaks (screen 3: the assembly);
    // back on the card after screens without her (the measuring walk, the goodbye) she dives in first, then speaks
    const speak = () => { if (st.voiceDelay) this.tm(lines, st.voiceDelay); else lines(); };
    if (this.fromPlate && !this.isPlate(st)) { const tok = this.stepTok; this.setState({}, () => this.dive(() => { if (tok === this.stepTok) speak(); })); }
    else speak();
  }
  finishTask() {
    if (this.state.done) return;
    this.setState({ done: true, hand: null }); // task done: the hand has nothing left to point at
    this.armIdle();
    const st = this.cur();
    if (st.auto) { this.sfx('good'); this.react(CONFIG.swiftee.praise); } // played by itself: no learner action to celebrate
    else this.cheer();
    if (st.after) this.playLines(st.after, () => this.maybeAdvance(true));
    else this.maybeAdvance(false);
  }
  // okGlow: once answered right, each listed side pair pulses in turn (e.g. AB + CD, then AD + BC), then settles;
  // it starts as the right answer has reached the centre (soloOk) so the eye goes answer -> shape
  okGlow(st) {
    const seq = st.okGlow, tok = this.stepTok, ms = 950;
    if (!seq) return;
    seq.forEach((pair, i) => this.tm(() => { if (tok === this.stepTok) this.setState({ glow: pair }); }, 550 + i * ms));
    this.tm(() => { if (tok === this.stepTok) this.setState({ glow: null }); }, 550 + seq.length * ms);
  }
  // every correct learner action: the correct sound and one confetti burst from the top, together, then praise
  cheer() {
    this.sfx('good');
    if (window.Confetti && !this.cur().calmOk) window.Confetti.burst(); // calmOk: sound and praise only
    this.react(CONFIG.swiftee.praise);
  }
  // A finished screen moves on by itself: CONFIG.flow.advanceMs (or the step's autoNext) after the last line ends.
  // Called whenever narration goes quiet; does nothing until the screen's task/check is done. Lesson complete stays.
  maybeAdvance(afterLine) {
    if (this.advId) { clearTimeout(this.advId); this.T.delete(this.advId); this.advId = null; }
    const st = this.cur(), i = this.state.step, tok = this.stepTok;
    if (!this.state.done || st.end || i >= this.steps().length - 1) return;
    // a running sequence (lengths pair by pair, supplementary pairs) finishes before the screen moves on
    const wait = Math.max(st.autoNext != null ? st.autoNext : CONFIG.flow.advanceMs, (this.seqEnd || 0) - Date.now());
    this.advId = this.tm(() => {
      this.advId = null;
      // someone is talking again (a tip, a hint): that line's end schedules the move afresh
      if (tok !== this.stepTok || this.state.talking || this.drag) return;
      const bd = this.state.build; // a building shape (screen 1) finishes its outline glow and fill fade first
      if (st.build && !(bd && bd.done && !bd.settle)) { this.maybeAdvance(false); return; }
      this.goTo(i + 1, true);
    }, Math.max(0, wait - (afterLine ? 420 : 0))); // a finished line has already paused 420 ms
  }
  // a wrong tap or line: the incorrect sound and Swiftee's tip (m: her pose; null keeps it). The same tip still being
  // said is not started over: the wrong move gets only its sound
  oops(text, m) {
    this.sfx('bad');
    if (this.state.talking && this.curLine && this.curLine.t === text) return;
    this.interject({ m: m === undefined ? CONFIG.swiftee.wrong : m, t: text });
  }


  // ---------- measuring ----------
  // measuring goes one side at a time, clockwise from the top
  measureOrder() { return ['AB', 'BC', 'CD', 'DA']; }
  activeSide() {
    const s = this.state;
    if (this.cur().task !== 'measure' || s.done || s.measuring) return null;
    return this.measureOrder().find((k) => !s.tap[k]) || null;
  }
  // Screen 13: Swiftee flies onto the shape and walks each side with her tape measure, A -> B -> C -> D -> A.
  // Without a page (headless test) the same steps run on timers.
  walkEnds(leg) { const P = this.state.P; return { AB: [P.A, P.B], BC: [P.B, P.C], CD: [P.C, P.D], DA: [P.D, P.A] }[leg]; }
  boardToStage(p) {
    const svg = typeof document !== 'undefined' && document.querySelector('.stage svg[aria-label="Parallelogram ABCD"]');
    const stage = svg && document.querySelector('.stage');
    if (!svg || !stage) return null;
    const m = svg.getScreenCTM(), sr = stage.getBoundingClientRect(), k = sr.width / 1280 || 1;
    const pt = svg.createSVGPoint(); pt.x = p.x; pt.y = p.y;
    const q = pt.matrixTransform(m);
    return { x: (q.x - sr.left) / k, y: (q.y - sr.top) / k };
  }
  stageToBoard(p) {
    const svg = p && typeof document !== 'undefined' && document.querySelector('.stage svg[aria-label="Parallelogram ABCD"]');
    if (!svg) return null;
    const sr = document.querySelector('.stage').getBoundingClientRect(), k = sr.width / 1280 || 1;
    const pt = svg.createSVGPoint(); pt.x = sr.left + p.x * k; pt.y = sr.top + p.y * k;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  // screen 1 build: one continuous pen stroke round the outline (D->A->B->C->D) at a steady pace, eased in at the
  // start and out at the end only, so it runs through the corners without stopping. Then the outline glow settles
  // and the fill fades in.
  // ms: draw in this long (screen 1 sizes it to the spoken line, so the outline closes as Swiftee finishes).
  // Clocked by frames rather than a fixed tween, so rushBuild() can bring the end forward when the voice ends early.
  runBuild(ms) {
    const tok = this.stepTok, P = this.state.P, Bc = CONFIG.build;
    this.buildArmed = false;
    const total = this.dist(P.D, P.A) + this.dist(P.A, P.B) + this.dist(P.B, P.C) + this.dist(P.C, P.D);
    const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2; // sine in-out: eased at the start and the end only
    const B = this.bld = { t0: performance.now(), dur: ms || total / Bc.pxPerMs, from: 0, total: total };
    const l1 = this.dist(P.D, P.A), l2 = l1 + this.dist(P.A, P.B), corners = [l1, l2, l2 + this.dist(P.B, P.C)]; // A, B, C along the pen's path
    const frame = () => {
      if (tok !== this.stepTok || this.bld !== B) return;
      const t = Math.min(1, (performance.now() - B.t0) / B.dur), d = B.from + (total - B.from) * ease(t);
      // the pen reaches a corner (its dot appears): a soft tick
      const prevD = (this.state.build && this.state.build.d) || 0;
      corners.forEach((cd, i) => { if (prevD < cd && d >= cd) this.sfx('tick', { f: (window.Sfx ? Sfx.notes : [523.25, 659.25, 783.99, 1046.5, 1318.5])[i + 1] / 2, v: 0.8 }); });
      if (t < 1) { this.setState({ build: { d: Math.max(0.001, d), done: false } }); this.tm(frame, 16); return; }
      this.bld = null;
      this.setState({ build: { d: total, done: true, settle: true, fill: true }, trace: null }, () => Motion.settle());
      this.sfx('shimmer', { v: 0.9 }); // the outline closes: a soft bell shimmer as the glow settles and the fill fades in
      this.tm(() => { if (tok === this.stepTok) this.setState({ build: { d: total, done: true, settle: false, fill: true } }); }, Bc.settleMs);
    };
    frame();
  }
  // the voice has ended: finish the outline within rushMs from where the pen is now (no jump)
  rushBuild() {
    const B = this.bld;
    if (!B) return;
    const left = B.t0 + B.dur - performance.now(), rush = CONFIG.build.rushMs;
    if (left <= rush) return;
    B.from = (this.state.build && this.state.build.d) || 0; B.t0 = performance.now() - rush * 0.5; B.dur = rush * 1.5; // resume mid-curve: no restart ease
  }
  // what a screen animates once it is on screen (GSAP, js/motion.js)
  stepMotion(st) {
    if (st !== this.cur()) return;
    this.seqEnd = 0;
    if (st.lenSeq) {
      st.lenSeq.forEach((q) => this.tm(() => {
        const on = this.state.lenOn || {}, fresh = q[1].some((k) => !on[k]); // (already up: only the pair's glow)
        if (fresh) this.setState({ lenOn: Object.assign({}, on, q[1].reduce((o, k) => { o[k] = 1; return o; }, {})) });
        this.emphasize(q[1]); if (fresh) this.sfx('pop');
      }, q[0] + (st.voiceDelay || 0)));
      this.seqEnd = Date.now() + st.lenSeq[st.lenSeq.length - 1][0] + 1200;
    }
    const sp = (st.f || {}).supp;
    if (sp) {
      const ms = CONFIG.supp.stepMs;
      sp.forEach((pair, i) => this.tm(() => { this.setState({ supp: i }); this.emphasize(['a' + pair[0], 'a' + pair[1]]); this.sfx('pop'); }, 500 + i * ms));
      this.seqEnd = Date.now() + 500 + sp.length * ms;
    }
    if (st.build) {
      Motion.hideFill();
      this.buildArmed = true; // say() starts the pen the moment the voice starts (begin)
      this.tm(() => { if (this.buildArmed) this.runBuild(); }, CONFIG.build.delayMs + 2500 + (st.voiceDelay || 0));
    }
    if (st.enterGrow) { // the shape scales up, then its letters and parallel arrows, then the cards (enterChips)
      const P = this.state.P;
      Motion.enterShape((P.A.x + P.B.x + P.C.x + P.D.x) / 4, (P.A.y + P.B.y + P.C.y + P.D.y) / 4);
      if (st.enterChips) this.tm(() => this.addChips(st.enterChips), Motion.reduced ? 0 : 1150);
    }
    if (st.sideNums) Motion.sideNums((i) => { this.emphasize([['DA', 'AB', 'BC', 'CD'][i]]); this.sfx('pop', { f: (window.Sfx ? Sfx.notes : [523.25, 659.25, 783.99, 1046.5, 1318.5])[i], v: 0.8 }); });
    if (st.assemble) {
      const P = this.state.P;
      Motion.holdSmall((P.A.x + P.B.x + P.C.x + P.D.x) / 4, (P.A.y + P.B.y + P.C.y + P.D.y) / 4);
      // each side lands with a pop, rising C E G C; the outline glow settles with a shimmer
      Motion.assemble((i) => this.sfx('pop', { f: (window.Sfx ? Sfx.notes : [523.25, 659.25, 783.99, 1046.5, 1318.5])[i] }), () => this.sfx('shimmer', { v: 0.9 }));
    }
  }
  // screen 14: after her line Swiftee walks onto the shape and measures its sides one after another
  autoMeasure() {
    const tok = this.stepTok;
    const nextSide = () => {
      if (tok !== this.stepTok || this.state.done) return;
      const k = this.activeSide();
      if (k) this.measureLeg(k, nextSide);
    };
    this.tm(nextSide, Motion.reduced ? 50 : CONFIG.walker.startMs);
  }
  // where Swiftee's feet are (stage px), read from her element as Fishing Frenzy's lesson does, so the measuring walk
  // starts and ends exactly where she stands (a fixed spot left her jumping as the walker handed back to her)
  homeFeet() {
    const W = CONFIG.walker, el = typeof document !== 'undefined' && document.querySelector('.stage .swiftee'), b = el && this.elBox(el);
    const base = (window.SWIFTEE_MANIFEST && SWIFTEE_MANIFEST.baselineY && SWIFTEE_MANIFEST.baselineY.normalized) || 0.877;
    return b && b.h ? { x: b.x + b.w / 2, y: b.y + b.h * base } : { x: W.homeX, y: W.homeY };
  }
  measureLeg(leg, then) {
    const s = this.state;
    if (s.done || s.tap[leg] || this.walking) return;
    if (this.cur().task === 'measure' && leg !== this.activeSide()) return; // only the glowing side
    this.walking = true;
    this.setState({ measuring: leg, tape: { leg: leg, t: 0 }, hand: null });
    this.sfx('tap');
    const tok = this.stepTok, W = CONFIG.walker, ends = this.walkEnds(leg);
    const lenCm = this.dist(ends[0], ends[1]) / this.S;
    const walkMs = Math.max(900, lenCm * W.msPerCm);
    const wk = Motion.reduced ? null : this.walker(); // (reduced motion: the tape lays itself, as screen 24's angles do)
    const live = () => tok === this.stepTok;
    const arrive = () => {
      if (!live()) return;
      const tap = Object.assign({}, this.state.tap); tap[leg] = true;
      // the full tape stays laid on the side until the next side starts (no blink)
      this.setState({ tap: tap, tape: Object.assign({}, this.state.tape, { t: 1, tip: null }) }); // lets go: the tape lies flat
      this.sfx('pop');
      this.walking = false;
      if (tap.AB && tap.BC && tap.CD && tap.DA) {
        // all four measured: fly home, then the screen carries on
        const home = () => { if (!live()) return; this.setState({ measuring: null, swAway: false, tape: null, bubOff: true }); if (wk) wk.hide(); this.pose(this.restPose()); this.tm(() => this.finishTask(), Motion.reduced ? 250 : CONFIG.walker.homeMs); };
        if (wk) { const from = this.boardToStage(ends[1]); this.tm(() => { if (live() && from) wk.stroll(from, this.homeFeet(), W.size, W.homeSize, home); else home(); }, 450); }
        else this.tm(home, 450);
      } else {
        this.setState({ measuring: null }); // a short beat on the corner, then the next side
        if (then) this.tm(then, CONFIG.walker.pauseMs);
      }
    };
    const walkIt = () => {
      if (!live()) return;
      const from = wk && this.boardToStage(ends[0]), to = wk && this.boardToStage(ends[1]);
      if (wk && from && to) wk.walk(from, to, walkMs, (t) => { if (live()) this.setState({ tape: { leg: leg, t: t, tip: this.stageToBoard(wk.tip()) } }); }, arrive);
      else this.tm(arrive, 300);
    };
    if (wk && !this.state.swAway) {
      // first side: she walks from her spot on the sand onto the side's first corner, shrinking to the shape's scale
      const to = this.boardToStage(ends[0]);
      this.setState({ swAway: true });
      if (to) wk.stroll(this.homeFeet(), to, W.homeSize, W.size, walkIt); else walkIt();
    } else walkIt();
  }
  walker() {
    if (typeof document === 'undefined' || !window.SwifteeWalker || !document.querySelector('.walker')) return null;
    return this.wk || (this.wk = new window.SwifteeWalker(CONFIG.swiftee.base));
  }  // Screen 24: Swiftee carries a protractor round A, B, C, D (js/angle-walker.js, as in Fishing Frenzy's lesson): each
  // angle is traced on the protractor in its own colour while its size counts up where its label goes, and comes in as
  // she lifts the protractor off it; then she walks home and the screen moves on. With reduced motion, or no page, all
  // four come in at once.
  autoAngles() {
    const tok = this.stepTok, live = () => tok === this.stepTok && !this.state.done;
    if (!live()) return;
    const keys = ['A', 'B', 'C', 'D'], P = this.state.P, aw = this.angleWalker(), PAL = CONFIG.palette;
    const verts = aw ? keys.map((k) => this.boardToStage(P[k])) : [];
    const end = () => { if (live()) this.finishTask(); };
    const show = (ks) => { this.setState({ angIn: Object.assign({}, this.state.angIn, ks.reduce((o, k) => { o[k] = 1; return o; }, {})) }); this.sfx('pop'); };
    if (!aw || Motion.reduced || verts.some((v) => !v)) { show(keys); this.tm(end, 2600); return; }
    const o = this.boardToStage({ x: 0, y: 0 }), u = this.boardToStage({ x: 100, y: 0 }), k = Math.hypot(u.x - o.x, u.y - o.y) / 100; // board px -> stage px
    aw.start({
      verts: verts, home: this.homeBody(), homeEl: document.querySelector('.stage .swiftee'), colors: [PAL.vA, PAL.vB, PAL.vC, PAL.vD],
      radiusAt: (i) => ((this.arcR && this.arcR[keys[i]]) || 24) * k, // the angle mark's own radius
      labelPx: 21, // its value's size (css .tag.alab: 21 px on screen at any zoom)
      labelAt: (i) => (this.alabAt && this.alabAt[keys[i]] ? this.boardToStage(this.alabAt[keys[i]]) : null), // where its size lands
      onReading: (i) => { if (live()) { show([keys[i]]); this.emphasize(['a' + keys[i]]); } },
      onDone: () => { if (live()) { this.pose(this.restPose()); this.tm(end, 200); } }
    });
  }
  angleWalker() {
    if (typeof document === 'undefined' || !window.AngleWalker || !window.AngleMeasuringFrames || !document.querySelector('.angle-walk')) return null;
    return this.aw || (this.aw = new window.AngleWalker());
  }
  // where Swiftee stands (her torso's centre, stage px) and her size there against her size with the protractor:
  // where the protractor walk starts and ends
  homeBody() {
    const el = typeof document !== 'undefined' && document.querySelector('.stage .swiftee .swiftee-still'), b = el && this.elBox(el);
    const k = CONFIG.angleWalk.homeK * (b ? b.h / 198 : 1); // homeK is for her full size (the still is 198 px tall)
    return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 + 14 * b.h / 198, k: k } : { x: CONFIG.walker.homeX + 3, y: CONFIG.walker.homeY - 95, k: k };
  }


  // ---------- geometry ----------
  dist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }
  // a parallelogram: the top side is as long as the bottom one (both stay level, so then BC is parallel to AD too)
  isPg(P) { return Math.abs((P.B.x - P.A.x) - (P.C.x - P.D.x)) < 1; }
  nb(k) { return { A: ['D', 'B'], B: ['A', 'C'], C: ['B', 'D'], D: ['C', 'A'] }[k]; }
  angle(P, k) {
    const n = this.nb(k), V = P[k], p = P[n[0]], q = P[n[1]];
    const ux = p.x - V.x, uy = p.y - V.y, vx = q.x - V.x, vy = q.y - V.y;
    const c = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
  }
  vals(P) {
    const a = Math.round(this.angle(P, 'A')), b = Math.round(this.angle(P, 'B'));
    return { A: a, D: 180 - a, B: b, C: 180 - b };
  }
  cm(px) {
    const v = Math.round((px / this.S) * 10) / 10;
    return (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1)) + ' cm';
  }
  inter(A, D, B, C) {
    const x1 = A.x, y1 = A.y, x2 = D.x, y2 = D.y, x3 = B.x, y3 = B.y, x4 = C.x, y4 = C.y;
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-6) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  }
  toSvg(svg, e) {
    try {
      const m = svg.getScreenCTM();
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(m.inverse());
    } catch (err) { return null; }
  }
  // the corner the learner can drag: B, until BC is parallel to AD
  dragKey() { return this.cur().task === 'dragB' && !this.state.done ? 'B' : null; }
  // ---------- lesson interactions ----------
  // tapEq: tap the corner whose angle equals the one named (want); a wrong corner gets the screen's tip
  tapVertex(k) {
    const st = this.cur(), s = this.state;
    if (s.done || this.busy() || st.task !== 'tapEq') return;
    if (k === st.ref || s.ang[k]) return;
    if (k !== st.want) return this.oops(st.wrong);
    this.setState({ ang: Object.assign({}, s.ang, { [k]: true }) });
    this.sfx('pop');
    this.tm(() => this.finishTask(), 250);
  }
  down(k, e) {
    if (this.cur().task === 'connect') return this.connDown(k, e);
    if (this.dragKey() !== k || this.busy()) return;
    const svg = e.currentTarget && e.currentTarget.ownerSVGElement;
    if (!svg) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    if (e.preventDefault) e.preventDefault();
    this.drag = { k: k, svg: svg, x0: this.state.P[k].x };
    this.touched = true; // the learner has started: no more demo hand
    if (this.handId) { clearTimeout(this.handId); this.T.delete(this.handId); this.handId = null; }
    this.setState({ dragging: k, hand: null });
    this.sfx('tap');
  }
  // B slides along the top side (the bases stay parallel), past C if need be - that is how the trapezium becomes a
  // parallelogram - within limits that keep the shape readable
  move(e) {
    if (!this.drag) return;
    const p = this.toSvg(this.drag.svg, e);
    if (!p) return;
    const P = this.clone(this.state.P), Lm = CONFIG.limits;
    P.B.x = Math.max(P.A.x + Lm.minTop, P.C.x - Lm.maxLegRun, Math.min(Lm.maxTopX, P.C.x + Lm.maxLegRun, p.x));
    const tx = P.C.x + (P.A.x - P.D.x); // near the parallel place B holds there while still held
    if (Math.abs(P.B.x - tx) < CONFIG.snap.parallelPx) P.B.x = tx;
    if (Math.abs(P.B.x - this.drag.x0) > 25) this.drag.moved = true; // (this drag's own travel: a plain tap gets no tip)
    this.setState({ P: P, moved: this.state.moved || !!this.drag.moved });
  }
  up() {
    if (this.conn && this.conn.live) return;
    if (!this.drag) return;
    const moved = !!this.drag.moved;
    this.drag = null;
    this.setState({ dragging: null });
    this.checkDrag(moved);
  }
  // dragB: close enough to BC ∥ AD snaps into the parallelogram; otherwise a tip says which way to go
  checkDrag(moved) {
    const st = this.cur(), s = this.state, P = this.clone(s.P);
    if (st.task !== 'dragB' || s.done) return;
    const tx = P.C.x + (P.A.x - P.D.x); // where B makes BC parallel to AD
    if (Math.abs(P.B.x - tx) < CONFIG.snap.parallelPx) {
      P.B.x = tx;
      this.setState({ P: P });
      this.finishTask();
    } else if (moved) {
      this.oops(P.B.x < tx ? 'BC is not parallel to AD yet. Keep dragging B to the right.' : 'B went too far. Drag it back a little.', null);
    }
  }

  // ---------- CFU ----------
  pick(o) {
    const st = this.cur(), s = this.state;
    if (s.done || s.picks[o.id] || this.busy()) return;
    const picks = Object.assign({}, s.picks);
    if (st.multi && o.ok) {
      picks[o.id] = 'good';
      const need = st.opts.filter((x) => x.ok && x.req !== false), all = need.every((x) => picks[x.id]);
      this.setState({ picks: picks });
      if (!all) { // right, more to find: a soft confirmation, no fanfare yet
        this.sfx('pop');
        if (o.fb) this.interject({ m: CONFIG.swiftee.praise, t: o.fb });
        this.poke();
        return;
      }
      const results = Object.assign({}, s.results);
      if (results[st.id] === undefined && !st.practice) results[st.id] = s.cfuFirst;
      this.setState({ done: true, results: results, chips: st.okChips || s.chips });
      this.cheer();
      this.interject({ m: CONFIG.swiftee.correct, t: st.ok });
    } else if (o.ok) {
      picks[o.id] = 'good';
      const results = Object.assign({}, s.results);
      if (results[st.id] === undefined && !st.practice) results[st.id] = s.cfuFirst;
      this.setState({ picks: picks, done: true, results: results, chips: st.okChips || s.chips });
      this.cheer();
      this.interject({ m: CONFIG.swiftee.correct, t: st.ok });
      this.okGlow(st);
    } else {
      picks[o.id] = 'bad';
      this.setState({ picks: picks, cfuFirst: false });
      this.sfx('bad');
      this.interject({ m: CONFIG.swiftee.wrong, t: o.fb });
      this.poke();
    }
  }
  // ---------- draw the diagonals (task 'connect') ----------
  // drag from a corner to the opposite corner (or tap one corner, then the other); a side gets a gentle tip
  opp(k) { return { A: 'C', C: 'A', B: 'D', D: 'B' }[k]; }
  diagKey(a, b) { return (a === 'A' || b === 'A') ? 'AC' : 'BD'; }
  connDown(k, e) {
    const s = this.state;
    if (s.done || this.busy()) return;
    const svg = e.currentTarget && e.currentTarget.ownerSVGElement;
    if (e.preventDefault) e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    this.touched = true; this.hideHand();
    // a corner picked by a tap a moment ago: this tap finishes the line
    if (this.conn && !this.conn.live && this.conn.from !== k) { const from = this.conn.from; this.conn = null; this.setState({ conn: null }); this.connTo(from, k); return; }
    const p = this.shapeP()[k];
    this.conn = { from: k, live: true, svg: svg, moved: false };
    this.setState({ conn: { from: k, x: p.x, y: p.y } });
    this.sfx('tap');
  }
  connMove(e) {
    const c = this.conn, p = c && c.svg ? this.toSvg(c.svg, e) : (e && e.x != null ? { x: e.x, y: e.y } : null);
    if (!p) return;
    // a finger's jitter on a tap is not a drag: it counts as moved only once it leaves the corner
    const o = this.shapeP()[c.from];
    if (!c.moved && o && Math.hypot(p.x - o.x, p.y - o.y) < 14) return;
    c.moved = true;
    this.setState({ conn: { from: c.from, x: p.x, y: p.y } });
  }
  connUp(e) {
    const c = this.conn, P = this.shapeP();
    const p = (c.svg && e && e.clientX != null ? this.toSvg(c.svg, e) : null) || (this.state.conn && { x: this.state.conn.x, y: this.state.conn.y });
    const hit = ['A', 'B', 'C', 'D'].find((k) => k !== c.from && p && Math.hypot(P[k].x - p.x, P[k].y - p.y) < 40);
    if (hit) { this.conn = null; this.setState({ conn: null }); this.connTo(c.from, hit); return; }
    // released on its own corner (a tap): keep it picked until the next corner is tapped
    this.conn = c.moved ? null : { from: c.from, live: false };
    this.setState({ conn: c.moved ? null : { from: c.from, x: P[c.from].x, y: P[c.from].y } });
  }
  connTo(a, b) {
    const s = this.state;
    if (this.opp(a) !== b) { this.oops(this.cur().wrong); return; }
    const k = this.diagKey(a, b);
    if (s.diag[k]) return;
    const diag = Object.assign({}, s.diag, { [k]: 1 });
    this.setState({ diag: diag });
    this.sfx('snap');
    if (diag.AC && diag.BD) this.tm(() => this.finishTask(), 300);
  }

  // ---------- fill / match checks ----------
  // Number (or segment) tiles go into blanks: drag a tile onto a blank, or tap it to fill the highlighted blank.
  // When every blank is full they are checked; right ones lock, wrong ones slide back out with a tip.
  fillDef() { return this.cur().fill; }
  activeBlank() {
    const F = this.state.fill, D = this.fillDef();
    if (F.sel && !F.at[F.sel]) return F.sel;
    const b = D.blanks.find((x) => !F.at[x.id]);
    return b ? b.id : null;
  }
  tileUsed(t) { const D = this.fillDef(), F = this.state.fill; return !!D.match && Object.keys(F.at).some((k) => F.at[k] === t); }
  tileDown(t, e) {
    const F = this.state.fill;
    if (this.state.done || F.checking || this.busy() || this.tileUsed(t)) return;
    const tgt = e.currentTarget, root = tgt && tgt.closest ? tgt.closest('.stage') : null;
    if (e.preventDefault) e.preventDefault();
    this.touched = true; this.hideHand();
    if (!root) { this.fd = { t: t, moved: false }; return; }
    const r = root.getBoundingClientRect(), sc = r.width / 1280 || 1;
    try { tgt.setPointerCapture(e.pointerId); } catch (err) {}
    this.fd = { t: t, r: r, sc: sc, sx: e.clientX, sy: e.clientY, moved: false };
  }
  tileMove(e) {
    const D = this.fd;
    if (!D.r) return;
    if (!D.moved && Math.hypot(e.clientX - D.sx, e.clientY - D.sy) < 6) return;
    D.moved = true;
    this.setState({ fill: Object.assign({}, this.state.fill, { drag: { t: D.t, x: (e.clientX - D.r.left) / D.sc, y: (e.clientY - D.r.top) / D.sc } }) });
  }
  tileUp(e) {
    const D = this.fd;
    this.fd = null;
    this.setState({ fill: Object.assign({}, this.state.fill, { drag: null }) });
    if (!D.moved) { const b = this.activeBlank(); if (b) this.fillBlank(b, D.t); return; } // a tap fills the highlighted blank
    let el = null;
    try { el = (document.elementsFromPoint(e.clientX, e.clientY) || []).find((x) => x.getAttribute && x.getAttribute('data-blank')); } catch (err) {}
    if (el) this.fillBlank(el.getAttribute('data-blank'), D.t);
  }
  // ---------- dropdown answers (number blanks: fill without match) ----------
  // A blank is a box with a chevron; a tap opens one menu of the screen's choices (fill.tiles) under it (above it when
  // there is no room). Picking a value closes the menu and checks that blank at once: right - it locks with a soft
  // green pulse and the correct sound; wrong - an orange outline, a small shake, the tip, and the box empties for
  // another try. The screen is done when every blank is right. Nothing shows until the question has been asked.
  isDropdown() { const D = this.fillDef(); return !!(D && !D.match); }
  ddOpen(id) {
    const F = this.state.fill, D = this.fillDef();
    if (this.state.done || F.checking || F.locked[id] || this.busy()) return;
    if (F.open === id) { this.ddClose(); return; }
    let x = 0, y = 0, up = false, w = 120;
    const n = D.tiles.length, h = n * CONFIG.dropdown.itemH + 12;
    if (typeof document !== 'undefined') {
      const el = document.querySelector('[data-blank="' + id + '"]'), st = document.querySelector('.stage');
      if (el && st) {
        const r = el.getBoundingClientRect(), sr = st.getBoundingClientRect(), k = sr.width / 1280 || 1;
        const top = (r.top - sr.top) / k, bot = (r.bottom - sr.top) / k;
        w = Math.max(r.width / k, CONFIG.dropdown.minW); x = (r.left - sr.left) / k + r.width / k / 2 - w / 2;
        up = bot + 6 + h > CONFIG.dropdown.maxBottom; y = up ? top - 6 - h : bot + 6;
      }
    }
    this.touched = true; this.hideHand();
    this.setState({ fill: Object.assign({}, F, { open: id, closing: false, menu: { x: Math.round(x), y: Math.round(y), w: Math.round(w), up: up } }) });
    this.sfx('tap');
  }
  ddClose(then) {
    const F = this.state.fill;
    if (!F.open) { if (then) then(); return; }
    const tok = this.stepTok;
    this.setState({ fill: Object.assign({}, F, { closing: true }) });
    this.tm(() => { if (tok !== this.stepTok) return; this.setState({ fill: Object.assign({}, this.state.fill, { open: null, closing: false }) }); if (then) then(); }, Motion.reduced ? 0 : CONFIG.dropdown.closeMs);
  }
  pickBlank(id, t) {
    const st = this.cur(), D = this.fillDef(), F = this.state.fill, b = D.blanks.find((x) => x.id === id);
    if (!b || F.locked[id] || F.checking || this.state.done) return;
    const at = Object.assign({}, F.at, { [id]: t });
    if (t === b.ans) {
      const locked = Object.assign({}, F.locked, { [id]: true });
      this.setState({ fill: Object.assign({}, F, { at: at, locked: locked, bad: {}, open: null, closing: false }) });
      if (D.blanks.every((x) => locked[x.id])) {
        const s = this.state, results = Object.assign({}, s.results);
        if (results[st.id] === undefined && !st.practice && st.cp) results[st.id] = s.cfuFirst;
        this.setState({ done: true, results: results, chips: st.okChips || s.chips });
        this.cheer();
        this.interject({ m: CONFIG.swiftee.correct, t: st.ok });
      } else { this.sfx('snap'); this.poke(); }
      return;
    }
    // wrong: the value shows briefly in an orange box that shakes, the tip plays, then the box empties for a retry
    this.setState({ fill: Object.assign({}, F, { at: at, bad: { [id]: true }, checking: true, open: null, closing: false }), cfuFirst: false });
    this.sfx('bad');
    this.interject({ m: CONFIG.swiftee.wrong, t: (D.fb && (D.fb[t] || D.fb.any)) || 'Not quite. Try again.' });
    const tok = this.stepTok;
    this.tm(() => {
      if (tok !== this.stepTok) return;
      const F2 = this.state.fill, at2 = Object.assign({}, F2.at); delete at2[id];
      this.setState({ fill: Object.assign({}, F2, { at: at2, bad: {}, checking: false }) });
      this.poke();
    }, CONFIG.dropdown.wrongMs);
  }
  blankTap(id) {
    if (this.isDropdown()) { this.ddOpen(id); return; }
    const F = this.state.fill;
    if (this.state.done || F.checking || F.locked[id] || this.busy()) return;
    const at = Object.assign({}, F.at); delete at[id]; // tapping a filled blank empties it again
    this.setState({ fill: Object.assign({}, F, { at: at, sel: id }) });
    this.sfx('tap');
  }
  fillBlank(id, t) {
    if (this.isDropdown()) { this.pickBlank(id, t); return; } // (tests and older callers: a value for a dropdown)
    const F = this.state.fill, D = this.fillDef();
    if (F.locked[id] || F.checking || this.state.done) return;
    const at = Object.assign({}, F.at);
    if (D.match) Object.keys(at).forEach((k) => { if (at[k] === t) delete at[k]; }); // a segment sits in one place only
    at[id] = t;
    this.setState({ fill: Object.assign({}, F, { at: at, sel: null, bad: {} }) });
    this.sfx('pop');
    if (D.blanks.every((b) => at[b.id])) {
      this.setState({ fill: Object.assign({}, this.state.fill, { checking: true }) });
      const tok = this.stepTok;
      this.tm(() => { if (tok === this.stepTok) this.checkFill(); }, 420);
    }
  }
  // which blanks are right: a fill blank holds its answer; a match pair holds one of the equal pairs (either order)
  fillRight(at) {
    const D = this.fillDef(), ok = {};
    if (!D.match) { D.blanks.forEach((b) => { ok[b.id] = at[b.id] === b.ans; }); return ok; }
    const groups = {};
    D.blanks.forEach((b) => { (groups[b.pair] = groups[b.pair] || []).push(b.id); });
    Object.keys(groups).forEach((g) => {
      const v = groups[g].map((id) => at[id]).sort().join('|');
      const good = D.pairs.some((pr) => pr.slice().sort().join('|') === v);
      groups[g].forEach((id) => { ok[id] = good; });
    });
    return ok;
  }
  checkFill() {
    const st = this.cur(), s = this.state, D = this.fillDef(), F = s.fill;
    const ok = this.fillRight(F.at), at = Object.assign({}, F.at), locked = Object.assign({}, F.locked), bad = {};
    let wrongTile = null;
    D.blanks.forEach((b) => { if (ok[b.id]) locked[b.id] = true; else { bad[b.id] = true; wrongTile = wrongTile || at[b.id]; } });
    if (D.blanks.every((b) => ok[b.id])) {
      const results = Object.assign({}, s.results);
      if (results[st.id] === undefined && !st.practice && st.cp) results[st.id] = s.cfuFirst;
      this.setState({ fill: Object.assign({}, F, { locked: locked, checking: false }), done: true, results: results, chips: st.okChips || s.chips });
      this.cheer();
      this.interject({ m: CONFIG.swiftee.correct, t: st.ok });
      return;
    }
    // wrong blanks wobble orange, then empty again for another try
    this.setState({ fill: Object.assign({}, F, { locked: locked, bad: bad, checking: true }), cfuFirst: false });
    this.sfx('bad');
    const fb = (D.fb && (D.fb[wrongTile] || D.fb.any)) || 'Not quite. Try again.';
    this.interject({ m: CONFIG.swiftee.wrong, t: fb });
    const tok = this.stepTok;
    this.tm(() => {
      if (tok !== this.stepTok) return;
      const F2 = this.state.fill, at2 = Object.assign({}, F2.at);
      Object.keys(bad).forEach((k) => delete at2[k]);
      this.setState({ fill: Object.assign({}, F2, { at: at2, bad: {}, checking: false }) });
      this.poke();
    }, 900);
  }
  // the pointer over the whole stage: a diagonal being drawn, a tile being dragged, or corner B
  rootMove(e) {
    if (this.conn && this.conn.live) return this.connMove(e);
    if (this.fd) return this.tileMove(e);
    if (this.drag) return this.move(e);
  }
  rootUp(e) {
    if (this.conn && this.conn.live) return this.connUp(e);
    if (this.fd) return this.tileUp(e);
    if (this.drag) return this.up(e);
  }

  // ---------- render ----------
  geo() {
    const s = this.state, st = this.cur(), fig = st.fig || null, P = this.shapeP(), task = st.task;
    const f = fig ? { diag: fig.diag, O: fig.diag, ticks: fig.ticks, hticks: fig.hticks, arcs: Object.keys(fig.angles || {}).join('') } : this.fl();
    const A = P.A, B = P.B, C = P.C, D = P.D;
    const dsp = (b) => (b ? 'inline' : 'none');
    const r1 = (v) => Math.round(v * 10) / 10;
    const seg = (p, q, show, extra) => Object.assign({ x1: r1(p.x), y1: r1(p.y), x2: r1(q.x), y2: r1(q.y), d: dsp(show) }, extra || {});
    const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    const noop = () => {};
    const g = {};
    const zs = this.sceneFit(st).k || 1; // the board's zoom: angle marks and their values keep one size on screen
    g.poly = [A, B, C, D].map((p) => r1(p.x) + ',' + r1(p.y)).join(' ');
    const said = (k) => !!(s.glow && s.glow.indexOf(k) >= 0);
    const act = task === 'measure' ? this.activeSide() : null;
    const meas = (k) => task === 'measure' && (!!s.tap[k] || s.measuring === k);
    // A highlighted side ("lit": named by a line's glow or a word cue, or being measured) is drawn bolder and gets the
    // marker (hlCls, below); while only some sides are lit the others step back (.edge.dim). All four lit (the whole
    // outline named): nothing steps back.
    const lit = {};
    ['DA', 'BC', 'AB', 'CD'].forEach((k) => { lit[k] = said(k) || (!st.auto && (act === k || meas(k))); });
    const nLit = ['AB', 'BC', 'CD', 'DA'].filter((k) => lit[k]).length;
    {
      const tp = s.tape, ends = tp ? this.walkEnds(tp.leg) : null;
      if (ends) {
        const L = this.dist(ends[0], ends[1]) || 1, ux = (ends[1].x - ends[0].x) / L, uy = (ends[1].y - ends[0].y) / L;
        // as in Fishing Frenzy's lesson: the tape lies along the side on the side Swiftee is standing on (she walks upright,
        // so that is the screen-up side), from the start corner under her feet up into her hand, never crossing the line
        let nx = -uy, ny = ux; if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
        const off = 6, p0 = { x: ends[0].x + nx * off, y: ends[0].y + ny * off };
        const foot = { x: p0.x + ux * L * tp.t, y: p0.y + uy * L * tp.t }, tip = tp.tip || foot;
        g.tape = { p: 'M' + r1(p0.x) + ',' + r1(p0.y) + ' L' + r1(foot.x) + ',' + r1(foot.y) + ' L' + r1(tip.x) + ',' + r1(tip.y), d: 'inline' };
        let tk = '';
        for (let hh = 0; hh * this.S / 2 <= L * tp.t + 0.01; hh++) { // ticks every half cm across the tape
          const q = { x: p0.x + ux * hh * this.S / 2, y: p0.y + uy * hh * this.S / 2 }, len = hh % 2 ? 2.5 : 4.5;
          tk += 'M' + r1(q.x - nx * len) + ',' + r1(q.y - ny * len) + ' L' + r1(q.x + nx * len) + ',' + r1(q.y + ny * len) + ' ';
        }
        g.tapeTk = { p: tk || 'M0,0', d: 'inline' };
      } else {
        g.tape = { p: 'M0,0', d: 'none' }; g.tapeTk = { p: 'M0,0', d: 'none' };
      }
    }
    // the pen drawing the outline on screen 1 (runBuild, below)
    g.trace = seg(D, D, false, { cls: 'trace' });
    // shape colours, as in Fishing Frenzy's lesson (CONFIG.palette): the bases AB, CD always blue; the legs AD, BC blue
    // until the parallel pair has been found, then teal for good - the trapezium's legs, then (once the drag makes a
    // parallelogram) the second pair - so a screen without arrows never turns them back to blue. PU: a corner to drag
    const PAL = CONFIG.palette, PU = '#00b8a9', pgShape = this.isPg(P);
    const legsPlain = !!f.par && !f.par2 && !pgShape;
    const pair2 = !!f.par2 || pgShape;
    const baseCol = () => PAL.line;
    const legCol = () => (pair2 ? PAL.pair2 : legsPlain ? PAL.slate : PAL.line);
    // emph (named in the voice-over), lit / dim (the named sides lead, the others step back)
    const eCls = (k) => 'e' + k + (s.emph && s.emph[k] ? ' emph' : '') + (lit[k] ? ' lit' : nLit && nLit < 4 ? ' dim' : '');
    // build (screen 1): the shape draws itself while Swiftee talks - empty panel, then a glowing pink pen runs
    // D->A->B->C->D in one continuous stroke, leaving each finished edge behind; corners (dot + letter) appear as
    // the pen reaches them. Then a soft glow settles round the outline and the fill fades in (s.build, runBuild).
    const bd = st.build ? (s.build || { d: 0 }) : null, building = !!(bd && !bd.done);
    const bOrder = [['DA', D, A], ['AB', A, B], ['BC', B, C], ['CD', C, D]], bAt = {};
    { let acc = 0; bOrder.forEach((e) => { const L = this.dist(e[1], e[2]); bAt[e[0]] = { s: acc, L: L, p: e[1], q: e[2] }; acc += L; }); }
    const edgeOn = (k) => !building || bd.d >= bAt[k].s + bAt[k].L - 0.01;
    const vOn = (k) => !building || (k === 'D' ? bd.d > 0 : bd.d >= bAt[{ A: 'AB', B: 'BC', C: 'CD' }[k]].s - 0.01);
    if (building && bd.d > 0) {
      const cur = bOrder.map((e) => bAt[e[0]]).find((e) => bd.d < e.s + e.L) || bAt.CD;
      g.trace = seg(cur.p, lerp(cur.p, cur.q, Math.min(1, (bd.d - cur.s) / cur.L)), true, { cls: 'trace' });
    }
    g.ol = { d: dsp(!!(bd && bd.settle) || !!st.assemble) };
    // the named side (as in Fishing Frenzy's lesson): a sunflower-yellow marker redraws it, a glowing pen tip running
    // ahead of it, while the side is lit or the voice names it (css .hl / .hlp)
    const hlCls = (k) => 'hl' + ((lit[k] || (s.emph && s.emph[k])) && edgeOn(k) ? ' on' : '');
    g.eAB = seg(A, B, edgeOn('AB'), { c: baseCol('AB'), cls: eCls('AB'), hl: hlCls('AB') });
    g.eCD = seg(C, D, edgeOn('CD'), { c: baseCol('CD'), cls: eCls('CD'), hl: hlCls('CD') });
    g.eBC = seg(B, C, edgeOn('BC'), { c: legCol('BC'), cls: eCls('BC'), hl: hlCls('BC') });
    g.eDA = seg(D, A, edgeOn('DA'), { c: legCol('DA'), cls: eCls('DA'), hl: hlCls('DA') });
    // the marker draws one way for every side: up a leg, left to right along a base
    ['AB', 'BC', 'CD', 'DA'].forEach((k) => {
      const e = g['e' + k], steep = Math.abs(e.y2 - e.y1) > Math.abs(e.x2 - e.x1), flip = steep ? e.y1 < e.y2 : e.x1 > e.x2;
      Object.assign(e, flip ? { h1x: e.x2, h1y: e.y2, h2x: e.x1, h2y: e.y1 } : { h1x: e.x1, h1y: e.y1, h2x: e.x2, h2y: e.y2 });
    });
    // a tick mark across the middle of p->q (one, or two side by side), for the diagonals' equal halves: the sides'
    // own ticks (CONFIG.marks)
    const ad = this.dist(A, D), bc = this.dist(B, C), MK = CONFIG.marks;
    const tick = (p, q, one) => {
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, L = this.dist(p, q) || 1;
      const dx = (q.x - p.x) / L, dy = (q.y - p.y) / L, nx = -dy, ny = dx;
      let out = '';
      (one ? [0] : [-MK.tickStep / 2, MK.tickStep / 2]).forEach((k) => {
        const cx = mx + dx * k, cy = my + dy * k;
        out += 'M' + r1(cx - nx * MK.tickHalf) + ',' + r1(cy - ny * MK.tickHalf) + ' L' + r1(cx + nx * MK.tickHalf) + ',' + r1(cy + ny * MK.tickHalf) + ' ';
      });
      return out;
    };
    // ---- side markings: Fishing Frenzy's lesson's own marks (CONFIG.marks), from the vertices ----
    // For every side: the true midpoint m, the unit vector u along the side and n across it. Parallel arrows are open
    // orange chevrons on a white halo (index.html), 11 deep and 22 tall, pointing along u - the same way on both sides of
    // a pair (A->B and D->C, D->A and C->B): two back to back on AB, CD and one on AD, BC. Equal-length ticks are navy
    // strokes 24 long across the side: one on AB, CD and two on AD, BC. A side carrying both has its arrows MK.gap before
    // the midpoint and its ticks MK.gap after it; a side carrying one kind has it centred on the midpoint. Rebuilt every
    // frame from the vertices, so the marks stay on their sides through drags and moves.
    const pgNow = this.isPg(P);
    const showPar1 = !!f.par, showPar2 = !!(f.par2 || (task === 'dragB' && pgNow));
    const showTk = !!f.ticks;
    const SIDES = { AB: [A, B], CD: [D, C], DA: [D, A], BC: [C, B] };
    const nArrows = { AB: showPar1 ? 2 : 0, CD: showPar1 ? 2 : 0, DA: showPar2 ? 1 : 0, BC: showPar2 ? 1 : 0 };
    // a parallelogram's top and bottom are equal too (one tick); a trapezium's equal legs get theirs alone (two)
    const nTicks = { AB: showTk && pgNow ? 1 : 0, CD: showTk && pgNow ? 1 : 0, DA: showTk ? 2 : 0, BC: showTk ? 2 : 0 };
    const frame = (k) => {
      const p = SIDES[k][0], q = SIDES[k][1], L = this.dist(p, q) || 1, ux = (q.x - p.x) / L, uy = (q.y - p.y) / L;
      return { mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, ux: ux, uy: uy, nx: -uy, ny: ux };
    };
    const at = (F, d) => ({ x: F.mx + F.ux * d, y: F.my + F.uy * d });
    const arrows = (k) => {
      const n = nArrows[k]; if (!n) return '';
      const F = frame(k), c0 = nTicks[k] ? -MK.gap : 0;
      let out = '';
      for (let i = 0; i < n; i++) {
        const c = at(F, c0 + (i - (n - 1) / 2) * MK.arrowStep), tip = { x: c.x + F.ux * MK.arrowDepth, y: c.y + F.uy * MK.arrowDepth };
        const back = { x: c.x - F.ux * MK.arrowDepth, y: c.y - F.uy * MK.arrowDepth };
        out += 'M' + r1(back.x + F.nx * MK.arrowWing) + ',' + r1(back.y + F.ny * MK.arrowWing) + ' L' + r1(tip.x) + ',' + r1(tip.y) +
          ' L' + r1(back.x - F.nx * MK.arrowWing) + ',' + r1(back.y - F.ny * MK.arrowWing) + ' ';
      }
      return out;
    };
    const ticks = (k) => {
      const n = nTicks[k]; if (!n) return '';
      const F = frame(k), c0 = nArrows[k] ? MK.gap : 0;
      let out = '';
      for (let i = 0; i < n; i++) {
        const c = at(F, c0 + (i - (n - 1) / 2) * MK.tickStep);
        out += 'M' + r1(c.x - F.nx * MK.tickHalf) + ',' + r1(c.y - F.ny * MK.tickHalf) + ' L' + r1(c.x + F.nx * MK.tickHalf) + ',' + r1(c.y + F.ny * MK.tickHalf) + ' ';
      }
      return out;
    };
    const tkPath = ticks('AB') + ticks('CD') + ticks('DA') + ticks('BC');
    g.tk = { p: tkPath || 'M0,0', d: dsp(!!tkPath) };
    // (gx, gy: the arrows glide onto their sides the way they point, as Fishing Frenzy's do: css .par-ch)
    const glide = (k) => { const F = frame(k); return { gx: r1(-F.ux * 40) + 'px', gy: r1(-F.uy * 40) + 'px' }; };
    g.ch = Object.assign({ p: (arrows('AB') + arrows('CD')) || 'M0,0', d: dsp(showPar1) }, glide('AB'));
    g.ch2 = Object.assign({ p: (arrows('DA') + arrows('BC')) || 'M0,0', d: dsp(showPar2) }, glide('DA'));
    // diagonals AC and BD (drawn by the pen on the diags screen, then shown by f.diag) and their meeting point O
    const O = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 }, O0 = () => O;
    g.dAC = seg(A, C, !!(f.diag || s.diag.AC));
    g.dBD = seg(B, D, !!(f.diag || s.diag.BD));
    // split: the four halves in four colours; halfPairs: the equal halves share a colour (OA, OC pink; OB, OD blue)
    {
      const HC = f.halfPairs ? { A: PAL.vA, C: PAL.vA, B: PAL.vB, D: PAL.vB } : { A: PAL.vA, B: PAL.vB, C: PAL.vC, D: PAL.vD };
      const on = !!(f.split || f.halfPairs);
      ['A', 'B', 'C', 'D'].forEach((k) => { g['h' + k] = seg(O0(), P[k], on, { c: HC[k], cls: 'hseg' + (f.halfPairs ? ' pr' : '') }); });
    }
    // connect: the line follows the finger from the picked corner
    g.cn = s.conn ? seg(P[s.conn.from], { x: s.conn.x, y: s.conn.y }, true) : seg(A, A, false);
    // supp: two adjacent angles side by side on one straight line, drawn as Fishing Frenzy's lesson draws it (suppAt).
    // For the pair XY the demo sits at Y: side ZY carried on past Y (dashed, in the bases' blue: along a base it runs
    // out 80 px, up or down a leg just past the angle, clear of the plate and the name tags), Y's own angle, and a copy
    // of X's angle that slides down the side from X and makes a half-turn onto the line beside it; a gold rim then draws
    // round the half-disc the two make, with its "180°". Both angles 38 px on screen at any zoom, in their wedges'
    // colours. (css .supp-*: sA / sB restart it for each pair)
    let s180 = null;
    {
      const pair = f.supp && s.supp != null ? f.supp[s.supp] : null;
      if (pair) {
        const X = pair[0], Y = pair[1], Z = this.nb(Y).find((k) => k !== X), Py = P[Y], Rr = 38 / zs;
        const un = (p, q) => { const L = this.dist(p, q) || 1; return { x: (q.x - p.x) / L, y: (q.y - p.y) / L }; };
        const toX = un(Py, P[X]), toZ = un(Py, P[Z]), ext = { x: -toZ.x, y: -toZ.y };
        const wedge = (a, b) => { const cr = a.x * b.y - a.y * b.x;
          return 'M' + r1(Py.x) + ',' + r1(Py.y) + ' L' + r1(Py.x + a.x * Rr) + ',' + r1(Py.y + a.y * Rr) + ' A' + r1(Rr) + ',' + r1(Rr) + ' 0 0 ' + (cr > 0 ? 1 : 0) + ' ' + r1(Py.x + b.x * Rr) + ',' + r1(Py.y + b.y * Rr) + ' Z'; };
        const col = (k) => PAL['v' + (f.pairCol ? { A: 'A', C: 'A', B: 'B', D: 'B' }[k] : k)]; // the wedges' own colours
        const L = Math.abs(ext.y) < 0.5 ? 80 : Rr + 22 / zs, side = ext.x * toX.y - ext.y * toX.x, sk = s.supp % 2 ? 'sB' : 'sA';
        const a0 = { x: Py.x + ext.x * Rr, y: Py.y + ext.y * Rr }, a1 = { x: Py.x + toZ.x * Rr, y: Py.y + toZ.y * Rr };
        g.sp = { d: 'inline', line: 'M' + r1(Py.x) + ',' + r1(Py.y) + ' L' + r1(Py.x + ext.x * L) + ',' + r1(Py.y + ext.y * L),
          own: wedge(toX, toZ), cOwn: col(Y), copy: wedge(toX, ext), cCopy: col(X), o: r1(Py.x) + 'px ' + r1(Py.y) + 'px',
          rim: 'M' + r1(a0.x) + ',' + r1(a0.y) + ' A' + r1(Rr) + ',' + r1(Rr) + ' 0 0 ' + (side > 0 ? 1 : 0) + ' ' + r1(a1.x) + ',' + r1(a1.y),
          lcls: 'supp-line ' + sk, ocls: 'supp-own ' + sk, cls: 'supp-copy ' + sk, rcls: 'supp-rim ' + sk,
          dx: r1(P[X].x - Py.x) + 'px', dy: r1(P[X].y - Py.y) + 'px' };
        // its "180°": beyond the half-disc, between the line and side YX, outside the shape (21 px on screen)
        let bx = ext.x + toX.x, by = ext.y + toX.y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
        s180 = { t: '180°', x: r1(Py.x + bx * (Rr + 26 / zs)), y: r1(Py.y + by * (Rr + 26 / zs)), cls: 'alab s180 ' + sk };
      } else g.sp = { d: 'none', line: 'M0,0', own: 'M0,0', copy: 'M0,0', rim: 'M0,0', cOwn: PAL.vB, cCopy: PAL.vA, o: '0px 0px', lcls: 'supp-line', ocls: 'supp-own', cls: 'supp-copy', rcls: 'supp-rim', dx: '0px', dy: '0px' };
    }
    g.oDot = { x: r1(O.x), y: r1(O.y), d: dsp(f.O) };
    // hticks: equal halves marked like equal sides (one tick on OA and OC, two on OB and OD)
    g.htk = { p: tick(O, A, true) + tick(O, C, true) + tick(O, B) + tick(O, D), d: dsp(f.hticks) };
    // angles
    const V = this.vals(P);
    const arcSet = (f.arcs || '') + Object.keys(s.angIn || {}).join(''); // angIn: measured with the protractor (screen 24)
    const foundAC = f.pairCol || f.pairA || (task === 'tapEq' && st.ref === 'A' && s.done);
    const foundBD = f.pairCol || (task === 'tapEq' && st.ref === 'D' && s.done);
    const pairCls = (k) => ((k === 'A' || k === 'C') ? (foundAC ? ' pa' : '') : (foundBD ? ' pb' : ''));
    const unit = (p, q) => { const L = this.dist(p, q) || 1; return { x: (q.x - p.x) / L, y: (q.y - p.y) / L }; };
    const aTag = {}, em = s.emph || {}; // parts the voice-over is naming right now
    // angle focus: while a line names angles ("∠A and ∠D..."), the other angles and their values fade back (s.aFocus)
    const aDim = (k) => (s.aFocus && !s.aFocus[k] ? ' dim' : '');
    // Angle marks (as in Fishing Frenzy's lesson): the angle filled in as a wedge in its corner's own colour (A orange,
    // B green, C violet, D amber; once opposite angles are shown equal, A and C share A's and B and D share B's), edged
    // in navy, and its size in a darker shade of that colour. The size rides the interior bisector, pushed out just far
    // enough that its whole box clears both sides and the wedge; a corner too tight for that gets the smaller size.
    // The wedge and its value keep one size on screen whatever the shape's size (zs: the board's zoom), as there: the
    // wedge's radius is CONFIG.angleR(the angle) stage px (+3.5, its rim), clipped to the shape (index.html #shapeClip).
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const n = this.nb(k), Vk = P[k], u = unit(Vk, P[n[0]]), v = unit(Vk, P[n[1]]);
      const cross = u.x * v.y - u.y * v.x;
      const R = CONFIG.angleR(this.angle(P, k)) / zs;
      const RW = R + 3.5 / zs, ws = { x: Vk.x + u.x * RW, y: Vk.y + u.y * RW }, we = { x: Vk.x + v.x * RW, y: Vk.y + v.y * RW };
      (this.arcR = this.arcR || {})[k] = RW; // (screen 24's protractor traces each angle out to its wedge's edge)
      const show = arcSet.indexOf(k) >= 0;
      // when several angles come in together they sweep open one after another (Motion.sweepWedges, by .d0-.d3)
      const stag = (f.arcs || '').length > 1 ? ' d' + (f.arcs || '').indexOf(k) : '';
      g['a' + k] = { p: 'M' + r1(Vk.x) + ',' + r1(Vk.y) + ' L' + r1(ws.x) + ',' + r1(ws.y) + ' A' + r1(RW) + ',' + r1(RW) + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + r1(we.x) + ',' + r1(we.y) + ' Z',
        d: dsp(show), cls: 'wedge k' + k + stag + pairCls(k) + (em['a' + k] ? ' emph' : '') + (fig && s.done ? '' : aDim(k)), o: r1(Vk.x) + 'px ' + r1(Vk.y) + 'px' };
      // its size wears the darker shade of the wedge's colour (lA..lD; equal opposite angles share A's or B's)
      const lk = /\bpa\b/.test(pairCls(k)) ? 'A' : /\bpb\b/.test(pairCls(k)) ? 'B' : k;
      const at = fig ? this.figVal(this.cur(), k, (fig.angles || {})[k] || '') : V[k] + '°';
      // The value sits inside its corner on the angle's bisector, just past the wedge and clear of both sides (as in
      // Fishing Frenzy's lesson): its box (21 px bold text at its 1.2x focus size, in screen px over the zoom) is moved
      // out from the corner until it clears both sides' strokes and the wedge's rim. It is sized by its value at least
      // '110°' wide, so every value sits at the same distance.
      const hw = 1.2 * (Math.max(4, at.length) * 11.5 + 6) / 2 / zs, hh = 1.2 * 14 / zs, sg = 2.5 + 5 / zs;
      const clearOf = (cx, cy) => {
        const sideGap = (w) => Math.abs((cx - Vk.x) * w.y - (cy - Vk.y) * w.x) - (hw * Math.abs(w.y) + hh * Math.abs(w.x));
        const near = Math.hypot(Math.max(0, Math.abs(cx - Vk.x) - hw), Math.max(0, Math.abs(cy - Vk.y) - hh));
        return sideGap(u) >= sg && sideGap(v) >= sg && near >= RW + 8 / zs;
      };
      let bx = u.x + v.x, by = u.y + v.y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
      let dl = RW + 6 / zs; while (dl < 160 && !clearOf(Vk.x + bx * dl, Vk.y + by * dl)) dl += 1 / zs;
      (this.alabAt = this.alabAt || {})[k] = { x: Vk.x + bx * dl, y: Vk.y + by * dl }; // (where screen 24 counts the size up)
      aTag[k] = { t: at, x: r1(Vk.x + bx * dl), y: r1(Vk.y + by * dl), cls: 'alab l' + lk + stag + (show ? '' : ' off') + (at.indexOf('?') >= 0 ? ' q' : fig && ((fig.angles || {})[k] || '').indexOf('?') >= 0 ? ' solved' : '') + (em['a' + k] ? ' emph' : '') + (fig && s.done ? '' : aDim(k)) };
    });
    // vertices
    const dk = this.dragKey();
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const Vk = P[k], drag = dk === k;
      // noDots hides the corner dots, but never the handle of a corner the learner can drag. As in Fishing Frenzy's
      // lesson: white dots ringed in blue; a corner named in the voice-over grows gold with a soft glow (css .vdot.on);
      // the corner to drag is a little bigger, ringed in teal, and pulses until it has been moved (.drag-cue)
      const gold = !!em['v' + k];
      g['v' + k] = { x: r1(Vk.x), y: r1(Vk.y), r: vOn(k) && (!f.noDots || drag) ? (drag ? 9 : 7) + (gold ? 6 : 0) : 0,
        c: gold ? '#ffab00' : drag ? PU : PAL.dot, w: gold || drag ? 4 : 3,
        cls: (gold && vOn(k) ? 'on' : '') + (drag && !s.moved && !s.dragging ? ' drag-cue' : '') };
      const tapV = task === 'tapEq' && !s.done;
      const conn = task === 'connect' && !s.done && !fig;
      const pulse = (tapV && !s.ang[k] && k !== st.ref) || (conn && !(s.conn && s.conn.from === k)); // the corners to try glow
      g['k' + k] = {
        x: r1(Vk.x), y: r1(Vk.y), d: dsp(tapV || drag || conn), cls: pulse && !this.busy() ? 'vp' : '',
        cur: drag ? (s.dragging ? 'grabbing' : 'grab') : 'pointer',
        click: tapV ? () => this.tapVertex(k) : noop,
        down: drag || conn ? (e) => this.down(k, e) : noop
      };
      if (conn && s.conn && s.conn.from === k) g['v' + k].r = 11;
    });
    if (dk) {
      // over a top-side length label the arrow sits left of the corner so both stay readable
      const Vk = P[dk], y0 = r1(Vk.y + (Vk.y < 280 ? -40 : 42)), x = r1(Vk.x - (dk === 'A' && f.sideLen ? 44 : 0));
      g.halo = { x: r1(Vk.x), y: r1(Vk.y), d: dsp(!s.dragging) };
      g.arw = {
        p: 'M' + (x - 26) + ',' + y0 + ' L' + (x + 26) + ',' + y0,
        h: 'M' + (x - 40) + ',' + y0 + ' L' + (x - 27) + ',' + (y0 - 7) + ' L' + (x - 27) + ',' + (y0 + 7) + ' Z M' + (x + 40) + ',' + y0 + ' L' + (x + 27) + ',' + (y0 - 7) + ' L' + (x + 27) + ',' + (y0 + 7) + ' Z',
        d: dsp(!s.moved && !s.dragging)
      };
    } else {
      g.halo = { x: 0, y: 0, d: 'none' };
      g.arw = { p: 'M0,0', h: 'M0,0', d: 'none' };
    }
    // labels: a fixed set of slots (hidden ones get "off") so each tag keeps its element and
    // only animates when it first appears
    const cx = (A.x + B.x + C.x + D.x) / 4, cy = (A.y + B.y + C.y + D.y) / 4;
    const tags = [];
    ['A', 'B', 'C', 'D'].forEach((k) => {
      // as in Fishing Frenzy's lesson: each corner letter sits 28 px outside its corner, mostly above (A, B) or below
      // (C, D) it, so it never lands on a side or its marks
      const Vk = P[k]; let dx = Vk.x - cx, dy = Vk.y - cy;
      { const l0 = Math.hypot(dx, dy) || 1; dx /= l0; dy /= l0; if (Math.abs(dy) < 0.82) { dy = (dy < 0 ? -1 : 1) * 0.82; dx = (dx < 0 ? -1 : 1) * 0.57; } }
      tags.push({ t: k, x: r1(Vk.x + dx * 28), y: r1(Vk.y + dy * 28), cls: 'vlab' + (vOn(k) && !f.noLetters ? '' : ' off') });
    });
    // on a tap-the-corner question an angle's size takes the tap as well as its corner
    if (task === 'tapEq' && !s.done) ['A', 'B', 'C', 'D'].forEach((k) => { if (k !== st.ref && !s.ang[k] && aTag[k] && !/ off\b/.test(aTag[k].cls)) { aTag[k].click = () => this.tapVertex(k); aTag[k].cls += ' tapme'; } });
    ['A', 'B', 'C', 'D'].forEach((k) => tags.push(aTag[k]));
    tags.push(s180 || { t: '180°', x: 0, y: 0, cls: 'alab s180 off' }); // (a fixed slot, so the tags after it keep their elements)
    // O: the diagonals' meeting point, its letter just above it (between the two diagonals)
    tags.push({ t: 'O', x: r1((A.x + C.x) / 2), y: r1((A.y + C.y) / 2 - 26), cls: 'vlab' + (f.O ? '' : ' off') });
    // a checkpoint's half-diagonal labels (e.g. AO = 6 cm): each beside the middle of its own half (clear of its tick),
    // out into a triangle of its own (AO toward AD, BO toward AB, ...), so two never line up under one side
    if (fig && fig.halves) {
      const Om = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
      const found = this.figHalves(this.cur()), H = Object.assign({}, fig.halves, found);
      Object.keys(H).forEach((k) => {
        const into = P[{ A: 'D', B: 'A', C: 'B', D: 'C' }[k]], mx = (P[k].x + Om.x) / 2, my = (P[k].y + Om.y) / 2, L = this.dist(P[k], Om) || 1;
        let nx = -(Om.y - P[k].y) / L, ny = (Om.x - P[k].x) / L;
        if (nx * (into.x - mx) + ny * (into.y - my) < 0) { nx = -nx; ny = -ny; }
        // (clear of the tick across the half's middle: the tick's reach, a gap, then the label's own reach towards it).
        // A label whose box would reach a side of the shape (a thin triangle: BO's on a wide, low figure lay on AB) goes
        // to the half's other side instead, into the next triangle
        const hw = this.textW(H[k], '900 21px Nunito') / 2, hh = 13, off = MK.tickHalf + 8 + hw * Math.abs(nx) + hh * Math.abs(ny);
        const Q = [A, B, C, D], area = Q.reduce((t, p, i) => t + p.x * Q[(i + 1) % 4].y - Q[(i + 1) % 4].x * p.y, 0) > 0 ? 1 : -1;
        const inside = (x, y) => Q.every((p, i) => { const q = Q[(i + 1) % 4], L2 = this.dist(p, q) || 1;
          return area * ((q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x)) / L2 >= 2.5 + 6; }); // past the side's stroke, and a gap
        const fits = (sg) => { const cx = mx + sg * nx * off, cy = my + sg * ny * off; return [[-1, -1], [1, -1], [1, 1], [-1, 1]].every((c) => inside(cx + c[0] * hw, cy + c[1] * hh)); };
        const sg = fits(1) || !fits(-1) ? 1 : -1;
        tags.push({ t: H[k], x: r1(mx + sg * nx * off), y: r1(my + sg * ny * off), cls: 'mtag fig' + (found[k] ? ' solved' : '') });
      });
    }
    // a tag beside a side, pushed out along the side's outward normal far enough that its box clears the line
    // (as in Fishing Frenzy's lesson: the box's reach towards the side plus one small gap, so every label sits the same
    // distance from its side whatever its slope; a base's label also clears the arrows on its middle (+12), and a side
    // carrying arrows or ticks keeps them clear (markGap))
    const marked = (p, q) => { const k = [p, q].map((V) => ['A', 'B', 'C', 'D'].find((x) => P[x] === V)).sort().join('');
      const key = { AB: 'AB', BC: 'BC', CD: 'CD', AD: 'DA' }[k]; return !!(key && (nArrows[key] || nTicks[key])); };
    const side = (p, q, text, cls, show) => {
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, L = this.dist(p, q) || 1;
      let nx = -(q.y - p.y) / L, ny = (q.x - p.x) / L;
      if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
      // the label's own box (css: plain 21px Nunito 900, no padding): half width / half height in board px
      const hw = this.textW(text, '900 21px Nunito') / 2, hh = 13;
      const off = hw * Math.abs(nx) + hh * Math.abs(ny) + CONFIG.marks.labelGap + Math.max(12 * Math.abs(ny), marked(p, q) ? CONFIG.marks.markGap : 0);
      return { t: text, x: r1(mx + nx * off), y: r1(my + ny * off), cls: cls + (show ? '' : ' off') };
    };
    // (the measuring tape carries tick marks only - no numbers; each side's length is shown once, outside the shape)
    const isM = st.task === 'measure';
    // lengths wear their sides' colours, as in Fishing Frenzy: AB, CD blue; AD, BC teal (mleg)
    tags.push(side(D, A, this.cm(ad), 'mtag mleg', isM && !!s.tap.DA)); // values only, no side names
    tags.push(side(B, C, this.cm(bc), 'mtag mleg', isM && !!s.tap.BC));
    tags.push(side(A, B, this.cm(this.dist(A, B)), 'mtag', isM && !!s.tap.AB));
    tags.push(side(D, C, this.cm(this.dist(D, C)), 'mtag', isM && !!s.tap.CD)); // all four outside their sides
    const lon = (k) => !f.lenSeq || !!(s.lenOn && s.lenOn[k]);
    tags.push(side(D, A, this.cm(ad), 'mtag mleg', !!f.legLen && lon('DA')));
    tags.push(side(B, C, this.cm(bc), 'mtag mleg', !!f.legLen && lon('BC')));
    tags.push(side(A, B, this.cm(this.dist(A, B)), 'mtag', !!f.sideLen && lon('AB')));
    tags.push(side(D, C, this.cm(this.dist(D, C)), 'mtag', !!f.sideLen && lon('CD')));
    if (fig && fig.sides) {
      const E = { AB: [A, B], BC: [B, C], CD: [D, C], DA: [D, A] };
      Object.keys(fig.sides).forEach((k) => { const t = this.figVal(this.cur(), k, fig.sides[k]); tags.push(side(E[k][0], E[k][1], t, 'mtag fig' + (k === 'BC' || k === 'DA' ? ' mleg' : '') + (t.indexOf('?') >= 0 ? ' q' : fig.sides[k].indexOf('?') >= 0 ? ' solved' : ''), true)); });
    }
    // sideNums (screen 2): the four sides numbered clockwise from the left (storyboard page 2): 1 left, 2 top, 3 right,
    // 4 bottom - each number flies in from its
    // own side's direction, one after another (CSS .snum: ease-out, slight overshoot, 90% -> 100% scale)
    {
      const on = !!st.sideNums;
      tags.push(side(D, A, '1', 'snum n1', on));
      tags.push(side(A, B, '2', 'snum n2', on));
      tags.push(side(B, C, '3', 'snum n3', on));
      tags.push(side(D, C, '4', 'snum n4', on));
    }
    tags.forEach((t) => { if (!t.click) t.click = noop; });
    return { g: g, tags: tags, V: V };
  }

  // a card as a notation panel: a small caption naming the property it states, and its relation signs (∥ = +) split
  // out so they wear the highlight colour (p0 s0 p1 s1 ... in index.html)
  chipView(c) {
    const t = c.t || '', side = '(AB|BC|CD|AD|DA)', half = '(AO|OA|BO|OB|CO|OC|DO|OD)';
    const cap = /\bname\b|brk/.test(c.k) ? '' : /∥/.test(t) ? 'Parallel sides' : /^∠[A-D] = ∠[A-D]$/.test(t) ? 'Equal angles' :
      /180°/.test(t) ? 'Supplementary' : new RegExp('^' + side + ' = ' + side + '$').test(t) ? 'Equal sides' :
      new RegExp('^' + half + ' = ' + half + '$').test(t) ? 'Equal halves' : '';
    const bits = t.split(/ (∥|=|\+) /), v = { cap: cap };
    // the spaces travel with the sign, so unused slots take no room (the runtime wraps every value in a span: no :empty)
    for (let i = 0; i < 5; i++) { v['p' + i] = bits[2 * i] || ''; if (i < 4) v['s' + i] = bits[2 * i + 1] ? ' ' + bits[2 * i + 1] + ' ' : ''; }
    return v;
  }
  // The card (as Fishing Frenzy's lesson fits its plate). One size on every screen: the shape is always drawn at
  // CONFIG.card.scale (the first screens' size), so it never grows or shrinks between screens. Each screen is a vertical
  // stack - the shape (padded for its letters and labels), then the block under it (answers, answer boxes, or the lane
  // for name tags). The shape keeps ONE place on every screen that shows it - where its stack with the usual one-row
  // name-tag lane is centred between the question plate and the sand - so it never twitches from screen to screen; it
  // is pulled up only as far as a taller block under it needs (and pushed down only as far as name tags above it
  // need). Only a stack that could not fit at that size is drawn smaller. Returns the scale, the shape point placed at
  // F (stage px), and the stack's shape bottom (where the answers / name tags start).
  sceneFit(st) {
    const C = CONFIG.card, P0 = st.fig ? st.fig.P : ((this.snaps && this.snaps[this.state.step]) || this.state.P);
    let x0 = Math.min(P0.A.x, P0.D.x), x1 = Math.max(P0.B.x, P0.C.x);
    const y0 = Math.min(P0.A.y, P0.B.y), y1 = Math.max(P0.C.y, P0.D.y);
    if (st.task === 'dragB') x1 = Math.max(x1, P0.C.x + (P0.A.x - P0.D.x)); // B slides out until BC is parallel to AD
    const f = st.f || {}, lengths = !!(f.sideLen || f.legLen || st.task === 'measure' || (st.fig && st.fig.sides));
    const padX = C.padX + (lengths ? C.lenPadX : 0), padT = C.padTop + (lengths ? C.lenPadY : 0), padB = C.padBottom + (lengths ? C.lenPadY : 0) + (f.sums ? 34 : 0);
    const w = x1 - x0 + 2 * padX, h = y1 - y0 + padT + padB;
    const above = (st.chipTop && st.chipTop < 200 && !st.practice) || (st.practice && st.okChips); // name tags above the shape
    const top = above ? C.topChips : C.top, below = this.belowH(st);
    const walk = st.task === 'measure' || st.task === 'measureAngles'; // Swiftee measures: the shape sits right of her
    const cxS = st.id === 'intro' ? C.introCx : walk ? C.measureCx : 640;
    const maxW = st.id === 'intro' ? C.introW : walk ? C.measureW : C.maxW;
    const k = Math.min(C.scale, maxW / w, (C.bottom - top - below) / h);
    const home = C.top + Math.max(0, (C.bottom - C.top - h * k - (C.chipGap + C.chipLane)) / 2); // the shape's one place
    const y = Math.max(top, Math.min(Math.max(home, top), C.bottom - below - h * k));
    return { k: k, cx: (x0 + x1) / 2, cy: (y0 - padT + y1 + padB) / 2, F: { cx: cxS, cy: y + h * k / 2 }, bottom: y + h * k };
  }
  // the height of what sits under the shape (stage px, with its gap): the answer row(s), the answer boxes (and their
  // tiles), or the name-tag lane - reserved on every explanation screen so the shape keeps one place from screen to screen
  belowH(st) {
    const C = CONFIG.card;
    if (st.opts) {
      if (!st.optWrap) return C.optGap + C.optH;
      const rows = (st.opts.some((o) => !o.wide) ? 1 : 0) + st.opts.filter((o) => o.wide).length; // short ones in a row, each wide one under
      return C.optGap + rows * C.optH + (rows - 1) * C.optGapX;
    }
    if (st.fill) return C.optGap + C.fillH + (st.fill.match ? C.optGapX + C.tileH : 0);
    if (st.practice) return 0;
    return C.chipGap + (st.chipRows ? C.rowsH : C.chipLane);
  }
  zoomTf(st) {
    const Z = this.sceneFit(st), B = CONFIG.board || { x: 640, y: 104 };
    return 'translate(' + (Z.F.cx - B.x) + 'px, ' + (Z.F.cy - B.y) + 'px) scale(' + Z.k.toFixed(3) + ') translate(' + (-Z.cx).toFixed(1) + 'px, ' + (-Z.cy).toFixed(1) + 'px)';
  }
  // a caption screen (reference isPlate): no Swiftee - her line is the navy plate across the top. She stays where she
  // does something: the first screen (she arrives and speaks), the measuring walk and the end
  // The answer row on the card: every pill as wide as the longest answer needs (measured in the pill's own font, as
  // css/game.css sizes it) plus even padding, never narrower than a comfortable tap target; the row is centred under the
  // shape. With optWrap the short answers share one row and each 'wide' answer spans a row of its own under it.
  optRow(st) {
    const C = CONFIG.card, O = st.opts || [], wrap = !!st.optWrap, gap = C.optGapX;
    if (!O.length) return { w: C.optW, left: 640 - C.optW / 2 };
    let m = this._measure;
    if (m === undefined) { try { m = document.createElement('canvas').getContext('2d') || null; } catch (e) { m = null; } this._measure = m; }
    if (!m) m = { font: '', measureText: (t) => ({ width: t.length * (parseFloat(m.font.slice(4)) || 26) * 0.52 }) }; // no canvas (headless test): an estimate
    const textW = (o) => { const t = o.t || o.id, long = t.length > 14; m.font = '700 ' + (long ? 28 : 36) + "px 'Baloo 2', system-ui, sans-serif"; return m.measureText(t).width + 2 * (long ? C.pillPadLong : C.pillPad); };
    const narrow = O.filter((o) => !o.wide), cols = Math.max(1, narrow.length);
    let pw = Math.max(C.pillMin, ...narrow.map(textW));
    pw = Math.min(pw, (C.rowMax - gap * (cols - 1)) / cols);
    let w = cols * pw + gap * (cols - 1);
    O.filter((o) => o.wide).forEach((o) => { w = Math.max(w, textW(o)); });
    w = Math.ceil(Math.min(w, C.rowMax));
    return { w: w, left: Math.round(640 - w / 2) };
  }
  // the plate glides in once when a screen with Swiftee's bubble hands over to a caption screen (not on every line)
  plateEnter(st) {
    const step = this.state.step;
    if (this._plateStep !== step) { this._plateIn = !this._plateWas; this._plateWas = this.isPlate(st); this._plateStep = step; }
    return this._plateIn && this._plateWas;
  }
  isPlate(st) { return !!(this.state.opened && st && st.id !== 'intro' && st.task !== 'measure' && st.task !== 'measureAngles' && !st.end); }
  renderVals() {
    const s = this.state, steps = this.steps(), st = this.cur();
    const isLesson = !st.grid && !st.end;
    // a newline in a line forces a break in the bubble (a full-width zero-height item); it is not a word, so reveal timing is unchanged
    let wi = 0;
    let words = [];
    (s.line || '').split('\n').forEach((part, li) => {
      if (li) words.push({ t: '', cls: 'brk' });
      // key words (the lesson's terms) wear gold on the caption plate, as in the reference (dual coding)
      this.toWords(part).forEach((w) => { const i = wi++, key = KEY_WORDS.test(w.toLowerCase().replace(/[^a-z0-9°]/g, '')) ? ' key' : '';
        words.push({ t: w, cls: (i < s.reveal - 1 ? 'on' : (i === s.reveal - 1 ? (s.talking ? 'cur' : 'on') : '')) + key }); });
    });
    // the narration plate: a long line in short parts, the one the voice is in (lineParts); once the screen's last line
    // (a rule, a question, a tip) has been said it shows whole, to read before the screen moves on or while answering.
    // partKey changes with the line and with each part, so the plate's text fades in afresh (css .txA / .txB)
    let partKey = s.bub === 'bubA' ? 0 : 1;
    if (this.isPlate(st)) {
      const flat = words.filter((w) => w.cls !== 'brk'), starts = this.lineParts(flat.map((w) => w.t));
      const whole = !s.talking && s.reveal >= flat.length && (!this.q || this.q.i >= this.q.lines.length);
      let k = 0;
      while (k + 1 < starts.length && starts[k + 1] <= Math.max(0, s.reveal - 1)) k++;
      words = whole ? flat : flat.slice(starts[k], k + 1 < starts.length ? starts[k + 1] : flat.length);
      partKey += whole ? starts.length : k;
    }
    const G = isLesson ? this.geo() : { g: {}, tags: [], V: {} };
    // chips
    let chips = s.chips.slice();
    const f = this.fl();
    if (isLesson && f.eq === 'AD') chips = [{ t: '∠A + ∠D = ' + G.V.A + '° + ' + G.V.D + '° = 180°', k: 'white' }];
    if (isLesson && f.eq === 'BC') chips = [{ t: G.V.B + '° + ' + G.V.C + '° = 180°', k: 'white' }];
    // halves: the four measured half-diagonals, live, until a line brings its own cards
    if (isLesson && f.halves && !chips.length) {
      const P = s.P, O = { x: (P.A.x + P.C.x) / 2, y: (P.A.y + P.C.y) / 2 };
      chips = ['A', 'B', 'C', 'D'].map((k) => ({ t: 'O' + k + ' = ' + this.cm(this.dist(O, P[k])), k: 'white sm' }));
    }
    // cfu options
    const optPulse = s.hand && s.hand.kind === 'opts';
    // soloOk: once answered, the other answers fold away and the right one settles alone in the centre
    const solo = !!(st.soloOk && s.done);
    const mk = (o) => ({ id: o.id, t: o.t || o.id, cls: (s.picks[o.id] || (optPulse && !s.done ? 'nudged' : '')) + (o.wide ? ' wide' : '') + ((o.t || '').length > 14 ? ' long' : '') + (solo ? (o.ok ? ' solo' : ' leave') : ''), dis: !!s.picks[o.id] || s.done, pick: () => this.pick(o) });
    const c1 = {};
    if (st.grid) st.opts.forEach((o) => { c1[o.id] = mk(o); });
    // screen-change fade class; combined classes below are built here because the template runtime drops a class
    // attribute that starts with a binding and holds two bindings ("{{a}} {{b}}")
    const fadeV = st.end || st.cp || st.fig ? (s.step % 2 ? 'fadeA' : 'fadeB') : 'fadeA';
    const hasOpts = !!(st.opts && !st.grid);
    // fill / match: the blanks row and the tile tray under the board
    const F = s.fill || this.freshFill(), FD = st.fill;
    const actB = FD && !s.done ? this.activeBlank() : null;
    const dd = !!(FD && !FD.match);
    const blanks = FD ? FD.blanks.map((b, i) => ({ id: b.id, pre: b.pre || '', post: b.post || '', eq: FD.match && i % 2 === 0 ? '=' : '',
      ph: dd && !F.at[b.id] ? 'ph' : '', exp: dd && F.open === b.id ? 'true' : 'false',
      gap: FD.match && i % 2 === 1 && i < FD.blanks.length - 1 ? 'gap' : '',
      t: F.at[b.id] || (dd ? 'Select' : ''), cls: 'blank' + (dd ? ' dd' + (F.open === b.id ? ' open' : '') : '') + (F.locked[b.id] ? ' good' : F.bad[b.id] ? ' bad' : F.at[b.id] ? ' full' : b.id === actB ? ' act' : '') + (FD.match ? ' seg' : ''),
      tap: () => this.blankTap(b.id) })) : [];
    const tiles = FD && FD.match ? FD.tiles.map((t, i) => ({ t: t, i: i, cls: 'tile' + (this.tileUsed(t) ? ' used' : '') + (F.drag && F.drag.t === t ? ' lift' : ''), down: (e) => this.tileDown(t, e) })) : [];
    const opts = hasOpts ? st.opts.map(mk) : [];
    // end
    const nRight = Object.keys(s.results).filter((k) => s.results[k]).length;
    const nStars = CONFIG.stars.find((r) => nRight >= r[0])[1];
    const nChecks = steps.filter((x) => x.cp).length;
    return {
      rootMove: (e) => this.rootMove(e),
      rootUp: (e) => this.rootUp(e),
      start: () => this.start(),
      begin: () => this.begin(),
      restart: () => this.restart(),
      replay: () => this.replay(),
      notStarted: !JOURNEY && !s.started && !s.opening && !s.opened, // on its own page: the Next that starts it
      isLesson: isLesson && s.started,
      isCfu1: !!st.grid,
      fillOn: !!FD, blanks: blanks, tiles: tiles,
      menuOn: !!(dd && F.open), menu: F.menu ? { x: F.menu.x, y: F.menu.y, w: F.menu.w, cls: 'dd-menu' + (F.menu.up ? ' up' : '') + (F.closing ? ' closing' : '') } : { x: 0, y: 0, w: 0, cls: 'dd-menu' },
      menuItems: dd && F.open ? FD.tiles.map((t) => ({ t: t, pick: () => this.pickBlank(F.open, t) })) : [], fillCls: 'fill-ui ' + fadeV + (this.busy() ? ' wait' : ' go') + (FD && FD.match ? ' match' : ''),
      ghostOn: !!(F.drag), ghost: F.drag ? { t: F.drag.t, x: Math.round(F.drag.x), y: Math.round(F.drag.y) } : { t: '', x: 0, y: 0 },
      gridCls: fadeV + (this.busy() ? ' wait' : ' go'),
      isEnd: !!st.end && !JOURNEY, // (in the journey the fishing follows: no score card or Play again)
      g: G.g, tags: G.tags,
      words: words,
      // a line with its own breaks keeps exactly those lines: the bubble widens instead of wrapping again
      bubCls: s.bub + ((s.line || '').indexOf('\n') >= 0 ? ' manual' : '') + (partKey % 2 ? ' txB' : ' txA'),
      // lesson steps share one board, so it only fades in when it first appears; each check fades in fresh
      fadeCls: fadeV,
      chipRowCls: st.chipRows ? ' top' : '', // rows grow downward from chipTop, so the first row never moves
      // chipRows: the name card sits on its own centred row under the others; chipHi: the card for the pair being said
      // a card about a pair of sides wears that pair's colour (AB, CD: pairA; AD, BC: pairB), like the sides themselves
      chips: chips.reduce((a, c) => a.concat(st.chipRows && /\bname\b/.test(c.k) && a.length ? [{ t: '', k: 'brk' }] : [], [c]), [])
        .map((c) => (/^(AB|CD) [∥=] (AB|CD)$/.test(c.t) ? Object.assign({}, c, { k: c.k + ' pairA' }) :
          /^(AD|BC) [∥=] (AD|BC)$/.test(c.t) ? Object.assign({}, c, { k: c.k + ' pairB' }) : c))
        .map((c) => ((v) => Object.assign(v, { k: v.k + (v.cap ? ' hascap' : '') }))(Object.assign({ t: c.t, k: c.k + (c.t.length > 20 ? ' long' : '') + (c.t && c.t === s.chipHi ? ' hi' : '') }, this.chipView(c)))),
      rootDown: (e) => this.rootDown(e),
      wordSize: wi > 15 || (s.line || '').length > 80 ? 22 : 24, // long lines get the smaller size
      c1: c1, hasOpts: hasOpts, opts: opts,
      // the answers (and answer boxes) in a row under the shape, centred on the card
      optTop: isLesson ? Math.round(this.sceneFit(st).bottom + CONFIG.card.optGap) : 376,
      optLeft: this.optRow(st).left,
      optW: this.optRow(st).w, optCls: fadeV + (this.busy() ? ' wait' : ' go') + (st.optWrap ? ' wrap' : '') + (st.multi ? ' multi' : '') + (st.soloOk ? ' solo-ok' : ''),
      // the name tags: under the shape, or above it on a question screen (its answers have the space under it)
      chipTop: isLesson ? (st.practice || (st.chipTop && st.chipTop < 200) ? CONFIG.card.chipTopQ : Math.round(this.sceneFit(st).bottom + CONFIG.card.chipGap)) : st.chipTop || 528, chipLeft: 200, // (the row: 1040 wide, centred on the card, so four tags stay one row)
      stars: [0, 1, 2].map((i) => ({ cls: i < nStars ? 'on' : '' })),
      scoreText: 'You got ' + nRight + ' of ' + nChecks + ' checkpoint challenges right on the first try.',
      // every screen is a scene on the card: the shape centred on it, Swiftee (where she is) on the sand at the left
      sceneCls: (s.opened ? 'in-card ' : s.opening ? 'card-wait ' : 'pre-open ') + 'scene' + (this.plateEnter(st) ? ' plate plate-enter' : this.isPlate(st) ? ' plate' : '') + (st.skin ? ' skin-' + st.skin : '') + (st.enterGrow || st.okGlow || (st.lines || []).some((L) => L.cues) ? ' cue-pulse' : ''), // skin: a screen's own look (css/game.css)
      boardTf: isLesson ? this.zoomTf(st) : 'none',
      boardZ: isLesson ? this.sceneFit(st).k : 1, // the board's zoom: angle values keep one size on screen (css .tag.alab)
      boardCls: fadeV,
      // the shape (and its labels) zooms once about its own centre on a cue (Motion.pop)
      popO: s.P ? Math.round((s.P.A.x + s.P.B.x + s.P.C.x + s.P.D.x) / 4) + 'px ' + Math.round((s.P.A.y + s.P.B.y + s.P.C.y + s.P.D.y) / 4) + 'px' : 'center',
      swCls: s.swAway ? 'swiftee away' : 'swiftee',
      bubHide: !s.line || s.swAway ? 'gone' : s.bubOff ? 'away' : '',
      // hand: fingertip lands on (x, y); drags travel (dx, dy). key restarts the animation on each showing
      handOn: !!(s.hand && s.hand.kind !== 'opts'),
      hand: s.hand && s.hand.kind !== 'opts'
        ? { cls: 'hand-nudge ' + s.hand.kind + (s.hand.down ? ' down' : '') + (s.hand.once ? ' once' : ''), x: s.hand.x, y: s.hand.y, dx: s.hand.dx, dy: s.hand.dy }
        : { cls: 'hand-nudge', x: 0, y: 0, dx: 0, dy: 0 }
    };
  }
};
