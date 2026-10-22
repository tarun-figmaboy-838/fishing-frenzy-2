// Turns a hand-made frame sheet (e.g. swiftee-measuring-draft.png: 4 x 2 frames on a painted checkerboard)
// into a game sheet that matches the official Swiftee sheets: uniform grid, transparent background,
// every frame registered on the same head-centre and feet line, Swiftee at the same size as everywhere else.
//   node dev/tools/build-measuring-sheet.js <source.png> [cols=4] [rows=2]
// Writes swiftee-assets/extra/swiftee_measuring@1x.webp and @2x.webp, then run tools/build-swiftee-manifest.js.
// Needs Chrome or Edge (set CHROME=... if not found).
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', '..');
const [SRC, COLS = '4', ROWS = '2'] = process.argv.slice(2);
if (!SRC) { console.error('usage: node dev/tools/build-measuring-sheet.js <source.png> [cols] [rows]'); process.exit(1); }
const CANDIDATES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const chromePath = CANDIDATES.find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(ROOT, 'swiftee-assets', 'extra');

// Runs in the browser: returns { '1x': dataURL, '2x': dataURL, frames, report }
function processSheet(src, cols, rows) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const W = im.width, H = im.height, cw = W / cols, ch = H / rows;
      // official sheets (@2x, 512 cell): standing Swiftee is ~391 px tall with feet on y = 449, centred on x = 256
      const TARGET_H = 391, FEET = 449, CX = 256, CELL = 512;
      const frames = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x0 = Math.round(c * cw), y0 = Math.round(r * ch), w = Math.round(cw), h = Math.round(ch);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.drawImage(im, x0, y0, w, h, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h), d = id.data;
        // background = low-saturation light pixels (the painted checkerboard), flood-filled from the cell edges
        const bgLike = (i) => { const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B); return mx > 150 && mx - mn < 26; };
        const seen = new Uint8Array(w * h), stack = [];
        for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
        for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
        while (stack.length) {
          const p = stack.pop(); if (seen[p]) continue;
          if (!bgLike(p * 4)) continue;
          seen[p] = 1; d[p * 4 + 3] = 0;
          const x = p % w, y = (p - x) / w;
          if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
        }
        // soften the cut edge: pale, grey-ish pixels touching the background fade out (removes checker halo)
        for (let pass = 0; pass < 2; pass++) {
          const kill = [];
          for (let p = 0; p < w * h; p++) {
            if (!d[p * 4 + 3]) continue;
            const x = p % w, y = (p - x) / w;
            const nb = (x > 0 && !d[(p - 1) * 4 + 3]) || (x < w - 1 && !d[(p + 1) * 4 + 3]) || (y > 0 && !d[(p - w) * 4 + 3]) || (y < h - 1 && !d[(p + w) * 4 + 3]);
            if (!nb) continue;
            const i = p * 4, mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
            if (mx > 120 && mx - mn < 40) kill.push(i); else if (pass === 1) d[i + 3] = 170; // anti-alias the outline
          }
          kill.forEach((i) => { d[i + 3] = 0; });
        }
        ctx.putImageData(id, 0, 0);
        // registration: feet = lowest opaque row; head centre = middle of the opaque span in the top 30% of the figure
        let top = h, bot = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (y < top) top = y; if (y > bot) bot = y; }
        let hl = w, hr = -1; const hy1 = top + Math.round((bot - top) * 0.3);
        for (let y = top; y <= hy1; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < hl) hl = x; if (x > hr) hr = x; }
        frames.push({ cv, top, bot, hcx: (hl + hr) / 2 });
      }
      // one scale for all frames (from the tallest), so the walk does not pulse in size
      const figH = Math.max(...frames.map((f) => f.bot - f.top));
      const k = TARGET_H / figH;
      const out = {};
      for (const [tag, cell] of [['2x', CELL], ['1x', CELL / 2]]) {
        const s = cell / CELL, sheet = document.createElement('canvas');
        sheet.width = cols * cell; sheet.height = rows * cell;
        const sx = sheet.getContext('2d'); sx.imageSmoothingQuality = 'high';
        frames.forEach((f, n) => {
          const gx = (n % cols) * cell, gy = Math.floor(n / cols) * cell;
          sx.save(); sx.beginPath(); sx.rect(gx, gy, cell, cell); sx.clip();
          sx.drawImage(f.cv, gx + (CX - f.hcx * k) * s, gy + (FEET - f.bot * k) * s, f.cv.width * k * s, f.cv.height * k * s);
          sx.restore();
        });
        out[tag] = sheet.toDataURL('image/webp', 0.92);
      }
      resolve({ out, frames: frames.length, report: frames.map((f) => [f.top, f.bot, Math.round(f.hcx)]) });
    };
    im.src = src;
  });
}

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'msheet-'));
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9398', '--user-data-dir=' + prof, 'about:blank']);
  let ws; for (let i = 0; i < 60 && !ws; i++) { try { const j = await (await fetch('http://127.0.0.1:9398/json/list')).json(); const p = j.find((x) => x.type === 'page'); if (p) ws = p.webSocketDebuggerUrl; } catch (e) {} if (!ws) await sleep(250); }
  const sock = new WebSocket(ws); await new Promise((r) => (sock.onopen = r)); let id = 0; const pend = {};
  sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d.result); delete pend[d.id]; } };
  const send = (method, params) => new Promise((r) => { const i = ++id; pend[i] = r; sock.send(JSON.stringify({ id: i, method, params })); });
  const src = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: '(' + processSheet.toString() + ')(' + JSON.stringify(src) + ',' + (+COLS) + ',' + (+ROWS) + ')' });
  const v = r.result.value;
  fs.mkdirSync(OUT, { recursive: true });
  for (const tag of ['1x', '2x']) {
    const f = path.join(OUT, 'swiftee_measuring@' + tag + '.webp');
    fs.writeFileSync(f, Buffer.from(v.out[tag].split(',')[1], 'base64'));
    console.log('wrote', path.relative(ROOT, f), fs.statSync(f).size, 'bytes');
  }
  fs.writeFileSync(path.join(OUT, 'extra.json'), JSON.stringify({
    note: 'Extra Swiftee animations built by tools/build-measuring-sheet.js; merged into js/swiftee-manifest.js',
    animations: { measuring: { frames: v.frames, cols: +COLS, fps: 10, loop: true, images: { '1x': 'extra/swiftee_measuring@1x.webp', '2x': 'extra/swiftee_measuring@2x.webp' } } }
  }, null, 2));
  console.log('frames', v.frames, 'registration [top, feet, headX]:', JSON.stringify(v.report));
  chrome.kill(); process.exit(0);
})();
