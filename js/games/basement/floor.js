/**
 * Floor generation: the room graph, the special-room placement and the map.
 *
 * The shape is the classic one for this genre — grow a blob of rooms out from
 * the centre, then hand the dead ends out to the special rooms, furthest first
 * so the boss is never next door to the start.
 */
import { THEMES } from './art.js';
import { layoutFor, buildCells, clearDoorways } from './rooms.js';

export const MAP_W = 13;
export const MAP_H = 11;

export const FLOOR_ORDER = ['cellar', 'burrow', 'caves', 'sump', 'depths', 'mire', 'hollow', 'vault', 'core'];
export const FLOOR_COUNT = FLOOR_ORDER.length;

const key = (x, y) => y * MAP_W + x;
const DIRS = [
  { dx: 0, dy:-1, d:'n', o:'s' },
  { dx: 0, dy: 1, d:'s', o:'n' },
  { dx:-1, dy: 0, d:'w', o:'e' },
  { dx: 1, dy: 0, d:'e', o:'w' }
];

function makeRoom(gx, gy, type){
  return {
    gx, gy, key: key(gx, gy), type,
    doors: {}, neigh: [],
    cleared: false, visited: false, seen: false, dist: 0,
    seed: 0, layout: null, cells: null, spawns: [],
    /* runtime, filled by the game when you first walk in */
    live: null
  };
}

/**
 * @param {number} depth 0-indexed floor
 * @param {() => number} rng run RNG
 * @param {object} opts { hard, extraRooms, noSpecial }
 */
export function generateFloor(depth, rng, opts = {}){
  const theme = FLOOR_ORDER[Math.min(depth, FLOOR_ORDER.length - 1)];
  const target = Math.min(24, 7 + depth * 2 + Math.floor(rng() * 3) + (opts.extraRooms || 0));

  const rooms = new Map();
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  const start = makeRoom(cx, cy, 'start');
  rooms.set(start.key, start);

  const at = (x, y) => rooms.get(key(x, y));
  const inside = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const countNeighbours = (x, y) => DIRS.reduce((n, d) => n + (at(x + d.dx, y + d.dy) ? 1 : 0), 0);

  // grow — a candidate needs exactly one existing neighbour so the floor stays
  // branchy instead of collapsing into one solid slab of rooms
  let guard = 0;
  const queue = [start];
  while (rooms.size < target && guard++ < 4000){
    const from = queue.length ? queue[(rng() * queue.length) | 0] : start;
    const d = DIRS[(rng() * 4) | 0];
    const nx = from.gx + d.dx, ny = from.gy + d.dy;
    if (!inside(nx, ny) || at(nx, ny)) continue;
    if (countNeighbours(nx, ny) > 1) continue;
    if (rng() < 0.16) continue;                       // leave gaps for secret rooms
    const r = makeRoom(nx, ny, 'normal');
    rooms.set(r.key, r);
    queue.push(r);
    if (queue.length > 12) queue.shift();
  }

  // link + distances
  for (const r of rooms.values()){
    for (const d of DIRS){
      const n = at(r.gx + d.dx, r.gy + d.dy);
      if (n){ r.doors[d.d] = { to: n.key, kind: 'normal', open: false }; r.neigh.push(n); }
    }
  }
  bfs(start, rooms);

  const list = [...rooms.values()];
  const deadEnds = list.filter(r => r.type === 'normal' && r.neigh.length === 1)
    .sort((a, b) => b.dist - a.dist);

  /* ---- special rooms -------------------------------------------- */
  const take = () => deadEnds.shift();
  const assign = (type) => { const r = take(); if (r) r.type = type; return r; };

  const boss = assign('boss');
  if (!boss){
    // pathological tiny floor — convert the furthest room instead
    const far = list.filter(r => r.type === 'normal').sort((a, b) => b.dist - a.dist)[0];
    if (far) far.type = 'boss';
  }
  const bossRoom = list.find(r => r.type === 'boss');

  if (!opts.noSpecial){
    assign('treasure');
    if (depth > 0 || rng() < 0.7) assign('shop');
    if (rng() < 0.55) assign('miniboss');
    if (rng() < 0.4) assign('arcade');
    if (rng() < 0.35) assign('library');
    if (rng() < 0.3) assign('curse');
    if (rng() < 0.3) assign('sacrifice');
    if (rng() < 0.22) assign('challenge');
    if (rng() < 0.12) assign('planetarium');
  }

  /* ---- hidden rooms --------------------------------------------- */
  // A secret room is an empty cell touching as many rooms as possible; it has
  // no door until it is bombed open, which is what makes it worth hunting.
  const empties = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++){
      if (at(x, y)) continue;
      const n = DIRS.map(d => at(x + d.dx, y + d.dy)).filter(Boolean);
      if (!n.length) continue;
      const bad = n.some(r => r.type === 'boss' || r.type === 'start');
      empties.push({ x, y, n, score: n.length - (bad ? 1.5 : 0) - (rng() * 0.4) });
    }
  empties.sort((a, b) => b.score - a.score);

  const placeHidden = (type) => {
    const spot = empties.shift();
    if (!spot) return null;
    const r = makeRoom(spot.x, spot.y, type);
    r.hidden = true;
    rooms.set(r.key, r);
    for (const d of DIRS){
      const n = at(r.gx + d.dx, r.gy + d.dy);
      if (!n) continue;
      r.doors[d.d] = { to:n.key, kind:type, open:false, hidden:true };
      n.doors[d.o] = { to:r.key, kind:type, open:false, hidden:true };
      r.neigh.push(n); n.neigh.push(r);
    }
    return r;
  };
  const secret = placeHidden('secret');
  const superSecret = rng() < 0.85 ? placeHidden('supersecret') : null;

  /* ---- door kinds ----------------------------------------------- */
  for (const r of rooms.values()){
    for (const [dir, door] of Object.entries(r.doors)){
      const other = rooms.get(door.to);
      if (!other) continue;
      if (door.hidden) continue;
      const t = other.type === 'normal' || other.type === 'start' ? r.type : other.type;
      door.kind = (t === 'normal' || t === 'start') ? 'normal' : t;
      door.locked = other.type === 'treasure' || other.type === 'shop'
        || (other.type === 'boss' && false);
    }
  }

  /* ---- bake layouts --------------------------------------------- */
  for (const r of rooms.values()){
    r.seed = (rng() * 0x7fffffff) | 0;
    r.layout = layoutFor(r.type, rng, depth);
    const built = buildCells(r.layout);
    r.cells = clearDoorways(built.cells);
    r.spawns = built.spawns;
    if (r.type === 'start'){ r.cleared = true; r.spawns = []; }
  }

  start.visited = true; start.seen = true;
  markSeen(start, rooms);

  return {
    depth, theme, rooms, list: [...rooms.values()],
    name: THEMES[theme].name,
    start, boss: bossRoom, secret, superSecret,
    dealTaken: false, curse: pickCurse(depth, rng, opts)
  };
}

