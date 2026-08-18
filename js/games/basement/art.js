/**
 * World art: floor themes, tiles, obstacles, doors, pickups, projectiles and
 * the item-icon builder.
 *
 * Tiles and walls are generated procedurally from a seeded noise so every floor
 * theme gets its own stone without shipping a texture; everything an entity
 * needs is hand-authored pixel art. All of it is original.
 */
import { sprite, bake, pal, compose } from './sprite.js';

export const CELL = 32;            // one grid cell, in virtual pixels
export const GRID_W = 13;
export const GRID_H = 7;
export const WALL = 32;
export const HUD_H = 48;
export const ROOM_X = WALL;
export const ROOM_Y = HUD_H + WALL;
export const ROOM_W = GRID_W * CELL;   // 416
export const ROOM_H = GRID_H * CELL;   // 224
export const VW = ROOM_W + WALL * 2;   // 480
export const VH = HUD_H + ROOM_H + WALL * 2; // 336

/* ------------------------------------------------------------------ */
/* themes                                                              */
/* ------------------------------------------------------------------ */
/** One entry per floor depth. `floor`/`wall` are [dark, mid, light]. */
export const THEMES = {
  cellar:  { name:'the cellar',   style:'plank', floor:['#5a3a26','#7a5236','#9a6b47'], wall:['#331f16','#4a2c1e','#633d2a'], accent:'#c98f4a', liquid:null },
  burrow:  { name:'the burrow',   style:'plank', floor:['#4a2e22','#63402d','#7d543c'], wall:['#2a1812','#3d2419','#523225'], accent:'#a8703c', liquid:null },
  caves:   { name:'the caves',    style:'stone', floor:['#4b5560','#5d6a77','#72808e'], wall:['#242b33','#333d47','#46525e'], accent:'#8fb0c9', liquid:null },
  sump:    { name:'the sump',     style:'stone', floor:['#33544c','#3f6960','#4d7f74'], wall:['#1b2f2b','#284440','#365a53'], accent:'#63c7a6', liquid:'#2e6f63' },
  depths:  { name:'the depths',   style:'stone', floor:['#3a3348','#4a4159','#5b506d'], wall:['#1e1a28','#2d2739','#3d354c'], accent:'#9b7ed6', liquid:null },
  mire:    { name:'the mire',     style:'stone', floor:['#4d2f30','#61393a','#764648'], wall:['#2a1719','#3d2022','#502b2d'], accent:'#d06a6a', liquid:'#5c2426' },
  hollow:  { name:'the hollow',   style:'flesh', floor:['#6e3a45','#874854','#a15866'], wall:['#3e1e26','#552a34','#6b3742'], accent:'#ff8fa3', liquid:null },
  vault:   { name:'the vault',    style:'stone', floor:['#5a4a2c','#6f5c37','#877043'], wall:['#2f2716','#453a21','#5b4c2c'], accent:'#ffd166', liquid:null },
  core:    { name:'the core',     style:'stone', floor:['#2b2b33','#3a3a44','#4b4b57'], wall:['#141418','#202027','#2e2e37'], accent:'#e8e8f0', liquid:null }
};

/* deterministic value noise so a tile looks the same every time it is baked */
function noise(seed){
  let s = (seed >>> 0) || 7;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const surf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
};

const tileCache = new Map();

export const FLOOR_VARIANTS = 8;

/**
 * Floorboards: horizontal boards with grain, seams and the odd nail.
 * A cellar is built out of timber, and stone flags there always read wrong.
 */
