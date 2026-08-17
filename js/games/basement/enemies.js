/**
 * Enemy roster. Each entry is data plus its own `update`, so behaviour lives
 * next to the stats instead of in one giant switch in the game loop.
 *
 * The contract an enemy gets from the game (`g`):
 *   g.target(e)            nearest living player
 *   g.shoot(e, vx, vy, o)  enemy projectile
 *   g.solid(x, y, flying)  is that point blocked
 *   g.spawn(id, x, y)      another enemy
 *   g.explode(x, y, r, d)  blast
 *   g.rng()                run RNG
 *   g.fx(kind, x, y, o)    cosmetic burst
 */

const TAU = Math.PI * 2;
const len = (x, y) => Math.hypot(x, y) || 1;

/** Steer `e` toward point at `sp` px/frame, with a little inertia. */
function seek(e, tx, ty, sp, grip = 0.18){
  const dx = tx - e.x, dy = ty - e.y, d = len(dx, dy);
  e.vx += ((dx / d) * sp - e.vx) * grip;
  e.vy += ((dy / d) * sp - e.vy) * grip;
}
function flee(e, tx, ty, sp, grip = 0.18){ seek(e, 2 * e.x - tx, 2 * e.y - ty, sp, grip); }

/** Fire at the player, `n` shots spread over `arc` radians. */
function volley(e, g, speed = 2.2, n = 1, arc = 0.5, opts = {}){
  const t = g.target(e);
  if (!t) return;
  const base = Math.atan2(t.y - e.y, t.x - e.x);
  for (let i = 0; i < n; i++){
    const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * arc);
    g.shoot(e, Math.cos(a) * speed, Math.sin(a) * speed, opts);
  }
}
function radial(e, g, n, speed = 2, off = 0, opts = {}){
  for (let i = 0; i < n; i++){
    const a = off + i / n * TAU;
    g.shoot(e, Math.cos(a) * speed, Math.sin(a) * speed, opts);
  }
}

/** Countdown helper — returns true once every `period` seconds. */
function every(e, key, period, dt){
  e[key] = (e[key] || 0) - dt;
  if (e[key] <= 0){ e[key] = period; return true; }
  return false;
}

/* palettes: [main, shade, highlight, accent] */
const C = {
  meat:   ['#d06a72', '#8a3a44', '#f0a0a4', '#3a1018'],
  pale:   ['#d8cdb8', '#a09378', '#f2ecd8', '#5a2a2a'],
  green:  ['#7aab52', '#4a6f30', '#b8dc90', '#20300f'],
  toxic:  ['#9fd83a', '#5f8f20', '#d8f490', '#2a3a08'],
  bone:   ['#e6e0cc', '#a8a08a', '#fffaf0', '#3a2a2a'],
  rock:   ['#8a8e9a', '#565a66', '#c0c4d0', '#2a2c34'],
  ember:  ['#e8763a', '#a03f14', '#ffb070', '#fff0c0'],
  frost:  ['#8fc8f0', '#4a80b0', '#d8f0ff', '#204060'],
  void:   ['#5a4a70', '#2e2440', '#8a76a8', '#c8a0ff'],
  blood:  ['#c03040', '#7a1424', '#f07a84', '#2a0810'],
  fly:    ['#4a4650', '#26232c', '#7a7484', '#e05050'],
  gold:   ['#d8ab48', '#9a7020', '#f4d88a', '#3a2808'],
  brine:  ['#48a898', '#206f60', '#8ce0d0', '#0f3a30'],
  ash:    ['#9a94a4', '#666070', '#c8c2d4', '#e8e2f0']
};

