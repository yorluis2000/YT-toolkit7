"""master.py — loop-safe look-ahead limiter + gain to a loudness target.  usage: python3 kit/master.py mix_raw.wav mix.wav [-14.5]"""
import re, math, subprocess, sys
import numpy as np
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000

def lufs(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    i = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])
    tp = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', out)
    return i, (float(tp[-1]) if tp else None)

def limit(x, ceil=0.86, w_ms=3.0, rel_ms=25.0):
    a = np.abs(x).max(1)
    g = np.minimum(1.0, ceil / np.maximum(a, 1e-9))
    w = int(w_ms * SR / 1000)
    g = uniform_filter1d(minimum_filter1d(g, 2 * w + 1, mode='wrap'), 2 * w + 1, mode='wrap')
    r = int(rel_ms * SR / 1000)
    g = np.minimum(g, uniform_filter1d(minimum_filter1d(g, 2 * r + 1, mode='wrap'), 2 * r + 1, mode='wrap') + 0.0)
    y = x * g[:, None]
    return np.tanh(y / 0.95) * 0.95, g

SRC = sys.argv[1] if len(sys.argv) > 1 else "mix_raw.wav"
DST = sys.argv[2] if len(sys.argv) > 2 else 'mix.wav'
sr, x = wavfile.read(SRC)
x = x.astype(np.float64)
target = float(sys.argv[3]) if len(sys.argv) > 3 else -14.5
gain_db = 0.0
cur, _ = lufs(SRC)
gain_db = target - cur
for it in range(4):
    y, g = limit(x * 10 ** (gain_db / 20))
    wavfile.write(DST, SR, y.astype(np.float32))
    cur, tp = lufs(DST)
    print(f'iter {it}: gain {gain_db:+.2f} dB -> {cur:.2f} LUFS, true peak {tp} dBFS, max GR {20*np.log10(g.min()):.1f} dB')
    if abs(cur - target) < 0.15:
        break
    gain_db += (target - cur)
