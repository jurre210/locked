/**
 * Room layouts and population.
 *
 * A layout is 7 rows of 13 characters, one per grid cell:
 *   .  empty      #  rock (breakable)   X  block (permanent)
 *   ^  spikes     o  pit                M  mound (breakable, may drop)
 *   W  web        F  torch              e  preferred enemy spot
 *
 * Doors sit in the middle of each wall, so the three cells nearest each door
 * are force-cleared after a layout is chosen — no template can wall you in.
 */
import { GRID_W, GRID_H } from './art.js';

export const LAYOUTS = [
  // open
  ['.............','.............','.....e.e.....','.............','.....e.e.....','.............','.............'],
  // pillars
  ['.............','..X.......X..','.....e.e.....','.............','.....e.e.....','..X.......X..','.............'],
  // ring of rock
  ['.............','..#########..','..#.......#..','..#..e.e..#..','..#.......#..','..#########..','.............'],
  // diagonal
  ['..#..........','...#.....e...','....#........','.....#.......','......#......','...e...#.....','........#....'],
  // corridor
  ['.............','.XXXXX.XXXXX.','.............','.....e.e.....','.............','.XXXXX.XXXXX.','.............'],
  // spike pit centre
  ['.............','....^^^^^....','....^ooo^....','..e.^ooo^.e..','....^ooo^....','....^^^^^....','.............'],
  // pit river
  ['.............','..ooo...ooo..','..ooo...ooo..','......e......','..ooo...ooo..','..ooo...ooo..','.............'],
  // scatter
  ['..#...#...#..','.......e.....','.#..#...#..#.','......e......','.#..#...#..#.','.....e.......','..#...#...#..'],
  // mounds
  ['.............','..M.M...M.M..','.............','....e...e....','.............','..M.M...M.M..','.............'],
  // web nest
  ['.WW.......WW.','.WW...e...WW.','.............','....e...e....','.............','.WW...e...WW.','.WW.......WW.'],
  // torch hall
  ['.F.........F.','.............','..XXX...XXX..','.....e.e.....','..XXX...XXX..','.............','.F.........F.'],
  // maze-lite
  ['.............','.X.X.X.X.X.X.','.............','..e.......e..','.............','.X.X.X.X.X.X.','.............'],
  // arena
  ['.............','.....XXX.....','....X...X....','...X..e..X...','....X...X....','.....XXX.....','.............'],
  // spike corners
  ['^^.........^^','^^....e....^^','.............','......e......','.............','^^....e....^^','^^.........^^'],
  // crescent
  ['....#####....','..##.....##..','.#....e....#.','.#.........#.','.#....e....#.','..##.....##..','....#####....'],
  // stacks
  ['.............','..###...###..','..###...###..','......e......','..###...###..','..###...###..','.............'],
  // pit edges
  ['ooo.......ooo','ooo...e...ooo','.............','......e......','.............','ooo...e...ooo','ooo.......ooo'],
  // gauntlet
  ['.............','.X.........X.','.X..e...e..X.','.X.........X.','.X..e...e..X.','.X.........X.','.............'],
  // cross
  ['......#......','......#......','..##########.','.............','.#####.#####.','......#......','......#......'],
  // mound + web
  ['.............','..M..W.W..M..','.....e.e.....','..W.......W..','.....e.e.....','..M..W.W..M..','.............'],
  // funnel
  ['.###########.','.#.........#.','..#..e.e..#..','...#.....#...','..#..e.e..#..','.#.........#.','.###########.'],
  // stepping stones
  ['ooo.ooo.ooo.o','.............','ooo.ooo.ooo.o','......e......','ooo.ooo.ooo.o','.............','ooo.ooo.ooo.o'],
  // bunker
  ['.............','...XXXXXXX...','...X.....X...','...X..e..X...','...X.....X...','...XXXXXXX...','.............'],
  // sparse spikes
  ['.............','..^..^.^..^..','.....e.e.....','..^.......^..','.....e.e.....','..^..^.^..^..','.............'],
  // twin rings
  ['.............','..###...###..','..#.#...#.#..','..###...###..','......e......','.....e.e.....','.............'],
  // slalom
  ['.....X.......','.....X....e..','..X..X..X....','..X.....X....','..X..X..X....','..e..X.......','.....X.......'],
  // pit ring
  ['.............','...ooooooo...','...o.....o...','...o..e..o...','...o.....o...','...ooooooo...','.............'],
  // rubble
  ['..#.#...#.#..','.#..#...#..#.','..#..e.e..#..','.............','..#..e.e..#..','.#..#...#..#.','..#.#...#.#..'],
  // long blocks
  ['.............','.XXXXXXXXXXX.','.............','......e......','.............','.XXXXXXXXXXX.','.............'],
  // clean
  ['.............','.............','..e.......e..','.............','..e.......e..','.............','.............']
];

