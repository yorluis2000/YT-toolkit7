/* kit.js — InteresTech7 Shorts kit: composition clock, scenes, captions, camera, text FX, backgrounds, icons.
 * Load order: [gsap.min.js] → motion.js → kit.js → your scenes. Everything is driven by window.__seek(t):
 * the master timeline (kit.tl) is seeked first, then every kit.frame(fn) hook runs with t — so every frame is
 * a pure function of time and can be rendered in any order. Never use CSS animations/transitions or Date.now().
 */
(function () {
  'use strict';
  const K = (window.kit = { W: 1080, H: 1920, fps: 30, T: 52, t: 0 });
  const hooks = [];
  K.tl = gsap.timeline({ paused: true });
  K.frame = fn => (hooks.push(fn), fn);
  window.__seek = t => {
    K.t = t;
    K.tl.seek(t, false);
    if (gsap.isMini && gsap.globalTimeline.kids.length) gsap.globalTimeline.seek(t);
    for (const f of hooks) f(t);
  };
  // kit.start({T, fps}, build) — waits for fonts, builds the composition, renders frame 0, flags ready for capture.
  K.start = async (cfg, build) => {
    Object.assign(K, cfg || {});
    window.__meta = { T: K.T, fps: K.fps, W: K.W, H: K.H, engine: gsap.isMini ? 'mini' : 'gsap ' + gsap.version };
    await document.fonts.ready;
    await build();
    await document.fonts.ready;
    window.__seek(0);
    window.__ready = true;
  };

  // ------------------------------------------------------------------ math
  K.clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  K.lerp = (a, b, p) => a + (b - a) * p;
  K.prog = (t, a, b) => K.clamp((t - a) / (b - a));
  K.ease = n => gsap.parseEase(n);
  K.hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  K.rng = seed => { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  K.cyc = (t, k = 1) => 2 * Math.PI * k * t / K.T;          // loop-safe phase: k whole cycles per composition
  K.pulse = (t, t0, d = 0.6) => (t < t0 || t > t0 + d ? 0 : Math.sin(Math.PI * (t - t0) / d)); // 0→1→0 bump
  K.decay = (t, t0, tau = 0.2) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));
  const hx = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  K.mix = (a, b, p) => { const A = hx(a), B = hx(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * K.clamp(p))).join(',')})`; };
  // colour ramp: stops [[0,'#hex'], [0.5,'#hex'], [1,'#hex']] -> rgb() at p
  K.ramp = (stops, p) => { p = K.clamp(p); let i = 0; while (i < stops.length - 2 && p > stops[i + 1][0]) i++; const [a, ca] = stops[i], [b, cb] = stops[i + 1]; return K.mix(ca, cb, (p - a) / ((b - a) || 1)); };
  // static film grain (generated once, seeded): stops gradient banding without bloating the encode
  K.grain = (el, { opacity = 0.07, seed = 11 } = {}) => {
    el = typeof el === 'string' ? K.$(el) : el;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), im = g.createImageData(256, 256), R = K.rng(seed);
    for (let i = 0; i < 65536; i++) { const v = Math.max(0, Math.min(255, 128 + (R() + R() + R() - 1.5) * 90)); im.data.set([v, v, v, 255], i * 4); }
    g.putImageData(im, 0, 0);
    el.style.backgroundImage = `url(${c.toDataURL()})`;
    el.style.opacity = opacity;
  };

  // ------------------------------------------------------------------ DOM
  K.$ = (s, r = document) => r.querySelector(s);
  K.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  K.html = s => { const d = document.createElement('div'); d.innerHTML = s.trim(); return d.firstElementChild; };
  K.mount = (parent, s) => (typeof parent === 'string' ? K.$(parent) : parent).appendChild(K.html(s));
  K.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  K.text = (el, fn) => K.frame(t => { const s = String(fn(t)); if (el.textContent !== s) el.textContent = s; });
  K.style = (el, fn) => K.frame(t => Object.assign(el.style, fn(t)));
  K.num = (v, { dec = 0, sep = true, pre = '', suf = '' } = {}) => {
    const s = (+v).toFixed(dec);
    return pre + (sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : s) + suf;
  };

  // ------------------------------------------------------------------ scenes
  // kit.scene(id, s0, s1, (tl, el, dur) => {...}) — a section shown on [s0, s1); its tweens use LOCAL time.
  // options: fade = fade-in seconds before s0; fadeOut = [a, b] fade to 0 between a and b (use on the last scene: [T-0.65, T-0.15])
  K.scenes = [];
  K.scene = (id, s0, s1, build, { fade = 0, fadeOut = null } = {}) => {
    const el = document.getElementById(id) || K.mount('#world', `<section class="scene" id="${id}"></section>`);
    el.style.display = 'none';
    const tl = gsap.timeline();
    build(tl, el, s1 - s0);
    K.tl.add(tl, s0);
    K.scenes.push({ id, s0, s1, el });
    K.frame(t => {
      const on = t >= s0 - fade && t < s1;
      el.style.display = on ? '' : 'none';
      let o = 1;
      if (fade) o = Math.min(o, K.prog(t, s0 - fade, s0));
      if (fadeOut) o = Math.min(o, 1 - K.prog(t, fadeOut[0], fadeOut[1]));
      el.style.opacity = on ? o.toFixed(3) : 0;
    });
    return el;
  };
  // The opening scene doubles as the loop target. It runs on its own paused timeline, seeked at t for its first `dur`
  // seconds and at t - T during the last `tail` seconds, where it fades in already at its first frame. Frame T then
  // equals frame 0 exactly. Call it FIRST (before scenes that read its proxies). Its tweens use local time from 0.
  K.hookScene = (id, dur, build, { tail = 0.65, fade = 0.5 } = {}) => {
    const el = document.getElementById(id) || K.mount('#world', `<section class="scene" id="${id}"></section>`);
    const tl = gsap.timeline({ paused: true });
    build(tl, el, dur);
    const a = K.T - tail;
    hooks.unshift(t => {                                   // runs before every other frame hook, so they can read its proxies
      tl.seek(t >= a ? t - K.T : t);
      const on = t < dur || t >= a;
      el.style.display = on ? '' : 'none';
      el.style.opacity = t >= a ? K.prog(t, a, a + fade).toFixed(3) : 1;
    });
    K.scenes.push({ id, s0: 0, s1: dur, el, hook: true });
    return { el, tl, loopAt: a };
  };

  // ------------------------------------------------------------------ captions (word-pop, Shorts style)
  // cues: [[start, end, "WORDS WITH *YELLOW ~BLUE !RED MARKERS"], ...]. First word is on screen at frame 0.
  K.captions = (cues, { top = 1085, height = 315, maxW = 960, size = 100, lines = 3 } = {}) => {
    const box = K.mount('#app', `<div class="captions" style="top:${top}px;height:${height}px"></div>`);
    const CL = { '*': 'y', '~': 'b', '!': 'r' };
    const items = cues.map(([s0, s1, text], ci) => {
      const words = text.trim().split(/\s+/).map(tok => {
        const k = '*~!'.includes(tok[0]) && tok.length > 1 ? tok[0] : '';
        return { w: k ? tok.slice(1) : tok, k };
      });
      const div = document.createElement('div');
      div.className = 'cap';
      div.innerHTML = words.map(o => `<span class="w ${o.k ? CL[o.k] : ''}">${K.esc(o.w)}</span>`).join(' ');
      box.appendChild(div);
      let fs = size;
      div.style.fontSize = fs + 'px';
      const nlines = () => new Set([...div.children].map(c => c.offsetTop)).size;
      while ((nlines() > lines || div.scrollWidth > maxW) && fs > 56) { fs = Math.floor(fs * 0.92); div.style.fontSize = fs + 'px'; }
      div.style.display = 'none';
      const nchar = words.reduce((a, o) => a + o.w.length + 1, 0);
      const speak = Math.min(0.8 * (s1 - s0), 0.30 * words.length + 0.08);
      let cum = 0;
      const tw = words.map((o, i) => { const v = ci === 0 && i === 0 ? -0.2 : s0 + speak * cum / nchar; cum += o.w.length + 1; return v; });
      return { s0, s1, div, spans: [...div.children], tw };
    });
    const pop = K.ease('back.out(2.4)'), out = K.ease('power2.out');
    let cur = null;
    K.frame(t => {
      let it = items.find(c => t >= c.s0 && t < c.s1);
      if (!it) it = t < items[0].s0 ? items[0] : items[items.length - 1];
      if (cur !== it) { if (cur) cur.div.style.display = 'none'; it.div.style.display = ''; cur = it; }
      it.spans.forEach((sp, i) => {
        const dt = t - it.tw[i];
        if (dt < 0) { sp.style.opacity = 0; return; }
        const p = Math.min(1, dt / 0.16);
        sp.style.opacity = Math.min(1, dt / 0.07).toFixed(3);
        sp.style.transform = `translateY(${(14 * (1 - out(p))).toFixed(2)}px) scale(${(0.62 + 0.38 * pop(p)).toFixed(4)})`;
      });
    });
    return items;
  };

  // ------------------------------------------------------------------ camera + flashes
  // impacts: [[t, strength 0-1]] shake + punch; kicks: scene-cut zoom kicks; pushes: [[t0, t1, amount]] slow push-in
  K.camera = (el, { impacts = [], kicks = [], pushes = [], origin = [540, 700] } = {}) => {
    el = typeof el === 'string' ? K.$(el) : el;
    el.style.transformOrigin = `${origin[0]}px ${origin[1]}px`;
    const o3 = K.ease('power3.out'), io = K.ease('power2.inOut');
    K.frame(t => {
      let z = 1, dx = 0, dy = 0;
      for (const s0 of kicks) if (t >= s0 && t < s0 + 0.25) z *= 1 + 0.035 * (1 - o3((t - s0) / 0.25));
      for (const [a, b, amt] of pushes) if (t >= a && t < b) z *= 1 + amt * io(K.prog(t, a, b));
      for (const [ti, s] of impacts) if (t >= ti && t < ti + 0.7) {
        const k = Math.exp(-(t - ti) / 0.10), ang = K.hash(Math.round(t * K.fps), ti * 100) * 2 * Math.PI;
        dx += Math.cos(ang) * 24 * s * k; dy += Math.sin(ang) * 24 * s * k;
        z *= 1 + 0.04 * s * Math.exp(-(t - ti) / 0.15);
      }
      el.style.transform = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) scale(${z.toFixed(5)})`;
    });
  };
  // flashes: [[t, dur, color, peakOpacity]]
  K.flashes = (el, list) => {
    el = typeof el === 'string' ? K.$(el) : el;
    K.frame(t => {
      let a = 0, col = '#fff';
      for (const [ti, d, c, amt] of list) if (t >= ti && t < ti + d) { const v = amt * (1 - (t - ti) / d); if (v > a) { a = v; col = c; } }
      el.style.background = col; el.style.opacity = a.toFixed(3);
    });
  };

  // ------------------------------------------------------------------ text helpers (SplitText-lite + FX)
  // split(el, 'chars'|'words', {mask}) -> array of spans; with mask, each piece sits in an overflow:hidden wrapper
  // so you can reveal it GSAP-style: tl.from(parts, {yPercent: 110, stagger: 0.03, ease: 'expo.out'})
  K.split = (el, type = 'chars', { mask = false } = {}) => {
    const txt = el.textContent;
    el.textContent = '';
    const parts = type === 'words' ? txt.split(/(\s+)/) : [...txt];
    const out = [];
    for (const p of parts) {
      if (/^\s+$/.test(p)) { el.appendChild(document.createTextNode(type === 'words' ? ' ' : ' ')); continue; }
      const s = document.createElement('span');
      s.className = type === 'words' ? 'k-wd' : 'k-ch';
      s.textContent = p === ' ' ? ' ' : p;
      if (mask) { const m = document.createElement('span'); m.className = 'k-mask'; m.appendChild(s); el.appendChild(m); }
      else el.appendChild(s);
      out.push(s);
    }
    return out;
  };
  K.scramble = (final, p, t, cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', hz = 20) => {
    const n = Math.floor(K.clamp(p) * final.length + 1e-6);
    let s = final.slice(0, n);
    for (let i = n; i < final.length; i++) s += final[i] === ' ' ? ' ' : cs[Math.floor(K.hash(Math.floor(t * hz), i + 1) * cs.length)];
    return s;
  };
  K.type = (final, p, caret = '') => final.slice(0, Math.round(K.clamp(p) * final.length)) + caret;
  // Split-flap board (Kokonut "Split Flap Text"): chars cycle and settle left→right between t0 and t1
  K.flaps = (el, text, t0, t1, { cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', hz = 16 } = {}) => {
    el.innerHTML = [...text].map(c => (c === ' ' ? '<span class="flap gap"></span>' : `<span class="flap"><b></b></span>`)).join('');
    const cells = [...el.children].map((c, i) => ({ c, b: c.querySelector('b'), ch: text[i] }));
    K.frame(t => cells.forEach((o, i) => {
      if (!o.b) return;
      const settle = t0 + (t1 - t0) * (i + 1) / cells.length;
      const step = Math.floor(t * hz);
      const ch = t >= settle ? o.ch : cs[Math.floor(K.hash(step, i + 3) * cs.length)];
      if (o.b.textContent !== ch) o.b.textContent = ch;
      const ph = t >= settle ? K.decay(t, settle, 0.06) : (t * hz) % 1;
      o.b.style.transform = `scaleY(${(1 - 0.35 * Math.max(0, 1 - ph * 3) * (t >= t0 ? 1 : 0)).toFixed(3)})`;
    }));
  };
  // Glitch text (Kokonut "Glitch Text"): RGB-split slices during [a, b] windows. Element needs class "glitch" + data-text.
  K.glitch = (el, windows, amt = 14) => {
    el.dataset.text = el.textContent;
    K.frame(t => {
      const on = windows.some(([a, b]) => t >= a && t < b);
      const f = Math.floor(t * K.fps);
      const r = i => K.hash(f, i);
      el.style.setProperty('--gx', on ? `${((r(1) - .5) * 2 * amt).toFixed(1)}px` : '0px');
      el.style.setProperty('--g1t', on ? `${(r(2) * 70).toFixed(0)}%` : '0%');
      el.style.setProperty('--g1b', on ? `${(r(3) * 25).toFixed(0)}%` : '100%');
      el.style.setProperty('--g2t', on ? `${(r(4) * 25).toFixed(0)}%` : '0%');
      el.style.setProperty('--g2b', on ? `${(r(5) * 70).toFixed(0)}%` : '100%');
      el.style.transform = on && r(6) > .6 ? `translateX(${((r(7) - .5) * amt).toFixed(1)}px) skewX(${((r(8) - .5) * 8).toFixed(1)}deg)` : '';
    });
  };

  // ------------------------------------------------------------------ backgrounds (all loop-safe over K.T)
  K.bgDots = (el, { gap = 36, drift = 1, alpha = 0.10 } = {}) => {
    el = typeof el === 'string' ? K.$(el) : el;
    el.style.setProperty('--dot-a', alpha);
    el.style.backgroundSize = `${gap}px ${gap}px`;
    K.frame(t => { const o = (t / K.T) * gap * drift; el.style.backgroundPosition = `${(o % gap).toFixed(2)}px ${((o * 2) % gap).toFixed(2)}px`; });
  };
  // glows: [{x, y, r, c, ax, ay, k, a}] — cheap radial-gradient blobs that orbit k whole cycles per loop
  K.bgGlows = (el, list) => {
    el = typeof el === 'string' ? K.$(el) : el;
    const ds = list.map(g => {
      const d = K.mount(el, `<div class="glow" style="width:${g.r * 2}px;height:${g.r * 2}px;left:${g.x - g.r}px;top:${g.y - g.r}px;--c:${g.c};opacity:${g.a == null ? .5 : g.a}"></div>`);
      return { d, g };
    });
    K.frame(t => ds.forEach(({ d, g }, i) => {
      const ph = K.cyc(t, g.k || 1) + i * 1.7;
      d.style.transform = `translate(${(Math.cos(ph) * (g.ax || 0)).toFixed(1)}px,${(Math.sin(ph) * (g.ay || 0)).toFixed(1)}px)`;
    }));
    return ds.map(o => o.d);
  };
  K.canvas = (parent, cls = 'layer') => {
    const c = K.mount(parent, `<canvas class="${cls}" width="${K.W}" height="${K.H}"></canvas>`);
    return { c, g: c.getContext('2d') };
  };
  // drifting particles (snow, embers, dust): m whole screen-heights per loop so they wrap seamlessly
  K.bgParticles = (parent, { n = 60, color = '#fff', size = [2, 6], m = 1, dir = 1, alpha = 0.5, wobble = 18, seed = 3, show = () => 1 } = {}) => {
    const { c, g } = K.canvas(parent);
    const R = K.rng(seed);
    const ps = Array.from({ length: n }, () => ({ x: R() * K.W, y: R() * K.H, s: size[0] + R() * (size[1] - size[0]), k: 1 + Math.floor(R() * 3), ph: R() * 6.28, a: 0.3 + R() * 0.7, sp: m * (1 + Math.floor(R() * 2)) }));
    K.frame(t => {
      g.clearRect(0, 0, K.W, K.H);
      const vis = show(t);
      if (vis <= 0) return;
      for (const p of ps) {
        const y = (((p.y + dir * p.sp * K.H * t / K.T) % K.H) + K.H) % K.H;
        const x = p.x + Math.sin(K.cyc(t, p.k) + p.ph) * wobble;
        g.globalAlpha = alpha * p.a * vis;
        g.fillStyle = typeof color === 'function' ? color(t, p) : color;
        g.beginPath(); g.arc(x, y, p.s, 0, 6.2832); g.fill();
      }
      g.globalAlpha = 1;
    });
    return c;
  };
  // Kokonut "Background Paths": flowing curves with travelling highlights
  K.bgPaths = (parent, { n = 18, color = '255,255,255', alpha = 0.10, width = 2, seed = 5, show = () => 1 } = {}) => {
    const { c, g } = K.canvas(parent);
    const R = K.rng(seed);
    const P = Array.from({ length: n }, (_, i) => ({ y0: -200 + i * (K.H + 400) / n, amp: 120 + R() * 220, k: 1 + Math.floor(R() * 2), ph: R() * 6.28, w: width * (0.6 + R()) }));
    K.frame(t => {
      g.clearRect(0, 0, K.W, K.H);
      const vis = show(t);
      if (vis <= 0) return;
      for (const p of P) {
        g.beginPath();
        for (let x = -40; x <= K.W + 40; x += 30) {
          const y = p.y0 + Math.sin(x / 260 + p.ph + K.cyc(t, p.k)) * p.amp * 0.35 + (x - K.W / 2) * 0.35;
          x === -40 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.lineWidth = p.w;
        g.strokeStyle = `rgba(${color},${alpha * vis})`;
        g.setLineDash([]); g.stroke();
        g.strokeStyle = `rgba(${color},${Math.min(1, alpha * 3.5) * vis})`;
        g.setLineDash([140, 900]); g.lineDashOffset = -((t / K.T) * 1040 * p.k * 2) % 1040;
        g.stroke();
      }
      g.setLineDash([]);
    });
    return c;
  };

  // ------------------------------------------------------------------ icons (24×24 stroke icons, lucide-like style)
  const IC = {
    snowflake: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3.6 10.6l3.4.9-.9 3.4M20.4 13.4l-3.4-.9.9-3.4M6.1 9.9l.9 3.4-3.4.9M17.9 14.1l-.9-3.4 3.4-.9"/>',
    thermometer: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-6.8 0-3.9-2.6-6.1-3.7-9.2-1 1.8-2 2.9-3.3 3.4.4-2.5-.4-4.9-2.3-7.4-.2 4.1-5.7 6.6-5.7 13.2C4 19.3 7.6 22 12 22z"/>',
    wifi: '<path d="M2 8.5a15 15 0 0 1 20 0M5.2 12a10 10 0 0 1 13.6 0M8.6 15.4a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1"/>',
    store: '<path d="M3 9l1.6-5h14.8L21 9M3 9h18M4 9v11h16V9M9.5 20v-6h5v6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    factory: '<path d="M2 21V10l6 4v-4l6 4V5h3l1 3h4v13H2z"/><path d="M6 17h2M11 17h2M16 17h2"/>',
    fridge: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M8.5 5v2.5M8.5 13v3"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    crosshair: '<circle cx="12" cy="12" r="9"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c2.8 3 4.3 6.4 4.3 10S14.8 19 12 22c-2.8-3-4.3-6.4-4.3-10S9.2 5 12 2z"/>',
    lock: '<rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.7"/>',
    alert: '<path d="M12 3L2 21h20L12 3z"/><path d="M12 10v5M12 18v.01"/>',
    zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    server: '<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 9.5h5v5h-5zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5l8-3z"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    terminal: '<path d="M4 17l6-5-6-5M12 19h8"/>',
    cloud: '<path d="M7 18h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 11.4 3.4 3.4 0 0 0 7 18z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M8.5 13.5v1M15.5 13.5v1M9 17.5h6"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    cart: '<path d="M3 4h2l2.4 11h11l2-8H6.3"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
    power: '<path d="M12 2v10M6.3 6.3a8 8 0 1 0 11.4 0"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    package: '<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/>',
  };
  K.icon = (name, { size = 48, sw = 2, color = 'currentColor', cls = '' } = {}) =>
    `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${IC[name] || ''}</svg>`;
  K.icons = Object.keys(IC);

  // SVG progress ring (Kokonut "Apple Activity Card"/"Spending Ring"): returns {el, arc}; animate arc with drawSVG
  K.ring = (size = 300, sw = 28, color = 'var(--accent)', track = 'rgba(255,255,255,.08)') => {
    const r = (size - sw) / 2;
    const el = K.html(`<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${track}" stroke-width="${sw}" fill="none"/>
      <circle class="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round"/></svg>`);
    return { el, arc: el.querySelector('.arc') };
  };
})();
