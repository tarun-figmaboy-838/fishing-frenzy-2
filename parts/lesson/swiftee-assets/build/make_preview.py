#!/usr/bin/env python3
"""Writes preview/index.html - an interactive playground for the built sheets.

Open it with file:// after packing. It samples the sheets exactly the way a game
engine does (uniform cells, pivot dead centre), so what you see is what you get.

It stays a local page on purpose: it reads 13 MB of PNGs off disk, which a
hosted page cannot do.

What it is for:
  * pick several animations at once and watch them together
  * prove registration - stack them and see the pivot hold
  * audition the start -> loop -> stop chain for a state
  * change fps, size, flip, background and guides live
  * copy an engine-ready reference for any frame you land on
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read_set(manifest_path: Path) -> dict:
    m = json.loads(manifest_path.read_text())
    one, two = m["scales"]["1x"]["sheets"], m["scales"]["2x"]["sheets"]

    anims = {}
    for k, v in one.items():
        if v["pages"] > 1:      # never happens at 1x today, but do not lie about it
            continue
        hi = two.get(k)
        a = m["animations"][k]
        anims[k] = {
            "img": "../" + v["image"], "cols": v["cols"], "rows": v["rows"],
            # @2x is offered for large display sizes; paged sheets have no
            # single-image form, so those fall back to @1x.
            "img2": ("../" + hi["image"]) if hi and hi["pages"] == 1 else None,
            "cols2": hi["cols"] if hi and hi["pages"] == 1 else None,
            "rows2": hi["rows"] if hi and hi["pages"] == 1 else None,
            "n": v["frames"], "loop": a["loop"], "pingpong": a["pingpong"],
            "ms": a["durationMs"], "name": a["name"],
            "exits": k in m["exitsCell"],
            "bounds": a["opaqueBoundsUnion"],
        }

    # Which state does each animation belong to, so chain mode can find the triad.
    state_of = {}
    for s, parts in m["states"].items():
        for role in ("start", "loop", "stop"):
            if parts[role]:
                state_of[parts[role]] = s

    return {
        "fps": m["fps"],
        "cell": m["cell"]["1x"], "cellPx": m["cell"]["2x"],
        "baseline": m["baselineY"]["normalized"],
        "baselineRef": m["baselineY"].get("reference", ""),
        "atlasDir": "atlas" + (("/" + manifest_path.parent.name)
                               if manifest_path.parent != ROOT / "atlas" else ""),
        "states": m["states"], "stateOf": state_of,
        "standalone": m["standalone"], "anims": anims,
    }


sets = {}
main = ROOT / "atlas" / "swiftee.manifest.json"
if main.exists():
    sets["swiftee"] = read_set(main)
for sub in sorted((ROOT / "atlas").glob("*/swiftee.manifest.json")):
    sets[sub.parent.name] = read_set(sub)

data = {"sets": sets, "order": list(sets)}

HTML = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Swiftee Sprite Sheets</title>
<style>
:root{
  --bg:#0e1014; --panel:#161a21; --panel2:#1c212b; --line:#272d39;
  --tx:#e7eaf0; --dim:#8a93a6; --acc:#2ec4b6; --warn:#f5a524;
  --sz:200px;
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--tx);overflow:hidden;
  font:13.5px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}

/* ---- chrome ---- */
header{padding:10px 16px;border-bottom:1px solid var(--line);display:flex;
  gap:14px;align-items:center;flex-wrap:wrap;background:var(--panel)}
h1{margin:0 8px 0 0;font-size:15px;letter-spacing:.2px;white-space:nowrap}
.grow{flex:1}
.seg{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;border-radius:0;padding:6px 12px}
.seg button+button{border-left:1px solid var(--line)}
button,select{background:var(--panel2);color:var(--tx);border:1px solid var(--line);
  border-radius:8px;padding:6px 11px;cursor:pointer;font:inherit}
button:hover{border-color:var(--acc)}
button.on{background:#1d2b2c;color:var(--acc);border-color:var(--acc)}
.seg button.on{background:#1d2b2c}
label.ctl{display:flex;align-items:center;gap:7px;color:var(--dim);
  white-space:nowrap;font-size:12.5px}
label.ctl b{color:var(--tx);font-variant-numeric:tabular-nums;min-width:2.6em;
  display:inline-block;text-align:right}
input[type=range]{width:112px;accent-color:var(--acc)}
.sw{display:flex;gap:5px}
.sw i{width:20px;height:20px;border-radius:5px;border:1px solid var(--line);
  cursor:pointer;display:block}
.sw i.on{border-color:var(--acc);box-shadow:0 0 0 2px rgba(46,196,182,.25)}

/* ---- shell ---- */
main{display:grid;grid-template-columns:262px minmax(0,1fr);height:calc(100% - 106px)}
@media(max-width:820px){main{grid-template-columns:1fr}
  aside{display:none}aside.open{display:block;position:absolute;inset:106px 0 0 0;
  z-index:5;background:var(--bg)}}

aside{border-right:1px solid var(--line);overflow:auto;padding:12px}
.search{width:100%;background:#0b0d11;border:1px solid var(--line);border-radius:8px;
  padding:7px 10px;color:var(--tx);font:inherit;margin-bottom:9px}
.search::placeholder{color:#5d6577}
.quick{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.quick button{padding:4px 9px;font-size:12px}
.grp{color:var(--dim);text-transform:uppercase;font-size:10.5px;
  letter-spacing:.8px;margin:14px 0 6px;display:flex;justify-content:space-between}
.item{padding:5px 8px;border-radius:6px;cursor:pointer;display:flex;
  align-items:center;gap:8px;user-select:none}
.item:hover{background:var(--panel)}
.item.on{background:#1b2530}
.item .box{width:14px;height:14px;border-radius:4px;border:1.5px solid #3c4453;
  flex:0 0 auto;position:relative}
.item.on .box{border-color:var(--acc);background:var(--acc)}
.item.on .box::after{content:"";position:absolute;left:3.5px;top:1px;width:4px;
  height:7px;border:2px solid #0e1014;border-top:0;border-left:0;
  transform:rotate(40deg)}
.item span.k{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.item small{color:var(--dim);font-variant-numeric:tabular-nums}
.item .role{color:var(--dim);font-size:10.5px;text-transform:uppercase;
  letter-spacing:.5px}
.item .flag{color:var(--warn);font-size:11px}

/* ---- stage ---- */
section{overflow:auto;padding:16px;position:relative}
#cards{display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start}
.card{background:var(--panel);border:1px solid var(--line);border-radius:11px;
  padding:9px;display:flex;flex-direction:column;gap:7px}
.vp{position:relative;width:var(--sz);height:var(--sz);border-radius:7px;
  overflow:hidden;background-color:#12151c}
.vp.checker{background-image:
  linear-gradient(45deg,#1b1f28 25%,transparent 25%,transparent 75%,#1b1f28 75%),
  linear-gradient(45deg,#1b1f28 25%,transparent 25%,transparent 75%,#1b1f28 75%);
  background-size:18px 18px;background-position:0 0,9px 9px}
.vp.dark{background-color:#0b0d11}
.vp.light{background-color:#f3f5f8}
.vp.green{background-color:#12b886}
.vp.plum{background-color:#5b3fa8}
.sp{position:absolute;inset:0;background-repeat:no-repeat}
.flip .sp{transform:scaleX(-1)}
.g{position:absolute;pointer-events:none}
.g.v{left:50%;top:0;bottom:0;border-left:1px dashed rgba(46,196,182,.5)}
.g.h{top:50%;left:0;right:0;border-top:1px dashed rgba(46,196,182,.5)}
.g.b{left:0;right:0;border-top:1px dashed rgba(245,165,36,.55)}
.g.p{left:50%;top:50%;width:6px;height:6px;margin:-3.5px 0 0 -3.5px;
  border-radius:50%;background:var(--acc);box-shadow:0 0 0 1.5px rgba(0,0,0,.55)}
.crow{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--dim);
  max-width:var(--sz)}
.crow .nm{color:var(--tx);flex:1;min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.crow .fn{font-variant-numeric:tabular-nums}
.card .mini{width:var(--sz);accent-color:var(--acc)}
.iconb{background:transparent;border:0;color:var(--dim);padding:2px 5px;
  cursor:pointer;border-radius:5px;font-size:13px}
.iconb:hover{color:var(--tx);background:var(--panel2)}
.phase{font-size:11px;color:var(--acc);text-transform:uppercase;
  letter-spacing:.6px;min-height:1.2em}

/* overlay mode */
#stack{position:relative;width:min(560px,86vw);aspect-ratio:1;border-radius:12px;
  overflow:hidden}
#stack .sp{mix-blend-mode:normal}
.legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;max-width:min(560px,86vw)}
.legend div{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim)}
.legend i{width:11px;height:11px;border-radius:3px;display:block}

.empty{color:var(--dim);padding:30px 4px;max-width:56ch}
.empty b{color:var(--tx)}
footer{border-top:1px solid var(--line);padding:8px 16px;display:flex;gap:14px;
  align-items:center;background:var(--panel);font-size:12.5px;color:var(--dim);
  flex-wrap:wrap}
footer code{background:#0b0d11;border:1px solid var(--line);border-radius:5px;
  padding:2px 7px;color:var(--acc);font-size:12px}
#toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(20px);
  background:#1d2b2c;color:var(--acc);border:1px solid var(--acc);border-radius:9px;
  padding:9px 16px;opacity:0;transition:.22s;pointer-events:none;z-index:9}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
</style></head><body>

<header>
  <h1>Swiftee sheets</h1>
  <div class="seg" id="modes">
    <button data-m="grid" class="on">Grid</button>
    <button data-m="stack">Overlay</button>
    <button data-m="chain">Chain</button>
  </div>
  <select id="setSel"></select>
  <button id="play">Pause</button>
  <button id="restart" title="back to frame 0 (r)">&#8635;</button>
  <label class="ctl">fps <input type="range" id="fps" min="1" max="60"><b id="fpsv"></b></label>
  <label class="ctl">size <input type="range" id="size" min="96" max="512" step="8"><b id="sizev"></b></label>
  <div class="grow"></div>
  <button id="flip">Flip</button>
  <button id="guides" class="on">Guides</button>
  <div class="sw" id="bgs"></div>
</header>

<main>
  <aside id="side">
    <input class="search" id="q" placeholder="Filter 82 animations…" autocomplete="off">
    <div class="quick">
      <button data-q="loops">All loops</button>
      <button data-q="six">Random 6</button>
      <button data-q="all">All</button>
      <button data-q="none">Clear</button>
    </div>
    <div id="list"></div>
  </aside>
  <section id="stage"></section>
</main>

<footer>
  <span>cell <code id="mCell"></code></span>
  <span>pivot <code>centre (0.5, 0.5)</code></span>
  <span id="selInfo"></span>
  <div class="grow"></div>
  <span>click a sprite to copy its engine reference</span>
</footer>
<div id="toast"></div>

<script>
const ALL = __DATA__;
const BGS = [["checker","#1b1f28"],["dark","#0b0d11"],["light","#f3f5f8"],
             ["green","#12b886"],["plum","#5b3fa8"]];

const st = {
  set: ALL.order[0], mode: "grid", sel: [], fps: 20, size: 200,
  flip: false, guides: true, bg: "checker", playing: true, phase: null,
};
let D = ALL.sets[st.set];

/* ---------- url state: a selection stays shareable / reloadable ---------- */
function saveHash() {
  const p = new URLSearchParams({
    set: st.set, mode: st.mode, fps: st.fps, size: st.size,
    bg: st.bg, flip: st.flip ? 1 : 0, guides: st.guides ? 1 : 0,
    a: st.sel.join(","),
  });
  history.replaceState(null, "", "#" + p);
}
function loadHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get("set") && ALL.sets[p.get("set")]) { st.set = p.get("set"); D = ALL.sets[st.set]; }
  if (["grid", "stack", "chain"].includes(p.get("mode"))) st.mode = p.get("mode");
  if (p.get("fps")) st.fps = Math.min(60, Math.max(1, +p.get("fps") || 20));
  if (p.get("size")) st.size = Math.min(512, Math.max(96, +p.get("size") || 200));
  if (BGS.some(b => b[0] === p.get("bg"))) st.bg = p.get("bg");
  st.flip = p.get("flip") === "1";
  if (p.get("guides") !== null) st.guides = p.get("guides") === "1";
  const a = (p.get("a") || "").split(",").filter(k => D.anims[k]);
  if (a.length) st.sel = a;
}

/* ---------- frame maths: exactly what an engine does with a UV rect ------ */
function frameAt(a, t, rec) {
  const n = a.n;
  // A scrubbed card holds its own position; the rest keep following the clock.
  if (rec && rec.phase != null) return Math.round(rec.phase * (n - 1));
  const i = Math.floor(t * st.fps);
  if (a.pingpong && n > 1) {
    const p = 2 * (n - 1), k = ((i % p) + p) % p;
    return k < n ? k : p - k;
  }
  return ((i % n) + n) % n;
}
function paint(el, a, i, hi) {
  const cols = hi && a.cols2 ? a.cols2 : a.cols;
  const rows = hi && a.cols2 ? a.rows2 : a.rows;
  const img = hi && a.img2 ? a.img2 : a.img;
  if (el.dataset.img !== img) { el.style.backgroundImage = 'url("' + img + '")'; el.dataset.img = img; }
  el.style.backgroundSize = (cols * 100) + "% " + (rows * 100) + "%";
  const cx = i % cols, cy = Math.floor(i / cols);
  el.style.backgroundPosition =
    (cols > 1 ? (cx / (cols - 1)) * 100 : 0) + "% " +
    (rows > 1 ? (cy / (rows - 1)) * 100 : 0) + "%";
  return [cx, cy];
}

/* ---------- chain mode: start -> loop -> loop -> stop -------------------- */
function chainFor(key) {
  const s = D.stateOf[key] || key;
  const parts = D.states[s];
  if (!parts) return [{ key, n: D.anims[key].n, role: "clip" }];
  const seq = [];
  if (parts.start) seq.push({ key: parts.start, n: D.anims[parts.start].n, role: "start" });
  seq.push({ key: parts.loop, n: D.anims[parts.loop].n, role: "loop" });
  seq.push({ key: parts.loop, n: D.anims[parts.loop].n, role: "loop" });
  if (parts.stop) seq.push({ key: parts.stop, n: D.anims[parts.stop].n, role: "stop" });
  return seq.filter(x => D.anims[x.key]);
}
function chainAt(seq, t, rec) {
  const total = seq.reduce((s, x) => s + x.n, 0);
  let i = (rec && rec.phase != null) ? Math.round(rec.phase * (total - 1))
                                     : Math.floor(t * st.fps) % total;
  for (const seg of seq) { if (i < seg.n) return [seg, i]; i -= seg.n; }
  return [seq[0], 0];
}

/* ---------- sidebar ------------------------------------------------------ */
const listEl = document.getElementById("list");
const qEl = document.getElementById("q");

function toggle(k) {
  const i = st.sel.indexOf(k);
  if (i === -1) st.sel.push(k); else st.sel.splice(i, 1);
  buildStage(); restart(); markList(); saveHash();
}
function markList() {
  listEl.querySelectorAll(".item").forEach(e =>
    e.classList.toggle("on", st.sel.includes(e.dataset.k)));
  const f = st.sel.reduce((s, k) => s + D.anims[k].n, 0);
  document.getElementById("selInfo").textContent =
    st.sel.length ? st.sel.length + " selected · " + f + " frames" : "nothing selected";
}
function buildList() {
  const term = qEl.value.trim().toLowerCase();
  const hit = k => !term || k.includes(term) || D.anims[k].name.toLowerCase().includes(term);
  listEl.innerHTML = "";
  const grp = (t, n) => {
    const h = document.createElement("div"); h.className = "grp";
    h.innerHTML = "<span>" + t + "</span><span>" + n + "</span>";
    listEl.appendChild(h);
  };
  const row = (k, role) => {
    const a = D.anims[k]; if (!a) return 0;
    const d = document.createElement("div");
    d.className = "item"; d.dataset.k = k;
    d.innerHTML = '<i class="box"></i><span class="k">' + k + "</span>" +
      (role ? '<span class="role">' + role + "</span>" : "") +
      (a.exits ? '<span class="flag" title="travels out of the cell by design">↔</span>' : "") +
      "<small>" + a.n + "f</small>";
    d.onclick = () => toggle(k);
    listEl.appendChild(d); return 1;
  };
  const states = Object.entries(D.states);
  const shown = states.filter(([, s]) => [s.start, s.loop, s.stop].some(x => x && hit(x)));
  if (shown.length) {
    grp("states", shown.length);
    for (const [, s] of shown) {
      row(s.loop);
      if (s.start) row(s.start, "start");
      if (s.stop) row(s.stop, "stop");
    }
  }
  const lone = D.standalone.filter(hit);
  if (lone.length) { grp("standalone", lone.length); lone.forEach(k => row(k)); }
  if (!shown.length && !lone.length) {
    const p = document.createElement("div");
    p.className = "empty"; p.textContent = "No animation matches that.";
    listEl.appendChild(p);
  }
  markList();
}

/* ---------- stage ------------------------------------------------------- */
const stage = document.getElementById("stage");
let live = [];   // things the clock updates

function guideEls(vp) {
  if (!st.guides) return;
  const mk = (c, top) => {
    const g = document.createElement("div"); g.className = "g " + c;
    if (top !== undefined) g.style.top = top; vp.appendChild(g);
  };
  mk("v"); mk("h");
  if (D.baselineRef) mk("b", (D.baseline * 100).toFixed(2) + "%");
  mk("p");
}

// Report the scale actually on screen. Above 256px the stage swaps in the @2x
// sheets, which have their own grid, so quoting the @1x numbers would hand over
// a rect that does not exist.
function copyRef(key, i, rec) {
  const a = D.anims[key];
  const use2 = !!(rec && rec.hi && a.img2);
  const scale = use2 ? "2x" : "1x";
  const cell = use2 ? D.cellPx : D.cell;
  const cols = use2 ? a.cols2 : a.cols;
  const rows = use2 ? a.rows2 : a.rows;
  const img = (use2 ? a.img2 : a.img).replace("../", "");
  const atlas = D.atlasDir + "/" + scale + "/swiftee_" + key + "@" + scale + ".json";
  const cx = i % cols, cy = Math.floor(i / cols);
  const name = key + "_" + String(i).padStart(3, "0");
  const txt =
`${name}  —  @${scale}, ${cell}px cell, pivot centre
sheet : ${img}
atlas : ${atlas}
grid  : ${cols} x ${rows}   frame ${i} of ${a.n}  (col ${cx}, row ${cy})
rect  : x=${cx * cell} y=${cy * cell} w=${cell} h=${cell}

Phaser 3
  this.load.atlas('${key}', '${img}', '${atlas}');
  this.add.sprite(x, y, '${key}', '${name}').setOrigin(0.5);

Unity  Slice > Grid By Cell Size ${cell} x ${cell}, Pivot Center
Godot  hframes=${cols} vframes=${rows} frame=${i}, centered=true`;
  navigator.clipboard?.writeText(txt).then(
    () => toast("copied " + name + " @" + scale),
    () => toast("clipboard blocked - snippet logged to console"),
  );
  console.log(txt);
}
let tt;
function toast(m) {
  const el = document.getElementById("toast");
  el.textContent = m; el.classList.add("show");
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 1500);
}

function buildStage() {
  stage.innerHTML = ""; live = [];
  if (!st.sel.length) {
    stage.innerHTML = '<div class="empty">Pick animations on the left. ' +
      "<b>Grid</b> plays them side by side, <b>Overlay</b> stacks them so you can " +
      "see the shared pivot hold, and <b>Chain</b> plays each one's " +
      "start&nbsp;→&nbsp;loop&nbsp;→&nbsp;stop.</div>";
    return;
  }
  const hi = st.size > 256;

  if (st.mode === "stack") {
    const wrap = document.createElement("div");
    const box = document.createElement("div");
    box.id = "stack"; box.className = "vp " + st.bg + (st.flip ? " flip" : "");
    st.sel.forEach((k, idx) => {
      const sp = document.createElement("div");
      sp.className = "sp";
      sp.style.opacity = (1 / Math.max(1, st.sel.length) + 0.28).toFixed(3);
      sp.style.filter = "hue-rotate(" + (idx * 47) + "deg)";
      box.appendChild(sp);
      live.push({ kind: "sp", el: sp, a: D.anims[k], key: k, hi });
    });
    guideEls(box);
    box.onclick = () => {
      const l = live[0];
      copyRef(l.key, frameAt(l.a, clock, l), l);
    };
    wrap.appendChild(box);
    const lg = document.createElement("div");
    lg.className = "legend";
    st.sel.forEach((k, idx) => {
      const d = document.createElement("div");
      d.innerHTML = '<i style="background:hsl(' + ((174 + idx * 47) % 360) +
        ' 60% 55%)"></i>' + k;
      lg.appendChild(d);
    });
    wrap.appendChild(lg);
    stage.appendChild(wrap);
    return;
  }

  const cards = document.createElement("div");
  cards.id = "cards";
  for (const k of st.sel) {
    const a = D.anims[k];
    const card = document.createElement("div"); card.className = "card";
    const vp = document.createElement("div");
    vp.className = "vp " + st.bg + (st.flip ? " flip" : "");
    const sp = document.createElement("div"); sp.className = "sp";
    vp.appendChild(sp); guideEls(vp);

    const crow = document.createElement("div"); crow.className = "crow";
    crow.innerHTML = '<span class="nm">' + k + '</span><span class="fn"></span>';
    const x = document.createElement("button");
    x.className = "iconb"; x.textContent = "✕"; x.title = "remove";
    x.onclick = (e) => { e.stopPropagation(); toggle(k); };
    crow.appendChild(x);

    const ph = document.createElement("div"); ph.className = "phase";
    const mini = document.createElement("input");
    mini.type = "range"; mini.className = "mini"; mini.min = 0; mini.value = 0;

    card.append(vp, crow, ph, mini);
    cards.appendChild(card);

    let rec;
    if (st.mode === "chain") {
      const seq = chainFor(k);
      mini.max = seq.reduce((s, x) => s + x.n, 0) - 1;
      rec = { kind: "chain", el: sp, seq, fn: crow.querySelector(".fn"),
              ph, mini, hi, key: k, phase: null };
      live.push(rec);
      vp.onclick = () => {
        const [seg, i] = chainAt(seq, clock, rec);
        copyRef(seg.key, i, rec);
      };
    } else {
      mini.max = a.n - 1;
      ph.textContent = (a.loop ? (a.pingpong ? "ping-pong" : "loop") : "one-shot") +
        " · " + a.ms + "ms" + (a.exits ? " · exits cell" : "");
      rec = { kind: "sp", el: sp, a, key: k, fn: crow.querySelector(".fn"),
              mini, hi, phase: null };
      live.push(rec);
      vp.onclick = () => {
        copyRef(k, frameAt(a, clock, rec), rec);
      };
    }
    // Scrubbing one card parks that card only - the others keep playing, which
    // is what you want when comparing a held pose against a moving one.
    mini.oninput = () => {
      st.playing = false;
      syncPlayBtn();
      rec.phase = +mini.value / Math.max(1, +mini.max);
    };
  }
  stage.appendChild(cards);
}

/* ---------- clock ------------------------------------------------------- */
let clock = 0, last = performance.now();
function tick(now) {
  const dt = (now - last) / 1000; last = now;
  if (st.playing) clock += dt;
  for (const l of live) {
    if (l.kind === "chain") {
      const [seg, i] = chainAt(l.seq, clock, l);
      const a = D.anims[seg.key];
      const [cx, cy] = paint(l.el, a, i, l.hi);
      if (l.fn) l.fn.textContent = seg.key + " " + i;
      if (l.ph) l.ph.textContent = seg.role;
      if (l.mini && l.phase == null) {
        let off = 0;
        for (const s of l.seq) { if (s === seg) break; off += s.n; }
        l.mini.value = off + i;
      }
    } else {
      const i = frameAt(l.a, clock, l);
      const [cx, cy] = paint(l.el, l.a, i, l.hi);
      if (l.fn) l.fn.textContent = i + " / " + (l.a.n - 1);
      if (l.mini && l.phase == null) l.mini.value = i;
    }
  }
  requestAnimationFrame(tick);
}

/* ---------- controls ---------------------------------------------------- */
function syncPlayBtn() {
  const b = document.getElementById("play");
  b.textContent = st.playing ? "Pause" : "Play";
  b.classList.toggle("on", !st.playing);
}
function setPlaying(v) {
  st.playing = v;
  if (v) live.forEach(l => { l.phase = null; });   // resume releases parked cards
  syncPlayBtn();
}
// Chains and one-shots are only legible from their first frame, so restart the
// clock whenever the stage changes rather than dropping in mid-sequence.
function restart() {
  clock = 0; last = performance.now();
  live.forEach(l => { l.phase = null; });
}
function applyLive() {
  document.documentElement.style.setProperty("--sz", st.size + "px");
  document.querySelectorAll(".vp").forEach(v => {
    v.className = v.id === "stack" ? "vp " + st.bg + (st.flip ? " flip" : "")
                                   : "vp " + st.bg + (st.flip ? " flip" : "");
  });
}

const setSel = document.getElementById("setSel");
ALL.order.forEach(n => {
  const o = document.createElement("option");
  o.value = n; o.textContent = n + " (" + Object.keys(ALL.sets[n].anims).length + ")";
  setSel.appendChild(o);
});
setSel.onchange = () => {
  st.set = setSel.value; D = ALL.sets[st.set];
  st.sel = Object.keys(D.anims).slice(0, 1);
  document.getElementById("mCell").textContent = D.cellPx + " / " + D.cell + "px";
  qEl.placeholder = "Filter " + Object.keys(D.anims).length + " animations…";
  buildList(); buildStage(); saveHash();
};

document.getElementById("modes").onclick = (e) => {
  const b = e.target.closest("button[data-m]"); if (!b) return;
  st.mode = b.dataset.m;
  document.querySelectorAll("#modes button").forEach(x =>
    x.classList.toggle("on", x === b));
  buildStage(); restart(); saveHash();
};
document.getElementById("play").onclick = () => setPlaying(!st.playing);
document.getElementById("restart").onclick = () => { restart(); setPlaying(true); };
const fpsEl = document.getElementById("fps"), sizeEl = document.getElementById("size");
fpsEl.oninput = () => {
  st.fps = +fpsEl.value;
  document.getElementById("fpsv").textContent = st.fps;
  saveHash();
};
sizeEl.oninput = () => {
  st.size = +sizeEl.value;
  document.getElementById("sizev").textContent = st.size;
  applyLive();
  // crossing 256px swaps in the @2x sheets, which needs the cards rebuilt
  const hi = st.size > 256;
  if (live.length && live[0].hi !== hi) buildStage();
  saveHash();
};
document.getElementById("flip").onclick = (e) => {
  st.flip = !st.flip; e.target.classList.toggle("on", st.flip);
  applyLive(); saveHash();
};
document.getElementById("guides").onclick = (e) => {
  st.guides = !st.guides; e.target.classList.toggle("on", st.guides);
  buildStage(); saveHash();
};
const bgs = document.getElementById("bgs");
BGS.forEach(([name, col]) => {
  const i = document.createElement("i");
  i.style.background = col; i.title = name; i.dataset.b = name;
  i.onclick = () => {
    st.bg = name;
    bgs.querySelectorAll("i").forEach(x => x.classList.toggle("on", x === i));
    applyLive(); saveHash();
  };
  bgs.appendChild(i);
});
document.querySelector(".quick").onclick = (e) => {
  const b = e.target.closest("button[data-q]"); if (!b) return;
  const keys = Object.keys(D.anims);
  if (b.dataset.q === "loops") st.sel = keys.filter(k => D.anims[k].loop);
  if (b.dataset.q === "all") st.sel = keys;
  if (b.dataset.q === "none") st.sel = [];
  if (b.dataset.q === "six") st.sel = keys.sort(() => Math.random() - 0.5).slice(0, 6);
  buildStage(); markList(); saveHash();
};
qEl.oninput = buildList;
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.key === " ") { e.preventDefault(); setPlaying(!st.playing); }
  if (e.key === "f") document.getElementById("flip").click();
  if (e.key === "g") document.getElementById("guides").click();
  if (e.key === "r") document.getElementById("restart").click();
});

/* ---------- boot -------------------------------------------------------- */
loadHash();
if (!st.sel.length) {
  st.sel = ["waving", "sleeping", "thinking"].filter(k => D.anims[k]);
  if (!st.sel.length) st.sel = Object.keys(D.anims).slice(0, 3);
}
setSel.value = st.set;
fpsEl.value = st.fps; document.getElementById("fpsv").textContent = st.fps;
sizeEl.value = st.size; document.getElementById("sizev").textContent = st.size;
document.getElementById("mCell").textContent = D.cellPx + " / " + D.cell + "px";
qEl.placeholder = "Filter " + Object.keys(D.anims).length + " animations…";
document.querySelectorAll("#modes button").forEach(x =>
  x.classList.toggle("on", x.dataset.m === st.mode));
document.getElementById("flip").classList.toggle("on", st.flip);
document.getElementById("guides").classList.toggle("on", st.guides);
bgs.querySelectorAll("i").forEach(x => x.classList.toggle("on", x.dataset.b === st.bg));
applyLive(); buildList(); buildStage(); saveHash();
requestAnimationFrame(tick);
</script></body></html>
"""

out = ROOT / "preview"
out.mkdir(exist_ok=True)
(out / "index.html").write_text(HTML.replace("__DATA__", json.dumps(data)))
total = sum(len(v["anims"]) for v in sets.values())
print(f"preview/index.html  ({len(sets)} sets, {total} animations)")
