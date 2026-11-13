/* motion.js — GSAP-compatible animation engine for frame-exact video rendering (InteresTech7 Shorts kit).
 *
 * If real GSAP is loaded first (<script src="gsap.min.js">), this file does nothing and the scenes run on GSAP.
 * Otherwise it provides window.gsap with the subset that motion graphics need, using GSAP's API and ease math:
 *   gsap.timeline() .to .from .fromTo .set .add (nested timelines, labels) .addLabel .seek .duration
 *   positions: 2  "<"  ">"  "<0.3"  ">-0.2"  "+=0.5"  "-=0.4"  "label"  "label+=1"  "<25%"
 *   eases: none power1-4 sine expo circ back(o) elastic(a,p) bounce steps(n) + .in/.out/.inOut
 *   stagger: 0.05 | {each|amount, from:"start|center|end|edges|random"|index, grid:[rows,cols], ease}
 *   props: x y xPercent yPercent scale scaleX scaleY rotation skewX skewY opacity autoAlpha
 *          blur brightness saturate contrast grayscale hueRotate, any numeric/color/complex CSS prop,
 *          CSS variables ("--p"), attr:{}, drawSVG:"0% 100%", text:"typewriter", scrambleText:{text,chars},
 *          plain objects (tween numbers on a JS object, then read them in kit.frame)
 *   repeat / yoyo / repeatDelay, function values (i, el, all) => value, onUpdate
 * Every render is a pure function of time: tl.seek(t) gives the exact state at t in any order,
 * so frames can be rendered in parallel chunks. Don't use tl.call() side effects; use kit.frame().
 */
