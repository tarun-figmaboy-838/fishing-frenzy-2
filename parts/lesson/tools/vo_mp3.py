"""The MP3 twin of every voice clip: assets/vo/<id>.mp3 beside each <id>.ogg (run by tools/vo_build.js; or by hand).
An iPad before iPadOS 18.4 cannot play Ogg Opus at all - in Safari or in an app's browser (Instagram's) - and plays
these instead (js/voice.js, and the game's ../fishing/src/audio.js for the clips it borrows). Mono, 24 kHz, 48 kbps
CBR: decoded from the Ogg, so the words, their timings and the loudness are the Ogg's.
Needs numpy, scipy, soundfile (libsndfile >= 1.1, which reads Opus) and lameenc:
  python3 -m pip install numpy scipy soundfile lameenc     (or VO_PY=<that python> for vo_build.js)
  python3 tools/vo_mp3.py [--force]"""
import os, sys
from math import gcd
import numpy as np, soundfile as sf, lameenc
from scipy.signal import resample_poly

VO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'vo')
RATE, KBPS = 24000, 48
force = '--force' in sys.argv
n = 0
for f in sorted(os.listdir(VO)):
    if not f.endswith('.ogg'):
        continue
    src, dst = os.path.join(VO, f), os.path.join(VO, f[:-4] + '.mp3')
    if not force and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        continue
    x, sr = sf.read(src, dtype='float32', always_2d=True)
    x = x.mean(axis=1)
    if sr != RATE:
        g = gcd(sr, RATE)
        x = resample_poly(x, RATE // g, sr // g).astype('float32')
    enc = lameenc.Encoder()
    enc.set_bit_rate(KBPS); enc.set_in_sample_rate(RATE); enc.set_channels(1); enc.set_quality(2)
    data = enc.encode((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()) + enc.flush()
    open(dst, 'wb').write(data)
    n += 1
# an MP3 whose Ogg is gone goes too
for f in sorted(os.listdir(VO)):
    if f.endswith('.mp3') and not os.path.exists(os.path.join(VO, f[:-4] + '.ogg')):
        os.remove(os.path.join(VO, f)); print('removed assets/vo/' + f)
print('mp3 twins: %d written' % n)
