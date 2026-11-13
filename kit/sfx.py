"""sfx.py — music bed + sound design for seamless 50–60 s loops (InteresTech7 Shorts kit). numpy + scipy only.

    import sys; sys.path.insert(0, 'kit')
    from sfx import *
    tr = Track(T=52.0)                                    # sound ringing past T is wrapped into the start → seamless loop
    tr.groove(bpm=120, prog=['Dm', 'Bb', 'F', 'C'], full=[(4, 36), (39, 48)], half=[(0, 4), (36, 39), (48, 52)], build=[(44, 48)])
    tr.whooshes([5, 9, 15, 21, 28, 36, 39, 45, 49])       # one per scene cut (starts 0.32 s early)
    tr.fx(4.1, boom(), .40); tr.fx(4.1, thud(), .25)      # impacts that match the picture
    tr.save('mix_raw.wav')                                # then: python3 kit/master.py mix_raw.wav mix.wav

Keep T a whole number of bars (at 120 BPM a bar is 2 s) so the groove loops cleanly.
"""
import math
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
R = np.random.default_rng(7)


# ------------------------------------------------------------------ helpers
def ns(d):
    return int(round(d * SR))


def tt(d):
    return np.arange(ns(d)) / SR


def noise(d):
    return R.standard_normal(ns(d)).astype(np.float32)


def sosf(x, btype, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype=btype, fs=SR, output='sos'), x, axis=0).astype(np.float32)


def fade_edges(x, a=0.002, r=0.01):
    n = len(x)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    x = x.copy()
    if na > 0:
        x[:na] *= np.linspace(0, 1, na)
    if nr > 0:
        x[-nr:] *= np.linspace(1, 0, nr)
    return x


def sweep_bp(x, f0, f1, q=1.6, block=128):
    """band-pass whose centre glides exponentially f0 -> f1"""
    out = np.zeros_like(x)
    nb = int(math.ceil(len(x) / block))
    zi = None
    for b in range(nb):
        k = b / max(1, nb - 1)
        fc = f0 * (f1 / f0) ** k
        lo, hi = max(30.0, fc / q), min(SR / 2 - 100, fc * q)
        s = signal.butter(1, [lo, hi], btype='bandpass', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((s.shape[0], 2))
        seg = x[b * block:(b + 1) * block]
        y, zi = signal.sosfilt(s, seg, zi=zi)
        out[b * block:b * block + len(seg)] = y
    return out


def chirp_sine(f0, f1, d, curve='exp'):
    t = tt(d)
    k = t / d
    f = f0 * (f1 / f0) ** k if curve == 'exp' else f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR).astype(np.float32)


def note(name, octave):
    """'D', 'Bb', 'F#' + octave -> Hz (A4 = 440)"""
    base = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}[name[0].upper()]
    base += name[1:].count('#') - name[1:].count('b')
    return 440.0 * 2 ** ((base + 12 * (octave - 4)) / 12)


def chord(sym):
    """'Dm' / 'Bb' / 'F#m' -> (bass root Hz, 4 pad tones, 4 arp tones)"""
    m = sym.endswith('m')
    root = sym[:-1] if m else sym
    iv = [0, 3 if m else 4, 7, 12]
    r2 = note(root, 2)
    while r2 > 100:
        r2 /= 2
    while r2 < 50:
        r2 *= 2
    r3 = r2 * 2
    while r3 < 130:
        r3 *= 2
    pad = [r3 * 2 ** (i / 12) for i in iv]
    arp = [f * 2 for f in pad]
    return r2, pad, arp


# ------------------------------------------------------------------ instruments
def kick():
    t = tt(0.5)
    f = 46 + 120 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.24)
    click = sosf(noise(0.5), 'highpass', 2500) * np.exp(-t / 0.004) * 0.45
    return fade_edges((body + click).astype(np.float32))


def snare():
    t = tt(0.4)
    n = sosf(noise(0.4), 'bandpass', [1200, 7500]) * np.exp(-t / 0.10)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.045) * 0.7
    return fade_edges((n * 0.8 + body).astype(np.float32))


def clap():
    t = tt(0.4)
    n = sosf(noise(0.4), 'bandpass', [900, 5000])
    env = np.zeros_like(t)
    for d in (0.0, 0.011, 0.023):
        env += (t >= d) * np.exp(-np.clip(t - d, 0, None) / 0.007)
    env += (t >= 0.03) * np.exp(-np.clip(t - 0.03, 0, None) / 0.13) * 0.6
    return fade_edges((n * env).astype(np.float32))


def hat(open_=False):
    d = 0.35 if open_ else 0.08
    t = tt(d)
    n = sosf(noise(d), 'highpass', 7500, 3)
    return fade_edges((n * np.exp(-t / (0.10 if open_ else 0.02))).astype(np.float32))


