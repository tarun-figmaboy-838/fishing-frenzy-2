// Regenerates assets/thumbs/NN.webp, the snapshots shown in the top-left screen list.
// Opens the game in headless Chrome, jumps to each screen, waits for its line and captures the stage.
// Run from this folder after changing screens: node dev/tools/build-thumbs.js   (Node 22+, Chrome or Edge installed;
// set CHROME=/path/to/chrome if it is not found)
const { spawn } = require('child_process'), http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(ROOT, 'assets', 'thumbs');
const PORT = 8791, DBG = 9391, WAIT_MS = 3200;
const CANDIDATES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const chromePath = CANDIDATES.find((p) => fs.existsSync(p));
if (!chromePath) { console.error('Chrome not found; set CHROME=/path/to/chrome'); process.exit(1); }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.json': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(u)] || 'application/octet-stream' }); r.end(d); });
}).listen(PORT);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'thumbs-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + DBG, '--user-data-dir=' + prof, '--window-size=1280,720', 'about:blank']);

(async () => {
  let ws; for (let i = 0; i < 60 && !ws; i++) { try { const j = await (await fetch('http://127.0.0.1:' + DBG + '/json/list')).json(); const pg = j.find((x) => x.type === 'page'); if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) {} if (!ws) await sleep(250); }
  const sock = new WebSocket(ws); await new Promise((r) => (sock.onopen = r)); let id = 0; const pend = {};
  sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d.result || {}); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; sock.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => ((await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result || {}).value;
  await send('Page.enable');
  // keep a handle on the game, and never move on by itself while capturing
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window,'TrapeziumGame',{configurable:true,set(v){const o=v.prototype.componentDidMount;v.prototype.componentDidMount=function(){window.__g=this;return o.call(this)};this.__tg=v},get(){return this.__tg}})` });
  await send('Page.navigate', { url: 'http://localhost:' + PORT + '/' });
  for (let i = 0; i < 40 && (await ev('typeof __g')) !== 'object'; i++) await sleep(250);
  await ev(`document.body.classList.add('thumbs-capture'); CONFIG.flow.advanceMs = 1e9; LESSON.steps.forEach((s) => { delete s.autoNext; });`);
  const n = await ev('__g.steps().length');
  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 0; i < n; i++) {
    await ev(`__g.jumpTo(${i})`);
    await sleep(WAIT_MS);
    const r = await ev(`(() => { const b = document.querySelector('.stage').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()`);
    const shot = await send('Page.captureScreenshot', { format: 'webp', quality: 82, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 320 / r.w } });
    const file = path.join(OUT, String(i + 1).padStart(2, '0') + '.webp');
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log('wrote', path.relative(ROOT, file));
  }
  // drop snapshots of screens that no longer exist
  fs.readdirSync(OUT).filter((f) => /^\d+\.webp$/.test(f) && parseInt(f, 10) > n).forEach((f) => fs.unlinkSync(path.join(OUT, f)));
  chrome.kill(); srv.close(); process.exit(0);
})();
