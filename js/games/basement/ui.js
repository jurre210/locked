/**
 * Menus. Plain DOM built with the site's `el` helper so the game's screens
 * inherit the rest of the site's look instead of inventing a second one.
 */
import { el } from '../../core/ui.js';
import { sfx } from './sfx.js';
import { CHARACTERS } from './characters.js';
import { MODES, CHALLENGES } from './modes.js';
import { buildCharacter } from './mobs-art.js';
import { itemIcon, PICKUP_ART } from './art.js';
import { COUNTS, ITEMS, TRINKETS, CARDS, PILL_EFFECTS } from './items.js';
import { ENEMIES } from './enemies.js';
import { BOSSES } from './bosses.js';
import { CONTROL_HELP } from './input.js';
import { FLOOR_ORDER } from './floor.js';

/** A baked sprite as an <canvas> element, for use inside the DOM menus. */
export function spriteEl(s, scale = 3, cls = ''){
  const c = document.createElement('canvas');
  c.width = s.w * scale; c.height = s.h * scale;
  c.className = 'bm-sprite ' + cls;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(s.c, 0, 0, c.width, c.height);
  return c;
}

/* A 5x7 pixel alphabet, just the letters the wordmark needs. Drawing the
   title in the same pixels as the game beats setting it in a web font. */
const GLYPHS = {
  B:['####.','#...#','#...#','####.','#...#','#...#','####.'],
  A:['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
  S:['.####','#....','#....','.###.','....#','....#','####.'],
  E:['#####','#....','#....','####.','#....','#....','#####'],
  M:['#...#','##.##','#.#.#','#...#','#...#','#...#','#...#'],
  N:['#...#','##..#','#.#.#','#..##','#...#','#...#','#...#'],
  T:['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
  ' ':['.....','.....','.....','.....','.....','.....','.....']
};

/** Render a word as chunky pixels, with a hard drop shadow. */
export function wordmark(text, scale = 6, fill = '#f2ede0', shadow = '#8a2f2f'){
  const letters = [...text.toUpperCase()].map(ch => GLYPHS[ch] || GLYPHS[' ']);
  const w = letters.length * 6 - 1, h = 7;
  const c = document.createElement('canvas');
  c.width = (w + 1) * scale; c.height = (h + 1) * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const paint = (col, ox, oy) => {
    g.fillStyle = col;
    letters.forEach((rows, li) => {
      rows.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          if (ch === '#') g.fillRect((li * 6 + x + ox) * scale, (y + oy) * scale, scale, scale);
        });
      });
    });
  };
  paint(shadow, 1, 1);
  paint(fill, 0, 0);
  c.className = 'bm-sprite bm-wordmark';
  return c;
}

const btn = (text, on, cls = '') => el('button', {
  class:'bm-btn ' + cls, text,
  onclick(){ sfx.pickup(); on(); },
  onmouseenter(){ sfx.step(); }
});

/* ------------------------------------------------------------------ */
export function titleScreen({ onPlay, onCharacters, onModes, onCoop, onHelp, onBestiary, best }){
  return el('div', { class:'bm-screen' },
    el('div', { class:'bm-title' },
      wordmark('BASEMENT'),
      el('p', { text:`A run-based dungeon crawler. ${COUNTS.items} items, ${Object.keys(ENEMIES).length} enemies, ${BOSSES.length} bosses, ${FLOOR_ORDER.length} floors. Nothing is saved anywhere but this browser.` })
    ),
    el('div', { class:'bm-menu' },
      btn('start a run', onPlay, 'primary'),
      btn('characters', onCharacters),
      btn('game modes', onModes),
      btn('multiplayer', onCoop),
      btn('what is in here', onBestiary),
      btn('controls', onHelp)
    ),
    best ? el('div', { class:'bm-foot', html:`furthest run · <b>${best.name}</b> · floor ${best.depth}` }) : null
  );
}

