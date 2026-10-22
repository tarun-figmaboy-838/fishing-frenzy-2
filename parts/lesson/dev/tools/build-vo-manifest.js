// Writes dev/vo-manifest.csv: every line Swiftee says, in play order, with its storyboard page and a suggested
// audio file name. The game speaks these with the device's built-in voice (Indian English preferred, see
// pickVoice() in js/game-engine.js); no recorded voice-over files exist yet, so every row is marked "missing".
// Run from the game folder: node dev/tools/build-vo-manifest.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'js', 'lesson-data.js'), 'utf8');
const LESSON = new Function(src + '; return LESSON;')();
const rows = [['screen', 'pdf_page', 'step_id', 'when', 'on_screen_text', 'spoken_text', 'audio_file', 'status']];
const q = (v) => '"' + String(v == null ? '' : v).replace(/\n/g, ' ').replace(/"/g, '""') + '"';
LESSON.steps.forEach((st, i) => {
  let n = 0;
  const add = (when, t, sp) => {
    if (!t && !sp) return;
    n++;
    rows.push([i + 1, st.pdf || '', st.id, when, t || '', sp || t || '', 'vo/' + String(i + 1).padStart(2, '0') + '-' + st.id + '-' + n + '.mp3', 'missing']);
  };
  (st.lines || []).forEach((L) => add(L.keep ? 'line (voice only)' : 'line', L.keep ? '' : L.t, L.s));
  (st.after || []).forEach((L) => add('after task', L.t, L.s));
  if (st.ok) add('correct answer', st.ok);
  (st.opts || []).forEach((o) => { if (o.fb) add('feedback: ' + (o.t || o.id), o.fb); });
  if (st.fill && st.fill.fb) Object.keys(st.fill.fb).forEach((k) => add('feedback: ' + k, st.fill.fb[k]));
  if (st.wrong) add('wrong tap', st.wrong);
  if (st.retry) add('try again', st.retry);
  if (st.idle) add('idle hint', st.idle);
});
fs.writeFileSync(path.join(ROOT, 'dev', 'vo-manifest.csv'), rows.map((r) => r.map(q).join(',')).join('\n') + '\n');
console.log('wrote dev/vo-manifest.csv (' + (rows.length - 1) + ' lines)');
