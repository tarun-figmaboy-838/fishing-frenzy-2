/**
 * Rasterises the Swiftee Rive rig to deterministic, pre-aligned PNG frames.
 *
 * Why a browser: Rive's renderer ships as WASM targeting a canvas, so driving
 * the official runtime in headless Chromium is the supported way to rasterise a
 * .riv outside the editor. We step the timeline by hand instead of using
 * requestAnimationFrame, so output is frame-exact and reproducible.
 *
 * The important trick is the two passes:
 *
 *   1. MEASURE - sample frames across every animation and union their opaque
 *      bounds. This finds how far the art actually reaches, which the artboard
 *      rect alone doesn't tell you.
 *   2. RENDER - derive ONE square content box, centred on the artboard centre,
 *      that contains every pose of every animation, and map that box onto the
 *      cell for every single frame.
 *
 * Because all 82 animations share that one box, every frame lands pre-registered
 * in an identical cell with the pivot at the exact centre. Any pose can be swapped
 * for any other, from any animation, and the character will not shift a pixel.
 *
 * Output: build/.cache/frames/<anim>/<anim>_###.png   (cell*2 px, 8-bit alpha)
 *         build/.cache/frames/render.json             (contract for the packer)
 *
 * Usage:
 *   cd build && npm install
 *   node render_rive.mjs                    # 20fps, 256px cell (renders at 512)
 *   node render_rive.mjs --fps 30 --cell 384
 *   node render_rive.mjs --only Waving,Sleeping
 */

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const argv = process.argv.slice(2);
const num = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : Number(argv[i + 1]); };
const strArg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const str = strArg;
// Each .riv defines its own artboard, and therefore its own cell - so each one
// renders into its own cache directory and packs into its own output prefix.
// Mixing two artboards into one cell would break the shared-pivot guarantee.
const RIV_REL = strArg('riv', 'source/rive/swiftee.riv');
const RIV = path.resolve(ROOT, RIV_REL);
const CACHE_REL = strArg('cache-dir', '.cache/frames');
const OUT = path.resolve(HERE, CACHE_REL);
const ADV = path.join(HERE, 'node_modules', '@rive-app', 'canvas-advanced');


const FPS = num('fps', 20);
const CELL = num('cell', 256);          // delivered @1x cell
const RENDER = CELL * 2;                // we always render @2x and downscale later
const MARGIN = num('margin', 0.02);     // safety ring around measured art, fraction of half-extent
const ONLY = str('only', '');
const SAMPLES = num('samples', 0);      // frames sampled per animation while measuring; 0 = all
const MEASURE_SIZE = num('measure-size', 360); // measure canvas px - coarse is fine and fast
// How the shared cell is framed:
//   artboard - the cell IS the artboard. The artist framed the character there,
//              so sprites match what a Rive runtime would draw, and the few
//              travel animations exit the frame exactly as authored.
//   measured - grow the cell until every pose of every animation fits. Correct
//              but the Driving animations travel ~450px off-centre, which
//              shrinks the character to about half size in every other cell.
const FIT = str('fit', 'artboard');

const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const PAGE = `<!doctype html><meta charset="utf-8"><canvas id="c"></canvas>
<script type="module">
import RiveCanvas from '/adv/canvas_advanced.mjs';
window.__boot = (async () => {
  const r = await RiveCanvas({ locateFile: (f) => '/adv/' + f });
  window.rive = r;

  window.open_ = async (bytes) => {
    const file = await r.load(new Uint8Array(bytes));
    window.__file = file;
    const ab = file.artboardByIndex(0);
    window.__ab = ab;
    const b = ab.bounds;
    return {
      artboard: ab.name,
      w: b.maxX - b.minX, h: b.maxY - b.minY,
      animations: Array.from({ length: ab.animationCount() }, (_, i) => {
        const a = ab.animationByIndex(i);
        return { index: i, name: a.name, duration: a.duration, fps: a.fps, loopValue: a.loopValue };
      }),
    };
  };

  // Size the canvas and build the renderer. Done once per pass, not per
  // animation - makeRenderer is expensive and leaks if churned.
  window.setCanvas = (canvasSize) => {
    const cv = document.getElementById('c');
    cv.width = canvasSize; cv.height = canvasSize;
    if (window.__ren) window.__ren.delete();
    window.__ren = r.makeRenderer(cv);
    window.__size = canvasSize;
  };

  // Map an arbitrary artboard-space rect onto the canvas and arm an animation.
  // box = [minX, minY, maxX, maxY] in artboard coordinates; it may extend
  // outside the artboard, which is exactly how we add margin.
  //
  // A Rive animation only writes the properties it actually keyframes, so
  // whatever a previous animation left behind stays put - that is how the
  // sleeping Zzz ends up floating behind a waving bird. Every animation
  // therefore gets a FRESH artboard instance rather than reusing one.
  window.setup = (animIndex, box) => {
    if (window.__anim) window.__anim.delete();
    if (window.__ab) window.__ab.delete();
    const ab = window.__file.artboardByIndex(0);
    window.__ab = ab;
    const [bx0, by0, bx1, by1] = box;
    const s = window.__size / (bx1 - bx0);
    const b = ab.bounds;
    // Where the artboard rect itself lands once the content box fills the canvas.
    window.__frame = {
      minX: (b.minX - bx0) * s, minY: (b.minY - by0) * s,
      maxX: (b.maxX - bx0) * s, maxY: (b.maxY - by0) * s,
    };
    window.__anim = new r.LinearAnimationInstance(ab.animationByIndex(animIndex), ab);
    window.__anim.advance(0); window.__anim.apply(1); ab.advance(0);
  };

  window.step = (dt) => {
    const ab = window.__ab, ren = window.__ren;
    if (dt > 0) { window.__anim.advance(dt); window.__anim.apply(1); ab.advance(dt); }
    ren.clear(); ren.save();
    // Fit.fill onto a frame with the artboard's own aspect = pure uniform scale.
    ren.align(r.Fit.fill, r.Alignment.center, window.__frame, ab.bounds);
    ab.draw(ren); ren.restore(); ren.flush();
    if (r.resolveAnimationFrame) r.resolveAnimationFrame();
    return document.getElementById('c').toDataURL('image/png');
  };

  // Opaque bounds without a PNG round-trip - much faster for the measure pass.
  window.bounds = () => {
    const cv = document.getElementById('c');
    const { width: w, height: h } = cv;
    const d = cv.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 2) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
  };
  return true;
})();
</script>`;

