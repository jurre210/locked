import { el, clamp, irnd, pick, shuffle, sample, countdown, cellSize } from '../core/ui.js';

const curve = (v, worst, best) => clamp((v - worst) / (best - worst), 0, 1);

/* =================================================================== */
/* sequence — simon, with tones                                        */
/* =================================================================== */
const sequence = {
  key:'sequence', name:'sequence', cat:'memory', family:'memory',
  blurb:'Four pads, one growing pattern. How far can you hold it?',
  rule:'Watch the pattern, then repeat it. It grows by one every round. One mistake ends it.',
  unit:'len', higherBetter:true,
  mount(stage, api){
    const FREQ = [329.63, 415.30, 493.88, 659.25];
    const seq = []; let idx = 0, accepting = false;
    const cells = [];
    const pad = el('div', { class:'pad', style:{ gridTemplateColumns:'repeat(2,minmax(0,1fr))', width:'min(360px,74vw)' } });
    for (let i = 0; i < 4; i++){
      const c = el('button', { class:'cell', style:{ aspectRatio:'1', height:'auto' } });
      c.onclick = () => tap(i);
      cells.push(c); pad.append(c);
    }
    const hud = el('div', { class:'hud' });
    const hint = el('div', { class:'hint', text:'watch' });
    const paint = () => hud.replaceChildren(el('span', {}, 'length ', el('b', { text:String(seq.length) })));

    const light = (i, ms = 300) => {
      cells[i].classList.add('lit');
      api.audio.tone({ freq:FREQ[i], type:'triangle', dur:ms/1000, gain:.14, release:.2 });
      api.life.after(() => cells[i].classList.remove('lit'), ms);
    };

    const show = () => {
      accepting = false; idx = 0; hint.textContent = 'watch';
      seq.push(irnd(0,3)); paint();
      const gap = clamp(560 - seq.length * 22, 240, 560);
      seq.forEach((v, k) => api.life.after(() => light(v, gap * .6), 420 + k * gap));
      api.life.after(() => { accepting = true; hint.textContent = 'your turn'; }, 460 + seq.length * gap);
    };

    const tap = (i) => {
      if (!accepting) return;
      light(i, 180);
      if (seq[idx] === i){
        idx++;
        if (idx >= seq.length){ accepting = false; api.life.after(show, 700); }
      } else {
        accepting = false;
        api.sfx.bad(); pad.classList.add('shake');
        api.life.after(() => api.finish(seq.length - 1, curve(seq.length - 1, 3, 16), { label:'sequence length',
          breakdown:[['you failed at', String(seq.length)]] }), 700);
      }
    };

    api.life.on(window, 'keydown', e => {
      const k = ['1','2','3','4'].indexOf(e.key);
      if (k >= 0) tap(k);
    });
    stage.replaceChildren(hud, pad, hint, el('div', { class:'hint', html:'keys <span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span><span class="kbd">4</span> work too' }));
    api.life.after(show, 700);
  }
};

/* =================================================================== */
/* chimp — numbered squares                                            */
/* =================================================================== */
const chimp = {
  key:'chimp', name:'chimp', cat:'memory', family:'memory',
  blurb:'Numbers appear, then hide. Click them in order. Chimps beat you at this.',
  rule:'Memorise where the numbers are. They vanish when you click the first one. Two mistakes and it ends.',
  unit:'n', higherBetter:true,
  mount(stage, api){
    let n = 4, lives = 2;
    // 8 columns of 30px is unplayable with a thumb — go taller and narrower
    const narrow = window.innerWidth < 620;
    const COLS = narrow ? 5 : 8, ROWS = narrow ? 7 : 5;
    const round = () => {
      const spots = sample(Array.from({length:COLS*ROWS}, (_,i)=>i), n);
      let next = 1, hidden = false;
      const px = cellSize(COLS, { maxPx:88, minPx:40, vFrac: narrow ? .50 : .34 });
      const grid = el('div', { class:'pad', style:{ gridTemplateColumns:`repeat(${COLS},${px}px)` } });
      const nodes = [];
      for (let i = 0; i < COLS*ROWS; i++){
        const k = spots.indexOf(i);
        const c = el('div', { style:{ width:px+'px', height:px+'px' } });
        if (k >= 0){
          const b = el('button', { class:'cell', style:{ width:'100%', height:'100%', fontSize:Math.round(px*.42)+'px', fontFamily:'var(--mono)' }, text:String(k+1) });
          b.onclick = () => {
            if (k + 1 === next){
              api.sfx.step(next);
              if (!hidden){ hidden = true; nodes.forEach(x => { x.textContent = ''; x.style.background = '#fff'; x.style.borderColor = '#fff'; }); }
              b.style.visibility = 'hidden';
              next++;
              if (next > n){ n++; api.sfx.good(); api.life.after(round, 350); }
            } else {
              lives--; api.sfx.bad(); grid.classList.add('shake');
              api.life.after(() => grid.classList.remove('shake'), 340);
              if (lives < 0) end();
              else api.life.after(round, 500);
            }
          };
          nodes.push(b); c.append(b);
        }
        grid.append(c);
      }
      stage.replaceChildren(
        el('div', { class:'hud' },
          el('span', {}, 'numbers ', el('b', { text:String(n) })),
          el('span', {}, 'strikes left ', el('b', { text:String(Math.max(0,lives)) }))),
        grid,
        el('div', { class:'hint', text:'click 1 first — everything hides the moment you do' })
      );
    };
    const end = () => api.finish(n - 1, curve(n - 1, 4, 16), { label:'numbers held' });
    round();
  }
};

