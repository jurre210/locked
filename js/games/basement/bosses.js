/**
 * Bosses. Each one is a small state machine: pick an attack, run it for a
 * while, return to `idle`. Keeping the scheduler here (rather than in the game
 * loop) means a boss's whole fight reads top to bottom in one place.
 */

const TAU = Math.PI * 2;
const len = (x, y) => Math.hypot(x, y) || 1;

function seek(b, tx, ty, sp, grip = 0.1){
  const dx = tx - b.x, dy = ty - b.y, d = len(dx, dy);
  b.vx += ((dx / d) * sp - b.vx) * grip;
  b.vy += ((dy / d) * sp - b.vy) * grip;
}
function radial(b, g, n, speed, off = 0, opts = {}){
  for (let i = 0; i < n; i++){
    const a = off + i / n * TAU;
    g.shoot(b, Math.cos(a) * speed, Math.sin(a) * speed, { boss:true, ...opts });
  }
}
function aimed(b, g, speed, n = 1, arc = 0.4, opts = {}){
  const t = g.target(b);
  if (!t) return;
  const base = Math.atan2(t.y - b.y, t.x - b.x);
  for (let i = 0; i < n; i++){
    const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * arc);
    g.shoot(b, Math.cos(a) * speed, Math.sin(a) * speed, { boss:true, ...opts });
  }
}

/**
 * Drives the "choose an attack, run it, cool down" cycle.
 * `moves` is a list of { name, time, weight?, when? }.
 */
function schedule(b, g, dt, moves, idleFn){
  b.t = (b.t || 0) - dt;
  if (b.move){
    if (b.t <= 0){ b.move = null; b.t = b.rest ?? 0.5; b.step = 0; }
    return;
  }
  if (b.t > 0){ idleFn && idleFn(b, g, dt); return; }
  const ok = moves.filter(m => !m.when || m.when(b, g));
  const total = ok.reduce((s, m) => s + (m.weight || 1), 0);
  let r = g.rng() * total;
  for (const m of ok){ r -= (m.weight || 1); if (r <= 0){ b.move = m.name; b.t = m.time; b.step = 0; b.mt = 0; break; } }
}

/* palettes: [main, shade, highlight, accent] */
const C = {
  meat:  ['#cf6a72', '#8a3040', '#f2a4a8', '#2c0c14'],
  rot:   ['#8ea456', '#566a2c', '#c8dc90', '#1e2a0c'],
  bone:  ['#e8e2ce', '#a8a08c', '#fffaf0', '#3a2a2a'],
  stone: ['#8a8e9a', '#4e525e', '#c4c8d4', '#22242c'],
  void:  ['#5c4a78', '#2c2044', '#8e78b0', '#c8a0ff'],
  blood: ['#c02c40', '#78101f', '#f07886', '#28060e'],
  ember: ['#e8763a', '#a03f14', '#ffb070', '#fff0c0'],
  frost: ['#8cc6f0', '#4478a8', '#d8f0ff', '#1c3c5c'],
  brine: ['#3fa294', '#1c6a5e', '#84dcd0', '#0c342c'],
  gold:  ['#d8ab48', '#96701c', '#f6dc90', '#3a2808'],
  pale:  ['#ddd4e4', '#a098b0', '#ffffff', '#5a3060'],
  night: ['#2e2c3a', '#16141e', '#4e4a60', '#e8e0ff']
};