// ---------------------------------------------------------------------------
const CHROME = [
  ...(fs.existsSync(`${process.env.HOME}/Library/Caches/ms-playwright`)
    ? fs.readdirSync(`${process.env.HOME}/Library/Caches/ms-playwright`)
        .filter((d) => d.startsWith('chromium-'))
        .map((d) => `${process.env.HOME}/Library/Caches/ms-playwright/${d}/chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium`)
    : []),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => fs.existsSync(p));

if (!CHROME) throw new Error('No Chrome/Chromium found. Run: npx playwright install chromium');
if (!fs.existsSync(ADV)) throw new Error('Missing deps. Run: cd build && npm install');
if (!fs.existsSync(RIV)) throw new Error(`Missing ${RIV}`);

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('  [page]', e.message));
await page.route('**/*', (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: PAGE });
  if (u.pathname.startsWith('/adv/')) {
    // The bundle requests canvas_advanced.wasm; the package ships it as rive.wasm.
    let n = u.pathname.slice(5);
    if (n === 'canvas_advanced.wasm') n = 'rive.wasm';
    const p = path.join(ADV, n);
    if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: n.endsWith('.mjs') ? 'text/javascript' : 'application/wasm',
      body: fs.readFileSync(p),
    });
  }
  return route.fulfill({ status: 404, body: '' });
});

await page.goto('http://swiftee.local/');
await page.waitForFunction('window.__boot !== undefined');
await page.evaluate('window.__boot');

const bytes = Array.from(fs.readFileSync(RIV));
const info = await page.evaluate((b) => window.open_(b), bytes);
const only = ONLY ? new Set(ONLY.split(',').map((s) => slug(s))) : null;
const anims = info.animations.filter((a) => !only || only.has(slug(a.name)));

console.log(`${RIV_REL}: artboard "${info.artboard}" ${info.w}x${info.h}, ${info.animations.length} animations`);
console.log(`rendering ${anims.length} at ${FPS}fps into ${RENDER}px cells\n`);

const frameCount = (a) => Math.max(1, Math.round((a.duration / a.fps) * FPS));

// --- pass 1: measure -------------------------------------------------------
// Sample at 1.8x the artboard so anything reaching past the artboard rect is
// still captured rather than clipped by the canvas edge.
// Measure on a canvas 1.8x the artboard so art reaching past the artboard rect
// is captured instead of being clipped by the canvas edge. Coarse resolution is
// fine - we only need bounds, and the margin absorbs the rounding.
const PAD = 1.8;
const MS = MEASURE_SIZE;
const span = info.w * PAD;
const half = (span - info.w) / 2;
const measureBox = [-half, -half, info.w + half, info.h + half];
const toArtboard = (v, lo) => (v * span) / MS + lo;