(function () {
  'use strict';
  if (window.gsap) return;

  // ------------------------------------------------------------------ eases (GSAP 3 formulas)
  const PI = Math.PI;
  const fromIn = f => ({ in: f, out: p => 1 - f(1 - p), inOut: p => (p < .5 ? f(p * 2) / 2 : 1 - f((1 - p) * 2) / 2) });
  const fromOut = f => ({ in: p => 1 - f(1 - p), out: f, inOut: p => (p < .5 ? (1 - f(1 - p * 2)) / 2 : .5 + f((p - .5) * 2) / 2) });
  const bounceOut = p => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + .75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + .9375;
    return n * (p -= 2.625 / d) * p + .984375;
  };
  const pw = n => () => fromIn(p => p ** n);
  const FAM = {
    power1: pw(2), power2: pw(3), power3: pw(4), power4: pw(5),
    quad: pw(2), cubic: pw(3), quart: pw(4), quint: pw(5), strong: pw(5),
    sine: () => fromIn(p => 1 - Math.cos(p * PI / 2)),
    expo: () => fromIn(p => (p ? 2 ** (10 * (p - 1)) : 0)),
    circ: () => fromIn(p => 1 - Math.sqrt(Math.max(0, 1 - p * p))),
    back: (s = 1.70158) => fromIn(p => p * p * ((s + 1) * p - s)),
    elastic: (a = 1, per = .3) => {
      const a1 = Math.max(1, a), s = per / (2 * PI) * Math.asin(1 / a1);
      return fromOut(p => (p <= 0 ? 0 : p >= 1 ? 1 : a1 * 2 ** (-10 * p) * Math.sin((p - s) * 2 * PI / per) + 1));
    },
    bounce: () => fromOut(bounceOut),
  };
  const DEF = { duration: .5, ease: 'power1.out' };
  const EC = {};
  function parseEase(e) {
    if (typeof e === 'function') return e;
    if (e == null) e = DEF.ease;
    if (EC[e]) return EC[e];
    let f = p => p;
    const m = /^([a-z]+\d?)(?:\.(in|out|inout))?(?:\(([^)]*)\))?$/i.exec(String(e).replace(/\s+/g, ''));
    if (m) {
      const name = m[1].toLowerCase();
      const type = !m[2] ? 'out' : m[2].toLowerCase() === 'inout' ? 'inOut' : m[2].toLowerCase();
      const args = m[3] ? m[3].split(',').filter(x => x !== '').map(Number) : [];
      if (name === 'steps') { const n = Math.max(1, args[0] || 1); f = p => (p >= 1 ? 1 : Math.floor(p * n) / n); }
      else if (FAM[name]) f = FAM[name](...args)[type];
    }
    return (EC[e] = f);
  }

  // ------------------------------------------------------------------ helpers
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const fx = n => +(+n).toFixed(4);
  const isEl = o => typeof Element !== 'undefined' && o instanceof Element;
  function toArr(t) {
    if (t == null) return [];
    if (typeof t === 'string') return Array.from(document.querySelectorAll(t));
    if (Array.isArray(t) || (typeof NodeList !== 'undefined' && t instanceof NodeList) ||
        (typeof HTMLCollection !== 'undefined' && t instanceof HTMLCollection)) return Array.from(t).flatMap(toArr);
    return [t];
  }

  // ------------------------------------------------------------------ values
  const NUMG = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;
  const NUM1 = /^([-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?)([a-z%]*)$/i;
  let cctx = null;
  function rgba(s) {
    if (!cctx) cctx = document.createElement('canvas').getContext('2d');
    cctx.fillStyle = '#000'; cctx.fillStyle = s;
    const v = cctx.fillStyle;
    if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
    const n = v.match(NUMG).map(Number);
    return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
  }
  const isColor = s => /^(#|rgba?\(|hsla?\()/i.test(s) ||
    (/^[a-z]+$/i.test(s) && !/^(none|auto|inherit|initial|unset|normal|hidden|visible|block|flex|grid|inline|absolute|relative)$/i.test(s) &&
     typeof CSS !== 'undefined' && CSS.supports('color', s));
  function parse(v) {
    if (v && typeof v === 'object' && v.k) return v;
    if (typeof v === 'number') return { k: 'n', n: v, u: '' };
    if (v == null || typeof v === 'boolean' || typeof v === 'object') return { k: 'd', s: v };
    const s = String(v).trim();
    let m = /^([+-])=(.+)$/.exec(s);
    if (m) { const q = NUM1.exec(m[2]) || [0, m[2], '']; return { k: 'r', d: (m[1] === '-' ? -1 : 1) * parseFloat(q[1]), u: q[2] || '' }; }
    m = NUM1.exec(s);
    if (m) return { k: 'n', n: parseFloat(m[1]), u: m[2] };
    if (isColor(s)) return { k: 'c', c: rgba(s) };
    const nums = s.match(NUMG);
    if (nums) return { k: 'x', parts: s.split(NUMG), nums: nums.map(Number) };
    return { k: 'd', s };
  }
  function parseDraw(v) {
    if (v === true) return { k: 'p', a: 0, b: 1 };
    if (typeof v === 'number') return { k: 'p', a: 0, b: v > 1 ? v / 100 : v };
    const s = String(v).trim().split(/\s+/).map(x => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x)));
    return s.length > 1 ? { k: 'p', a: s[0], b: s[1] } : { k: 'p', a: 0, b: s[0] };
  }
  function str(v) {
    switch (v.k) {
      case 'n': return fx(v.n) + v.u;
      case 'c': return `rgba(${Math.round(v.c[0])},${Math.round(v.c[1])},${Math.round(v.c[2])},${fx(v.c[3])})`;
      case 'x': return v.parts.reduce((s, p, i) => s + p + (i < v.nums.length ? fx(v.nums[i]) : ''), '');
      default: return v.s == null ? '' : String(v.s);
    }
  }
  function lerpV(a, b, e, p) {
    if (b.k === 'n') { const an = a.k === 'n' ? a.n : 0; return { k: 'n', n: an + (b.n - an) * e, u: b.u || (a.k === 'n' ? a.u : '') }; }
    if (b.k === 'c') { const ac = a.k === 'c' ? a.c : [b.c[0], b.c[1], b.c[2], 0]; return { k: 'c', c: ac.map((x, i) => x + (b.c[i] - x) * e) }; }
    if (b.k === 'x' && a.k === 'x' && a.nums.length === b.nums.length)
      return { k: 'x', parts: b.parts, nums: a.nums.map((x, i) => x + (b.nums[i] - x) * e) };
    if (b.k === 'p') { const A = a.k === 'p' ? a : { a: 0, b: 1 }; return { k: 'p', a: A.a + (b.a - A.a) * e, b: A.b + (b.b - A.b) * e }; }
    return p > 0 ? b : a;
  }

  // ------------------------------------------------------------------ element state + apply
  const TF = { x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0 };
  const FL = { blur: [0, 'px'], brightness: [1, ''], saturate: [1, ''], contrast: [1, ''], grayscale: [0, ''], hueRotate: [0, 'deg'] };
  const ALIAS = { rotate: 'rotation', rotationZ: 'rotation', alpha: 'opacity' };
  const ST = new WeakMap();
  const st = el => { let s = ST.get(el); if (!s) ST.set(el, (s = { tf: Object.assign({}, TF), fl: {}, len: null })); return s; };
  const TFD = new Set(), FLD = new Set();
  const BASE = new Map();
  function base(t, p) {
    let m = BASE.get(t);
    if (!m) BASE.set(t, (m = new Map()));
    if (m.has(p)) return m.get(p);
    let v;
    if (!isEl(t)) v = p === 'text' || p === 'scrambleText' ? { k: 'd', s: '' } : parse(t[p] == null ? 0 : t[p]);
    else if (p in TF) v = { k: 'n', n: st(t).tf[p], u: '' };
    else if (p in FL) v = { k: 'n', n: st(t).fl[p] == null ? FL[p][0] : st(t).fl[p], u: FL[p][1] };
    else if (p === 'autoAlpha' || p === 'opacity') v = { k: 'n', n: parseFloat(getComputedStyle(t).opacity), u: '' };
    else if (p === 'drawSVG') v = { k: 'p', a: 0, b: 1 };
    else if (p === 'text' || p === 'scrambleText') v = { k: 'd', s: t.textContent };
    else if (p.startsWith('attr:')) v = parse(t.getAttribute(p.slice(5)) == null ? 0 : t.getAttribute(p.slice(5)));
    else if (p.startsWith('--')) v = parse(getComputedStyle(t).getPropertyValue(p).trim() || 0);
    else v = parse(getComputedStyle(t)[p]);
    m.set(p, v);
    return v;
  }
  function apply(t, p, v) {
    if (!isEl(t)) { t[p] = v.k === 'n' ? v.n : v.k === 'd' ? v.s : str(v); return; }
    if (p in TF) { st(t).tf[p] = v.n; TFD.add(t); return; }
    if (p in FL) { st(t).fl[p] = v.n; FLD.add(t); return; }
    if (p === 'autoAlpha') { t.style.opacity = fx(v.n); t.style.visibility = v.n < 1e-3 ? 'hidden' : 'inherit'; return; }
    if (p === 'drawSVG') {
      const s = st(t), L = s.len == null ? (s.len = t.getTotalLength()) : s.len;
      t.style.strokeDasharray = `${fx(Math.max(0, (v.b - v.a) * L))} ${fx(L + 2)}`;
      t.style.strokeDashoffset = fx(-v.a * L);
      return;
    }
    if (p === 'text' || p === 'scrambleText') { const s = v.s == null ? '' : String(v.s); if (t.textContent !== s) t.textContent = s; return; }
    if (p.startsWith('attr:')) { t.setAttribute(p.slice(5), str(v)); return; }
    if (p.startsWith('--')) { t.style.setProperty(p, str(v)); return; }
    t.style[p] = str(v);
  }
  function flush() {
    for (const el of TFD) {
      const f = st(el).tf;
      el.style.transform = `translate(${fx(f.xPercent)}%,${fx(f.yPercent)}%) translate(${fx(f.x)}px,${fx(f.y)}px) ` +
        `rotate(${fx(f.rotation)}deg) skew(${fx(f.skewX)}deg,${fx(f.skewY)}deg) scale(${fx(f.scale * f.scaleX)},${fx(f.scale * f.scaleY)})`;
    }
    TFD.clear();
    for (const el of FLD) {
      const f = st(el).fl;
      el.style.filter = Object.keys(f).map(k => (k === 'hueRotate' ? `hue-rotate(${fx(f[k])}deg)` : `${k}(${fx(f[k])}${FL[k][1]})`)).join(' ');
    }
    FLD.clear();
  }

  // ------------------------------------------------------------------ text effects
  const CHARS = {
    upperCase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lowerCase: 'abcdefghijklmnopqrstuvwxyz',
    upperAndLowerCase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789', hex: '0123456789ABCDEF', binary: '01', symbols: '!<>-_\\/[]{}=+*^?#%$@',
  };
  function scramble(final, e, t, o) {
    const rd = o.revealDelay || 0, pr = Math.min(1, Math.max(0, (e - rd) / ((1 - rd) || 1)));
    const n = Math.floor(pr * final.length + 1e-6);
    if (n >= final.length) return final;
    const cs = CHARS[o.chars] || o.chars || CHARS.upperCase, step = Math.floor(t * 20 * (o.speed || 1));
    let out = final.slice(0, n);
    for (let i = n; i < final.length; i++) out += final[i] === ' ' ? ' ' : cs[Math.floor(hash(step, i + 1) * cs.length)];
    return out;
  }

  // ------------------------------------------------------------------ stagger
  function staggerOffsets(n, s) {
    const z = new Array(n).fill(0);
    if (!s || n < 2) return z;
    if (typeof s === 'number') s = { each: s };
    const from = s.from == null ? 0 : s.from;
    let d;
    if (from === 'random') {
      const idx = [...Array(n).keys()], seed = s.seed == null ? 7 : s.seed;
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(hash(seed, i) * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      d = new Array(n); idx.forEach((v, k) => { d[v] = k; });
    } else if (Array.isArray(s.grid)) {
      const [R, C] = s.grid, rc = i => [Math.floor(i / C), i % C];
      const o = from === 'center' ? [(R - 1) / 2, (C - 1) / 2] : from === 'end' ? [R - 1, C - 1] : typeof from === 'number' ? rc(from) : [0, 0];
      d = [...Array(n).keys()].map(i => { const [r, c] = rc(i); return s.axis === 'x' ? Math.abs(c - o[1]) : s.axis === 'y' ? Math.abs(r - o[0]) : Math.hypot(r - o[0], c - o[1]); });
    } else {
      const c = (n - 1) / 2;
      const o = from === 'center' ? c : from === 'end' ? n - 1 : from === 'edges' ? null : typeof from === 'number' ? from : 0;
      d = [...Array(n).keys()].map(i => (o === null ? c - Math.abs(i - c) : Math.abs(i - o)));
    }
    const mx = Math.max(...d) || 1;
    const each = s.amount != null ? s.amount / mx : (s.each || 0);
    const ez = s.ease ? parseEase(s.ease) : null;
    return d.map(x => (ez ? ez(x / mx) * mx * each : x * each));
  }

  // ------------------------------------------------------------------ tweens + timelines
  let ORD = 0;
  const RESERVED = new Set(['duration', 'ease', 'delay', 'stagger', 'repeat', 'yoyo', 'repeatDelay', 'onUpdate', 'onUpdateParams',
    'onComplete', 'onStart', 'onCompleteParams', 'onStartParams', 'immediateRender', 'overwrite', 'id', 'paused', 'defaults',
    'data', 'callbackScope', 'inherit', 'lazy', 'runBackwards', 'startAt', 'yoyoEase', 'keyframes', 'autoRound']);

  class Tween {
    constructor(type, targets, fromVars, toVars, tl) {
      this.type = type; this.order = ORD++;
      const d = tl ? tl._defaults : {};
      const v = Object.assign({}, d, toVars || {}), f = fromVars || {};
      const cfg = type === 'from' ? Object.assign({}, d, f) : v;
      this.vars = cfg;
      this.targets = toArr(targets);
      this.dur = type === 'set' || type === 'call' ? 0 : (cfg.duration == null ? DEF.duration : cfg.duration);
      this.ease = parseEase(cfg.ease == null ? DEF.ease : cfg.ease);
      this.repeat = cfg.repeat || 0; this.yoyo = !!cfg.yoyo; this.rdelay = cfg.repeatDelay || 0;
      this.delay = cfg.delay || 0;
      this.onUpdate = cfg.onUpdate || null;
      this.immediate = cfg.immediateRender == null ? (type === 'from' || type === 'fromTo') : !!cfg.immediateRender;
      this.offs = staggerOffsets(this.targets.length, cfg.stagger);
      this.props = {};
      const add = (src, key) => {
        for (const k in src) {
          if (RESERVED.has(k)) continue;
          if (k === 'attr') { for (const a in src.attr) (this.props['attr:' + a] = this.props['attr:' + a] || {})[key] = src.attr[a]; continue; }
          const p = ALIAS[k] || k;
          (this.props[p] = this.props[p] || {})[key] = src[k];
        }
      };
      if (type === 'fromTo') { add(f, 'from'); add(toVars || {}, 'to'); }
      else if (type === 'from') add(f, 'from');
      else add(toVars || {}, 'to');
    }
    get span() {
      const one = this.repeat < 0 ? 1e9 : this.dur * (this.repeat + 1) + this.rdelay * this.repeat;
      return one + (this.offs.length ? Math.max(...this.offs) : 0);
    }
    prog(lt) {
      const d = this.dur;
      if (d <= 0) return lt >= 0 ? 1 : 0;
      const cyc = d + this.rdelay;
      let it = Math.floor(lt / cyc), w = lt - it * cyc;
      if (this.repeat >= 0 && it > this.repeat) { it = this.repeat; w = d; }
      let p = Math.min(1, w / d);
      if (this.yoyo && it % 2 === 1) p = 1 - p;
      return p;
    }
    progress() { return this._p || 0; }
    duration() { return this.dur; }
    kill() { this.props = {}; return this; }
  }

  function rawFor(raw, i, tg, all) { return typeof raw === 'function' ? raw(i, tg, all) : raw; }
  function parseFor(p, raw) {
    if (p === 'drawSVG') return parseDraw(raw);
    if (p === 'scrambleText') return raw && typeof raw === 'object' ? { k: 'd', s: String(raw.text), o: raw } : { k: 'd', s: String(raw), o: {} };
    if (p === 'text') return { k: 'd', s: raw && typeof raw === 'object' ? String(raw.value) : String(raw) };
    return parse(raw);
  }

  // value of channel `segs` at time t, using only segs[0..n-1]
  function valueAt(segs, n, t, tg, p) {
    let j = n - 1;
    while (j >= 0 && segs[j].s > t) j--;
    if (j < 0) {
      if (n > 0 && segs[0].tw.immediate && (segs[0].tw.type === 'from' || segs[0].tw.type === 'fromTo' || segs[0].tw.type === 'set'))
        return segFrom(segs, 0, tg, p);
      return base(tg, p);
    }
    const g = segs[j], pr = g.tw.prog(t - g.s), e = g.tw.ease(pr);
    return mix(p, segFrom(segs, j, tg, p), segTo(segs, j, tg, p), e, pr, t);
  }
  function segFrom(segs, j, tg, p) {
    const g = segs[j];
    if (g._from) return g._from;
    const pr = g.tw.props[p];
    if ((g.tw.type === 'from' || g.tw.type === 'fromTo') && pr.from !== undefined) return (g._from = parseFor(p, rawFor(pr.from, g.i, tg, g.tw.targets)));
    return (g._from = valueAt(segs, j, g.s, tg, p));        // a 'to' (or a fromTo prop with no from-value) starts from the current value
  }
  function segTo(segs, j, tg, p) {
    const g = segs[j];
    if (g._to) return g._to;
    if (g.tw.type === 'from' || g.tw.props[p].to === undefined) return (g._to = valueAt(segs, j, g.s, tg, p));
    let v = parseFor(p, rawFor(g.tw.props[p].to, g.i, tg, g.tw.targets));
    if (v.k === 'r') { const a = segFrom(segs, j, tg, p); v = { k: 'n', n: (a.k === 'n' ? a.n : 0) + v.d, u: v.u || (a.k === 'n' ? a.u : '') }; }
    return (g._to = v);
  }
  function mix(p, a, b, e, pr, t) {
    if (p === 'text') { const s = b.s, A = a.s == null ? '' : String(a.s), n = Math.round(e * s.length); return { k: 'd', s: e >= 1 ? s : s.slice(0, n) + A.slice(n) }; }
    if (p === 'scrambleText') return { k: 'd', s: pr <= 0 ? a.s : scramble(b.s, e, t, b.o || {}) };
    return lerpV(a, b, e, pr);
  }

  class Timeline {
    constructor(vars) {
      this.vars = vars || {}; this._defaults = this.vars.defaults || {};
      this.kids = []; this.labels = {}; this.last = null; this.parent = null; this.start = 0; this.order = ORD++;
      this._dirty = true; this._t = 0;
    }
    get span() { return this.duration(); }
    duration() { let d = 0; for (const k of this.kids) d = Math.max(d, k.start + k.span); return d; }
    totalDuration() { return this.duration(); }
    _off(s) {
      if (!s) return 0;
      const m = /^([+-]=?)?(\d*\.?\d+)(%)?$/.exec(s);
      if (!m) return 0;
      let v = parseFloat(m[2]);
      if (m[3]) v = v / 100 * (this.last ? this.last.span : 0);
      return m[1] && m[1][0] === '-' ? -v : v;
    }
    _pos(pos) {
      const end = this.duration();
      if (pos == null) return end;
      if (typeof pos === 'number') return pos;
      const s = String(pos).replace(/\s+/g, '');
      const L = this.last, ls = L ? L.start : end, le = L ? L.start + L.span : end;
      let m = /^([<>])(.*)$/.exec(s);
      if (m) return (m[1] === '<' ? ls : le) + this._off(m[2]);
      m = /^([+-])=(\d*\.?\d+)$/.exec(s);
      if (m) return end + (m[1] === '-' ? -1 : 1) * parseFloat(m[2]);
      m = /^(.+?)(?:([+-])=(\d*\.?\d+))?$/.exec(s);
      if (m && m[1] in this.labels) return this.labels[m[1]] + (m[2] ? (m[2] === '-' ? -1 : 1) * parseFloat(m[3]) : 0);
      return end;
    }
    _push(c, pos) {
      c.start = Math.max(0, this._pos(pos) + (c.delay || 0));
      c.parent = this; this.kids.push(c); this.last = c; this._touch();
      return this;
    }
    _touch() { let r = this; while (r) { r._dirty = true; r = r.parent; } }
    to(t, v, pos) { return this._push(new Tween('to', t, null, v, this), pos); }
    from(t, v, pos) { return this._push(new Tween('from', t, v, null, this), pos); }
    fromTo(t, a, b, pos) { return this._push(new Tween('fromTo', t, a, b, this), pos); }
    set(t, v, pos) { return this._push(new Tween('set', t, null, Object.assign({}, v, { duration: 0 }), this), pos); }
    add(x, pos) {
      if (typeof x === 'string') return this.addLabel(x, pos);
      if (x instanceof Timeline || x instanceof Tween) return this._push(x, pos);
      if (Array.isArray(x)) { const p0 = this._pos(pos); x.forEach(c => this.add(c, p0)); return this; }
      return this;
    }
    addLabel(n, pos) { this.labels[n] = this._pos(pos); return this; }
    call(fn, params, pos) { return this.addLabel('__call' + ORD++, pos); }   // side effects aren't frame-exact: use kit.frame()
    _flat(off, out) { for (const k of this.kids) { if (k instanceof Timeline) k._flat(off + k.start, out); else out.push([k, off + k.start]); } return out; }
    _build() {
      const ch = new Map(); this._upd = [];
      for (const [tw, abs] of this._flat(0, [])) {
        if (tw.onUpdate) this._upd.push([tw, abs]);
        tw.targets.forEach((tg, i) => {
          let m = ch.get(tg);
          if (!m) ch.set(tg, (m = new Map()));
          for (const p in tw.props) {
            let a = m.get(p);
            if (!a) m.set(p, (a = []));
            a.push({ tw, i, s: abs + tw.offs[i] });
          }
        });
      }
      for (const m of ch.values()) for (const a of m.values()) a.sort((x, y) => x.s - y.s || x.tw.order - y.tw.order);
      this._ch = ch; this._dirty = false;
    }
    _render(t) {
      if (this._dirty) this._build();
      this._t = t;
      for (const [tg, m] of this._ch) for (const [p, segs] of m) apply(tg, p, valueAt(segs, segs.length, t, tg, p));
      flush();
      for (const [tw, abs] of this._upd) if (t >= abs) { tw._p = tw.prog(t - abs); tw.onUpdate.apply(tw, tw.vars.onUpdateParams || []); }
    }
    seek(t) { this._render(typeof t === 'string' ? (this.labels[t] || 0) : t); return this; }
    time(t) { return t === undefined ? this._t : this.seek(t); }
    progress(p) { return p === undefined ? this._t / (this.duration() || 1) : this.seek(p * this.duration()); }
    totalTime(t) { return this.time(t); }
    play() { return this; } pause() { return this; } paused() { return true; } restart() { return this.seek(0); }
    invalidate() { BASE.clear(); this._touch(); return this; }
    getChildren() { return this.kids.slice(); }
    kill() { this.kids = []; this._touch(); return this; }
  }

  // ------------------------------------------------------------------ gsap facade
  const globalTimeline = new Timeline();
  function setNow(targets, vars) {
    const tw = new Tween('set', targets, null, vars, null);
    tw.targets.forEach((tg, i) => {
      for (const p in tw.props) {
        const v = parseFor(p, rawFor(tw.props[p].to, i, tg, tw.targets));
        const val = v.k === 'r' ? { k: 'n', n: (base(tg, p).n || 0) + v.d, u: v.u } : v;
        apply(tg, p, val);
        let m = BASE.get(tg); if (!m) BASE.set(tg, (m = new Map()));
        m.set(p, val);
      }
    });
    flush();
    return tw;
  }
  const utils = {
    toArray: toArr,
    clamp: (a, b, v) => (v === undefined ? x => Math.min(b, Math.max(a, x)) : Math.min(b, Math.max(a, v))),
    mapRange: (a, b, c, d, v) => { const f = x => c + (d - c) * (x - a) / (b - a); return v === undefined ? f : f(v); },
    interpolate: (a, b, p) => a + (b - a) * p,
    wrap: (a, b, v) => { const r = b - a; const f = x => a + ((((x - a) % r) + r) % r); return v === undefined ? f : f(v); },
    snap: (s, v) => (v === undefined ? x => Math.round(x / s) * s : Math.round(v / s) * s),
  };
  window.gsap = {
    version: 'mini-2.0', isMini: true, utils, globalTimeline,
    timeline: v => new Timeline(v),
    parseEase,
    defaults: v => (v ? Object.assign(DEF, v) : DEF),
    registerPlugin() {}, registerEase(n, f) { EC[n] = f; },
    set: setNow,
    to: (t, v) => { globalTimeline.to(t, v, 0); return globalTimeline.last; },
    from: (t, v) => { globalTimeline.from(t, v, 0); return globalTimeline.last; },
    fromTo: (t, a, b) => { globalTimeline.fromTo(t, a, b, 0); return globalTimeline.last; },
    getProperty: (t, p) => { const el = toArr(t)[0]; if (!el) return undefined; const v = base(el, ALIAS[p] || p); return v.k === 'n' ? v.n : str(v); },
  };
})();