/* ------------------------------------------------------------------ */
export function characterScreen({ selected, onPick, onBack, onStart }){
  const grid = el('div', { class:'bm-grid' });
  const detail = el('div', { class:'bm-detail' });

  const paint = (c) => {
    const art = buildCharacter(c);
    const statLine = (k, v) => v ? el('div', { class:'bm-stat' }, el('span', { text:k }),
      el('b', { class: v > 0 ? 'up' : 'down', text: (v > 0 ? '+' : '') + v })) : null;
    detail.replaceChildren(
      el('div', { class:'bm-portrait' }, spriteEl(art.down[0], 5)),
      el('h3', { text:c.name }),
      el('p', { class:'bm-blurb', text:c.blurb }),
      el('div', { class:'bm-stats' },
        el('div', { class:'bm-stat' }, el('span', { text:'health' }),
          el('b', { text: c.hp ? `${c.hp} hearts` : c.black ? `${c.black / 2} black` : `${c.soul / 2} soul` })),
        statLine('damage', c.stats?.damage),
        statLine('fire rate', c.stats?.tears),
        statLine('speed', c.stats?.speed),
        statLine('range', c.stats?.range),
        statLine('luck', c.stats?.luck)
      ),
      (c.items || []).length || c.active || c.card ? el('div', { class:'bm-kit' },
        el('span', { class:'bm-kit-label', text:'starts with' }),
        el('span', { text: [...(c.items || []).map(i => i === 'random' ? 'a random item' : i),
          c.active ? 'an active item' : null, c.card ? 'a card' : null].filter(Boolean).join(', ') })
      ) : null,
      c.flags ? el('div', { class:'bm-tags' }, Object.keys(c.flags).map(f =>
        el('span', { class:'bm-tag', text: FLAG_WORDS[f] || f }))) : null
    );
  };

  CHARACTERS.forEach(c => {
    const art = buildCharacter(c);
    const tile = el('button', {
      class:'bm-char' + (c.id === selected ? ' on' : ''),
      onclick(){
        sfx.pickup();
        grid.querySelectorAll('.bm-char').forEach(n => n.classList.remove('on'));
        tile.classList.add('on');
        onPick(c.id); paint(c);
      },
      onmouseenter(){ sfx.step(); paint(c); }
    }, spriteEl(art.down[0], 3), el('span', { text:c.name }));
    grid.append(tile);
  });
  paint(CHARACTERS.find(c => c.id === selected) || CHARACTERS[0]);

  return el('div', { class:'bm-screen wide' },
    el('div', { class:'bm-head' }, el('h3', { text:'who are you' }), btn('back', onBack, 'small')),
    el('div', { class:'bm-split' }, grid, detail),
    el('div', { class:'bm-menu row' }, btn('start with them', onStart, 'primary'))
  );
}

/* ------------------------------------------------------------------ */
export function modeScreen({ mode, challenge, seed, onPick, onPickChallenge, onSeed, onBack, onStart }){
  const list = el('div', { class:'bm-list' });
  const chalWrap = el('div', { class:'bm-chal', hidden: mode !== 'challenge' });

  const paintChallenges = () => {
    chalWrap.replaceChildren(...CHALLENGES.map(c => el('button', {
      class:'bm-row' + (c.id === challenge ? ' on' : ''),
      onclick(){ sfx.pickup(); challenge = c.id; onPickChallenge(c.id); paintChallenges(); }
    }, el('b', { text:c.name }), el('span', { text:c.blurb }))));
  };
  paintChallenges();

  MODES.forEach(m => {
    const row = el('button', {
      class:'bm-row' + (m.id === mode ? ' on' : ''),
      onclick(){
        sfx.pickup(); mode = m.id; onPick(m.id);
        list.querySelectorAll('.bm-row').forEach(n => n.classList.remove('on'));
        row.classList.add('on');
        chalWrap.hidden = m.id !== 'challenge';
      }
    }, el('b', { text:m.name }), el('span', { text:m.blurb }));
    list.append(row);
  });

  const seedInput = el('input', {
    class:'bm-seed', type:'text', maxlength:'9', spellcheck:'false',
    placeholder:'random', value: seed || '',
    oninput(){ this.value = this.value.toUpperCase(); onSeed(this.value); }
  });

  return el('div', { class:'bm-screen' },
    el('div', { class:'bm-head' }, el('h3', { text:'how do you want it' }), btn('back', onBack, 'small')),
    list, chalWrap,
    el('div', { class:'bm-section' },
      el('h4', { text:'seed' }),
      el('p', { class:'bm-blurb', text:'Every run has an eight-character code that decides the whole floor plan, the items and the bosses. Leave it blank for a fresh one, or paste a code in to replay it exactly.' }),
      seedInput),
    el('div', { class:'bm-menu row' }, btn('start', onStart, 'primary'))
  );
}

