// =====================================================================
// VOICE — recorded voice-over player (clips in assets/vo/, map in js/vo_lines.js, see docs/VOICEOVER.md).
// One reused <audio> element. A line is looked up by the exact plain text the bubble shows (a voice-only line by its
// spoken text). The engine's say() (js/game-engine.js) uses it as the clock for the line; when a clip is missing or
// cannot play, say() falls back to the device's built-in voice.
// Off when the browser cannot play Ogg Opus (older Safari / iPad) or with ?vo=0. ?speed=2 plays clips faster (QA).
// =====================================================================
(function () {
  const q = (k) => { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } };
  // in the journey: the shell's <audio>, which its Play tap has unlocked (shell/bridge.js)
  const shared = window.Journey && window.Journey.embedded ? window.Journey.voiceElement() : null;
  let el = shared;
  if (!el) { try { el = new Audio(); el.preload = 'auto'; } catch (e) { el = null; } }
  let canOgg = false;
  try { canOgg = !!(el && el.canPlayType('audio/ogg; codecs="opus"')); } catch (e) {}
  const lines = typeof VO_LINES !== 'undefined' ? VO_LINES : {};
  // absolute, so it resolves against the lesson's page even on the shell's <audio> (in the journey)
  const src = (id) => new URL('assets/vo/' + id + '.ogg', location.href).href;
  let tok = 0, played = false, unlocked = !!shared, unlocking = null; // unlocking: the muted unlock play() still settling

  const VO = {
    on: !!el && canOgg && q('vo') !== '0' && Object.keys(lines).length > 0,
    rate: Math.max(0.5, Math.min(4, parseFloat(q('speed')) || 1)),
    has(key) { return VO.on && !!lines[key]; },
    seconds(key) { const v = lines[key]; return v ? v[1] : 0; },
    // when each displayed word starts in the clip (s), measured from the audio by tools/vo_build.js
    times(key) { const v = lines[key]; return v && v[2] ? v[2] : null; },
    // the first tap: play muted, then pause - tablets refuse audio until an element has played in a gesture
    unlock() {
      if (!VO.on || unlocked || played) return;
      unlocked = true;
      const t = tok, first = lines[Object.keys(lines)[0]];
      try {
        el.muted = true; el.src = src(first[0]);
        const p = el.play();
        const done = () => { unlocking = null; if (t === tok && !played) { try { el.pause(); } catch (e) {} } el.muted = false; };
        if (p && p.then) unlocking = p.then(done, done); else done();
      } catch (e) { el.muted = false; }
    },
    // plays a line's clip; returns false at once if there is none. cb: start() as the voice starts, end() as it ends,
    // fail() if it never started (missing file, play() refused) - the caller then speaks the line another way.
    play(key, cb) {
      if (!VO.has(key)) return false;
      VO.stop();
      const t = ++tok, live = () => t === tok;
      let started = false;
      played = true;
      el.muted = false;
      el.onplaying = () => { if (live() && !started) { started = true; if (cb.start) cb.start(); } };
      el.onended = () => { if (live()) { tok++; if (cb.end) cb.end(); } };
      el.onerror = () => { if (!live()) return; tok++; if (started) { if (cb.end) cb.end(); } else if (cb.fail) cb.fail(); };
      const go = () => {
        if (!live()) return;
        el.muted = false;
        try {
          // each clip opens with ~0.3 s of quiet: it starts 60 ms before its first word (as Fishing Frenzy trims its clips),
          // so Swiftee answers at once; the word timings follow the clip's own playhead, so they stay exact
          const first = lines[key][2] && lines[key][2][0], lead = first ? Math.max(0, first - 0.06) : 0;
          el.src = src(lines[key][0]) + (lead ? '#t=' + lead.toFixed(2) : '');
          el.playbackRate = VO.rate;
          // an interrupted play() (AbortError: a pause or a new load got in first) is retried once before giving up
          let retried = false;
          const tryPlay = () => {
            const p = el.play();
            if (p && p.catch) p.catch((e) => {
              VO.lastError = (e && e.name) + ': ' + (e && e.message);
              if (!live() || started) return;
              if (e && e.name === 'AbortError' && !retried) { retried = true; setTimeout(() => { if (live() && !started) tryPlay(); }, 60); return; }
              tok++; if (cb.fail) cb.fail();
            });
          };
          tryPlay();
        } catch (e) { tok++; if (cb.fail) cb.fail(); }
      };
      // the first line usually arrives during the first tap's muted unlock: changing the element's source while that
      // play() is still pending cancelled this clip silently (screen 1 then fell back to the device voice), so wait for it
      if (unlocking) unlocking.then(go, go); else go();
      return true;
    },
    // where the clip is now (s), for the line's timers; -1 when nothing is playing
    now() { return el && !el.paused ? el.currentTime : -1; },
    stop() {
      tok++;
      if (!el) return;
      el.onplaying = el.onended = el.onerror = null;
      try { el.pause(); } catch (e) {}
    },
    // after Start: fetch every clip quietly, one at a time, so each is ready when its line comes.
    // One reused element, released at the end: a new Audio() per clip left ~120 media players alive until garbage
    // collection, and past the browser's player limit it suspends players - the voice-over element then stalled
    // without ever starting, and lines fell back to the device voice at random.
    prefetch() {
      if (!VO.on || VO.prefetching) return;
      VO.prefetching = true;
      const ids = Object.keys(lines).map((k) => lines[k][0]).filter((id, i, a) => a.indexOf(id) === i);
      let a; try { a = new Audio(); } catch (e) { return; }
      a.preload = 'auto'; a.muted = true;
      const release = () => { a.oncanplaythrough = a.onerror = null; a.removeAttribute('src'); try { a.load(); } catch (e) {} };
      const next = (i) => {
        if (i >= ids.length) { release(); return; }
        let gone = false;
        const go = () => { if (gone) return; gone = true; clearTimeout(cap); setTimeout(() => next(i + 1), 30); };
        const cap = setTimeout(go, 8000);
        a.oncanplaythrough = go; a.onerror = go;
        a.src = src(ids[i]); try { a.load(); } catch (e) { go(); }
      };
      next(0);
    }
  };
  window.VO = VO;
})();
