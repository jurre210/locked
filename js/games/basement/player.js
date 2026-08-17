/**
 * The player: health in half-hearts, a stat block rebuilt from scratch whenever
 * anything changes, and the item list that drives it.
 *
 * Stats are recomputed rather than incrementally adjusted. It costs nothing at
 * this scale and it means an item that is removed (reroll, dice) can never
 * leave a stale bonus behind.
 */
import { BASE_STATS } from './characters.js';
import { buildCharacter } from './mobs-art.js';
import { BY_ID, TRINKET_BY_ID } from './items.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Player {
  constructor(def, index, game){
    this.def = def;
    this.index = index;
    this.game = game;
    this.art = buildCharacter(def);

    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.r = 9;
    this.facing = 'down';
    this.flip = false;
    this.walkT = 0;
    this.alive = true;
    this.dead = false;

    this.maxRed = (def.hp || 0) * 2;
    this.red = this.maxRed;
    this.soul = def.soul || 0;
    this.black = def.black || 0;
    this.rot = 0;

    this.coins = def.coins || 0;
    this.bombs = def.bombs || 0;
    this.keys = def.keys || 0;

    this.items = [];
    this.trinket = null;
    this.card = null;
    this.pill = null;
    this.active = null;
    this.charge = 0;

    this.flags = {};
    this.perm = { damage:0, tears:0, speed:0, range:0, shotSpeed:0, luck:0 };
    this.temp = {};
    this.base = { ...BASE_STATS };
    this.stats = { ...BASE_STATS };

    this.invuln = 0;
    this.fireCd = 0;
    this.chargeShot = 0;
    this.stillT = 0;
    this.hitFlash = 0;
    this.wardUsed = false;
    this.familiars = [];
    this.orbitals = [];
    this.hooks = { fire:[], hit:[], kill:[], damage:[], clear:[], floor:[], tick:[], pickup:[] };
    this.dirty = true;

    // per-character starting offsets are permanent, not an item
    Object.assign(this.perm, mapStats(def.stats || {}));
    Object.assign(this.flags, def.flags || {});
    this.recompute();
  }

  /* ---------------- health ---------------- */
  totalHp(){ return this.red + this.soul + this.black; }
  containers(){ return this.maxRed; }

  addContainers(n){
    if (this.flags.noRed) return false;
    this.maxRed = clamp(this.maxRed + n * 2, 0, 24);
    this.red = Math.min(this.red, this.maxRed);
    if (n > 0) this.red = Math.min(this.maxRed, this.red + n * 2);
    return true;
  }
  /** @returns true if any healing actually happened */
  heal(halves){
    if (this.flags.noRed){
      // characters without containers convert healing into soul hearts
      if (this.soul >= 12) return false;
      this.soul = Math.min(12, this.soul + Math.min(halves, 2));
      return true;
    }
    if (this.red >= this.maxRed) return false;
    this.red = Math.min(this.maxRed, this.red + halves);
    return true;
  }
  addSoul(halves){ this.soul = Math.min(24, this.soul + halves); return true; }
  addBlack(halves){ this.black = Math.min(24, this.black + halves); return true; }
  tempContainers(n){ this.maxRed += n * 2; this.red += n * 2; this.temp.extraContainers = (this.temp.extraContainers || 0) + n; }

  /**
   * @param {number} halves damage in half-hearts
   * @param {boolean} force ignore invulnerability (self-inflicted costs)
   */
  hurt(halves = 1, force = false){
    if (this.dead) return false;
    if (!force && this.invuln > 0) return false;
    const g = this.game;

    if (!force && this.flags.ward && !this.wardUsed){
      this.wardUsed = true;
      this.invuln = 1.0;
      g.fx('ward', this.x, this.y);
      g.sfx.ward();
      return false;
    }
    if (this.flags.brittle) halves += 1;
    if (this.flags.glass) halves *= 2;

    // black, then soul, then red — the borrowed hearts go first
    let left = halves;
    const takeBlack = Math.min(this.black, left);
    if (takeBlack){
      this.black -= takeBlack; left -= takeBlack;
      g.blackHeartBurst(this);
    }
    const takeSoul = Math.min(this.soul, left);
    this.soul -= takeSoul; left -= takeSoul;
    this.red = Math.max(0, this.red - left);

    this.invuln = force ? 0.4 : 1.1;
    this.hitFlash = 0.35;
    g.shake(4);
    g.sfx.hurt();
    this.run('damage');

    if (this.totalHp() <= 0) this.die();
    this.dirty = true;
    return true;
  }

  die(){
    // a held revive spends itself instead of ending the run
    if (this.active && this.active.passiveRevive && this.charge >= this.active.charge){
      this.charge = 0;
      this.red = Math.min(this.maxRed, 2);
      if (!this.red) this.soul = 2;
      this.invuln = 2.5;
      this.game.fx('revive', this.x, this.y);
      this.game.sfx.revive();
      return;
    }
    this.dead = true;
    this.alive = false;
    this.game.onPlayerDeath(this);
  }

  /* ---------------- items ---------------- */
  addItem(item, { silent = false } = {}){
    if (typeof item === 'string') item = BY_ID[item];
    if (!item) return false;

    if (item.type === 'active'){
      const old = this.active;
      this.active = item;
      this.charge = item.charge || 0;
      if (old) this.game.dropActive(this, old);
      this.dirty = true;
      if (!silent) this.game.announceItem(this, item);
      return true;
    }

    this.items.push(item);
    if (item.give){
      this.coins += item.give.coins || 0;
      this.bombs += item.give.bombs || 0;
      this.keys += item.give.keys || 0;
    }
    if (item.familiar) this.game.spawnFamiliars(this, item);
    for (const [ev, fn] of Object.entries(item.on || {})) this.hooks[ev]?.push({ fn, item });
    if (item.heal) { this.red = Math.min(this.maxRed + (item.stats?.maxHp || 0), this.red + item.heal); }
    this.dirty = true;
    this.recompute();
    if (item.heal) this.heal(item.heal);
    if (item.on?.pickup) item.on.pickup(this.game, this);
    if (!silent) this.game.announceItem(this, item);
    return true;
  }

  removeItem(item){
    const i = this.items.indexOf(item);
    if (i < 0) return;
    this.items.splice(i, 1);
    for (const list of Object.values(this.hooks)){
      for (let j = list.length - 1; j >= 0; j--) if (list[j].item === item) list.splice(j, 1);
    }
    this.familiars = this.familiars.filter(f => f.source !== item);
    this.dirty = true;
    this.recompute();
  }

  setTrinket(t){
    if (typeof t === 'string') t = TRINKET_BY_ID[t];
    const old = this.trinket;
    if (old){
      for (const list of Object.values(this.hooks)){
        for (let j = list.length - 1; j >= 0; j--) if (list[j].item === old) list.splice(j, 1);
      }
    }
    this.trinket = t;
    if (t){
      for (const [ev, fn] of Object.entries(t.on || {})) this.hooks[ev]?.push({ fn, item:t });
      if (t.give){ this.coins += t.give.coins || 0; this.bombs += t.give.bombs || 0; this.keys += t.give.keys || 0; }
    }
    this.dirty = true;
    this.recompute();
    return old;
  }

  /** Rebuild the stat block from base + permanents + every item. */
  recompute(){
    const s = { ...this.base };
    const add = (k, v) => { s[k] = (s[k] || 0) + v; };
    for (const [k, v] of Object.entries(this.perm)) add(k, v);

    const sources = [...this.items, this.trinket, this.active].filter(Boolean);
    this.flags = { ...(this.def.flags || {}) };

    for (const it of sources){
      for (const [k, v] of Object.entries(mapStats(it.stats || {}))) add(k, v);
      for (const [k, v] of Object.entries(it.flags || {})){
        this.flags[k] = typeof v === 'number' && typeof this.flags[k] === 'number'
          ? Math.max(this.flags[k], v) + (k === 'multi' || k === 'orbitals' || k === 'bounce' ? 0 : 0)
          : v;
      }
      if (it.flags?.multi) this.flags.multi = (this.flags.multi || 0) + it.flags.multi;
      if (it.flags?.orbitals) this.flags.orbitals = (this.flags.orbitals || 0) + it.flags.orbitals;
      if (it.flags?.bounce) this.flags.bounce = Math.max(this.flags.bounce || 0, it.flags.bounce);
      for (const [k, fn] of Object.entries(it.dyn || {})) add(k, fn(this) || 0);
    }

    // character-specific scaling
    if (this.def.flags?.scaling){
      add('damage', this.items.length * 0.35);
      add('speed', Math.min(0.8, this.items.length * 0.06));
    }
    if (this.flags.desperate){
      const missing = 1 - this.totalHp() / Math.max(1, this.maxRed + this.soul + this.black);
      add('damage', missing * 3);
    }
    if (this.temp.cardDmg) add('damage', this.temp.cardDmg);
    if (this.temp.berserk > 0){ add('tears', 2); add('speed', 0.9); }

    s.damage = Math.max(0.5, s.damage);
    s.tears = clamp(s.tears, 0.5, 14);
    s.speed = clamp(s.speed, 0.7, 4.5);
    s.range = clamp(s.range, 90, 900);
    s.shotSpeed = clamp(s.shotSpeed, 2, 14);

    // maxHp arrives as a stat but lives on the health track
    const wantMax = (this.def.hp || 0) * 2 + (s.maxHp || 0) + (this.temp.extraContainers || 0) * 2;
    if (!this.flags.noRed && wantMax !== this.maxRed){
      const delta = wantMax - this.maxRed;
      this.maxRed = clamp(wantMax, 0, 24);
      if (delta > 0) this.red = Math.min(this.maxRed, this.red + delta);
      else this.red = Math.min(this.red, this.maxRed);
    }
    delete s.maxHp;

    this.stats = s;
    this.dirty = false;
  }

  /* ---------------- hooks ---------------- */
  run(ev, a, b){
    for (const h of this.hooks[ev] || []) h.fn(this.game, this, a, b);
  }

  /* ---------------- active item ---------------- */
  chargeUp(amount){
    if (!this.active || this.active.charge === 0) return;
    const before = this.charge;
    this.charge = Math.min(this.active.charge, this.charge + amount);
    if (before < this.active.charge && this.charge >= this.active.charge) this.game.sfx.charged();
  }
  useActive(){
    const a = this.active;
    if (!a) return false;
    if (a.charge > 0 && this.charge < a.charge) return false;
    const times = this.flags.doubleActive ? 2 : 1;
    let ok = false;
    for (let i = 0; i < times; i++) ok = a.use(this.game, this) !== false || ok;
    if (ok){
      this.charge = 0;
      this.game.sfx.use();
      this.dirty = true;
    }
    return ok;
  }

  /* ---------------- per frame ---------------- */
  update(dt, input){
    if (this.dead) return;
    if (this.dirty) this.recompute();

    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.temp.berserk > 0){ this.temp.berserk -= dt; if (this.temp.berserk <= 0){ this.temp.berserk = 0; this.dirty = true; } }
    if (this.temp.vamp > 0) this.temp.vamp -= dt;
    this.run('tick', dt);

    /* movement */
    const sp = this.stats.speed * (this.slow || 1);
    const mx = input.mx, my = input.my;
    const m = Math.hypot(mx, my);
    const tx = m > 0 ? mx / m * sp : 0;
    const ty = m > 0 ? my / m * sp : 0;
    const grip = m > 0 ? 0.32 : 0.24;
    this.vx += (tx - this.vx) * grip;
    this.vy += (ty - this.vy) * grip;
    this.slow = 1;

    if (m > 0){
      this.walkT += dt * 9;
      this.stillT = 0;
    } else {
      this.stillT += dt;
      this.walkT += dt * 2;
    }

    /* aim + fire */
    const ax = input.ax, ay = input.ay;
    const aiming = Math.hypot(ax, ay) > 0.2;
    if (aiming){
      this.facing = Math.abs(ax) > Math.abs(ay) ? 'side' : (ay < 0 ? 'up' : 'down');
      if (Math.abs(ax) > Math.abs(ay)) this.flip = ax < 0;
    } else if (m > 0){
      this.facing = Math.abs(mx) > Math.abs(my) ? 'side' : (my < 0 ? 'up' : 'down');
      if (Math.abs(mx) > Math.abs(my)) this.flip = mx < 0;
    }

    this.fireCd -= dt;
    const canShoot = this.temp.berserk <= 0;

    if (this.flags.charged && canShoot){
      // hold to charge, release to fire one big shot
      if (aiming){ this.chargeShot = Math.min(1, this.chargeShot + dt * 2.2); }
      else if (this.chargeShot > 0.25){
        this.game.playerFire(this, this.lastAx || 1, this.lastAy || 0, { charged: this.chargeShot });
        this.chargeShot = 0;
      } else this.chargeShot = 0;
      if (aiming){ this.lastAx = ax; this.lastAy = ay; }
    } else if (aiming && this.fireCd <= 0 && canShoot){
      this.game.playerFire(this, ax, ay, {});
      this.fireCd = 1 / this.stats.tears;
    }
  }
}

/** Item stat keys are friendlier than the internal ones; map them here. */
function mapStats(s){
  const out = {};
  for (const [k, v] of Object.entries(s)){
    if (k === 'maxHp') out.maxHp = v;
    else out[k] = v;
  }
  return out;
}
