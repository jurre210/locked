/**
 * The game: state, the fixed-step loop, and the API that items, enemies and
 * bosses call into.
 *
 * Everything an item can do is a method on this class rather than a special
 * case in the loop, so adding an item never means touching the loop.
 */
import {
  CELL, GRID_W, GRID_H, WALL, ROOM_X, ROOM_Y, ROOM_W, ROOM_H, VW, VH, THEMES
} from './art.js';
import { buildCharacter } from './mobs-art.js';
import { Player } from './player.js';
import { ENEMIES, poolForDepth } from './enemies.js';
import { BOSSES, bossesForDepth } from './bosses.js';
import { generateFloor, markSeen, FLOOR_COUNT } from './floor.js';
import { freeCells, budgetFor } from './rooms.js';
import { ITEMS, BY_ID, TRINKETS, CARDS, PILL_EFFECTS, poolOf } from './items.js';
import { CHAR_BY_ID } from './characters.js';
import { PILL_COLOURS } from './art.js';
import { drawFrame, DOOR_POS } from './render.js';
import { sfx } from './sfx.js';
import { seeded } from '../../core/ui.js';

const OPP = { n:'s', s:'n', e:'w', w:'e' };
const DIRV = { n:[0,-1], s:[0,1], e:[1,0], w:[-1,0] };

export class Game {
  constructor(opts){
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.input = opts.input;
    this.mode = opts.mode;                 // { id, hard, seeded, endless, bossRush, challenge }
    this.seedValue = opts.seed >>> 0 || (Math.random() * 0x7fffffff) >>> 0;
    this.rng = seeded(this.seedValue);
    this.sfx = sfx;
    this.onEnd = opts.onEnd || (() => {});
    this.net = opts.net || null;

    this.time = 0;
    this.depth = 0;
    this.paused = false;
    this.over = false;
    this.won = false;
    this.shakeT = 0; this.shakeMag = 0;
    this.timers = [];
    this.stats = { kills:0, damageTaken:0, itemsTaken:0, roomsCleared:0, floors:1, started: performance.now() };
    this.usedBosses = new Set();

    this.players = (opts.chars || ['wren']).map((id, i) => {
      const p = new Player(CHAR_BY_ID[id] || CHAR_BY_ID.wren, i, this);
      return p;
    });

    this.reset();
    this.setupPlayers();
    this.enterFloor(0);
  }

  reset(){
    this.enemies = []; this.tears = []; this.bombs = []; this.pickups = [];
    this.props = []; this.hazards = []; this.particles = []; this.blasts = [];
    this.waves = []; this.floaters = []; this.familiars = []; this.decoys = [];
    this.banner = null; this.toast = null;
    this.bossRef = null;
    this.showFullMap = false; this.showSecrets = false; this.mapHeld = false;
    this.timeStopT = 0;
  }

  /* ---------------------------------------------------------------- */
  /* setup                                                            */
  /* ---------------------------------------------------------------- */
  setupPlayers(){
    for (const p of this.players){
      const d = p.def;
      for (const id of d.items || []){
        if (id === 'random') p.addItem(this.rollItem('treasure'), { silent:true });
        else p.addItem(id, { silent:true });
      }
      if (d.active) p.addItem(d.active === 'random' ? this.rollItem('treasure', 'active') : BY_ID[d.active], { silent:true });
      if (d.card) p.card = this.rollCard();
      p.recompute();
    }
    // the pill colour -> effect mapping is fixed for a run, not for a pickup
    this.pillMap = PILL_COLOURS.map((_, i) => PILL_EFFECTS[i % PILL_EFFECTS.length]);
    for (let i = this.pillMap.length - 1; i > 0; i--){
      const j = (this.rng() * (i + 1)) | 0;
      [this.pillMap[i], this.pillMap[j]] = [this.pillMap[j], this.pillMap[i]];
    }
  }

  enterFloor(depth){
    this.depth = depth;
    this.stats.floors = depth + 1;
    this.floor = generateFloor(depth, this.rng, {
      hard: this.mode.hard,
      extraRooms: this.mode.endless ? 3 : 0,
      noSpecial: this.mode.bossRush,
      noCurses: this.mode.id === 'daily' ? false : false
    });
    this.reset();
    for (const p of this.players){
      p.run('floor');
      p.wardUsed = false;
      if (p.flags.fullMap) this.revealMap(true);
      if (p.flags.seeSecret) this.revealMap(false, true);
    }
    this.enterRoom(this.floor.start, null);
    this.banner = { title: this.floor.name, sub: this.floor.curse ? this.floor.curse.desc : `floor ${depth + 1} of ${FLOOR_COUNT}`, t: 2.4 };
    if (depth > 0) sfx.descend();
  }

  /* ---------------------------------------------------------------- */
  /* rooms                                                            */
  /* ---------------------------------------------------------------- */
  enterRoom(room, fromDir){
    this.room = room;
    room.visited = true;
    markSeen(room, this.floor.rooms);

    this.enemies = []; this.tears = []; this.bombs = [];
    this.hazards = []; this.particles = []; this.blasts = []; this.waves = [];
    this.decoys = []; this.bossRef = null;
    this.pickups = room.live?.pickups || [];
    this.props = room.live?.props || [];
    this.slowFactor = 1;

    if (!room.live){ this.populate(room); }
    else if (!room.cleared){ this.spawnFrom(room.live.enemies); }

    // place the players just inside the door they came through
    const spots = this.entrySpots(fromDir);
    this.players.forEach((p, i) => {
      if (p.dead) return;
      const s = spots[i % spots.length];
      p.x = s.x; p.y = s.y;
      p.vx = p.vy = 0;
    });

    this.updateDoors();
    if (room.type === 'boss' && !room.cleared){
      sfx.boss();
      this.banner = { title: this.bossName || '', sub:'', t: 1.6 };
    }
  }

  entrySpots(dir){
    const cx = ROOM_X + ROOM_W / 2, cy = ROOM_Y + ROOM_H / 2;
    if (!dir) return [{ x:cx, y:cy }, { x:cx - 26, y:cy }, { x:cx + 26, y:cy }, { x:cx, y:cy + 26 }];
    const inset = 34;
    const base = {
      n: { x:cx, y:ROOM_Y + inset }, s: { x:cx, y:ROOM_Y + ROOM_H - inset },
      w: { x:ROOM_X + inset, y:cy }, e: { x:ROOM_X + ROOM_W - inset, y:cy }
    }[dir];
    const perp = dir === 'n' || dir === 's' ? [1, 0] : [0, 1];
    return [0, -1, 1, -2].map(k => ({ x: base.x + perp[0] * k * 22, y: base.y + perp[1] * k * 22 }));
  }

