// Tiny DOM + lifecycle helpers shared by every game.
export function el(tag, props = {}, ...kids){
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)){
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()){
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return n;
}

/** Collects timers/listeners so a game can be torn down cleanly on route change. */
export class Life {
  constructor(){ this.timers = new Set(); this.rafs = new Set(); this.offs = []; this.dead = false; }
  after(fn, ms){ const id = setTimeout(() => { this.timers.delete(id); if (!this.dead) fn(); }, ms); this.timers.add(id); return id; }
  every(fn, ms){ const id = setInterval(() => { if (!this.dead) fn(); }, ms); this.timers.add(id); return id; }
  clear(id){ clearTimeout(id); clearInterval(id); this.timers.delete(id); }
  frame(fn){
    const step = (t) => { if (this.dead) return; const again = fn(t); if (again !== false){ const id = requestAnimationFrame(step); this.rafs.add(id); } };
    const id = requestAnimationFrame(step); this.rafs.add(id); return id;
  }
  on(target, ev, fn, opts){ target.addEventListener(ev, fn, opts); this.offs.push(() => target.removeEventListener(ev, fn, opts)); }
  kill(){
    this.dead = true;
    this.timers.forEach(id => { clearTimeout(id); clearInterval(id); });
    this.rafs.forEach(id => cancelAnimationFrame(id));
    this.offs.forEach(f => f());
    this.timers.clear(); this.rafs.clear(); this.offs = [];
  }
}

/** Deterministic PRNG — same seed, same sequence. */
export function seeded(seed){
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/** Today as a stable integer, so "changes every day" means exactly that. */
export const dayKey = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
/** Pick n items deterministically from a list. */
export function seededSample(list, n, seed){
  const rng = seeded(seed);
  return list.map(v => ({ v, r: rng() })).sort((a, b) => a.r - b.r).slice(0, n).map(x => x.v);
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Square cell size for an n-column board, fitted to whatever room the phone
 * (or window) actually has. Keeps dense grids on-screen instead of letting a
 * fixed floor push them off the right edge.
 */
export function cellSize(cols, { gap = 8, maxPx = 110, minPx = 22, sidePad = 30, vFrac = 0.42 } = {}){
  const byWidth = (Math.min(window.innerWidth, 1180) - sidePad - gap * (cols - 1)) / cols;
  const byHeight = (window.innerHeight * vFrac - gap * (cols - 1)) / cols;
  return Math.max(minPx, Math.min(maxPx, Math.floor(Math.min(byWidth, byHeight))));
}
export const rnd = (a, b) => a + Math.random() * (b - a);
export const irnd = (a, b) => Math.floor(rnd(a, b + 1));
export const shuffle = a => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const sample = (a, n) => shuffle(a).slice(0, n);

export function fmt(n, d = 0){
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Standard countdown before a timed game starts. */
export function countdown(stage, life, sfx, done, from = 3){
  const n = el('div', { class:'big', text:String(from) });
  const h = el('div', { class:'hint', text:'get ready' });
  stage.replaceChildren(n, h);
  let i = from;
  sfx.tick();
  const tick = () => {
    i--;
    if (i <= 0){ n.textContent = 'go'; sfx.start(); life.after(done, 380); return; }
    n.textContent = String(i); sfx.tick();
    life.after(tick, 700);
  };
  life.after(tick, 700);
}

/** Simple accuracy → 0..1 helpers */
export const lerp = (a, b, t) => a + (b - a) * t;
