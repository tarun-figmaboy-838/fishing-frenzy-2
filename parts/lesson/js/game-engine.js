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
    this.ld = null;
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
      line: "Hi! Ready to learn about\nparallelograms with me?", reveal: 99, talking: false, bub: 'bubA', bird: '',
      muted: this.state ? this.state.muted : false, done: true,
      opened: !!(this.state && this.state.opened), opening: !!(this.state && this.state.opening), // the card (js/opening.js)
      ext: { DA: 0, BC: 0, AB: 0, CD: 0 }, tap: {}, ang: {}, diag: {}, chips: [], toast: null,
      moved: false, dragging: null, picks: {}, cfuFirst: true, results: {},
      c4: { at: { iso: null, right: null, scal: null }, locked: {}, sel: null, drag: null, checking: false },
      ruler: this.rulerHome(), rulerDrag: false, hand: null, bubOff: false, centered: false, glow: null, pulse: false, callout: null, emph: {}
    };
  }
  steps() { return LESSON.steps; }
  // the screen's display flags; okF adds more once its question is answered (e.g. the parallel arrows)
  fl() { const st = this.cur(), s = this.state; return Object.assign({}, st.f || {}, s && s.done && st.okF ? st.okF : {}); }
  // the shape on the board: a checkpoint draws its own figure, every other screen the learner's shape
  shapeP() { const st = this.cur(); return st.fig ? st.fig.P : this.state.P; }
  // a question, task or check that waits for the learner
  asks(st) { return !!(st.task || st.cfu || st.opts || st.fill); }
  // while Swiftee gives a screen's instructions nothing can be answered, tapped or dragged yet
  busy() { return !!this.state.listen; }
  // the free-fill state of a fill / match check
  freshFill() { return { at: {}, locked: {}, sel: null, drag: null, checking: false, bad: {}, open: null, closing: false, menu: null }; }
  cur() { return this.steps()[this.state.step]; }
  labsDef() { return LESSON.cfu4.labels; }
  slotsDef() { return LESSON.cfu4.slots; }


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
  }

  // sounds for marks that appear with the board: parallel chevrons / equal ticks (a tick as they pop on) and angle arcs
  // (a soft pluck as each draws in, staggered like the arcs' own CSS delays .d0-.d3)
  markSounds() {
    const st = this.cur(), s = this.state;
    if (!s.started || !st || st.cfu || st.grid || st.end) { this.marks = null; return; }
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
  // ---------- screen list (top-left) ----------
  // The shape each screen expects, as if every screen before it was completed (for jumping straight to one).
  taskResult(st, P) {
    P = this.clone(P);
    const pg = this.isPg(P);
    if (st.task === 'dragA') P.A.x = P.D.x + (P.C.x - P.B.x);
    if (st.task === 'dragB') P.B.x = P.C.x + (P.A.x - P.D.x);
    if (st.task === 'dragAny') P.B.x -= 100;
    if (st.task === 'dragFree') { P.B.x -= 40; if (pg) P.A.x -= 40; } // a parallelogram's top side moves as one
    if (st.task === 'drag90') P.A.x = P.D.x;
    if (st.task === 'dragD90') P.D.x = P.A.x;
    if (st.task === 'dragD') P.D.x = P.A.x - 60;
    if (st.task === 'dragC') P.C.x = P.C.x - 40;
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
    if (this.state.measuring) return 'measuring'; // tape-measure walk while the ruler measures a side
    if (st.pose) return st.pose;
    if (st.end) return C.done;
    if ((st.cfu || st.cp) && !this.state.done) return C.waiting;
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
  // a corner letter arrives (letters line): it flies in from its own corner (Motion.letterIn) and, as it lands,
  // its corner dot gives a soft grow. Letters never land closer than CONFIG.letters.minGapMs apart, so A -> B -> C -> D
  // keeps its rhythm even when several cues come at once (a voice cut short, or no voice at all)
  revealLetter(k) {
    const now = Date.now(), at = Math.max(now, (this.letterAt || 0) + CONFIG.letters.minGapMs);
    this.letterAt = at;
    const go = () => {
      this.setState({ vIn: Object.assign({}, this.state.vIn, { [k]: 1 }) });
      Motion.letterIn(k, () => { this.emphasize(['v' + k]); this.sfx('pop', { f: (window.Sfx ? Sfx.notes : [523.25, 659.25, 783.99, 1046.5, 1318.5])['ABCD'.indexOf(k)], v: 0.75 }); });
    };
    if (at > now) Motion.wait((at - now) / 1000, go); else go();
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
    // letters: 1 - each corner letter spoken on its own ("A, B, C, D" in s) flies in exactly as the voice says it:
    // word-boundary events give the precise moment; voices without them get a paced estimate; all are in by the end
    const letterCues = [];
    if (L.letters) sp.replace(/\b([A-D])\b/g, (m, k, at) => { letterCues.push({ k: k, at: at, done: false }); return m; });
    const fireLetter = (c) => { if (!c.done && tok === this.narrTok) { c.done = true; this.revealLetter(c.k); } };
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
    let cardShown = !(keep && L.chips); // (glow and callout below apply to any line)
    let glowOn = false;
    // glowAt: the highlight waits for that word
    const atIdx = L.glowAt ? words.findIndex((w) => w.toLowerCase().replace(/[^a-z-]/g, '').indexOf(L.glowAt) === 0) : -1;
    const highlight = () => {
      if (tok !== this.narrTok) return;
      if (L.glow && !glowOn) { glowOn = true; this.setState({ glow: L.glow }); }
      if (L.callout && this.state.callout !== L.callout) this.setState({ callout: L.callout });
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
    else this.setState({ aFocus: null, line: text, reveal: 0, talking: true, bub: this.state.bub === 'bubA' ? 'bubB' : 'bubA', bubOff: false, centered: false });
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
      fin = true;
      mouth(false);
      highlight(); // in case the word was never reached (voice cut short)
      letterCues.forEach(fireLetter); // likewise every corner letter is in by the time the line ends
      cues.forEach(fireCue); // and every word cue
      this.setState(Object.assign(keep ? { talking: false } : { talking: false, reveal: words.length }, L.glow && atIdx < 0 ? { glow: null } : {}));
      if (L.glow && atIdx >= 0) this.tm(() => { if (live()) this.setState({ glow: null }); }, 1500); // the word was the end: let it linger
      if (Object.keys(aNamed).length) this.tm(() => { if (live()) this.setState({ aFocus: null }); }, 1200);
      firePulse(); // no-op if the pulseAt word already fired it
      fireGrow(); // likewise for growAt
      if (this.cur().build) this.rushBuild(); // screen 1: the outline closes with the line
      // after speaking, Swiftee reacts with the line's expression for a beat, then settles
      if (L.m) this.tm(() => { if (live()) this.pose(this.restPose()); }, CONFIG.swiftee.reactMs);
      this.tm(() => { if (live() && done) done(); }, 420);
      // qFocus (a check question): the bubble fades once Swiftee has finished, then the question shape glides
      // to the centre and the answers come in one by one (qc). Feedback lines bring the bubble back; it fades again.
      if (this.cur().qFocus && !this.state.done) {
        const Q = CONFIG.qFocus;
        this.tm(() => {
          if (!live()) return;
          this.setState({ bubOff: true });
          if (!this.state.qc) this.tm(() => { if (live()) { this.setState({ qc: true }); this.armHand(); } }, Q.fadeMs);
        }, Q.holdMs);
      }
      // only while there is still something to tap: after the task the bubble and board stay put
      if (this.cur().layout === 'focus' && !this.state.done) {
        const F = CONFIG.focus;
        this.tm(() => {
          if (!live()) return;
          this.setState({ bubOff: true });
          this.tm(() => { if (live()) { this.setState({ centered: true }); this.focusAt = Date.now(); this.armHand(); } }, F.fadeMs);
        }, this.cur().focusHold != null ? this.cur().focusHold : F.holdMs);
      }
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
      if (L.labelsIn) Motion.labelsIn(); // the corner letters come back as this line starts
      if (letterCues.length) { // paced estimate for voices without word boundaries (precise boundaries win if they come)
        const est = clipMs || words.reduce((t, w) => t + nominal(w), 0) * (this.paceK || 1.18);
        letterCues.forEach((c) => this.tm(() => { if (!bMode) fireLetter(c); }, est * c.at / Math.max(1, sp.length)));
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
          sDone = true; begin(); mouth(false); letterCues.forEach(fireLetter); revealAll(); finish();
        };
        u.onstart = () => { spoke = true; begin(); };
        u.onend = end; u.onerror = end;
        u.onboundary = (ev) => {
          if (!live() || (ev.name && ev.name !== 'word')) return;
          bMode = true; begin();
          letterCues.forEach((c) => { if ((ev.charIndex || 0) >= c.at) fireLetter(c); });
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
    // starts (missing file, play() refused) hands the line to the device voice below.
    const voKey = keep ? L.s : text.replace(/\s*\n\s*/g, ' ').trim();
    if (!this.state.muted && window.VO && VO.has(voKey)) {
      const sec = VO.seconds(voKey), rate = VO.rate;
      clipMs = sec * 1000 / rate;
      // each displayed word's weight: its spoken length (numbers are said as words, so their digits weigh more)
      const wt = words.map((w) => this.speechOf(w).replace(/\d/g, 'xxxx').length + 1), tot = wt.reduce((a, b) => a + b, 0);
      const perCh = Math.max(16, (sec - 0.35) * 1000 / tot) / rate;
      const end = () => {
        if (!live() || sDone) return;
        sDone = true; begin(); mouth(false); letterCues.forEach(fireLetter); revealAll(); finish();
      };
      const handed = VO.play(voKey, {
        start: () => {
          if (!live()) return;
          bMode = true; begin(); // bMode: no paced reveal - the timers below place every word
          // each word at its measured start in the clip (dev/tools/vo_build.js); else at its share of the spoken characters
          const tw = VO.times(voKey), show = (k) => { if (live() && k + 1 > i) { i = k + 1; setReveal(i); } };
          if (tw && tw.length === words.length) {
            // follow the clip's own playhead (not a wall clock), so words stay with the voice through start-up lag or buffering
            const follow = () => {
              if (!live() || sDone) return;
              const ct = VO.now();
              if (ct >= 0) while (i < tw.length && tw[i] <= ct + 0.04) show(i);
              this.tm(follow, 30);
            };
            follow();
          } else { let at = 0; wt.forEach((w, k) => { const ms = at * perCh; at += w; this.tm(() => show(k), ms); }); }
          letterCues.forEach((c) => this.tm(() => fireLetter(c), clipMs * c.at / Math.max(1, sp.length)));
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
    this.say(L, () => { if (tok !== this.stepTok) return; if (this.q) this.qNext(); else { this.armIdle(); this.maybeAdvance(true); } });
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
    if (!this.needsInput() || this.cur().layout === 'focus' || this.state.swAway || this.cur().auto) return;
    const tok = this.stepTok;
    this.idleId = this.tm(() => {
      this.idleId = null;
      if (tok !== this.stepTok || !this.needsInput()) return;
      if (this.state.swAway) return; // Swiftee is out measuring on the shape: no spoken reminder
      if (this.drag || this.ld || this.rulerBusy || this.state.talking) { this.armIdle(); return; }
      if ((this.idleCount || 0) >= CONFIG.timing.idleMaxHints) return;
      this.idleCount = (this.idleCount || 0) + 1;
      const st = this.cur(), t = st.idle || (st.hint && st.hint + '.');
      if (!t) return; // a question with neither an idle line nor a hint (screens 5, 15): the hand / pulsing answers nudge instead
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
    if (!s.started || st.end) return null;
    if (!s.done) {
      const first = (ks, skip) => ks.find((k) => !skip(k));
      const t = st.task;
      let k;
      if (t === 'extLegs' && !st.auto) k = first(['DA', 'BC'], (x) => s.ext[x] > 0);
      if (t === 'extBases' && !st.auto) k = first(['AB', 'CD'], (x) => s.ext[x] > 0);
      if (t === 'tapBases') k = first(['AB', 'CD'], (x) => s.tap[x]);
      if (t === 'tapLegs') k = first(['DA', 'BC'], (x) => s.tap[x]);
      if (t === 'measure' && !st.auto) k = this.activeSide();
      if (k) return { qa: 'edge-' + k, kind: 'tap' };
      if (t === 'tapAngles') k = first(['A', 'B', 'C', 'D'], (x) => s.ang[x]);
      if (t === 'tapAD') k = first(['A', 'D'], (x) => s.ang[x]);
      if (t === 'tapEq') k = st.want;
      if (k) return { qa: 'vtx-' + k, kind: 'tap' };
      // drags: slide toward the goal (equal legs, a right angle) or, when any change will do, inward
      const clamp = (v) => (Math.abs(v) < 12 ? 0 : Math.max(-70, Math.min(70, v)));
      if (t === 'dragAny' || t === 'dragFree') return { qa: 'vtx-B', kind: 'drag', dx: -60, dy: 0 };
      if (t === 'drag90') return { qa: 'vtx-A', kind: 'drag', dx: clamp(P.D.x - P.A.x) || -60, dy: 0 };
      if (t === 'connect') { // from a corner toward its opposite corner
        const a = s.diag.AC ? 'B' : 'A', b = this.opp(a), L = this.dist(P[a], P[b]) || 1, k2 = Math.min(130, L * 0.6) / L;
        return { qa: 'vtx-' + a, kind: 'drag', dx: Math.round((P[b].x - P[a].x) * k2), dy: Math.round((P[b].y - P[a].y) * k2) };
      }
      if (st.fill) return { qa: 'blank-' + this.activeBlank(), kind: 'tap' }; // never a tile: that would give the answer
      if (t === 'dragB') return { qa: 'vtx-B', kind: 'drag', dx: clamp(P.C.x + (P.A.x - P.D.x) - P.B.x) || 60, dy: 0 };
      if (t === 'dragA') return { qa: 'vtx-A', kind: 'drag', dx: clamp(P.D.x + (P.C.x - P.B.x) - P.A.x) || -60, dy: 0 };
      if (t === 'dragD90') return { qa: 'vtx-D', kind: 'drag', dx: clamp(P.A.x - P.D.x) || 60, dy: 0 };
      if (t === 'dragD') return { qa: 'vtx-D', kind: 'drag', dx: 60, dy: 0 };
      if (t === 'dragC') return { qa: 'vtx-C', kind: 'drag', dx: -60, dy: 0 };
      if (st.cfu === 4) {
        const c4 = s.c4, lab = this.labsDef().find((l) => !c4.locked[l.id] && !c4.at[l.id]);
        // press the label only: sliding it anywhere would hint at an answer
        return lab ? { qa: 'lab-' + lab.id, kind: 'tap' } : null;
      }
      if (st.cfu || st.opts) return { kind: 'opts' };
      return null;
    }
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
    const focus = this.cur().layout === 'focus' && !this.state.done; // task finished: normal Next nudge
    if (focus && !this.state.centered) return; // armed again once the shape is at centre stage
    const tok = this.stepTok;
    this.handId = this.tm(() => {
      this.handId = null;
      if (tok !== this.stepTok) return;
      // wait for Swiftee to finish and for hands to be off the board
      if (this.state.talking || this.drag || this.ld || this.rd || this.rulerBusy || this.state.c4.checking) { this.armHand(); return; }
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
    }, (once ? CONFIG.hand.onceDelayMs : focus ? CONFIG.focus.handMs + Math.max(0, (this.focusAt || 0) + CONFIG.focus.moveMs - Date.now()) : CONFIG.hand.idleMs) + (extraMs || 0));
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
    this.idleId = null; this.idleCount = 0; this.handId = null; this.handShown = 0; this.touched = false; this.overWig = false; this.letterAt = 0;
    this.prevLine = this.state.line;
    if (this.wk) this.wk.hide();
    this.stepTok++; this.narrTok++;
    this.q = null;
    this.cancelSpeech();
    this.drag = null; this.ld = null; this.rd = null; this.rulerBusy = false; this.rulerLeg = null; this.pendingLeg = []; this.navAt = Date.now();
    let P;
    if (fwd || !this.snaps[i]) { P = this.clone(this.state.P); this.snaps[i] = this.clone(P); }
    else P = this.clone(this.snaps[i]);
    this.setState({
      step: i, P: P, aFocus: null, done: !this.asks(st), listen: !!(st.lines || []).length && this.asks(st), fill: this.freshFill(), conn: null, lenOn: {}, supp: null, ext: { DA: 0, BC: 0, AB: 0, CD: 0 }, tap: {}, ang: {}, diag: {}, chips: [], toast: null,
      moved: false, dragging: null, picks: {}, cfuFirst: true, bird: '', hand: null, bubOff: false, centered: false, glow: null, chipHi: null, pulse: false, callout: null, emph: {}, qc: false, trace: null, build: null, vIn: {}, flash: null, wig: null, measuring: null, tape: null, swAway: false, measureFocus: false, line: '', reveal: 0, ruler: this.rulerHome(), rulerDrag: false,
      c4: { at: { iso: null, right: null, scal: null }, locked: {}, sel: null, drag: null, checking: false }
    });
    if (st.layout === 'focus' && !(st.lines || []).length && !this.state.done) {
      this.setState({ line: fwd ? this.prevLine || '' : '', reveal: 999, bubOff: true, centered: true });
      this.focusAt = Date.now();
    }
    this.pose(this.restPose());
    this.setState({}, () => this.stepMotion(st)); // once the new screen is drawn
    const lines = () => this.playLines(st.lines, () => {
      if (this.state.listen) this.setState({ listen: false }, () => this.armHand());
      if (st.task === 'measure' && st.auto) this.tm(() => this.autoMeasure(), 400);
      else if (st.task === 'extLegs' && st.auto) this.autoExtend(['DA', 'BC']);
      else if (st.task === 'extBases' && st.auto) this.autoExtend(['AB', 'CD']);
      else if (st.task === 'diags' && st.auto) this.autoDiag();
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
    this.setState({ done: true, toast: null, hand: null }); // task done: the hand has nothing left to point at
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
      if (tok !== this.stepTok || this.state.talking || this.drag || this.ld || this.rd) return;
      const bd = this.state.build; // a building shape (screen 1) finishes its outline glow and fill fade first
      if (st.build && !(bd && bd.done && !bd.settle)) { this.maybeAdvance(false); return; }
      this.goTo(i + 1, true);
    }, Math.max(0, wait - (afterLine ? 420 : 0))); // a finished line has already paused 420 ms
  }
  oops(text) {
    this.sfx('bad');
    this.setState({ toast: text });
    this.interject({ m: CONFIG.swiftee.wrong, t: text });
    const tok = this.stepTok;
    if (this.toastId) { clearTimeout(this.toastId); this.T.delete(this.toastId); }
    this.toastId = this.tm(() => { if (tok === this.stepTok) this.setState({ toast: null }); }, 4200);
  }

  // ---------- ruler ----------
  // resting spot: level, centred under side DC with a clear gap (follows the current shape)
  rulerHome() {
    const H = CONFIG.ruler.home, P = (this.state && this.state.P) || this.initP();
    return { x: (P.D.x + P.C.x) / 2 - 200, y: Math.max(P.D.y, P.C.y) + H.gap, a: H.a, sy: 1 };
  }
  rulerTarget(leg) {
    const P = this.state.P;
    const ends = { AB: [P.A, P.B], BC: [P.B, P.C], CD: [P.D, P.C], DA: [P.D, P.A] }[leg];
    const p = ends[0], q = ends[1];
    const cx = (P.A.x + P.B.x + P.C.x + P.D.x) / 4, cy = (P.A.y + P.B.y + P.C.y + P.D.y) / 4;
    let th = Math.atan2(q.y - p.y, q.x - p.x);
    let o = p;
    const nx = -Math.sin(th), ny = Math.cos(th);
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const sy = nx * (mx - cx) + ny * (my - cy) < 0 ? -1 : 1;
    return { x: o.x, y: o.y, a: th * 180 / Math.PI, sy: sy };
  }
  rulerCenter(R) {
    const t = R.a * Math.PI / 180;
    const o = 13 * (R.sy == null ? 1 : R.sy);
    return { x: R.x + Math.cos(t) * 200 - Math.sin(t) * o, y: R.y + Math.sin(t) * 200 + Math.cos(t) * o };
  }
  animRuler(to, dur, then) {
    const tok = this.stepTok, from = Object.assign({}, this.state.ruler), t0 = Date.now();
    let da = to.a - from.a; while (da > 180) da -= 360; while (da < -180) da += 360;
    const f = () => {
      if (tok !== this.stepTok) return;
      const t = Math.min(1, (Date.now() - t0) / dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const sy0 = from.sy == null ? 1 : from.sy, sy1 = to.sy == null ? 1 : to.sy;
      this.setState({ ruler: { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, a: from.a + da * e, sy: sy0 + (sy1 - sy0) * e } });
      if (t < 1) this.tm(f, 16); else if (then) then();
    };
    f();
  }
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
  // screen 13: measure all four sides by herself, one after another
  // screens 4 and 5: one side after the other, a glowing line draws along the side, then its dotted extension draws on
  // (legs AD then BC, or bases AB then CD). Starts once the shape has settled at centre stage.
  autoExtend(keys) {
    const tok = this.stepTok, live = () => tok === this.stepTok && !this.state.done;
    if (!live()) return;
    if (this.cur().layout === 'focus') {
      if (!this.state.centered) { this.tm(() => this.autoExtend(keys), 100); return; }
      const wait = (this.focusAt || 0) + CONFIG.focus.moveMs + 300 - Date.now();
      if (wait > 0) { this.tm(() => this.autoExtend(keys), wait); return; }
    }
    const isLegs = this.cur().task === 'extLegs';
    // Screens 4 and 5 share one animation system, one side at a time:
    //   legs  (4): D->A glow -> dotted on from A toward the meeting point, then C->B glow -> dotted on from B
    //   bases (5): AB glows from its middle out to A and B -> dotted outward from both ends, then DC the same way
    // A soft glowing pink line draws on along the side and stops exactly at its end corner; at that instant the
    // dotted extension starts drawing on while the glow fades off the side. One speed for everything
    // (CONFIG.trace.pxPerMs): the glow eases in (sine) and the dotted line eases out (sine), so the motion runs
    // through the corner without a stop or a jump.
    const sp = CONFIG.trace.pxPerMs;
    const run = (ms, ease, set, done) => Motion.value(0, 1, ms / 1000, ease, (e) => { if (live()) set(e); }, () => { if (live()) done(); });
    const trace = (k, then) => {
      if (!live()) return;
      const P = this.state.P;
      const ends = { DA: [P.D, P.A], BC: [P.C, P.B], AB: [P.A, P.B], CD: [P.D, P.C] }[k], from = ends[0], to = ends[1];
      let extLen;
      if (isLegs) {
        const ap = this.inter(P.A, P.D, P.B, P.C) || { x: (P.A.x + P.B.x) / 2, y: P.A.y - 60 };
        extLen = this.dist(to, ap);
      } else extLen = Math.max(from.x + 10, 530 - to.x); // bases run out to both board edges (see be())
      this.sfx('tap');
      // 1. the glowing line: legs draw from corner to corner; bases grow from the middle out to both ends at once
      const mid = !isLegs, glowLen = this.dist(from, to) * (mid ? 0.5 : 1);
      run(Math.max(350, glowLen / sp), 'sine.in', (e) => this.setState({ trace: { from: from, to: to, t: e, out: false, mid: mid } }), () => {
        // 2. at the end corner(s): the glow fades off the side as the dotted line draws on (bases: out of both ends together)
        this.setState({ trace: { from: from, to: to, t: 1, out: true, mid: mid } });
        run(Math.max(250, extLen / sp), 'sine.out', (e) => {
          const ext = Object.assign({}, this.state.ext); ext[k] = Math.max(e, 0.001);
          this.setState({ ext: ext });
        }, () => { this.setState({ trace: null }); Motion.wait(CONFIG.trace.gapMs / 1000, then); });
      });
    };
    trace(keys[0], () => trace(keys[1], () => { if (live()) { if (isLegs) this.sfx('snap'); this.finishTask(); } }));
  }
  // diagonals: the same glowing pen draws B -> D, then A -> C; each stays as a solid line once drawn (no taps)
  autoDiag() {
    const tok = this.stepTok, live = () => tok === this.stepTok && !this.state.done;
    const draw = (k, then) => {
      if (!live()) return;
      const P = this.state.P, from = k === 'BD' ? P.B : P.A, to = k === 'BD' ? P.D : P.C;
      this.sfx('tap');
      Motion.value(0, 1, Math.max(400, this.dist(from, to) / CONFIG.diag.pxPerMs) / 1000, 'sine.inOut',
        (e) => { if (live()) this.setState({ trace: { from: from, to: to, t: e, out: false, mid: false } }); },
        () => {
          if (!live()) return;
          this.setState({ trace: null, diag: Object.assign({}, this.state.diag, { [k]: 1 }) });
          this.sfx('pop');
          Motion.wait(CONFIG.diag.gapMs / 1000, then);
        });
    };
    draw('BD', () => draw('AC', () => { if (live()) this.finishTask(); }));
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
        this.setState({ lenOn: Object.assign({}, this.state.lenOn, q[1].reduce((o, k) => { o[k] = 1; return o; }, {})) });
        this.emphasize(q[1]); this.sfx('pop');
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
    if (st.letterIn) Motion.fadeOut('.tag.snum, .tag.vlab'); // numbers and old letters leave softly; letters return on cue
    if (st.assemble) {
      const P = this.state.P;
      Motion.holdSmall((P.A.x + P.B.x + P.C.x + P.D.x) / 4, (P.A.y + P.B.y + P.C.y + P.D.y) / 4);
      // each side lands with a pop, rising C E G C; the outline glow settles with a shimmer
      Motion.assemble((i) => this.sfx('pop', { f: (window.Sfx ? Sfx.notes : [523.25, 659.25, 783.99, 1046.5, 1318.5])[i] }), () => this.sfx('shimmer', { v: 0.9 }));
    }
  }
  // screen 13: the shape first glides to the centre of the screen and grows a little (measureFocus, zoomTf); once it
  // has settled Swiftee flies onto it, so every corner she aims for is where the shape now is
  autoMeasure() {
    const tok = this.stepTok;
    const nextSide = () => {
      if (tok !== this.stepTok || this.state.done) return;
      const k = this.activeSide();
      if (k) this.measureLeg(k, nextSide);
    };
    this.setState({ measureFocus: true });
    this.tm(nextSide, Motion.reduced ? 50 : CONFIG.scene.measureFocus.settleMs);
  }
  homeFeet() { const W = CONFIG.walker; return { x: W.homeX, y: W.homeY }; }
  measureLeg(leg, then) {
    const s = this.state;
    if (s.done || s.tap[leg] || this.rulerBusy) return;
    if (this.cur().task === 'measure' && leg !== this.activeSide()) return; // only the glowing side
    this.rulerBusy = true; this.rulerLeg = leg;
    this.setState({ measuring: leg, tape: { leg: leg, t: 0 }, hand: null });
    this.sfx('tap');
    const tok = this.stepTok, W = CONFIG.walker, ends = this.walkEnds(leg);
    const lenCm = this.dist(ends[0], ends[1]) / this.S;
    const walkMs = Math.max(900, lenCm * W.msPerCm);
    const wk = this.walker();
    const live = () => tok === this.stepTok;
    const arrive = () => {
      if (!live()) return;
      const tap = Object.assign({}, this.state.tap); tap[leg] = true;
      // the full tape stays laid on the side until the next side starts (no blink)
      this.setState({ tap: tap, tape: Object.assign({}, this.state.tape, { t: 1, tip: null }), toast: null }); // lets go: the tape lies flat
      this.sfx('pop');
      this.rulerBusy = false; this.rulerLeg = null;
      if (tap.AB && tap.BC && tap.CD && tap.DA) {
        // all four measured: fly home, then the screen carries on
        const home = () => { if (!live()) return; this.setState({ measuring: null, swAway: false, tape: null, measureFocus: false }); if (wk) wk.hide(); this.pose(this.restPose()); this.tm(() => this.finishTask(), Motion.reduced ? 250 : CONFIG.scene.measureFocus.settleMs); };
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
  }

  rulerDown(e) {
    if (this.cur().task !== 'measure' || this.state.done || this.rulerBusy) return;
    const svg = e.currentTarget && e.currentTarget.ownerSVGElement;
    const p = svg && this.toSvg(svg, e);
    if (!p) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    if (e.preventDefault) e.preventDefault();
    const R = this.state.ruler;
    this.rd = { svg: svg, ox: p.x - R.x, oy: p.y - R.y, sx: p.x, sy: p.y, moved: false };
    this.setState({ rulerDrag: true });
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
  dragKey() {
    const st = this.cur(), s = this.state;
    if (st.task === 'dragA' && !s.done) return 'A';
    if (st.task === 'dragB' && !s.done) return 'B';
    if (st.task === 'dragD90' && !s.done) return 'D';
    if (st.task === 'dragD') return 'D';
    if (st.task === 'dragC') return 'C';
    return null;
  }
  anim(key, then) {
    const tok = this.stepTok, t0 = Date.now(), dur = 850;
    const f = () => {
      if (tok !== this.stepTok) return;
      const t = Math.min(1, (Date.now() - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const ext = Object.assign({}, this.state.ext); ext[key] = Math.max(e, 0.001);
      this.setState({ ext: ext });
      if (t < 1) this.tm(f, 16); else if (then) then();
    };
    f();
  }

  // ---------- lesson interactions ----------
  tapEdge(edge) {
    const st = this.cur(), s = this.state;
    if (s.done || (st.layout === 'focus' && !s.centered)) return;
    const isLeg = edge === 'DA' || edge === 'BC';
    if (st.task === 'extLegs') {
      if (!isLeg) return this.oops('Try a slanted side. Those are the ones that look like they will meet.');
      if (s.ext[edge] > 0) return;
      this.sfx('tap');
      this.anim(edge, () => {
        if (this.state.ext.DA >= 1 && this.state.ext.BC >= 1) { this.sfx('snap'); this.finishTask(); }
      });
    } else if (st.task === 'extBases') {
      if (isLeg) return this.oops('That one is slanted. Tap the top side or the bottom side.');
      if (s.ext[edge] > 0) return;
      this.sfx('tap');
      this.anim(edge, () => { if (this.state.ext.AB >= 1 && this.state.ext.CD >= 1) this.finishTask(); });
    } else if (st.task === 'measure') {
      if (st.auto) return; // Swiftee measures by herself
      this.measureLeg(edge); // any side, one at a time
    } else if (st.task === 'tapBases' || st.task === 'tapLegs') {
      const wantLeg = st.task !== 'tapBases';
      if (isLeg !== wantLeg) {
        if (st.task === 'tapBases') return this.oops("That's a slanted side. Find the two sides that are parallel.");
        if (st.task === 'tapLegs') return this.oops("That's a base. The legs are the slanted sides.");
      }
      if (s.tap[edge]) return;
      const tap = Object.assign({}, s.tap); tap[edge] = true;
      this.setState({ tap: tap, toast: null });
      this.sfx('pop');
      const pair = wantLeg ? ['DA', 'BC'] : ['AB', 'CD'];
      if (tap[pair[0]] && tap[pair[1]]) this.tm(() => this.finishTask(), 250);
    }
  }
  tapVertex(k) {
    const st = this.cur(), s = this.state;
    if (s.done || this.busy()) return;
    if (st.task === 'tapAngles') {
      if (s.ang[k]) return;
      const ang = Object.assign({}, s.ang); ang[k] = true;
      this.setState({ ang: ang });
      this.sfx('pop');
      if (ang.A && ang.B && ang.C && ang.D) this.tm(() => this.finishTask(), 300);
    } else if (st.task === 'tapEq') {
      if (k === st.ref || s.ang[k]) return;
      if (k !== st.want) return this.oops(st.wrong);
      const ang = Object.assign({}, s.ang); ang[k] = true;
      this.setState({ ang: ang, toast: null });
      this.sfx('pop');
      this.tm(() => this.finishTask(), 250);
    } else if (st.task === 'tapAD') {
      if (k !== 'A' && k !== 'D') return this.oops('Tap the angles at A and D. They sit on the same leg.');
      if (s.ang[k]) return;
      const ang = Object.assign({}, s.ang); ang[k] = true;
      this.setState({ ang: ang, toast: null });
      this.sfx('pop');
      if (ang.A && ang.D) this.tm(() => this.finishTask(), 250);
    }
  }
  anyCorner() { const t = this.cur().task; return (t === 'dragAny' || t === 'dragFree' || t === 'drag90') && !this.state.done; }
  canDrag(k) { return this.dragKey() === k || this.anyCorner(); }
  down(k, e) {
    if (this.cur().task === 'connect') return this.connDown(k, e);
    if (!this.canDrag(k) || this.busy()) return;
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
  move(e) {
    if (this.rd) return this.rulerMove(e);
    if (!this.drag) return;
    const p = this.toSvg(this.drag.svg, e);
    if (!p) return;
    const P = this.clone(this.state.P), k = this.drag.k, task = this.cur().task;
    let x = p.x;
    // bases stay parallel (only x moves); the limits stop the shape crossing itself or going unreadably thin
    const Lm = CONFIG.limits, SL = Lm.maxLegRun;
    // a parallelogram stays one: the dragged corner's whole side (top A-B or bottom D-C) slides with it
    if (task !== 'dragB' && this.isPg(P)) {
      const top = k === 'A' || k === 'B', p0 = top ? 'A' : 'D', p1 = top ? 'B' : 'C', o = top ? P.D : P.A;
      const lo = Math.max(Lm.minX - P[p0].x, o.x - SL - P[p0].x), hi = Math.min(Lm.maxTopX - P[p1].x, o.x + SL - P[p0].x);
      const dx = Math.max(lo, Math.min(hi, x - P[k].x));
      P[p0].x += dx; P[p1].x += dx;
      this.setState({ P: P, moved: this.state.moved || Math.abs(P[k].x - this.drag.x0) > 25 });
      return;
    }
    // dragB: B may run past C (that is how the trapezium becomes a parallelogram)
    if (k === 'B') x = Math.max(P.A.x + Lm.minTop, P.C.x - SL, Math.min(task === 'dragB' ? Math.min(Lm.maxTopX, P.C.x + SL) : P.C.x, x));
    if (k === 'A') x = Math.max(Lm.minX, P.D.x - SL, Math.min(P.B.x - Lm.minTop, P.D.x + SL, x));
    if (k === 'D') x = Math.max(Lm.minX, P.A.x - SL, Math.min(P.C.x - Lm.minBottom, P.A.x + SL, x));
    if (k === 'C') x = Math.max(P.D.x + Lm.minBottom, P.B.x - SL, Math.min(Lm.maxX, P.B.x + SL, x));
    P[k].x = x;
    this.setState({ P: P, moved: this.state.moved || Math.abs(x - this.drag.x0) > 25 });
    this.overDrag(k, x);
  }
  // wrongRight: { cm, side } = the corner dragged right (the wrong way) more than cm from where it started on
  // this screen -> that side wiggles once with the incorrect sound. Fires on crossing the limit only; it re-arms
  // after the corner comes back inside, and never more than once per CONFIG.drag.wrongGapMs.
  overDrag(k, x) {
    const W = this.cur().wrongRight, start = this.snaps[this.state.step];
    if (!W || !start || this.state.done) return;
    const over = x - start[k].x > W.cm * this.S;
    if (over && !this.overWig && Date.now() - (this.wigAt || 0) > CONFIG.drag.wrongGapMs) {
      this.wigAt = Date.now();
      this.sfx('bad');
      Motion.wiggle(W.side);
    }
    this.overWig = over;
  }
  rulerMove(e) {
    const R = this.rd, p = this.toSvg(R.svg, e);
    if (!p) return;
    if (!R.moved && Math.hypot(p.x - R.sx, p.y - R.sy) < 5) return;
    R.moved = true;
    const x = Math.max(-200, Math.min(500, p.x - R.ox)), y = Math.max(-40, Math.min(420, p.y - R.oy));
    this.setState({ ruler: Object.assign({}, this.state.ruler, { x: x, y: y }) });
  }
  rulerUp() {
    const R = this.rd;
    this.rd = null;
    this.setState({ rulerDrag: false });
    if (!R.moved) { this.interject({ t: 'Drag the ruler onto one of the slanted sides.' }); return; }
    const c = this.rulerCenter(this.state.ruler), P = this.state.P;
    const legs = [['AB', P.A, P.B], ['BC', P.B, P.C], ['CD', P.D, P.C], ['DA', P.D, P.A]].filter((l) => !this.state.tap[l[0]])
      .map((l) => ({ k: l[0], d: Math.hypot(c.x - (l[1].x + l[2].x) / 2, c.y - (l[1].y + l[2].y) / 2) }))
      .sort((a, b) => a.d - b.d);
    const act = this.activeSide(), hit = legs.find((l) => l.k === act);
    if (hit && hit.d < 110) this.measureLeg(act);
    else { this.rulerBusy = true; this.animRuler(this.rulerHome(), 350, () => { this.rulerBusy = false; }); }
  }
  up(e) {
    if (this.conn && this.conn.live) return this.connUp(e);
    if (this.rd) return this.rulerUp();
    if (!this.drag) return;
    const k = this.drag.k;
    this.drag = null;
    this.setState({ dragging: null });
    this.checkDrag(k);
  }
  checkDrag(k) {
    const st = this.cur(), s = this.state, P = this.clone(s.P);
    if (st.task === 'dragA' && !s.done) {
      const ad = this.dist(P.A, P.D), bc = this.dist(P.B, P.C);
      if (Math.abs(ad - bc) < CONFIG.snap.equalLegsCm * this.S) {
        P.A.x = P.D.x + (P.C.x - P.B.x);
        this.setState({ P: P });
        this.finishTask();
      } else if (s.moved) {
        this.sfx('bad'); this.interject({ t: ad > bc ? 'AD is still longer than BC. Keep dragging A.' : 'Now AD is shorter than BC. Drag A back a little.' });
      }
    } else if (st.task === 'dragB' && !s.done) {
      const tx = P.C.x + (P.A.x - P.D.x); // where B makes BC parallel to AD
      if (Math.abs(P.B.x - tx) < CONFIG.snap.parallelPx) {
        P.B.x = tx;
        this.setState({ P: P });
        this.finishTask();
      } else if (s.moved) {
        this.sfx('bad'); this.interject({ t: P.B.x < tx ? 'BC is not parallel to AD yet. Keep dragging B to the right.' : 'B went too far. Drag it back a little.' });
      }
    } else if (st.task === 'dragD90' && !s.done) {
      const a = this.angle(P, 'A');
      if (Math.abs(a - 90) < CONFIG.snap.rightAngleDeg) {
        P.D.x = P.A.x;
        this.setState({ P: P });
        this.finishTask();
      } else if (s.moved) {
        this.sfx('bad'); this.interject({ t: '∠A is ' + Math.round(a) + '° now. ' + (a > 90 ? 'Keep dragging D to the right.' : 'Drag D back to the left a little.') });
      }
    } else if (st.task === 'dragFree' && !s.done && s.moved) {
      this.finishTask();
    } else if (st.task === 'drag90' && !s.done && s.moved) {
      // snap when the dragged corner's leg is close to a right angle
      const left = k === 'A' || k === 'D', a = this.angle(P, left ? 'A' : 'B');
      if (Math.abs(a - 90) < CONFIG.snap.rightAngleDeg) {
        if (k === 'A') P.A.x = P.D.x; if (k === 'D') P.D.x = P.A.x; if (k === 'B') P.B.x = P.C.x; if (k === 'C') P.C.x = P.B.x;
        this.setState({ P: P });
        this.finishTask();
      } else {
        this.sfx('bad'); this.interject({ t: '∠' + k + ' is ' + Math.round(this.angle(P, k)) + '° now. Keep dragging until it shows 90°.' });
      }
    } else if (st.task === 'dragAny' && !s.done && s.moved) {
      if (Math.abs(this.dist(P.A, P.D) - this.dist(P.B, P.C)) >= CONFIG.snap.equalLegsCm * 2 * this.S) this.finishTask();
      else { this.sfx('bad'); this.interject({ t: 'The legs are still equal. Drag a corner a little further.' }); }
    } else if ((st.task === 'dragD' || st.task === 'dragC') && !s.done && s.moved) {
      this.finishTask();
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
      this.setState({ picks: picks, toast: null });
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
    this.setState({ diag: diag, toast: null });
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
      this.setState({ fill: Object.assign({}, F, { at: at, locked: locked, bad: {}, open: null, closing: false }), toast: null });
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
    this.setState({ fill: Object.assign({}, F, { at: at, sel: null, bad: {} }), toast: null });
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
  labPos(id) {
    const c4 = this.state.c4;
    if (c4.drag && c4.drag.id === id) return { x: c4.drag.x, y: c4.drag.y };
    if (c4.at[id]) { const sl = this.slotsDef().find((q) => q.id === c4.at[id]); return { x: 840 + 52, y: sl.y + 7 }; } // 180-wide label centred in the 284-wide box
    const i = this.labsDef().findIndex((l) => l.id === id);
    return { x: 594 + i * 192, y: 480 }; // three 180-wide cards, 12 apart, centred under the panel (x 876)
  }
  labDown(id, e) {
    const c4 = this.state.c4;
    if (c4.locked[id] || c4.checking || this.state.done || this.ld) return;
    const tgt = e.currentTarget;
    const root = tgt && tgt.closest ? tgt.closest('.stage') : null;
    if (!root) return;
    const r = root.getBoundingClientRect(), sc = r.width / 1280 || 1;
    const pos = this.labPos(id);
    const px = (e.clientX - r.left) / sc, py = (e.clientY - r.top) / sc;
    this.ld = { id: id, r: r, sc: sc, ox: px - pos.x, oy: py - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
    try { tgt.setPointerCapture(e.pointerId); } catch (err) {}
    if (e.preventDefault) e.preventDefault();
  }
  rootMove(e) {
    if (this.conn && this.conn.live) return this.connMove(e);
    if (this.fd) return this.tileMove(e);
    if (this.drag || this.rd) return this.move(e);
    const L = this.ld;
    if (!L) return;
    if (!L.moved && Math.hypot(e.clientX - L.sx, e.clientY - L.sy) < 6) return;
    L.moved = true;
    const px = (e.clientX - L.r.left) / L.sc, py = (e.clientY - L.r.top) / L.sc;
    this.setState({ c4: Object.assign({}, this.state.c4, { drag: { id: L.id, x: px - L.ox, y: py - L.oy, px: px, py: py }, sel: null }) });
  }
  rootUp(e) {
    if (this.conn && this.conn.live) return this.connUp(e);
    if (this.fd) return this.tileUp(e);
    if (this.drag || this.rd) return this.up(e);
    const L = this.ld;
    if (!L) return;
    this.ld = null;
    const c4 = Object.assign({}, this.state.c4, { drag: null });
    if (!L.moved) {
      c4.sel = c4.sel === L.id ? null : L.id;
      this.setState({ c4: c4 });
      this.sfx('tap');
      return;
    }
    const px = (e.clientX - L.r.left) / L.sc, py = (e.clientY - L.r.top) / L.sc;
    const slot = this.slotsDef().find((q) => px > 840 - 20 && px < 840 + 284 + 20 && py > q.y - 20 && py < q.y + 64 + 20);
    if (slot && !c4.checking) this.place(L.id, slot.id, c4);
    else { const at = Object.assign({}, c4.at); at[L.id] = null; this.setState({ c4: Object.assign(c4, { at: at }) }); }
  }
  slotTap(slotId) {
    const c4 = this.state.c4;
    if (!c4.sel || c4.checking || this.state.done) return;
    this.place(c4.sel, slotId, Object.assign({}, c4));
  }
  place(labId, slotId, c4) {
    const at = Object.assign({}, c4.at);
    for (const k in at) { if (at[k] === slotId && k !== labId) { if (c4.locked[k]) return this.setState({ c4: c4 }); at[k] = null; } }
    at[labId] = slotId;
    this.setState({ c4: Object.assign({}, c4, { at: at, sel: null, drag: null }) });
    this.sfx('pop');
    if (at.iso && at.right && at.scal) {
      this.setState({ c4: Object.assign({}, this.state.c4, { checking: true }) });
      const tok = this.stepTok;
      this.tm(() => { if (tok === this.stepTok) this.check4(); }, 380);
    }
  }
  check4() {
    const st = this.cur(), s = this.state, c4 = s.c4;
    const at = Object.assign({}, c4.at), locked = Object.assign({}, c4.locked);
    let all = true;
    Object.keys(at).forEach((k) => {
      const sl = this.slotsDef().find((q) => q.id === at[k]);
      if (sl && sl.ans === k) locked[k] = true; else { at[k] = null; all = false; }
    });
    this.setState({ c4: Object.assign({}, c4, { at: at, locked: locked, checking: false }) });
    if (all) {
      const results = Object.assign({}, s.results);
      if (results[st.id] === undefined) results[st.id] = s.cfuFirst;
      this.setState({ done: true, results: results });
      this.cheer();
      this.interject({ m: CONFIG.swiftee.correct, t: st.ok });
    } else {
      this.setState({ cfuFirst: false });
      this.sfx('bad');
      this.interject({ m: CONFIG.swiftee.wrong, t: st.retry || 'Some labels went back. Try again.' });
      this.poke();
    }
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
    const apex = this.inter(A, D, B, C) || { x: (A.x + B.x) / 2, y: A.y - 60 };
    const g = {};
    g.move = (e) => this.move(e);
    g.up = (e) => this.up(e);
    g.poly = [A, B, C, D].map((p) => r1(p.x) + ',' + r1(p.y)).join(' ');
    // legGlow: AD and BC are emphasised (bolder in their own colour), so the learner knows which two sides "will meet"
    const waitFocusG = st.layout === 'focus' && !s.centered;
    const said = (k) => !!(s.glow && s.glow.indexOf(k) >= 0);
    const glowLeg = (k) => !!f.legGlow || said(k) || (task === 'extLegs' && !st.auto && !s.done && !waitFocusG && !(s.ext[k] > 0));
    const act = task === 'measure' ? this.activeSide() : null;
    const meas = (k) => task === 'measure' && (!!s.tap[k] || s.measuring === k);
    // A highlighted side ("lit": legGlow, a line's glow, the side being measured / tapped) gets the highlighter look:
    // a band drawn on under it (.hl), a ring bead gliding back and forth along it (g.bXX) and, while only some sides
    // are lit, the other sides dim (.edge.dim). All four lit (the whole outline named) = bands only, nothing dims.
    const lit = {};
    const band = (k, p, q, on) => {
      lit[k] = st.auto ? on : (on || act === k || meas(k));
      const said1 = !lit[k] && s.emph && s.emph[k]; // named in the voice-over: a short band flash (CONFIG.emph.holdMs)
      return seg(p, q, lit[k] || !!said1, { cls: lit[k] ? 'hl' : 'hl flash' });
    };
    g.hDA = band('DA', D, A, glowLeg('DA'));
    g.hBC = band('BC', B, C, glowLeg('BC'));
    const glowBase = (k) => said(k) || (task === 'extBases' && !st.auto && !s.done && !waitFocusG && !(s.ext[k] > 0));
    g.hAB = band('AB', A, B, glowBase('AB'));
    g.hCD = band('CD', D, C, glowBase('CD'));
    const nLit = ['AB', 'BC', 'CD', 'DA'].filter((k) => lit[k]).length;
    const bead = (k, p, q) => {
      const L = this.dist(p, q), on = lit[k] && nLit <= 2 && L > 30;
      return { tf: 'translate(' + r1(p.x) + ' ' + r1(p.y) + ') rotate(' + r1(Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI) + ')', L: r1(L), d: dsp(on) };
    };
    // a parallel pair's beads travel the same way (A->B with D->C, D->A with C->B)
    g.bAB = bead('AB', A, B); g.bBC = bead('BC', C, B); g.bCD = bead('CD', D, C); g.bDA = bead('DA', D, A);
    {
      const tp = s.tape, ends = tp ? this.walkEnds(tp.leg) : null;
      if (ends) {
        const L = this.dist(ends[0], ends[1]) || 1, ux = (ends[1].x - ends[0].x) / L, uy = (ends[1].y - ends[0].y) / L;
        const cx = (A.x + B.x + C.x + D.x) / 4, cy = (A.y + B.y + C.y + D.y) / 4;
        let nx = -uy, ny = ux; if (nx * (ends[0].x - cx) + ny * (ends[0].y - cy) < 0) { nx = -nx; ny = -ny; }
        const off = 7, p0 = { x: ends[0].x + nx * off, y: ends[0].y + ny * off }; // the tape lies alongside the side, outside it
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
    const met = !!f.met;
    g.xA = seg(A, lerp(A, apex, met ? 1 : s.ext.DA), (task === 'extLegs' && s.ext.DA > 0) || met);
    g.xB = seg(B, lerp(B, apex, met ? 1 : s.ext.BC), (task === 'extLegs' && s.ext.BC > 0) || met);
    g.apex = { x: r1(apex.x - 6.5), y: r1(apex.y - 6.5), d: dsp((task === 'extLegs' && s.done) || met) };
    // screens 4-5: the glowing line being drawn along a side (from -> to) before its dotted extension draws on
    const tr = s.trace, tm = tr && tr.mid ? lerp(tr.from, tr.to, 0.5) : null; // centre-out (bases): both ends grow from the middle
    g.trace = tr ? seg(tm ? lerp(tm, tr.from, tr.t) : tr.from, lerp(tm || tr.from, tr.to, tr.t), true, { cls: 'trace' + (tr.out ? ' out' : '') }) : seg(D, D, false, { cls: 'trace' });
    const be = (key, p, q) => {
      const t = f.baseExt ? 1 : (task === 'extBases' ? s.ext[key] : 0);
      return seg({ x: p.x - (p.x + 10) * t, y: p.y }, { x: q.x + (530 - q.x) * t, y: q.y }, t > 0);
    };
    g.xAB = be('AB', A, B);
    g.xCD = be('CD', D, C);
    // edges
    // shape colours (CONFIG.palette): every side in the line colour, except a trapezium's legs once its parallel pair has
    // been found (AB, CD marked parallel, AD, BC not): they turn slate, so the parallel pair stands out. The moment the
    // drag makes BC parallel to AD (a parallelogram) they take the line colour again.
    const PAL = CONFIG.palette, OR = '#f08a24', PU = '#8e44d6', pgShape = this.isPg(P);
    const legsPlain = !!f.par && !f.par2 && !pgShape;
    const baseCol = (k) => (st.id === 'bases' && s.tap[k] ? OR : PAL.line);
    const pair2 = !!f.par2 || (task === 'dragB' && pgShape); // both pairs marked: AD, BC wear the second pair's colour
    const legCol = (k) => ((st.id === 'legs' && s.tap[k]) || f.legsPurple ? PU : pair2 ? PAL.pair2 : legsPlain ? PAL.slate : PAL.line);
    // flash (auto extend), wiggle (wrong-way drag), emph (named in the voice-over), lit / dim (highlighter focus)
    const eCls = (k) => 'e' + k + ' ' + (s.flash === k ? 'flash' : '') + (s.wig === k ? ' wiggle' : '') + (s.emph && s.emph[k] ? ' emph' : '') +
      (lit[k] ? ' lit' : nLit && nLit < 4 ? ' dim' : '');
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
    // the build's highlighter trail: a band follows the pen round the outline, then fades away as the fill comes in
    g.trail = seg(D, D, false);
    if (bd && (building || bd.settle)) {
      const ends = { DA: [D, A], AB: [A, B], BC: [B, C], CD: [D, C] };
      Object.keys(ends).forEach((k) => { g['h' + k] = seg(ends[k][0], ends[k][1], edgeOn(k), { cls: 'hl trail' + (building ? '' : ' out') }); });
      if (building && bd.d > 0) g.trail = Object.assign({}, g.trace, { d: 'inline' });
    }
    g.eAB = seg(A, B, edgeOn('AB'), { c: baseCol('AB'), cls: eCls('AB') });
    g.eCD = seg(C, D, edgeOn('CD'), { c: baseCol('CD'), cls: eCls('CD') });
    g.eBC = seg(B, C, edgeOn('BC'), { c: legCol('BC'), cls: eCls('BC') });
    g.eDA = seg(D, A, edgeOn('DA'), { c: legCol('DA'), cls: eCls('DA') });
    // bases callout: hidden again once the learner taps a base (the tapped sides get their own "Base" tags)
    {
      const legs = s.callout === 'legs';
      const show = (s.callout === 'bases' && !s.tap.AB && !s.tap.CD) || (legs && !s.tap.DA && !s.tap.BC);
      // one pill label per side: a soft rounded pill just outside the side's midpoint, joined to it by a short solid
      // tail in the pill's own border colour (no dot). Bases: above AB / below CD. Legs: out from each leg.
      // First pill yellow, second lilac; both appear together and follow the shape.
      const W = legs ? 64 : 78, H = 32, cx0 = (A.x + B.x + C.x + D.x) / 4, cy0 = (A.y + B.y + C.y + D.y) / 4;
      const pill = (p, q, vert) => {
        const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, L = this.dist(p, q) || 1;
        let nx = vert ? 0 : -(q.y - p.y) / L, ny = vert ? (m.y < cy0 ? -1 : 1) : (q.x - p.x) / L;
        if (!vert && nx * (m.x - cx0) + ny * (m.y - cy0) < 0) { nx = -nx; ny = -ny; }
        const ext = (W / 2) * Math.abs(nx) + (H / 2) * Math.abs(ny), dot = 10, gap = 12; // tail starts clear of the stroke + parallel arrows
        const c = { x: m.x + nx * (dot + gap + ext), y: m.y + ny * (dot + gap + ext) };
        const d0 = { x: m.x + nx * dot, y: m.y + ny * dot }, e = { x: c.x - nx * ext, y: c.y - ny * ext };
        return { x: r1(c.x - W / 2), y: r1(c.y - H / 2), tx: r1(c.x), ty: r1(c.y + 6), dx: r1(d0.x), dy: r1(d0.y),
          stem: 'M' + r1(d0.x) + ',' + r1(d0.y) + ' L' + r1(e.x) + ',' + r1(e.y) };
      };
      g.cal = { d: dsp(show), tb: dsp(!legs), tl: dsp(legs), w: W,
        p1: legs ? pill(D, A, false) : pill(A, B, true), p2: legs ? pill(B, C, false) : pill(D, C, true) };
    }
    // equal-leg ticks
    const ad = this.dist(A, D), bc = this.dist(B, C);
    const equal = Math.abs(ad - bc) < 0.5;
    const tick = (p, q, one, t) => { // t: where along p->q (default the middle)
      const t0 = t == null ? 0.5 : t, mx = p.x + (q.x - p.x) * t0, my = p.y + (q.y - p.y) * t0, L = this.dist(p, q) || 1;
      const dx = (q.x - p.x) / L, dy = (q.y - p.y) / L, nx = -dy, ny = dx;
      let out = '';
      (one ? [0] : [-3, 3]).forEach((k) => {
        const cx = mx + dx * k, cy = my + dy * k;
        out += 'M' + r1(cx - nx * 9) + ',' + r1(cy - ny * 9) + ' L' + r1(cx + nx * 9) + ',' + r1(cy + ny * 9) + ' ';
      });
      return out;
    };
    // ---- side markings: one coordinate-based system (CONFIG.marks) ----
    // For every side, from its two vertices: the true midpoint m, the unit vector u along the side and n across it.
    // Parallel arrows point along u (the same way on both sides of a pair: A->B and D->C, D->A and C->B) - two
    // chevrons on AB, CD and one on AD, BC; equal-length ticks are drawn across the side (n) - one on AB, CD and two on
    // AD, BC. A side carrying both has its arrows MK.gap before the midpoint and its ticks MK.gap after it, so the pair
    // is symmetric about the midpoint; a side carrying one kind has it centred on the midpoint. Rebuilt every frame
    // from the vertices, so the marks stay on their sides through drags, scaling and moves.
    const pgNow = this.isPg(P), MK = CONFIG.marks;
    const showPar1 = !!f.par, showPar2 = !!(f.par2 || (task === 'dragB' && pgNow));
    const showTk = !!(f.ticks || (task === 'dragA' && s.done && equal) || (task === 'dragAny' && equal));
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
    g.ch = { p: (arrows('AB') + arrows('CD')) || 'M0,0', d: dsp(showPar1) };
    g.ch2 = { p: (arrows('DA') + arrows('BC')) || 'M0,0', d: dsp(showPar2) };
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
    // supp: two adjacent angles side by side on one straight line. For the pair XY the demo sits at Y: Y's own angle,
    // and a copy of X's angle sliding over from X into the gap between side YX and side ZY made longer past Y
    {
      const pair = f.supp && s.supp != null ? f.supp[s.supp] : null;
      if (pair) {
        const X = pair[0], Y = pair[1], Z = this.nb(Y).find((k) => k !== X), Py = P[Y], Rr = 34;
        const un = (p, q) => { const L = this.dist(p, q) || 1; return { x: (q.x - p.x) / L, y: (q.y - p.y) / L }; };
        const toX = un(Py, P[X]), toZ = un(Py, P[Z]), ext = { x: -toZ.x, y: -toZ.y };
        const wedge = (a, b) => { const cr = a.x * b.y - a.y * b.x;
          return 'M' + r1(Py.x) + ',' + r1(Py.y) + ' L' + r1(Py.x + a.x * Rr) + ',' + r1(Py.y + a.y * Rr) + ' A' + Rr + ',' + Rr + ' 0 0 ' + (cr > 0 ? 1 : 0) + ' ' + r1(Py.x + b.x * Rr) + ',' + r1(Py.y + b.y * Rr) + ' Z'; };
        const col = (k) => (k === 'A' || k === 'C' ? PAL.vA : PAL.vB);
        g.sp = { d: 'inline', line: 'M' + r1(Py.x + toZ.x * 70) + ',' + r1(Py.y + toZ.y * 70) + ' L' + r1(Py.x + ext.x * 70) + ',' + r1(Py.y + ext.y * 70),
          own: wedge(toX, toZ), cOwn: col(Y), copy: wedge(toX, ext), cCopy: col(X), cls: 'supp-copy ' + (s.supp % 2 ? 'sB' : 'sA'),
          dx: r1(P[X].x - Py.x) + 'px', dy: r1(P[X].y - Py.y) + 'px' };
      } else g.sp = { d: 'none', line: 'M0,0', own: 'M0,0', copy: 'M0,0', cOwn: PAL.vB, cCopy: PAL.vA, cls: 'supp-copy', dx: '0px', dy: '0px' };
    }
    g.oDot = { x: r1(O.x), y: r1(O.y), d: dsp(f.O) };
    // hticks: equal halves marked like equal sides (one tick on OA and OC, two on OB and OD)
    g.htk = { p: tick(O, A, true) + tick(O, C, true) + tick(O, B) + tick(O, D), d: dsp(f.hticks) };
    // angles
    const V = this.vals(P);
    const arcSet = (f.arcs || '') + (task === 'tapAngles' || task === 'tapAD' ? Object.keys(s.ang).join('') : '');
    const foundAC = f.pairCol || f.pairA || (task === 'tapEq' && st.ref === 'A' && s.done);
    const foundBD = f.pairCol || (task === 'tapEq' && st.ref === 'D' && s.done);
    const pairCls = (k) => ((k === 'A' || k === 'C') ? (foundAC ? ' pa' : '') : (foundBD ? ' pb' : ''));
    const unit = (p, q) => { const L = this.dist(p, q) || 1; return { x: (q.x - p.x) / L, y: (q.y - p.y) / L }; };
    const aTag = {}, em = s.emph || {}; // parts the voice-over is naming right now
    // angle focus: while a line names angles ("∠A and ∠D..."), the other arcs and their values fade back (s.aFocus)
    const aDim = (k) => (s.aFocus && !s.aFocus[k] ? ' dim' : '');
    // Angle marks are laid out from the corner's own geometry so they always sit inside the shape:
    //  - the arc is centred on the vertex and its sweep is trimmed at both ends, so its round caps (and the
    //    1.3x voice-over emphasis) stay clear of the two sides instead of poking across them;
    //  - the degree label rides the interior bisector, pushed out just far enough that its whole box clears both
    //    sides and the arc; a corner too tight for that gets the smaller label size.
    const AS = { arcW: 7, edgeW: 5, gap: 5, labH: 24, labHsm: 20 };
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const n = this.nb(k), Vk = P[k], u = unit(Vk, P[n[0]]), v = unit(Vk, P[n[1]]);
      const cross = u.x * v.y - u.y * v.x;
      const half = Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) / 2; // half the interior angle
      const R = half < 0.35 ? 30 : 24; // very sharp corners: a little wider, so the arc clears the corner dot
      // trim each end by the angle that keeps the cap + half the side's stroke off that side
      const trim = Math.min(half * 0.8, Math.asin(Math.min(1, (AS.arcW / 2 + AS.edgeW / 2 + 1) / R)));
      const rot = (w, a) => ({ x: w.x * Math.cos(a) - w.y * Math.sin(a), y: w.x * Math.sin(a) + w.y * Math.cos(a) });
      const sgn = cross > 0 ? 1 : -1, us = rot(u, sgn * trim), ve = rot(v, -sgn * trim); // both turned toward the inside
      const sx = Vk.x + us.x * R, sy = Vk.y + us.y * R, ex = Vk.x + ve.x * R, ey = Vk.y + ve.y * R;
      const show = arcSet.indexOf(k) >= 0;
      const isRight = Math.abs(this.angle(P, k) - 90) < 0.5;
      // when several angles light up together they draw in one after another
      const stag = (f.arcs || '').length > 1 ? ' d' + (f.arcs || '').indexOf(k) : '';
      g['a' + k] = { p: 'M' + r1(sx) + ',' + r1(sy) + ' A' + R + ',' + R + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + r1(ex) + ',' + r1(ey), d: dsp(show), cls: 'arc k' + k + stag + pairCls(k) + (em['a' + k] ? ' emph' : '') + (fig && s.done ? '' : aDim(k)), o: r1(Vk.x) + 'px ' + r1(Vk.y) + 'px' };
      const q = 15;
      g['r' + k] = {
        p: 'M' + r1(Vk.x + u.x * q) + ',' + r1(Vk.y + u.y * q) + ' L' + r1(Vk.x + u.x * q + v.x * q) + ',' + r1(Vk.y + u.y * q + v.y * q) + ' L' + r1(Vk.x + v.x * q) + ',' + r1(Vk.y + v.y * q),
        d: dsp(isRight && (f.right || show))
      };

      let bx = u.x + v.x, by = u.y + v.y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
      const at = fig ? this.figVal(this.cur(), k, (fig.angles || {})[k] || '') : V[k] + '°';
      // how far along the bisector the label's centre must be: its box (w x h, estimated from the text) has to clear
      // each side by `gap` (the box's reach toward a side is w/2|nx| + h/2|ny| for that side's normal n), and clear the
      // arc (radius + half its stroke + gap, plus the box's reach back toward the vertex)
      const sinH = Math.max(0.12, Math.sin(half));
      const need = (w, h) => {
        const side = (e) => { const nx = -e.y, ny = e.x; return (AS.gap + AS.edgeW / 2 + w / 2 * Math.abs(nx) + h / 2 * Math.abs(ny)) / sinH; };
        const arc = R * 1.15 + AS.arcW / 2 + AS.gap + w / 2 * Math.abs(bx) + h / 2 * Math.abs(by); // 1.15: room for the emphasis zoom
        return Math.max(side(u), side(v), arc);
      };
      // room: stay well short of the far corners (half the shorter neighbouring side)
      const room = 0.5 * Math.min(this.dist(Vk, P[n[0]]), this.dist(Vk, P[n[1]]));
      const len = Math.max(4, at.length || 1), wN = 14 + 10.5 * len, wS = 12 + 8.6 * len; // at least '110°' wide: the same radius for every label
      let small = false, dl = need(wN, AS.labH);
      if (dl > room) { small = true; dl = need(wS, AS.labHsm); }
      aTag[k] = { t: at, x: r1(Vk.x + bx * dl), y: r1(Vk.y + by * dl), cls: 'alab' + (small ? ' sm' : '') + stag + (show ? '' : ' off') + (at.indexOf('?') >= 0 ? ' q' : fig && ((fig.angles || {})[k] || '').indexOf('?') >= 0 ? ' solved' : '') + (em['a' + k] ? ' emph' : '') + (fig && s.done ? '' : aDim(k)) };
    });
    // vertices
    const dk = this.dragKey();
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const anyV = this.anyCorner(), Vk = P[k], drag = dk === k || anyV;
      // noDots hides the corner dots, but never the handle of a corner the learner can drag
      // a corner named in the voice-over grows into a highlighter ring
      g['v' + k] = { x: r1(Vk.x), y: r1(Vk.y), r: vOn(k) && (!f.noDots || drag) ? (drag ? 11 : 7) + (em['v' + k] ? 4 : 0) : 0,
        c: em['v' + k] ? PAL.hlRing : drag ? PU : PAL.dot, w: em['v' + k] ? 4.5 : drag ? 4 : 3 };
      const tapV = (task === 'tapAngles' || task === 'tapAD' || task === 'tapEq') && !s.done;
      const conn = task === 'connect' && !s.done && !fig;
      const pulse = (tapV && !s.ang[k] && (task === 'tapAngles' || (task === 'tapEq' ? k !== st.ref : k === 'A' || k === 'D'))) ||
        (conn && !(s.conn && s.conn.from === k));
      g['k' + k] = {
        x: r1(Vk.x), y: r1(Vk.y), d: dsp(tapV || drag || conn), cls: (pulse || (anyV && !s.dragging)) && !this.busy() ? 'vp' : '',
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
    const R = s.ruler || this.rulerHome();
    g.rl = {
      tf: 'translate(' + r1(R.x) + ' ' + r1(R.y) + ') rotate(' + r1(R.a) + ') scale(1 ' + (Math.round((R.sy == null ? 1 : R.sy) * 100) / 100 || 0.01) + ')',
      cls: (R.sy == null ? 1 : R.sy) < 0 ? 'ruler turned' : 'ruler',
      d: 'none', // (the ruler is replaced by Swiftee's walking measurement)
      cur: s.done ? 'default' : (s.rulerDrag ? 'grabbing' : 'grab'),
      down: (e) => this.rulerDown(e)
    };
    // edge hit areas
    const waitFocus = st.layout === 'focus' && !s.centered; // listen first: the shape wakes up when it reaches centre
    const edgeTask = ['extLegs', 'extBases', 'tapBases', 'tapLegs', 'measure'].indexOf(task) >= 0 && !s.done && !waitFocus && !((task === 'extLegs' || task === 'extBases') && st.auto);
    const pulseEdge = (k) => {
      const leg = k === 'DA' || k === 'BC';
      if (task === 'extLegs') return false; // shown by the yellow leg band instead
      if (task === 'extBases') return false; // shown by the yellow band instead
      if (task === 'measure') return false; // the active side's yellow band leads instead
      return false;
    };
    const hit = (k, p, q) => seg(p, q, edgeTask, { cls: edgeTask && pulseEdge(k) ? 'hitp' : '', click: edgeTask ? () => this.tapEdge(k) : noop });
    g.tAB = hit('AB', A, B); g.tBC = hit('BC', B, C); g.tCD = hit('CD', C, D); g.tDA = hit('DA', D, A);
    // labels: a fixed set of slots (hidden ones get "off") so each tag keeps its element and
    // only animates when it first appears
    const cx = (A.x + B.x + C.x + D.x) / 4, cy = (A.y + B.y + C.y + D.y) / 4;
    const tags = [];
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const Vk = P[k]; let dx = Vk.x - cx, dy = Vk.y - cy; const L = Math.hypot(dx, dy) || 1;
      // letterIn (screen 3): each corner letter stays hidden until the voice says it, then flies in from its corner
      const lin = st.letterIn ? ' vin c' + k : '';
      tags.push({ t: k, x: r1(Vk.x + dx / L * 25), y: r1(Vk.y + dy / L * 25), cls: 'vlab' + (vOn(k) && !f.noLetters ? '' : ' off') + lin });
    });
    ['A', 'B', 'C', 'D'].forEach((k) => tags.push(aTag[k]));
    // O: the diagonals' meeting point, its letter just above it (between the two diagonals)
    tags.push({ t: 'O', x: r1((A.x + C.x) / 2), y: r1((A.y + C.y) / 2 - 26), cls: 'vlab' + (f.O ? '' : ' off') });
    // a checkpoint's half-diagonal labels (e.g. AO = 6 cm), beside the middle of each half
    if (fig && fig.halves) {
      const Om = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
      const found = this.figHalves(this.cur()), H = Object.assign({}, fig.halves, found);
      Object.keys(H).forEach((k) => {
        const nb = { A: 'B', B: 'A', C: 'D', D: 'C' }[k], M = { x: (P[k].x + P[nb].x) / 2, y: (P[k].y + P[nb].y) / 2 };
        const g = { x: 0.28 * Om.x + 0.3 * P[k].x + 0.42 * M.x, y: 0.28 * Om.y + 0.3 * P[k].y + 0.42 * M.y }; // toward the side: clear of the tick at the half's midpoint
        tags.push({ t: H[k], x: r1(g.x), y: r1(g.y), cls: 'mtag fig' + (found[k] ? ' solved' : '') });
      });
    }
    // a tag beside a side, pushed out along the side's outward normal far enough that its box clears the line
    const side = (p, q, text, cls, show) => {
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, L = this.dist(p, q) || 1;
      let nx = -(q.y - p.y) / L, ny = (q.x - p.x) / L;
      if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
      // the label's own box (css: plain 22px Nunito 900, no padding): half width / half height in board px
      const hw = this.textW(text, '900 22px Nunito') / 2, hh = 14;
      // its nearest point is labelGap clear of the side - the same gap on every side, past the ticks and arrows
      const off = hw * Math.abs(nx) + hh * Math.abs(ny) + (CONFIG.marks.labelGap || 12);
      return { t: text, x: r1(mx + nx * off), y: r1(my + ny * off), cls: cls + (show ? '' : ' off') };
    };
    {
      const on = !!f.sums;
      // the two sums sit in a row below the shape (clear of the D/C labels), each centred under its own leg
      // (AD left, BC right) and following it as corners are dragged. Beside the legs there is no room: the left
      // leg can run right up to the panel edge, which pushed the boxes onto the lines and the angle tags.
      // Kept inside the panel and at least SUM_GAP apart, spreading out from their midpoint when the legs close in.
      const tL = V.A + '° + ' + V.D + '° = 180°', tR = V.B + '° + ' + V.C + '° = 180°';
      const hw = (t) => (t.length * 9.6 + 32) / 2, wL = hw(tL), wR = hw(tR), SUM_GAP = 16;
      const lo = -110, hi = 560; // board x the panel interior spans (stage ~541..1211, right of Swiftee's bubble)
      let xL = (A.x + D.x) / 2, xR = (B.x + C.x) / 2;
      const need = wL + wR + SUM_GAP;
      if (xR - xL < need) { const m = (xL + xR) / 2; xL = m - need / 2; xR = m + need / 2; }
      if (xL - wL < lo) { const d = lo - (xL - wL); xL += d; xR = Math.max(xR, xL + need); }
      if (xR + wR > hi) { const d = xR + wR - hi; xR -= d; xL = Math.min(xL, xR - need); }
      const yS = Math.max(D.y, C.y) + 62;
      tags.push({ t: tL, x: r1(xL), y: r1(yS), cls: 'mtag sum' + (on ? '' : ' off') });
      tags.push({ t: tR, x: r1(xR), y: r1(yS), cls: 'mtag sum' + (on ? '' : ' off') });
    }
    // (the measuring tape carries tick marks only - no numbers; each side's length is shown once, outside the shape)
    const isB = st.id === 'bases', isL = st.id === 'legs', isM = st.id === 'measure';
    tags.push(side(A, B, 'Base', 'btag', isB && !!s.tap.AB));
    tags.push(side(D, C, 'Base', 'btag', isB && !!s.tap.CD));
    tags.push(side(D, A, 'Leg', 'ltag', isL && !!s.tap.DA));
    tags.push(side(B, C, 'Leg', 'ltag', isL && !!s.tap.BC));
    tags.push(side(D, A, this.cm(ad), 'mtag', isM && !!s.tap.DA)); // values only, no side names
    tags.push(side(B, C, this.cm(bc), 'mtag', isM && !!s.tap.BC));
    tags.push(side(A, B, this.cm(this.dist(A, B)), 'mtag', isM && !!s.tap.AB));
    tags.push(side(D, C, this.cm(this.dist(D, C)), 'mtag', isM && !!s.tap.CD)); // all four outside their sides
    const near = Math.abs(ad - bc) < CONFIG.snap.equalLegsCm * this.S;
    const eqCls = 'mtag' + ((task === 'dragA' && near) || (task === 'dragAny' && near) || st.id === 'iso' ? ' eq' : '');
    const lon = (k) => !f.lenSeq || !!(s.lenOn && s.lenOn[k]);
    tags.push(side(D, A, this.cm(ad), eqCls, !!f.legLen && lon('DA')));
    tags.push(side(B, C, this.cm(bc), eqCls, !!f.legLen && lon('BC')));
    tags.push(side(A, B, this.cm(this.dist(A, B)), 'mtag', !!f.sideLen && lon('AB')));
    tags.push(side(D, C, this.cm(this.dist(D, C)), 'mtag', !!f.sideLen && lon('CD')));
    if (fig && fig.sides) {
      const E = { AB: [A, B], BC: [B, C], CD: [D, C], DA: [D, A] };
      Object.keys(fig.sides).forEach((k) => { const t = this.figVal(this.cur(), k, fig.sides[k]); tags.push(side(E[k][0], E[k][1], t, 'mtag fig' + (t.indexOf('?') >= 0 ? ' q' : fig.sides[k].indexOf('?') >= 0 ? ' solved' : ''), true)); });
    }
    // sideNums (screen 2): the four sides numbered clockwise from the left (storyboard page 2): 1 left, 2 top, 3 right,
    // 4 bottom - each number flies in from its
    // own side's direction, one after another (CSS .snum: ease-out, slight overshoot, 90% -> 100% scale)
    {
      const on = !!(st.sideNums || st.letterIn), gone = ''; // kept on screen 3 so they can fade out (Motion.fadeOut)
      tags.push(side(D, A, '1', 'snum n1 from-left' + gone, on));
      tags.push(side(A, B, '2', 'snum n2 from-top' + gone, on));
      tags.push(side(B, C, '3', 'snum n3 from-right' + gone, on));
      tags.push(side(D, C, '4', 'snum n4 from-bottom' + gone, on));
    }
    return { g: g, tags: tags, V: V };
  }

  // explanation and task screens: the shape shown bigger (CONFIG.scene.zoom), about the opening shape's centre (a fixed
  // point, so the board never shifts while a corner is dragged); questions and checkpoints keep it at 1
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
  zoomed(st) { return !(st.opts || st.fill || st.grid || st.fig || st.cfu || st.end || st.noBoard) && (CONFIG.scene.zoom || 1) !== 1; }
  // a zoomed screen: the shape (as it was when the screen opened, so nothing shifts while a corner is dragged) is
  // scaled about its centre and that centre placed at CONFIG.scene.zoomAt (board px) - the panel's upper middle, clear
  // of the card row. Unzoomed screens keep their usual nudge (boardShiftY).
  // The card (reference: the Fishing Frenzy lesson's fitPlate): each screen's shape - as it opens, plus every place a
  // drag can take it - is fitted into a box in the middle of the card, padded for its letters and labels, never bigger
  // than the reference's own scale (CONFIG.card.maxScale), and centred on it. A screen with answers under the shape
  // uses a shorter box higher up, so the answers have the bottom of the card. Returns the scale, the shape point that
  // sits at the box's centre, and the shape's bottom on the stage (the name plates and answers go under it).
  // One size on every screen: the shape is always drawn at CONFIG.card.scale (the first screens' size), so it never grows
  // or shrinks between screens. Each screen is a vertical stack - the shape (padded for its letters and labels), then
  // the block under it (answers, answer boxes, or the lane for name tags) - centred between the question plate and the
  // sand. Only a stack that could not fit at that size is drawn smaller (none in this lesson). Returns the scale, the
  // shape point placed at F (stage px), and the stack's shape bottom (where the answers / name tags start).
  sceneFit(st) {
    const C = CONFIG.card, P0 = st.fig ? st.fig.P : ((this.snaps && this.snaps[this.state.step]) || this.state.P);
    let x0 = Math.min(P0.A.x, P0.D.x), x1 = Math.max(P0.B.x, P0.C.x);
    const y0 = Math.min(P0.A.y, P0.B.y), y1 = Math.max(P0.C.y, P0.D.y);
    if (st.task === 'dragB') x1 = Math.max(x1, P0.C.x + (P0.A.x - P0.D.x)); // B slides out until BC is parallel to AD
    if (/^drag(Free|Any|90)$/.test(st.task || '')) { x0 -= C.dragRoom; x1 += C.dragRoom; }
    const f = st.f || {}, lengths = !!(f.sideLen || f.legLen || st.task === 'measure' || (st.fig && st.fig.sides));
    const padX = C.padX + (lengths ? C.lenPadX : 0), padT = C.padTop + (lengths ? C.lenPadY : 0), padB = C.padBottom + (lengths ? C.lenPadY : 0) + (f.sums ? 34 : 0);
    const w = x1 - x0 + 2 * padX, h = y1 - y0 + padT + padB;
    const above = (st.chipTop && st.chipTop < 200 && !st.practice) || (st.practice && st.okChips); // name tags above the shape
    const top = above ? C.topChips : C.top, below = this.belowH(st);
    const cxS = st.id === 'intro' ? C.introCx : st.task === 'measure' ? C.measureCx : 640;
    const maxW = st.id === 'intro' ? C.introW : st.task === 'measure' ? C.measureW : C.maxW;
    const k = Math.min(C.scale, maxW / w, (C.bottom - top - below) / h);
    const y = top + Math.max(0, (C.bottom - top - h * k - below) / 2);
    return { k: k, cx: (x0 + x1) / 2, cy: (y0 - padT + y1 + padB) / 2, F: { cx: cxS, cy: y + h * k / 2 }, bottom: y + h * k };
  }
  // the height of what sits under the shape (stage px, with its gap): the answer row(s), the answer boxes (and their
  // tiles), or the name-tag lane - reserved on every explanation screen so the shape keeps one place from screen to screen
  belowH(st) {
    const C = CONFIG.card;
    if (st.opts) {
      if (!st.optWrap) return C.optGap + C.optH;
      const rows = Math.ceil(st.opts.filter((o) => !o.wide).length / 2) + st.opts.filter((o) => o.wide).length;
      return C.optGap + rows * C.optWrapH + (rows - 1) * C.optGapX;
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
  // shape. Two-column rows (optWrap) use the same width per column, and a 'wide' answer spans the row.
  optRow(st) {
    const C = CONFIG.card, O = st.opts || [], wrap = !!st.optWrap, gap = C.optGapX;
    if (!O.length) return { w: C.optW, left: 640 - C.optW / 2 };
    let m = this._measure;
    if (m === undefined) { try { m = document.createElement('canvas').getContext('2d') || null; } catch (e) { m = null; } this._measure = m; }
    if (!m) m = { font: '', measureText: (t) => ({ width: t.length * (parseFloat(m.font.slice(4)) || 26) * 0.52 }) }; // no canvas (headless test): an estimate
    const textW = (o) => { const t = o.t || o.id, long = t.length > 14; m.font = '700 ' + (long ? 19 : wrap ? 22 : 26) + "px 'Baloo 2', system-ui, sans-serif"; return m.measureText(t).width + 2 * (long ? C.pillPadLong : C.pillPad); };
    const narrow = O.filter((o) => !o.wide), cols = wrap ? 2 : narrow.length;
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
  isPlate(st) { return !!(this.state.opened && st && st.id !== 'intro' && st.task !== 'measure' && !st.end); }
  renderVals() {
    const s = this.state, steps = this.steps(), st = this.cur();
    const isLesson = !st.cfu && !st.grid && !st.end && !st.noBoard;
    // a newline in a line forces a break in the bubble (a full-width zero-height item); it is not a word, so reveal timing is unchanged
    let wi = 0;
    const words = [];
    (s.line || '').split('\n').forEach((part, li) => {
      if (li) words.push({ t: '', cls: 'brk' });
      // key words (the lesson's terms) wear gold on the caption plate, as in the reference (dual coding)
      this.toWords(part).forEach((w) => { const i = wi++, key = KEY_WORDS.test(w.toLowerCase().replace(/[^a-z0-9°]/g, '')) ? ' key' : '';
        words.push({ t: w, cls: (i < s.reveal - 1 ? 'on' : (i === s.reveal - 1 ? (s.talking ? 'cur' : 'on') : '')) + key }); });
    });
    const G = isLesson ? this.geo() : { g: {}, tags: [], V: {} };
    // chips
    let chips = s.chips.slice();
    const f = this.fl();
    if (isLesson && f.eq === 'AD') chips = [{ t: '∠A + ∠D = ' + G.V.A + '° + ' + G.V.D + '° = 180°', k: 'white' }];
    if (isLesson && f.eq === 'BC') chips = [{ t: G.V.B + '° + ' + G.V.C + '° = 180°', k: 'white' }];
    if (st.id === 'add' && s.done) chips = [{ t: G.V.A + '° + ' + G.V.D + '° = 180°', k: 'gold' }];
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
    // qFocus: the answers stay hidden until the question shape has reached the centre, then come in one by one
    // screen-change fade class; combined classes below are built here because the template runtime drops a class
    // attribute that starts with a binding and holds two bindings ("{{a}} {{b}}")
    const fadeV = st.cfu || st.end || st.cp || st.fig || st.noBoard ? (s.step % 2 ? 'fadeA' : 'fadeB') : 'fadeA';
    const hasOpts = !!(st.opts && st.cfu !== 1 && !st.grid) && (!st.qFocus || s.qc);
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
    // cfu4
    const c4 = s.c4;
    const labs = this.labsDef().map((l) => {
      const p = this.labPos(l.id);
      const cls = c4.locked[l.id] ? 'lock' : (c4.drag && c4.drag.id === l.id ? 'drag' : (c4.sel === l.id ? 'sel' : ''));
      return { id: l.id, t: l.t, x: Math.round(p.x), y: Math.round(p.y), cls: cls, down: (e) => this.labDown(l.id, e) };
    });
    const slots = this.slotsDef().map((q, i) => {
      const filled = Object.keys(c4.at).some((k) => c4.at[k] === q.id);
      const d = c4.drag, over = !filled && d && d.px > 840 - 20 && d.px < 840 + 284 + 20 && d.py > q.y - 20 && d.py < q.y + 64 + 20;
      // blank drop zones: soft dashed outline that gently breathes; brighter while a label is held or selected;
      // highlighted when the held label is over it (any empty box: highlighting only the right one would give the answer away)
      const cls = filled ? 'filled' : over ? 'hot' : (c4.sel || d) ? 'ready' : 'empty';
      return { id: q.id, y: q.y, cls: cls, t: '', aria: 'Drop zone for shape ' + (i + 1), tap: () => this.slotTap(q.id) };
    });
    // end
    const nRight = Object.keys(s.results).filter((k) => s.results[k]).length;
    const nStars = CONFIG.stars.find((r) => nRight >= r[0])[1];
    const nChecks = steps.filter((x) => x.cp).length;
    const spot = st.layout === 'spotlight';
    // scene layout (screens 1-30, up to the right trapezium): panel on the right, Swiftee and her bubble on the
    // snow at the left, shape centred in the panel. The bubble never covers the shape, so the board never moves.
    // scene layout (ice panel right, Swiftee + bubble on the snow at the left): lesson screens 1-30 and the five checks
    // (every lesson screen before the first board-less one, i.e. up to "Great job!")
    const scene = !st.end && !st.noBoard;
    const tf = (c) => 'translate(' + c.tx + 'px, ' + c.ty + 'px) scale(' + c.scale + ')';
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
      cpOn: !!st.cpTitle && !!CONFIG.flow.showCpTitle, cpTitle: st.cpTitle || '',
      gridCls: fadeV + (this.busy() ? ' wait' : ' go'), isCfu2: st.cfu === 2, isCfu3: st.cfu === 3, isCfu4: st.cfu === 4, isCfu5: st.cfu === 5,
      isEnd: !!st.end && !JOURNEY, // (in the journey the fishing follows: no score card or Play again)
      isRecap: st.layout === 'recap',
      g: G.g, tags: G.tags,
      words: words,
      // a line with its own breaks keeps exactly those lines: the bubble widens instead of wrapping again
      bubCls: s.bub + ((s.line || '').indexOf('\n') >= 0 ? ' manual' : ''),
      // lesson steps share one board, so it only fades in when it first appears; each check fades in fresh
      fadeCls: fadeV,
      birdCls: 'bird', // Swiftee's expressions are driven by pose() (js/swiftee.js), not by re-rendering
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
      // qFocus: shape centred in the panel with the answers in a row under it (CONFIG.qFocus); otherwise the usual right column
      optTop: scene && isLesson ? Math.round(this.sceneFit(st).bottom + CONFIG.card.optGap) : st.qFocus && s.qc ? CONFIG.qFocus.optTop : st.optTop || 376,
      optLeft: scene ? this.optRow(st).left : st.qFocus && s.qc ? CONFIG.qFocus.cx - CONFIG.qFocus.optW / 2 : 650,
      optW: scene ? this.optRow(st).w : st.qFocus && s.qc ? CONFIG.qFocus.optW : 504, optCls: fadeV + (st.qFocus ? ' opts-in' : '') + (this.busy() ? ' wait' : ' go') + (st.optWrap ? ' wrap' : '') + (st.multi ? ' multi' : '') + (st.soloOk ? ' solo-ok' : ''),
      qx: CONFIG.qFocus.cx - 250, qy: s.qc ? CONFIG.qFocus.shapeTop : CONFIG.qFocus.shapeTop0, chipTop: scene && isLesson ? (st.practice || (st.chipTop && st.chipTop < 200) ? CONFIG.card.chipTopQ : Math.round(this.sceneFit(st).bottom + CONFIG.card.chipGap)) : st.chipTop || 528, chipLeft: scene ? 380 : 602, // answers centred under the shape
      celebrate: st.id === 'wellDone',
      labs: labs, slots: slots,
      stars: [0, 1, 2].map((i) => ({ cls: i < nStars ? 'on' : '' })),
      scoreText: 'You got ' + nRight + ' of ' + nChecks + ' checkpoint challenges right on the first try.',
      // spotlight: the board (shape + its labels) glides to centre stage and grows; Swiftee moves right; no bubble
      sceneCls: (s.opened ? 'in-card ' : s.opening ? 'card-wait ' : 'pre-open ') + (scene ? 'scene' : '') + (this.plateEnter(st) ? ' plate plate-enter' : this.isPlate(st) ? ' plate' : '') + (st.skin ? ' skin-' + st.skin : '') + (st.enterGrow || st.okGlow || (st.lines || []).some((L) => L.cues) ? ' cue-pulse' : ''), // skin: a screen's own look (css/game.css)
      boardTf: scene ? this.zoomTf(st) : spot ? tf(CONFIG.spotlight) : (st.layout === 'focus' && s.centered ? tf(CONFIG.focus) : (st.layout === 'top' ? tf(CONFIG.topLayout) : (st.boardShift || st.boardShiftY ? 'translate(' + (st.boardShift || 0) + 'px, ' + (st.boardShiftY || 0) + 'px)' : 'none'))),
      boardCls: fadeV + (st.assemble ? ' asm' : ''), // fade class + assemble (screen 4): the four sides fly in and form the shape - all in CSS (.asm)
      spotFill: spot ? 'spot' : '', // (screen 1 build: Motion hides the fill and fades it in last)
      // pulse: the whole shape (and its labels) zooms once about its own centre (no fill glow)
      popCls: '', // (the zoom itself is Motion.pop)
      popO: s.P ? Math.round((s.P.A.x + s.P.B.x + s.P.C.x + s.P.D.x) / 4) + 'px ' + Math.round((s.P.A.y + s.P.B.y + s.P.C.y + s.P.D.y) / 4) + 'px' : 'center',
      swCls: s.swAway ? 'swiftee away' : scene ? 'swiftee' : spot ? 'swiftee spot' : (st.layout === 'top' ? 'swiftee top' : 'swiftee'),
      bubHide: (!s.line || s.swAway ? 'gone' : (s.bubOff ? 'away' : '')) + (st.layout === 'top' && !scene ? ' top' : ''),
      // hand: fingertip lands on (x, y); drags travel (dx, dy). key restarts the animation on each showing
      handOn: !!(s.hand && s.hand.kind !== 'opts'),
      hand: s.hand && s.hand.kind !== 'opts'
        ? { cls: 'hand-nudge ' + s.hand.kind + (s.hand.down ? ' down' : '') + (s.hand.once ? ' once' : ''), x: s.hand.x, y: s.hand.y, dx: s.hand.dx, dy: s.hand.dy }
        : { cls: 'hand-nudge', x: 0, y: 0, dx: 0, dy: 0 }
    };
  }
};