/** Breadth-first distances from the start room. */
function bfs(start, rooms){
  for (const r of rooms.values()) r.dist = Infinity;
  start.dist = 0;
  const q = [start];
  while (q.length){
    const r = q.shift();
    for (const n of r.neigh) if (n.dist > r.dist + 1){ n.dist = r.dist + 1; q.push(n); }
  }
}

/** Neighbours of a visited room show up as outlines on the map. */
export function markSeen(room, rooms){
  for (const d of Object.values(room.doors)){
    if (d.hidden) continue;
    const n = rooms.get(d.to);
    if (n) n.seen = true;
  }
}

/* ------------------------------------------------------------------ */
/* curses                                                              */
/* ------------------------------------------------------------------ */
export const CURSES = [
  { id:'dark',   name:'Curse of the Dark',   desc:'You can only see what is near you.' },
  { id:'lost',   name:'Curse of the Lost',   desc:'No map this floor.' },
  { id:'maze',   name:'Curse of the Maze',   desc:'Doors sometimes put you somewhere else.' },
  { id:'unknown',name:'Curse of the Unknown',desc:'You cannot see your own health.' },
  { id:'hunger', name:'Curse of Hunger',     desc:'Enemies have a little more health.' }
];

function pickCurse(depth, rng, opts){
  if (depth < 1 || opts.noCurses) return null;
  const chance = opts.hard ? 0.24 : 0.14;
  if (rng() > chance) return null;
  return CURSES[(rng() * CURSES.length) | 0];
}

/* ------------------------------------------------------------------ */
/* map drawing helpers                                                 */
/* ------------------------------------------------------------------ */
export const ROOM_TINT = {
  start:'#ffffff', normal:'#c8c8d4', boss:'#ff5c5c', treasure:'#ffd166', shop:'#7fc3ff',
  secret:'#c0c0cc', supersecret:'#e0a0ff', curse:'#b07fff', sacrifice:'#ff7a7a',
  arcade:'#ff8ae0', library:'#8fe0b0', challenge:'#ffbe5c', miniboss:'#ffa05c',
  devil:'#ff3b3b', angel:'#fff6c9', planetarium:'#9fb8ff'
};

/** Compact bounds so the minimap can centre on the used part of the grid. */
export function mapBounds(floor){
  let x0 = MAP_W, y0 = MAP_H, x1 = 0, y1 = 0;
  for (const r of floor.rooms.values()){
    if (r.gx < x0) x0 = r.gx; if (r.gx > x1) x1 = r.gx;
    if (r.gy < y0) y0 = r.gy; if (r.gy > y1) y1 = r.gy;
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