/* ------------------------------------------------------------------ */
/* the roster                                                          */
/* ------------------------------------------------------------------ */
export const ENEMIES = {
  grub: {
    art:'grub', pal:C.meat, hp:9, r:11, dmg:1, w:1, tier:0,
    update(e, g, dt){
      const t = g.target(e);
      if (!t) return;
      // shuffles forward in bursts rather than gliding
      e.ph = (e.ph || 0) + dt * 3.4;
      const push = 0.55 + Math.sin(e.ph) * 0.5;
      seek(e, t.x, t.y, 0.62 * push, 0.12);
    }
  },
  hopper: {
    art:'hopper', pal:C.green, hp:12, r:12, dmg:1, w:1, tier:0,
    update(e, g, dt){
      const t = g.target(e);
      e.cd = (e.cd || 0) - dt;
      if (e.cd <= 0 && t){
        const d = len(t.x - e.x, t.y - e.y);
        e.vx = (t.x - e.x) / d * 3.4;
        e.vy = (t.y - e.y) / d * 3.4;
        e.hop = 0.42; e.cd = 1.05;
        g.sfx.hop();
      }
      e.hop = Math.max(0, (e.hop || 0) - dt);
      if (e.hop <= 0){ e.vx *= 0.82; e.vy *= 0.82; }
      e.airborne = e.hop > 0.05;   // clears pits mid-hop
      e.lift = e.hop > 0 ? Math.sin((1 - e.hop / 0.42) * Math.PI) * 9 : 0;
    }
  },
  spitter: {
    art:'spitter', pal:C.green, hp:14, r:12, dmg:1, w:1, tier:0, still:true,
    update(e, g, dt){
      e.vx *= 0.8; e.vy *= 0.8;
      if (every(e, 'fire', 1.9, dt)){ volley(e, g, 2.3, 1); g.sfx.spit(); }
    }
  },
  charger: {
    art:'charger', pal:C.rock, hp:16, r:13, dmg:1, w:2, tier:1,
    update(e, g, dt){
      const t = g.target(e);
      if (!t) return;
      e.state = e.state || 'aim';
      if (e.state === 'aim'){
        e.vx *= 0.86; e.vy *= 0.86;
        // only commits when roughly lined up on an axis, so it reads as a threat
        const dx = t.x - e.x, dy = t.y - e.y;
        if (Math.abs(dy) < 20 || Math.abs(dx) < 20){
          e.wind = (e.wind || 0) + dt;
          if (e.wind > 0.4){
            const h = Math.abs(dy) < 20;
            e.vx = h ? Math.sign(dx) * 4.6 : 0;
            e.vy = h ? 0 : Math.sign(dy) * 4.6;
            e.state = 'run'; e.runT = 1.1; e.wind = 0;
            g.sfx.charge();
          }
        } else e.wind = 0;
      } else {
        e.runT -= dt;
        if (e.runT <= 0 || (Math.abs(e.vx) + Math.abs(e.vy) < 0.6)){ e.state = 'aim'; }
      }
    },
    onWall(e, g){ e.state = 'aim'; e.vx *= -0.3; e.vy *= -0.3; g.shake(3); }
  },
  floater: {
    art:'floater', pal:C.void, hp:10, r:12, dmg:1, w:1, tier:0, flying:true,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.85, 0.05);
      e.ph = (e.ph || g.rng() * 6) + dt * 2;
      e.lift = Math.sin(e.ph) * 3;
    }
  },
  mite: {
    art:'mite', pal:C.fly, hp:4, r:7, dmg:1, w:0.4, tier:0, flying:true,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 1.6, 0.09);
      e.wob = (e.wob || g.rng() * 6) + dt * 9;
      e.vx += Math.cos(e.wob) * 0.22; e.vy += Math.sin(e.wob * 1.3) * 0.22;
    }
  },
  bulb: {
    art:'bulb', pal:C.ember, hp:11, r:12, dmg:1, w:1.2, tier:1,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.9, 0.1);
      if (t && len(t.x - e.x, t.y - e.y) < 34) e.fuse = (e.fuse || 0) + dt * 2;
      e.fuse = Math.max(0, (e.fuse || 0) - dt * 0.4);
      if (e.fuse > 1) e.hp = 0;
    },
    onDeath(e, g){ g.explode(e.x, e.y, 46, 14, e); }
  },
  sacwalker: {
    art:'sacwalker', pal:C.meat, hp:15, r:12, dmg:1, w:1.4, tier:1,
    update(e, g, dt){ const t = g.target(e); if (t) seek(e, t.x, t.y, 0.7, 0.1); },
    onDeath(e, g){ for (let i = 0; i < 2; i++) g.spawn('mite', e.x + (i ? 9 : -9), e.y); }
  },
  crawler: {
    art:'crawler', pal:C.bone, hp:13, r:11, dmg:1, w:1, tier:1,
    update(e, g, dt){
      // patrols the room edge, turning at the walls
      e.dir = e.dir ?? Math.floor(g.rng() * 4);
      const D = [[1,0],[0,1],[-1,0],[0,-1]][e.dir];
      e.vx = D[0] * 1.5; e.vy = D[1] * 1.5;
      if (g.solid(e.x + D[0] * 16, e.y + D[1] * 16, false)) e.dir = (e.dir + 1) % 4;
      if (every(e, 'fire', 2.6, dt)) radial(e, g, 4, 2, Math.PI / 4);
    }
  },
  spinner: {
    art:'spinner', pal:C.gold, hp:18, r:12, dmg:1, w:1.6, tier:1,
    update(e, g, dt){
      e.spin = (e.spin || 0) + dt * 2.2;
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.42, 0.05);
      if (every(e, 'fire', 0.55, dt)) radial(e, g, 4, 2.1, e.spin);
      e.rot = e.spin;
    }
  },
  gazer: {
    art:'gazer', pal:C.void, hp:20, r:13, dmg:1, w:1.6, tier:1, still:true,
    update(e, g, dt){
      e.vx = e.vy = 0;
      const t = g.target(e);
      if (!t) return;
      e.aim = Math.atan2(t.y - e.y, t.x - e.x);
      e.wind = (e.wind || 0) + dt;
      if (e.wind > 1.5){
        e.wind = 0;
        for (let i = 0; i < 3; i++)
          g.after(i * 0.09, () => g.shoot(e, Math.cos(e.aim) * 3.4, Math.sin(e.aim) * 3.4, { r:4 }));
        g.sfx.spit();
      }
    }
  },
  tickler: {
    art:'tickler', pal:C.toxic, hp:8, r:9, dmg:1, w:0.8, tier:1,
    update(e, g, dt){
      if (every(e, 'turn', 0.35, dt)){
        const t = g.target(e);
        const a = t ? Math.atan2(t.y - e.y, t.x - e.x) + (g.rng() - 0.5) * 2 : g.rng() * TAU;
        e.vx = Math.cos(a) * 2.8; e.vy = Math.sin(a) * 2.8;
      }
    }
  },
  boiler: {
    art:'boiler', pal:C.ember, hp:22, r:13, dmg:1, w:1.8, tier:2,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.55, 0.08);
      if (every(e, 'drip', 0.6, dt)) g.hazard('fire', e.x, e.y, 5);
    }
  },
  leech: {
    art:'leech', pal:C.blood, hp:26, r:12, dmg:1, w:1.6, tier:2,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.65, 0.09);
      if (every(e, 'regen', 1.2, dt)) e.hp = Math.min(e.maxHp, e.hp + 2);
    }
  },
  spiderling: {
    art:'spiderling', pal:C.fly, hp:7, r:9, dmg:1, w:0.7, tier:1,
    update(e, g, dt){
      if (every(e, 'dash', 0.8, dt)){
        const t = g.target(e);
        if (t){
          const a = Math.atan2(t.y - e.y, t.x - e.x) + (g.rng() - 0.5) * 0.9;
          e.vx = Math.cos(a) * 4.2; e.vy = Math.sin(a) * 4.2;
        }
      }
      e.vx *= 0.94; e.vy *= 0.94;
    }
  },
  wisp: {
    art:'wisp', pal:C.frost, hp:12, r:11, dmg:1, w:1.3, tier:1, flying:true,
    update(e, g, dt){
      const t = g.target(e);
      if (t){
        const d = len(t.x - e.x, t.y - e.y);
        if (d < 90) flee(e, t.x, t.y, 1.1, 0.07); else seek(e, t.x, t.y, 0.7, 0.06);
      }
      if (every(e, 'fire', 1.5, dt)) volley(e, g, 2.6, 1, 0, { freeze:true });
    }
  },
  husker: {
    art:'husker', pal:C.rock, hp:40, r:14, dmg:1, w:2.4, tier:2, armour:0.5,
    update(e, g, dt){ const t = g.target(e); if (t) seek(e, t.x, t.y, 0.45, 0.06); }
  },
  sporecap: {
    art:'sporecap', pal:C.toxic, hp:20, r:13, dmg:1, w:1.8, tier:2,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.4, 0.06);
      if (every(e, 'puff', 2.4, dt)){ radial(e, g, 8, 1.5, g.rng() * TAU, { poison:true, r:5 }); g.sfx.spit(); }
    },
    onDeath(e, g){ g.hazard('poison', e.x, e.y, 30); }
  },
  bonewalker: {
    art:'bonewalker', pal:C.bone, hp:24, r:13, dmg:1, w:2, tier:2,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.5, 0.07);
      if (every(e, 'throw', 1.8, dt)) volley(e, g, 2.4, 3, 0.6, { arc:true });
    }
  },
  slugger: {
    art:'slugger', pal:C.brine, hp:28, r:14, dmg:1, w:2, tier:2,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.35, 0.05);
      if (every(e, 'ooze', 0.9, dt)) g.hazard('slime', e.x, e.y, 7);
    }
  },
  flyswarm: {
    art:'flyswarm', pal:C.fly, hp:6, r:8, dmg:1, w:0.5, tier:1, flying:true, orbiter:true,
    update(e, g, dt){
      const h = e.host && e.host.hp > 0 ? e.host : null;
      e.a = (e.a || 0) + dt * 3.2;
      if (h){ e.x = h.x + Math.cos(e.a) * 26; e.y = h.y + Math.sin(e.a) * 26; e.vx = e.vy = 0; }
      else { const t = g.target(e); if (t) seek(e, t.x, t.y, 1.7, 0.08); }
    }
  },
  thorn: {
    art:'thorn', pal:C.rock, hp:30, r:13, dmg:1, w:1.6, tier:2, still:true, armour:0.3,
    update(e, g, dt){
      e.vx = e.vy = 0;
      e.spin = (e.spin || 0) + dt * 0.9;
      if (every(e, 'fire', 1.6, dt)) radial(e, g, 6, 2, e.spin);
    }
  },
  ghoul: {
    art:'ghoul', pal:C.ash, hp:18, r:12, dmg:1, w:1.6, tier:2, flying:true, phase:true,
    update(e, g, dt){ const t = g.target(e); if (t) seek(e, t.x, t.y, 0.78, 0.04); }
  },
  bomber: {
    art:'bomber', pal:C.fly, hp:20, r:13, dmg:1, w:2, tier:2,
    update(e, g, dt){
      const t = g.target(e);
      if (t){
        const d = len(t.x - e.x, t.y - e.y);
        if (d < 70) flee(e, t.x, t.y, 0.9, 0.08); else seek(e, t.x, t.y, 0.6, 0.07);
      }
      if (every(e, 'lob', 2.6, dt)) g.lobBomb(e);
    }
  },
  screamer: {
    art:'screamer', pal:C.void, hp:24, r:13, dmg:1, w:2.2, tier:3,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.35, 0.05);
      e.wind = (e.wind || 0) + dt;
      if (e.wind > 2.6){
        e.wind = 0;
        g.shockwave(e.x, e.y, 96, 1);
        g.sfx.scream(); g.shake(6);
      }
      e.charging = e.wind > 2.0;
    }
  },
  pillar: {
    art:'pillar', pal:C.rock, hp:46, r:14, dmg:1, w:2.6, tier:3, still:true, armour:0.4,
    update(e, g, dt){
      e.vx = e.vy = 0;
      // not `beam` — the renderer treats a truthy e.beam as a boss beam object
      e.sweep = (e.sweep || 0) + dt * 0.8;
      if (every(e, 'fire', 0.32, dt)){
        g.shoot(e, Math.cos(e.sweep) * 2.6, Math.sin(e.sweep) * 2.6);
        g.shoot(e, -Math.cos(e.sweep) * 2.6, -Math.sin(e.sweep) * 2.6);
      }
    }
  },
  broodmother: {
    art:'broodmother', pal:C.meat, hp:52, r:16, dmg:1, w:3.4, tier:3,
    update(e, g, dt){
      const t = g.target(e);
      if (t) seek(e, t.x, t.y, 0.3, 0.05);
      if (every(e, 'lay', 3.2, dt)){
        for (let i = 0; i < 2; i++) g.spawn('mite', e.x + (g.rng() - .5) * 26, e.y + (g.rng() - .5) * 26);
        g.sfx.spawn();
      }
    }
  },
  mimic: {
    art:'mimic', pal:C.gold, hp:26, r:13, dmg:1, w:2, tier:2, disguise:'chest',
    update(e, g, dt){
      const t = g.target(e);
      if (!t) return;
      if (!e.awake){
        e.vx = e.vy = 0;
        if (len(t.x - e.x, t.y - e.y) < 42){ e.awake = true; g.sfx.scream(); g.shake(4); }
        return;
      }
      seek(e, t.x, t.y, 1.1, 0.12);
      if (every(e, 'chomp', 2.2, dt)) volley(e, g, 2.6, 3, 0.9);
    }
  }
};

for (const [id, e] of Object.entries(ENEMIES)){
  e.id = id;
  e.maxHp = e.hp;
}

/** Enemies allowed at a given floor depth, weighted by tier. */
export function poolForDepth(depth){
  const maxTier = depth < 2 ? 1 : depth < 4 ? 2 : 3;
  return Object.values(ENEMIES).filter(e => e.tier <= maxTier && !e.orbiter);
}

/** Rough "how much room does this fill" budget, used by the room populator. */
export const weightOf = e => e.w || 1;
