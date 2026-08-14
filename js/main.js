import { el, Life, pick, fmt } from './core/ui.js';
import * as A from './core/audio.js';
import * as S from './core/store.js';
import { verdict } from './core/feedback.js';

import * as BG from './core/bg.js';

import PERCEPTION from './games/perception.js';
import REFLEX from './games/reflex.js';
import MEMORY from './games/memory.js';
import SOUND from './games/sound.js';
import MIND from './games/mind.js';
import { makeMeta } from './games/meta.js';

const BASE = [...PERCEPTION, ...REFLEX, ...MEMORY, ...SOUND, ...MIND];
const META = makeMeta(BASE);
const GAMES = [...BASE, ...META];
const BY_KEY = Object.fromEntries(GAMES.map(g => [g.key, g]));
const CATS = ['all', 'perception', 'reflex', 'memory', 'sound', 'mind'];

BG.mount();

const view = document.getElementById('view');
const crumb = document.getElementById('crumb');
const dock = document.getElementById('dock');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

let life = new Life();
let activeCat = localStorage.getItem('locked.cat') || 'all';

/* ------------------------------------------------------------------ */
/* result overlay                                                     */
/* ------------------------------------------------------------------ */
function showResult(game, stage, value, q, opts = {}){
  const { label = game.unit || '', breakdown = null, higherBetter = game.higherBetter !== false, raw = null, level = null } = opts;
  const key = recKey(game, level);
  const pb = S.submit(key, raw ?? value, q, higherBetter);
  const v = verdict(q, game.family || game.cat);

  if (q >= 0.97) A.sfx.perfect();
  else if (q >= 0.87) A.sfx.great();
  else if (q >= 0.45) A.sfx.good();
  else A.sfx.over();
  if (q >= 0.68) BG.pulse(q);

  const r = S.rec(key);
  const again = el('button', { class:'btn', text:'again' });
  const swap = game.levels ? el('button', { class:'btn ghost', text:'change difficulty' }) : null;
  const next = el('button', { class:'btn ghost', text:'next game' });
  const home = el('button', { class:'btn ghost', text:'all games' });

  const card = el('div', { class:'result' },
    el('div', { class:'verdict', text: v.verdict }),
    el('div', { class:'line', text: v.line }),
    el('div', { class:'score', html: `${label} <b>${value}</b>` }),
    breakdown ? el('div', { class:'breakdown' },
      breakdown.map(b => el('div', {}, b[0], el('b', { text: b[1] })))) : null,
    pb ? el('div', { class:'pb', text:'— personal best —' }) : null,
    r.best != null && !pb ? el('div', { class:'score', style:{ marginTop:'8px', opacity:.6 }, html:`best <b>${r.best}</b>` }) : null,
    el('div', { class:'row' }, again, swap, next, home)
  );
  stage.append(card);

  again.onclick = () => { A.sfx.click(); start(game, true); };
  if (swap) swap.onclick = () => { A.sfx.click(); start(game, false); };
  next.onclick = () => { A.sfx.click(); const o = GAMES.filter(g => g.key !== game.key); location.hash = '#/' + pick(o).key; };
  home.onclick = () => { A.sfx.click(); location.hash = '#/'; };

  life.on(window, 'keydown', e => {
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); again.click(); }
    if (e.key === 'Escape') home.click();
  });
}

/* ------------------------------------------------------------------ */
/* game screen                                                        */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* difficulty                                                         */
/* ------------------------------------------------------------------ */
const LEVEL_BLURB = {
  easy:   'Roomier, slower, more forgiving.',
  normal: 'The way it is meant to be played.',
  hard:   'Tighter margins and no mercy.'
};
const levelOf = g => localStorage.getItem('locked.lvl.' + g.key) || 'normal';
const setLevel = (g, l) => localStorage.setItem('locked.lvl.' + g.key, l);
/** Records are kept per difficulty — one shared best would be meaningless. */
const recKey = (g, l) => (g.levels && l && l !== 'normal') ? `${g.key}@${l}` : g.key;

function askLevel(game, stage, done){
  const cur = levelOf(game);
  stage.replaceChildren(
    el('div', { class:'hint', text:'how hard do you want it?' }),
    el('div', { class:'pill-row' }, game.levels.map(l => {
      const b = el('button', { class:'pill' + (l === cur ? ' on' : ''), text:l });
      b.onclick = () => { setLevel(game, l); A.sfx.click(); done(l); };
      return b;
    })),
    el('div', { class:'hint', style:{ opacity:.6 }, text: LEVEL_BLURB[cur] || '' }),
    el('div', { class:'hint', style:{ opacity:.5, fontSize:'12px' }, text:'Each difficulty keeps its own best score.' })
  );
  stage.querySelectorAll('.pill').forEach((b, i) => {
    b.onmouseenter = () => {
      A.sfx.hover();
      stage.querySelectorAll('.hint')[1].textContent = LEVEL_BLURB[game.levels[i]] || '';
    };
  });
}

