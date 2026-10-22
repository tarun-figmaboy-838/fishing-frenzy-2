"""Fishing Frenzy 2's journey in real browsers: python3 tests/journey.py [chromium|webkit|all] [journey|start|veil|dev|all]

Plays the journey (index.html at the root, shell/journey.js) through its real taps, with Python Playwright's Chromium
and WebKit (pip install playwright pillow && playwright install chromium webkit; an older WebKit build already
installed is used if Playwright's own is missing), at 1280x720 with a mouse and at 1024x768 with touch:

  front page  the fishing game's own live banner, shown first; the lesson loads, unseen, behind it once it's ready
  intro       a real tap on the banner's Play: the shell's sound unlocks, the banner clears away and the game's story
              starts at once (the narrator, the first school); the warm-up's three real catches (Drop Net as fish swim
              under the net), then its problem: the giant fish, Swiftee's "Let's find out!" and a real tap on Next
  lesson      the giant wave carries Popo off and the lesson dissolves in over the empty lake; the game goes on drawing
              its lake under the lesson (which plays over it), silent (no music, effects or voice; its context asleep),
              its buttons away; the lesson begins (seashell, card, screen 1); jumped to its last screen, a real tap on the
              Next under Swiftee hands over
  fishing     the game wakes under the lesson's frame as it dissolves out: the wave brings Popo back, Swiftee welcomes
              him, and a real catch at the first parallelogram net (the lesson's frame disposed, its voice stopped)
  the end     after level 8 (jumped to, as its dev panel's Finish), a real tap on Play Again: the circle closes and
              opens on the banner from its start, a fresh lesson loads behind it, and Play works again

`start`: ?start=fishing plays the warm-up and the nets in a row from Play (no lesson), ?start=lesson brings the lesson
first and then the wave, the welcome and the nets, and a part opened on its own goes to the journey. `veil`: the lesson
still loading when its turn comes shows
the frosted "Getting ready…" veil; a lesson that can't load says so, and a real tap on Try again loads it afresh and the
journey goes on. `dev`: ?dev=1's one panel lists both parts' screens; a lesson screen shows the lesson over the game at
that screen, a fishing level takes it away and wakes the game there, Front page brings the banner back; the backtick key
folds the panel. Every run checks that each step is announced, and that no frame logs an error or has a request fail
(Google Fonts aside).

Uses the static server already on http://127.0.0.1:8765/ (or $JOURNEY_URL); if none answers, it serves the repo itself.
Screenshots go to $JOURNEY_SHOTS (default: <temp dir>/fishing-frenzy-2-journey).
"""
import functools
import http.server
import os
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(os.environ.get('JOURNEY_SHOTS', Path(tempfile.gettempdir()) / 'fishing-frenzy-2-journey'))
SIZES = {'desktop': {'viewport': {'width': 1280, 'height': 720}},
         'touch': {'viewport': {'width': 1024, 'height': 768}, 'has_touch': True}}
IGNORE = ('fonts.googleapis.com', 'fonts.gstatic.com')

# every frame keeps its own uncaught errors; the top page keeps the journey's announcements
INIT = '''window.__errs = [];
addEventListener('error', (e) => { if (e.message) window.__errs.push(location.pathname + ': ' + e.message); });
addEventListener('unhandledrejection', (e) => window.__errs.push(location.pathname + ': rejected ' + (e.reason && e.reason.message || e.reason)));
if (window.top === window) { window.__said = []; for (const k of ['part', 'finished', 'complete'])
  addEventListener('fishing-frenzy:' + k, (e) => window.__said.push([k, e.detail]));
  // each part's frame as it is made, with how far the game had got by then
  window.__made = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.tagName === 'IFRAME')
    window.__made.push(n.dataset.part + ':' + (window.FishingFrenzy && FishingFrenzy.status('fishing'))); }))).observe(document, { childList: true, subtree: true }); }'''

SHELL = '''() => { const T = window.FishingFrenzy, a = T.audio;
  const tags = (f) => f.dataset.part + ['live', 'covered', 'arriving', 'leaving'].filter((c) => f.classList.contains(c)).map((c) => '+' + c).join('');
  return { phase: T.phase, current: T.current, fishing: T.status('fishing'), lesson: T.status('lesson'),
           frames: [...document.querySelectorAll('iframe.part')].map(tags), veil: document.getElementById('veil').classList.contains('on'),
           ctx: a.ctx ? a.ctx.state : null, voice: a.el && !a.el.paused ? a.el.currentSrc : '', outs: [...a.outs.keys()],
           rotate: getComputedStyle(document.getElementById('rotate-hint')).display !== 'none', dev: !!document.querySelector('.dev') }; }'''