/* ------------------------------------------------------------------ */
export function coopScreen({ locals, onLocals, onBack, onStart, onHost, onJoin, netState }){
  const counts = el('div', { class:'bm-pills' }, [1, 2, 3, 4].map(n => el('button', {
    class:'bm-pill' + (n === locals ? ' on' : ''), text: n === 1 ? 'solo' : n + ' players',
    onclick(){ sfx.pickup(); onLocals(n); counts.querySelectorAll('.bm-pill').forEach(b => b.classList.remove('on')); counts.children[n - 1].classList.add('on'); }
  })));

  return el('div', { class:'bm-screen' },
    el('div', { class:'bm-head' }, el('h3', { text:'multiplayer' }), btn('back', onBack, 'small')),
    el('div', { class:'bm-section' },
      el('h4', { text:'same screen' }),
      el('p', { class:'bm-blurb', text:'Player 1 is WASD plus the arrow keys. Player 2 is IJKL plus the numpad. Players 3 and 4 need controllers — plug one in and it takes the next free slot.' }),
      counts,
      el('div', { class:'bm-menu row' }, btn('start together', onStart, 'primary'))
    ),
    el('div', { class:'bm-section' },
      el('h4', { text:'over the internet' }),
      el('p', { class:'bm-blurb', text:'There is no server behind this site, so you introduce the two browsers yourself: one of you hosts and sends a code, the other pastes it and sends a code back. After that the connection is direct.' }),
      el('div', { class:'bm-menu row' }, btn('host a game', onHost), btn('join a game', onJoin)),
      netState ? el('div', { class:'bm-net', text:netState }) : null
    )
  );
}

/** The copy/paste handshake, step by step. */
export function netScreen({ role, code, onCode, onCancel, status, waiting }){
  const box = el('textarea', { class:'bm-code', readonly: !!code, rows:4,
    spellcheck:'false', placeholder: role === 'host' ? "paste your friend's reply code here" : 'paste the host code here' });
  if (code) box.value = code;

  const copy = btn('copy code', () => {
    box.select();
    navigator.clipboard?.writeText(code || box.value).catch(() => document.execCommand('copy'));
  });

  const steps = role === 'host'
    ? ['Send this code to the other player.', 'They paste it, and send you a reply code.', 'Paste their reply below and connect.']
    : ['Paste the code the host sent you.', 'Press generate, then send them the reply code.', 'Wait for them to paste it in.'];

  const input = el('textarea', { class:'bm-code', rows:4, spellcheck:'false',
    placeholder: role === 'host' ? 'their reply code' : 'the host code' });

  return el('div', { class:'bm-screen' },
    el('div', { class:'bm-head' }, el('h3', { text: role === 'host' ? 'hosting' : 'joining' }), btn('cancel', onCancel, 'small')),
    el('ol', { class:'bm-steps' }, steps.map(s => el('li', { text:s }))),
    code ? el('div', {}, el('div', { class:'bm-label', text: role === 'host' ? 'your code' : 'your reply code' }), box, copy) : null,
    el('div', { class:'bm-label', text: role === 'host' ? "their reply" : 'host code' }),
    input,
    el('div', { class:'bm-menu row' }, btn(role === 'host' ? 'connect' : 'generate reply', () => onCode(input.value))),
    el('div', { class:'bm-net', text: status || (waiting ? 'waiting…' : '') })
  );
}

