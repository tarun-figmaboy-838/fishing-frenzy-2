"""The MP3 twin of every clip the game can play in a recorded language: assets/VO-<LANG>/<key>.mp3 beside <key>.ogg
(run by tools/vo_lang_build.js; or by hand).

  python3 tools/vo_lang_mp3.py [hi mr gu ...] [--force]        (no language: every assets/VO-*/ folder)

An iPad before iPadOS 18.4 cannot play Ogg Opus at all - in Safari or in an app's browser (Instagram's) - and plays
these instead (parts/lesson/js/voice.js and parts/fishing/src/audio.js pick by what the browser plays, and fall back to
the MP3 if an Ogg fails). Mono, 24 kHz, 48 kbps CBR, decoded from the Ogg, so the words, their timings and the loudness
are the Ogg's - as the English clips' twins are (parts/lesson/tools/vo_mp3.py).

Only the clips the game can play get a twin: the lines it says (parts/lesson/js/vo_lines.js and
parts/fishing/src/voice-data.js), each found by its English as shell/i18n.js finds it (I18n.keyOf). The folder also
holds recordings of words nothing ever says (button and screen-reader labels); those get none, and a twin whose line is
no longer said, or whose Ogg is gone, is removed.
Needs numpy, scipy, soundfile (libsndfile >= 1.1, which reads Opus) and lameenc:
  python3 -m pip install numpy scipy soundfile lameenc     (or VO_PY=<that python> for vo_lang_build.js)"""
import json, os, re, sys
from math import gcd

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RATE, KBPS = 24000, 48
force = '--force' in sys.argv
langs = [a.lower() for a in sys.argv[1:] if not a.startswith('-')]
if not langs:
    langs = sorted(d[3:].lower() for d in os.listdir(os.path.join(ROOT, 'assets')) if d.startswith('VO-'))


def loose(s):
    """a line's English as shell/i18n.js holds it for keyOf: no stars, single spaces, lower case, ... for the ellipsis"""
    return re.sub(r'\s+', ' ', str(s).replace('*', '').replace('…', '...').replace('’', "'")).strip().lower()


def played_keys():
    """the key of every line the game says (the first key with that English, as I18n.keyOf)"""
    en = json.load(open(os.path.join(ROOT, 'locales', 'locales.json'), encoding='utf8'))['en']
    by_text = {}
    for k, v in en.items():
        if isinstance(v, str) and v:
            by_text.setdefault(loose(v), k)
    said = []
    lesson = open(os.path.join(ROOT, 'parts', 'lesson', 'js', 'vo_lines.js'), encoding='utf8').read()
    said += [json.loads(m) for m in re.findall(r'^  ("(?:[^"\\]|\\.)*"): \[', lesson, re.M)]
    fishing = open(os.path.join(ROOT, 'parts', 'fishing', 'src', 'voice-data.js'), encoding='utf8').read()
    said += [json.loads('"' + m + '"') for m in re.findall(r'^  "[a-z]+:((?:[^"\\]|\\.)*)":', fishing, re.M)]
    return {by_text[loose(t)] for t in said if loose(t) in by_text}, len(said)


def encode(src, dst):
    import numpy as np, soundfile as sf, lameenc
    from scipy.signal import resample_poly
    x, sr = sf.read(src, dtype='float32', always_2d=True)
    x = x.mean(axis=1)
    if sr != RATE:
        g = gcd(sr, RATE)
        x = resample_poly(x, RATE // g, sr // g).astype('float32')
    enc = lameenc.Encoder()
    enc.set_bit_rate(KBPS); enc.set_in_sample_rate(RATE); enc.set_channels(1); enc.set_quality(2)
    data = enc.encode((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()) + enc.flush()
    open(dst, 'wb').write(data)


keys, said = played_keys()
for lang in langs:
    d = os.path.join(ROOT, 'assets', 'VO-' + lang.upper())
    if not os.path.isdir(d):
        print('no assets/VO-' + lang.upper() + '/'); continue
    made = kept = 0
    for k in sorted(keys):
        src, dst = os.path.join(d, k + '.ogg'), os.path.join(d, k + '.mp3')
        if not os.path.exists(src):
            continue
        if not force and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            kept += 1; continue
        encode(src, dst); made += 1
    for f in sorted(os.listdir(d)):
        if f.endswith('.mp3') and (f[:-4] not in keys or not os.path.exists(os.path.join(d, f[:-4] + '.ogg'))):
            os.remove(os.path.join(d, f)); print('removed assets/VO-' + lang.upper() + '/' + f)
    size = sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d) if f.endswith('.mp3'))
    print('%s: %d lines said, %d clips played; mp3 twins: %d written, %d up to date, %.2f MB' % (lang, said, made + kept, made, kept, size / 1e6))