def crash(d=2.6):
    t = tt(d)
    n = sosf(noise(d), 'highpass', 3500, 2)
    return fade_edges((n * np.exp(-t / 0.85) * np.minimum(1, t / 0.002)).astype(np.float32), r=0.3)


def boom(f0=95, f1=40, d=1.0, tau=0.45, nz=0.4):
    t = tt(d)
    s = chirp_sine(f0, f1, d) * np.exp(-t / tau)
    n = sosf(noise(d), 'lowpass', 900) * np.exp(-t / 0.07) * nz
    return fade_edges((s + n).astype(np.float32), r=0.1)


def thud():
    t = tt(0.35)
    s = chirp_sine(140, 55, 0.35) * np.exp(-t / 0.09)
    n = sosf(noise(0.35), 'bandpass', [300, 3000]) * np.exp(-t / 0.03) * 0.6
    return fade_edges((s + n).astype(np.float32))


def whoosh(d=0.5, f0=300, f1=5000, rev=False):
    t = tt(d)
    x = sweep_bp(noise(d), f0, f1, q=1.8)
    k = t / d
    env = np.sin(np.pi * np.clip(k, 0, 1)) ** 2
    env = env * (k ** 0.6 if not rev else (1 - k) ** 0.6)
    return fade_edges((x * env * 2.2).astype(np.float32))


def click_key():
    t = tt(0.05)
    n = sosf(noise(0.05), 'bandpass', [1800, 7000]) * np.exp(-t / 0.005)
    th = np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.015) * 0.35
    return fade_edges((n + th).astype(np.float32))


def blip(f0, f1, d=0.08, tau=0.05):
    t = tt(d)
    return fade_edges((chirp_sine(f0, f1, d) * np.exp(-t / tau)).astype(np.float32))


def bell(f, d=1.6):
    t = tt(d)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.5) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.22)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.09))
    return fade_edges(s.astype(np.float32), r=0.2)


def crackle(d, density=90, seed=0):
    rng = np.random.default_rng(seed)
    n = ns(d)
    x = np.zeros(n, np.float32)
    k = rng.poisson(density * d)
    idx = rng.integers(0, n, k)
    x[idx] = rng.uniform(-1, 1, k) * rng.uniform(0.3, 1.0, k)
    return fade_edges(sosf(x, 'bandpass', [1500, 9000]) * 3.0)


def pluck(f, d=0.32, tau=0.11):
    t = tt(d)
    tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * t))
    s = (np.sin(2 * np.pi * f * t) * 0.7 + tri * 0.3) * np.exp(-t / tau) * np.minimum(1, t / 0.002)
    return fade_edges(s.astype(np.float32))


def alarm_beep(f=1250, d=0.09):
    t = tt(d)
    sq = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * t) * 0.5
    return fade_edges(sosf(sq.astype(np.float32), 'lowpass', 4000), 0.003, 0.015)


def sizzle(d):
    n = sosf(noise(d), 'highpass', 3000)
    t = tt(d)
    env = np.minimum(1, t / (d * 0.6))
    return fade_edges(((n * 0.25 + crackle(d, 200, 21) * 0.6) * env).astype(np.float32), 0.02, 0.1)


def news_sting():
    out = np.zeros(ns(1.4), np.float32)
    for j, f in enumerate((783.99, 1046.5, 1567.98)):
        b = bell(f, 1.0)
        i0 = int(j * 0.11 * SR)
        out[i0:i0 + len(b)] += b[:len(out) - i0] * (0.8 if j < 2 else 1.0)
    return out


def bin_clang():
    t = tt(0.6)
    s = (np.sin(2 * np.pi * 180 * t) + 0.6 * np.sin(2 * np.pi * 431 * t) + 0.4 * np.sin(2 * np.pi * 987 * t)) * np.exp(-t / 0.18)
    n = sosf(noise(0.6), 'bandpass', [400, 3000]) * np.exp(-t / 0.05) * 0.8
    return fade_edges((s * 0.5 + n).astype(np.float32), r=0.1)


def flicker_buzz(d):
    t = tt(d)
    hum = np.sign(np.sin(2 * np.pi * 120 * t)) * 0.3
    gate = (np.random.default_rng(3).uniform(0, 1, int(d * 40) + 1) > 0.3).astype(np.float32)
    g = np.repeat(gate, int(SR / 40) + 1)[:len(t)]
    return fade_edges(sosf((hum * g).astype(np.float32), 'lowpass', 2500), 0.01, 0.05)


def tape_rewind(d=0.22):
    s = chirp_sine(1800, 300, d) * 0.5 + sweep_bp(noise(d), 6000, 800, q=1.5)
    return fade_edges((s * np.linspace(1, 0.4, ns(d))).astype(np.float32), 0.005, 0.03)