FISH = '''() => { const d = window.popoDebug; if (!d) return null; const s = d.state, g = d.game, a = g.audio, $ = (id) => document.getElementById(id);
  return { phase: s.phase, level: s.level, caught: s.caught, running: g.running, holding: g.holding,
           ctx: a.ctx ? a.ctx.state : null, held: a.held, music: a.musicOn, voice: !!a.voiceSource, effects: a.effectSources.size,
           clock: PopoGame.clock.time, hud: !$('hud').hidden, start: !$('screen-start').hidden, armed: !$('btn-play').disabled,
           again: !$('btn-again').hidden, dialogue: g.dialogue ? g.dialogue.who : null, ending: !!g.ending, title: g.title.visible,
           ok: g.net.check().ok, stop: g.net.stopAt, rotate: !$('rotate-hint').hidden, ownPanel: !!document.querySelector('.dev-panel'),
           lessonAfter: g.lessonAfter, next: !$('btn-next').hidden, swiftee: !!g.swiftee, wave: !!g.wave,
           away: Math.abs(g.popo.travelShift) > 1600, warm: g.warmCatches, handle: !$('handle').hidden }; }'''

LESSON = '''() => { const e = window.lessonDebug; if (!e) return null;
  return { step: e.state.step, of: e.steps().length, started: !!e.state.started, handedOff: !!e.handedOff,
           shared: !e.actx || e.actx === parent.FishingFrenzy.audio.ctx }; }'''

# how many fish swim right under the net (well inside its footprint)
UNDER = '''() => { const g = window.popoDebug.game, s = window.popoDebug.state, span = g.net.innerSpan();
  const l = g.netRest.x + span.left + 40, r = g.netRest.x + span.right - 40;
  return s.fish.filter((f) => !f.leaving && !f.waiting && !f.caught && !f.gone && f.x > l && f.x < r).length; }'''

# the corner and its place, as client points (the game's frame fills the window, so they are the page's too)
POINTS = '''() => { const g = window.popoDebug.game, n = g.net, k = g.stage.scale;
  const c = document.getElementById('stage').getBoundingClientRect();
  const h = n.handle(), t = n.toStage(n.target);
  return { handle: [h.x * k + c.left, h.y * k + c.top], target: [t.x * k + c.left, t.y * k + c.top] }; }'''

# straight to the last net and its celebration, as the game's dev panel's Finish does
FINISH = '''() => { const P = PopoGame, g = popoDebug.game, s = popoDebug.state, L = P.LEVELS, i = L.length - 1;
  g.reset(); s.locationIndex = L[i].location; g.applyLocation(); g.prepareLevel(i); g.spawnSchool();
  g.net.furl = 0; g.winch.setRopeOut(0); g.beginPuzzle(); P.celebrate(g, P.newToken()).catch(() => {}); }'''

passed = []


def check(ok, what, detail=''):
    print(('PASS ' if ok else 'FAIL ') + what + (f' -- {detail}' if detail else ''), flush=True)
    if not ok:
        raise SystemExit(1)
    passed.append(what)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def server():
    url = os.environ.get('JOURNEY_URL', 'http://127.0.0.1:8765/')
    try:
        urllib.request.urlopen(url + 'shell/journey.js', timeout=3).read(1)
        return url, None
    except Exception:
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        return f'http://127.0.0.1:{srv.server_address[1]}/', srv


def until(fn, cond, timeout, what):
    end = time.time() + timeout
    last = None
    while time.time() < end:
        try:
            last = fn()
        except Exception as e:  # a frame being swapped
            last = f'({e.__class__.__name__})'
        if not isinstance(last, str) and last is not None and cond(last):
            return last
        time.sleep(0.12)
    raise SystemExit(f'FAIL timed out: {what}; last {last}')


def part(page, name):
    for f in page.frames:
        if f'/parts/{name}/' in f.url and not f.is_detached():
            return f
    return None


def launch(p, engine):
    """The engine Playwright expects, or else the newest of that engine already installed on this machine."""
    try:
        return getattr(p, engine).launch()
    except Exception:
        import glob
        builds = sorted(glob.glob(os.path.expanduser(f'~/Library/Caches/ms-playwright/{engine}-*/pw_run.sh')) +
                        glob.glob(os.path.expanduser(f'~/.cache/ms-playwright/{engine}-*/pw_run.sh')))
        if not builds:
            raise
        return getattr(p, engine).launch(executable_path=builds[-1])