function plankFloor(g, t, rng){
  g.fillStyle = t.floor[0];
  g.fillRect(0, 0, CELL, CELL);
  const BH = 11;                         // board height
  for (let y = -((rng() * BH) | 0); y < CELL; y += BH){
    const tone = rng();
    g.fillStyle = mix(t.floor[1], tone > 0.5 ? t.floor[2] : t.floor[0], Math.abs(tone - 0.5) * 0.7);
    g.fillRect(0, y, CELL, BH - 1);
    // grain: long, low-contrast streaks along the board
    for (let i = 0; i < 5; i++){
      g.globalAlpha = 0.06 + rng() * 0.1;
      g.fillStyle = rng() > 0.5 ? t.floor[0] : t.floor[2];
      const gy = y + 1 + ((rng() * (BH - 3)) | 0);
      const gx = (rng() * CELL) | 0;
      g.fillRect(gx, gy, 3 + ((rng() * 12) | 0), 1);
    }
    // a knot in the timber now and then
    if (rng() > 0.86){
      g.globalAlpha = 0.3;
      g.fillStyle = t.floor[0];
      g.beginPath();
      g.ellipse((rng() * CELL) | 0, y + BH / 2, 2.2, 1.4, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // seam: dark gap under the board, light lip on top
    g.fillStyle = t.wall[0];
    g.globalAlpha = 0.55;
    g.fillRect(0, y + BH - 1, CELL, 1);
    g.globalAlpha = 0.16;
    g.fillStyle = t.floor[2];
    g.fillRect(0, y, CELL, 1);
    g.globalAlpha = 1;
    // nails at the board ends
    if (rng() > 0.55){
      g.globalAlpha = 0.4;
      g.fillStyle = t.wall[0];
      const nx = rng() > 0.5 ? 3 : CELL - 4;
      g.fillRect(nx, y + ((BH / 2) | 0), 1, 1);
      g.globalAlpha = 1;
    }
  }
}

/**
 * 32x32 floor slab, `v` picks one of FLOOR_VARIANTS.
 *
 * Built as four flagstones rather than flat noise: each stone gets its own
 * tone, a bevelled lit top edge and a shadowed bottom, then cracks and stains
 * on top. Eight variants is enough that a 13-wide room never shows an obvious
 * repeat.
 */
export function floorTile(theme, v = 0){
  const key = `f:${theme}:${v}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const t = THEMES[theme] || THEMES.cellar;
  const rng = noise(hash(key));
  const [c, g] = surf(CELL, CELL);

  if (t.style === 'plank'){
    plankFloor(g, t, rng);
    const sp = { c, w: CELL, h: CELL };
    tileCache.set(key, sp);
    return sp;
  }

  // grout sits underneath and shows through the gaps between stones
  g.fillStyle = t.floor[0];
  g.fillRect(0, 0, CELL, CELL);

  const H = CELL / 2;
  for (let qy = 0; qy < 2; qy++){
    for (let qx = 0; qx < 2; qx++){
      const x = qx * H, y = qy * H;
      const tone = 0.82 + rng() * 0.36;
      g.fillStyle = mix(t.floor[1], t.floor[2], (tone - 0.82) / 0.36 * 0.5);
      g.fillRect(x + 1, y + 1, H - 2, H - 2);
      // bevel: light along the top, shadow along the bottom
      g.globalAlpha = 0.22;
      g.fillStyle = t.floor[2];
      g.fillRect(x + 1, y + 1, H - 2, 1);
      g.fillRect(x + 1, y + 1, 1, H - 2);
      g.globalAlpha = 0.3;
      g.fillStyle = t.floor[0];
      g.fillRect(x + 1, y + H - 2, H - 2, 1);
      g.fillRect(x + H - 2, y + 1, 1, H - 2);
      g.globalAlpha = 1;

      // a crack across some stones
      if (rng() > 0.62){
        g.globalAlpha = 0.28;
        g.fillStyle = t.floor[0];
        let cx = x + 3 + rng() * (H - 8), cy = y + 3;
        const steps = 4 + (rng() * 5) | 0;
        for (let i = 0; i < steps; i++){
          g.fillRect(cx | 0, cy | 0, 1, 1);
          cx += rng() < 0.5 ? -1 : 1;
          cy += 1;
          if (cy > y + H - 3) break;
        }
        g.globalAlpha = 1;
      }
      // an occasional stain, so the eye has something to land on
      if (rng() > 0.8){
        g.globalAlpha = 0.1 + rng() * 0.08;
        g.fillStyle = t.accent;
        const r = 2 + rng() * 3;
        g.beginPath();
        g.arc(x + H / 2 + (rng() - .5) * 6, y + H / 2 + (rng() - .5) * 6, r, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
    }
  }

  // fine grit over the whole slab to break up the flat fills
  for (let i = 0; i < 34; i++){
    g.fillStyle = rng() > 0.5 ? t.floor[0] : t.floor[2];
    g.globalAlpha = 0.12 + rng() * 0.2;
    g.fillRect((rng() * CELL) | 0, (rng() * CELL) | 0, 1, 1);
  }
  g.globalAlpha = 1;

  const s = { c, w: CELL, h: CELL };
  tileCache.set(key, s);
  return s;
}

/** Blend two hex colours, `k` 0..1 toward b. */
function mix(a, b, k){
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = i => Math.round((((pa >> i) & 255)) + ((((pb >> i) & 255)) - (((pa >> i) & 255))) * k);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** The lit edge where a wall meets the floor, shared by both wall styles. */
function applyLip(g, t, side){
  g.fillStyle = t.wall[2];
  if (side === 'top'){ g.fillRect(0, CELL - 3, CELL, 3); g.fillStyle = '#000'; g.globalAlpha = .25; g.fillRect(0, CELL - 1, CELL, 1); }
  else if (side === 'bottom'){ g.fillRect(0, 0, CELL, 2); }
  else if (side === 'left'){ g.fillRect(CELL - 2, 0, 2, CELL); }
  else if (side === 'right'){ g.fillRect(0, 0, 2, CELL); }
  g.globalAlpha = 1;
}

/**
 * Wall slab. `side` is 'top' | 'bottom' | 'left' | 'right' | 'corner' — the top
 * face gets a lit lip so the room reads as a box rather than a flat frame.
 */
export function wallTile(theme, side = 'top', v = 0){
  const key = `w:${theme}:${side}:${v}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const t = THEMES[theme] || THEMES.cellar;
  const rng = noise(hash(key));
  const [c, g] = surf(CELL, CELL);

  if (t.style === 'plank'){
    // vertical boarding: a timber cellar is panelled, not bricked
    g.fillStyle = t.wall[0];
    g.fillRect(0, 0, CELL, CELL);
    const BW = 8;
    for (let x = 0; x < CELL; x += BW){
      const tone = rng();
      g.fillStyle = mix(t.wall[1], tone > 0.5 ? t.wall[2] : t.wall[0], Math.abs(tone - 0.5) * 0.8);
      g.fillRect(x + 1, 0, BW - 1, CELL);
      for (let i = 0; i < 4; i++){
        g.globalAlpha = 0.07 + rng() * 0.11;
        g.fillStyle = rng() > 0.5 ? t.wall[0] : t.wall[2];
        g.fillRect(x + 1 + ((rng() * (BW - 2)) | 0), (rng() * CELL) | 0, 1, 3 + ((rng() * 9) | 0));
      }
      g.globalAlpha = 1;
      g.fillStyle = t.wall[0];
      g.globalAlpha = 0.6;
      g.fillRect(x, 0, 1, CELL);
      g.globalAlpha = 0.14;
      g.fillStyle = t.wall[2];
      g.fillRect(x + 1, 0, 1, CELL);
      g.globalAlpha = 1;
    }
    // cross beam, so the panelling has some structure
    if (side === 'top' || side === 'bottom'){
      g.globalAlpha = 0.3;
      g.fillStyle = t.wall[0];
      g.fillRect(0, side === 'top' ? 10 : 18, CELL, 3);
      g.globalAlpha = 1;
    }
    applyLip(g, t, side);
    const sp = { c, w: CELL, h: CELL };
    tileCache.set(key, sp);
    return sp;
  }

  // mortar behind, bricks laid on top so the gaps are real rather than drawn
  g.fillStyle = t.wall[0];
  g.fillRect(0, 0, CELL, CELL);

  const BH = 8, BW = 16;
  for (let row = 0, y = 0; y < CELL; y += BH, row++){
    const off = (row % 2) * (BW / 2);
    for (let x = -BW; x < CELL + BW; x += BW){
      const bx = x + off;
      const tone = rng();
      g.fillStyle = mix(t.wall[1], tone > 0.6 ? t.wall[2] : t.wall[0], Math.abs(tone - 0.5) * 0.5);
      g.fillRect(bx + 1, y + 1, BW - 2, BH - 2);
      // lit top edge, shadowed underside — this is what gives the wall relief
      g.globalAlpha = 0.26;
      g.fillStyle = t.wall[2];
      g.fillRect(bx + 1, y + 1, BW - 2, 1);
      g.globalAlpha = 0.34;
      g.fillStyle = t.wall[0];
      g.fillRect(bx + 1, y + BH - 2, BW - 2, 1);
      g.globalAlpha = 1;
      // chipped corner on the odd brick
      if (rng() > 0.86){
        g.fillStyle = t.wall[0];
        g.globalAlpha = 0.5;
        g.fillRect(bx + 1 + ((rng() * (BW - 4)) | 0), y + 1 + ((rng() * (BH - 3)) | 0), 2, 2);
        g.globalAlpha = 1;
      }
    }
  }
  // theme accent creeping through the mortar (moss, rust, damp)
  for (let i = 0; i < 10; i++){
    g.fillStyle = t.accent;
    g.globalAlpha = 0.05 + rng() * 0.07;
    g.fillRect((rng() * CELL) | 0, (rng() * CELL) | 0, 1 + ((rng() * 2) | 0), 1);
  }
  for (let i = 0; i < 22; i++){
    g.fillStyle = rng() > 0.5 ? t.wall[0] : t.wall[2];
    g.globalAlpha = 0.12 + rng() * 0.2;
    g.fillRect((rng() * CELL) | 0, (rng() * CELL) | 0, 1, 1);
  }
  g.globalAlpha = 1;
  applyLip(g, t, side);
  const s = { c, w: CELL, h: CELL };
  tileCache.set(key, s);
  return s;
}

/* ------------------------------------------------------------------ */
/* obstacles (16x16 authored, drawn at 2x to fill a cell)              */
/* ------------------------------------------------------------------ */
const O = '#191118';   // universal outline

const ROCK = [
  '....oooooo......',
  '..oo2222220o....',
  '.o2211111220o...',
  'o221111111220o..',
  'o21111111112220.',
  'o21111111111220o',
  'o21111111111120o',
  'o21111111111120o',
  'o22111111111120o',
  'o02211111111220o',
  '.o0221111112200o',
  '..o0022111220o..',
  '...oo00222200o..',
  '.....oo0000oo...',
  '.......oooo.....',
  '................'
];
const BLOCK = [
  'oooooooooooooooo',
  'o2222222222222o.',
  'o2111111111112o.',
  'o2111111111112o.',
  'o2113333333112o.',
  'o2113333333112o.',
  'o2113333333112o.',
  'o2113333333112o.',
  'o2113333333112o.',
  'o2111111111112o.',
  'o2111111111112o.',
  'o2222222222222o.',
  'oooooooooooooooo',
  '.oooooooooooooo.',
  '................',
  '................'
];
const SPIKES = [
  '................',
  '................',
  '...o......o.....',
  '..o2o....o2o....',
  '..o2o....o2o....',
  '.o221o..o221o...',
  '.o221o..o221o...',
  'o22111oo22111o..',
  'o11111oo11111o..',
  'ooooooooooooooo.',
  '.o333333333330..',
  '.o000000000000..',
  '................',
  '................',
  '................',
  '................'
];
const MOUND = [
  '................',
  '.....oooo.......',
  '...oo1111oo.....',
  '..o211111120....',
  '..o111111110....',
  '.oo22111122oo...',
  'o2211111111220..',
  'o1111111111110..',
  'o2211111111220..',
  '.o2211111122o...',
  '..o221111220....',
  '...oo222200.....',
  '.....oooo.......',
  '................',
  '................',
  '................'
];
const WEB = [
  'o..o..o..o..o...',
  '.o.o.o.o.o.o....',
  '..ooo.ooo.o.....',
  'ooo.....o.oo....',
  '..ooo.ooo.o.....',
  '.o.o.o.o.o.o....',
  'o..o..o..o..o...',
  '.o.o.o.o.o.o....',
  '..ooo.ooo.o.....',
  'ooo.....o.oo....',
  '..ooo.ooo.o.....',
  '.o.o.o.o.o.o....',
  'o..o..o..o..o...',
  '................',
  '................',
  '................'
];
const TORCH = [
  '................',
  '......11........',
  '.....1331.......',
  '....13223.......',
  '....13222.......',
  '....1322311.....',
  '.....13221......',
  '......111.......',
  '.....o44o.......',
  '.....o44o.......',
  '.....o44o.......',
  '....o4444o......',
  '....o4444o......',
  '.....oooo.......',
  '................',
  '................'
];
const CHEST = [
  '................',
  '..oooooooooooo..',
  '.o111111111111o.',
  'o12222222222221o',
  'o12211111112221o',
  'o12222222222221o',
  'ooooo333333ooooo',
  'o1112333332111o.',
  'o1112333332111o.',
  'o1222222222221o.',
  'o1222222222221o.',
  'o1111111111111o.',
  '.ooooooooooooo..',
  '................',
  '................',
  '................'
];

const PIT_ROWS = [
  'oooooooooooooooo',
  'o1111111111111oo',
  'o1222222222211o.',
  'o1222222222221o.',
  'o1222222222221o.',
  'o1222222222221o.',
  'o1222222222221o.',
  'o1222222222221o.',
  'o1222222222221o.',
  'o1222222222221o.',
  'o1222222222221o.',
  'o1222222222221o.',
  'o1122222222211o.',
  'oo1111111111oo..',
  '.oooooooooooo...',
  '................'
];

export function obstacleSprite(kind, theme){
  const t = THEMES[theme] || THEMES.cellar;
  switch (kind){
    case 'rock':   return sprite('rock:' + theme, ROCK, { o:O, 0:'#00000055', 1:t.wall[2], 2:t.wall[1], 3:t.wall[0] });
    case 'block':  return sprite('block:' + theme, BLOCK, { o:O, 1:t.wall[2], 2:t.wall[1], 3:t.wall[0] });
    case 'spikes': return sprite('spikes', SPIKES, { o:O, 0:'#00000055', 1:'#d8d8e4', 2:'#9a9aae', 3:'#5a5a6a' });
    case 'mound':  return sprite('mound:' + theme, MOUND, { o:O, 0:'#00000055', 1:t.accent, 2:t.floor[0] });
    case 'web':    return sprite('web', WEB, { o:'#e6e6f0cc' });
    case 'torch':  return sprite('torch', TORCH, { o:O, 1:'#ffe066', 2:'#ff8a3d', 3:'#fff3b0', 4:'#6b4a2f' });
    case 'chest':  return sprite('chest', CHEST, { o:O, 1:'#b9863f', 2:'#8a5f2a', 3:'#ffd166' });
    case 'pit':    return sprite('pit:' + theme, PIT_ROWS, { o:'#0d0a10', 1:t.floor[0], 2:'#0b0910' });
    default:       return sprite('rock:' + theme, ROCK, { o:O, 0:'#00000055', 1:t.wall[2], 2:t.wall[1], 3:t.wall[0] });
  }
}

/* ------------------------------------------------------------------ */
/* doors                                                               */
/* ------------------------------------------------------------------ */
/** Colour + emblem per door kind. Emblems are drawn as pixel rows below. */
export const DOOR_STYLE = {
  normal:   { frame:'#6b5340', panel:'#3a2c22', glow:null },
  boss:     { frame:'#8a2f38', panel:'#2c1114', glow:'#ff5c5c' },
  treasure: { frame:'#c9a44a', panel:'#3a2f14', glow:'#ffd166' },
  shop:     { frame:'#3f7fbf', panel:'#12253a', glow:'#7fc3ff' },
  secret:   { frame:'#6b5340', panel:'#3a2c22', glow:null },
  supersecret:{ frame:'#6b5340', panel:'#3a2c22', glow:null },
  curse:    { frame:'#4a3a5c', panel:'#1a1222', glow:'#b07fff' },
  sacrifice:{ frame:'#a03a3a', panel:'#2a0e0e', glow:'#ff7a7a' },
  arcade:   { frame:'#b04fa8', panel:'#2c123a', glow:'#ff8ae0' },
  library:  { frame:'#4f8f6f', panel:'#122a1e', glow:'#8fe0b0' },
  devil:    { frame:'#7a1f24', panel:'#1a0508', glow:'#ff3b3b' },
  angel:    { frame:'#d8d2b0', panel:'#3a3620', glow:'#fff6c9' },
  challenge:{ frame:'#8a6a2f', panel:'#2a1f0e', glow:'#ffbe5c' },
  planetarium:{ frame:'#3a4f9f', panel:'#101832', glow:'#9fb8ff' }
};

const EMBLEM = {
  boss:      ['..oo..','.o11o.','o1111o','o1111o','.o11o.','..oo..'],
  treasure:  ['.oooo.','o1111o','oo11oo','.o11o.','.o11o.','..oo..'],
  shop:      ['o....o','o1..1o','oo11oo','.o11o.','o1111o','.oooo.'],
  curse:     ['.o..o.','..oo..','.o11o.','o1111o','.o11o.','..oo..'],
  sacrifice: ['..oo..','..11..','o1111o','..11..','..11..','..oo..'],
  arcade:    ['.oooo.','o1..1o','o.11.o','o1..1o','.oooo.','......'],
  library:   ['oooooo','o1111o','o1oo1o','o1111o','o1oo1o','oooooo'],
  devil:     ['o....o','.o11o.','o1111o','o1oo1o','.o11o.','..oo..'],
  angel:     ['..oo..','.o11o.','o1111o','.o11o.','.o11o.','..oo..'],
  challenge: ['.o..o.','o1o1o.','o111o.','.o1o..','.o1o..','..o...'],
  planetarium:['..oo..','.o11o.','o11o1o','o1111o','.o11o.','..oo..']
};

export function doorEmblem(kind, colour){
  const rows = EMBLEM[kind];
  if (!rows) return null;
  return sprite('emb:' + kind + colour, rows, { o:'#00000088', 1: colour });
}

/* ------------------------------------------------------------------ */
/* pickups (12x12)                                                     */
/* ------------------------------------------------------------------ */
const HEART = [
  '..oo..oo....',
  '.o11oo11o...',
  'o1122211 o..',
  'o1222221 o..',
  'o1222221 o..',
  '.o122210 ...',
  '.0o1221o0...',
  '..0o12o0....',
  '...0oo0.....',
  '............',
  '............',
  '............'
];
const HEART_FULL = [
  '..oooooo....',
  '.o331133o...',
  'o31111113o..',
  'o31111113o..',
  'o11111111o..',
  '.o111111o...',
  '..o1111o....',
  '...o11o.....',
  '....oo......',
  '............',
  '............',
  '............'
];
const COIN = [
  '...oooo.....',
  '..o1111o....',
  '.o112211o...',
  'o11221111o..',
  'o12211221o..',
  'o12211221o..',
  'o11112211o..',
  '.o112211o...',
  '..o1111o....',
  '...oooo.....',
  '............',
  '............'
];
const BOMB = [
  '.......o1...',
  '......o1o...',
  '..ooo1o.....',
  '.o222oo.....',
  'o2211122o...',
  'o2111112o...',
  'o2111112o...',
  'o2111112o...',
  '.o211112o...',
  '..oo2222o...',
  '....oooo....',
  '............'
];
const KEY = [
  '..ooo.......',
  '.o111o......',
  'o11o11o.....',
  'o1o.o1o.....',
  'o11o11o.....',
  '.o111o......',
  '..o1o.......',
  '..o1o.......',
  '..o11o......',
  '..o1o.......',
  '..o11o......',
  '...oo.......'
];
const PILL = [
  '...oooo.....',
  '..o1111oo...',
  '.o111111o...',
  'o1111122o...',
  'o1111222o...',
  'o1112222o...',
  'o1122222o...',
  '.o222222o...',
  '..o2222o....',
  '...oooo.....',
  '............',
  '............'
];
const CARD = [
  '.oooooooo...',
  'o11111111o..',
  'o12211221o..',
  'o11222211o..',
  'o11122111o..',
  'o11222211o..',
  'o12211221o..',
  'o11111111o..',
  '.oooooooo...',
  '............',
  '............',
  '............'
];
const BATTERY = [
  '...oo.oo....',
  '.oo11o11oo..',
  'o111111111o.',
  'o122222221o.',
  'o123333321o.',
  'o123333321o.',
  'o122222221o.',
  'o111111111o.',
  '.ooooooooo..',
  '............',
  '............',
  '............'
];
const SACK = [
  '....oo......',
  '...o11o.....',
  '..o1111o....',
  '.o222222o...',
  'o22222222o..',
  'o22111222o..',
  'o22111222o..',
  'o22222222o..',
  '.o222222o...',
  '..oooooo....',
  '............',
  '............'
];
const TRINKET = [
  '....oo......',
  '...o11o.....',
  '..o1221o....',
  '..o1221o....',
  '...o11o.....',
  '..oo11oo....',
  '.o211112o...',
  'o21111112o..',
  'o21111112o..',
  '.o211112o...',
  '..oooooo....',
  '............'
];

export const PICKUP_ART = {
  heartRed:   () => sprite('p:hr', HEART_FULL, { o:O, 1:'#e5384a', 3:'#ff7280' }),
  heartHalf:  () => sprite('p:hh', HEART, { o:O, 0:'#00000000', 1:'#e5384a', 2:'#ff7280' }),
  heartSoul:  () => sprite('p:hs', HEART_FULL, { o:O, 1:'#5aa0ff', 3:'#a8d0ff' }),
  heartBlack: () => sprite('p:hb', HEART_FULL, { o:O, 1:'#4a3a58', 3:'#8a72a0' }),
  heartEternal:() => sprite('p:he', HEART_FULL, { o:O, 1:'#dfe6f2', 3:'#ffffff' }),
  heartRot:   () => sprite('p:hp', HEART_FULL, { o:O, 1:'#6f8a3a', 3:'#a8c66a' }),
  coin:       () => sprite('p:c', COIN, { o:O, 1:'#ffd166', 2:'#c98f2a' }),
  nickel:     () => sprite('p:c5', COIN, { o:O, 1:'#d8dde6', 2:'#98a0ad' }),
  dime:       () => sprite('p:c10', COIN, { o:O, 1:'#9fe8ff', 2:'#4fa8c9' }),
  bomb:       () => sprite('p:b', BOMB, { o:O, 1:'#3a3a48', 2:'#22222c' }),
  key:        () => sprite('p:k', KEY, { o:O, 1:'#ffd166' }),
  goldKey:    () => sprite('p:kg', KEY, { o:O, 1:'#fff0a0' }),
  pill:       () => sprite('p:p', PILL, { o:O, 1:'#f2f2f6', 2:'#e5384a' }),
  card:       () => sprite('p:cd', CARD, { o:O, 1:'#f2eede', 2:'#8a6ad0' }),
  rune:       () => sprite('p:rn', CARD, { o:O, 1:'#c9c2b0', 2:'#3a3a48' }),
  battery:    () => sprite('p:bt', BATTERY, { o:O, 1:'#8fe0b0', 2:'#3f8f6f', 3:'#ffe066' }),
  sack:       () => sprite('p:sk', SACK, { o:O, 1:'#c9a06a', 2:'#8a6a3f' }),
  trinket:    () => sprite('p:tk', TRINKET, { o:O, 1:'#ffd166', 2:'#b07f2a' })
};

/** Coloured pill variants — the colour is the identity, effects are shuffled. */
export const PILL_COLOURS = [
  ['#f2f2f6','#e5384a'], ['#ffd166','#c98f2a'], ['#8fe0b0','#3f8f6f'],
  ['#a8d0ff','#3f7fbf'], ['#d8a8ff','#8a4fd0'], ['#ffb3c1','#d0506a'],
  ['#f2eede','#6b5340'], ['#9fe8ff','#3aa0c9'], ['#c9f28a','#6f9a2a'],
  ['#ff9f6a','#c95a2a'], ['#d8d8e4','#6a6a80'], ['#ffe9a8','#c9a44a'],
  ['#b0f2e8','#3f9f92'], ['#ffc2f0','#c94fa8']
];
export const pillSprite = i => sprite('p:pill' + i, PILL, { o:O, 1:PILL_COLOURS[i % PILL_COLOURS.length][0], 2:PILL_COLOURS[i % PILL_COLOURS.length][1] });

/* ------------------------------------------------------------------ */
/* projectiles                                                         */
/* ------------------------------------------------------------------ */
const TEAR = [
  '..oo..',
  '.o11o.',
  'o1112o',
  'o1122o',
  '.o22o.',
  '..oo..'
];
const TEAR_BIG = [
  '..oooo..',
  '.o1111o.',
  'o111122o',
  'o111222o',
  'o112222o',
  'o122222o',
  '.o2222o.',
  '..oooo..'
];
/** Player shots. `colour` is the fluid, outline stays constant. */
export const tearSprite = (colour, hi, big = false) =>
  sprite(`t:${colour}:${hi}:${big}`, big ? TEAR_BIG : TEAR, { o:'#00000066', 1:hi, 2:colour });

const SPARK = ['.oo.','o11o','o11o','.oo.'];
export const sparkSprite = c => sprite('sp:' + c, SPARK, { o:'#00000044', 1:c });

/* ------------------------------------------------------------------ */
/* item icons                                                          */
/* ------------------------------------------------------------------ */
/**
 * Items get a shape ("form") plus a four-colour palette. 24 hand-drawn forms
 * recoloured across the pool gives every one of the 140-odd items its own
 * readable silhouette without hand-drawing 140 sprites.
 * Palette chars: o outline, a main, b shade, c highlight, d accent.
 */
export const FORMS = {
  orb: [
    '....oooo....','..oocccboo..','.occcaaabbo.','occcaaaabbbo',
    'ocaaaaaabbbo','oaaaaaaabbbo','oaaaaaaabbbbo'.slice(0,14),'oaaaaaabbbbbo'.slice(0,14),
    'obaaaabbbbbo'.slice(0,14),'.obbbbbbbbo.','..oobbbboo..','....oooo....','..............','..............'
  ],
  heart: [
    '..oo....oo....','.oaao..oaao...','oaccaooaccao..','oaaaaaaaaaao..',
    'oaaaaaaaaaao..','obaaaaaaaaabo.','.obaaaaaaabo..','..obaaaaabo...',
    '...obaaabo....','....obabo.....','.....obo......','......o.......','..............','..............'
  ],
  blade: [
    '.......oo.....','......occo....','.....occao....','....occaao....',
    '...occaaao....','..occaaabo....','.occaaabbo....','occaaabbo.....',
    'ocaaabbo......','.oddddo.......','..oddo........','..oddo........','...oo.........','..............'
  ],
  book: [
    'oooooooooooo..','oaaaaoaaaaao..','oacccoacccao..','oaaaaoaaaaao..',
    'oaaaaoaaaaao..','oadddoaddddo..','oaaaaoaaaaao..','oaaaaoaaaaao..',
    'oaaaaoaaaaao..','obbbbobbbbbo..','oooooooooooo..','..............','..............','..............'
  ],
  ring: [
    '....oooo......','..oo cc oo....','.oc      co...','oc   dd   co..',
    'oa  dccd  ao..','oa  dccd  ao..','oa   dd   ao..','ob        bo..',
    '.ob      bo...','..oobbbboo....','....oooo......','..............','..............','..............'
  ],
  skull: [
    '...oooooo.....','..occccco.....','.occaaacco....','ocaaaaaaco....',
    'oaoo aa ooao..','oaoo aa ooao..','oaaaaddaaao...','oaaaddddaao...',
    '.oaaoaaoaao...','..obobobbo....','...oooooo.....','..............','..............','..............'
  ],
  eye: [
    '..oooooooo....','.occcccccco...','occaaaaaacco..','ocaaddddaaco..',
    'oaadddddda ao.'.slice(0,14),'oaaddoodda ao'.slice(0,14),'oaaddoodda ao'.slice(0,14),'oaadddddda ao'.slice(0,14),
    'ocaaddddaaco..','occaaaaaacco..','.occcccccco...','..oooooooo....','..............','..............'
  ],
  flame: [
    '......oo......','.....occo.....','....occao.....','....ocaao.....',
    '...occaaao....','..occaaaao....','.occaaaddo....','ocaaaddddo....',
    'ocaadddddo....','obaadddddo....','.obaddddo.....','..obbddo......','...oooo.......','..............'
  ],
  star: [
    '......oo......','.....occo.....','.....ocao.....','..oooocaoooo..',
    '.occccaaacco..','.ocaaaaaaaco..','..ocaaaaaco...','..ocaaaaaco...',
    '.ocaabbbaaco..','.oco.oo.ocbo..','.oo......oo...','..............','..............','..............'
  ],
  gear: [
    '..o.oooo.o....','.oaooccooao...','.oaccaaccao...','ooaaaddaaaoo..',
    'occaddddaccо'.slice(0,14),'oaaaddddaaao..','oaaaddddaaao..','occadddda cco'.slice(0,14),
    'ooaaaddaaaoo..','.oaccaaccao...','.oaooccooao...','..o.oooo.o....','..............','..............'
  ],
  wing: [
    '............','..oooo......','.occcao.....','occcaaao....',
    'occaaaabo...','ocaaaabbbo..','ocaaabbbbo..','ocaabbbbbo..',
    '.ocabbbbo...','..occbbo....','...oooo.....','............','............','............'
  ],
  tooth: [
    '..oooooooo....','.occccccco....','occaaaaacco...','ocaaaaaaaco...',
    'ocaaaaaaaco...','ocaaaaaaaco...','.obaaaaabo....','..obaaabo.....',
    '..oba.abo.....','..ob...bo.....','...o...o......','..............','..............','..............'
  ],
  bottle: [
    '.....oo.......','.....oao......','....odddo.....','....odddo.....',
    '...oocccoo....','..occaaacco...','.ocaaaaaaco...','ocaaddddaaco..',
    'ocaddddddaco..','ocaddddddaco..','obaddddddabo..','.obbaaaabbo...','..oooooooo....','..............'
  ],
  candle: [
    '......oo......','.....odo......','....oddco.....','.....odo......',
    '.....occ......','....occao.....','....ocao......','....ocao......',
    '....ocao......','...occaao.....','..obbaabbo....','.obbbbbbbbo...','..oooooooo....','..............'
  ],
  crown: [
    '..o......o....','.oco....oco...','.oco.oo.oco...','.ocooccoooc o'.slice(0,14),
    'occcaaaaccco..','ocaaaaaaaaco..','ocadaddadaco..','ocaaaaaaaaco..',
    'obaaaaaaaabo..','obbbbbbbbbbo..','oooooooooooo..','..............','..............','..............'
  ],
  mask: [
    '.oooooooooo...','occcccccccco..','ocaaaaaaaaco..','ocaoo aa ooco'.slice(0,14),
    'ocaoo aa ooco'.slice(0,14),'ocaaaaaaaaco..','ocaadddda aco'.slice(0,14),'ocaaddddaaco..',
    '.ocaaaaaaco...','..ocaaaaco....','...oooooo.....','..............','..............','..............'
  ],
  spider: [
    'o..........o..','.o.oooooo.o...','..occaaacco...','o.ocaaaaaco.o.',
    '.oocaaaaaacoo.','o.ocaddddaco.o','.oocaddddacoo.','o.ocaaaaaco.o.',
    '..occaaacco...','.o.oooooo.o...','o..........o..','..............','..............','..............'
  ],
  bone: [
    '.oo......oo...','oaao....oaao..','oaaao..oaaao..','.oaaaooaaao...',
    '..oaaaaaaao...','...oaaaaao....','...oaaaaao....','..oaaaaaaao...',
    '.oaaaooaaao...','oaaao..oaaao..','oaao....oaao..','.oo......oo...','..............','..............'
  ],
  cross: [
    '.....oo.......','....ocao......','....ocao......','..oooccooo....',
    '.occaaaaacco..','.ocaaaaaaaco..','..ooocaoooo...','....ocao......',
    '....ocao......','....ocao......','...obaabo.....','...oooooo.....','..............','..............'
  ],
  mushroom: [
    '...oooooo.....','..occaaacco...','.ocaddddaaco..','ocaadddddaaco.',
    'oaaaadddaaaao.','oaddaaaaaddao.','obaaaaaaaaabo.','.oobbbbbbboo..',
    '...ocaaaco....','...ocaaaco....','...ocaaaco....','...oooooo.....','..............','..............'
  ],
  syringe: [
    '..........oo..','.........occo.','........occao.','.......occao..',
    '..oooooocao...','.occccccao....','ocaddddao.....','ocaddddo......',
    '.ocaaao.......','..ooao........','...oo.........','..............','..............','..............'
  ],
  horn: [
    '..........oo..','........oocco.','......oocaaco.','....oocaaaaco.',
    '..oocaaaabbco.','.ocaaaabbbco..','ocaaabbbbco...','ocaabbbco.....',
    'obabbbco......','.obbco........','..oo..........','..............','..............','..............'
  ],
  cloud: [
    '.....oooo.....','..oooccccoo...','.occcaaaccco..','occaaaaaaacco.',
    'ocaaaaaaaaaco.','obaaaaaaaaabo.','.obbbbbbbbbo..','..oooooooooo..',
    '....o.o.o.....','...o.o.o.o....','..............','..............','..............','..............'
  ],
  hand: [
    '...oo.oo......','..oaaoaao.....','.oaccoaccao...','.oaccoaccao...',
    'oocaaoaaacoo..','oaaaaaaaaaao..','oaaaaaaaaaao..','.oaaaaaaaaao..',
    '.obaaaaaaabo..','..obaaaaabo...','...obaaabo....','....ooooo.....','..............','..............'
  ]
};

// normalise every form to a 14-wide, 14-tall block so nothing drifts
for (const k of Object.keys(FORMS)){
  const rows = FORMS[k].map(r => r.length >= 14 ? r.slice(0, 14) : r.padEnd(14, '.'));
  while (rows.length < 14) rows.push('..............');
  FORMS[k] = rows.slice(0, 14);
}

/** Build (and cache) an item's icon from its form + palette. */
export function itemIcon(item){
  const form = FORMS[item.form] || FORMS.orb;
  const [a, b, c, d] = item.pal || ['#c9c2b0', '#8a8272', '#eee8d8', '#e5384a'];
  return sprite(`it:${item.id}`, form, { o:O, a, b, c, d });
}

/* ------------------------------------------------------------------ */
/* pedestal + misc props                                               */
/* ------------------------------------------------------------------ */
const PEDESTAL = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....oooo.......',
  '....o1111o......',
  '....o1111o......',
  '...o111111o.....',
  '..o11111111o....',
  '.o1111111111o...',
  'o222222222222o..',
  '.oooooooooooo...',
  '................'
];
export const pedestalSprite = theme => sprite('ped:' + theme,
  PEDESTAL, { o:O, 1:(THEMES[theme] || THEMES.cellar).wall[2], 2:(THEMES[theme] || THEMES.cellar).wall[0] });

const SHOPKEEP = [
  '................',
  '.....oooo.......',
  '...oo1111oo.....',
  '..o11111111o....',
  '.o1111111111o...',
  '.o11o1111o11o...',
  '.o1111111111o...',
  '.o1122222211o...',
  '..o11111111o....',
  '...o222222o.....',
  '..o22222222o....',
  '.o2222222222o...',
  '.o2222222222o...',
  '..oooooooooo....',
  '................',
  '................'
];
export const shopkeepSprite = () => sprite('shopkeep', SHOPKEEP, { o:O, 1:'#d8c8a8', 2:'#5a4a6a' });

const SLOT = [
  '..oooooooooo....',
  '.o1111111111o...',
  'o122222222221o..',
  'o123333333321o..',
  'o123oo22oo321o..'.slice(0,16),
  'o123oo22oo321o..'.slice(0,16),
  'o122222222221o..',
  'o111111111111o..',
  'o1144444444110..'.slice(0,16),
  'o111111111111o..',
  'o122222222221o..',
  'o122222222221o..',
  'o111111111111o..',
  '.oooooooooooo...',
  '................',
  '................'
];
export const slotSprite = () => sprite('slot', SLOT, { o:O, 0:'#00000055', 1:'#b04fa8', 2:'#6a2f66', 3:'#ffd166', 4:'#3a3a48' });

const BEGGAR = [
  '................',
  '................',
  '.....oooo.......',
  '....o1111o......',
  '...o111111o.....',
  '...o1o11o1o.....',
  '...o111111o.....',
  '....o1111o......',
  '...o222222o.....',
  '..o22222222o....',
  '..o2211112 2o...'.slice(0,16),
  '..o22222222o....',
  '...oooooooo.....',
  '................',
  '................',
  '................'
];
export const beggarSprite = () => sprite('beggar', BEGGAR, { o:O, 1:'#c9b08a', 2:'#4a4038' });

const SACRIFICE_ALTAR = [
  '................',
  '................',
  '................',
  '.....o11o.......',
  '.....o11o.......',
  '..ooooooooo.....',
  '.o111111111o....',
  '.o122222221o....',
  '..o1111111o.....',
  '...o22222o......',
  '...o22222o......',
  '..o2222222o.....',
  '.o222222222o....',
  '.ooooooooooo....',
  '................',
  '................'
];
export const altarSprite = () => sprite('altar', SACRIFICE_ALTAR, { o:O, 1:'#d8d8e4', 2:'#6a6a80' });

const TRAPDOOR = [
  '................',
  '..oooooooooo....',
  '.o1111111111o...',
  'o122222222221o..',
  'o120000000021o..',
  'o120000000021o..',
  'o120000000021o..',
  'o120000000021o..',
  'o120000000021o..',
  'o120000000021o..',
  'o122222222221o..',
  '.o1111111111o...',
  '..oooooooooo....',
  '................',
  '................',
  '................'
];
export const trapdoorSprite = theme => sprite('trap:' + theme, TRAPDOOR,
  { o:O, 0:'#08060c', 1:(THEMES[theme] || THEMES.cellar).wall[2], 2:(THEMES[theme] || THEMES.cellar).wall[0] });

/* ------------------------------------------------------------------ */
/* explosion + effects                                                 */
/* ------------------------------------------------------------------ */
export function drawExplosion(ctx, x, y, r, t){
  // t is 0..1 through the blast
  const k = 1 - t;
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 1.6);
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, '#fff6d0');
  g.addColorStop(0.35, '#ffb03d');
  g.addColorStop(0.7, '#d8452a');
  g.addColorStop(1, 'rgba(60,20,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export { pal, compose, bake };