def riser(d=2.0, f0=200, f1=900):
    return (chirp_sine(f0, f1, d) * np.linspace(0.1, 1, ns(d)) ** 2).astype(np.float32)


def glitch_burst(d=0.25, seed=5):
    rng = np.random.default_rng(seed)
    n = ns(d)
    seg = max(1, int(SR * 0.012))
    x = np.zeros(n, np.float32)
    for i in range(0, n, seg):
        if rng.uniform() > 0.35:
            f = rng.choice([220, 440, 880, 1760, 3520])
            tt_ = np.arange(min(seg, n - i)) / SR
            x[i:i + len(tt_)] = np.sign(np.sin(2 * np.pi * f * tt_)) * rng.uniform(0.3, 1.0)
    return fade_edges(sosf(x, 'lowpass', 6000) * 0.5)


def ui_pop(f=1046.5):
    return blip(f, f * 1.5, 0.07, 0.04)


def success():
    out = np.zeros(ns(0.6), np.float32)
    for j, f in enumerate((1046.5, 1567.98)):
        b = blip(f, f, 0.25, 0.12)
        i0 = int(j * 0.09 * SR)
        out[i0:i0 + len(b)] += b[:len(out) - i0]
    return out


def error_buzz(d=0.35):
    t = tt(d)
    s = np.sign(np.sin(2 * np.pi * 110 * t)) * 0.4 * np.exp(-t / 0.2)
    return fade_edges(sosf(s.astype(np.float32), 'lowpass', 2500))