class Run:
    """One browser page on the journey, with every frame's errors and failed requests collected."""

    def __init__(self, p, engine, size, url):
        self.engine, self.size, self.url = engine, size, url
        self.touch = SIZES[size].get('has_touch', False)
        self.tag = f'{engine}-{size}'
        self.browser = launch(p, engine)
        self.ctx = self.browser.new_context(**SIZES[size])
        self.ctx.add_init_script(INIT)
        self.page = self.ctx.new_page()
        self.problems = []
        pg = self.page
        pg.on('console', self.console)
        pg.on('pageerror', lambda e: self.problems.append(f'pageerror: {e}'))
        # (nor a voice clip cut off by a jump or a new line: its <audio> moved on)
        pg.on('requestfailed', lambda r: None if any(i in r.url for i in IGNORE) or (r.url.endswith('.ogg') and 'ABORTED' in (r.failure or '')) else self.problems.append(f'request failed: {r.url} ({r.failure})'))
        pg.on('response', lambda r: self.problems.append(f'HTTP {r.status}: {r.url}') if r.status >= 400 and not any(i in r.url for i in IGNORE) else None)

    def console(self, m):
        if m.type != 'error':
            return
        where = (m.location or {}).get('url', '')
        if not any(i in m.text or i in where for i in IGNORE):
            self.problems.append(f'console: {m.text} ({where})')

    def shell(self):
        return self.page.evaluate(SHELL)

    def fish(self):
        return part(self.page, 'fishing').evaluate(FISH)

    def lesson(self):
        f = part(self.page, 'lesson')
        return f.evaluate(LESSON) if f else None

    def shot(self, name):
        SHOTS.mkdir(parents=True, exist_ok=True)
        path = SHOTS / f'{self.tag}-{name}.png'
        # (a screenshot is for looking at, not a check: WebKit's waits for every frame's fonts, and a frame the test
        # holds back never has any)
        try:
            self.page.screenshot(path=str(path), timeout=10000)
        except Exception as e:
            print(f'  (no screenshot {path.name}: {str(e).splitlines()[0]})')
            return None
        return path

    def tap(self, x, y):
        if self.touch:
            self.page.touchscreen.tap(x, y)
        else:
            self.page.mouse.click(x, y)

    def tap_el(self, frame, selector):
        box = frame.locator(selector).bounding_box()  # (in the page's coordinates)
        self.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)

    def errors(self):
        out = list(self.problems)
        for f in self.page.frames:
            try:
                out += f.evaluate('() => window.__errs || []')
            except Exception:
                pass
        return out

    def close(self):
        self.browser.close()


def not_white(path):
    """The share of near-white pixels in a screenshot (a white flash would be most of it)."""
    try:
        from PIL import Image
    except ImportError:
        return 0.0
    im = Image.open(path).convert('RGB').resize((160, 90))
    px = list(im.getdata())
    return sum(1 for r, g, b in px if r > 240 and g > 240 and b > 240) / len(px)


def play_tap(r):
    """Waits for the banner's Play to be up, and taps it."""
    ff = part(r.page, 'fishing')
    until(r.fish, lambda s: s['armed'] and s['phase'] == 'title', 30, 'the banner\'s Play is up')
    r.page.wait_for_timeout(500)  # (it bobs up out of the water)
    r.tap_el(ff, '#btn-play')


def silent(s):
    return s['held'] and s['ctx'] != 'running' and not s['music'] and not s['voice'] and s['effects'] == 0


def catch_level(r, n, shot):
    """Net n (its LEVELS index: 1 is the first parallelogram net, after the warm-up) with real input: the corner onto its
    place (drag, or arrow taps by touch), then Drop Net as fish swim under the net; a drop the fish swim out from under
    goes again."""
    ff = part(r.page, 'fishing')
    st = until(r.fish, lambda s: s['phase'] == 'puzzleReady' and s['level'] == n, 90, f'net {n} is ready')
    check(not st['ok'], f'{r.tag}: net {n} comes down, its corner off its place', f"stop {st['stop']}")
    before = st['caught']
    if r.touch:
        for _ in range(abs(st['stop'])):
            r.tap_el(ff, '#step-back' if r.fish()['stop'] > 0 else '#step-on')
            r.page.wait_for_timeout(180)
    else:
        pts = ff.evaluate(POINTS)
        x0, y0 = pts['handle']
        r.page.mouse.move(x0, y0)
        r.page.mouse.down()
        for i in range(1, 25):
            to = ff.evaluate(POINTS)['target']  # (the raft bobs on the waves)
            r.page.mouse.move(x0 + (to[0] - x0) * i / 24, y0 + (to[1] - y0) * i / 24)
            r.page.wait_for_timeout(16)
        r.page.mouse.up()
    st = until(r.fish, lambda s: s['ok'], 5, 'the corner on its place')
    check(st['stop'] == 0, f'{r.tag}: the child puts the corner on its place ({"arrow taps" if r.touch else "a drag"})')
    r.shot(f'{shot}a-level-{n + 1}')
    st = drop_when_under(r, before, 'the catch')
    check(st['caught'] > before, f'{r.tag}: net {n}: Drop Net as fish swim under the net catches some', f"{st['caught'] - before} fish")
    r.page.wait_for_timeout(900)
    r.shot(f'{shot}b-catch')


def drop_when_under(r, before, what):
    """Drop Net as fish swim under the net (again if they swam out before it landed), until something is caught."""
    ff = part(r.page, 'fishing')
    for attempt in range(6):
        end = time.time() + 60
        while ff.evaluate(UNDER) < 2:
            if time.time() > end:
                raise SystemExit('FAIL no fish swam under the net')
            r.page.wait_for_timeout(60)
        r.tap_el(ff, '#btn-drop')
        until(r.fish, lambda s: s['phase'] != 'puzzleReady', 5, 'the net goes down')
        st = until(r.fish, lambda s: s['caught'] > before or s['phase'] == 'puzzleReady', 30, what)
        if st['caught'] > before:
            return st
        print(f'     {r.tag}: the fish swam out before the net landed; dropping again', flush=True)
    return st


