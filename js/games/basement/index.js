/**
 * basement — the game object the site's router mounts.
 *
 * Owns the screen flow (title, pickers, the run itself, the summary) and the
 * fixed-step loop. Everything else lives in its own module.
 */
import { el } from '../../core/ui.js';
import * as S from '../../core/store.js';
import { unlock } from '../../core/audio.js';
import { VW, VH, ROOM_X, ROOM_Y, ROOM_W, ROOM_H } from './art.js';
import { crisp } from './sprite.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { Net, snapshot, floorSnapshot } from './net.js';
import { RemoteGame } from './remote.js';
import { makeMode, resolveSeed } from './modes.js';
import { CHARACTERS } from './characters.js';
import { COUNTS } from './items.js';
import { BOSSES } from './bosses.js';
import { sfx, setSilent } from './sfx.js';
import {
  titleScreen, characterScreen, modeScreen, coopScreen, netScreen,
  helpScreen, bestiaryScreen, pauseScreen, overScreen
} from './ui.js';

const SAVE = 'basement.prefs.v1';
const REC_KEY = 'basement';

/** Where the attract-mode bot walks to when it wants to leave by a given door. */
const DOOR_TARGET = {
  n: { x: ROOM_X + ROOM_W / 2, y: ROOM_Y + 6 },
  s: { x: ROOM_X + ROOM_W / 2, y: ROOM_Y + ROOM_H - 6 },
  w: { x: ROOM_X + 6, y: ROOM_Y + ROOM_H / 2 },
  e: { x: ROOM_X + ROOM_W - 6, y: ROOM_Y + ROOM_H / 2 }
};

function prefs(){
  try { return JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e){ return {}; }
}
function savePrefs(p){
  try { localStorage.setItem(SAVE, JSON.stringify(p)); } catch (e){}
}

