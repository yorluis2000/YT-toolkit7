"""Voiceover for the drone-update Short: one file per line, each starting on its scene's beat and fitted to its slot.

  python3 vo.py                                      # engine: kokoro if installed, else flite (robotic, ask first)
  VO_ENGINE=kokoro VO_VOICE=af_heart VO_SPEED=1.12 python3 vo.py
  python3 vo.py --samples [voice ...]                # the hook line in several voices -> vo/samples/*.mp3 for the user to pick
Then: python3 cues.py (captions follow the voice) -> render the video -> python3 audio.py -> master -> mux.
"""
import sys, os, json, subprocess
sys.path.insert(0, 'kit')
from sfx import tts_line, fit_voice, SR

LINES = [
    ('l1', "Germany's army just grounded its recon drones."),
    ('l2', "Because of one update."),
    ('l3', "Hackers broke into Quantum Systems, a seven billion euro drone maker, and hid malware in a routine software update."),
    ('l4', "The fake update reached army servers. Not the drones."),
    ('l5', "The army grounded them anyway. They even sat out a military exercise."),
    ('l6', "They're flying again now. But one poisoned update can reach every customer at once."),
    ('l7', "So the next time an update pops up on your phone, remember."),
]
ANCHORS = [0.08, 3.48, 5.41, 12.63, 16.04, 20.78, 25.84]   # each line starts on its scene's beat (cuts in index.html)
END, GAP = 29.30, 0.12                                     # last word ends before the loop point (T = 30)


def default_engine():
    try:
        import kokoro_onnx  # noqa: F401
        return 'kokoro'
    except ImportError:
        return 'flite'


ENGINE = os.environ.get('VO_ENGINE') or default_engine()
VOICE = os.environ.get('VO_VOICE') or ('am_michael' if ENGINE == 'kokoro' else 'slt')
SPEED = float(os.environ.get('VO_SPEED', '1.1'))
os.makedirs('vo', exist_ok=True)

if '--samples' in sys.argv:
    os.makedirs('vo/samples', exist_ok=True)
    voices = sys.argv[sys.argv.index('--samples') + 1:] or ['am_michael', 'am_fenrir', 'am_puck', 'af_heart', 'af_bella', 'bm_george']
    text = LINES[0][1] + ' ' + LINES[1][1]
    for v in voices:
        tts_line(text, f'vo/samples/{v}.wav', voice=v, engine=ENGINE, speed=SPEED)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f'vo/samples/{v}.wav', '-b:a', '160k', f'vo/samples/{v}.mp3'], check=True)
        print('vo/samples/' + v + '.mp3')
    sys.exit()

out = []
for i, (k, txt) in enumerate(LINES):
    start = ANCHORS[i]
    slot = (ANCHORS[i + 1] - GAP if i + 1 < len(LINES) else END) - start
    path, sp = f'vo/{k}.wav', SPEED
    d = len(tts_line(txt, path, voice=VOICE, engine=ENGINE, speed=sp, tempo=1.04, pitch=0.97)) / SR
    if ENGINE == 'kokoro' and d > slot:                    # too long: say it faster (cleaner than stretching), up to 1.4x
        sp = min(1.4, sp * d / slot * 1.02)
        d = len(tts_line(txt, path, voice=VOICE, engine=ENGINE, speed=sp)) / SR
    d = fit_voice(path, slot)                              # last resort: gentle time-stretch into the slot
    open(f'vo/{k}.txt', 'w').write(txt)
    out.append({'id': k, 'text': txt, 'start': start, 'dur': round(d, 3), 'slot': round(slot, 3), 'engine': ENGINE,
                'voice': VOICE, 'speed': round(sp, 3)})
    print(f'{k}  {start:6.2f} -> {start + d:6.2f}  (slot {slot:.2f}s, speed {sp:.2f})  {txt}')
json.dump(out, open('vo/timeline.json', 'w'), indent=1)
print(f'engine {ENGINE}, voice {VOICE}: voice ends at {out[-1]["start"] + out[-1]["dur"]:.2f}s of 30.00')
