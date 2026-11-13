# InteresTech7 Shorts kit

Build 50–60 s vertical YouTube Shorts as animated web pages and record them frame-exactly to MP4: modern UI motion
graphics, word-pop captions, synthesized music and sound design, and a seamless loop.

| Path | What it is |
|---|---|
| `kit/motion.js` | GSAP-compatible animation engine: timelines, position parameters, eases, stagger, CSS variables, colours, drawSVG, text, scrambleText. Load the real `gsap.min.js` before it and the same scenes run on GSAP. |
| `kit/kit.js`, `kit/kit.css` | Scenes, captions, camera shake/kicks, flashes, backgrounds (dot field, glows, particles, flowing paths), split-flap and glitch text, icons, and Kokonut UI-style components (cards, glass, islands, toasts, metrics, terminal, switch, stamps). |
| `kit/capture.py` | Headless Chrome → H.264: preview stills + contact sheet, loop-seam check, parallel render, audio mux, QA. |
| `kit/sfx.py`, `kit/master.py` | Music bed + sound effects synthesized with numpy/scipy, mastered to −14.5 LUFS with a loop-safe limiter. |
| `examples/freezer/` | Worked example: "Hackers cranked supermarket freezers to 122°F" (52 s). |
| `SKILL.md` | The Claude skill that runs the whole workflow, from topic research to voiceover text. |

## Quick start
```bash
cd examples/freezer                                   # kit/ is linked in
python3 kit/capture.py index.html --stills 0,4.4,13.6,28.6,51.7   # preview/sheet.jpg
python3 kit/capture.py index.html --seam              # loop check (want 0.00)
python3 kit/capture.py index.html --out video_only.mp4
python3 audio.py && python3 kit/master.py mix_raw.wav mix.wav
python3 kit/capture.py --mux video_only.mp4 mix.wav short.mp4 && python3 kit/capture.py --qa short.mp4
```
Needs Chrome or Chromium, Python 3 with `playwright numpy scipy pillow`, `ffmpeg`, and the Inter / Inter Display fonts.

## How it works
Every frame is a pure function of time. `window.__seek(t)` seeks the master timeline and runs the per-frame hooks. That is
why frames can be rendered in any order and in parallel, and why the last frame flows back into the first.

Credits: the animation API follows [GSAP](https://gsap.com/), and the visual style is inspired by
[Kokonut UI](https://kokonutui.com/). No code from either project is included.