def end_lesson(r):
    """The lesson's last screen (jumped to): once Swiftee's goodbye is said, Next comes up under her; a real tap on it
    takes the journey on."""
    L = part(r.page, 'lesson')
    last = L.evaluate('() => lessonDebug.steps().length - 1')
    L.evaluate(f'() => lessonDebug.jumpTo({last})')
    L.wait_for_selector('[data-qa=end-next]', state='visible', timeout=40000)
    r.page.wait_for_timeout(500)  # (it pops up)
    r.tap_el(L, '[data-qa=end-next]')


def warm_up(r):
    """The warm-up: Popo's plain net (nothing to set), Drop Net as fish swim under it, three catches."""
    st = until(r.fish, lambda s: s['phase'] == 'puzzleReady' and s['level'] == 0, 90, 'the warm-up net is ready')
    check(st['ok'] and not st['handle'], f'{r.tag}: the warm-up net comes down with nothing to set (no corner to drag), only Drop Net')
    for n in range(3):
        st = until(r.fish, lambda s: s['phase'] == 'puzzleReady' and s['level'] == 0 and s['warm'] == n, 60, f'warm-up net {n + 1}')
        st = drop_when_under(r, st['caught'], f'warm-up catch {n + 1}')
        check(st['caught'] > 0, f'{r.tag}: warm-up drop {n + 1}: a catch, and Popo cheers', f"{st['caught']} fish so far")
    r.shot('3-warm-up')


