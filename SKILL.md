---
name: interestech7-shorts
description: Make complete, fact-checked, viral 50–60 s YouTube Shorts for InteresTech7 (cyber, hardware, AI news): topic research, hook+loop script, captions, GSAP/Kokonut-style motion graphics rendered in Chrome, music/SFX, titles, hashtags, TTS voiceover chunks. Use for any Short, Reel, TikTok, 60-second video or tech-news script request.
---

# InteresTech7 Shorts

One request → one finished Short: a fact-checked 50–55 s story with a hook in the first second, captions that pop
word by word, modern UI motion graphics (Kokonut UI look, GSAP motion), music and sound effects that hit on every beat,
and a loop so seamless people watch it twice. The reference build is the freezer-hack Short in `examples/freezer/`.

## What to deliver
1. `InteresTech7_<Topic>.mp4` — 1080×1920, 30 fps, 50–55 s, H.264 + AAC, −14.5 LUFS, under 30 MB, seamless loop.
2. `InteresTech7_<Topic>_VO.mp4` — same picture with the music ~9 dB lower, ready for an AI voiceover on top.
3. In the reply: 3 title options, a description with sources, hashtags, a pinned-comment question.
4. Voiceover text split into chunks of at most 450 characters, each with its start time (CapCut/Clipchamp TTS stop at ~500).

Work the steps in order and send the video as soon as it passes QA. When the user only wants topics, a script, titles or
voiceover text, do just that step.

## 0. Set up the kit (2 minutes)
The kit is a GSAP-compatible motion engine, Kokonut-style components, a Chrome frame recorder, an audio synth and a
mastering script. It lives on GitHub with a worked example:
```bash
git clone --depth 1 https://github.com/yorluis2000/YT-toolkit7.git ~/its7-kit
mkdir -p ~/shorts/<slug> && cp -r ~/its7-kit/kit ~/shorts/<slug>/kit && cd ~/shorts/<slug>
cat ~/its7-kit/examples/freezer/index.html     # read it once: copy its structure, not its story
```
- Clone refused? Attach the repo with the add_repo tool (owner `yorluis2000`, repo `YT-toolkit7`) and retry.
- Backup copy: the "Youtube Shorts" project docs `claude/shorts-kit/kit_bundle.txt` and `claude/shorts-kit/example_freezer.txt`.
  Each file sits after a `### FILE: <name>` line. If `project_read` returns a local path, unpack with
  `python3 -c "import re,sys,pathlib as P;s=P.Path(sys.argv[1]).read_text();[(P.Path('kit')/n).write_text(b) for n,b in re.findall(r'^### FILE: (\S+)\n(.*?)(?=^### FILE: |\Z)',s,re.S|re.M)]" <path>`
  after `mkdir -p kit`. If it returns the text inline, write each file with the Write tool.
- Check the machine: `which google-chrome chromium ffmpeg; python3 -c "import playwright, numpy, scipy, PIL"; fc-list | grep -c "Inter Display"`.
  Package installs are often blocked, so use what is installed. Without Chrome/Chromium + Playwright, tell the user and fall back
  to drawing frames with PIL/numpy (same design rules; much slower to build).
- Real GSAP: if `gsap.min.js` is available (a local file, or `npm i gsap` where the network allows), load it before
  `kit/motion.js` and call `gsap.registerPlugin(DrawSVGPlugin, ScrambleTextPlugin, TextPlugin)`. The scenes run unchanged
  (motion.js steps aside). Real ScrambleText uses Math.random, so frames differ between renders; prefer `kit.scramble` in a
  frame hook when that matters.

## 1. Find the story (when the user wants topics)
- Search the last 7 days of cybersecurity, hardware and AI news with several separate searches (attacks, chips, AI launches,
  outages, laws). Prefer stories with a concrete number, physical-world stakes or a twist, a named company, and a
  "could happen to you" angle. Fresher is better (≤ 72 h).
- Offer 2 options unless asked for more: working title, the hook line, why it will hold attention, 3–4 key facts each with a
  source link. Wait for the pick.
- If the Projects tool is available, read `claude/shorts-log.md` first and skip topics already covered.

