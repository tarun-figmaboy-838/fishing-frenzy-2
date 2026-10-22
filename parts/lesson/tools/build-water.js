// Prepares the animated water background from tools/water-painting.png (run once after changing the image):
//   assets/images/water-bg.webp     the background with the underwater grass painted out (water filled in behind it)
//   assets/images/water-grass-N.png each grass tuft on its own, so js/water.js can sway it without a ghost behind
//   js/water-manifest.js            sizes and positions (a script, so the game still works when opened from disk)
// The image work runs in headless Chrome (canvas), like build-thumbs.js. Run from the game folder:
//   node tools/build-water.js
const { spawn } = require('child_process'), http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..'), SRC = 'tools/water-painting.png';
const PORT = 8871, DBG = 9471;
const CANDIDATES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const chromePath = CANDIDATES.find((p) => fs.existsSync(p));
if (!chromePath) { console.error('Chrome not found; set CHROME=/path/to/chrome'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/') { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><body></body>'); return; }
  fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': 'image/png' }); r.end(d); });
}).listen(PORT);
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + DBG, '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'water-')), 'about:blank']);

// runs in the page: find the grass, paint it out, cut each tuft as a sprite
const WORK = `(async () => {
  const img = new Image(); img.src = '/' + encodeURI(${JSON.stringify(SRC)}); await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, W, H), d = id.data;
  // grass = clearly green pixels on the sea floor: green leads red and blue by > 28 (sampled: grass 48-84; the cyan light
  // lines on the sea floor only 7-11)
  const Y0 = Math.round(H * 0.78), core = new Uint8Array(W * H);
  const lead = (i) => d[i + 1] - Math.max(d[i], d[i + 2]), green = (i) => lead(i) > 28;
  for (let y = Y0; y < H; y++) for (let x = 0; x < W; x++) if (green((y * W + x) * 4)) core[y * W + x] = 1;
  // clusters (tufts): flood fill over 8-neighbours, joining pixels up to 3 px apart
  const seen = new Uint8Array(W * H), tufts = [];
  for (let p = 0; p < W * H; p++) {
    if (!core[p] || seen[p]) continue;
    const st = [p]; seen[p] = 1; let x0 = W, x1 = 0, y0 = H, y1 = 0, n = 0;
    while (st.length) { const q = st.pop(), qx = q % W, qy = (q / W) | 0; n++;
      x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const r = ny * W + nx; if (core[r] && !seen[r]) { seen[r] = 1; st.push(r); } } }
    if (n >= 6) tufts.push({ x0: x0, x1: x1, y0: y0, y1: y1, n: n });
  }
  // the soft edge of each blade: pixels next to the core that lean green are part of the grass too (partial alpha)
  const mask = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) if (core[p]) mask[p] = 1;
  for (let pass = 0; pass < 2; pass++) {
    const add = [];
    for (let y = Y0; y < H; y++) for (let x = 1; x < W - 1; x++) { const p = y * W + x; if (mask[p]) continue;
      let near = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const r = p + dy * W + dx; if (r >= 0 && r < W * H && mask[r] > near) near = mask[r]; }
      if (!near) continue; const i = p * 4, lean = lead(i) / 40; if (lean < 0.2) continue;
      add.push([p, Math.min(0.85, lean) * near]); }
    add.forEach((a) => { mask[a[0]] = Math.max(mask[a[0]], a[1]); });
  }
  // paint the grass out: fill each grass pixel from the nearest clear pixels left and right in its row
  const out = new Uint8ClampedArray(d), PAD = 3;
  tufts.forEach((t) => {
    for (let y = t.y0 - PAD; y <= t.y1 + 1; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = t.x0 - PAD; x <= t.x1 + PAD; x++) {
        const p = y * W + x; if (!mask[p]) continue;
        let L = x, R = x; while (L > 0 && mask[y * W + L]) L--; while (R < W - 1 && mask[y * W + R]) R++;
        const w = (x - L) / Math.max(1, R - L), i = p * 4, li = (y * W + L) * 4, ri = (y * W + R) * 4;
        for (let c = 0; c < 3; c++) out[i + c] = d[li + c] * (1 - w) + d[ri + c] * w;
      }
    }
  });
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  bg.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0);
  // each tuft as its own sprite: the original grass pixels, alpha from the mask
  const sprites = tufts.map((t) => {
    const x0 = t.x0 - PAD, y0 = t.y0 - PAD, w = t.x1 - t.x0 + 1 + 2 * PAD, h = t.y1 - t.y0 + 1 + PAD + 1;
    const sp = new ImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gx = x0 + x, gy = y0 + y; if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
      const p = gy * W + gx, i = p * 4, o = (y * w + x) * 4; if (!mask[p]) continue;
      sp.data[o] = d[i]; sp.data[o + 1] = d[i + 1]; sp.data[o + 2] = d[i + 2]; sp.data[o + 3] = Math.round(255 * mask[p]); }
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(sp, 0, 0);
    return { x: x0, y: y0, w: w, h: h, n: t.n, png: c.toDataURL('image/png') };
  });
  return { W: W, H: H, bg: bg.toDataURL('image/webp', 0.92), sprites: sprites };
})()`;

(async () => {
  let ws; for (let i = 0; i < 80 && !ws; i++) { try { const j = await (await fetch('http://127.0.0.1:' + DBG + '/json/list')).json(); const pg = j.find((x) => x.type === 'page'); if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) {} if (!ws) await sleep(250); }
  const sock = new WebSocket(ws); await new Promise((r) => (sock.onopen = r)); let id = 0; const pend = {};
  sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d.result || {}); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; sock.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Page.navigate', { url: 'http://localhost:' + PORT + '/' }); await sleep(800);
  const res = await send('Runtime.evaluate', { expression: WORK, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) { console.error(JSON.stringify(res.exceptionDetails).slice(0, 600)); process.exit(1); }
  const v = res.result.value, IMG = path.join(ROOT, 'assets', 'images');
  fs.writeFileSync(path.join(IMG, 'water-bg.webp'), Buffer.from(v.bg.split(',')[1], 'base64'));
  fs.readdirSync(IMG).filter((f) => /^water-grass-\d+\.png$/.test(f)).forEach((f) => fs.unlinkSync(path.join(IMG, f)));
  const grass = v.sprites.map((s, i) => {
    const f = 'water-grass-' + (i + 1) + '.png';
    fs.writeFileSync(path.join(IMG, f), Buffer.from(s.png.split(',')[1], 'base64'));
    console.log('grass tuft ' + (i + 1) + ': ' + s.w + 'x' + s.h + ' at ' + s.x + ',' + s.y + ' (' + s.n + ' px)');
    return { src: 'assets/images/' + f, x: s.x, y: s.y, w: s.w, h: s.h };
  });
  const manifest = { src: 'assets/images/water-bg.webp', w: v.W, h: v.H, grass: grass };
  fs.writeFileSync(path.join(ROOT, 'js', 'water-manifest.js'),
    '// GENERATED by tools/build-water.js from "' + SRC + '" - do not edit by hand.\nwindow.WATER_MANIFEST = ' + JSON.stringify(manifest) + ';\n');
  console.log('wrote assets/images/water-bg.webp, ' + grass.length + ' grass sprites, js/water-manifest.js');
  chrome.kill(); srv.close(); process.exit(0);
})();
