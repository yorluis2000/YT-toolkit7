"""Soundtrack for the drone-update Short (30 s loop, E minor, 120 BPM) — groove + SFX + voiceover, built with kit/sfx.py.

  python3 vo.py && python3 cues.py   (voice files + captions; then render the video)
  python3 audio.py            -> mix_raw.wav       (with the voiceover; music ducks under it)
  python3 audio.py --novo     -> mix_novo_raw.wav  (same bed and SFX, no voice: for re-voicing in CapCut)
"""
import sys, json
sys.path.insert(0, 'kit')
import numpy as np
from sfx import *

NOVO = '--novo' in sys.argv
T = 30.0
tr = Track(T)
tr.groove(bpm=120, prog=['Em', 'C', 'Am', 'B'], full=[(5.3, 25.7)], half=[(0, 5.3), (25.7, 30)], build=[(22.1, 25.7)], level=0.85)
tr.drone(41.2, 0.04)                                   # low E bed, whole cycles over T


def rotor(d, f0=170.0, f1=None, gain_env=None, seed=1):
    """quadcopter/VTOL motor buzz: blade-pass AM over a filtered saw, optional pitch glide f0 -> f1"""
    t = tt(d)
    f = np.full(len(t), f0) if f1 is None else f0 * (f1 / f0) ** (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    rng = np.random.default_rng(seed)
    saw = sum(np.sin(k * ph + rng.uniform(0, 6.28)) / k for k in range(1, 9))
    am = 0.7 + 0.3 * np.sin(ph * 2)                      # two blades per turn
    x = sosf(saw * am, 'lowpass', 2200) + sosf(noise(d), 'bandpass', [400, 3000]) * 0.15
    if gain_env is not None:
        x = x * gain_env(t)
    return fade_edges(x.astype(np.float32), 0.02, 0.05)


# ---- hook (0–3.35, and the loop tail 29.35–30 fading back in): drone airborne, then GROUNDED on "grounded"
tail0 = T - 0.65
hook_d = (T - tail0) + 1.8                             # starts in the tail, wraps into 0–1.8 (render() wraps the tail)
env = lambda t: np.clip((t) / 0.5, 0, 1) * np.where(t < 0.65 + 1.3, 1.0, np.exp(-(t - 0.65 - 1.3) / 0.12))
tr.fx(tail0, rotor(hook_d, 165, gain_env=env), .10)
tr.fx(tail0 + 0.65 + 1.3, rotor(0.6, 165, 45, gain_env=lambda t: np.exp(-t / 0.18)), .10)     # spin-down
tr.fx(1.30, boom(), .45); tr.fx(1.30, thud(), .30)
tr.fx(1.30, glitch_burst(0.22), .08)
tr.fx(1.32, (chirp_sine(700, 90, 0.45) * np.exp(-tt(0.45) / 0.2)).astype(np.float32), .07)    # power-down
for k in range(3):
    tr.fx(1.55 + k * 0.22, alarm_beep(990), .045)

tr.whooshes([3.35, 5.30, 9.30, 12.50, 15.90, 20.65, 22.10, 25.70])

# ---- ONE UPDATE: card pop, "1" lands, download ticks, glitch
tr.fx(3.43, ui_pop(880), .10)
tr.fx(3.95, thud(), .35); tr.fx(3.95, boom(120, 50, 0.6, 0.25, 0.3), .25)
for i in range(10):
    tr.fx(3.62 + i * 0.13, blip(1200 + i * 60, 1250 + i * 60, 0.025, 0.012), .045, 0.3)
tr.fx(4.85, glitch_burst(0.4, 9), .12); tr.fx(4.92, error_buzz(0.3), .08)

# ---- BREACH: stamp, valuation counts up, alert toast
tr.fx(6.55, boom(110, 40, 0.9, 0.35, 0.6), .45); tr.fx(6.55, thud(), .3); tr.fx(6.55, glitch_burst(0.3, 3), .10)
for i in range(7):
    tr.fx(7.48 + i * 0.1, blip(1400 + 90 * i, 1450 + 90 * i, 0.03, 0.015), .06, -0.3)
tr.fx(8.27, thud(), .28)
tr.fx(8.35, alarm_beep(1250), .05); tr.fx(8.52, alarm_beep(1250), .05)

# ---- MALWARE: package, bug skitters in, gets swallowed, status flips
tr.fx(9.35, ui_pop(784), .10)
tr.fx(9.6, fade_edges((crackle(0.6, 140, 4) * np.linspace(0.4, 1, ns(0.6))).astype(np.float32), 0.02, 0.1), .14, -0.4)
tr.fx(10.25, whoosh(0.35, 2000, 300), .12)
tr.fx(10.60, boom(100, 45, 0.7, 0.3, 0.5), .35); tr.fx(10.60, glitch_burst(0.25, 7), .10)
tr.fx(11.50, glitch_burst(0.45, 11), .12); tr.fx(11.50, thud(), .25)
tr.typing(11.52, 12, rate=28, gain=(0.04, 0.06))

# ---- REACH: nodes, red line to army servers, shield stops the drones
for i in range(3):
    tr.fx(12.55 + i * 0.1, ui_pop(660 * 2 ** (i * 3 / 12)), .07)
tr.fx(13.0, riser(0.75, 300, 1400), .05)
tr.fx(13.85, error_buzz(0.3), .10); tr.fx(13.85, thud(), .25)
tr.fx(14.65, bell(1567.98, 1.0), .06, verb=.4); tr.fx(14.66, blip(2093, 2093, 0.12, 0.08), .06)
tr.fx(14.75, success(), .10)

# ---- GROUNDED fleet + exercise
for i in range(9):
    tr.fx(15.95 + i * 0.04, ui_pop(523.25 * 2 ** ((i % 5) * 2 / 12)), .05, -0.5 + i / 8)
tr.fx(16.65, (chirp_sine(500, 70, 0.6) * np.exp(-tt(0.6) / 0.25)).astype(np.float32), .08)
tr.fx(16.70, boom(), .40); tr.fx(16.70, thud(), .25)
for i in range(9):
    tr.fx(16.75 + i * 0.06 + R.uniform(-0.01, 0.01), blip(300, 200, 0.05, 0.03), .06, R.uniform(-0.6, 0.6))
tr.fx(18.75, thud(), .32); tr.fx(18.75, boom(120, 50, 0.6, 0.25, 0.4), .22)

# ---- FLYING AGAIN: chime + rotors spin up
tr.fx(20.70, success(), .10, verb=.3)
tr.fx(20.70, rotor(1.45, 50, 170, gain_env=lambda t: np.clip(t / 0.4, 0, 1) * np.clip((1.45 - t) / 0.2, 0, 1), seed=3), .08)

# ---- FAN-OUT: one update, every customer at once
tr.fx(22.12, ui_pop(988), .08)
for i in range(10):
    tr.fx(22.30 + i * 0.05, ui_pop(659.25 * 2 ** ((i % 4) * 3 / 12)), .045, -0.5 + i / 9)
tr.fx(22.6, riser(2.15, 180, 1100), .06)
tr.fx(24.75, boom(130, 30, 1.6, 0.7, 0.8), .80); tr.fx(24.75, crash(), .22, verb=.6); tr.fx(24.75, glitch_burst(0.35, 13), .10)

# ---- LOOP: phone, update notification, glitch on "remember", rewind into the hook
tr.fx(26.85, bell(1318.51, 1.0), .07, verb=.3); tr.fx(26.97, bell(1760.0, 1.2), .07, verb=.3)
tr.fx(28.90, glitch_burst(0.3, 17), .10)
tr.fx(29.30, whoosh(0.55, 4000, 400, rev=True), .14)

# ---- voiceover (timings from vo/timeline.json, generated by vo.py)
if not NOVO:
    import os
    if not all(os.path.exists(f"vo/{ln['id']}.wav") for ln in json.load(open('vo/timeline.json'))):
        sys.exit('voice files missing: run  python3 vo.py  first (then python3 cues.py and re-render the video)')
    for ln in json.load(open('vo/timeline.json')):
        tr.voice(ln['start'], load_voice(f"vo/{ln['id']}.wav"), gain=1.8, verb=0.05)

tr.save('mix_novo_raw.wav' if NOVO else 'mix_raw.wav')
