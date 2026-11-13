#!/usr/bin/env python3
"""capture.py — record an HTML composition (kit.js contract: window.__ready, window.__seek(t), window.__meta)
to an H.264 MP4 with headless Chrome, frame-exactly, in parallel chunks.

  python3 kit/capture.py index.html --stills 0,4.2,12.5,28.3     # look at frames first (writes preview/ + sheet.jpg)
  python3 kit/capture.py index.html --seam                        # loop check: frame at t=T vs t=0
  python3 kit/capture.py index.html --out video_only.mp4          # full render (2 workers by default)
  python3 kit/capture.py --mux video_only.mp4 mix.wav final.mp4   # add the mastered audio (video stream copied)
  python3 kit/capture.py --qa final.mp4                           # duration, size, bitrate, loudness
"""
import argparse, base64, io, json, os, re, subprocess, sys, time
from pathlib import Path

ENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p',
       '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart']
VF = 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p'


def chrome_path():
    for p in (os.environ.get('CHROME'), '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
              '/usr/bin/chromium-browser', '/opt/google/chrome/chrome'):
        if p and os.path.exists(p):
            return p
    return None  # fall back to Playwright's bundled Chromium



def open_page(pw, html):
    b = pw.chromium.launch(executable_path=chrome_path(),
                           args=['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none',
                                 '--disable-background-timer-throttling', '--disable-renderer-backgrounding'])
    pg = b.new_page(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.goto(Path(html).resolve().as_uri())
    try:
        pg.wait_for_function('window.__ready === true', timeout=90000)
    except Exception:
        b.close()
        sys.exit('page never became ready:\n  ' + '\n  '.join(errs[-12:] or ['(no errors logged)']))
    meta = pg.evaluate('window.__meta')
    if meta and (meta.get('W', 1080), meta.get('H', 1920)) != (1080, 1920):
        pg.set_viewport_size({'width': meta['W'], 'height': meta['H']})
    cdp = pg.context.new_cdp_session(pg)
    return b, pg, cdp, meta, errs


def shot(pg, cdp, t, q=92):
    pg.evaluate(f'window.__seek({t:.6f})')
    return base64.b64decode(cdp.send('Page.captureScreenshot', {'format': 'jpeg', 'quality': q, 'optimizeForSpeed': True})['data'])


def probe(html):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b, pg, cdp, meta, errs = open_page(pw, html)
        b.close()
    for e in errs[:8]:
        print('  ', e)
    return meta


def worker(html, f0, f1, fps, out, idx):
    from playwright.sync_api import sync_playwright
    tmp = out[:-4] + '.tmp.mp4'
    with sync_playwright() as pw:
        b, pg, cdp, meta, errs = open_page(pw, html)
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg',
                               '-i', '-', '-vf', VF, *ENC, tmp], stdin=subprocess.PIPE)
        t0 = time.time()
        for f in range(f0, f1):
            ff.stdin.write(shot(pg, cdp, f / fps))
            done = f - f0 + 1
            if idx == 0 and (done % 90 == 0 or f == f1 - 1):
                el = time.time() - t0
                print(f'  worker0 {done}/{f1 - f0} frames  {el / done * 1000:.0f} ms/frame  eta {el / done * (f1 - f - 1):.0f}s', flush=True)
        ff.stdin.close()
        rc = ff.wait()
        b.close()
    for e in errs[:6]:
        print(f'  [worker {idx}] {e}')
    if rc != 0:
        sys.exit(f'ffmpeg failed in worker {idx}')
    os.replace(tmp, out)