/** Boss rooms are always open, with a little scenery. */
export const BOSS_LAYOUTS = [
  ['.............','.............','.............','.............','.............','.............','.............'],
  ['.F.........F.','.............','.............','.............','.............','.............','.F.........F.'],
  ['.............','..X.......X..','.............','.............','.............','..X.......X..','.............'],
  ['^^.........^^','.............','.............','.............','.............','.............','^^.........^^']
];

const SPECIAL_OPEN = ['.............','.............','.............','.............','.............','.............','.............'];

/** Which characters are solid to a walking entity. */
export const SOLID = new Set(['#', 'X', 'M']);
export const PIT = 'o';

/**
 * Turn a layout into the cell grid a room uses at runtime.
 * Returns { cells:Uint8Array-ish 2D array of chars, spawns:[{cx,cy}] }
 */
export function buildCells(layout){
  const cells = layout.map(r => r.padEnd(GRID_W, '.').slice(0, GRID_W).split(''));
  while (cells.length < GRID_H) cells.push('.'.repeat(GRID_W).split(''));
  const spawns = [];
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++)
      if (cells[y][x] === 'e'){ spawns.push({ cx:x, cy:y }); cells[y][x] = '.'; }
  return { cells, spawns };
}

/** Blast the cells in front of every door so an exit is never blocked. */
export function clearDoorways(cells){
  const mx = (GRID_W - 1) / 2 | 0, my = (GRID_H - 1) / 2 | 0;
  const open = (x, y) => { if (cells[y] && cells[y][x] !== undefined) cells[y][x] = '.'; };
  for (let d = 0; d < 2; d++){
    open(mx, d); open(mx, GRID_H - 1 - d);
    open(d, my); open(GRID_W - 1 - d, my);
  }
  open(mx, my);
  return cells;
}

/** Free cells, avoiding the middle band so nothing spawns on top of you. */
export function freeCells(cells, { avoidCentre = false } = {}){
  const out = [];
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++){
      const c = cells[y][x];
      if (c !== '.' ) continue;
      if (avoidCentre && Math.abs(x - 6) < 2 && Math.abs(y - 3) < 2) continue;
      out.push({ cx:x, cy:y });
    }
  return out;
}

/**
 * Pick a layout for a room. Special rooms are always open so their contents
 * are reachable; normal rooms draw from the template list.
 */
export function layoutFor(type, rng, depth){
  if (type === 'boss') return BOSS_LAYOUTS[(rng() * BOSS_LAYOUTS.length) | 0];
  if (type !== 'normal' && type !== 'challenge' && type !== 'miniboss') return SPECIAL_OPEN;
  const pool = LAYOUTS.filter((_, i) => depth > 1 || i < 22);   // gentler openers on floor 1
  return pool[(rng() * pool.length) | 0];
}

/**
 * How much enemy "weight" a room should hold. Deliberately gentle early —
 * a first floor that mobs you is the fastest way to lose a player.
 */
export function budgetFor(depth, type, rng){
  if (type === 'challenge') return 8 + depth * 2.5;
  if (type === 'miniboss') return 6 + depth * 2;
  const base = 2.2 + depth * 1.35;
  return base * (0.75 + rng() * 0.6);
}