## 2. Fact-check before writing
- Every number, date, name and claim needs 2 independent reputable sources, or 1 primary source (official statement,
  filing, the researchers' report). Where reports differ, use conservative words: "at least", "around", "reportedly".
- Write exact dates ("November 2nd"), never "yesterday": Shorts live for months.
- UI labels in the graphics may be illustrative ("FREEZER 07", "Aisle 4"), but they must not invent facts: no made-up
  numbers, per-item figures, quotes or step-by-step attack instructions. Company names in text only, never logos.

## 3. Script (50–55 s, about 130–145 words)
Beat sheet that worked (freezer Short, 52 s):

| time | beat | job |
|---|---|---|
| 0–5 | Hook | most shocking concrete claim with a number; first word already on screen at frame 0 |
| 5–9 | Credibility | "Not a movie. This happened across Europe on November 2nd" |
| 9–21 | Scale | where, who, how many (2 beats) |
| 21–28 | How | the mechanism in plain words |
| 28–36 | Escalation | "And it's the second wave" / "It gets worse" |
| 36–39 | Consequence | the human cost |
| 39–45 | Big picture | why it matters beyond this story |
| 45–49 | Viewer stakes | "If it's online, it's a target" |
| 49–T | Loop line | ends mid-sentence and flows into the hook ("…remember— HACKERS JUST CRANKED…") |

- One idea per beat and a new visual every 2–4 s.
- Write the captions as cues: `[start, end, 'TEXT WITH *YELLOW ~BLUE !RED']`, 2–7 words each at ~2.6 words/s.
  Yellow `*` for numbers and key nouns, blue `~` for tech/online words, red `!` for danger words.
- Pick T as a whole number of bars so the music loops: at 120 BPM that is any even number of seconds (50, 52, 54).

## 4. Design system (Kokonut UI look)
- Canvas 1080×1920 at 30 fps. Zones: 0–250 empty (platform UI), 250–1060 stage, 1085–1400 captions,
  1400–1920 calm (Shorts title and buttons; keep the right edge past x≈930 clear too).
- Surfaces: zinc-950 background, zinc-900 cards, hairline borders (white 9%), 28–36 px radius, soft deep shadows.
  One or two accents per story: cyber = cyan + red, AI = violet + fuchsia, hardware = amber + emerald.
- Type: Inter Display 900 for numbers, headlines and captions; Inter 600–800 for UI; DejaVu Sans Mono for terminals.
  Uppercase Inter Display Black is about 0.65 em per letter, so a 10-letter line at 150 px overflows the 920 px stage. Check widths.
- Match each beat to a component (CSS in `kit/kit.css`, helpers in `kit/kit.js`):
  - numbers, temperatures, prices → metric card + sparkline (drawSVG) or `kit.ring`
  - BREAKING / ONLINE / ALERT → `.island` + `.live` dot
  - dates and counts → split-flap `kit.flaps`
  - before/after, real vs fake, ON/OFF → `.switch` (tween `--on`)
  - countries, companies, products → bento grid of `.tile`s with flags/icons
  - victims, stores, accounts → `.toast`/card stack with a counter and a row of icons lighting up
  - how it works → `.term` terminal with `text` / `scrambleText` (illustrative and generic, never real exploit steps)
  - "700 supermarkets", "1M users" → dot grid lit with a random stagger
  - losses and costs → receipt that prints, then a `.stamp`
  - punchlines → `.glitch`, `.grad-text`, `.shimmer`, `.marker`
  - "target" → crosshair reticles locking on
  - backgrounds → dot field always; radial glows recoloured per beat; particles (snow, embers); `kit.bgPaths`
- Icons: `kit.icon(name, {size, sw})` with snowflake thermometer flame wifi store trash factory fridge database crosshair globe
  lock unlock alert zap server cpu shield check x terminal cloud calendar bot sparkle cart eye bolt radio power file user card package.

## 5. Motion language (GSAP)
- Entrances `expo.out` / `power4.out` 0.4–0.6 s, from y 60–150 or x ±140–240 with `autoAlpha`. Exits `power2.in` 0.22–0.32 s (exits faster than entrances).
- Pops and stamps `back.out(1.6–2.5)` 0.3–0.45 s; slams start at scale 1.6–2.4.
- Counters `power1/2.inOut`; when each counted item has its own sound, use `steps(n)` so number and sound match.
- Staggers: chars 0.03, words 0.06–0.08, cards 0.08–0.16; dot grids `{amount: 1.5, from: 'random'}`, ripples `{from: 'center', grid: [rows, cols]}`.
- Overlap with position parameters (`'<0.1'`, `'-=0.3'`); every scene timeline starts at local 0.
- Masked reveals: `kit.split(el, 'chars', {mask: true})` then `from {yPercent: 110}`. Lines: `drawSVG '0%' → '100%'`.
- Camera: zoom kick on every cut, shake + punch on every impact, slow push-in on the hook. Flashes: white 0.12 at cuts, coloured on impacts.
- Something moves at all times; nothing sits still longer than ~1.5 s.

## 6. Build
One folder per Short: `index.html`, `audio.py`, `kit/` (copied), `preview/`. Copy the structure of `examples/freezer/index.html`:
- `<link rel="stylesheet" href="kit/kit.css">`, then story CSS. Prefix classes per scene; never use the kit's `k-` prefix.
- Body: `#app > #bg (.dots) + #world + #fx (.flash .vignette .grain)`. Scripts: [gsap.min.js] → kit/motion.js → kit/kit.js → composition.
- `kit.start({T, fps: 30}, () => {…})`: grain, `bgDots`, `bgGlows` (colours keyed to beats), particles. Then call
  `kit.hookScene('hook', 5, (tl, el) => …)` first. Add one `kit.scene(id, s0, s1, (tl, el) => …)` per beat; their times are local.
  Give the last scene `{fadeOut: [T - 0.65, T - 0.15]}`. Then `kit.captions(CUES)`, `kit.camera('#world', {impacts, kicks: cuts, pushes})`,
  `kit.flashes('#fx .flash', list)`.

These rules prevent the bugs already hit:
- Frame 0 is the thumbnail and the loop target, so the hook starts fully built, never from empty.
- Everything is a function of t. No CSS animations or transitions, no `Math.random`/`Date`; use `kit.hash`, `kit.rng`, seeded staggers.
  That is what makes parallel rendering and the seamless loop possible.
- The engine owns `transform` on tweened elements, so position them with left/top/flex, never CSS transforms.
- Tween colours and CSS variables, never box-shadow or gradient strings (the browser lists box-shadow colour-first, so
  the numbers get mixed up). Declare tweened variables in CSS with their start value (`--dc: #34d399`), or they start at 0/transparent.
- `from`/`fromTo` show their start values immediately; for a mid-scene punch use `immediateRender: false`.
- Animate numbers through proxies: `const c = {v: 0}; tl.to(c, {v: 700, duration: 1.5}); kit.text(el, () => kit.num(c.v))`.
- At most 2 `.glass` (backdrop blur) panels on screen, and never `filter: blur()` on big elements (use `.glow`):
  blur roughly doubled render time in tests.
- Never cover the key number with a stamp or badge.

## 7. Preview, render, audio
```bash
python3 kit/capture.py index.html --stills 0,2.5,4.4,7,12,18,24,30,38,44,48,51.7   # writes preview/sheet.jpg
```
Read the sheet. Fix overflow, overlaps, empty moments and anything in the 0–250 or 1400+ zones, then re-render only those stills. Then:
```bash
python3 kit/capture.py index.html --seam                    # want 0.00, and last→first ≈ a normal step
python3 kit/capture.py index.html --out video_only.mp4      # about 2.5 min for 52 s with 2 workers
python3 audio.py && python3 kit/master.py mix_raw.wav mix.wav
python3 kit/capture.py --mux video_only.mp4 mix.wav InteresTech7_<Topic>.mp4
python3 kit/master.py mix_raw.wav mix_vo.wav -23.5 && python3 kit/capture.py --mux video_only.mp4 mix_vo.wav InteresTech7_<Topic>_VO.mp4
python3 kit/capture.py --qa InteresTech7_<Topic>.mp4        # duration, ~20 MB, −14.5 LUFS
```
`audio.py` follows `examples/freezer/audio.py`: `Track(T).groove(bpm, prog, full, half, build)`, `whooshes(cuts)`, then one sound per
visual event at the same timestamps as the timeline (booms on impacts, a blip per counted item, typing under terminal text,
risers into drops, a tape rewind into the loop). Continuous tones go through `tr.drone` so they repeat a whole number of times over T.

## 8. Deliver
- Send both MP4s with SendUserFile.
- Titles: 3 options of ≤ 60 characters that combine curiosity with a keyword and stay true to the facts.
- Description: 2–3 lines, then "Sources:" with links.
- Hashtags: #Shorts plus 3–4 topical tags (e.g. #CyberSecurity #Hacking #TechNews).
- Pinned comment: a question that invites replies.
- Voiceover: turn the cues into sentences (markers removed, normal case). Spell out units and symbols ("122 degrees
  Fahrenheit"), and keep "…" for pauses. Split at scene starts into chunks of at most 450 characters, each with its start time
  (3 chunks at 0:00 / 0:21 / 0:39 worked for 52 s). One voice clip per chunk. In CapCut, delete the text box after generating
  so the burned-in captions aren't doubled. Use the `_VO` file, or lower the music to ~35%. If a chunk runs long, set 1.1× speed.
- If the Projects tool is available, append to `claude/shorts-log.md`: date, topic, title, length, and what to change next time.

## Appendix: kit API
```
kit.start({T, fps}, build)               fonts → build → render frame 0 → window.__ready (capture.py waits for it)
kit.hookScene(id, dur, (tl, el, dur)=>{}) opening scene on its own paused timeline; fades in again at its first frame over the last 0.65 s
kit.scene(id, s0, s1, (tl, el, dur)=>{}, {fade, fadeOut:[a,b]})   shown on [s0, s1); tweens use local time
kit.frame(t=>{}) · kit.text(el, t=>str) · kit.style(el, t=>({...}))     run every frame after the timeline (hookScene runs first)
kit.captions(cues) · kit.camera(el, {impacts:[[t,s]], kicks:[t], pushes:[[a,b,amt]]}) · kit.flashes(el, [[t,dur,color,peak]])
kit.bgDots(el,{gap,drift,alpha}) · kit.bgGlows(el,[{x,y,r,c,ax,ay,k,a}]) → divs (set '--c') · kit.bgParticles(parent,{n,color,size,m,dir,wobble,show:t=>0..1})
kit.bgPaths(parent,{n,color:'r,g,b',alpha,show}) · kit.grain(el) · kit.split(el,'chars'|'words',{mask}) · kit.flaps(el,text,t0,t1)
kit.glitch(el,[[a,b]],amt) · kit.scramble(final,p,t) · kit.type(final,p) · kit.num(v,{dec,pre,suf}) · kit.icon(name,{size,sw})
kit.ring(size,sw,color) → {el, arc} · kit.mix(a,b,p) · kit.ramp(stops,p) · kit.prog(t,a,b) · kit.hash(a,b) · kit.rng(seed) · kit.cyc(t,k)
gsap (motion.js or real): timeline().to/.from/.fromTo/.set/.add/.addLabel/.seek; positions 2 '<' '>' '<0.3' '-=0.4' 'label+=1';
  eases none power1-4 sine expo circ back(o) elastic(a,p) bounce steps(n) (.in/.out/.inOut); stagger number|{each|amount,from,grid,ease};
  props: transforms, opacity/autoAlpha, blur/brightness, colours, any numeric CSS, '--vars', attr:{}, drawSVG, text, scrambleText, plain objects
kit.css: .card .glass .gborder .ring-glow(--c) .tile .pill(.hot) .live .island .badge .stamp .toast .icon-tile(--c) .metric .bar>i(--w)
  .term .switch(--on) .flap .kicker .label .title .h1 .mega .grad-text(--accent/--accent2) .shimmer(--shine) .marker(--mk) .glitch .tnum
capture.py: --stills t,… [--outdir] | --seam | --out f [--workers N --from a --to b] | --mux video audio out | --qa file
sfx.py: Track(T) .groove .whooshes .fx(t,sig,gain,pan,verb) .typing .drone .save; kick snare clap hat crash boom thud whoosh click_key
  blip bell crackle pluck alarm_beep sizzle news_sting bin_clang flicker_buzz tape_rewind riser glitch_burst ui_pop success error_buzz
master.py in.wav out.wav [LUFS, default -14.5]
```
Rebuilding the kit from scratch (only if neither copy is reachable) comes down to one contract. `window.__seek(t)` must render the exact
frame for t in any order, `window.__ready` signals the page is built, and `window.__meta` holds `{T, fps}`. Capture takes CDP JPEG
screenshots at quality 92 and pipes them into ffmpeg (mjpeg → libx264 veryfast CRF 19, maxrate 14M, yuv420p, bt709), split into 2
parallel chunks and joined with concat `-c copy`. Mastering uses a wrap-around look-ahead limiter to −14.5 LUFS.