def render(html, out, workers=2, t0=None, t1=None):
    import multiprocessing as mp
    meta = probe(html)
    T, fps = float(meta['T']), int(meta['fps'])
    n = int(round(T * fps))
    f0 = 0 if t0 is None else int(round(t0 * fps))
    f1 = n if t1 is None else int(round(t1 * fps))
    print(f'rendering {f1 - f0} frames ({(f1 - f0) / fps:.2f}s @ {fps} fps) with {workers} workers, engine: {meta.get("engine")}')
    w = max(1, min(workers, f1 - f0))
    cuts = [f0 + (f1 - f0) * i // w for i in range(w + 1)]
    parts = [f'{out[:-4]}.part{i}.mp4' for i in range(w)]
    ctx = mp.get_context('spawn')
    ps = [ctx.Process(target=worker, args=(html, cuts[i], cuts[i + 1], fps, parts[i], i)) for i in range(w)]
    t_start = time.time()
    for p in ps:
        p.start()
    for p in ps:
        p.join()
    if any(p.exitcode != 0 for p in ps):
        sys.exit('a worker failed')
    lst = out[:-4] + '.concat.txt'
    Path(lst).write_text(''.join(f"file '{Path(p).resolve()}'\n" for p in parts))
    tmp = out[:-4] + '.tmp.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out)
    for p in parts + [lst]:
        os.remove(p)
    print(f'done in {time.time() - t_start:.0f}s -> {out} ({os.path.getsize(out) / 1e6:.1f} MB)')


def stills(html, times, outdir='preview', sheet=True):
    from playwright.sync_api import sync_playwright
    from PIL import Image, ImageDraw, ImageFont
    os.makedirs(outdir, exist_ok=True)
    paths = []
    with sync_playwright() as pw:
        b, pg, cdp, meta, errs = open_page(pw, html)
        for t in times:
            p = os.path.join(outdir, f'still_{t:06.2f}.jpg')
            Path(p).write_bytes(shot(pg, cdp, t))
            paths.append((t, p))
        b.close()
    for e in errs[:10]:
        print('  ', e)
    if sheet and paths:
        cols = min(4, len(paths))
        rows = (len(paths) + cols - 1) // cols
        tw, th = 360, 640
        S = Image.new('RGB', (cols * tw + (cols + 1) * 12, rows * (th + 40) + 12), (20, 20, 24))
        try:
            fnt = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Bold.otf', 26)
        except Exception:
            fnt = ImageFont.load_default()
        d = ImageDraw.Draw(S)
        for i, (t, p) in enumerate(paths):
            im = Image.open(p).resize((tw, th), Image.LANCZOS)
            x, y = 12 + (i % cols) * (tw + 12), 12 + (i // cols) * (th + 40)
            S.paste(im, (x, y))
            d.text((x + 4, y + th + 6), f't = {t:.2f}s', fill=(230, 230, 235), font=fnt)
        sp = os.path.join(outdir, 'sheet.jpg')
        S.save(sp, quality=88)
        print('sheet ->', sp)
    return [p for _, p in paths]


def seam(html):
    import numpy as np
    from PIL import Image
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b, pg, cdp, meta, errs = open_page(pw, html)
        T, fps = float(meta['T']), int(meta['fps'])
        imgs = [np.asarray(Image.open(io.BytesIO(shot(pg, cdp, t))), dtype=np.float32) for t in (0.0, T, T - 1 / fps, 1 / fps)]
        b.close()
    pic = np.r_[0:1085, 1400:imgs[0].shape[0]]          # everything except the caption band (speech may cut at the loop)
    d_loop = np.abs(imgs[0][pic] - imgs[1][pic]).mean()
    d_last = np.abs(imgs[2][pic] - imgs[0][pic]).mean()
    d_step = np.abs(imgs[3][pic] - imgs[0][pic]).mean()
    print(f'seam (picture, captions excluded): |frame(T) - frame(0)| = {d_loop:.2f}  (want < 1.5)   '
          f'last→first step {d_last:.2f}  vs a normal step {d_step:.2f}')
    return d_loop


def mux(video, audio, out):
    tmp = out[:-4] + '.tmp.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out)
    print('muxed ->', out)


def qa(path):
    pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path],
                                   capture_output=True, text=True).stdout)
    v = next(s for s in pr['streams'] if s['codec_type'] == 'video')
    a = next((s for s in pr['streams'] if s['codec_type'] == 'audio'), None)
    dur = float(pr['format']['duration'])
    size = os.path.getsize(path) / 1e6
    print(f'{path}: {v["width"]}x{v["height"]} {v["r_frame_rate"]} fps, {v.get("nb_frames", "?")} frames, {dur:.2f}s, '
          f'{size:.1f} MB, {float(pr["format"]["bit_rate"]) / 1e6:.1f} Mb/s, audio: {a["codec_name"] if a else "NONE"}')
    if a:
        err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                             capture_output=True, text=True).stderr
        i = re.findall(r'I:\s+(-?[\d.]+) LUFS', err)
        tp = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', err)
        print(f'  loudness {i[-1] if i else "?"} LUFS (target -14.5), true peak {tp[-1] if tp else "?"} dBFS')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('html', nargs='?')
    ap.add_argument('--out', default='video_only.mp4')
    ap.add_argument('--workers', type=int, default=2)
    ap.add_argument('--from', dest='t0', type=float)
    ap.add_argument('--to', dest='t1', type=float)
    ap.add_argument('--stills')
    ap.add_argument('--outdir', default='preview')
    ap.add_argument('--seam', action='store_true')
    ap.add_argument('--mux', nargs=3, metavar=('VIDEO', 'AUDIO', 'OUT'))
    ap.add_argument('--qa')
    a = ap.parse_args()
    if a.mux:
        mux(*a.mux)
    elif a.qa:
        qa(a.qa)
    elif a.stills:
        stills(a.html, [float(x) for x in a.stills.split(',')], a.outdir)
    elif a.seam:
        seam(a.html)
    else:
        render(a.html, a.out, a.workers, a.t0, a.t1)
