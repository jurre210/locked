/**
 * The guest's view of a hosted game.
 *
 * The renderer reads a Game; this rebuilds the same shape out of a snapshot so
 * the guest can reuse the exact same drawing code rather than a second,
 * inevitably-divergent renderer.
 */
import { ENEMIES } from './enemies.js';
import { BOSSES } from './bosses.js';
import { BY_ID, TRINKET_BY_ID, CARDS } from './items.js';
import { CHAR_BY_ID } from './characters.js';
import { buildCharacter } from './mobs-art.js';
import { THEMES } from './art.js';
import { drawFrame } from './render.js';
import { sfx } from './sfx.js';

const BOSS_BY = Object.fromEntries(BOSSES.map(b => [b.id, b]));

export class RemoteGame {
  constructor(charIds){
    this.time = 0;
    this.shakeT = 0; this.shakeMag = 0;
    this.enemies = []; this.tears = []; this.bombs = []; this.pickups = [];
    this.props = []; this.hazards = []; this.particles = []; this.blasts = [];
    this.waves = []; this.floaters = []; this.familiars = []; this.decoys = [];
    this.banner = null; this.toast = null; this.bossRef = null;
    this.mapHeld = false; this.showFullMap = false; this.showSecrets = false;
    this.over = false; this.won = false;
    this.connected = false;

    this.arts = charIds.map(id => buildCharacter(CHAR_BY_ID[id] || CHAR_BY_ID.wren));
    this.players = charIds.map((id, i) => ({
      index:i, x:0, y:0, facing:'down', flip:false, walkT:0,
      red:0, soul:0, black:0, maxRed:0, coins:0, bombs:0, keys:0,
      invuln:0, hitFlash:0, dead:false, charge:0, chargeShot:0,
      active:null, trinket:null, card:null, pill:null,
      art:this.arts[i], temp:{}, flags:{}, orbitals:[], stats:{}
    }));

    this.floor = { theme:'cellar', name: THEMES.cellar.name, depth:0, curse:null, rooms:new Map() };
    this.room = { key:0, type:'start', cleared:true, seed:1, doors:{}, cells:blankCells() };
  }

  applyFloor(f){
    const rooms = new Map();
    for (const [gx, gy, key, type, visited, seen, hidden] of f.rooms){
      rooms.set(key, { gx, gy, key, type, visited:!!visited, seen:!!seen, hidden:!!hidden, doors:{} });
    }
    this.floor = {
      theme:f.theme, name:f.name, depth:f.depth,
      curse:f.curse, rooms
    };
  }