/* =================================================================== */
/* digits — digit span                                                 */
/* =================================================================== */
const digits = {
  key:'digits', name:'digits', cat:'memory', family:'memory',
  blurb:'A number flashes. Type it back. It gets one digit longer every time.',
  rule:'The number is shown briefly, then you type it. One wrong answer ends the run.',
  unit:'digits', higherBetter:true,
  mount(stage, api){
    let len = 3;
    const round = () => {
      let s = '';
      for (let i = 0; i < len; i++) s += irnd(i === 0 ? 1 : 0, 9);
      const show = el('div', { class:'big', style:{ fontFamily:'var(--mono)', letterSpacing:'.02em' }, text:s });
      stage.replaceChildren(
        el('div', { class:'hud' }, 'length ', el('b', { text:String(len) })),
        show, el('div', { class:'hint', text:'hold it' })
      );
      api.sfx.step(len % 8);
      api.life.after(() => ask(s), 900 + len * 260);
    };
    const ask = (s) => {
      const inp = el('input', { class:'field', type:'text', inputmode:'numeric', autocomplete:'off', placeholder:'…' });
      const go = el('button', { class:'btn', text:'submit' });
      const submit = () => {
        const v = inp.value.replace(/\D/g,'');
        if (!v) return;
        if (v === s){ api.sfx.good(); len++; api.life.after(round, 380); }
        else {
          api.sfx.bad();
          stage.replaceChildren(el('div', { class:'big', style:{ fontFamily:'var(--mono)' }, text:s }),
            el('div', { class:'hint', text:`you typed ${v}` }));
          api.life.after(() => api.finish(len - 1, curve(len - 1, 4, 13), { label:'digit span',
            breakdown:[['failed at', String(len)]] }), 900);
        }
      };
      go.onclick = submit;
      stage.replaceChildren(el('div', { class:'hud' }, 'length ', el('b', { text:String(len) })), inp, go);
      inp.focus();
      api.life.on(inp, 'keydown', e => { if (e.key === 'Enter') submit(); });
    };
    round();
  }
};

