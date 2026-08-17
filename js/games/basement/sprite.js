/**
 * Pixel-art engine.
 *
 * A sprite is authored as an array of equal-length strings; each character is a
 * key into a palette object, and '.' means transparent. Everything is baked to
 * an offscreen canvas exactly once, so no string is ever parsed inside a frame.
 *
 * Authoring small (12-20px) and blitting at 2x is deliberate: it keeps the art
 * data tiny and gives the chunky pixel look the whole game is drawn in.
 */

const cache = new Map();

function surface(w, h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}

/**
 * rows -> baked canvas. Pure; call `sprite()` if you want it memoised.
 * A ragged row is padded rather than throwing: one miscounted character in a
 * hand-drawn sprite should cost a warning, not a blank screen.
 */
export function bake(rows, pal){
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  if (rows.some(r => r.length !== w)){
    console.warn('[sprite] ragged rows, padded to', w, rows);
    rows = rows.map(r => r.padEnd(w, '.'));
  }
  const { c, g } = surface(w, h);
  for (let y = 0; y < h; y++){
    const row = rows[y];
    for (let x = 0; x < w; x++){
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return { c, w, h };
}

/** Memoised bake. `key` must be unique per (rows, palette) pair. */
export function sprite(key, rows, pal){
  let s = cache.get(key);
  if (!s){ s = bake(rows, pal); cache.set(key, s); }
  return s;
}

/** A flat-colour stamp of a sprite — used for hit flashes and shadows. */
export function silhouette(s, colour){
  const key = '__sil:' + colour + ':' + s.w + 'x' + s.h + ':' + spriteId(s);
  let out = cache.get(key);
  if (out) return out;
  const { c, g } = surface(s.w, s.h);
  g.drawImage(s.c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = colour;
  g.fillRect(0, 0, s.w, s.h);
  out = { c, w: s.w, h: s.h };
  cache.set(key, out);
  return out;
}

/** A recoloured copy, `amount` 0..1 blended over the original. */
export function tinted(s, colour, amount = 1){
  const key = '__tint:' + colour + ':' + amount + ':' + spriteId(s);
  let out = cache.get(key);
  if (out) return out;
  const { c, g } = surface(s.w, s.h);
  g.drawImage(s.c, 0, 0);
  g.globalAlpha = amount;
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = colour;
  g.fillRect(0, 0, s.w, s.h);
  out = { c, w: s.w, h: s.h };
  cache.set(key, out);
  return out;
}

let nextId = 1;
const ids = new WeakMap();
function spriteId(s){
  let id = ids.get(s);
  if (!id){ id = nextId++; ids.set(s, id); }
  return id;
}

/**
 * Blit a sprite centred on (x, y).
 * Centring rather than top-left anchoring means every entity's position is its
 * middle, which is what all the collision code wants anyway.
 */
export function draw(ctx, s, x, y, opts = {}){
  if (!s) return;
  const {
    scale = 2, flip = false, flipY = false, alpha = 1, rot = 0,
    tint = null, tintAmount = 1, anchorY = 0.5, shadow = false
  } = opts;

  const w = s.w * scale, h = s.h * scale;
  const img = tint ? tinted(s, tint, tintAmount) : s;

  ctx.save();
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (rot) ctx.rotate(rot);
  if (flip || flipY) ctx.scale(flip ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(img.c, Math.round(-w / 2), Math.round(-h * anchorY), w, h);
  ctx.restore();

  if (shadow) drawShadow(ctx, x, y + h * (1 - anchorY) - scale, w * 0.42);
}

/** Soft elliptical ground shadow. Sells the "standing on a floor" read. */
export function drawShadow(ctx, x, y, rx, alpha = 0.3){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Build a palette from an array of colours mapped onto '1','2','3',… */
export function pal(...colours){
  const p = {};
  colours.forEach((c, i) => { p[String(i + 1)] = c; });
  return p;
}

/**
 * Compose several sprites into one baked sheet, e.g. a body plus a head.
 * layers: [{ s, dx, dy, tint }] measured from the top-left of the output.
 */
export function compose(key, w, h, layers){
  let out = cache.get(key);
  if (out) return out;
  const { c, g } = surface(w, h);
  for (const l of layers){
    if (!l || !l.s) continue;
    const img = l.tint ? tinted(l.s, l.tint, l.tintAmount ?? 1) : l.s;
    g.drawImage(img.c, l.dx | 0, l.dy | 0);
  }
  out = { c, w, h };
  cache.set(key, out);
  return out;
}

/** Nearest-neighbour everywhere; call once per context. */
export function crisp(ctx){
  ctx.imageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
}