  /** First visit: roll the room's contents and remember them. */
  populate(room){
    const rng = seeded(room.seed);
    room.live = { enemies: [], pickups: [], props: [] };
    this.pickups = room.live.pickups;
    this.props = room.live.props;

    const centre = { x: ROOM_X + ROOM_W / 2, y: ROOM_Y + ROOM_H / 2 };

    switch (room.type){
      case 'start': room.cleared = true; break;

      case 'treasure': {
        const item = this.rollItem('treasure');
        this.addProp({ kind:'pedestal', x:centre.x, y:centre.y, item, price:null });
        room.cleared = true;
        break;
      }
      case 'shop': {
        this.addProp({ kind:'shopkeep', x:centre.x, y:ROOM_Y + 40 });
        const n = this.anyFlag('bigShop') ? 5 : 4;
        for (let i = 0; i < n; i++){
          const x = ROOM_X + ROOM_W * (i + 1) / (n + 1);
          const y = centre.y + 26;
          if (rng() < 0.42){
            const kind = ['heartRed', 'bomb', 'key', 'coin', 'pill', 'card', 'battery'][(rng() * 7) | 0];
            this.spawnPickup(kind, x, y, { price: this.priceOf(kind) });
          } else {
            this.addProp({ kind:'pedestal', x, y, item:this.rollItem('shop'), price:this.discount(15), priceKind:'coin' });
          }
        }
        room.cleared = true;
        break;
      }
      case 'boss': {
        const all = this.mode.bossRush ? BOSSES.filter(b => !b.final) : bossesForDepth(this.depth);
        // depth bands overlap, so without this the same boss can headline three
        // floors running — fall back to the full band only once it is exhausted
        const fresh = all.filter(b => !this.usedBosses.has(b.id));
        const pool = fresh.length ? fresh : all;
        let def = this.depth >= FLOOR_COUNT - 1 && !this.mode.endless
          ? BOSSES.find(b => b.final)
          : pool[(rng() * pool.length) | 0];
        if (!def) def = BOSSES[0];
        this.usedBosses.add(def.id);
        this.bossName = def.name;
        room.live.enemies.push({ boss: def.id, x:centre.x, y:centre.y - 10 });
        for (const s of def.spawnWith || []){
          for (let i = 0; i < s.n; i++)
            room.live.enemies.push({ boss: def.id, x:centre.x + (i ? 70 : -70), y:centre.y + 20, pal: s.pal, mirror:true });
        }
        this.spawnFrom(room.live.enemies);
        break;
      }
      case 'secret': {
        const roll = rng();
        if (roll < 0.4) this.addProp({ kind:'chest', x:centre.x, y:centre.y, locked:false });
        else if (roll < 0.7) this.spawnPickup(this.randomPickup(rng), centre.x, centre.y);
        else this.addProp({ kind:'pedestal', x:centre.x, y:centre.y, item:this.rollItem('secret') });
        this.spawnPickup('bomb', centre.x - 30, centre.y);
        room.cleared = true;
        break;
      }
      case 'supersecret': {
        this.addProp({ kind:'pedestal', x:centre.x, y:centre.y, item:this.rollItem('treasure') });
        this.spawnTrinket(centre.x + 40, centre.y, rng);
        room.cleared = true;
        break;
      }
      case 'curse': {
        this.addProp({ kind:'pedestal', x:centre.x, y:centre.y, item:this.rollItem('curse'), price:2, priceKind:'heart' });
        room.cleared = true;
        break;
      }
      case 'sacrifice': {
        this.addProp({ kind:'altar', x:centre.x, y:centre.y, uses:0 });
        room.cleared = true;
        break;
      }
      case 'arcade': {
        this.addProp({ kind:'slot', x:centre.x - 60, y:centre.y, price:5, kindOf:'item' });
        this.addProp({ kind:'slot', x:centre.x + 60, y:centre.y, price:3, kindOf:'pickup' });
        this.addProp({ kind:'beggar', x:centre.x, y:centre.y - 34, want:'coin', paid:0 });
        room.cleared = true;
        break;
      }
      case 'library': {
        for (let i = 0; i < 2; i++)
          this.addProp({ kind:'pedestal', x:centre.x + (i ? 56 : -56), y:centre.y, item:this.rollItem('treasure', 'active') });
        room.cleared = true;
        break;
      }
      case 'planetarium': {
        this.addProp({ kind:'pedestal', x:centre.x, y:centre.y, item:this.rollItem('planetarium') });
        room.cleared = true;
        break;
      }
      case 'devil': case 'angel': {
        const pool = room.type === 'devil' ? 'devil' : 'angel';
        for (let i = 0; i < 2; i++){
          const item = this.rollItem(pool);
          const price = room.type === 'devil'
            ? (this.anyFlag('cheapDeals') ? 1 : (item.q >= 4 ? 2 : 1))
            : 0;
          this.addProp({ kind:'pedestal', x:centre.x + (i ? 60 : -60), y:centre.y, item,
            price, priceKind: room.type === 'devil' ? 'heart' : null });
        }
        room.cleared = true;
        break;
      }
      case 'challenge': case 'miniboss': {
        this.rollEnemies(room, rng, room.type);
        room.reward = room.type === 'challenge' ? this.rollItem('treasure') : null;
        break;
      }
      default:
        this.rollEnemies(room, rng, 'normal');
    }

    // scenery pickups behind rocks
    if (room.type === 'normal' && rng() < 0.3){
      const cells = freeCells(room.cells, { avoidCentre:true });
      if (cells.length){
        const c = cells[(rng() * cells.length) | 0];
        this.spawnPickup(this.randomPickup(rng), ROOM_X + c.cx * CELL + CELL / 2, ROOM_Y + c.cy * CELL + CELL / 2);
      }
    }
    if (room.type === 'normal' && rng() < 0.12){
      const cells = freeCells(room.cells, { avoidCentre:true });
      if (cells.length){
        const c = cells[(rng() * cells.length) | 0];
        this.addProp({ kind:'chest', x:ROOM_X + c.cx * CELL + CELL / 2, y:ROOM_Y + c.cy * CELL + CELL / 2, locked: rng() < 0.45, mimic: rng() < 0.12 });
      }
    }
  }

  rollEnemies(room, rng, kind){
    const pool = poolForDepth(this.depth);
    let budget = budgetFor(this.depth, kind, rng) * (this.mode.hard ? 1.35 : 1);
    const cells = freeCells(room.cells, { avoidCentre:true });
    const spots = room.spawns.length ? room.spawns.slice() : [];
    let guard = 0;
    while (budget > 0.6 && guard++ < 40){
      const def = pool[(rng() * pool.length) | 0];
      if (def.w > budget + 0.8) { budget -= 0.5; continue; }
      const spot = spots.length ? spots.splice((rng() * spots.length) | 0, 1)[0]
        : cells.length ? cells[(rng() * cells.length) | 0] : null;
      if (!spot) break;
      room.live.enemies.push({
        id: def.id,
        x: ROOM_X + spot.cx * CELL + CELL / 2 + (rng() - .5) * 8,
        y: ROOM_Y + spot.cy * CELL + CELL / 2 + (rng() - .5) * 8
      });
      budget -= def.w;
    }
    this.spawnFrom(room.live.enemies);
  }

  spawnFrom(list){
    for (const e of list) this.makeEnemy(e);
  }

  makeEnemy(spec){
    const def = spec.boss ? BOSSES.find(b => b.id === spec.boss) : ENEMIES[spec.id];
    if (!def) return null;
    const hpScale = (this.mode.hard ? 1.3 : 1) * (this.floor?.curse?.id === 'hunger' ? 1.25 : 1)
      * (1 + this.depth * (def.isBoss ? 0.14 : 0.08))
      * (this.players.length > 1 ? 1 + (this.players.length - 1) * 0.45 : 1);
    const e = {
      def, id: def.id, x: spec.x, y: spec.y, vx:0, vy:0,
      r: def.r || 11, hp: def.hp * hpScale, maxHp: def.hp * hpScale,
      flash:0, deathT:0, frozen:0, charmed:0, poison:0, poisonT:0, burn:0, burnT:0,
      stun:0, lift:0, rot:0, pal: spec.pal || def.pal, mirror: !!spec.mirror,
      flying: !!def.flying, phase: def.phase, host:null, scaleMul:1
    };
    this.enemies.push(e);
    if (def.isBoss && !this.bossRef) this.bossRef = e;
    return e;
  }

  updateDoors(){
    const open = this.room.cleared;
    for (const d of Object.values(this.room.doors)) d.open = open;
  }

  roomEnemies(){ return this.enemies.filter(e => e.hp > 0 && e.charmed <= 0 && !e.ally); }

  checkClear(){
    if (this.room.cleared) return;
    if (this.roomEnemies().length) return;
    this.room.cleared = true;
    this.stats.roomsCleared++;
    this.updateDoors();
    sfx.clear();
    for (const p of this.players){ p.run('clear', { cx: ROOM_X + ROOM_W / 2, cy: ROOM_Y + ROOM_H / 2 }); p.chargeUp(1); }

    const cx = ROOM_X + ROOM_W / 2, cy = ROOM_Y + ROOM_H / 2;
    if (this.room.type === 'boss'){
      this.onBossCleared(cx, cy);
    } else if (this.room.type === 'challenge' && this.room.reward){
      this.addProp({ kind:'pedestal', x:cx, y:cy, item:this.room.reward });
      this.room.reward = null;
    } else if (this.room.type === 'miniboss'){
      this.spawnPickup(this.rng() < 0.5 ? 'heartSoul' : 'trinket', cx, cy);
    } else if (this.rng() < 0.28){
      this.spawnPickup(this.randomPickup(), cx, cy);
    }
  }

  onBossCleared(cx, cy){
    this.stats.bossKills = (this.stats.bossKills || 0) + 1;
    if (this.mode.bossRush){
      this.spawnPickup('heartSoul', cx - 24, cy);
      if (this.depth >= 4){ this.win(); return; }
      this.addProp({ kind:'trapdoor', x:cx, y:cy + 30 });
      return;
    }
    if (this.depth >= FLOOR_COUNT - 1){ this.win(); return; }

    this.addProp({ kind:'pedestal', x:cx, y:cy, item:this.rollItem('boss') });
    this.addProp({ kind:'trapdoor', x:cx, y:cy + 54 });
    this.spawnPickup('heartSoul', cx - 50, cy + 20);
    if (this.anyFlag('bossHeart')) this.spawnPickup('heartRed', cx + 50, cy + 20);

    // the deal room only appears if you have not already taken one this run
    if (!this.floor.dealTaken && this.rng() < (this.dealChance())){
      const dir = this.freeDoorDir(this.room);
      if (dir){
        const angel = this.rng() < (this.angelChance());
        const r = this.makeSideRoom(angel ? 'angel' : 'devil', dir);
        if (r){
          this.room.doors[dir] = { to:r.key, kind: angel ? 'angel' : 'devil', open:true };
          this.floor.dealTaken = true;
          this.toastMsg(angel ? 'a door opens above' : 'a door opens below', '');
        }
      }
    }
  }

  dealChance(){ return this.players.some(p => p.red < p.maxRed) ? 0.9 : 0.7; }
  angelChance(){ return this.dealsTaken ? 0.25 : 0.45; }

  freeDoorDir(room){
    for (const d of ['n', 'e', 'w', 's']){
      if (room.doors[d]) continue;
      const [dx, dy] = DIRV[d];
      const gx = room.gx + dx, gy = room.gy + dy;
      if (gx < 0 || gy < 0) continue;
      if ([...this.floor.rooms.values()].some(r => r.gx === gx && r.gy === gy)) continue;
      return d;
    }
    return null;
  }

  makeSideRoom(type, dir){
    const [dx, dy] = DIRV[dir];
    const gx = this.room.gx + dx, gy = this.room.gy + dy;
    const key = gy * 13 + gx;
    const r = {
      gx, gy, key, type, doors:{}, neigh:[this.room],
      cleared:true, visited:false, seen:true, dist:this.room.dist + 1,
      seed:(this.rng() * 0x7fffffff) | 0,
      cells: Array.from({ length: GRID_H }, () => '.'.repeat(GRID_W).split('')),
      spawns:[], live:null
    };
    r.doors[OPP[dir]] = { to:this.room.key, kind:type, open:true };
    this.floor.rooms.set(key, r);
    this.room.neigh.push(r);
    return r;
  }