/* ------------------------------------------------------------------ */
export const BOSSES = [
  {
    id:'glutton', name:'The Glutton', art:'blob', pal:C.meat, hp:210, r:24, scale:2.4, depth:[0, 2],
    blurb:'It ate the rest of them.',
    update(b, g, dt){
      schedule(b, g, dt, [
        { name:'charge', time:1.4 },
        { name:'spit',   time:1.2 },
        { name:'split',  time:0.9, when: b2 => b2.hp < b2.maxHp * 0.45 && !b2.didSplit }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.5); });

      if (b.move === 'charge'){
        if (!b.step){ const t = g.target(b); if (t){ const d = len(t.x - b.x, t.y - b.y); b.vx = (t.x - b.x) / d * 4.2; b.vy = (t.y - b.y) / d * 4.2; } b.step = 1; g.sfx.charge(); }
      } else if (b.move === 'spit'){
        b.mt += dt;
        if (b.mt > 0.2 * b.step){ b.step++; aimed(b, g, 2.6, 3, 0.7); }
        b.vx *= 0.9; b.vy *= 0.9;
      } else if (b.move === 'split'){
        b.didSplit = true;
        for (let i = 0; i < 2; i++) g.spawn('sacwalker', b.x + (i ? 26 : -26), b.y);
        g.spawn('broodmother', b.x, b.y + 26);
        g.sfx.spawn();
        b.move = null;
      }
    },
    onDeath(b, g){ g.burstPickups(b.x, b.y, 3); }
  },

  {
    id:'carrion', name:'Carrion', art:'bird', pal:C.night, hp:230, r:22, scale:2.3, depth:[0, 3], flying:true,
    blurb:'Still hungry, still circling.',
    update(b, g, dt){
      schedule(b, g, dt, [
        { name:'dive', time:1.5, weight:2 },
        { name:'feathers', time:1.1 },
        { name:'rise', time:1.6, when: b2 => b2.hp < b2.maxHp * 0.5 }
      ], (bb) => {
        bb.orb = (bb.orb || 0) + dt * 1.4;
        const t = g.target(bb);
        if (t) seek(bb, t.x + Math.cos(bb.orb) * 80, t.y + Math.sin(bb.orb) * 60, 1.6, 0.06);
      });

      if (b.move === 'dive'){
        if (!b.step){ const t = g.target(b); if (t){ const d = len(t.x - b.x, t.y - b.y); b.vx = (t.x - b.x) / d * 5.4; b.vy = (t.y - b.y) / d * 5.4; } b.step = 1; g.sfx.charge(); }
        b.vx *= 0.99; b.vy *= 0.99;
      } else if (b.move === 'feathers'){
        b.mt += dt; b.vx *= 0.86; b.vy *= 0.86;
        if (b.mt > 0.25 * b.step){ b.step++; radial(b, g, 6, 2.4, b.mt * 3); }
      } else if (b.move === 'rise'){
        b.vy -= dt * 6;
        b.mt += dt;
        if (b.mt > 0.3 * b.step){ b.step++; aimed(b, g, 3.2, 1, 0, { r:6 }); }
      }
    }
  },

  {
    id:'widow', name:'The Widow', art:'spider', pal:C.void, hp:260, r:24, scale:2.4, depth:[1, 4],
    blurb:'She has been waiting in the corner.',
    update(b, g, dt){
      schedule(b, g, dt, [
        { name:'leap', time:1.3 },
        { name:'brood', time:1.0 },
        { name:'web', time:1.2 }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.6); });

      if (b.move === 'leap'){
        if (!b.step){ const t = g.target(b); if (t){ const d = len(t.x - b.x, t.y - b.y); b.vx = (t.x - b.x) / d * 5; b.vy = (t.y - b.y) / d * 5; b.airborne = true; } b.step = 1; }
        if (b.t < 0.35 && b.airborne){ b.airborne = false; g.shockwave(b.x, b.y, 70, 1); g.shake(5); }
      } else if (b.move === 'brood'){
        if (!b.step){ for (let i = 0; i < 3; i++) g.spawn('spiderling', b.x + (i - 1) * 24, b.y + 18); b.step = 1; g.sfx.spawn(); }
        b.vx *= 0.9; b.vy *= 0.9;
      } else if (b.move === 'web'){
        b.mt += dt; b.vx *= 0.9; b.vy *= 0.9;
        if (b.mt > 0.3 * b.step){ b.step++; g.hazard('web', b.x + (g.rng() - .5) * 90, b.y + (g.rng() - .5) * 60, 16); radial(b, g, 5, 1.9, g.rng() * TAU); }
      }
    }
  },

  {
    id:'gorge', name:'Gorge', art:'maw', pal:C.meat, hp:300, r:26, scale:2.5, depth:[2, 5], still:true,
    blurb:'A room that decided to have a mouth.',
    update(b, g, dt){
      b.vx *= 0.85; b.vy *= 0.85;
      schedule(b, g, dt, [
        { name:'inhale', time:2.2, weight:2 },
        { name:'spray', time:1.4 },
        { name:'chomp', time:1.0 }
      ]);
      if (b.move === 'inhale'){
        g.pullAll(b, 0.1, 2.4);
        b.mt += dt;
        if (b.mt > 0.4 * b.step){ b.step++; aimed(b, g, 2.2, 5, 1.2); }
      } else if (b.move === 'spray'){
        b.mt += dt;
        if (b.mt > 0.12 * b.step){ b.step++; radial(b, g, 3, 2.8, b.mt * 5.5); }
      } else if (b.move === 'chomp'){
        if (!b.step){ g.shockwave(b.x, b.y, 110, 1); g.shake(6); g.sfx.scream(); b.step = 1; }
      }
    }
  },

  {
    id:'rotpile', name:'Rotpile', art:'pile', pal:C.rot, hp:240, r:24, scale:2.4, depth:[0, 3],
    blurb:'Something is still moving in there.',
    update(b, g, dt){
      schedule(b, g, dt, [
        { name:'slam', time:1.2 },
        { name:'hatch', time:1.0 },
        { name:'gas', time:1.4 }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.45); });

      if (b.move === 'slam'){
        if (!b.step){ b.step = 1; b.lift = 22; }
        b.lift = Math.max(0, b.lift - dt * 90);
        if (b.lift === 0 && b.step === 1){ b.step = 2; g.shockwave(b.x, b.y, 92, 1); g.shake(6); radial(b, g, 8, 2.2); }
      } else if (b.move === 'hatch'){
        if (!b.step){ for (let i = 0; i < 3; i++) g.spawn(g.rng() < .5 ? 'grub' : 'hopper', b.x + (i - 1) * 26, b.y); b.step = 1; g.sfx.spawn(); }
      } else if (b.move === 'gas'){
        b.mt += dt;
        if (b.mt > 0.35 * b.step){ b.step++; g.hazard('poison', b.x + (g.rng() - .5) * 70, b.y + (g.rng() - .5) * 50, 26); }
      }
    }
  },

  {
    id:'loam', name:'The Eye of Loam', art:'eye', pal:C.stone, hp:320, r:26, scale:2.6, depth:[3, 6], still:true,
    blurb:'It has been open the entire time.',
    update(b, g, dt){
      b.vx *= 0.9; b.vy *= 0.9;
      schedule(b, g, dt, [
        { name:'sweep', time:3.0, weight:2 },
        { name:'bullets', time:1.8 },
        { name:'blink', time:0.9 }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.28); });

      if (b.move === 'sweep'){
        b.beamA = (b.beamA ?? (g.rng() * TAU)) + dt * 1.15;
        b.beam = { a: b.beamA, len: 260 };
        g.beamDamage(b, b.beamA, 260, 12 * dt);
      } else {
        b.beam = null;
        if (b.move === 'bullets'){
          b.mt += dt;
          if (b.mt > 0.3 * b.step){ b.step++; radial(b, g, 10, 2.1, b.step * 0.31); }
        } else if (b.move === 'blink'){
          if (!b.step){ g.teleportBoss(b); b.step = 1; radial(b, g, 6, 2.6); }
        }
      }
    }
  },

  {
    id:'bellows', name:'Bellows', art:'blob', pal:C.frost, hp:270, r:23, scale:2.3, depth:[2, 5],
    blurb:'In. Out. In.',
    update(b, g, dt){
      schedule(b, g, dt, [
        { name:'swell', time:2.4, weight:2 },
        { name:'skate', time:1.6 }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.55); });

      if (b.move === 'swell'){
        b.puff = Math.min(1, (b.puff || 0) + dt * 0.5);
        b.vx *= 0.9; b.vy *= 0.9;
        if (b.t < 0.15 && !b.step){ b.step = 1; radial(b, g, 16, 2.6, g.rng()); g.shake(5); b.puff = 0; g.sfx.scream(); }
      } else if (b.move === 'skate'){
        if (!b.step){ const a = g.rng() * TAU; b.vx = Math.cos(a) * 4; b.vy = Math.sin(a) * 4; b.step = 1; }
        if (b.mt === undefined) b.mt = 0;
        b.mt += dt;
        if (b.mt > 0.25 * b.step){ b.step++; g.hazard('slime', b.x, b.y, 12); }
      } else b.puff = Math.max(0, (b.puff || 0) - dt);
      b.scaleMul = 1 + (b.puff || 0) * 0.35;
    }
  },

  {
    id:'choir', name:'The Choir', art:'wraith', pal:C.pale, hp:280, r:20, scale:2.1, depth:[3, 6], flying:true,
    blurb:'Three voices, one note.',
    spawnWith:[{ art:'wraith', n:2 }],
    update(b, g, dt){
      b.orb = (b.orb || 0) + dt * 0.9;
      const t = g.target(b);
      if (t) seek(b, t.x + Math.cos(b.orb) * 90, t.y + Math.sin(b.orb) * 60, 1.1, 0.05);
      schedule(b, g, dt, [
        { name:'hymn', time:1.8, weight:2 },
        { name:'wall', time:1.6 },
        { name:'summon', time:0.8, when: b2 => b2.hp < b2.maxHp * 0.6 }
      ]);
      if (b.move === 'hymn'){
        b.mt += dt;
        if (b.mt > 0.2 * b.step){ b.step++; aimed(b, g, 2.4, 1, 0, { homing:0.6 }); }
      } else if (b.move === 'wall'){
        b.mt += dt;
        if (b.mt > 0.4 * b.step){ b.step++; radial(b, g, 12, 1.8, b.step * 0.26); }
      } else if (b.move === 'summon'){
        if (!b.step){ for (let i = 0; i < 2; i++) g.spawn('ghoul', b.x + (i ? 30 : -30), b.y); b.step = 1; g.sfx.spawn(); }
      }
    }
  },

  {
    id:'stitch', name:'Stitch', art:'golem', pal:C.bone, hp:330, r:25, scale:2.5, depth:[4, 7],
    blurb:'Assembled out of what was left.',
    update(b, g, dt){
      schedule(b, g, dt, [
        { name:'pound', time:1.5, weight:2 },
        { name:'blink', time:1.0 },
        { name:'rake', time:1.6 }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.75); });

      if (b.move === 'pound'){
        if (!b.step){ b.step = 1; b.lift = 26; }
        b.lift = Math.max(0, b.lift - dt * 110);
        if (b.lift === 0 && b.step === 1){
          b.step = 2; g.shockwave(b.x, b.y, 104, 1.5); g.shake(8);
          radial(b, g, 12, 2.4); g.sfx.slam();
        }
      } else if (b.move === 'blink'){
        if (!b.step){ g.teleportBoss(b); b.step = 1; radial(b, g, 8, 2.2); }
      } else if (b.move === 'rake'){
        b.mt += dt;
        if (b.mt > 0.18 * b.step){ b.step++; aimed(b, g, 3.4, 2, 0.35, { r:6 }); }
      }
    }
  },

  {
    id:'warden', name:'The Warden', art:'golem', pal:C.stone, hp:380, r:26, scale:2.6, depth:[4, 8], armour:0.35,
    blurb:'Nothing gets past it. Nothing has.',
    update(b, g, dt){
      schedule(b, g, dt, [
        { name:'bash', time:1.8, weight:2 },
        { name:'hurl', time:1.5 },
        { name:'quake', time:1.4 }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.55); });

      if (b.move === 'bash'){
        if (!b.step){ const t = g.target(b); if (t){ const d = len(t.x - b.x, t.y - b.y); b.vx = (t.x - b.x) / d * 5.6; b.vy = (t.y - b.y) / d * 5.6; } b.step = 1; g.sfx.charge(); }
      } else if (b.move === 'hurl'){
        b.mt += dt; b.vx *= 0.88; b.vy *= 0.88;
        if (b.mt > 0.35 * b.step){ b.step++; aimed(b, g, 2.6, 1, 0, { r:8, dmg:1 }); }
      } else if (b.move === 'quake'){
        if (!b.step){ b.step = 1; g.shockwave(b.x, b.y, 140, 1.5); g.shake(9); g.rainRocks(6); g.sfx.slam(); }
      }
    },
    onWall(b, g){ if (b.move === 'bash'){ g.shake(8); g.rainRocks(3); b.move = null; b.t = 0.6; } }
  },

  {
    id:'twins', name:'The Twins', art:'bird', pal:C.blood, hp:190, r:19, scale:2.0, depth:[2, 5], flying:true,
    blurb:'Neither will go first.',
    spawnWith:[{ art:'bird', n:1, pal:C.frost }],
    update(b, g, dt){
      const t = g.target(b);
      b.orb = (b.orb || 0) + dt * 1.8 * (b.mirror ? -1 : 1);
      if (t) seek(b, t.x + Math.cos(b.orb) * 96, t.y + Math.sin(b.orb) * 64, 2.0, 0.07);
      schedule(b, g, dt, [
        { name:'lance', time:1.2, weight:2 },
        { name:'cross', time:1.0 }
      ]);
      if (b.move === 'lance'){
        b.mt += dt;
        if (b.mt > 0.22 * b.step){ b.step++; aimed(b, g, 3.4, 1); }
      } else if (b.move === 'cross'){
        if (!b.step){ b.step = 1; radial(b, g, 4, 2.8, b.orb); }
      }
    }
  },

  {
    id:'hunger', name:'The Hunger', art:'maw', pal:C.blood, hp:420, r:27, scale:2.7, depth:[5, 8],
    blurb:'It has your name written down somewhere.',
    update(b, g, dt){
      schedule(b, g, dt, [
        { name:'lash', time:2.6, weight:2 },
        { name:'flood', time:2.0 },
        { name:'call', time:1.0 },
        { name:'rush', time:1.4 }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.5); });

      if (b.move === 'lash'){
        b.beamA = (b.beamA ?? 0) + dt * 1.6;
        b.beam = { a: b.beamA, len: 300, colour:'#ff3b4a' };
        g.beamDamage(b, b.beamA, 300, 16 * dt);
        b.vx *= 0.9; b.vy *= 0.9;
      } else {
        b.beam = null;
        if (b.move === 'flood'){
          b.mt += dt;
          if (b.mt > 0.16 * b.step){ b.step++; radial(b, g, 5, 2.4, b.step * 0.42); }
        } else if (b.move === 'call'){
          if (!b.step){ for (let i = 0; i < 3; i++) g.spawn('ghoul', b.x + (i - 1) * 30, b.y + 20); b.step = 1; g.sfx.spawn(); }
        } else if (b.move === 'rush'){
          if (!b.step){ const t = g.target(b); if (t){ const d = len(t.x - b.x, t.y - b.y); b.vx = (t.x - b.x) / d * 5.2; b.vy = (t.y - b.y) / d * 5.2; } b.step = 1; }
        }
      }
    }
  },

  {
    id:'paleMother', name:'Pale Mother', art:'wraith', pal:C.pale, hp:460, r:26, scale:2.7, depth:[6, 8], flying:true,
    blurb:'She only wants to see you.',
    update(b, g, dt){
      const frac = b.hp / b.maxHp;
      b.phase = frac > 0.6 ? 1 : frac > 0.3 ? 2 : 3;
      schedule(b, g, dt, [
        { name:'reach', time:1.6, weight:2 },
        { name:'wail', time:2.0 },
        { name:'spiral', time:2.4, when: () => b.phase >= 2 },
        { name:'brood', time:1.0, when: () => b.phase >= 2 },
        { name:'collapse', time:2.6, when: () => b.phase === 3 }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.5 + bb.phase * 0.25); });

      if (b.move === 'reach'){
        b.mt += dt;
        if (b.mt > 0.24 * b.step){ b.step++; aimed(b, g, 2.8, 1 + b.phase, 0.5, { homing:0.4 }); }
      } else if (b.move === 'wail'){
        if (!b.step){ b.step = 1; g.shockwave(b.x, b.y, 120, 1); g.shake(7); g.sfx.scream(); }
        b.mt += dt;
        if (b.mt > 0.5 * b.step){ b.step++; radial(b, g, 10 + b.phase * 2, 2.2, b.mt); }
      } else if (b.move === 'spiral'){
        b.mt += dt;
        if (b.mt > 0.08 * b.step){ b.step++; radial(b, g, 2, 2.4, b.step * 0.5); }
      } else if (b.move === 'brood'){
        if (!b.step){ for (let i = 0; i < 2 + b.phase; i++) g.spawn('mite', b.x + (g.rng() - .5) * 60, b.y + (g.rng() - .5) * 40); b.step = 1; }
      } else if (b.move === 'collapse'){
        b.beamA = (b.beamA ?? 0) + dt * 2.2;
        b.beam = { a: b.beamA, len:280, colour:'#e8e0ff' };
        g.beamDamage(b, b.beamA, 280, 14 * dt);
        g.beamDamage(b, b.beamA + Math.PI, 280, 14 * dt);
      }
      if (b.move !== 'collapse') b.beam = null;
    }
  },

  {
    id:'null', name:'Null', art:'eye', pal:C.night, hp:560, r:28, scale:2.8, depth:[8, 9], final:true,
    blurb:'The thing at the bottom.',
    update(b, g, dt){
      const frac = b.hp / b.maxHp;
      b.phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
      schedule(b, g, dt, [
        { name:'grid', time:2.2, weight:2 },
        { name:'lance', time:2.6 },
        { name:'swarm', time:1.2 },
        { name:'invert', time:1.0, when: () => b.phase >= 2 },
        { name:'finale', time:3.2, when: () => b.phase === 3 }
      ], (bb) => { const t = g.target(bb); if (t) seek(bb, t.x, t.y, 0.35 + bb.phase * 0.2); });

      if (b.move === 'grid'){
        b.mt += dt;
        if (b.mt > 0.34 * b.step){ b.step++; radial(b, g, 8 + b.phase * 2, 2.0, b.step * 0.4); }
      } else if (b.move === 'lance'){
        b.beamA = (b.beamA ?? 0) + dt * (0.9 + b.phase * 0.35);
        b.beam = { a: b.beamA, len:300, colour:'#c8a0ff' };
        g.beamDamage(b, b.beamA, 300, 14 * dt);
      } else if (b.move === 'swarm'){
        if (!b.step){ for (let i = 0; i < 2 + b.phase; i++) g.spawn(g.rng() < .5 ? 'ghoul' : 'wisp', b.x + (g.rng() - .5) * 80, b.y + (g.rng() - .5) * 50); b.step = 1; g.sfx.spawn(); }
      } else if (b.move === 'invert'){
        if (!b.step){ g.teleportBoss(b); b.step = 1; g.shake(6); radial(b, g, 14, 2.6); }
      } else if (b.move === 'finale'){
        b.mt += dt;
        if (b.mt > 0.1 * b.step){ b.step++; radial(b, g, 3, 2.3, b.step * 0.7); aimed(b, g, 3.0, 1, 0, { homing:0.5 }); }
      }
      if (b.move !== 'lance' && b.move !== 'finale') b.beam = null;
    },
    onDeath(b, g){ g.win(); }
  }
];

BOSSES.forEach(b => { b.isBoss = true; });

export const BOSS_BY_ID = Object.fromEntries(BOSSES.map(b => [b.id, b]));

/** Bosses legal at a floor depth (0-indexed). */
export function bossesForDepth(depth){
  const list = BOSSES.filter(b => !b.final && depth >= b.depth[0] && depth <= b.depth[1]);
  return list.length ? list : BOSSES.filter(b => !b.final);
}