def journey(p, engine, size, url):
    r = Run(p, engine, size, url)
    page = r.page
    page.goto(url + '?debug', wait_until='commit')
    page.wait_for_timeout(250)
    first = r.shot('0-first-paint')
    check(not_white(first) < 0.05, f'{r.tag}: the first paint is the game\'s blue, not a white page', f'{not_white(first):.0%} white')
    st = until(r.shell, lambda s: s['fishing'] == 'ready' and s['lesson'] == 'ready', 90, 'the game, then the lesson behind it, load')
    made = page.evaluate('() => window.__made')
    check(made == ['fishing:loading', 'lesson:ready'] and not st['dev'],
          f'{r.tag}: the game\'s frame comes first; the lesson\'s only once the game is ready; no dev panel', ', '.join(made))
    check(st['frames'] == ['fishing+live', 'lesson'] and st['phase'] == 'front' and st['current'] == 'fishing',
          f'{r.tag}: the banner is the front page; the lesson has loaded, unseen, behind it', ', '.join(st['frames']))
    fs = until(r.fish, lambda s: s['armed'], 30, 'the banner\'s Play')
    check(fs['phase'] == 'title' and fs['title'] and fs['start'] and not fs['hud'] and not fs['ownPanel'] and not fs['rotate'],
          f'{r.tag}: the banner plays out to its Play button (no HUD, no panel or rotate hint of the game\'s own)')
    page.wait_for_timeout(600)
    r.shot('1-banner')

    # ---------- Play: the game's story at once, and its first net (the intro) ----------
    play_tap(r)
    page.wait_for_timeout(200)
    st, fs = r.shell(), r.fish()
    check(st['phase'] == 'intro' and st['current'] == 'fishing' and st['ctx'] == 'running' and not st['veil'] and st['frames'] == ['fishing+live', 'lesson']
          and fs['phase'] == 'intro' and not fs['holding'] and fs['running'] and fs['music'] and fs['hud'],
          f'{r.tag}: Play (a real {"touch" if r.touch else "click"}): the shell\'s sound unlocks and the game\'s story starts at once (music, HUD)')
    until(r.fish, lambda s: s['dialogue'] == 'narrator', 10, 'the narrator')
    page.wait_for_timeout(1200)
    r.shot('2-story')
    check(True, f'{r.tag}: the narrator\'s lines begin, as after Play on the game\'s own')
    warm_up(r)

    # ---------- the warm-up's problem: the giant fish, Swiftee's "Let's find out!" and Next ----------
    fs = until(r.fish, lambda s: s['next'], 60, 'the problem: Swiftee and Next')
    check(fs['swiftee'] and fs['dialogue'] == 'swiftee' and r.shell()['current'] == 'fishing',
          f'{r.tag}: after three catches a giant fish pulls the net out of square, Swiftee swoops in and Next comes up')
    page.wait_for_timeout(300)
    r.shot('3h-hook')
    r.tap_el(part(page, 'fishing'), '#btn-next')
    fs = until(r.fish, lambda s: s['wave'], 5, 'the giant wave')
    check(not fs['next'], f'{r.tag}: Next: Swiftee flies off and the giant wave rises')
    page.wait_for_timeout(1600)
    r.shot('3w-wave')

    # ---------- the lake empty: the lesson dissolves in over it ----------
    st = until(r.shell, lambda s: s['current'] == 'lesson', 20, 'the lesson comes in after the wave')
    fs = r.fish()
    check(not st['veil'] and fs['level'] == 0 and fs['phase'] == 'transitioning' and fs['caught'] > 0 and fs['away'] and not fs['wave'],
          f'{r.tag}: the wave gone with Popo, the lake is empty and the lesson dissolves in over it')
    page.wait_for_timeout(120)
    r.shot('4a-lesson-comes-in')
    st = until(r.shell, lambda s: 'lesson+live' in s['frames'], 2, 'the dissolve ends')
    check(st['frames'] == ['fishing+live+covered', 'lesson+live'] and st['phase'] == 'lesson',
          f'{r.tag}: the lesson\'s frame has dissolved in over the game', ', '.join(st['frames']))
    fs = until(r.fish, silent, 3, 'the game goes quiet')
    page.wait_for_timeout(400)
    fs2 = r.fish()
    check(silent(fs2) and fs2['running'] and not fs2['hud'], f'{r.tag}: under the lesson the game goes on drawing its lake (the lesson plays over it), silent (no music, effects or voice; context {fs2["ctx"]}), its buttons away')
    ls = until(r.lesson, lambda s: s['started'], 40, 'the lesson starts its screens')
    check(ls['shared'] and ls['of'] > 50, f'{r.tag}: the lesson begins (its opening, then screen 1), through the shell\'s sound', f"{ls['of']} screens")
    if engine == 'chromium':
        st = until(r.shell, lambda s: '/parts/lesson/' in s['voice'], 20, 'the voice-over plays')
        check(True, f'{r.tag}: the lesson\'s voice plays in the shell\'s unlocked <audio>', st['voice'].split('/')[-1])
    page.wait_for_timeout(1500)
    r.shot('4b-lesson')
    check(silent(r.fish()), f'{r.tag}: still no sound of the game under the lesson')

    # ---------- the lesson over: the wave brings Popo back, Swiftee welcomes him, and the first parallelogram net ----------
    end_lesson(r)
    st = until(r.shell, lambda s: s['current'] == 'fishing', 60, 'the lesson hands over')
    check(st['phase'] == 'fishing' and 'lesson+leaving' in st['frames'], f'{r.tag}: its last screen over, the lesson hands over and its frame dissolves away', ', '.join(st['frames']))
    fs = r.fish()
    check(fs['running'] and not fs['held'] and fs['hud'] and fs['music'], f'{r.tag}: the game wakes under it, with its music')
    page.wait_for_timeout(150)
    r.shot('5-lesson-dissolves-out')
    st = until(r.shell, lambda s: s['lesson'] is None, 3, 'the lesson\'s frame goes')
    check(st['frames'] == ['fishing+live'] and not st['voice'] and 'lesson' not in st['outs'],
          f'{r.tag}: the lesson\'s frame is disposed; its voice and sound are stopped')
    fs = until(r.fish, lambda s: s['wave'] or not s['away'], 10, 'the wave brings Popo back')
    until(r.fish, lambda s: s['dialogue'] == 'swiftee', 15, 'Swiftee\'s welcome')
    check(True, f'{r.tag}: the giant wave brings Popo back and Swiftee swoops in with her welcome')
    catch_level(r, 1, '6')
    check(True, f'{r.tag}: the game carried on at its first parallelogram net (same waters), and a real catch there')

    # ---------- the end, and Play Again: the banner again, and a fresh lesson behind it ----------
    part(page, 'fishing').evaluate(FINISH)
    fs = until(r.fish, lambda s: s['again'], 60, 'The End and Play Again')
    page.wait_for_timeout(400)
    r.shot('7-the-end')
    check(fs['phase'] == 'gameComplete' and r.shell()['lesson'] is None, f'{r.tag}: after level 8, The End and Play Again (no lesson loaded yet)')
    r.tap_el(part(page, 'fishing'), '#btn-again')
    st = until(r.shell, lambda s: s['phase'] == 'front', 3, 'back to the front page')
    page.wait_for_timeout(250)
    r.shot('8a-circle-closes')
    st = until(r.shell, lambda s: s['lesson'] == 'ready', 60, 'a fresh lesson loads')
    check(st['frames'] == ['fishing+live', 'lesson'], f'{r.tag}: Play Again: back to the front page, and a fresh lesson loads behind it', ', '.join(st['frames']))
    fs = until(r.fish, lambda s: s['phase'] == 'title' and s['start'] and not s['hud'] and not s['ending'], 10, 'the banner again')
    check(fs['caught'] == 0, f'{r.tag}: the circle closes and opens on the banner from its start (Popo rows in again)')
    page.wait_for_timeout(700)
    r.shot('8b-banner-again')
    said = page.evaluate('() => window.__said.map(([k, d]) => k + ":" + (d.part || ""))')
    check(said == ['part:intro', 'finished:intro', 'part:lesson', 'finished:lesson', 'part:fishing', 'finished:fishing', 'complete:'],
          f'{r.tag}: every step is announced in order', ', '.join(said))
    res = page.evaluate('() => FishingFrenzy.results')
    check(res.get('intro', {}).get('intro') and 'results' in res.get('lesson', {}) and res.get('fishing', {}).get('levels') == 8,
          f'{r.tag}: the results of each step are kept', f"intro {res.get('intro')}, lesson {sorted(res['lesson'].keys())}, fishing {res.get('fishing')}")
    play_tap(r)
    st = until(r.shell, lambda s: s['phase'] == 'intro', 3, 'Play again: the story')
    fs = until(r.fish, lambda s: s['phase'] == 'intro' and s['running'] and s['music'], 3, 'the story again')
    check(r.fish()['lessonAfter'], f'{r.tag}: Play again: the story starts again, the lesson to follow its warm-up')

    if r.touch:
        # a tablet held upright: the journey's one rotate hint (out of the full screen Play asked for first, where the
        # browser gave it)
        full = page.evaluate('() => !!document.fullscreenElement')
        page.evaluate('() => document.fullscreenElement && document.exitFullscreen()')
        page.wait_for_timeout(300)
        page.set_viewport_size({'width': 600, 'height': 900})
        page.wait_for_timeout(400)
        st, fs = r.shell(), r.fish()
        check(st['rotate'] and not fs['rotate'], f'{r.tag}: held upright, the journey asks to be turned (one hint, not the game\'s too)',
              'Play had gone full screen' if full else 'no full screen here')
        r.shot('9-upright')
    errs = r.errors()
    check(not errs, f'{r.tag}: no errors and no failed requests in any frame', '; '.join(errs[:5]))
    r.close()