  /* ---------------------------------------------------------------- */
  /* main loop                                                        */
  /* ---------------------------------------------------------------- */
  /**
   * @param {boolean} allowEdges whether one-shot inputs (bomb, active, card)
   *   may fire this step. The loop runs several fixed steps per rendered frame
   *   but the keyboard's edge flags only clear once per frame, so without this
   *   a single tap spends up to five bombs.
   */
  update(dt, allowEdges = true){
    this.allowEdges = allowEdges;
    if (this.over) { this.time += dt; this.tickCosmetics(dt); return; }
    this.time += dt;
    if (this.banner) this.banner.t -= dt;
    if (this.toast) this.toast.t -= dt;
    this.shakeT = Math.max(0, this.shakeT - dt);

    for (let i = this.timers.length - 1; i >= 0; i--){
      this.timers[i].t -= dt;
      if (this.timers[i].t <= 0){ this.timers[i].fn(); this.timers.splice(i, 1); }
    }

    const frozen = this.timeStopT > 0;
    if (frozen) this.timeStopT -= dt;

    this.updatePlayers(dt);
    this.updateFamiliars(dt);
    if (!frozen) this.updateEnemies(dt);
    else for (const e of this.enemies){ e.flash = Math.max(0, e.flash - dt); e.deathT = Math.max(0, e.deathT - dt); }
    this.updateTears(dt);
    this.updateBombs(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateProps(dt);
    this.tickCosmetics(dt);
    this.checkClear();
    this.checkDoors();
  }

  tickCosmetics(dt){
    for (let i = this.particles.length - 1; i >= 0; i--){
      const p = this.particles[i];
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
      p.vy += (p.grav || 0) * dt * 60;
      p.vx *= 0.94; p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.blasts.length - 1; i >= 0; i--){
      this.blasts[i].t += dt * 3.4;
      if (this.blasts[i].t >= 1) this.blasts.splice(i, 1);
    }
    for (let i = this.waves.length - 1; i >= 0; i--){
      this.waves[i].t += dt * 2.6;
      if (this.waves[i].t >= 1) this.waves.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--){
      const f = this.floaters[i];
      f.y -= dt * 22; f.life -= dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.decoys.length - 1; i >= 0; i--){
      this.decoys[i].t -= dt;
      if (this.decoys[i].t <= 0) this.decoys.splice(i, 1);
    }
  }

  /* ---------------- players ---------------- */
  updatePlayers(dt){
    this.mapHeld = false;
    this.players.forEach((p, i) => {
      if (p.dead) return;
      const inp = p.remote
        ? (p.netInput || { mx:0, my:0, ax:0, ay:0 })
        : this.input.read(p.localSlot ?? i, { px:p.x, py:p.y, vw:VW, vh:VH });
      if (inp.map) this.mapHeld = true;
      if (this.net && this.net.isClient && p.local) this.net.sendInput(inp);

      p.update(dt, inp);
      this.moveEntity(p, dt, { flying: !!p.flags.fly, spectral: !!p.flags.fly });

      if (inp.active && this.allowEdges) p.useActive();
      if (inp.bomb && this.allowEdges) this.dropBomb(p);
      if (inp.card && this.allowEdges) this.useConsumable(p);
      if (inp.drop && this.allowEdges && p.trinket){
        const t = p.setTrinket(null);
        if (t) this.spawnPickup('trinket', p.x, p.y + 12, { trinket:t });
      }

      // contact damage both ways
      for (const e of this.enemies){
        if (e.hp <= 0 || e.charmed > 0 || e.ally) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < e.r + p.r - 2){
          if (p.temp.berserk > 0){ this.damageEnemy(e, p.stats.damage * 2.2 * dt * 6, p, { silentSfx:true }); }
          else {
            if (p.flags.thorns) this.damageEnemy(e, (p.flags.thorns || 1) * 6 * dt, p, { silentSfx:true });
            p.hurt(1);
          }
        }
      }
      // hazards under foot
      for (const h of this.hazards){
        if (Math.hypot(h.x - p.x, h.y - p.y) > h.r) continue;
        if (h.kind === 'web') p.slow = 0.45;
        else if (h.kind === 'slime') p.slow = 0.6;
        else if (h.kind === 'fire' && !p.flags.fireProof) p.hurt(1);
        else if (h.kind === 'poison') p.hurt(1);
      }
      // spikes
      const c = this.cellAt(p.x, p.y);
      if (c === '^' && !p.flags.spikeProof && !p.flags.fly) p.hurt(1);
    });

    if (this.players.every(p => p.dead) && !this.over) this.gameOver();
  }

  /* ---------------- enemies ---------------- */
  updateEnemies(dt){
    for (let i = this.enemies.length - 1; i >= 0; i--){
      const e = this.enemies[i];
      e.flash = Math.max(0, e.flash - dt);

      if (e.hp <= 0){
        e.deathT -= dt;
        if (e.deathT <= 0) this.enemies.splice(i, 1);
        continue;
      }

      if (e.frozen > 0){ e.frozen -= dt; e.vx *= 0.6; e.vy *= 0.6; this.moveEntity(e, dt, e); continue; }
      if (e.stun > 0){ e.stun -= dt; e.vx *= 0.8; e.vy *= 0.8; this.moveEntity(e, dt, e); continue; }

      if (e.poison > 0){
        e.poisonT -= dt;
        if (e.poisonT <= 0){ e.poisonT = 0.5; this.damageEnemy(e, e.poison, null, { silentSfx:true, dot:true }); }
        e.poisonLeft = (e.poisonLeft ?? 3) - dt;
        if (e.poisonLeft <= 0) e.poison = 0;
      }
      if (e.burn > 0){
        e.burnT -= dt;
        if (e.burnT <= 0){ e.burnT = 0.4; this.damageEnemy(e, e.burn, null, { silentSfx:true, dot:true }); this.fx('ember', e.x, e.y); }
        e.burnLeft = (e.burnLeft ?? 2.5) - dt;
        if (e.burnLeft <= 0) e.burn = 0;
      }
      if (e.charmed > 0){ e.charmed -= dt; if (e.charmed <= 0) e.charmed = 0; }

      const slow = this.slowFactor * (this.anyFlag('slowRoom') ? this.flagValue('slowRoom') : 1);
      e.def.update(e, this, dt * slow);
      this.moveEntity(e, dt * slow, e);

      // charmed and allied enemies fight the rest of the room
      if (e.charmed > 0 || e.ally){
        const other = this.enemies.find(o => o !== e && o.hp > 0 && o.charmed <= 0 && !o.ally);
        if (other && Math.hypot(other.x - e.x, other.y - e.y) < e.r + other.r){
          this.damageEnemy(other, 8 * dt, null, { silentSfx:true });
        }
      }
    }
  }

  /* ---------------- movement + collision ---------------- */
  moveEntity(ent, dt, opts = {}){
    const k = dt * 60;
    const flying = opts.flying || opts.def?.flying;
    const spectral = opts.spectral || opts.phase || opts.def?.phase;
    const r = ent.r || 10;

    const tryMove = (dx, dy) => {
      const nx = ent.x + dx, ny = ent.y + dy;
      if (!this.blocked(nx, ent.y, r, flying, spectral)) ent.x = nx;
      else if (ent === this.bossRef || ent.def?.isBoss) ent.x = nx;
      if (!this.blocked(ent.x, ny, r, flying, spectral)) ent.y = ny;
      else if (ent === this.bossRef || ent.def?.isBoss) ent.y = ny;
    };
    tryMove(ent.vx * k, ent.vy * k);

    // room bounds
    const minX = ROOM_X + r, maxX = ROOM_X + ROOM_W - r;
    const minY = ROOM_Y + r, maxY = ROOM_Y + ROOM_H - r;
    let hitWall = false;
    if (ent.x < minX){ ent.x = minX; ent.vx = Math.abs(ent.vx) * 0.2; hitWall = true; }
    if (ent.x > maxX){ ent.x = maxX; ent.vx = -Math.abs(ent.vx) * 0.2; hitWall = true; }
    if (ent.y < minY){ ent.y = minY; ent.vy = Math.abs(ent.vy) * 0.2; hitWall = true; }
    if (ent.y > maxY){ ent.y = maxY; ent.vy = -Math.abs(ent.vy) * 0.2; hitWall = true; }
    if (hitWall && ent.def?.onWall) ent.def.onWall(ent, this);
    if (ent.airborne) ent.airborne = false;
  }

  cellAt(x, y){
    const cx = Math.floor((x - ROOM_X) / CELL), cy = Math.floor((y - ROOM_Y) / CELL);
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return 'X';
    return this.room.cells[cy][cx];
  }
  setCell(x, y, v){
    const cx = Math.floor((x - ROOM_X) / CELL), cy = Math.floor((y - ROOM_Y) / CELL);
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return;
    this.room.cells[cy][cx] = v;
  }