  apply(s){
    this.time = s.t;
    this.shakeT = s.sh; this.shakeMag = s.sm;
    this.over = !!s.ov; this.won = s.ov === 2;

    let room = this.floor.rooms.get(s.rm);
    if (!room){ room = { gx:0, gy:0, key:s.rm, type:'normal', visited:true, seen:true, doors:{} }; this.floor.rooms.set(s.rm, room); }
    room.visited = true;
    room.cleared = s.cl;
    room.seed = s.rm;
    room.cells = s.ce.map(r => r.split(''));
    room.doors = Object.fromEntries(Object.entries(s.dr).map(([d, v]) =>
      [d, { kind:v[0], open:!!v[1], locked:!!v[2], hidden:!!v[3], revealed:!!v[4], to:0 }]));
    this.room = room;

    s.pl.forEach((a, i) => {
      const p = this.players[i];
      if (!p) return;
      [p.x, p.y, p.facing] = [a[0], a[1], a[2]];
      p.flip = !!a[3]; p.walkT = a[4];
      p.red = a[5]; p.soul = a[6]; p.black = a[7]; p.maxRed = a[8];
      p.coins = a[9]; p.bombs = a[10]; p.keys = a[11];
      p.invuln = a[12]; p.hitFlash = a[13]; p.dead = !!a[14]; p.charge = a[15];
      p.active = a[16] ? BY_ID[a[16]] : null;
      p.trinket = a[17] ? TRINKET_BY_ID[a[17]] : null;
      p.card = a[18] ? CARDS[0] : null;
      p.pill = a[19] >= 0 ? { variant:a[19] } : null;
      p.chargeShot = a[20];
      p.temp.berserk = a[21];
    });

    this.enemies = s.en.map(a => {
      const isBoss = typeof a[2] === 'string' && a[2][0] === 'B';
      const def = isBoss ? BOSS_BY[a[2].slice(1)] : ENEMIES[a[2]];
      return {
        x:a[0], y:a[1], def: def || ENEMIES.grub, id:a[2],
        hp:a[3], maxHp:a[4], flash:a[5], deathT:a[6], frozen:a[7], charmed:a[8],
        poison:a[9], burn:a[10], rot:a[11], lift:a[12], charging:!!a[13],
        beam: a[14] ? { a:a[14][0], len:a[14][1], colour:a[14][2] || undefined } : null,
        scaleMul:a[15], vx: a[16] ? -1 : 0, vy:0,
        r:(def && def.r) || 11, pal:(def && def.pal) || ['#c96', '#843', '#fda', '#310']
      };
    });

    this.tears = s.te.map(a => ({ x:a[0], y:a[1], colour:a[2], hi:a[3], big:!!a[4], scale:a[5] }));
    this.bombs = s.bo.map(a => ({ x:a[0], y:a[1], fuse:a[2] }));
    this.pickups = s.pk.map(a => ({ x:a[0], y:a[1], kind:a[2], variant:a[3], price:a[4] < 0 ? null : a[4], priceKind:a[5], seed:a[0] * 0.1 }));
    this.props = s.pr.map(a => ({
      x:a[0], y:a[1], kind:a[2], item:a[3] ? BY_ID[a[3]] : null,
      price:a[4] < 0 ? null : a[4], priceKind:a[5] || 'coin', open:!!a[6], locked:!!a[7]
    }));
    this.hazards = s.hz.map(a => ({ x:a[0], y:a[1], kind:a[2], r:a[3], life:a[4], maxLife:a[5] }));
    this.blasts = s.bl.map(a => ({ x:a[0], y:a[1], r:a[2], t:a[3] }));
    this.waves = s.wv.map(a => ({ x:a[0], y:a[1], r:a[2], t:a[3], colour:a[4] }));
    this.floaters = s.fl.map(a => ({ x:a[0], y:a[1], text:a[2], colour:a[3], life:a[4], maxLife:a[5] }));
    this.particles = s.pa.map(a => ({ x:a[0], y:a[1], life:a[2], maxLife:a[3], size:a[4], colour:a[5] }));
    this.familiars = s.fa.map(a => ({ x:a[0], y:a[1], art:a[2], pal:a[3], seed:a[4] }));

    this.bossRef = s.bs ? { hp:s.bs[0], maxHp:s.bs[1], def:{ name:s.bs[2] } } : null;
    this.banner = s.bn ? { title:s.bn[0], sub:s.bn[1], t:s.bn[2] } : null;
    this.toast = s.to ? { title:s.to[0], sub:s.to[1], t:s.to[2] } : null;
  }

  /** The guest still animates locally between snapshots so it never looks like a slideshow. */
  tick(dt){
    this.time += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.banner) this.banner.t -= dt;
    if (this.toast) this.toast.t -= dt;
    for (const p of this.players) if (!p.dead) p.walkT += dt * 4;
    for (const b of this.blasts) b.t = Math.min(1, b.t + dt * 3.4);
    for (const w of this.waves) w.t = Math.min(1, w.t + dt * 2.6);
  }

  render(ctx){ drawFrame(ctx, this); }
}

function blankCells(){
  return Array.from({ length: 7 }, () => '.............'.split(''));
}

export { sfx };