function start(game, replay = false){
  life.kill();
  life = new Life();
  A.unlock();

  const stage = el('div', { class:'stage' });
  const head = el('div', { class:'ghead' },
    el('h2', { text: game.name }),
    el('p', { class:'rule', text: game.rule })
  );
  view.replaceChildren(el('div', { class:'wrap' }, el('div', { class:'game' }, head, stage)));
  crumb.innerHTML = `<b>${game.name}</b> · ${game.cat}`;
  document.title = `${game.name} · locked`;
  paintDock(game.key);
  BG.theme(game.cat);
  document.body.classList.add('playing');

  const launch = (level) => {
    const api = {
      life,
      sfx: A.sfx,
      audio: A,
      stage,
      level,
      finish(value, q, opts){ showResult(game, stage, value, q, { ...opts, level }); },
      setRule(t){ head.querySelector('.rule').textContent = t; }
    };
    if (level) crumb.innerHTML = `<b>${game.name}</b> · ${game.cat} · ${level}`;
    game.mount(stage, api);
  };

  // "again" reuses the chosen difficulty rather than re-asking every time
  if (game.levels && !replay) askLevel(game, stage, launch);
  else launch(game.levels ? levelOf(game) : null);
}

/* ------------------------------------------------------------------ */
/* home                                                               */
/* ------------------------------------------------------------------ */
function bestLine(g){
  const r = S.rec(recKey(g, g.levels ? levelOf(g) : null));
  if (!r.plays) return g.levels ? `not played · ${levelOf(g)}` : 'not played';
  return `best <b>${r.best}${g.unit ? ' ' + g.unit : ''}</b> · ${r.plays} ${r.plays === 1 ? 'run' : 'runs'}`;
}

function home(){
  life.kill(); life = new Life();
  crumb.textContent = '';
  document.title = 'locked · how good are you, really';
  BG.theme(activeCat === 'all' ? 'home' : activeCat);
  document.body.classList.remove('playing');

  const rating = S.rating();
  const grid = el('div', { class:'grid' });
  const cats = el('div', { class:'cats' },
    CATS.map(c => el('button', {
      class: 'cat' + (c === activeCat ? ' on' : ''),
      text: c === 'all' ? `all ${GAMES.length}` : c,
      onclick(){ activeCat = c; localStorage.setItem('locked.cat', c); A.sfx.click(); home(); }
    }))
  );

  let list = activeCat === 'all' ? GAMES : GAMES.filter(g => g.cat === activeCat);
  grid.append(...list.map(g => el('a', {
    class:'tile' + (g.special ? ' special' : ''), href:'#/' + g.key,
    onclick(){ A.sfx.click(); }, onmouseenter(){ A.sfx.hover(); }
  },
    el('div', { class:'tile-top' },
      el('div', { class:'tile-name', text:g.name }),
      el('div', { class:'tile-cat', text: g.special ? 'mode' : g.cat })),
    el('div', { class:'tile-blurb' }, el('span', { text:g.blurb })),
    el('div', { class:'tile-best', html: bestLine(g) })
  )));

  // Utility tiles close off the grid instead of leaving dead cells.
  if (activeCat === 'all'){
    const r = S.rating();
    const played = Object.values(S.all()).filter(x => x.plays > 0).length;
    const utils = [
      { name:'surprise me', cat:'shuffle', blurb:'Drops you straight into one of the ' + GAMES.length + ' at random. No deciding.',
        foot:'one click, no thinking', go(){ A.unlock(); A.sfx.start(); location.hash = '#/' + pick(GAMES).key; } },
      { name:'your record', cat:'stats', blurb:'Every best score you have set, plus one number for how dialed in you are overall.',
        foot: r != null ? `rating <b>${r}</b> · ${played}/${GAMES.length} played` : 'nothing played yet', go: stats },
      { name:'what is this', cat:'about', blurb:'Where the scores go, where the songs come from, and how to add a game of your own.',
        foot:'no accounts, no tracking', go: about }
    ];
    grid.append(...utils.map(u => el('a', {
      class:'tile util', href:'#', onclick(e){ e.preventDefault(); A.sfx.click(); u.go(); }, onmouseenter(){ A.sfx.hover(); }
    },
      el('div', { class:'tile-top' },
        el('div', { class:'tile-name', text:u.name }),
        el('div', { class:'tile-cat', text:u.cat })),
      el('div', { class:'tile-blurb' }, el('span', { text:u.blurb })),
      el('div', { class:'tile-best', html:u.foot })
    )));
    list = list.concat(utils);
  }

  // Pad the last row so a part-filled grid never shows a bare slab.
  // Measured off the grid itself — reading it a frame after mount gave a
  // stale column count and silently skipped the padding.
  let lastCols = 0;
  const padRow = () => {
    const cs = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    if (!cs) return;
    const short = (cs - (list.length % cs)) % cs;
    const have = grid.querySelectorAll('.filler').length;
    if (cs === lastCols && have === short) return;
    lastCols = cs;
    grid.querySelectorAll('.filler').forEach(n => n.remove());
    for (let i = 0; i < short; i++) grid.append(el('div', { class:'tile filler' }));
  };
  view.replaceChildren(el('div', { class:'wrap' },
    el('section', { class:'hero' },
      el('h1', { html:'locked&nbsp;in?' }),
      el('p', { text:`${BASE.length} very small games measuring your eyes, ears, hands and memory. Nothing to sign up for. Nothing leaves this browser.` }),
      el('div', { class:'cta' },
        el('button', { class:'btn', text:'play something random', onclick(){ A.unlock(); A.sfx.start(); location.hash = '#/' + pick(GAMES).key; } }),
        rating != null ? el('button', { class:'btn ghost', text:`your rating · ${rating}`, onclick: stats }) : null
      )
    ),
    cats,
    grid
  ));
  // must run once the grid is actually in the document — a detached element
  // has no computed grid-template-columns to measure
  padRow();
  const ro = new ResizeObserver(padRow);
  ro.observe(grid);
  life.offs.push(() => ro.disconnect());
  paintDock(null);
}