/* ------------------------------------------------------------------ */
export function helpScreen({ onBack }){
  return el('div', { class:'bm-screen' },
    el('div', { class:'bm-head' }, el('h3', { text:'controls' }), btn('back', onBack, 'small')),
    el('div', { class:'bm-table' }, CONTROL_HELP.map(([k, v]) =>
      el('div', { class:'bm-trow' }, el('span', { text:k }), el('b', { text:v })))),
    el('p', { class:'bm-blurb', text:'Clear a room and its doors open. Bombs break rocks — and walls, if there is something behind them. Every floor has one boss and a way down.' })
  );
}

export function bestiaryScreen({ onBack }){
  const section = (title, kids) => el('div', { class:'bm-section' }, el('h4', { text:title }), kids);
  const itemRow = it => el('div', { class:'bm-item' },
    spriteEl(itemIcon(it), 2),
    el('div', {}, el('b', { text:it.name }), el('span', { text:it.desc })));

  return el('div', { class:'bm-screen wide scroll' },
    el('div', { class:'bm-head' }, el('h3', { text:'what is in here' }), btn('back', onBack, 'small')),
    el('div', { class:'bm-counts' },
      [[COUNTS.items, 'items'], [COUNTS.trinkets, 'trinkets'], [COUNTS.cards, 'cards'],
       [COUNTS.pills, 'pill effects'], [Object.keys(ENEMIES).length, 'enemies'],
       [BOSSES.length, 'bosses'], [FLOOR_ORDER.length, 'floors'], [CHARACTERS.length, 'characters']
      ].map(([n, l]) => el('div', { class:'bm-count' }, el('b', { text:String(n) }), el('span', { text:l })))),
    section('floors', el('div', { class:'bm-tags' },
      FLOOR_ORDER.map(f => el('span', { class:'bm-tag', text:f })))),
    section('bosses', el('div', { class:'bm-tags' },
      BOSSES.map(b => el('span', { class:'bm-tag', text:b.name.toLowerCase() })))),
    section('items', el('div', { class:'bm-items' }, ITEMS.map(itemRow)))
  );
}

/* ------------------------------------------------------------------ */
export function pauseScreen({ onResume, onQuit, players }){
  return el('div', { class:'bm-screen pause' },
    el('h3', { text:'paused' }),
    el('div', { class:'bm-owned' }, players.flatMap(p => p.items).map(it =>
      el('div', { class:'bm-own', title: it.name + ' — ' + it.desc }, spriteEl(itemIcon(it), 2)))),
    el('div', { class:'bm-menu row' }, btn('back to it', onResume, 'primary'), btn('give up', onQuit))
  );
}

export function overScreen({ won, stats, onAgain, onMenu }){
  return el('div', { class:'bm-screen' },
    el('h3', { text: won ? 'you made it out' : 'you died' }),
    el('div', { class:'bm-table' },
      [['floor reached', stats.depth], ['kills', stats.kills], ['rooms cleared', stats.roomsCleared],
       ['items taken', stats.itemsTaken], ['time', fmtTime(stats.seconds)], ['seed', stats.seed]
      ].map(([k, v]) => el('div', { class:'bm-trow' }, el('span', { text:k }), el('b', { text:String(v) })))),
    stats.items?.length ? el('div', { class:'bm-blurb', text:'you had: ' + stats.items.join(', ') }) : null,
    el('div', { class:'bm-menu row' }, btn('again', onAgain, 'primary'), btn('menu', onMenu))
  );
}

const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const FLAG_WORDS = {
  noRed:'no red hearts', spectral:'shots pass through rock', fly:'flies over pits',
  thorns:'hurts on contact', scaling:'grows with every item', fastCharge:'charges faster',
  glass:'takes and deals double'
};
