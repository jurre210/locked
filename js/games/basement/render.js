/**
 * All drawing. The game owns state; this file only reads it.
 *
 * Everything is nearest-neighbour pixel art on a fixed 480x336 virtual canvas,
 * which the CSS then scales up. Working at a fixed resolution means the HUD
 * never has to reflow and one integer scale keeps the pixels square.
 */
import {
  CELL, GRID_W, GRID_H, WALL, HUD_H, ROOM_X, ROOM_Y, ROOM_W, ROOM_H, VW, VH,
  THEMES, floorTile, wallTile, obstacleSprite, DOOR_STYLE, doorEmblem,
  PICKUP_ART, pillSprite, itemIcon, pedestalSprite, shopkeepSprite, slotSprite,
  beggarSprite, altarSprite, trapdoorSprite, drawExplosion, tearSprite, sparkSprite
} from './art.js';
import { draw, drawShadow, crisp, silhouette } from './sprite.js';
import { enemySprite, bossSprite, familiarSprite } from './mobs-art.js';
import { ROOM_TINT, mapBounds } from './floor.js';

const HEART_ART = {
  red: 'heartRed', half: 'heartHalf', soul: 'heartSoul', black: 'heartBlack',
  eternal: 'heartEternal', rot: 'heartRot'
};

export function drawFrame(ctx, g){
  crisp(ctx);
  ctx.clearRect(0, 0, VW, VH);

  ctx.save();
  if (g.shakeT > 0){
    const s = g.shakeMag * (g.shakeT / 0.28);
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawRoom(ctx, g);
  drawFloorProps(ctx, g);
  drawEntities(ctx, g);
  drawProjectiles(ctx, g);
  drawEffects(ctx, g);
  if (g.floor?.curse?.id === 'dark') drawDarkness(ctx, g);
  ctx.restore();

  drawHud(ctx, g);
  drawOverlays(ctx, g);
}

/* ------------------------------------------------------------------ */
/* room                                                                */
/* ------------------------------------------------------------------ */
function drawRoom(ctx, g){
  const theme = g.floor.theme;
  const t = THEMES[theme];
  const room = g.room;

  // floor
  for (let y = 0; y < GRID_H; y++){
    for (let x = 0; x < GRID_W; x++){
      const v = (x * 7 + y * 13 + (room.seed & 3)) % 4;
      const s = floorTile(theme, v);
      ctx.drawImage(s.c, ROOM_X + x * CELL, ROOM_Y + y * CELL);
    }
  }
  if (t.liquid){
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = t.liquid;
    ctx.fillRect(ROOM_X, ROOM_Y, ROOM_W, ROOM_H);
    ctx.restore();
  }

  // walls
  const wx0 = ROOM_X - WALL, wy0 = ROOM_Y - WALL;
  for (let x = -1; x <= GRID_W; x++){
    ctx.drawImage(wallTile(theme, 'top', x & 1).c, wx0 + (x + 1) * CELL, wy0);
    ctx.drawImage(wallTile(theme, 'bottom', x & 1).c, wx0 + (x + 1) * CELL, ROOM_Y + ROOM_H);
  }
  for (let y = 0; y < GRID_H; y++){
    ctx.drawImage(wallTile(theme, 'left', y & 1).c, wx0, ROOM_Y + y * CELL);
    ctx.drawImage(wallTile(theme, 'right', y & 1).c, ROOM_X + ROOM_W, ROOM_Y + y * CELL);
  }

  drawDoors(ctx, g);
  drawObstacles(ctx, g);
}

const DOOR_POS = {
  n: { x: ROOM_X + ROOM_W / 2, y: ROOM_Y - WALL / 2, w: 56, h: WALL },
  s: { x: ROOM_X + ROOM_W / 2, y: ROOM_Y + ROOM_H + WALL / 2, w: 56, h: WALL },
  w: { x: ROOM_X - WALL / 2, y: ROOM_Y + ROOM_H / 2, w: WALL, h: 56 },
  e: { x: ROOM_X + ROOM_W + WALL / 2, y: ROOM_Y + ROOM_H / 2, w: WALL, h: 56 }
};
export { DOOR_POS };

function drawDoors(ctx, g){
  for (const [dir, door] of Object.entries(g.room.doors)){
    if (door.hidden && !door.revealed) continue;
    const p = DOOR_POS[dir];
    const st = DOOR_STYLE[door.kind] || DOOR_STYLE.normal;
    const x = p.x - p.w / 2, y = p.y - p.h / 2;

    ctx.fillStyle = '#0a0810';
    ctx.fillRect(x, y, p.w, p.h);
    ctx.fillStyle = st.frame;
    ctx.fillRect(x, y, p.w, p.h);
    ctx.fillStyle = st.panel;
    ctx.fillRect(x + 3, y + 3, p.w - 6, p.h - 6);

    const open = door.open && !door.locked;
    if (open){
      // an open door is a hole through to the next room
      ctx.fillStyle = '#05040a';
      const ix = dir === 'w' || dir === 'e' ? x + 2 : x + 8;
      const iy = dir === 'n' || dir === 's' ? y + 2 : y + 8;
      const iw = dir === 'w' || dir === 'e' ? p.w - 4 : p.w - 16;
      const ih = dir === 'n' || dir === 's' ? p.h - 4 : p.h - 16;
      ctx.fillRect(ix, iy, iw, ih);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      for (let i = 0; i < 4; i++){
        if (dir === 'n' || dir === 's') ctx.fillRect(x + 6 + i * 12, y + 6, 4, p.h - 12);
        else ctx.fillRect(x + 6, y + 6 + i * 12, p.w - 12, 4);
      }
    }
    if (door.locked){
      const k = PICKUP_ART.key();
      draw(ctx, k, p.x, p.y, { scale: 1.4 });
    }
    const emb = st.glow && doorEmblem(door.kind, st.glow);
    if (emb && !door.locked) draw(ctx, emb, p.x, p.y, { scale: door.open ? 1.4 : 2 , alpha: door.open ? .5 : 1 });
    if (st.glow){
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.sin(g.time * 3) * 0.05;
      ctx.fillStyle = st.glow;
      ctx.fillRect(x, y, p.w, p.h);
      ctx.restore();
    }
  }
}

function drawObstacles(ctx, g){
  const theme = g.floor.theme;
  const cells = g.room.cells;
  for (let y = 0; y < GRID_H; y++){
    for (let x = 0; x < GRID_W; x++){
      const c = cells[y][x];
      if (c === '.') continue;
      const px = ROOM_X + x * CELL + CELL / 2;
      const py = ROOM_Y + y * CELL + CELL / 2;
      const kind = c === '#' ? 'rock' : c === 'X' ? 'block' : c === '^' ? 'spikes'
        : c === 'o' ? 'pit' : c === 'M' ? 'mound' : c === 'W' ? 'web' : c === 'F' ? 'torch' : null;
      if (!kind) continue;
      if (kind === 'pit'){ draw(ctx, obstacleSprite('pit', theme), px, py, { scale:2 }); continue; }
      if (kind === 'torch'){
        draw(ctx, obstacleSprite('torch', theme), px, py, { scale:2 });
        const f = 0.5 + Math.sin(g.time * 7 + x) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.14 + f * 0.1;
        const grd = ctx.createRadialGradient(px, py - 8, 2, px, py - 8, 46);
        grd.addColorStop(0, '#ffd88a'); grd.addColorStop(1, 'rgba(255,180,60,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(px, py - 8, 46, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      draw(ctx, obstacleSprite(kind, theme), px, py + 2, { scale:2, shadow: kind === 'rock' || kind === 'block' });
    }
  }
}

/* ------------------------------------------------------------------ */
/* props + pickups                                                     */
/* ------------------------------------------------------------------ */
function drawFloorProps(ctx, g){
  const theme = g.floor.theme;
  for (const h of g.hazards){
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, h.life / h.maxLife * 0.55);
    ctx.fillStyle = h.kind === 'fire' ? '#ff8a3d' : h.kind === 'poison' ? '#8fd83a'
      : h.kind === 'slime' ? '#3aa0a0' : h.kind === 'web' ? '#e6e6f0' : '#ffffff';
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (h.kind === 'fire'){
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(g.time * 9 + h.x) * 0.25;
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(h.x, h.y - 2, h.r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  for (const p of g.props){
    const bob = Math.sin(g.time * 2 + p.x * 0.1) * 1.5;
    if (p.kind === 'pedestal'){
      draw(ctx, pedestalSprite(theme), p.x, p.y + 8, { scale:2 });
      if (p.item){
        drawShadow(ctx, p.x, p.y + 10, 10, 0.35);
        draw(ctx, itemIcon(p.item), p.x, p.y - 8 + bob, { scale:1.7 });
        if (p.price != null) priceTag(ctx, g, p.x, p.y + 16, p.price, p.priceKind);
      }
    } else if (p.kind === 'chest'){
      draw(ctx, obstacleSprite('chest', theme), p.x, p.y, { scale:2, shadow:true, alpha: p.open ? 0.55 : 1 });
      if (p.locked) draw(ctx, PICKUP_ART.key(), p.x, p.y - 12, { scale:1.1, alpha:.9 });
    } else if (p.kind === 'shopkeep'){
      draw(ctx, shopkeepSprite(), p.x, p.y, { scale:2, shadow:true });
    } else if (p.kind === 'slot'){
      draw(ctx, slotSprite(), p.x, p.y, { scale:2, shadow:true });
      priceTag(ctx, g, p.x, p.y + 20, p.price, 'coin');
    } else if (p.kind === 'beggar'){
      draw(ctx, beggarSprite(), p.x, p.y, { scale:2, shadow:true });
      priceTag(ctx, g, p.x, p.y + 20, 1, p.want || 'coin');
    } else if (p.kind === 'altar'){
      draw(ctx, altarSprite(), p.x, p.y, { scale:2, shadow:true });
    } else if (p.kind === 'trapdoor'){
      draw(ctx, trapdoorSprite(theme), p.x, p.y, { scale:2 });
    } else if (p.kind === 'ladder'){
      draw(ctx, trapdoorSprite(theme), p.x, p.y, { scale:2 });
      ctx.save(); ctx.globalAlpha = .25 + Math.sin(g.time * 3) * .1;
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(p.x - 14, p.y - 14, 28, 28);
      ctx.restore();
    }
  }

  for (const p of g.pickups){
    const bob = Math.sin(g.time * 3 + p.seed) * 1.6;
    const art = p.kind === 'pill' ? pillSprite(p.variant || 0)
      : PICKUP_ART[p.kind] ? PICKUP_ART[p.kind]() : PICKUP_ART.coin();
    drawShadow(ctx, p.x, p.y + 7, 7, 0.28);
    draw(ctx, art, p.x, p.y + bob, { scale:1.7 });
    if (p.price != null) priceTag(ctx, g, p.x, p.y + 17, p.price, p.priceKind);
  }
}

function priceTag(ctx, g, x, y, price, kind = 'coin'){
  ctx.save();
  ctx.font = '700 9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = kind === 'heart' ? `${price}♥` : kind === 'soul' ? `${price} soul` : String(price);
  const w = ctx.measureText(label).width + 10;
  ctx.fillStyle = 'rgba(6,4,10,.78)';
  ctx.fillRect(x - w / 2, y - 6, w, 12);
  ctx.fillStyle = price === 0 ? '#8fe0b0' : kind === 'coin' ? '#ffd166' : '#ff7a7a';
  ctx.fillText(price === 0 ? 'free' : label, x, y);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* entities                                                            */
/* ------------------------------------------------------------------ */
function drawEntities(ctx, g){
  const all = [];
  for (const e of g.enemies) if (e.hp > 0 || e.deathT > 0) all.push({ z: e.y, kind:'enemy', e });
  for (const f of g.familiars) all.push({ z: f.y, kind:'familiar', e: f });
  for (const p of g.players) if (!p.dead) all.push({ z: p.y, kind:'player', e: p });
  for (const d of g.decoys) all.push({ z: d.y, kind:'decoy', e: d });
  all.sort((a, b) => a.z - b.z);

  for (const it of all){
    if (it.kind === 'enemy') drawEnemy(ctx, g, it.e);
    else if (it.kind === 'player') drawPlayer(ctx, g, it.e);
    else if (it.kind === 'familiar') drawFamiliar(ctx, g, it.e);
    else drawDecoy(ctx, g, it.e);
  }
}

function drawEnemy(ctx, g, e){
  const def = e.def;
  const scale = (def.scale || 1.6) * (e.scaleMul || 1);
  const art = def.isBoss ? bossSprite(def.art, e.pal || def.pal) : enemySprite(def.art, e.pal || def.pal);
  const y = e.y - (e.lift || 0);

  if (e.beam) drawBeam(ctx, g, e);

  drawShadow(ctx, e.x, e.y + e.r * 0.7, e.r * 0.85, 0.32);

  let tint = null, amt = 1;
  if (e.deathT > 0){ tint = '#ffffff'; amt = 0.7; }
  else if (e.flash > 0) tint = '#ffffff';
  else if (e.frozen > 0) tint = '#a8d8ff';
  else if (e.charmed > 0) tint = '#ff8fa3';
  else if (e.poison > 0) tint = '#8fd83a';
  else if (e.burn > 0) tint = '#ff8a3d';
  const alpha = e.deathT > 0 ? Math.max(0, e.deathT / 0.3) : (def.phase ? 0.72 : 1);

  draw(ctx, art, e.x, y, {
    scale, alpha, tint, tintAmount: tint === '#ffffff' ? 0.85 : 0.42,
    rot: e.rot || 0, flip: e.vx < -0.2
  });

  if (e.charging){
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(g.time * 30) * 0.25;
    ctx.strokeStyle = '#ff5c5c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, y, e.r + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (e.frozen > 0){
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = '#bfe4ff';
    ctx.fillRect(e.x - e.r - 2, y - e.r - 2, (e.r + 2) * 2, (e.r + 2) * 2);
    ctx.restore();
  }
}

function drawBeam(ctx, g, e){
  const { a, len, colour = '#ff9a3d' } = e.beam;
  // one bad frame must never take down the whole render loop
  if (!Number.isFinite(a) || !Number.isFinite(len)) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(a);
  const grd = ctx.createLinearGradient(0, 0, len, 0);
  grd.addColorStop(0, colour);
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.55 + Math.sin(g.time * 24) * 0.12;
  ctx.fillStyle = grd;
  ctx.fillRect(0, -5, len, 10);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, -1.5, len, 3);
  ctx.restore();
}

function drawPlayer(ctx, g, p){
  const frame = (Math.floor(p.walkT) % 2) | 0;
  const art = p.art[p.facing][frame];
  const blink = p.invuln > 0 && Math.floor(g.time * 18) % 2 === 0;
  drawShadow(ctx, p.x, p.y + 12, 10, p.flags?.fly ? 0.18 : 0.34);
  const lift = p.flags?.fly ? Math.sin(g.time * 2.4) * 2 - 3 : 0;

  if (p.temp.berserk > 0){
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(g.time * 16) * 0.15;
    ctx.fillStyle = '#ff3b4a';
    ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  draw(ctx, art, p.x, p.y - 4 + lift, {
    scale:2, flip: p.flip, alpha: blink ? 0.45 : 1,
    tint: p.hitFlash > 0 ? '#ff5c5c' : null, tintAmount: 0.6
  });

  if (p.chargeShot > 0.05){
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.chargeShot);
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(p.x, p.y - 4, 3 + p.chargeShot * 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // co-op tag so you can find yourself in a crowd
  if (g.players.length > 1){
    ctx.save();
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = PLAYER_COLOURS[p.index % 4];
    ctx.fillText('P' + (p.index + 1), p.x, p.y - 26);
    ctx.restore();
  }

  for (const o of p.orbitals){
    draw(ctx, familiarSprite('cube', o.pal), o.x, o.y, { scale:1.5 });
  }
}

export const PLAYER_COLOURS = ['#ffd166', '#7fc3ff', '#8fe0b0', '#ff8ae0'];

function drawFamiliar(ctx, g, f){
  drawShadow(ctx, f.x, f.y + 8, 6, 0.24);
  draw(ctx, familiarSprite(f.art, f.pal), f.x, f.y + Math.sin(g.time * 4 + f.seed) * 1.5, { scale:1.6 });
}

function drawDecoy(ctx, g, d){
  ctx.save();
  ctx.globalAlpha = 0.6 + Math.sin(g.time * 8) * 0.2;
  drawShadow(ctx, d.x, d.y + 10, 9, 0.2);
  draw(ctx, d.art, d.x, d.y - 4, { scale:2, tint:'#8fe0b0', tintAmount:0.5 });
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* projectiles + effects                                               */
/* ------------------------------------------------------------------ */
function drawProjectiles(ctx, g){
  for (const t of g.tears){
    const s = tearSprite(t.colour, t.hi, t.big);
    draw(ctx, s, t.x, t.y - (t.z || 0), { scale: t.scale || 1.6, alpha: t.fade ?? 1 });
  }
  for (const b of g.bombs){
    const flash = b.fuse < 0.6 && Math.floor(g.time * 16) % 2 === 0;
    drawShadow(ctx, b.x, b.y + 8, 8, 0.3);
    draw(ctx, PICKUP_ART.bomb(), b.x, b.y - (b.z || 0), { scale:1.7, tint: flash ? '#ffffff' : null, tintAmount:0.7 });
  }
}

function drawEffects(ctx, g){
  for (const p of g.particles){
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    if (p.spark){ draw(ctx, sparkSprite(p.colour), p.x, p.y, { scale: p.size || 1 }); }
    else { ctx.fillStyle = p.colour; ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2); }
    ctx.restore();
  }
  for (const b of g.blasts) drawExplosion(ctx, b.x, b.y, b.r * (0.6 + b.t * 0.6), b.t);
  for (const w of g.waves){
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - w.t) * 0.6;
    ctx.strokeStyle = w.colour || '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r * w.t, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  for (const f of g.floaters){
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.colour || '#fff';
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function drawDarkness(ctx, g){
  const p = g.players.find(q => !q.dead) || g.players[0];
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const grd = ctx.createRadialGradient(p.x, p.y, 20, p.x, p.y, 130);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.65, 'rgba(0,0,0,.72)');
  grd.addColorStop(1, 'rgba(0,0,0,.94)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, HUD_H, VW, VH - HUD_H);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* hud                                                                 */
/* ------------------------------------------------------------------ */
function drawHud(ctx, g){
  ctx.fillStyle = '#07060c';
  ctx.fillRect(0, 0, VW, HUD_H);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fillRect(0, HUD_H - 1, VW, 1);

  const hideHp = g.floor?.curse?.id === 'unknown';
  let hx = 8;
  for (const p of g.players){
    drawPlayerHud(ctx, g, p, hx, 5, hideHp);
    hx += g.players.length > 2 ? 108 : 148;
  }

  drawMinimap(ctx, g);
  if (g.bossRef && g.bossRef.hp > 0) drawBossBar(ctx, g);

  if (g.floor?.curse){
    ctx.save();
    ctx.font = '600 9px ui-monospace, monospace';
    ctx.fillStyle = '#b07fff';
    ctx.textAlign = 'center';
    ctx.fillText(g.floor.curse.name.toLowerCase(), VW / 2, HUD_H - 6);
    ctx.restore();
  }
}

function drawPlayerHud(ctx, g, p, x, y, hide){
  // hearts
  if (!hide){
    let i = 0;
    const put = (kind, half) => {
      const art = PICKUP_ART[half ? 'heartHalf' : HEART_ART[kind]]();
      draw(ctx, art, x + 7 + (i % 6) * 13, y + 7 + Math.floor(i / 6) * 12, { scale:1.2 });
      i++;
    };
    const containers = Math.ceil(p.maxRed / 2);
    for (let c = 0; c < containers; c++){
      const filled = p.red - c * 2;
      if (filled >= 2) put('red', false);
      else if (filled === 1) put('red', true);
      else {
        ctx.save(); ctx.globalAlpha = .22;
        draw(ctx, PICKUP_ART.heartRed(), x + 7 + (i % 6) * 13, y + 7 + Math.floor(i / 6) * 12, { scale:1.2 });
        ctx.restore(); i++;
      }
    }
    for (let c = 0; c < Math.ceil(p.soul / 2); c++) put('soul', p.soul - c * 2 === 1);
    for (let c = 0; c < Math.ceil(p.black / 2); c++) put('black', p.black - c * 2 === 1);
  } else {
    ctx.save(); ctx.font = '600 10px ui-monospace, monospace'; ctx.fillStyle = '#6a6a80';
    ctx.fillText('? ? ?', x + 4, y + 12); ctx.restore();
  }

  // consumables
  ctx.save();
  ctx.font = '700 10px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  const row = y + 32;
  const stat = (art, val, ox) => {
    draw(ctx, art, x + ox, row, { scale:1.1 });
    ctx.fillStyle = '#e8e4f0';
    ctx.fillText(String(val), x + ox + 8, row + 1);
  };
  stat(PICKUP_ART.coin(), p.coins, 6);
  stat(PICKUP_ART.bomb(), p.bombs, 34);
  stat(PICKUP_ART.key(), p.keys, 62);
  ctx.restore();

  // active + trinket + card
  const ax = x + 92;
  if (p.active){
    const full = p.active.charge === 0 || p.charge >= p.active.charge;
    ctx.save();
    ctx.globalAlpha = full ? 1 : 0.5;
    draw(ctx, itemIcon(p.active), ax, y + 16, { scale:1.3 });
    ctx.restore();
    if (p.active.charge > 0){
      const w = 20, h = 3;
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(ax - w / 2, y + 30, w, h);
      ctx.fillStyle = full ? '#8fe0b0' : '#ffd166';
      ctx.fillRect(ax - w / 2, y + 30, w * (p.charge / p.active.charge), h);
    }
  }
  if (p.trinket) draw(ctx, itemIcon(p.trinket), ax + 24, y + 12, { scale:1 });
  if (p.card) draw(ctx, PICKUP_ART.card(), ax + 24, y + 30, { scale:1 });
  else if (p.pill) draw(ctx, pillSprite(p.pill.variant), ax + 24, y + 30, { scale:1 });
}

function drawBossBar(ctx, g){
  const b = g.bossRef;
  const w = 200, x = (VW - w) / 2, y = HUD_H + 6;
  ctx.save();
  ctx.fillStyle = 'rgba(6,4,10,.72)';
  ctx.fillRect(x - 2, y - 2, w + 4, 12);
  ctx.fillStyle = '#2a1420';
  ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = '#e5384a';
  ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 8);
  ctx.font = '700 9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd8d8';
  ctx.fillText(b.def.name.toLowerCase(), VW / 2, y + 20);
  ctx.restore();
}

function drawMinimap(ctx, g){
  if (g.floor?.curse?.id === 'lost' && !g.showFullMap) return;
  const bounds = mapBounds(g.floor);
  const big = g.mapHeld;
  const cw = big ? 16 : 8, ch = big ? 12 : 6, gap = 1;
  const w = bounds.w * (cw + gap), h = bounds.h * (ch + gap);
  const x0 = VW - w - 8, y0 = big ? (VH - h) / 2 : 6;

  ctx.save();
  if (big){
    ctx.fillStyle = 'rgba(4,3,8,.86)';
    ctx.fillRect(0, HUD_H, VW, VH - HUD_H);
  }
  const ox = big ? (VW - w) / 2 : x0;
  ctx.fillStyle = 'rgba(4,3,8,.6)';
  ctx.fillRect(ox - 3, y0 - 3, w + 6, h + 6);

  for (const r of g.floor.rooms.values()){
    const known = r.visited || r.seen || g.showFullMap;
    if (!known) continue;
    if (r.hidden && !(r.visited || g.showSecrets)) continue;
    const x = ox + (r.gx - bounds.x0) * (cw + gap);
    const y = y0 + (r.gy - bounds.y0) * (ch + gap);
    const cur = r === g.room;
    const tint = ROOM_TINT[r.type] || '#c8c8d4';
    ctx.globalAlpha = r.visited ? 1 : 0.42;
    ctx.fillStyle = cur ? '#ffffff' : (r.visited ? tint : 'rgba(200,200,220,.5)');
    ctx.fillRect(x, y, cw, ch);
    if (!r.visited){
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(6,4,10,.72)';
      ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      ctx.fillStyle = tint;
      ctx.fillRect(x + cw / 2 - 1, y + ch / 2 - 1, 2, 2);
    }
    if (big && r.visited && r.type !== 'normal' && r.type !== 'start'){
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#05040a';
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(LABEL[r.type] || '', x + cw / 2, y + ch / 2 + 3);
    }
  }
  ctx.globalAlpha = 1;
  if (big){
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a8494';
    ctx.fillText(`${g.floor.name} — floor ${g.floor.depth + 1}`, VW / 2, y0 - 12);
  }
  ctx.restore();
}

const LABEL = { boss:'B', treasure:'I', shop:'$', secret:'?', supersecret:'??', curse:'C',
  sacrifice:'X', arcade:'A', library:'L', challenge:'!', miniboss:'M', devil:'D', angel:'A', planetarium:'P' };

/* ------------------------------------------------------------------ */
/* overlays                                                            */
/* ------------------------------------------------------------------ */
function drawOverlays(ctx, g){
  if (g.banner && g.banner.t > 0){
    const a = Math.min(1, g.banner.t / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '700 20px ui-monospace, monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(g.banner.title, VW / 2, VH / 2 - 10);
    if (g.banner.sub){
      ctx.font = '500 11px ui-monospace, monospace';
      ctx.fillStyle = '#b0aac0';
      ctx.fillText(g.banner.sub, VW / 2, VH / 2 + 10);
    }
    ctx.restore();
  }

  if (g.toast && g.toast.t > 0){
    const a = Math.min(1, g.toast.t / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '700 11px ui-monospace, monospace';
    const y = VH - 34;
    const w = Math.max(ctx.measureText(g.toast.title).width, ctx.measureText(g.toast.sub || '').width) + 24;
    ctx.fillStyle = 'rgba(6,4,10,.82)';
    ctx.fillRect((VW - w) / 2, y - 14, w, g.toast.sub ? 34 : 22);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(g.toast.title, VW / 2, y);
    if (g.toast.sub){
      ctx.font = '500 9px ui-monospace, monospace';
      ctx.fillStyle = '#c8c2d4';
      wrapText(ctx, g.toast.sub, VW / 2, y + 13, w - 16);
    }
    ctx.restore();
  }
}

function wrapText(ctx, text, cx, y, maxW){
  const words = String(text).split(' ');
  let line = '', lines = [];
  for (const w of words){
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line){ lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, y + i * 10));
}