# ------------------------------------------------------------------ track
class Track:
    def __init__(self, T, tail=4.0):
        self.T = T
        self.N = ns(T)
        self.L = self.N + ns(tail)
        z = lambda: np.zeros((self.L, 2), np.float32)
        self.drums, self.music, self.sfx, self.verb = z(), z(), z(), z()
        self.kicks = []

    def place(self, buf, t0, sig, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            a = (pan + 1) * math.pi / 4
            sig = np.stack([sig * math.cos(a), sig * math.sin(a)], 1) * math.sqrt(2)
        i0 = int(round(t0 * SR))
        if i0 < 0:
            sig, i0 = sig[-i0:], 0
        n = min(len(sig), self.L - i0)
        if n > 0:
            buf[i0:i0 + n] += sig[:n] * gain

    def fx(self, t, sig, gain=1.0, pan=0.0, verb=0.0):
        self.place(self.sfx, t, sig, gain, pan)
        if verb:
            self.place(self.verb, t, sig, gain * verb, pan)

    def whooshes(self, times, gain=0.20, lead=0.32):
        for s in times:
            w = whoosh(0.45)
            self.place(self.sfx, s - lead, w, gain, R.uniform(-0.2, 0.2))
            self.place(self.verb, s - lead, w, gain * 0.3)

    def typing(self, t0, n, rate=45, gain=(0.05, 0.08), pan=0.2):
        for k in range(n):
            self.place(self.sfx, t0 + k / rate + R.uniform(-0.004, 0.004), click_key(), R.uniform(*gain), pan)

    def drone(self, f, gain=0.05, lfo_cycles=4):
        """continuous tone quantised to whole cycles over T so it is continuous across the loop point"""
        q = lambda x: round(x * self.T) / self.T
        t = np.arange(self.N) / SR
        lfo = 0.85 + 0.15 * np.sin(2 * np.pi * (lfo_cycles / self.T) * t)
        s = (np.sin(2 * np.pi * q(f) * t) * lfo * gain).astype(np.float32)
        self.sfx[:self.N, 0] += s
        self.sfx[:self.N, 1] += s

    def groove(self, bpm=120, prog=('Dm', 'Bb', 'F', 'C'), full=(), half=(), build=(), arp=True,
               arp_pattern=(0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2), level=1.0):
        """drums + bass + pad + arp. full: four-on-the-floor sections, half: sparse sections, build: extra 16th hats"""
        BEAT = 60.0 / bpm
        BAR = 4 * BEAT
        T = self.T
        if abs(T / BAR - round(T / BAR)) > 1e-6:
            print(f'warning: T={T} is not a whole number of bars ({BAR:.3f}s) — the groove will not loop cleanly')
        inn = lambda t, spans: any(a <= t < b for a, b in spans)
        CH = [chord(c) for c in prog]
        K, S, C, HC, HO = kick(), snare(), clap(), hat(False), hat(True)
        for i in range(int(round(T / BEAT))):
            t = i * BEAT
            bib = i % 4
            fu, ha = inn(t, full), inn(t, half)
            if fu or (ha and bib in (0, 2)):
                self.place(self.drums, t, K, 0.78 * level)
                self.kicks.append(t)
            if fu and bib in (1, 3):
                self.place(self.drums, t, C, 0.44 * level, -0.1)
                self.place(self.drums, t, S, 0.28 * level, 0.1)
                self.place(self.verb, t, C, 0.12 * level)
            if fu:
                self.place(self.drums, t, HC, 0.16 * level, 0.25)
                self.place(self.drums, t + BEAT / 2, HO, 0.18 * level, -0.25)
                if inn(t, build):
                    self.place(self.drums, t + BEAT / 4, HC, 0.08 * level, 0.4)
                    self.place(self.drums, t + 3 * BEAT / 4, HC, 0.08 * level, -0.4)
        bass = np.zeros((self.L, 2), np.float32)
        pad = np.zeros((self.L, 2), np.float32)
        arpb = np.zeros((self.L, 2), np.float32)
        nbars = int(round(T / BAR))
        for b in range(nbars):
            root, tones, atones = CH[b % len(CH)]
            for s in range(8):
                t = b * BAR + s * BEAT / 2
                if inn(t, full):
                    f, d = root * (2 if s == 7 else 1), 0.22 * BEAT / 0.5
                elif inn(t, half) and s % 2 == 0:
                    f, d = root, 0.45 * BEAT / 0.5
                else:
                    continue
                tn = tt(d + 0.02)
                saw = 2 * ((f * tn + 0.25) % 1.0) - 1
                env = np.minimum(1, tn / 0.004) * (0.55 + 0.45 * np.exp(-tn / 0.07))
                sub = np.sin(2 * np.pi * f * tn) * 0.8
                self.place(bass, t, fade_edges(((saw * 0.75 + sub * 0.8) * env).astype(np.float32), r=0.015), 0.45 * level)
            d = BAR + 1.2
            tn = tt(d)
            env = np.minimum(1, tn / 0.35) * np.where(tn < BAR, 1.0, np.exp(-(tn - BAR) / 0.35))
            voice = np.zeros((len(tn), 2), np.float32)
            for f in tones:
                for cents, pan in ((-9, -0.6), (0, 0.0), (9, 0.6)):
                    ff = f * 2 ** (cents / 1200)
                    s_ = 2 * ((ff * tn + R.uniform(0, 1)) % 1.0) - 1
                    a = (pan + 1) * math.pi / 4
                    voice[:, 0] += s_ * math.cos(a)
                    voice[:, 1] += s_ * math.sin(a)
            self.place(pad, b * BAR, (voice * env[:, None] * 0.075 * level).astype(np.float32))
            if arp:
                for s in range(16):
                    t = b * BAR + s * BEAT / 4
                    g = 0.15 if inn(t, full) else 0.13
                    if inn(t, build):
                        g = 0.19
                    self.place(arpb, t, pluck(atones[arp_pattern[s % len(arp_pattern)]]), g * 1.5 * level, 0.35 if s % 2 else -0.35)
        for c in range(2):
            bass[:, c] = sosf(bass[:, c], 'lowpass', 1400)
            pad[:, c] = sosf(pad[:, c], 'lowpass', 2400)
        bass = np.tanh(bass * 1.6) / 1.6
        self.place(self.verb, 0, pad * 0.5)
        dl = int(0.75 * BEAT * SR)
        for k in range(1, 5):
            sh = np.zeros_like(arpb)
            sh[dl * k:] = arpb[:-dl * k] * (0.38 ** k)
            if k % 2:
                sh = sh[:, ::-1]
            arpb = arpb + sosf(sh, 'lowpass', 3500)
        self.place(self.verb, 0, arpb * 0.4)
        duck = np.ones(self.L, np.float32)
        for kt in self.kicks:
            i0 = int(kt * SR)
            n = min(int(0.4 * SR), self.L - i0)
            duck[i0:i0 + n] = np.minimum(duck[i0:i0 + n], 1 - 0.55 * np.exp(-np.arange(n) / SR / 0.10))
        self.music += bass * duck[:, None] + pad * duck[:, None] + arpb * (0.4 + 0.6 * duck[:, None])

    def render(self):
        ir_t = tt(1.6)
        ir = np.stack([R.standard_normal(len(ir_t)), R.standard_normal(len(ir_t))], 1) * np.exp(-ir_t / 0.45)[:, None]
        ir = sosf(ir, 'lowpass', 6000)
        ir /= np.sqrt((ir ** 2).sum(0, keepdims=True))
        wet = np.stack([signal.fftconvolve(self.verb[:, c], ir[:, c])[:self.L] for c in range(2)], 1).astype(np.float32)
        mix = self.drums + self.music + self.sfx + wet * 0.35
        out = mix[:self.N].copy()
        out[:self.L - self.N] += mix[self.N:]          # wrap the tail into the start: seamless loop
        return out

    def save(self, path):
        x = self.render()
        pk = float(np.abs(x).max()) or 1.0
        wavfile.write(path, SR, (x / pk * 0.9).astype(np.float32))
        print(f'{path}: {len(x) / SR:.2f}s, raw peak {pk:.2f}')