  /** Is a circle of radius r at (x,y) intersecting something solid? */
  blocked(x, y, r, flying, spectral){
    if (spectral) return false;
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]){
      const c = this.cellAt(x + ox * 0.7, y + oy * 0.7);
      if (c === '#' || c === 'X' || c === 'M') return true;
      if (c === 'o' && !flying) return true;
    }
    return false;
  }
  /** Public form used by enemy AI. */
  solid(x, y, flying){ return this.blocked(x, y, 6, flying, false); }

  checkDoors(){
    if (!this.room.cleared) return;
    for (const p of this.players){
      if (p.dead) continue;
      for (const [dir, door] of Object.entries(this.room.doors)){
        if (!door.open || door.locked) continue;
        if (door.hidden && !door.revealed) continue;
        const pos = DOOR_POS[dir];
        // Door centres sit inside the wall, but players are clamped to the room
        // interior — the closest reach is WALL/2 + radius, so the threshold along
        // the travel axis has to clear the wall, not just a few pixels.
        const vertical = dir === 'n' || dir === 's';
        const along  = vertical ? Math.abs(p.y - pos.y) : Math.abs(p.x - pos.x);
        const across = vertical ? Math.abs(p.x - pos.x) : Math.abs(p.y - pos.y);
        if (along > WALL + 6 || across > 24) continue;
        const target = this.floor.rooms.get(door.to);
        if (!target) continue;
        this.travel(target, dir);
        return;
      }
    }
  }

  travel(target, dir){
    // the maze curse occasionally sends you somewhere else entirely
    if (this.floor.curse?.id === 'maze' && this.rng() < 0.22){
      const list = [...this.floor.rooms.values()].filter(r => r !== this.room && !r.hidden);
      target = list[(this.rng() * list.length) | 0] || target;
    }
    sfx.door();
    this.enterRoom(target, OPP[dir]);
  }

  /* ---------------- shooting ---------------- */
  playerFire(p, ax, ay, opts = {}){
    const f = p.flags;
    const d = Math.hypot(ax, ay) || 1;
    let bx = ax / d, by = ay / d;
    const speed = p.stats.shotSpeed;
    const charged = opts.charged || 0;

    const dirs = [];
    const multi = f.multi || 0;
    if (f.quad){
      dirs.push([bx, by], [-bx, -by], [-by, bx], [by, -bx]);
    } else if (multi >= 2){
      for (let i = -1; i <= 1; i++){
        const a = Math.atan2(by, bx) + i * 0.2;
        dirs.push([Math.cos(a), Math.sin(a)]);
      }
    } else if (multi === 1){
      const a = Math.atan2(by, bx);
      dirs.push([Math.cos(a - 0.1), Math.sin(a - 0.1)], [Math.cos(a + 0.1), Math.sin(a + 0.1)]);
    } else dirs.push([bx, by]);

    if (f.extraShot && this.rng() < f.extraShot) dirs.push([bx, by]);

    const patient = f.patient && p.stillT > 1;
    for (const [dx, dy] of dirs){
      const spread = f.spray ? (this.rng() - 0.5) * 0.24 : 0;
      const a = Math.atan2(dy, dx) + spread;
      let dmg = p.stats.damage;
      if (patient) dmg *= 2;
      if (charged) dmg *= 1 + charged * 1.6;
      this.spawnTear(p, p.x, p.y - 4, Math.cos(a) * speed, Math.sin(a) * speed, {
        damage: dmg,
        big: f.big || charged > 0.6,
        range: p.stats.range * (charged ? 1.4 : 1)
      });
    }
    if (p.temp.mirrorQueue) p.temp.mirrorQueue.push({ t:0.35, ax:bx, ay:by });
    sfx.shoot(charged ? 0.6 : 1 + (this.rng() - 0.5) * 0.12);
    if (charged) sfx.bigShoot();
    p.run('fire');
  }

  spawnTear(owner, x, y, vx, vy, opts = {}){
    const f = owner.flags || {};
    const t = {
      owner, friendly: owner instanceof Player || owner.friendly, x, y, vx, vy,
      damage: opts.damage ?? (owner.stats?.damage || 3),
      range: opts.range ?? (owner.stats?.range || 280),
      travelled: 0, r: opts.big ? 7 : 5, big: !!opts.big,
      pierce: f.pierce || opts.pierce ? 99 : 0,
      spectral: !!(f.spectral || opts.spectral),
      homing: (f.homing || owner.temp?.cardHoming) ? 0.09 : (opts.homing || 0),
      bounce: f.bounce || 0,
      explosive: !!f.explosive,
      poison: !!(f.poison || opts.poison),
      burn: !!f.burn, freeze: !!(f.freeze || opts.freeze), charm: !!f.charm,
      chill: !!f.chill, chain: !!f.chain, burst: !!f.burst, patch: !!f.patch,
      knock: f.knock || 1, boomerang: !!f.boomerang, sniper: !!f.sniper, brawler: !!f.brawler,
      trail: !!f.trail, hits: new Set(),
      colour: opts.colour || (owner instanceof Player ? '#bfe4ff' : '#ff7a7a'),
      hi: opts.hi || (owner instanceof Player ? '#ffffff' : '#ffd0d0'),
      scale: opts.big ? 2 : 1.6, life: 6
    };
    if (f.explosive){ t.colour = '#3a3a48'; t.hi = '#ff8a3d'; }
    if (f.poison) { t.colour = '#8fd83a'; t.hi = '#d0f28a'; }
    if (f.freeze) { t.colour = '#8fc8f0'; t.hi = '#e0f2ff'; }
    if (f.burn)   { t.colour = '#ff8a3d'; t.hi = '#ffe0a0'; }
    this.tears.push(t);
    return t;
  }

  /** Enemy projectile. */
  shoot(src, vx, vy, opts = {}){
    const t = {
      owner: src, friendly:false, x:src.x, y:src.y, vx, vy,
      damage: opts.dmg ?? 1, range: opts.range || 480, travelled:0,
      r: opts.r || 5, big: !!opts.boss, pierce:0, spectral:false,
      homing: opts.homing || 0, bounce:0, explosive:false,
      poison: !!opts.poison, freeze: !!opts.freeze, burn:false, charm:false,
      hits:new Set(), knock:1, life:8,
      colour: opts.poison ? '#8fd83a' : opts.freeze ? '#8fc8f0' : opts.boss ? '#ff5c5c' : '#ff8a8a',
      hi: '#ffe0e0', scale: opts.boss ? 2 : 1.5
    };
    this.tears.push(t);
    return t;
  }

  updateTears(dt){
    const k = dt * 60;
    for (let i = this.tears.length - 1; i >= 0; i--){
      const t = this.tears[i];
      t.life -= dt;

      if (t.homing){
        const target = t.friendly ? this.nearestEnemy(t.x, t.y) : this.nearestPlayer(t.x, t.y);
        if (target){
          const dx = target.x - t.x, dy = target.y - t.y, d = Math.hypot(dx, dy) || 1;
          const s = Math.hypot(t.vx, t.vy);
          t.vx += (dx / d * s - t.vx) * t.homing * k;
          t.vy += (dy / d * s - t.vy) * t.homing * k;
        }
      }
      if (t.boomerang){
        t.bt = (t.bt || 0) + dt;
        if (t.bt > 0.42 && t.owner && !t.returning){
          const dx = t.owner.x - t.x, dy = t.owner.y - t.y, d = Math.hypot(dx, dy) || 1;
          const s = Math.hypot(t.vx, t.vy) || 4;
          t.vx += (dx / d * s - t.vx) * 0.12 * k;
          t.vy += (dy / d * s - t.vy) * 0.12 * k;
          if (d < 12){ this.tears.splice(i, 1); continue; }
        }
      }

      const px = t.x, py = t.y;
      t.x += t.vx * k; t.y += t.vy * k;
      const step = Math.hypot(t.x - px, t.y - py);
      t.travelled += step;

      if (t.trail && (t.tt = (t.tt || 0) + dt) > 0.09){
        t.tt = 0;
        const s = this.spawnTear(t.owner, px, py, t.vx * 0.5, t.vy * 0.5, { damage: t.damage * 0.4 });
        s.trail = false; s.range = 60;
      }
      if (t.patch && (t.pt = (t.pt || 0) + dt) > 0.12){ t.pt = 0; this.hazard('slime', t.x, t.y, 7, 1.6); }

      // walls
      const minX = ROOM_X + t.r, maxX = ROOM_X + ROOM_W - t.r;
      const minY = ROOM_Y + t.r, maxY = ROOM_Y + ROOM_H - t.r;
      let bounced = false;
      if (t.x < minX || t.x > maxX){ if (t.bounce > 0){ t.vx *= -1; t.x = Math.max(minX, Math.min(maxX, t.x)); t.bounce--; bounced = true; } else { this.tearDie(t, i); continue; } }
      if (t.y < minY || t.y > maxY){ if (t.bounce > 0){ t.vy *= -1; t.y = Math.max(minY, Math.min(maxY, t.y)); t.bounce--; bounced = true; } else { this.tearDie(t, i); continue; } }

      if (!t.spectral && !bounced){
        const c = this.cellAt(t.x, t.y);
        if (c === '#' || c === 'X' || c === 'M'){
          if (t.friendly && (c === '#' || c === 'M') && (t.explosive || t.big)) this.breakCell(t.x, t.y);
          if (t.bounce > 0){ t.vx *= -1; t.vy *= -1; t.bounce--; }
          else { this.tearDie(t, i); continue; }
        }
      }

      if (t.travelled > t.range || t.life <= 0){ this.tearDie(t, i); continue; }

      // hits
      if (t.friendly){
        for (const e of this.enemies){
          if (e.hp <= 0 || t.hits.has(e)) continue;
          if (e.charmed > 0 || e.ally) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) > e.r + t.r) continue;
          this.tearHit(t, e);
          if (!t.pierce){ this.tearDie(t, i); break; }
          t.hits.add(e);
        }
      } else {
        for (const p of this.players){
          if (p.dead) continue;
          if (Math.hypot(p.x - t.x, p.y - t.y) > p.r + t.r) continue;
          if (p.hurt(t.damage)) { }
          this.tearDie(t, i);
          break;
        }
        // familiars can body-block enemy fire
        for (const f of this.familiars){
          if (!f.blocks) continue;
          if (Math.hypot(f.x - t.x, f.y - t.y) > 9 + t.r) continue;
          if (f.reflect){ t.friendly = true; t.owner = f.owner; t.vx *= -1; t.vy *= -1; t.colour = '#bfe4ff'; }
          else this.tearDie(t, i);
          break;
        }
      }
    }
  }

  tearHit(t, e){
    const owner = t.owner instanceof Player ? t.owner : null;
    let dmg = t.damage;
    if (t.sniper && t.travelled > t.range * 0.75) dmg *= 2;
    if (t.brawler && t.travelled < 60) dmg *= 2;

    this.damageEnemy(e, dmg, owner);
    e.vx += t.vx * 0.12 * t.knock;
    e.vy += t.vy * 0.12 * t.knock;

    if (t.poison){ e.poison = Math.max(e.poison, dmg * 0.35); e.poisonLeft = 3; }
    if (t.burn){ e.burn = Math.max(e.burn, dmg * 0.3); e.burnLeft = 2.5; }
    if (t.chill) e.stun = Math.max(e.stun, 0.25);
    if (t.freeze && this.luckRoll(owner, 0.2, 0.03)){ e.frozen = 2.2; sfx.freeze(); }
    if (t.charm && this.luckRoll(owner, 0.16, 0.03)) e.charmed = 8;
    if (t.explosive) this.explode(t.x, t.y, 40, dmg * 1.2, owner);
    if (t.burst){
      for (let i = 0; i < 4; i++){
        const a = i / 4 * Math.PI * 2 + this.rng();
        const s = this.spawnTear(t.owner, t.x, t.y, Math.cos(a) * 3.4, Math.sin(a) * 3.4, { damage: dmg * 0.4 });
        s.burst = false; s.range = 70;
      }
    }
    if (t.chain){
      const near = this.enemies.find(o => o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 90);
      if (near){
        this.damageEnemy(near, dmg * 0.5, owner, { silentSfx:true });
        this.bolt(e.x, e.y, near.x, near.y);
      }
    }
    if (owner){
      owner.run('hit', e);
      if (owner.temp.vamp > 0 && this.rng() < 0.25) owner.heal(1);
      if (owner.flags.siphon){
        owner.temp.siphon = (owner.temp.siphon || 0) + 1;
        if (owner.temp.siphon >= 12){ owner.temp.siphon = 0; this.spawnPickup('heartHalf', e.x, e.y); }
      }
    }
    this.fx('hit', t.x, t.y, { colour: t.colour });
  }

  tearDie(t, i){
    if (t.explosive) this.explode(t.x, t.y, 38, t.damage, t.owner instanceof Player ? t.owner : null);
    this.fx('splash', t.x, t.y, { colour: t.colour });
    const idx = i ?? this.tears.indexOf(t);
    if (idx >= 0) this.tears.splice(idx, 1);
  }

  damageEnemy(e, amount, source, opts = {}){
    if (e.hp <= 0) return;
    const armour = e.def.armour || 0;
    const dealt = Math.max(0.4, amount * (1 - armour));
    e.hp -= dealt;
    e.flash = 0.09;
    if (!opts.silentSfx) sfx.hit();
    if (e.frozen > 0 && e.hp <= 0){ sfx.shatter(); this.shockwave(e.x, e.y, 40, dealt * 0.5, true); }

    if (!opts.dot && dealt >= 1) this.floater(e.x, e.y - e.r, Math.round(dealt), '#ffd8d8');
    if (e.hp <= 0) this.killEnemy(e, source);
  }

  killEnemy(e, source){
    e.hp = 0;
    e.deathT = 0.3;
    this.stats.kills++;
    sfx.kill();
    this.fx('death', e.x, e.y, { colour: e.pal ? e.pal[0] : '#ff8a8a' });
    if (e.def.onDeath) e.def.onDeath(e, this);
    if (source instanceof Player){
      source.run('kill', e);
      source.chargeUp(e.def.isBoss ? 4 : 0.34);
      if (source.flags.shades && this.rng() < 0.2) this.spawnTempAlly(source, e.x, e.y);
    }
    if (!e.def.isBoss && !e.ally && e.charmed <= 0) this.rollDrop(e.x, e.y);
    if (e.def.isBoss && this.bossRef === e){
      const next = this.enemies.find(o => o.def.isBoss && o.hp > 0);
      this.bossRef = next || null;
    }
  }

  rollDrop(x, y){
    const r = this.rng();
    if (r < 0.055) this.spawnPickup('heartHalf', x, y);
    else if (r < 0.10) this.spawnPickup('coin', x, y);
    else if (r < 0.125) this.spawnPickup('bomb', x, y);
    else if (r < 0.145) this.spawnPickup('key', x, y);
  }

  /* ---------------- bombs ---------------- */
  dropBomb(p, opts = {}){
    if (!opts.free){
      if (p.bombs <= 0) return false;
      p.bombs--;
    }
    const big = p.flags?.bigBombs || opts.r;
    this.bombs.push({
      x: p.x + (opts.dx || 0), y: p.y + (opts.dy || 0), vx:0, vy:0, z:0,
      fuse: 1.6, owner: p,
      r: opts.r || (big ? 68 : 52),
      dmg: opts.dmg || (big ? 45 : 32),
      nails: !!p.flags?.nailBombs
    });
    return true;
  }
  lobBomb(e){
    const t = this.target(e);
    if (!t) return;
    const b = { x:e.x, y:e.y, vx:(t.x - e.x) / 60, vy:(t.y - e.y) / 60, z:0, fuse:1.4, owner:e, r:48, dmg:1, enemy:true };
    this.bombs.push(b);
  }
  updateBombs(dt){
    for (let i = this.bombs.length - 1; i >= 0; i--){
      const b = this.bombs[i];
      b.x += b.vx * dt * 60; b.y += b.vy * dt * 60;
      b.vx *= 0.94; b.vy *= 0.94;
      b.fuse -= dt;
      if ((b.ft = (b.ft || 0) + dt) > 0.2){ b.ft = 0; sfx.fuse(); }
      if (b.fuse <= 0){
        this.explode(b.x, b.y, b.r, b.dmg, b.enemy ? null : b.owner, { enemy: b.enemy });
        if (b.nails) for (let k = 0; k < 8; k++){
          const a = k / 8 * Math.PI * 2;
          const t = this.spawnTear(b.owner, b.x, b.y, Math.cos(a) * 4, Math.sin(a) * 4, { damage: b.dmg * 0.25 });
          t.range = 90;
        }
        this.bombs.splice(i, 1);
      }
    }
  }

  explode(x, y, r, dmg, source, opts = {}){
    this.blasts.push({ x, y, r, t:0 });
    this.shake(7);
    sfx.bomb();
    for (const e of this.enemies){
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < r + e.r) this.damageEnemy(e, dmg * (1 - d / (r + e.r) * 0.4), source instanceof Player ? source : null);
    }
    for (const p of this.players){
      if (p.dead) continue;
      if (!opts.enemy && p.flags.bombProof) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < r) p.hurt(opts.enemy ? 1 : 1);
    }
    // clear the terrain in the blast
    for (let cy = 0; cy < GRID_H; cy++)
      for (let cx = 0; cx < GRID_W; cx++){
        const px = ROOM_X + cx * CELL + CELL / 2, py = ROOM_Y + cy * CELL + CELL / 2;
        if (Math.hypot(px - x, py - y) > r) continue;
        const c = this.room.cells[cy][cx];
        if (c === '#' || c === 'M'){ this.room.cells[cy][cx] = '.'; if (c === 'M' && this.rng() < 0.25) this.spawnPickup(this.randomPickup(), px, py); }
      }
    this.revealSecretByBomb(x, y, r);
    for (let i = 0; i < 14; i++){
      const a = this.rng() * Math.PI * 2, s = 1 + this.rng() * 3;
      this.particles.push({ x, y, vx:Math.cos(a) * s, vy:Math.sin(a) * s, life:0.5, maxLife:0.5, size:2, colour: this.rng() < .5 ? '#ffb03d' : '#d8452a' });
    }
  }

  /** A bomb next to the wall a hidden room sits behind opens it. */
  revealSecretByBomb(x, y, r){
    for (const [dir, door] of Object.entries(this.room.doors)){
      if (!door.hidden || door.revealed) continue;
      const p = DOOR_POS[dir];
      if (Math.hypot(p.x - x, p.y - y) < r + 26){
        door.revealed = true; door.open = true;
        const other = this.floor.rooms.get(door.to);
        if (other){ other.seen = true; const back = other.doors[OPP[dir]]; if (back){ back.revealed = true; back.open = true; } }
        this.toastMsg('a hidden room', '');
        sfx.clear();
      }
    }
  }

  breakCell(x, y){
    const c = this.cellAt(x, y);
    if (c === '#' || c === 'M'){
      this.setCell(x, y, '.');
      if (c === 'M' && this.rng() < 0.3) this.spawnPickup(this.randomPickup(), x, y);
      this.fx('rubble', x, y);
    }
  }

  /* ---------------- pickups ---------------- */
  spawnPickup(kind, x, y, opts = {}){
    const p = {
      kind, x: Math.max(ROOM_X + 14, Math.min(ROOM_X + ROOM_W - 14, x)),
      y: Math.max(ROOM_Y + 14, Math.min(ROOM_Y + ROOM_H - 14, y)),
      vx:(this.rng() - .5) * 1.4, vy:(this.rng() - .5) * 1.4,
      seed: this.rng() * 10, delay: 0.25,
      price: opts.price ?? null, priceKind: opts.priceKind || 'coin',
      trinket: opts.trinket || null,
      variant: kind === 'pill' ? (this.rng() * PILL_COLOURS.length) | 0 : 0
    };
    if (kind === 'trinket' && !p.trinket) p.trinket = TRINKETS[(this.rng() * TRINKETS.length) | 0];
    this.pickups.push(p);
    if (this.room.live && this.pickups !== this.room.live.pickups) this.room.live.pickups.push(p);
    return p;
  }
  spawnTrinket(x, y, rng = this.rng){ return this.spawnPickup('trinket', x, y); }

  updatePickups(dt){
    const magnet = this.anyFlag('magnet');
    for (let i = this.pickups.length - 1; i >= 0; i--){
      const p = this.pickups[i];
      p.delay = Math.max(0, p.delay - dt);
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
      p.vx *= 0.9; p.vy *= 0.9;
      p.x = Math.max(ROOM_X + 12, Math.min(ROOM_X + ROOM_W - 12, p.x));
      p.y = Math.max(ROOM_Y + 12, Math.min(ROOM_Y + ROOM_H - 12, p.y));

      for (const pl of this.players){
        if (pl.dead) continue;
        const d = Math.hypot(pl.x - p.x, pl.y - p.y);
        if (magnet && d < 130 && p.price == null){
          p.vx += (pl.x - p.x) / d * 0.4;
          p.vy += (pl.y - p.y) / d * 0.4;
        }
        if (p.delay > 0) continue;
        if (d > pl.r + 10) continue;
        if (this.takePickup(pl, p)) { this.removePickup(p, i); break; }
      }
    }
  }

  removePickup(p, i){
    const idx = i ?? this.pickups.indexOf(p);
    if (idx >= 0) this.pickups.splice(idx, 1);
    if (this.room.live){
      const j = this.room.live.pickups.indexOf(p);
      if (j >= 0) this.room.live.pickups.splice(j, 1);
    }
  }

  takePickup(pl, p){
    if (p.price != null && p.price > 0){
      if (p.priceKind === 'coin'){
        if (pl.coins < p.price) return false;
        pl.coins -= p.price;
      } else {
        if (pl.totalHp() <= p.price) return false;
        pl.hurt(p.price, true);
      }
    }
    switch (p.kind){
      case 'heartRed': if (!pl.heal(2)) return false; sfx.heart(); break;
      case 'heartHalf': if (!pl.heal(1)) return false; sfx.heart(); break;
      case 'heartSoul': pl.addSoul(2); sfx.heart(); break;
      case 'heartBlack': pl.addBlack(2); sfx.heart(); break;
      case 'heartEternal': pl.addContainers(1); sfx.heart(); break;
      case 'heartRot': pl.heal(1); pl.addContainers(1); sfx.heart(); break;
      case 'coin': pl.coins += this.anyFlag('richCoins') ? 2 : 1; sfx.coin(); break;
      case 'nickel': pl.coins += 5; sfx.coin(); break;
      case 'dime': pl.coins += 10; sfx.coin(); break;
      case 'bomb': pl.bombs += 1; sfx.pickup(); break;
      case 'key': pl.keys += 1; sfx.key(); break;
      case 'goldKey': pl.keys += 5; sfx.key(); break;
      case 'battery': pl.chargeUp(99); sfx.charged(); break;
      case 'sack': for (let i = 0; i < 3; i++) this.spawnPickup(this.randomPickup(), p.x, p.y); sfx.pickup(); break;
      case 'pill': {
        if (pl.pill || pl.card) { if (pl.pill) return false; }
        pl.pill = { variant: p.variant, effect: this.pillMap[p.variant] };
        sfx.pickup(); break;
      }
      case 'card': case 'rune': {
        if (pl.card) return false;
        pl.card = this.rollCard();
        sfx.pickup(); break;
      }
      case 'trinket': {
        const old = pl.setTrinket(p.trinket);
        if (old) this.spawnPickup('trinket', p.x, p.y + 16, { trinket: old });
        sfx.pickup(); break;
      }
      default: sfx.pickup();
    }
    pl.run('pickup', p);
    return true;
  }

  priceOf(kind){
    const base = { heartRed:3, bomb:5, key:5, coin:0, pill:7, card:6, battery:9, heartSoul:6, trinket:8 }[kind] ?? 5;
    return this.discount(base);
  }
  discount(n){
    const d = this.anyFlag('discount') ? this.flagValue('discount') : 1;
    return Math.max(1, Math.round(n * d));
  }

  /* ---------------- props ---------------- */
  addProp(p){
    p.seed = this.rng() * 10;
    this.props.push(p);
    if (this.room.live && this.props !== this.room.live.props) this.room.live.props.push(p);
    return p;
  }

  updateProps(dt){
    for (const pr of this.props){
      for (const pl of this.players){
        if (pl.dead) continue;
        const d = Math.hypot(pl.x - pr.x, pl.y - pr.y);
        if (d > 22) { pr.touch = false; continue; }

        if (pr.kind === 'pedestal' && pr.item && !pr.taken){
          if (pr.price){
            if (pr.priceKind === 'heart'){
              if (pl.totalHp() <= pr.price * 1) continue;
              if (!pr.touch){ pr.touch = true; continue; }
              pl.hurt(pr.price * 2, true);
            } else {
              if (pl.coins < pr.price) continue;
              pl.coins -= pr.price;
            }
          }
          pr.taken = true;
          const it = pr.item; pr.item = null;
          pl.addItem(it);
          this.stats.itemsTaken++;
          if (this.room.type === 'devil' || this.room.type === 'angel') this.dealsTaken = true;
        }
        else if (pr.kind === 'chest' && !pr.open){
          const free = this.anyFlag('freeLocks') && this.rng() < this.flagValue('freeLocks');
          if (pr.locked && !free){
            if (pl.keys <= 0){ if (!pr.warned){ pr.warned = true; sfx.locked(); } continue; }
            pl.keys--;
          }
          pr.open = true;
          sfx.pickup();
          if (pr.mimic){
            const e = this.makeEnemy({ id:'mimic', x:pr.x, y:pr.y });
            if (e) e.awake = true;
            this.room.cleared = false; this.updateDoors();
          } else {
            const n = 1 + ((this.rng() * 3) | 0);
            for (let i = 0; i < n; i++) this.spawnPickup(this.randomPickup(), pr.x + (i - 1) * 14, pr.y + 10);
          }
        }
        else if (pr.kind === 'slot' && !pr.spent){
          if (pl.coins < pr.price){ if (!pr.warned){ pr.warned = true; sfx.locked(); } continue; }
          if (!pr.touch){ pr.touch = true; continue; }
          pl.coins -= pr.price;
          pr.uses = (pr.uses || 0) + 1;
          sfx.coin();
          const roll = this.rng();
          if (pr.kindOf === 'item' && roll < 0.34){
            this.addProp({ kind:'pedestal', x:pr.x, y:pr.y + 34, item:this.rollItem('treasure') });
            pr.spent = true;
          } else if (roll < 0.72){
            this.spawnPickup(this.randomPickup(), pr.x, pr.y + 30);
          } else if (roll > 0.95){
            pr.spent = true;
            this.toastMsg('it eats the coin', 'and stops working');
          }
          pr.touch = false;
        }
        else if (pr.kind === 'beggar' && !pr.done){
          if (pl.coins <= 0) continue;
          if (!pr.touch){ pr.touch = true; continue; }
          pl.coins--;
          pr.paid = (pr.paid || 0) + 1;
          sfx.coin();
          pr.touch = false;
          if (pr.paid >= 3 + ((this.rng() * 4) | 0)){
            pr.done = true;
            this.addProp({ kind:'pedestal', x:pr.x, y:pr.y + 34, item:this.rollItem('treasure') });
            this.toastMsg('the beggar pays out', '');
          } else if (this.rng() < 0.4){
            this.spawnPickup(this.randomPickup(), pr.x, pr.y + 26);
          }
        }
        else if (pr.kind === 'altar'){
          if (!pr.touch){ pr.touch = true; continue; }
          if (pl.totalHp() <= 1) continue;
          pl.hurt(2, true);
          pr.uses = (pr.uses || 0) + 1;
          pr.touch = false;
          sfx.hurt();
          if (pr.uses >= 6){
            this.addProp({ kind:'pedestal', x:pr.x, y:pr.y + 36, item:this.rollItem('angel') });
            pr.uses = 0;
            this.toastMsg('something answers', '');
          } else if (pr.uses >= 3 && this.rng() < 0.45){
            this.spawnPickup('heartSoul', pr.x, pr.y + 30);
          }
        }
        else if ((pr.kind === 'trapdoor' || pr.kind === 'ladder') && !this.descending){
          this.descending = true;
          this.after(0.1, () => { this.descending = false; this.nextFloor(); });
        }
      }
    }
  }

  /* ---------------- hazards + effects ---------------- */
  hazard(kind, x, y, r, life = 4){
    this.hazards.push({ kind, x, y, r, life, maxLife:life });
  }
  updateHazards(dt){
    for (let i = this.hazards.length - 1; i >= 0; i--){
      const h = this.hazards[i];
      h.life -= dt;
      if (h.life <= 0) this.hazards.splice(i, 1);
      else for (const e of this.enemies){
        if (e.hp <= 0 || h.kind === 'web') continue;
        if (h.friendly && Math.hypot(e.x - h.x, e.y - h.y) < h.r + e.r)
          this.damageEnemy(e, h.dmg * dt, h.owner, { silentSfx:true, dot:true });
      }
    }
  }

  shockwave(x, y, r, dmg, friendly = false){
    this.waves.push({ x, y, r, t:0, colour: friendly ? '#bfe4ff' : '#ffb0b0' });
    if (friendly){
      for (const e of this.enemies) if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) < r) this.damageEnemy(e, dmg, null);
    } else {
      for (const p of this.players){
        if (p.dead) continue;
        if (Math.hypot(p.x - x, p.y - y) < r) p.hurt(dmg);
      }
    }
  }

  beamDamage(src, angle, length, dmg){
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (const p of this.players){
      if (p.dead) continue;
      const dx = p.x - src.x, dy = p.y - src.y;
      const along = dx * cos + dy * sin;
      if (along < 0 || along > length) continue;
      const perp = Math.abs(-dx * sin + dy * cos);
      if (perp < 8 + p.r) p.hurt(1);
    }
  }

  bolt(x1, y1, x2, y2){
    for (let i = 0; i < 6; i++){
      const t = i / 6;
      this.particles.push({
        x: x1 + (x2 - x1) * t + (this.rng() - .5) * 6,
        y: y1 + (y2 - y1) * t + (this.rng() - .5) * 6,
        vx:0, vy:0, life:0.16, maxLife:0.16, size:1.5, colour:'#a8d8ff'
      });
    }
  }

  fx(kind, x, y, opts = {}){
    const colour = opts.colour || '#ffffff';
    const n = kind === 'death' ? 10 : kind === 'splash' ? 4 : kind === 'rubble' ? 8 : 5;
    for (let i = 0; i < n; i++){
      const a = this.rng() * Math.PI * 2, s = 0.6 + this.rng() * 2.4;
      this.particles.push({
        x, y, vx:Math.cos(a) * s, vy:Math.sin(a) * s,
        life:0.3 + this.rng() * 0.3, maxLife:0.6,
        size: kind === 'death' ? 2 : 1.5, colour
      });
    }
    if (kind === 'ward' || kind === 'revive') this.waves.push({ x, y, r:36, t:0, colour:'#bfe4ff' });
  }
  floater(x, y, text, colour){ this.floaters.push({ x, y, text:String(text), colour, life:0.7, maxLife:0.7 }); }
  shake(n){ this.shakeT = 0.28; this.shakeMag = Math.max(this.shakeMag * (this.shakeT > 0 ? 1 : 0), n); }
  after(t, fn){ this.timers.push({ t, fn }); }
  toastMsg(title, sub){ this.toast = { title, sub, t: 2.6 }; }

  blackHeartBurst(p){
    this.damageAll(24, p);
    this.shake(6);
    this.waves.push({ x:p.x, y:p.y, r:120, t:0, colour:'#b07fff' });
  }

  /* ---------------- familiars ---------------- */
  spawnFamiliars(p, item){
    const f = item.familiar;
    const n = f.count || 1;
    for (let i = 0; i < n; i++){
      this.familiars.push({
        owner:p, source:item, art:f.art, pal:f.pal, mode:f.mode,
        dmg:f.dmg, rate:f.rate || 1, touch:!!f.touch, blocks:!!f.blocks, reflect:!!f.reflect,
        spectral:!!f.spectral, pierce:!!f.pierce, freeze:!!f.freeze, burn:!!f.burn, poison:!!f.poison,
        harvest:!!f.harvest, mirror:!!f.mirror, fast:!!f.fast,
        x:p.x, y:p.y, vx:0, vy:0, cd:0, a: i / n * Math.PI * 2, seed:this.rng() * 10, kills:0
      });
    }
  }

  updateFamiliars(dt){
    for (const f of this.familiars){
      const p = f.owner;
      if (!p || p.dead) continue;
      if (f.mode === 'orbit'){
        f.a += dt * (f.fast ? 4.2 : 2.4);
        f.x = p.x + Math.cos(f.a) * 30;
        f.y = p.y + Math.sin(f.a) * 30;
      } else if (f.mode === 'bounce'){
        if (!f.launched){ f.vx = (this.rng() - .5) * 4; f.vy = (this.rng() - .5) * 4; f.launched = true; }
        f.x += f.vx * dt * 60; f.y += f.vy * dt * 60;
        if (f.x < ROOM_X + 8 || f.x > ROOM_X + ROOM_W - 8) f.vx *= -1;
        if (f.y < ROOM_Y + 8 || f.y > ROOM_Y + ROOM_H - 8) f.vy *= -1;
        f.x = Math.max(ROOM_X + 8, Math.min(ROOM_X + ROOM_W - 8, f.x));
        f.y = Math.max(ROOM_Y + 8, Math.min(ROOM_Y + ROOM_H - 8, f.y));
      } else if (f.mode === 'charge'){
        const e = this.nearestEnemy(f.x, f.y);
        if (e){
          const d = Math.hypot(e.x - f.x, e.y - f.y) || 1;
          f.vx += ((e.x - f.x) / d * 3 - f.vx) * 0.1;
          f.vy += ((e.y - f.y) / d * 3 - f.vy) * 0.1;
        } else { f.vx += ((p.x - f.x) * 0.02 - f.vx) * 0.1; f.vy += ((p.y - f.y) * 0.02 - f.vy) * 0.1; }
        f.x += f.vx * dt * 60; f.y += f.vy * dt * 60;
      } else {
        // follow, with a lag so it trails rather than sticks
        const tx = p.x - 22, ty = p.y + 8;
        f.x += (tx - f.x) * Math.min(1, dt * 5);
        f.y += (ty - f.y) * Math.min(1, dt * 5);
      }

      if (f.touch){
        for (const e of this.enemies){
          if (e.hp <= 0 || e.charmed > 0) continue;
          if (Math.hypot(e.x - f.x, e.y - f.y) > e.r + 8) continue;
          this.damageEnemy(e, f.dmg * dt * 4, p, { silentSfx:true, dot:true });
          if (f.freeze && this.rng() < 0.02 * dt * 60) e.frozen = 1.4;
          if (f.burn) { e.burn = Math.max(e.burn, f.dmg * 0.3); e.burnLeft = 1.6; }
        }
      }
      if (f.rate){
        f.cd -= dt;
        const e = this.nearestEnemy(f.x, f.y);
        if (f.cd <= 0 && e){
          f.cd = 1 / f.rate;
          const d = Math.hypot(e.x - f.x, e.y - f.y) || 1;
          const t = this.spawnTear(p, f.x, f.y, (e.x - f.x) / d * 5, (e.y - f.y) / d * 5, { damage: f.dmg });
          t.spectral = f.spectral; t.pierce = f.pierce ? 99 : 0; t.poison = f.poison;
          t.colour = f.pal[0]; t.hi = f.pal[2];
        }
      }
      if (f.harvest){
        f.kills = f.kills || 0;
      }
    }
  }

  spawnTempAlly(p, x, y){
    const e = this.makeEnemy({ id:'mite', x: x ?? p.x, y: y ?? p.y });
    if (e){ e.ally = true; e.charmed = 999; e.pal = ['#8fe0b0', '#3f8f6f', '#d0f2e0', '#204030']; }
    return e;
  }
  spawnBigAlly(p){
    const e = this.makeEnemy({ id:'husker', x:p.x, y:p.y - 20 });
    if (e){ e.ally = true; e.charmed = 999; e.pal = ['#8fe0b0', '#3f8f6f', '#d0f2e0', '#204030']; }
    return e;
  }
  spawnSeeker(p){
    const e = this.nearestEnemy(p.x, p.y);
    const a = e ? Math.atan2(e.y - p.y, e.x - p.x) : this.rng() * Math.PI * 2;
    const t = this.spawnTear(p, p.x, p.y, Math.cos(a) * 4, Math.sin(a) * 4, { damage: p.stats.damage * 1.6 });
    t.homing = 0.14; t.spectral = true; t.range = 900; t.colour = '#dfe6f2'; t.hi = '#ffffff';
  }
  spawnDecoy(p, t){
    this.decoys.push({ x:p.x, y:p.y, art:p.art.down[0], t });
  }

  /* ---------------- item API ---------------- */
  target(e){ return this.nearestPlayer(e.x, e.y); }
  nearestPlayer(x, y){
    let best = null, bd = Infinity;
    for (const p of this.players){
      if (p.dead) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd){ bd = d; best = p; }
    }
    return best;
  }
  nearestEnemy(x, y){
    let best = null, bd = Infinity;
    for (const e of this.enemies){
      if (e.hp <= 0 || e.charmed > 0 || e.ally) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd){ bd = d; best = e; }
    }
    return best;
  }
  spawn(id, x, y){ return this.makeEnemy({ id, x, y }); }

  /** Luck-scaled probability roll. */
  luckRoll(p, base, per = 0.02){
    const luck = p?.stats?.luck || 0;
    return this.rng() < Math.min(0.95, base + luck * per);
  }
  anyFlag(name){ return this.players.some(p => p.flags[name]); }
  flagValue(name){
    let v = 0;
    for (const p of this.players) if (typeof p.flags[name] === 'number') v = Math.max(v, p.flags[name]);
    return v || 1;
  }

  ring(p, n, speed){
    for (let i = 0; i < n; i++){
      const a = i / n * Math.PI * 2;
      this.spawnTear(p, p.x, p.y, Math.cos(a) * speed, Math.sin(a) * speed, { damage: p.stats.damage });
    }
  }
  damageAll(n, src){ for (const e of this.enemies) if (e.hp > 0) this.damageEnemy(e, n, src instanceof Player ? src : null); }
  stunAll(t){ for (const e of this.enemies) e.stun = Math.max(e.stun, t); }
  freezeAll(t){ for (const e of this.enemies) e.frozen = Math.max(e.frozen, t); sfx.freeze(); }
  charmAll(t){ for (const e of this.enemies) e.charmed = Math.max(e.charmed, t); }
  timeStop(t){ this.timeStopT = t; sfx.charged(); }
  slowRoom(f){ this.slowFactor = f; }
  pullAll(src, t, force = 1.6){
    for (const p of this.players){
      if (p.dead) continue;
      const d = Math.hypot(src.x - p.x, src.y - p.y) || 1;
      p.vx += (src.x - p.x) / d * force * 0.1;
      p.vy += (src.y - p.y) / d * force * 0.1;
    }
    if (src instanceof Player){
      for (const e of this.enemies){
        if (e.hp <= 0) continue;
        const d = Math.hypot(src.x - e.x, src.y - e.y) || 1;
        e.vx += (src.x - e.x) / d * 2.4;
        e.vy += (src.y - e.y) / d * 2.4;
        e.stun = Math.max(e.stun, t);
      }
    }
  }
  novaBurst(p, dmg){
    this.waves.push({ x:p.x, y:p.y, r:150, t:0, colour:'#ffd166' });
    for (const e of this.enemies) if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 150) this.damageEnemy(e, dmg, p);
    this.shake(6);
  }
  raiseWall(p){
    for (let i = 0; i < 8; i++){
      const a = i / 8 * Math.PI * 2;
      this.setCell(p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40, '#');
    }
  }
  rainRocks(n){
    const cells = freeCells(this.room.cells, { avoidCentre:false });
    for (let i = 0; i < n && cells.length; i++){
      const c = cells.splice((this.rng() * cells.length) | 0, 1)[0];
      this.room.cells[c.cy][c.cx] = '#';
    }
  }
  rainBombs(p, n){
    for (let i = 0; i < n; i++){
      const a = this.rng() * Math.PI * 2, d = 20 + this.rng() * 90;
      this.bombs.push({ x:p.x + Math.cos(a) * d, y:p.y + Math.sin(a) * d, vx:0, vy:0, fuse:1.2 + this.rng(), owner:p, r:52, dmg:32 });
    }
  }
  crumbleRocks(){
    for (let y = 0; y < GRID_H; y++)
      for (let x = 0; x < GRID_W; x++)
        if (this.room.cells[y][x] === '#' || this.room.cells[y][x] === 'M'){
          this.room.cells[y][x] = '.';
          if (this.rng() < 0.15) this.spawnPickup(this.randomPickup(), ROOM_X + x * CELL + CELL / 2, ROOM_Y + y * CELL + CELL / 2);
        }
  }
  gatherPickups(p){
    for (const r of this.floor.rooms.values()){
      if (r === this.room || !r.live) continue;
      for (const pk of r.live.pickups.slice()){
        if (pk.price != null) continue;
        r.live.pickups.splice(r.live.pickups.indexOf(pk), 1);
        this.spawnPickup(pk.kind, p.x + (this.rng() - .5) * 50, p.y + (this.rng() - .5) * 50);
      }
    }
  }
  convertPickups(kind, mult = 1){
    const list = this.pickups.slice();
    if (!list.length) return false;
    for (const p of list){
      if (p.price != null) continue;
      this.removePickup(p);
      for (let i = 0; i < mult; i++) this.spawnPickup(kind, p.x + i * 8, p.y);
    }
    return true;
  }
  rerollPickups(){
    const list = this.pickups.slice();
    if (!list.length) return false;
    for (const p of list){
      if (p.price != null) continue;
      this.removePickup(p);
      this.spawnPickup(this.randomPickup(), p.x, p.y);
    }
    return true;
  }
  burstPickups(x, y, n){
    for (let i = 0; i < n; i++) this.spawnPickup(this.randomPickup(), x + (this.rng() - .5) * 50, y + (this.rng() - .5) * 40);
  }
  rerollPedestals(){
    let any = false;
    for (const pr of this.props){
      if (pr.kind !== 'pedestal' || !pr.item) continue;
      pr.item = this.rollItem(this.room.type === 'shop' ? 'shop' : 'treasure');
      any = true;
    }
    return any;
  }
  rerollItems(p){
    const old = p.items.slice();
    if (!old.length) return false;
    for (const it of old) p.removeItem(it);
    p.familiars = [];
    this.familiars = this.familiars.filter(f => f.owner !== p);
    for (let i = 0; i < old.length; i++) p.addItem(this.rollItem('treasure'), { silent:true });
    this.toastMsg('everything changed', '');
    return true;
  }
  openAllDoors(){
    for (const [dir, d] of Object.entries(this.room.doors)){
      d.open = true; d.locked = false;
      if (d.hidden){ d.revealed = true; const o = this.floor.rooms.get(d.to); if (o){ o.seen = true; const b = o.doors[OPP[dir]]; if (b){ b.revealed = true; b.open = true; } } }
    }
  }
  openDealDoor(p){
    if (this.floor.dealTaken) return false;
    const dir = this.freeDoorDir(this.room);
    if (!dir) return false;
    const r = this.makeSideRoom(this.rng() < 0.3 ? 'angel' : 'devil', dir);
    if (!r) return false;
    this.room.doors[dir] = { to:r.key, kind:r.type, open:true };
    this.floor.dealTaken = true;
    return true;
  }
  openTrapdoor(p){
    if (this.props.some(pr => pr.kind === 'trapdoor')) return false;
    this.addProp({ kind:'trapdoor', x:p.x, y:p.y + 34 });
    return true;
  }
  spawnBeggar(p){ this.addProp({ kind:'beggar', x:p.x + 30, y:p.y, want:'coin', paid:0 }); return true; }

  teleportRandom(p){
    const list = [...this.floor.rooms.values()].filter(r => r !== this.room && !r.hidden);
    const r = list[(this.rng() * list.length) | 0];
    if (r) this.enterRoom(r, null);
  }
  teleportStart(p){ this.enterRoom(this.floor.start, null); }
  teleportType(p, type){
    const r = [...this.floor.rooms.values()].find(x => x.type === type);
    if (!r) return false;
    this.enterRoom(r, null);
    return true;
  }
  teleportBoss(b){
    b.x = ROOM_X + 40 + this.rng() * (ROOM_W - 80);
    b.y = ROOM_Y + 40 + this.rng() * (ROOM_H - 80);
    this.fx('death', b.x, b.y, { colour:'#c8a0ff' });
  }

  revealMap(full, secrets, open){
    if (full) this.showFullMap = true;
    if (secrets) this.showSecrets = true;
    if (full) for (const r of this.floor.rooms.values()) r.seen = true;
    if (open){
      for (const r of this.floor.rooms.values())
        for (const [dir, d] of Object.entries(r.doors))
          if (d.hidden){ d.revealed = true; d.open = true; }
    }
  }

  dropActive(p, item){ this.addProp({ kind:'pedestal', x:p.x + 26, y:p.y, item }); }

  announceItem(p, item){
    sfx.item();
    this.toastMsg(item.name, item.desc);
  }

  useConsumable(p){
    if (p.card){
      const c = p.card;
      p.card = null;
      c.use(this, p);
      sfx.use();
      this.toastMsg(c.name, c.desc);
      if (this.anyFlag('paperCharge')) p.chargeUp(1);
      return;
    }
    if (p.pill){
      const pill = p.pill;
      p.pill = null;
      let eff = pill.effect;
      if (p.flags.goodPills && !eff.good) eff = PILL_EFFECTS.filter(e => e.good)[(this.rng() * PILL_EFFECTS.filter(e => e.good).length) | 0];
      eff.use(this, p);
      p.dirty = true;
      sfx.use();
      this.toastMsg(eff.name, '');
      if (this.anyFlag('paperCharge')) p.chargeUp(1);
    }
  }

  randomPickup(rng = this.rng){
    const r = rng();
    if (r < 0.3) return 'coin';
    if (r < 0.46) return 'bomb';
    if (r < 0.62) return 'key';
    if (r < 0.76) return 'heartHalf';
    if (r < 0.84) return 'heartRed';
    if (r < 0.9) return 'pill';
    if (r < 0.95) return 'card';
    if (r < 0.98) return 'heartSoul';
    return 'battery';
  }

  rollItem(pool, forceType){
    const owned = new Set(this.players.flatMap(p => [...p.items, p.active].filter(Boolean).map(i => i.id)));
    let list = poolOf(pool).filter(i => !owned.has(i.id));
    if (forceType) list = list.filter(i => i.type === forceType).concat(list.filter(i => i.type !== forceType).slice(0, 0));
    if (!list.length) list = poolOf(pool);
    if (!list.length) list = ITEMS;
    // quality is weighted so a floor-one treasure room is usually not a q5
    const weights = list.map(i => Math.max(0.2, 1.6 - Math.abs(i.q - (1 + this.depth * 0.5)) * 0.4));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.rng() * total;
    for (let i = 0; i < list.length; i++){ r -= weights[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }
  rollCard(){ return CARDS[(this.rng() * CARDS.length) | 0]; }

  /* ---------------- run flow ---------------- */
  nextFloor(){
    if (this.depth + 1 >= FLOOR_COUNT && !this.mode.endless){ this.win(); return; }
    this.enterFloor(this.depth + 1);
  }

  onPlayerDeath(p){
    sfx.die();
    // co-op: a dead player comes back at the start of the next room on half a heart
    if (this.players.length > 1 && this.players.some(q => !q.dead)){
      this.toastMsg('P' + (p.index + 1) + ' is down', 'they come back on the next floor');
      return;
    }
  }

  gameOver(){
    this.over = true;
    this.banner = { title:'you died', sub:`${this.floor.name} · floor ${this.depth + 1}`, t: 99 };
    this.after(0.8, () => this.onEnd({ won:false, stats:this.summary() }));
  }
  win(){
    if (this.over) return;
    this.over = true; this.won = true;
    sfx.win();
    this.banner = { title:'you made it out', sub:`${this.stats.kills} kills`, t: 99 };
    this.after(1.2, () => this.onEnd({ won:true, stats:this.summary() }));
  }
  summary(){
    return {
      ...this.stats,
      depth: this.depth + 1,
      seconds: Math.round((performance.now() - this.stats.started) / 1000),
      items: this.players[0].items.map(i => i.name),
      seed: this.seedValue
    };
  }

  render(){ drawFrame(this.ctx, this); }
}