/* ------------------------------------------------------------------ */
/* dock + stats                                                       */
/* ------------------------------------------------------------------ */
function paintDock(activeKey){
  dock.replaceChildren(
    ...GAMES.map(g => el('a', {
      href:'#/' + g.key, text:g.name, class: g.key === activeKey ? 'on' : '',
      onmouseenter(){ A.sfx.hover(); }
    })),
    el('span', { class:'sep' }),
    el('span', { class:'note', text:'everything stays on this device' })
  );
}

function stats(){
  const rating = S.rating();
  const rows = GAMES.flatMap(g => (g.levels || [null]).map(l => {
    const r = S.rec(recKey(g, l));
    if (l && !r.plays) return null;          // only list difficulties actually played
    return el('div', { class:'stat-row' },
      el('span', { text: g.name + (l && l !== 'normal' ? ' · ' + l : '') }),
      el('span', { class:'m', text: r.plays ? `${r.plays} runs · ${Math.round((r.bestQ||0)*100)}/100` : '—' }),
      el('span', { class:'v', text: r.plays ? `${r.best}${g.unit ? ' ' + g.unit : ''}` : 'not played' })
    );
  })).filter(Boolean);
  modalBody.replaceChildren(
    el('h3', { text: rating != null ? `rating ${rating}` : 'no record yet' }),
    el('p', { class:'sub', text: rating != null
      ? 'The mean of your best runs, plus a nudge for playing a wide spread of games.'
      : 'Play anything and this fills up.' }),
    ...rows,
    el('div', { class:'row', style:{ marginTop:'26px', display:'flex', gap:'10px' } },
      el('button', { class:'btn ghost', text:'wipe my record', onclick(){
        if (confirm('Delete every score stored in this browser?')){ S.wipe(); A.sfx.bad(); closeModal(); if (!location.hash.slice(3)) home(); }
      }})
    )
  );
  modal.hidden = false;
  A.sfx.click();
}
function about(){
  const row = (k, v) => el('div', { class:'stat-row' }, el('span', { text:k }), el('span', { class:'m', text:v }));
  modalBody.replaceChildren(
    el('h3', { text:'what is this' }),
    el('p', { class:'sub', text:`${GAMES.length} very small games that measure something specific about you, and then tell you the truth about it.` }),
    row('accounts', 'none — there is nothing to sign into'),
    row('your scores', 'stored in this browser only, never sent anywhere'),
    row('other devices', 'separate scores — nothing syncs'),
    row('sound', 'synthesised live, no audio files'),
    row('songless · charts', 'official 30-second previews from Apple\'s public search API'),
    row('songless · melodies', '40 public-domain tunes, played offline'),
    row('daily & songless', 'seeded by the date — same for everyone, until midnight'),
    el('p', { class:'sub', style:{ marginTop:'22px' },
      text:'Built as a static site: no build step, no dependencies, no server. Adding a game means dropping one object into js/games and exporting it.' }),
    el('div', { style:{ display:'flex', gap:'10px', flexWrap:'wrap' } },
      el('a', { class:'btn', href:'https://github.com/jurre210/locked', target:'_blank', rel:'noopener', text:'source on github' }),
      el('button', { class:'btn ghost', text:'your record', onclick: stats })
    )
  );
  modal.hidden = false;
}

function closeModal(){ modal.hidden = true; }

document.getElementById('modal-x').onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal(); };
document.getElementById('btn-stats').onclick = stats;
document.getElementById('btn-random').onclick = () => { A.unlock(); location.hash = '#/' + pick(GAMES).key; };

const soundBtn = document.getElementById('btn-sound');
function paintSound(){ soundBtn.classList.toggle('off', !A.isOn()); soundBtn.textContent = 'sound'; }
soundBtn.onclick = () => { A.unlock(); const on = A.toggle(); paintSound(); if (on) A.sfx.good(); };
paintSound();

/* ------------------------------------------------------------------ */
/* router                                                             */
/* ------------------------------------------------------------------ */
function route(){
  closeModal();
  const key = location.hash.replace(/^#\/?/, '').trim();
  const g = BY_KEY[key];
  if (g) start(g); else home();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
  else if (e.key === 'Escape' && location.hash.length > 2 && !document.querySelector('.result')) location.hash = '#/';
});
window.addEventListener('pointerdown', () => A.unlock(), { once:true });
route();
