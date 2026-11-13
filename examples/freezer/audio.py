"""Soundtrack for the freezer-hack Short (52 s loop, D minor, 120 BPM) — built with kit/sfx.py."""
import sys
sys.path.insert(0, 'kit')
import numpy as np
from scipy import signal
from sfx import *

T = 52.0
tr = Track(T)
tr.groove(bpm=120, prog=['Dm', 'Bb', 'F', 'C'], full=[(4, 36), (39, 48)], half=[(0, 4), (36, 39), (48, 52)], build=[(44, 48)])

# continuous freezer compressor hum + drone (whole cycles over T → continuous across the loop)
tN = np.arange(tr.N) / SR
g = np.full(tr.N, 0.25, np.float32)
for a, b, v in ((0.0, 5.0, 1.0), (49.0, 52.0, 1.0), (21.0, 28.0, 0.6)):
    g[(tN >= a) & (tN < b)] = v
g = np.maximum(signal.savgol_filter(g, 4801, 1), 0.25)
q = lambda f: round(f * T) / T
hum = (np.sin(2 * np.pi * q(60) * tN) * .6 + np.sin(2 * np.pi * q(120) * tN) * .45 + np.sin(2 * np.pi * q(180) * tN) * .2 + np.sin(2 * np.pi * q(240) * tN) * .12) * g
tr.sfx[:tr.N] += (hum * 0.05)[:, None].astype(np.float32)
tr.drone(36.71, 0.05)

tr.whooshes([5, 9, 15, 21, 28, 36, 39, 45, 49])

# hook: temperature climbs, alarm speeds up, boom on CRITICAL
tb, gap = 0.9, 0.42
while tb < 4.5:
    tr.fx(tb, alarm_beep(1150 + 300 * (tb - 0.9) / 3.6), .07)
    tb += gap
    gap = max(0.12, gap * 0.86)
tr.fx(0.8, sizzle(3.5), .10)
tr.fx(0.9, riser(3.3, 120, 700), .05)
tr.fx(4.1, boom(), .40); tr.fx(4.1, thud(), .25)
# NOT A MOVIE + breaking news sting
tr.fx(5.15, boom(110, 45, 0.8, 0.3, 0.6), .5); tr.fx(5.15, thud(), .4)
tr.fx(5.05, (sosf(noise(0.12), 'bandpass', [1500, 6000]) * np.exp(-tt(0.12) / 0.02)).astype(np.float32), .3)
tr.fx(6.3, news_sting(), .14, verb=.7)
for i in range(6):                                    # split-flap clatter while NOV 02 settles
    tr.fx(6.35 + i * 0.19, click_key(), .07, -0.3 + 0.12 * i)
# countries: one blip per tile, heat riser, boom on 50°C
for i in range(7):
    tr.fx(9.25 + i * 0.16, blip(880 * 2 ** (i * 2 / 12), 990 * 2 ** (i * 2 / 12), 0.05, 0.03), .10, -0.5 + 0.16 * i)
tr.fx(10.4, riser(2.0, 200, 900), .05)
tr.fx(12.4, boom(), .45); tr.fx(12.4, sizzle(1.4), .16)
# stores: one tick per store, thud when each count lands
for i in range(13):
    tr.fx(16.4 + i * (1.6 / 13), blip(1500, 1400, 0.025, 0.01), .07, -0.4)
tr.fx(18.05, thud(), .3)
for i in range(15):
    tr.fx(19.1 + i * (1.4 / 15), blip(1300, 1200, 0.025, 0.01), .07, 0.4)
tr.fx(20.5, thud(), .3)
# how: question, link up, typing, access granted, defrost
tr.fx(21.05, blip(660, 990, 0.12, 0.08), .12)
tr.fx(22.05, blip(1046.5, 1046.5, 0.08, 0.05), .10); tr.fx(22.15, blip(1567.98, 1567.98, 0.10, 0.07), .10)
for t0, n in ((23.6, 22), (24.3, 10), (24.9, 18), (25.8, 12), (26.8, 10)):
    tr.typing(t0, n)
tr.fx(24.95, blip(880, 1320, 0.1, 0.07), .12)
tr.fx(26.6, boom(100, 40, 1.0, 0.4, 0.6), .45)
tr.fx(26.6, (chirp_sine(400, 60, 0.6) * np.exp(-tt(0.6) / 0.3)).astype(np.float32), .15)
tb = 26.7
while tb < 27.9:
    tr.fx(tb, alarm_beep(980), .05)
    tb += 0.2
# second wave drop, 700 ticks, fire
tr.fx(28.15, boom(130, 30, 1.8, 0.8, 0.8), .9); tr.fx(28.15, crash(), .28, verb=.7)
tr.fx(28.15, glitch_burst(0.4), .10)
tk = 29.9
while tk < 33.2:
    tr.fx(tk, blip(2200 + R.uniform(-200, 200), 2300, 0.015, 0.006), .045, R.uniform(-0.6, 0.6))
    tk += 0.045
tr.fx(31.4, boom(), .3)
fire = sosf(noise(2.6), 'lowpass', 2500) * 0.4 + crackle(2.6, 160, 7) * 0.9
tr.fx(33.5, fade_edges(fire.astype(np.float32), 0.15, 0.3), .22)
tr.fx(33.6, whoosh(0.6, 200, 1500), .25)
# trash: printer thuds, clang on WASTED
for i in range(10):
    tr.fx(36.35 + i * 0.22 + R.uniform(-0.03, 0.03), thud(), R.uniform(0.18, 0.3), R.uniform(-0.4, 0.4))
tr.fx(37.4, bin_clang(), .3)
# new era
tr.fx(40.9, error_buzz(0.28), .12)
tr.fx(41.6, blip(330, 220, 0.12, 0.08), .10); tr.fx(41.72, blip(330, 220, 0.12, 0.08), .10)
tr.fx(42.7, boom(120, 35, 1.4, 0.6, 0.7), .6)
tr.fx(42.75, fade_edges((sosf(noise(1.5), 'lowpass', 600) * np.exp(-tt(1.5) / 0.6)).astype(np.float32), r=0.2), .3)
# targets: three pops, lock-on beeps, boom
for j, t0 in enumerate((45.1, 45.6, 46.1)):
    tr.fx(t0, blip(523.25 * 2 ** (j * 4 / 12), 523.25 * 2 ** (j * 4 / 12), 0.12, 0.08), .12)
for j in range(3):
    for k in range(3):
        tr.fx(46.85 + j * 0.12 + k * 0.07, alarm_beep(1800, 0.04), .05)
tr.fx(47.3, blip(1760, 1760, 0.3, 0.2), .08)
tr.fx(46.9, boom(), .35)
# loop: flickering aisle lights, rewind into the opening frame
tr.fx(49.0, flicker_buzz(1.7), .06)
tr.fx(50.68, tape_rewind(), .22)

tr.save('mix_raw.wav')