def start_fishing(p, engine, url):
    r = Run(p, engine, 'desktop', url)
    r.tag = f'{engine}-start'
    page = r.page
    # a part opened on its own goes to the journey, which starts with it (on a page of its own: leaving at once, the
    # part's page has its own scripts' loads cut short, as any page left while loading does)
    solo = r.browser.new_context().new_page()
    solo.goto(url + 'parts/fishing/index.html?debug')
    solo.wait_for_url('**/index.html?start=fishing*', timeout=10000)
    check('start=fishing' in solo.url and 'debug' in solo.url, f'{r.tag}: the game opened on its own goes to the journey with ?start=fishing', solo.url.replace(url, '/'))
    solo.goto('about:blank')  # (not closed: closing a page can hang with a WebKit build older than Playwright expects)
    page.goto(url + '?start=fishing&debug')
    st = until(r.shell, lambda s: s['fishing'] == 'ready', 60, 'the game loads')
    page.wait_for_timeout(1500)
    check(r.shell()['lesson'] is None, f'{r.tag}: ?start=fishing: no lesson loads for the first Play')
    play_tap(r)
    page.wait_for_timeout(200)
    st, fs = r.shell(), r.fish()
    check(st['phase'] == 'fishing' and st['current'] == 'fishing' and not st['veil'] and fs['phase'] == 'intro' and not fs['holding']
          and fs['running'] and fs['music'] and fs['hud'] and not fs['lessonAfter'], f'{r.tag}: Play goes straight on to the story (music on, HUD), no lesson to follow')
    until(r.fish, lambda s: s['dialogue'] == 'narrator', 10, 'the narrator')
    page.wait_for_timeout(1500)
    r.shot('1-story')
    st = r.shell()
    check(st['frames'] == ['fishing+live'], f'{r.tag}: no lesson frame anywhere', ', '.join(st['frames']))
    until(r.fish, lambda s: s['phase'] == 'puzzleReady', 90, 'the first net')
    check(True, f'{r.tag}: the first net comes down')
    # ?start=lesson: the lesson first, over the game holding where its banner cleared away; then the story
    page.goto(url + '?start=lesson&debug')
    until(r.shell, lambda s: s['fishing'] == 'ready' and s['lesson'] == 'ready', 60, 'the game, then the lesson, load')
    play_tap(r)
    page.wait_for_timeout(150)
    check(r.fish()['holding'], f'{r.tag}: ?start=lesson: Play: the banner clears away and the game holds')
    st = until(r.shell, lambda s: s['current'] == 'lesson' and 'lesson+live' in s['frames'], 5, 'the lesson comes in')
    until(r.fish, silent, 3, 'the game goes quiet')
    until(r.lesson, lambda s: s['started'], 40, 'the lesson starts')
    check(True, f'{r.tag}: ?start=lesson: the lesson dissolves in over the held game, which goes quiet')
    r.shot('2-start-lesson')
    end_lesson(r)
    st = until(r.shell, lambda s: s['current'] == 'fishing', 60, 'the lesson hands over')
    fs = until(r.fish, lambda s: s['dialogue'] == 'swiftee', 15, 'Swiftee\'s welcome')
    check(st['phase'] == 'fishing' and not fs['lessonAfter'] and fs['music'], f'{r.tag}: ?start=lesson: after the lesson the wave brings Popo in and Swiftee welcomes him, all eight nets to follow')
    until(r.fish, lambda s: s['phase'] == 'puzzleReady' and s['level'] == 1, 30, 'the first parallelogram net')
    errs = r.errors()
    check(not errs, f'{r.tag}: no errors and no failed requests in any frame', '; '.join(errs[:5]))
    r.close()