const BASEMENT = {
  key: 'basement',
  name: 'basement',
  cat: 'secret',
  special: true,
  tileTag: 'secret',
  higherBetter: true,
  unit: 'floors',
  blurb: `A full run-based dungeon crawler. Procedural floors, ${COUNTS.items} items, ${BOSSES.length} bosses, co-op — the whole thing, in a tab.`,
  rule: 'Clear the room, take the door, go down. Arrow keys shoot.',

  mount(stage, api){
    const life = api.life;
    const p = prefs();
    let charId = p.char || 'wren';
    let modeId = p.mode || 'normal';
    let challengeId = p.challenge || 'bareHands';
    let locals = p.locals || 1;
    let seedText = '';

    /* ---- shell ---- */
    const canvas = el('canvas', { class:'bm-canvas', width:VW, height:VH });
    const overlay = el('div', { class:'bm-overlay' });
    const root = el('div', { class:'bm-root' }, canvas, overlay);
    stage.replaceChildren(root);

    const ctx = canvas.getContext('2d');
    crisp(ctx);
    ctx.fillStyle = '#07060c';
    ctx.fillRect(0, 0, VW, VH);

    const input = new Input(life, canvas);

    let game = null;
    let remote = null;
    let net = null;
    let screen = 'title';
    let running = false;
    let netStatus = '';
    let attract = null;

    /* ---- attract mode ------------------------------------------------
       The menus sit over the canvas, so leaving it as a dark rectangle wastes
       the only thing worth looking at. Instead a real run plays itself behind
       them, driven by a small bot on the same input contract as a person. */
    function attractBot(g){
      const p = g.players[0];
      const inp = { mx:0, my:0, ax:0, ay:0, active:false, bomb:false, card:false, map:false, drop:false };
      const e = g.nearestEnemy(p.x, p.y);
      if (e){
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
        inp.ax = dx / d; inp.ay = dy / d;
        // hold a middle distance and circle, so it looks played rather than driven
        const push = d < 74 ? -1 : d > 132 ? 1 : 0;
        inp.mx = (dx / d) * push + (-dy / d) * 0.55;
        inp.my = (dy / d) * push + (dx / d) * 0.55;
      } else {
        // room is clear — wander to a door and take it
        if (!g.botDoor || g.botDoorRoom !== g.room.key){
          const dirs = Object.entries(g.room.doors).filter(([, dr]) => dr.open && !dr.locked && (!dr.hidden || dr.revealed));
          g.botDoor = dirs.length ? dirs[(Math.random() * dirs.length) | 0][0] : null;
          g.botDoorRoom = g.room.key;
        }
        const pos = g.botDoor && DOOR_TARGET[g.botDoor];
        if (pos){
          const dx = pos.x - p.x, dy = pos.y - p.y, d = Math.hypot(dx, dy) || 1;
          inp.mx = dx / d; inp.my = dy / d;
        }
      }
      const m = Math.hypot(inp.mx, inp.my);
      if (m > 1){ inp.mx /= m; inp.my /= m; }
      return inp;
    }

    function startAttract(){
      const pick = CHARACTERS[(Math.random() * CHARACTERS.length) | 0];
      attract = new Game({
        canvas,
        input: { read: () => attractBot(attract), poll(){}, endFrame(){} },
        mode: makeMode('normal'),
        seed: (Math.random() * 0x7fffffff) >>> 0,
        chars: [pick.id],
        onEnd(){ attract = null; }        // a fresh demo starts on the next tick
      });
      // the demo should show off the game, not a naked starting character
      const p = attract.players[0];
      for (let i = 0; i < 3; i++) p.addItem(attract.rollItem('treasure'), { silent:true });
      p.recompute();
      attract.toast = null;
      const first = attract.floor.list.find(r => r.type === 'normal');
      if (first) attract.enterRoom(first, null);
      attract.banner = null;
    }

    /* ---- screens ---- */
    const show = (node) => {
      overlay.replaceChildren(node);
      overlay.hidden = false;
      root.classList.add('menu');
    };
    const hide = () => { overlay.replaceChildren(); overlay.hidden = true; root.classList.remove('menu'); };

    const bestRun = () => {
      const r = S.rec(REC_KEY);
      return r.plays ? { name: r.best >= 9 ? 'escaped' : 'floor ' + r.best, depth: r.best } : null;
    };

    function goTitle(){
      screen = 'title';
      stopRun();
      show(titleScreen({
        best: bestRun(),
        onPlay: () => startRun(),
        onCharacters: goChars,
        onModes: goModes,
        onCoop: goCoop,
        onHelp: () => { screen = 'help'; show(helpScreen({ onBack: goTitle })); },
        onBestiary: () => { screen = 'bestiary'; show(bestiaryScreen({ onBack: goTitle })); }
      }));
    }
    function goChars(){
      screen = 'chars';
      show(characterScreen({
        selected: charId,
        onPick: id => { charId = id; savePrefs({ ...prefs(), char:id }); },
        onBack: goTitle,
        onStart: () => startRun()
      }));
    }
    function goModes(){
      screen = 'modes';
      show(modeScreen({
        mode: modeId, challenge: challengeId,
        onPick: id => { modeId = id; savePrefs({ ...prefs(), mode:id }); },
        onPickChallenge: id => { challengeId = id; savePrefs({ ...prefs(), challenge:id }); },
        seed: seedText,
        onSeed: v => { seedText = v; },
        onBack: goTitle,
        onStart: () => startRun()
      }));
    }
    function goCoop(){
      screen = 'coop';
      show(coopScreen({
        locals,
        netState: netStatus,
        onLocals: n => { locals = n; savePrefs({ ...prefs(), locals:n }); },
        onBack: goTitle,
        onStart: () => startRun(),
        onHost: hostGame,
        onJoin: joinGame
      }));
    }

    /* ---- online ---- */
    async function hostGame(){
      screen = 'net';
      netStatus = 'making a code…';
      show(netScreen({ role:'host', code:'', status:netStatus, onCode: () => {}, onCancel: dropNet }));
      net = new Net({
        onOpen(){
          netStatus = 'connected — starting';
          net.send({ k:'go', chars:[charId, 'pip'], mode:modeId, challenge:challengeId });
          startRun({ online:'host' });
        },
        onClose(){ netStatus = 'disconnected'; if (screen === 'playing') goTitle(); }
      });
      try {
        const code = await net.host();
        show(netScreen({
          role:'host', code, status:'send that code, then paste their reply',
          onCode: async (reply) => {
            try { await net.accept(reply); netStatus = 'connecting…'; }
            catch (e){ show(netScreen({ role:'host', code, status:'that reply code did not parse', onCode: () => {}, onCancel: dropNet })); }
          },
          onCancel: dropNet
        }));
      } catch (e){
        show(netScreen({ role:'host', code:'', status:'could not start: ' + e.message, onCode: () => {}, onCancel: dropNet }));
      }
    }

    function joinGame(){
      screen = 'net';
      net = new Net({
        onOpen(){ netStatus = 'connected — waiting for the host'; },
        onClose(){ netStatus = 'disconnected'; if (screen === 'remote') goTitle(); },
        onMessage(msg){
          if (msg.k === 'go'){
            remote = new RemoteGame(msg.chars || [charId, 'pip']);
            screen = 'remote';
            hide();
            start();
          } else if (msg.k === 'f' && remote) remote.applyFloor(msg);
          else if (msg.k === 's' && remote) remote.apply(msg);
        }
      });
      show(netScreen({
        role:'guest', code:'', status:'',
        onCode: async (hostCode) => {
          try {
            const reply = await net.join(hostCode);
            show(netScreen({ role:'guest', code:reply, status:'send that reply back to the host', onCode: () => {}, onCancel: dropNet }));
          } catch (e){
            show(netScreen({ role:'guest', code:'', status:'that code did not parse', onCode: () => {}, onCancel: dropNet }));
          }
        },
        onCancel: dropNet
      }));
    }

    function dropNet(){
      try { net?.close(); } catch (e){}
      net = null; remote = null; netStatus = '';
      goTitle();
    }

    /* ---- the run ---- */
    function startRun(opts = {}){
      unlock();
      attract = null;
      const mode = makeMode(modeId, challengeId);
      if (mode.challenge?.char) charId = mode.challenge.char;
      const count = opts.online === 'host' ? 2 : locals;
      const chars = [charId];
      for (let i = 1; i < count; i++) chars.push(CHARACTERS[(i * 5) % CHARACTERS.length].id);

      const seed = resolveSeed(mode, seedText);
      game = new Game({
        canvas, input, mode, seed: seed.value, chars,
        net: opts.online === 'host' ? net : null,
        onEnd: finish
      });
      game.seedCode = seed.code;
      applyChallenge(game, mode);
      if (opts.online === 'host'){
        game.players[1].remote = true;
        game.players[1].netInput = { mx:0, my:0, ax:0, ay:0 };
        net.onMessage = msg => {
          if (msg.k !== 'i') return;
          const q = game.players[1];
          q.netInput = { mx:msg.x, my:msg.y, ax:msg.a, ay:msg.b,
            active:!!(msg.f & 1), bomb:!!(msg.f & 2), card:!!(msg.f & 4), drop:!!(msg.f & 8) };
        };
        net.send(floorSnapshot(game));
        game.lastFloorSent = game.depth;
      } else {
        for (let i = 1; i < count; i++) game.players[i].localSlot = i;
      }
      screen = 'playing';
      hide();
      start();
    }

    /** Challenge modifiers that need the live game rather than the floor gen. */
    function applyChallenge(g, mode){
      if (!mode.challenge) return;
      const m = mode;
      for (const p of g.players){
        if (m.startHp != null){ p.maxRed = m.startHp * 2; p.red = p.maxRed; }
        if (m.bonus) for (const [k, v] of Object.entries(m.bonus)) p.perm[k] = (p.perm[k] || 0) + v;
        if (m.flags) Object.assign(p.flags, m.flags);
        for (const id of m.items || []) p.addItem(id, { silent:true });
        if (m.noMoney) p.coins = 0;
        p.recompute();
      }
      if (m.forceCurse) g.floor.curse = { id:m.forceCurse, name:'Curse of the Dark', desc:'You can only see what is near you.' };
    }

    /** Ends the run but leaves the loop turning, so attract mode keeps playing. */
    function stopRun(){
      game = null;
      remote = null;
      start();
    }

    function finish(res){
      screen = 'over';
      running = false;
      const st = res.stats;
      S.submit(REC_KEY, st.depth, Math.min(1, st.depth / 9), true);
      show(overScreen({
        won: res.won, stats: st,
        onAgain: () => startRun(),
        onMenu: goTitle
      }));
    }

    /* ---- loop ---- */
    let last = 0, acc = 0, netAcc = 0;
    const STEP = 1 / 60;

    function start(){
      if (running) return;
      running = true;
      last = performance.now();
      life.frame(loop);
    }

    function loop(now){
      if (!running) return false;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;            // a backgrounded tab must not fast-forward the run

      input.poll();

      if (screen === 'remote' && remote){
        remote.tick(dt);
        const inp = input.read(0, { px:remote.players[1]?.x || 0, py:remote.players[1]?.y || 0, vw:VW, vh:VH });
        remote.mapHeld = !!inp.map;
        net?.sendInput(inp);
        remote.render(ctx);
        input.endFrame();
        return true;
      }

      // menus: keep a demo run alive behind the overlay
      if (screen !== 'playing' && screen !== 'remote'){
        if (!attract) startAttract();
        if (attract){
          let a = dt; let n = 0;
          while (a >= STEP && n < 3){ attract.update(STEP, n === 0); a -= STEP; n++; }
          attract.players[0].invuln = 3;      // the demo must never die mid-menu
          if (attract.depth > 2 || attract.stats.roomsCleared > 14) attract = null;
          else attract.render();
        }
        input.endFrame();
        return true;
      }

      if (game && screen === 'playing'){
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5){ game.update(STEP, steps === 0); acc -= STEP; steps++; }
        if (steps >= 5) acc = 0;
        game.render();

        if (net && net.open){
          netAcc += dt;
          if (game.depth !== game.lastFloorSent){ net.send(floorSnapshot(game)); game.lastFloorSent = game.depth; }
          if (netAcc >= 0.05){ netAcc = 0; net.send(snapshot(game)); }
        }
      }
      input.endFrame();
      return true;
    }

    /* ---- pause + teardown ---- */
    life.on(window, 'keydown', e => {
      if (e.key !== 'Escape') return;
      if (screen === 'playing'){
        e.stopPropagation(); e.preventDefault();
        screen = 'paused'; running = false;
        game.render();
        show(pauseScreen({
          players: game.players,
          onResume(){ screen = 'playing'; hide(); start(); },
          onQuit(){ goTitle(); }
        }));
      } else if (screen === 'paused'){
        e.stopPropagation(); e.preventDefault();
        screen = 'playing'; hide(); start();
      } else if (screen !== 'title'){
        e.stopPropagation(); e.preventDefault();
        goTitle();
      }
    }, true);

    // losing the window mid-fight should not cost you the run
    life.on(document, 'visibilitychange', () => {
      if (document.hidden && screen === 'playing'){
        screen = 'paused'; running = false;
        show(pauseScreen({
          players: game.players,
          onResume(){ screen = 'playing'; hide(); start(); },
          onQuit(){ goTitle(); }
        }));
      }
    });

    // Debug handle. The loop is driven by rAF inside a closure, so without this
    // there is no way to inspect a live run from the console.
    window.__basement = {
      get game(){ return game; },
      get screen(){ return screen; },
      get remote(){ return remote; },
      get attract(){ return attract; },
      start: (opts) => { charId = opts?.char || charId; modeId = opts?.mode || modeId; locals = opts?.locals || locals; startRun(); },
      step: (n = 60) => { for (let i = 0; i < n; i++) game.update(1 / 60); game.render(); },
      /** Run the real loop body by hand — rAF is throttled when the pane is hidden. */
      tick: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) loop(performance.now() + i * dt * 1000); },
      goTitle,
      /** Mute the game for automated checks. Never touches the saved volume. */
      silence: (v = true) => setSilent(v)
    };
    life.offs.push(() => { running = false; try { net?.close(); } catch (e){} delete window.__basement; });

    goTitle();
  }
};

export default [BASEMENT];
