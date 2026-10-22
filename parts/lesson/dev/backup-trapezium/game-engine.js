// =====================================================================
// GAME ENGINE — state, narration, geometry, interactions and rendering values.
// Loaded after js/vendor/dc-runtime.js (which provides DCLogic) and the data files.
// The markup in index.html binds to the values returned by renderVals().
// =====================================================================
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
      line: "Hi! Ready to explore a new shape with me?", reveal: 99, talking: false, bub: 'bubA', bird: '',
      muted: this.state ? this.state.muted : false, done: true,
      ext: { DA: 0, BC: 0, AB: 0, CD: 0 }, tap: {}, ang: {}, chips: [], toast: null,
      moved: false, dragging: null, picks: {}, cfuFirst: true, results: {},
      c4: { at: { iso: null, right: null, scal: null }, locked: {}, sel: null, drag: null, checking: false },
      ruler: this.rulerHome(), rulerDrag: false, hand: null, bubOff: false, centered: false, glow: null, pulse: false, callout: null, emph: {}
    };
  }
  steps() { return LESSON.steps; }
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
    const C = CONFIG.swiftee;
    if (window.SwifteeMascot) {
      this.sw = new window.SwifteeMascot({ base: C.base, idle: C.idle, minHoldMs: C.minHoldMs, find: () => document.querySelector('.swiftee') });
      // every expression the lesson can ask for, so reactions never wait on the network
      const want = ['measuring', C.talk, C.waiting, C.praise, C.correct, C.wrong, C.nudge, C.done];
      LESSON.steps.forEach((st) => (st.lines || []).concat(st.after || []).forEach((L) => { if (L.m) want.push(L.m); }));
      this.sw.warm(want.filter((x, i) => want.indexOf(x) === i));
    }
    this.start();
  }
  componentWillUnmount() { this.clearT(); this.cancelSpeech(); if (this.sw) this.sw.destroy(); }
  componentDidUpdate() {
    this.fitBubble();
    // screen list just opened: bring the current screen's thumbnail into view
    if (this.state.navOpen && !this.navShown && typeof document !== 'undefined') {
      const el = document.querySelector('.thumb.cur');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
    this.navShown = !!this.state.navOpen;
  }

  // ---------- screen list (top-left) ----------
  // The shape each screen expects, as if every screen before it was completed (for jumping straight to one).
  taskResult(st, P) {
    P = this.clone(P);
    if (st.task === 'dragA') P.A.x = P.D.x + (P.C.x - P.B.x);
    if (st.task === 'dragAny') P.B.x -= 100;
    if (st.task === 'dragFree') P.B.x -= 40;
    if (st.task === 'drag90') P.A.x = P.D.x;
    if (st.task === 'dragD90') P.D.x = P.A.x;
    if (st.task === 'dragD') P.D.x = P.A.x - 60;
    if (st.task === 'dragC') P.C.x = P.C.x - 40;
    return P;
  }
  jumpTo(i) {
    if (i === this.state.step) { this.setState({ navOpen: false }); return; }
    let P = this.initP();
    this.snaps = {};
    for (let j = 0; j < i; j++) { this.snaps[j] = this.clone(P); P = this.taskResult(this.steps()[j], P); }
    this.setState({ P: P, navOpen: false });
    this.sfx('tap');
    this.navAt = 0;
    this.goTo(i, true);
  }

  // Shrink-wraps the speech bubble to its widest line. Wrapped text otherwise leaves the box at its max width
  // even when every line is shorter. Measures in layout px (offsetLeft/offsetWidth ignore the stage scale);
  // hidden words still take their place, so the size is final from the first word of a line.
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
      document.fonts.addEventListener('loadingdone', () => { this.fitKey = null; this.fitBubble(); });
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
    if (st.cfu && !this.state.done) return C.waiting;
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
  cancelSpeech() { const s = this.synth(); if (s) { try { s.cancel(); } catch (e) {} } }
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
      .replace(/\b(AB|BC|CD|AD|DC)\b/g, (m) => m.split('').join(' '))
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
      Motion.letterIn(k, () => this.emphasize(['v' + k]));
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
  sfx(kind) {
    if (this.state.muted) return;
    if (CONFIG.sounds && CONFIG.sounds[kind] && this.playSound(kind)) return;
    if (!this.actx) return;
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
      emphCues.forEach((c) => { if (!c.done && n >= c.i + 1) { c.done = true; if (tok === this.narrTok) this.emphasize(c.parts); } });
    };
    // a part of the shape named in the line (∠A, AB, "A B", vertex A, legs, bases) grows briefly as the voice says it
    const emphCues = this.partCues(words);
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
    if (keep) this.setState({ talking: true });
    else this.setState({ line: text, reveal: 0, talking: true, bub: this.state.bub === 'bubA' ? 'bubB' : 'bubA', bubOff: false, centered: false });
    if (L.m) this.preloadPose(L.m);
    let i = 0, rDone = false, sDone = false, fin = false, bMode = false, spoke = false, started = false, mouthOn = false, tStart = 0;
    const live = () => tok === this.narrTok;
    const mouth = (on) => {
      if (!live() || on === mouthOn) return;
      mouthOn = on;
      if (this.sw) this.sw.talk(on, on ? null : (L.m || this.restPose()));
    };
    const finish = () => {
      if (!live() || fin || !rDone || !sDone) return;
      fin = true;
      mouth(false);
      highlight(); // in case the word was never reached (voice cut short)
      letterCues.forEach(fireLetter); // likewise every corner letter is in by the time the line ends
      this.setState(Object.assign(keep ? { talking: false } : { talking: false, reveal: words.length }, L.glow && atIdx < 0 ? { glow: null } : {}));
      if (L.glow && atIdx >= 0) this.tm(() => { if (live()) this.setState({ glow: null }); }, 1500); // the word was the end: let it linger
      firePulse(); // no-op if the pulseAt word already fired it
      fireGrow(); // likewise for growAt
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
      if (L.labelsIn) Motion.labelsIn(); // the corner letters come back as this line starts
      if (letterCues.length) { // paced estimate for voices without word boundaries (precise boundaries win if they come)
        const est = words.reduce((t, w) => t + nominal(w), 0) * (this.paceK || 1.18);
        letterCues.forEach((c) => this.tm(() => { if (!bMode) fireLetter(c); }, est * c.at / Math.max(1, sp.length)));
      }
      tick();
    };
    const s = this.synth();
    const canSpeak = !this.state.muted && s && typeof SpeechSynthesisUtterance !== 'undefined';
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
  addChips(cs) {
    const have = this.state.chips.map((c) => c.t);
    this.setState({ chips: this.state.chips.concat(cs.filter((c) => have.indexOf(c.t) < 0)) });
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
    return this.state.started && !this.state.done && !!(st.task || st.cfu || st.opts);
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
      const st = this.cur();
      this.interject({ m: CONFIG.swiftee.nudge, t: st.idle || (st.hint + '.') });
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
      if (k) return { qa: 'vtx-' + k, kind: 'tap' };
      // drags: slide toward the goal (equal legs, a right angle) or, when any change will do, inward
      const clamp = (v) => (Math.abs(v) < 12 ? 0 : Math.max(-70, Math.min(70, v)));
      if (t === 'dragAny' || t === 'dragFree') return { qa: 'vtx-B', kind: 'drag', dx: -60, dy: 0 };
      if (t === 'drag90') return { qa: 'vtx-A', kind: 'drag', dx: clamp(P.D.x - P.A.x) || -60, dy: 0 };
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
    if (CONFIG.flow.showNext && this.state.step < this.steps().length - 1 && st.autoAdvance == null) return { qa: 'next', kind: 'tap' };
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
  rootDown() { this.unlockAudio(); if (this.state.started) this.poke(); }
  unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !this.actx) this.actx = new AC();
      if (this.actx && this.actx.state === 'suspended') this.actx.resume();
    } catch (e) {}
    this.loadSounds();
  }

  // ---------- flow ----------
  start() {
    if (this.state.started && this.state.step === 0 && Date.now() - (this.navAt || 0) < 800) return;
    this.unlockAudio();
    const s = this.synth();
    if (s) { this.pickVoice(); try { s.onvoiceschanged = () => this.pickVoice(); } catch (e) {} }
    this.snaps = {};
    this.setState(this.fresh(true));
    this.goTo(0, true);
  }
  restart() { this.navAt = 0; this.start(); }
  clone(P) { return JSON.parse(JSON.stringify(P)); }
  goTo(i, fwd) {
    const st = this.steps()[i];
    if (!st) return;
    this.clearT();
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
      step: i, P: P, done: !st.task && !st.cfu && !st.opts, ext: { DA: 0, BC: 0, AB: 0, CD: 0 }, tap: {}, ang: {}, chips: [], toast: null,
      moved: false, dragging: null, picks: {}, cfuFirst: true, bird: '', hand: null, bubOff: false, centered: false, glow: null, pulse: false, callout: null, emph: {}, qc: false, trace: null, build: null, vIn: {}, flash: null, wig: null, measuring: null, tape: null, swAway: false, line: '', reveal: 0, ruler: this.rulerHome(), rulerDrag: false,
      c4: { at: { iso: null, right: null, scal: null }, locked: {}, sel: null, drag: null, checking: false }
    });
    if (this.sw) this.sw.setFlip(st.layout === 'spotlight'); // on the right, Swiftee faces left toward the shape
    if (st.layout === 'focus' && !(st.lines || []).length && !this.state.done) {
      this.setState({ line: fwd ? this.prevLine || '' : '', reveal: 999, bubOff: true, centered: true });
      this.focusAt = Date.now();
    }
    this.pose(this.restPose());
    this.setState({}, () => this.stepMotion(st)); // once the new screen is drawn
    const lines = () => this.playLines(st.lines, () => {
      if (st.task === 'measure' && st.auto) this.tm(() => this.autoMeasure(), 400);
      else if (st.task === 'extLegs' && st.auto) this.autoExtend(['DA', 'BC']);
      else if (st.task === 'extBases' && st.auto) this.autoExtend(['AB', 'CD']);
      else this.maybeAdvance(true);
    });
    // voiceDelay (ms): Swiftee waits for the screen's opening animation before she speaks (screen 4: the assembly)
    if (st.voiceDelay) this.tm(lines, st.voiceDelay); else lines();
  }
  navLocked() { return Date.now() - (this.navAt || 0) < CONFIG.timing.navLockMs; }
  next() {
    if (!this.state.done || this.navLocked()) return;
    if (this.state.step < this.steps().length - 1) { this.sfx('tap'); this.goTo(this.state.step + 1, true); }
  }
  back() {
    if (this.state.step <= 0 || this.navLocked()) return;
    // skip back over screens that move on by themselves, or Back would bounce straight forward again
    let i = this.state.step - 1;
    while (CONFIG.flow.autoAdvance && i > 0 && this.steps()[i].locked) i--;
    this.sfx('tap'); this.goTo(i, false);
  }
  // top-right Next: always moves on (with CONFIG.flow.autoAdvance off it is the only way forward). Skipping an unfinished drag task
  // applies its result first, so the screens after it ("Now the legs are equal!") still match the shape.
  navNext() {
    const i = this.state.step;
    if (i >= this.steps().length - 1 || this.navLocked()) return;
    if (!this.state.done) {
      const st = this.cur(), P = this.clone(this.state.P);
      if (st.task === 'dragA') P.A.x = P.D.x + (P.C.x - P.B.x);
      if (st.task === 'dragAny') P.B.x -= 100;
      if (st.task === 'dragFree') P.B.x -= 40;
      if (st.task === 'drag90') P.A.x = P.D.x;
      if (st.task === 'dragD90') P.D.x = P.A.x;
      this.setState({ P: P });
    }
    this.sfx('tap');
    this.goTo(i + 1, true);
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
  // every correct learner action: the correct sound and one confetti burst from the top, together, then praise
  cheer() {
    this.sfx('good');
    if (window.Confetti) window.Confetti.burst();
    this.react(CONFIG.swiftee.praise);
  }
  // A finished screen moves on by itself: CONFIG.flow.advanceMs (or the step's autoAdvance) after the last line ends.
  // Called whenever narration goes quiet; does nothing until the screen's task/check is done. Lesson complete stays.
  maybeAdvance(afterLine) {
    if (this.advId) { clearTimeout(this.advId); this.T.delete(this.advId); this.advId = null; }
    const st = this.cur(), i = this.state.step, tok = this.stepTok;
    // manual navigation: only Next / Back change the screen - except a step with autoNext (ms), which flows straight
    // on to the next screen that long after its last line (screen 1 -> 2: one continuous intro)
    if (!CONFIG.flow.autoAdvance && st.autoNext == null) return;
    if (!this.state.done || st.end || i >= this.steps().length - 1) return;
    const wait = st.autoNext != null ? st.autoNext : st.autoAdvance != null ? st.autoAdvance : CONFIG.flow.advanceMs;
    this.advId = this.tm(() => {
      this.advId = null;
      // someone is talking again (a tip, a hint): that line's end schedules the move afresh
      if (tok !== this.stepTok || this.state.talking || this.drag || this.ld || this.rd) return;
      if (this.state.navOpen) { this.maybeAdvance(false); return; } // screen list open: wait until it closes
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
    const svg = typeof document !== 'undefined' && document.querySelector('.stage svg[aria-label="Trapezium ABCD"]');
    const stage = svg && document.querySelector('.stage');
    if (!svg || !stage) return null;
    const m = svg.getScreenCTM(), sr = stage.getBoundingClientRect(), k = sr.width / 1280 || 1;
    const pt = svg.createSVGPoint(); pt.x = p.x; pt.y = p.y;
    const q = pt.matrixTransform(m);
    return { x: (q.x - sr.left) / k, y: (q.y - sr.top) / k };
  }
  stageToBoard(p) {
    const svg = p && typeof document !== 'undefined' && document.querySelector('.stage svg[aria-label="Trapezium ABCD"]');
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
  // screen 1 build: one continuous pen stroke round the outline (D->A->B->C->D) at a steady pace, eased in at the
  // start and out at the end only, so it runs through the corners without stopping. Then the outline glow settles
  // and the fill fades in.
  runBuild() {
    const tok = this.stepTok, P = this.state.P, Bc = CONFIG.build;
    const total = this.dist(P.D, P.A) + this.dist(P.A, P.B) + this.dist(P.B, P.C) + this.dist(P.C, P.D);
    Motion.value(0.001, total, total / Bc.pxPerMs / 1000, 'sine.inOut', (d) => {
      if (tok === this.stepTok) this.setState({ build: { d: d, done: false } });
    }, () => {
      if (tok !== this.stepTok) return;
      this.setState({ build: { d: total, done: true, settle: true, fill: true }, trace: null }, () => Motion.settle());
      this.tm(() => { if (tok === this.stepTok) this.setState({ build: { d: total, done: true, settle: false, fill: true } }); }, Bc.settleMs);
    });
  }
  // what a screen animates once it is on screen (GSAP, js/motion.js)
  stepMotion(st) {
    if (st !== this.cur()) return;
    if (st.build) { Motion.hideFill(); this.tm(() => this.runBuild(), CONFIG.build.delayMs); }
    if (st.sideNums) Motion.sideNums((i) => this.emphasize([['AB', 'BC', 'CD', 'DA'][i]]));
    if (st.letterIn) Motion.fadeOut('.tag.snum, .tag.vlab'); // numbers and old letters leave softly; letters return on cue
    if (st.assemble) {
      const P = this.state.P;
      Motion.holdSmall((P.A.x + P.B.x + P.C.x + P.D.x) / 4, (P.A.y + P.B.y + P.C.y + P.D.y) / 4);
      Motion.assemble();
    }
  }
  autoMeasure() {
    const tok = this.stepTok;
    const nextSide = () => {
      if (tok !== this.stepTok || this.state.done) return;
      const k = this.activeSide();
      if (k) this.measureLeg(k, nextSide);
    };
    nextSide();
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
        const home = () => { if (!live()) return; this.setState({ measuring: null, swAway: false, tape: null }); if (wk) wk.hide(); this.pose(this.restPose()); this.tm(() => this.finishTask(), 250); };
        if (wk) { const from = this.boardToStage(ends[1]); this.tm(() => { if (live() && from) wk.fly(from, this.homeFeet(), W.size, W.homeSize, W.flyMs, home); else home(); }, 450); }
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
      // first side: fly from her spot on the snow onto the side's first corner
      const to = this.boardToStage(ends[0]);
      this.setState({ swAway: true });
      if (to) wk.fly(this.homeFeet(), to, W.homeSize, W.size, W.flyMs, walkIt); else walkIt();
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
    if (s.done) return;
    if (st.task === 'tapAngles') {
      if (s.ang[k]) return;
      const ang = Object.assign({}, s.ang); ang[k] = true;
      this.setState({ ang: ang });
      this.sfx('pop');
      if (ang.A && ang.B && ang.C && ang.D) this.tm(() => this.finishTask(), 300);
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
    if (!this.canDrag(k)) return;
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
    const P = this.clone(this.state.P), k = this.drag.k;
    let x = p.x;
    // bases stay parallel (only x moves); the limits stop the shape crossing itself or going unreadably thin
    const Lm = CONFIG.limits, SL = Lm.maxLegRun;
    if (k === 'B') x = Math.max(P.A.x + Lm.minTop, P.C.x - SL, Math.min(P.C.x, x));
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
  up() {
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
    if (s.done || s.picks[o.id]) return;
    const picks = Object.assign({}, s.picks);
    if (o.ok) {
      picks[o.id] = 'good';
      const results = Object.assign({}, s.results);
      if (results[st.id] === undefined && !st.practice) results[st.id] = s.cfuFirst;
      this.setState({ picks: picks, done: true, results: results, chips: st.okChips || s.chips });
      this.cheer();
      this.interject({ m: CONFIG.swiftee.correct, t: st.ok });
    } else {
      picks[o.id] = 'bad';
      this.setState({ picks: picks, cfuFirst: false });
      this.sfx('bad');
      this.interject({ m: CONFIG.swiftee.wrong, t: o.fb });
      this.poke();
    }
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
    if (this.drag || this.rd) return this.move(e);
    const L = this.ld;
    if (!L) return;
    if (!L.moved && Math.hypot(e.clientX - L.sx, e.clientY - L.sy) < 6) return;
    L.moved = true;
    const px = (e.clientX - L.r.left) / L.sc, py = (e.clientY - L.r.top) / L.sc;
    this.setState({ c4: Object.assign({}, this.state.c4, { drag: { id: L.id, x: px - L.ox, y: py - L.oy, px: px, py: py }, sel: null }) });
  }
  rootUp(e) {
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
      this.interject({ m: CONFIG.swiftee.wrong, t: 'Some labels went back. Look for the marks: equal legs, right angles, or neither.' });
      this.poke();
    }
  }

  // ---------- render ----------
  geo() {
    const s = this.state, st = this.cur(), f = st.f || {}, P = s.P, task = st.task;
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
    // No yellow bands on the figure, ever: a side that would have been highlighted ("lit": legGlow, a line's
    // glow, the side being measured / tapped) is drawn a little bolder in its own colour instead (.edge.lit)
    const lit = {};
    const band = (k, p, q, on) => {
      lit[k] = st.auto ? on : (on || act === k || meas(k));
      return seg(p, q, false, { cls: 'leg-glow' });
    };
    g.hDA = band('DA', D, A, glowLeg('DA'));
    g.hBC = band('BC', B, C, glowLeg('BC'));
    const glowBase = (k) => said(k) || (task === 'extBases' && !st.auto && !s.done && !waitFocusG && !(s.ext[k] > 0));
    g.hAB = band('AB', A, B, glowBase('AB'));
    g.hCD = band('CD', D, C, glowBase('CD'));
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
    // shape colours (reference): hot-pink outline, soft pink-lilac fill; highlight colours unchanged
    const NAVY = '#e8287a', OR = '#f08a24', PU = '#8e44d6';
    const baseCol = (k) => (st.id === 'bases' && s.tap[k] ? OR : NAVY);
    const legCol = (k) => ((st.id === 'legs' && s.tap[k]) || f.legsPurple ? PU : NAVY);
    // flash (auto extend), wiggle (wrong-way drag), emph (named in the voice-over)
    const eCls = (k) => 'e' + k + ' ' + (s.flash === k ? 'flash' : '') + (s.wig === k ? ' wiggle' : '') + (s.emph && s.emph[k] ? ' emph' : '') + (lit[k] ? ' lit' : '');
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
    const tick = (p, q) => {
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, L = this.dist(p, q) || 1;
      const dx = (q.x - p.x) / L, dy = (q.y - p.y) / L, nx = -dy, ny = dx;
      let out = '';
      [-3, 3].forEach((k) => {
        const cx = mx + dx * k, cy = my + dy * k;
        out += 'M' + r1(cx - nx * 9) + ',' + r1(cy - ny * 9) + ' L' + r1(cx + nx * 9) + ',' + r1(cy + ny * 9) + ' ';
      });
      return out;
    };
    g.tk = { p: tick(A, D) + tick(B, C), d: dsp(f.ticks || (task === 'dragA' && s.done && equal) || (task === 'dragAny' && equal)) };
    // parallel chevrons
    const chev = (p, q) => {
      const x = (p.x + q.x) / 2, y = p.y;
      return 'M' + r1(x - 8) + ',' + r1(y - 6) + ' L' + r1(x - 2) + ',' + r1(y) + ' L' + r1(x - 8) + ',' + r1(y + 6) +
        ' M' + r1(x) + ',' + r1(y - 6) + ' L' + r1(x + 6) + ',' + r1(y) + ' L' + r1(x) + ',' + r1(y + 6);
    };
    g.ch = { p: chev(A, B) + ' ' + chev(D, C), d: dsp(f.par) };
    // angles
    const V = this.vals(P);
    const arcSet = (f.arcs || '') + (task === 'tapAngles' || task === 'tapAD' ? Object.keys(s.ang).join('') : '');
    const unit = (p, q) => { const L = this.dist(p, q) || 1; return { x: (q.x - p.x) / L, y: (q.y - p.y) / L }; };
    const aTag = {}, em = s.emph || {}; // parts the voice-over is naming right now
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const n = this.nb(k), Vk = P[k], u = unit(Vk, P[n[0]]), v = unit(Vk, P[n[1]]);
      const R = 24;
      const sx = Vk.x + u.x * R, sy = Vk.y + u.y * R, ex = Vk.x + v.x * R, ey = Vk.y + v.y * R;
      const cross = u.x * v.y - u.y * v.x;
      const show = arcSet.indexOf(k) >= 0;
      const isRight = Math.abs(this.angle(P, k) - 90) < 0.5;
      // when several angles light up together they draw in one after another
      const stag = (f.arcs || '').length > 1 ? ' d' + (f.arcs || '').indexOf(k) : '';
      g['a' + k] = { p: 'M' + r1(sx) + ',' + r1(sy) + ' A' + R + ',' + R + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + r1(ex) + ',' + r1(ey), d: dsp(show), cls: 'arc' + stag + (em['a' + k] ? ' emph' : ''), o: r1(Vk.x) + 'px ' + r1(Vk.y) + 'px' };
      const q = 15;
      g['r' + k] = {
        p: 'M' + r1(Vk.x + u.x * q) + ',' + r1(Vk.y + u.y * q) + ' L' + r1(Vk.x + u.x * q + v.x * q) + ',' + r1(Vk.y + u.y * q + v.y * q) + ' L' + r1(Vk.x + v.x * q) + ',' + r1(Vk.y + v.y * q),
        d: dsp(isRight && (f.right || show))
      };

      const th = this.angle(P, k) * Math.PI / 180;
      const dl = Math.max(40, Math.min(70, 30 / Math.sin(th / 2)));
      let bx = u.x + v.x, by = u.y + v.y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
      aTag[k] = { t: V[k] + '°', x: r1(Vk.x + bx * dl), y: r1(Vk.y + by * dl), cls: 'alab' + stag + (show ? '' : ' off') + (em['a' + k] ? ' emph' : '') };
    });
    // vertices
    const dk = this.dragKey();
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const anyV = this.anyCorner(), Vk = P[k], drag = dk === k || anyV;
      g['v' + k] = { x: r1(Vk.x), y: r1(Vk.y), r: vOn(k) ? (drag ? 11 : 7) + (em['v' + k] ? 4 : 0) : 0, c: drag ? PU : NAVY, w: drag ? 4 : 3 };
      const tapV = (task === 'tapAngles' || task === 'tapAD') && !s.done;
      const pulse = tapV && !s.ang[k] && (task === 'tapAngles' || k === 'A' || k === 'D');
      g['k' + k] = {
        x: r1(Vk.x), y: r1(Vk.y), d: dsp(tapV || drag), cls: pulse || (anyV && !s.dragging) ? 'vp' : '',
        cur: drag ? (s.dragging ? 'grabbing' : 'grab') : 'pointer',
        click: tapV ? () => this.tapVertex(k) : noop,
        down: drag ? (e) => this.down(k, e) : noop
      };
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
      tags.push({ t: k, x: r1(Vk.x + dx / L * 25), y: r1(Vk.y + dy / L * 25), cls: 'vlab' + (vOn(k) ? '' : ' off') + lin });
    });
    ['A', 'B', 'C', 'D'].forEach((k) => tags.push(aTag[k]));
    // a tag beside a side, pushed out along the side's outward normal far enough that its box clears the line
    const side = (p, q, text, cls, show) => {
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, L = this.dist(p, q) || 1;
      let nx = -(q.y - p.y) / L, ny = (q.x - p.x) / L;
      if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
      const hw = (text.length * 9.6 + 32) / 2, hh = 16;
      const off = hw * Math.abs(nx) + hh * Math.abs(ny) + 12;
      // outside the shape first; if the board edge would push it back onto the side, tuck it inside instead
      const need = hw * Math.abs(nx) + hh * Math.abs(ny) + 4;
      const place = (sg) => {
        const x = Math.max(hw - 70, Math.min(516 - hw, mx + sg * nx * off)) /* the panel has room left of the board */, y = Math.max(18, Math.min(404, my + sg * ny * off));
        return { x: x, y: y, ok: Math.abs(nx * (x - mx) + ny * (y - my)) >= need };
      };
      let pos = place(1);
      if (!pos.ok) pos = place(-1);
      const x = pos.x, y = pos.y;
      return { t: text, x: r1(x), y: r1(y), cls: cls + (show ? '' : ' off') };
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
    tags.push(side(D, A, this.cm(ad), eqCls, !!f.legLen));
    tags.push(side(B, C, this.cm(bc), eqCls, !!f.legLen));
    tags.push(side(A, B, this.cm(this.dist(A, B)), 'mtag', !!f.sideLen));
    tags.push(side(D, C, this.cm(this.dist(D, C)), 'mtag', !!f.sideLen));
    // sideNums (screen 2): the four sides numbered 1 top, 2 right, 3 bottom, 4 left - each number flies in from its
    // own side's direction, one after another (CSS .snum: ease-out, slight overshoot, 90% -> 100% scale)
    {
      const on = !!(st.sideNums || st.letterIn), gone = ''; // kept on screen 3 so they can fade out (Motion.fadeOut)
      tags.push(side(A, B, '1', 'snum n1 from-top' + gone, on));
      tags.push(side(B, C, '2', 'snum n2 from-right' + gone, on));
      tags.push(side(D, C, '3', 'snum n3 from-bottom' + gone, on));
      tags.push(side(D, A, '4', 'snum n4 from-left' + gone, on));
    }
    return { g: g, tags: tags, V: V };
  }

  renderVals() {
    const s = this.state, steps = this.steps(), st = this.cur();
    const isLesson = !st.cfu && !st.end && !st.noBoard;
    // a newline in a line forces a break in the bubble (a full-width zero-height item); it is not a word, so reveal timing is unchanged
    let wi = 0;
    const words = [];
    (s.line || '').split('\n').forEach((part, li) => {
      if (li) words.push({ t: '', cls: 'brk' });
      this.toWords(part).forEach((w) => { const i = wi++; words.push({ t: w, cls: i < s.reveal - 1 ? 'on' : (i === s.reveal - 1 ? (s.talking ? 'cur' : 'on') : '') }); });
    });
    const G = isLesson ? this.geo() : { g: {}, tags: [], V: {} };
    // chips
    let chips = s.chips.slice();
    const f = st.f || {};
    if (isLesson && f.eq === 'AD') chips = [{ t: G.V.A + '° + ' + G.V.D + '° = 180°', k: 'white' }];
    if (isLesson && f.eq === 'BC') chips = [{ t: G.V.B + '° + ' + G.V.C + '° = 180°', k: 'white' }];
    if (st.id === 'add' && s.done) chips = [{ t: G.V.A + '° + ' + G.V.D + '° = 180°', k: 'gold' }];
    // cfu options
    const optPulse = s.hand && s.hand.kind === 'opts';
    const mk = (o) => ({ id: o.id, t: o.t || o.id, cls: s.picks[o.id] || (optPulse && !s.done ? 'nudged' : ''), dis: !!s.picks[o.id] || s.done, pick: () => this.pick(o) });
    const c1 = {};
    if (st.cfu === 1) st.opts.forEach((o) => { c1[o.id] = mk(o); });
    // qFocus: the answers stay hidden until the question shape has reached the centre, then come in one by one
    // screen-change fade class; combined classes below are built here because the template runtime drops a class
    // attribute that starts with a binding and holds two bindings ("{{a}} {{b}}")
    const fadeV = st.cfu || st.end ? (s.step % 2 ? 'fadeA' : 'fadeB') : 'fadeA';
    const hasOpts = !!(st.opts && st.cfu !== 1) && (!st.qFocus || s.qc);
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
    const lessonCount = steps.findIndex((x) => x.cfu === 1);
    let progressLabel;
    if (st.end) progressLabel = 'Done';
    else if (st.cfu) progressLabel = 'Check ' + st.cfu + ' / 5';
    else progressLabel = 'Step ' + (s.step + 1) + ' / ' + lessonCount;
    const isLastCfu = st.cfu === 5;
    const spot = st.layout === 'spotlight';
    // scene layout (screens 1-30, up to the right trapezium): panel on the right, Swiftee and her bubble on the
    // snow at the left, shape centred in the panel. The bubble never covers the shape, so the board never moves.
    // scene layout (ice panel right, Swiftee + bubble on the snow at the left): lesson screens 1-30 and the five checks
    const scene = s.step <= this.steps().findIndex((x) => x.id === 'right') || !!st.cfu;
    const tf = (c) => 'translate(' + c.tx + 'px, ' + c.ty + 'px) scale(' + c.scale + ')';
    return {
      rootMove: (e) => this.rootMove(e),
      rootUp: (e) => this.rootUp(e),
      start: () => this.start(),
      restart: () => this.restart(),
      replay: () => this.replay(),
      toggleMute: () => this.toggleMute(),
      next: () => this.next(),
      back: () => this.back(),
      navNext: () => this.navNext(),
      screensLabel: 'Screen ' + (s.step + 1) + ' of ' + steps.length, // current position; tap to open the screen list
      navOpen: !!s.navOpen,
      toggleScreens: () => this.setState({ navOpen: !this.state.navOpen }),
      closeScreens: () => this.setState({ navOpen: false }),
      thumbs: steps.map((x, i) => ({
        n: i + 1, src: 'assets/thumbs/' + String(i + 1).padStart(2, '0') + '.webp',
        cls: i === s.step ? 'thumb cur' : 'thumb',
        title: 'Screen ' + (i + 1) + (x.lines && x.lines[0] && x.lines[0].t ? ': ' + x.lines[0].t.replace(/\n/g, ' ') : ''),
        go: () => this.jumpTo(i)
      })),
      navBack: () => this.back(),
      navBackDis: s.step === 0,
      navNextDis: s.step >= steps.length - 1,
      muted: !!s.muted, unmuted: !s.muted, muteLabel: s.muted ? 'Turn sound on' : 'Turn sound off',
      notStarted: !s.started,
      isLesson: isLesson && s.started,
      isCfu1: st.cfu === 1, isCfu2: st.cfu === 2, isCfu3: st.cfu === 3, isCfu4: st.cfu === 4, isCfu5: st.cfu === 5,
      isEnd: !!st.end,
      isRecap: st.layout === 'recap',
      g: G.g, tags: G.tags,
      words: words,
      // a line with its own breaks keeps exactly those lines: the bubble widens instead of wrapping again
      bubCls: s.bub + ((s.line || '').indexOf('\n') >= 0 ? ' manual' : ''),
      // lesson steps share one board, so it only fades in when it first appears; each check fades in fresh
      fadeCls: fadeV,
      birdCls: 'bird', // Swiftee's expressions are driven by pose() (js/swiftee.js), not by re-rendering
      chips: chips.map((c) => ({ t: c.t, k: c.k + (c.t.length > 20 ? ' long' : '') })),
      rootDown: () => this.rootDown(),
      wordSize: wi > 15 || (s.line || '').length > 80 ? 22 : 24, // long lines get the smaller size
      c1: c1, hasOpts: hasOpts, opts: opts,
      // qFocus: shape centred in the panel with the answers in a row under it (CONFIG.qFocus); otherwise the usual right column
      optTop: st.qFocus && s.qc ? CONFIG.qFocus.optTop : st.optTop || 376, optLeft: st.qFocus && s.qc ? CONFIG.qFocus.cx - CONFIG.qFocus.optW / 2 : scene ? CONFIG.scene.chipLeft + 8 : 650,
      optW: st.qFocus && s.qc ? CONFIG.qFocus.optW : 504, optCls: fadeV + (st.qFocus ? ' opts-in' : ''),
      qx: CONFIG.qFocus.cx - 250, qy: s.qc ? CONFIG.qFocus.shapeTop : CONFIG.qFocus.shapeTop0, chipTop: st.chipTop || (scene ? CONFIG.scene.chipTop : 528), chipLeft: scene ? CONFIG.scene.chipLeft : 602, // answers centred under the shape
      celebrate: st.id === 'wellDone',
      labs: labs, slots: slots,
      stars: [0, 1, 2].map((i) => ({ cls: i < nStars ? 'on' : '' })),
      scoreText: 'You got ' + nRight + ' of 5 checks right on the first try.',
      progressW: Math.round((s.step / (steps.length - 1)) * 100) + '%',
      progressLabel: progressLabel,
      showNav: s.started && !st.end,
      backDisabled: s.step === 0 || !!st.locked || !CONFIG.flow.showBack,
      backCls: st.locked || !CONFIG.flow.showBack ? 'auto' : '',
      nextDisabled: !s.done,
      nextCls: CONFIG.flow.showNext && st.autoAdvance == null ? (s.done && !s.talking ? 'ready' : '') : 'auto', // screens move on by themselves
      nextLabel: isLastCfu ? 'Finish' : 'Next',
      // spotlight: the board (shape + its labels) glides to centre stage and grows; Swiftee moves right; no bubble
      sceneCls: scene ? 'scene' : '',
      boardTf: scene ? 'translate(' + CONFIG.scene.boardX + 'px, ' + (st.boardShiftY || 0) + 'px)' : spot ? tf(CONFIG.spotlight) : (st.layout === 'focus' && s.centered ? tf(CONFIG.focus) : (st.layout === 'top' ? tf(CONFIG.topLayout) : (st.boardShift || st.boardShiftY ? 'translate(' + (st.boardShift || 0) + 'px, ' + (st.boardShiftY || 0) + 'px)' : 'none'))),
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