def veil(p, engine, url):
    """The first net in while the lesson is still loading: the frosted veil says "Getting ready…"; a lesson that can't
    load says so with Try again, whose real tap loads it afresh and the journey goes on."""
    r = Run(p, engine, 'desktop', url)
    r.tag = f'{engine}-veil'
    page = r.page
    held = []
    page.route('**/parts/lesson/index.html*', lambda route: held.append(route))  # the lesson's page, held back
    page.goto(url + '?debug', wait_until='domcontentloaded')  # (the page's load would wait for the held frame)
    until(r.shell, lambda s: s['fishing'] == 'ready' and s['lesson'] == 'loading' and held, 60, 'the game loads; the lesson is held back')
    play_tap(r)
    until(r.fish, lambda s: s['phase'] == 'intro' and s['lessonAfter'], 5, 'the story')
    # (the warm-up and its hook are played for real in the journey; here the game goes straight to the lesson's turn)
    part(page, 'fishing').evaluate('() => { popoDebug.game.lessonTime(PopoGame.newToken()); }')
    st = until(r.shell, lambda s: s['veil'], 5, 'the veil')
    page.wait_for_timeout(500)
    st = r.shell()
    text = page.evaluate('() => { const e = document.getElementById("veil-status"); return e.hidden ? "" : e.querySelector(".status-text").textContent; }')
    check(st['veil'] and st['phase'] == 'starting' and text == 'Getting ready…',
          f'{r.tag}: the first net in with the lesson still loading: the frosted veil says "Getting ready…" over the game', text)
    r.shot('1-getting-ready')
    # the held-back page fails (that one failed request is the test's own), and its frame says so
    n = len(r.problems)
    for route in held:
        route.abort()
    page.unroute('**/parts/lesson/index.html*')
    page.evaluate("() => FishingFrenzy.fromPart('lesson', 'failed', 'held back by the test')")
    page.wait_for_timeout(300)
    text = page.evaluate('() => document.querySelector("#veil-status .status-text").textContent')
    retry = page.locator('#veil-status .retry')
    check(text == 'Could not load the game.' and retry.is_visible(), f'{r.tag}: a lesson that can\'t load says so, with Try again', text)
    r.problems = r.problems[:n] + [x for x in r.problems[n:] if '/parts/lesson/index.html' not in x]
    r.shot('2-try-again')
    box = retry.bounding_box()
    r.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    st = until(r.shell, lambda s: s['current'] == 'lesson' and 'lesson+live' in s['frames'], 30, 'the lesson, loaded afresh')
    check(st['frames'] == ['fishing+live+covered', 'lesson+live'], f'{r.tag}: Try again: the lesson loads afresh and dissolves in', ', '.join(st['frames']))
    until(r.fish, silent, 3, 'the game goes quiet')
    page.wait_for_timeout(500)
    check(not r.shell()['veil'], f'{r.tag}: the veil has gone; the game under the lesson is silent')
    until(r.lesson, lambda s: s['started'], 40, 'the lesson starts')
    r.shot('3-lesson')
    errs = r.errors()
    check(not errs, f'{r.tag}: no errors and no failed requests in any frame', '; '.join(errs[:5]))
    r.close()