await page.evaluate((s) => window.setCanvas(s), MS);
let u = null;
const perAnim = {};
for (const a of anims) {
  const n = frameCount(a);
  const secs = a.duration / a.fps;
  const picks = SAMPLES > 0 ? Math.min(SAMPLES, n) : n;
  const dt = secs / picks;
  await page.evaluate(([i, b]) => window.setup(i, b), [a.index, measureBox]);
  let au = null;
  for (let k = 0; k < picks; k++) {
    await page.evaluate((d) => window.step(d), k === 0 ? 0 : dt);
    const bb = await page.evaluate('window.bounds()');
    if (!bb) continue;
    const box = [toArtboard(bb[0], measureBox[0]), toArtboard(bb[1], measureBox[1]),
                 toArtboard(bb[2], measureBox[0]), toArtboard(bb[3], measureBox[1])];
    au = au ? [Math.min(au[0], box[0]), Math.min(au[1], box[1]),
               Math.max(au[2], box[2]), Math.max(au[3], box[3])] : box;
  }
  if (!au) continue;
  perAnim[slug(a.name)] = au.map((v) => Math.round(v));
  u = u ? [Math.min(u[0], au[0]), Math.min(u[1], au[1]),
           Math.max(u[2], au[2]), Math.max(u[3], au[3])] : au;
}
if (!u) throw new Error('measure pass found no opaque pixels');

const cx = info.w / 2, cy = info.h / 2;
// Always a SQUARE box centred on the artboard centre. Square keeps the pivot at
// the exact cell centre and lets every downstream consumer assume one cell size;
// a non-square artboard just gets transparent bands, which cost nothing.
let reach;
if (FIT === 'measured') {
  // Furthest any pose reaches from the centre, plus a safety ring.
  reach = Math.max(cx - u[0], u[2] - cx, cy - u[1], u[3] - cy);
} else {
  // The artboard's own half-extent: the frame the artist composed in.
  reach = Math.max(info.w, info.h) / 2;
}
reach *= 1 + MARGIN;
const contentBox = [cx - reach, cy - reach, cx + reach, cy + reach];

// Animations whose art leaves the cell. For --fit artboard these are the travel
// animations, and exiting the frame is the authored intent - but say so out loud
// rather than letting it look like a bug.
const exits = Object.entries(perAnim)
  .filter(([, b]) => b[0] < contentBox[0] - 1 || b[1] < contentBox[1] - 1
                  || b[2] > contentBox[2] + 1 || b[3] > contentBox[3] + 1)
  .map(([k]) => k);

console.log(`measured art bounds: ${u.map((v) => v.toFixed(0)).join(', ')} (artboard space, all frames)`);
console.log(`fit=${FIT} -> cell covers ${contentBox.map((v) => v.toFixed(0)).join(', ')} = ${(contentBox[2] - contentBox[0]).toFixed(0)}px mapped to ${RENDER}px`);
if (exits.length) console.log(`art leaves the cell in: ${exits.join(', ')}  (travel animations - authored to exit frame)`);
console.log();

// --- pass 2: render --------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const report = {
  riv: RIV_REL,
  artboard: info.artboard,
  artboardSize: { w: info.w, h: info.h },
  fps: FPS,
  cell: CELL,
  renderCell: RENDER,
  fit: FIT,
  contentBox: { minX: contentBox[0], minY: contentBox[1], maxX: contentBox[2], maxY: contentBox[3] },
  measuredArtBounds: { minX: Math.round(u[0]), minY: Math.round(u[1]), maxX: Math.round(u[2]), maxY: Math.round(u[3]) },
  margin: MARGIN,
  exitsCell: exits,
  animations: {},
};

await page.evaluate((s) => window.setCanvas(s), RENDER);
let done = 0;
for (const a of anims) {
  const key = slug(a.name);
  const n = frameCount(a);
  const secs = a.duration / a.fps;
  const dt = secs / n; // sampling [0, n) leaves frame n == frame 0, so loops are seamless
  const dir = path.join(OUT, key);
  fs.mkdirSync(dir, { recursive: true });

  await page.evaluate(([i, b]) => window.setup(i, b), [a.index, contentBox]);
  for (let f = 0; f < n; f++) {
    const url = await page.evaluate((d) => window.step(d), f === 0 ? 0 : dt);
    fs.writeFileSync(path.join(dir, `${key}_${String(f).padStart(3, '0')}.png`),
                     Buffer.from(url.split(',')[1], 'base64'));
  }

  report.animations[key] = {
    name: a.name,
    timelineFrames: a.duration,
    timelineFps: a.fps,
    durationSec: Number(secs.toFixed(4)),
    frames: n,
    // Rive loop values: 0 one-shot, 1 loop, 2 ping-pong
    loopValue: a.loopValue,
    loop: a.loopValue !== 0,
    pingpong: a.loopValue === 2,
    artBounds: perAnim[key] || null,
    exitsCell: exits.includes(key),
    dir: key,
  };
  done += n;
  console.log(`  ${key.padEnd(20)} ${String(n).padStart(3)} frames  ${secs.toFixed(2)}s  ${a.loopValue === 0 ? 'one-shot' : a.loopValue === 2 ? 'ping-pong' : 'loop'}`);
}

fs.writeFileSync(path.join(OUT, 'render.json'), JSON.stringify(report, null, 2));
await browser.close();
console.log(`\n${anims.length} animations, ${done} frames -> build/${CACHE_REL}/`);
console.log(`next: python3 build/pack_spritesheets.py --cache-dir build/${CACHE_REL}`);