/* =================================================================== */
/* pattern — corsi blocks                                              */
/* =================================================================== */
const pattern = {
  key:'pattern', name:'pattern', cat:'memory', family:'memory',
  blurb:'Tiles light up across a grid. Light them up again, same order.',
  rule:'Watch which tiles flash and in what order, then click them back. It grows every round.',
  unit:'len', higherBetter:true,
  mount(stage, api){
    const SIZE = 5;
    let len = 3, accepting = false, seq = [], idx = 0;
    const px = cellSize(SIZE, { maxPx:96, minPx:40, vFrac:.44 });
    const cells = [];
    const grid = el('div', { class:'pad', style:{ gridTemplateColumns:`repeat(${SIZE},${px}px)` } });
    for (let i = 0; i < SIZE*SIZE; i++){
      const c = el('button', { class:'cell', style:{ width:px+'px', height:px+'px' } });
      c.onclick = () => tap(i);
      cells.push(c); grid.append(c);
    }
    const hud = el('div', { class:'hud' });
    const hint = el('div', { class:'hint', text:'watch' });

    const round = () => {
      accepting = false; idx = 0; hint.textContent = 'watch';
      seq = sample(Array.from({length:SIZE*SIZE},(_,i)=>i), len);
      hud.replaceChildren(el('span', {}, 'length ', el('b', { text:String(len) })));
      seq.forEach((v, k) => api.life.after(() => {
        cells[v].classList.add('lit');
        api.audio.tone({ freq: 300 + (v % 7) * 60, type:'sine', dur:.1, gain:.11, release:.14 });
        api.life.after(() => cells[v].classList.remove('lit'), 300);
      }, 400 + k * 480));
      api.life.after(() => { accepting = true; hint.textContent = 'now you'; }, 500 + len * 480);
    };
    const tap = (i) => {
      if (!accepting) return;
      if (seq[idx] === i){
        cells[i].classList.add('ok'); api.sfx.step(idx);
        idx++;
        if (idx >= seq.length){
          accepting = false; api.sfx.good();
          api.life.after(() => { cells.forEach(c => c.classList.remove('ok','no')); len++; round(); }, 520);
        }
      } else {
        accepting = false; cells[i].classList.add('no'); api.sfx.bad(); grid.classList.add('shake');
        api.life.after(() => api.finish(len - 1, curve(len - 1, 3, 12), { label:'pattern length' }), 800);
      }
    };
    stage.replaceChildren(hud, grid, hint);
    api.life.after(round, 500);
  }
};

/* =================================================================== */
/* pairs — matching, against the clock                                 */
/* =================================================================== */
const pairs = {
  key:'pairs', name:'pairs', cat:'memory', family:'memory',
  blurb:'Eighteen cards, nine pairs. Clear them in as few flips as you can.',
  rule:'Flip two cards at a time and clear all nine pairs. Flips and time both count.',
  unit:'flips', higherBetter:false,
  mount(stage, api){
    const ICONS = ['◆','●','■','▲','★','✚','⬢','◐','⬟'];
    const deck = shuffle([...ICONS, ...ICONS]);
    let open = [], flips = 0, cleared = 0, busy = false, t0 = 0;
    const cols = 6;
    const px = cellSize(cols, { maxPx:104, minPx:40, vFrac:.34 });
    const grid = el('div', { class:'pad', style:{ gridTemplateColumns:`repeat(${cols},${px}px)` } });
    const hud = el('div', { class:'hud' });
    const paint = () => hud.replaceChildren(
      el('span', {}, 'flips ', el('b', { text:String(flips) })),
      el('span', {}, 'pairs ', el('b', { text:`${cleared}/9` })),
      el('span', {}, 'time ', el('b', { text: t0 ? ((performance.now()-t0)/1000).toFixed(0)+'s' : '0s' }))
    );

    deck.forEach((sym, i) => {
      const c = el('button', { class:'cell', style:{ width:px+'px', height:Math.round(px*1.3)+'px', fontSize:Math.round(px*.42)+'px' } });
      c.dataset.sym = sym; c.dataset.state = 'down';
      c.onclick = () => {
        if (busy || c.dataset.state !== 'down') return;
        if (!t0) t0 = performance.now();
        c.dataset.state = 'up'; c.textContent = sym; c.classList.add('lit');
        api.sfx.click(); open.push(c); flips++; paint();
        if (open.length === 2){
          busy = true;
          const [a, b] = open;
          if (a.dataset.sym === b.dataset.sym){
            api.life.after(() => {
              [a,b].forEach(x => { x.dataset.state='out'; x.classList.remove('lit'); x.classList.add('ok'); x.style.opacity=.25; });
              open = []; busy = false; cleared++; api.sfx.good(); paint();
              if (cleared === 9) end();
            }, 260);
          } else {
            api.life.after(() => {
              [a,b].forEach(x => { x.dataset.state='down'; x.textContent=''; x.classList.remove('lit'); });
              open = []; busy = false; api.sfx.miss();
            }, 620);
          }
        }
      };
      grid.append(c);
    });
    const end = () => {
      const secs = (performance.now() - t0)/1000;
      api.finish(flips, curve(flips, 52, 20), { label:'total flips', higherBetter:false,
        breakdown:[['time', secs.toFixed(1)+'s'], ['perfect would be', '18']] });
    };
    stage.replaceChildren(hud, grid, el('div', { class:'hint', text:'nine pairs. eighteen flips is a perfect game.' }));
    paint();
    api.life.frame(() => { if (cleared < 9) paint(); else return false; });
  }
};

export default [sequence, pattern, chimp, digits, pairs];