def dev_panel(p, engine, url):
    r = Run(p, engine, 'desktop', url)
    r.tag = f'{engine}-dev'
    page = r.page
    page.goto(url + '?dev=1&debug')
    until(r.shell, lambda s: s['fishing'] == 'ready' and s['lesson'] == 'ready', 90, 'both parts load at once')
    page.wait_for_function('() => document.querySelectorAll(".dev-part[data-part=fishing] button.j").length > 0 && document.querySelectorAll(".dev-part[data-part=lesson] button.j").length > 0', timeout=30000)
    labels = page.evaluate('() => [...document.querySelectorAll(".dev-part[data-part=fishing] button.j")].map((b) => b.textContent)')
    n_lesson = page.evaluate('() => document.querySelectorAll(".dev-part[data-part=lesson] button.j").length')
    check(labels[0] == 'Intro' and 'L1' in labels and 'L8' in labels and 'Finish' in labels and 'Title' not in labels and n_lesson > 50,
          f'{r.tag}: the one panel lists the game\'s jumps and the lesson\'s screens', f"game: {' '.join(labels)}; lesson: {n_lesson}")
    check(not r.fish()['ownPanel'] and page.evaluate('() => document.querySelector(".dev").classList.contains("folded")'),
          f'{r.tag}: the game shows no panel of its own; the journey\'s starts folded')
    page.click('.dev-tag')
    until(r.fish, lambda s: s['armed'], 30, 'the banner')
    r.shot('1-panel')
    page.keyboard.press('`')
    folded = page.evaluate('() => document.querySelector(".dev").classList.contains("folded")')
    part(page, 'fishing').locator('#stage').focus()
    part(page, 'fishing').press('#stage', '`')
    refolded = page.evaluate('() => document.querySelector(".dev").classList.contains("folded")')
    check(folded and not refolded, f'{r.tag}: the backtick key folds and unfolds the panel (also with the game focused)')

    lesson_btn = lambda n: page.locator('.dev-part[data-part="lesson"] button.j').nth(n)
    game_btn = lambda label: page.locator('.dev-part[data-part="fishing"] button.j', has_text=label).first
    lesson_btn(9).click()
    st = until(r.shell, lambda s: s['current'] == 'lesson' and 'lesson+live' in s['frames'], 10, 'a lesson screen shows the lesson')
    ls = until(r.lesson, lambda s: s['step'] == 9, 15, 'the lesson at screen 10')
    until(r.fish, silent, 3, 'the game goes quiet')
    page.wait_for_timeout(2500)
    check(r.lesson()['step'] == 9, f'{r.tag}: a lesson screen shows the lesson over the game at that screen (and it stays there); the game goes quiet')
    r.shot('2-lesson-screen-10')
    game_btn('L3').click()
    st = until(r.shell, lambda s: s['current'] == 'fishing' and s['lesson'] != 'ready' or s['frames'][-1:] == ['lesson+leaving'], 5, 'a game level takes the lesson away')
    fs = until(r.fish, lambda s: s['phase'] == 'puzzleReady' and s['level'] == 3, 15, 'the game at net 3')  # (index 0 is the warm-up)
    check(fs['running'] and not fs['held'] and fs['hud'] and fs['music'], f'{r.tag}: a game level: the lesson goes, the game wakes there (drawing, music, HUD)')
    st = until(r.shell, lambda s: 'lesson+leaving' not in s['frames'], 3, 'the lesson gone')
    r.shot('3-level-3')
    game_btn('Solve').click()
    until(r.fish, lambda s: s['ok'], 5, 'Solve')
    check(True, f'{r.tag}: the game\'s Solve jump works in the journey')
    page.locator('.dev button.j.home').click()
    fs = until(r.fish, lambda s: s['phase'] == 'title' and s['start'] and not s['hud'], 5, 'the banner')
    check(r.shell()['phase'] == 'front', f'{r.tag}: Front page: the banner again from its start')
    st = until(r.shell, lambda s: s['lesson'] == 'ready', 30, 'a fresh lesson for the panel')
    lesson_btn(0).click()
    st = until(r.shell, lambda s: s['current'] == 'lesson' and 'lesson+live' in s['frames'], 10, 'back to the lesson')
    ls = until(r.lesson, lambda s: s['started'] and s['step'] == 0, 15, 'screen 1')
    check(True, f'{r.tag}: a lesson screen from the front page: the lesson over the banner, at that screen')
    page.locator('.dev button.j.home').click()
    st = until(r.shell, lambda s: s['phase'] == 'front' and s['frames'] == ['fishing+live'], 3, 'the front page')
    st = until(r.shell, lambda s: s['lesson'] == 'ready', 30, 'a fresh lesson')
    page.click('.dev-tag')  # (fold it away for the real Play)
    play_tap(r)
    until(r.shell, lambda s: s['phase'] == 'intro' and s['current'] == 'fishing', 5, 'Play: the story')
    until(r.fish, lambda s: s['dialogue'] == 'narrator' and s['lessonAfter'], 10, 'the narrator')
    check(True, f'{r.tag}: and the banner\'s Play still starts the journey: the story, the lesson to follow the first net')
    errs = r.errors()
    check(not errs, f'{r.tag}: no errors and no failed requests in any frame', '; '.join(errs[:5]))
    r.close()


if __name__ == '__main__':
    engines = {'chromium': ['chromium'], 'webkit': ['webkit'], 'all': ['chromium', 'webkit']}[sys.argv[1] if len(sys.argv) > 1 else 'all']
    which = sys.argv[2] if len(sys.argv) > 2 else 'all'
    url, srv = server()
    with sync_playwright() as p:
        for engine in engines:
            if which in ('journey', 'all'):
                for size in SIZES:
                    journey(p, engine, size, url)
            if which in ('start', 'all'):
                start_fishing(p, engine, url)
            if which in ('veil', 'all'):
                veil(p, engine, url)
            if which in ('dev', 'all'):
                dev_panel(p, engine, url)
    if srv:
        srv.shutdown()
    print(f'ALL PASSED ({len(passed)} checks); screenshots in {SHOTS}')
