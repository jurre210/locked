import { el, clamp, rnd, irnd, pick, shuffle, sample, countdown } from '../core/ui.js';

const curve = (v, worst, best) => clamp((v - worst) / (best - worst), 0, 1);

/* =================================================================== */
/* stroop                                                              */
/* =================================================================== */
const stroop = {
  key:'stroop', name:'stroop', cat:'mind', family:'mind',
  blurb:'The word says one colour. The ink says another. Answer the ink.',
  rule:'Pick the colour the word is printed in, not the word itself. Forty-five seconds.',
  unit:'net', higherBetter:true,
  mount(stage, api){
    const COLS = [['red','#ff4d4d'],['green','#4dff88'],['blue','#5aa9ff'],['yellow','#ffd24d'],['purple','#c98bff'],['orange','#ff9b4d']];
    const DUR = 45000;
    let hits = 0, misses = 0, t0 = 0, ink = null;
    const word = el('div', { class:'big' });
    const hud = el('div', { class:'hud' });
    const row = el('div', { class:'pill-row' });

    const paint = () => hud.replaceChildren(
      el('span', {}, 'correct ', el('b', { text:String(hits) })),
      el('span', {}, 'wrong ', el('b', { text:String(misses) })),
      el('span', {}, 'time ', el('b', { text: Math.max(0, (DUR - (performance.now()-t0))/1000).toFixed(1) }))
    );

    const next = () => {
      const w = pick(COLS);
      do { ink = pick(COLS); } while (ink[0] === w[0] && Math.random() < .8);
      word.textContent = w[0];
      word.style.color = ink[1];
      const opts = shuffle(sample(COLS.filter(c => c !== ink), 3).concat([ink]));
      row.replaceChildren(...opts.map(c => {
        const b = el('button', { class:'pill', text:c[0] });
        b.onclick = () => {
          if (c === ink){ hits++; api.sfx.click(); }
          else { misses++; api.sfx.miss(); b.classList.add('no'); }
          paint(); next();
        };
        return b;
      }));
    };

    const begin = () => {
      stage.replaceChildren(hud, word, row, el('div', { class:'hint', text:'the ink, not the word' }));
      t0 = performance.now(); next(); paint();
      api.life.frame(() => { paint(); if (performance.now() - t0 >= DUR){ end(); return false; } });
    };
    const end = () => {
      const net = hits - misses;
      api.finish(net, curve(net, 12, 70), { label:'net correct',
        breakdown:[['correct', String(hits)], ['wrong', String(misses)],
                   ['accuracy', Math.round(hits/Math.max(1,hits+misses)*100)+'%']] });
    };
    countdown(stage, api.life, api.sfx, begin);
  }
};

/* =================================================================== */
/* typing                                                              */
/* =================================================================== */
const WORDS = ('the of and to in a is that it for you was with on as be at by this have from or one had not but what all were when we there can an your which their said if do will each about how up out them then she many some so these would other into has more her two like him see time could no make than first been its who now people my over know water only little work very after called just where most'.split(' '));

const typing = {
  key:'typing', name:'typing', cat:'mind', family:'mind',
  blurb:'Thirty seconds. Type what you see. Mistakes count against you.',
  rule:'Type the words exactly. Space moves you on. Thirty seconds on the clock.',
  unit:'wpm', higherBetter:true,
  mount(stage, api){
    const DUR = 30000;
    let queue = Array.from({length:220}, () => pick(WORDS));
    let idx = 0, chars = 0, errs = 0, t0 = 0;
    const line = el('div', { style:{ fontSize:'clamp(18px,2.6vw,26px)', maxWidth:'min(820px,92vw)', textAlign:'center', lineHeight:'1.9', color:'var(--dimmer)' } });
    const inp = el('input', { class:'field', autocomplete:'off', autocorrect:'off', spellcheck:'false', placeholder:'start typing' });
    const hud = el('div', { class:'hud' });

    const paintLine = () => {
      line.replaceChildren(...queue.slice(idx, idx + 14).map((w, i) =>
        el('span', { style:{ margin:'0 8px', color: i === 0 ? '#fff' : 'var(--dimmer)', borderBottom: i === 0 ? '2px solid #fff' : 'none' }, text:w })));
    };
    const paint = () => {
      const el2 = performance.now() - t0;
      const wpm = el2 > 300 ? (chars / 5) / (el2 / 60000) : 0;
      hud.replaceChildren(
        el('span', {}, 'wpm ', el('b', { text: Math.round(wpm) })),
        el('span', {}, 'errors ', el('b', { text:String(errs) })),
        el('span', {}, 'time ', el('b', { text: Math.max(0,(DUR - el2)/1000).toFixed(1) }))
      );
    };

    const begin = () => {
      stage.replaceChildren(hud, line, inp, el('div', { class:'hint', text:'space to submit a word' }));
      paintLine(); inp.focus();
      t0 = performance.now();
      api.life.on(inp, 'keydown', e => {
        if (e.key === ' '){
          e.preventDefault();
          const typed = inp.value.trim();
          if (!typed) return;
          if (typed === queue[idx]){ chars += typed.length + 1; api.sfx.tick(); }
          else { errs++; api.sfx.miss(); }
          idx++; inp.value = ''; paintLine();
        }
      });
      api.life.on(stage, 'pointerdown', () => inp.focus());
      api.life.frame(() => { paint(); if (performance.now() - t0 >= DUR){ end(); return false; } });
    };
    const end = () => {
      inp.disabled = true;
      const wpm = (chars / 5) / (DUR / 60000);
      const acc = idx ? (idx - errs) / idx : 0;
      const net = wpm * acc;
      api.finish(Math.round(wpm), curve(net, 22, 105), { label:'words per minute', raw: Math.round(wpm),
        breakdown:[['accuracy', Math.round(acc*100)+'%'], ['words', String(idx)], ['errors', String(errs)]] });
    };
    countdown(stage, api.life, api.sfx, begin);
  }
};

/* =================================================================== */
/* maths                                                               */
/* =================================================================== */
const maths = {
  key:'maths', name:'maths', cat:'mind', family:'mind',
  blurb:'Sixty seconds of mental arithmetic that gets meaner as you go.',
  rule:'Answer as many as you can in sixty seconds. Correct answers make the next one harder.',
  unit:'solved', higherBetter:true,
  mount(stage, api){
    const DUR = 60000;
    let solved = 0, wrong = 0, level = 1, t0 = 0, answer = 0;
    const q = el('div', { class:'big' });
    const inp = el('input', { class:'field', inputmode:'numeric', autocomplete:'off', placeholder:'=' });
    const hud = el('div', { class:'hud' });
    const paint = () => hud.replaceChildren(
      el('span', {}, 'solved ', el('b', { text:String(solved) })),
      el('span', {}, 'wrong ', el('b', { text:String(wrong) })),
      el('span', {}, 'time ', el('b', { text: Math.max(0,(DUR-(performance.now()-t0))/1000).toFixed(1) }))
    );

    const make = () => {
      const L = Math.min(level, 9);
      const kind = L < 3 ? pick(['+','-']) : L < 5 ? pick(['+','-','×']) : pick(['+','-','×','×','÷']);
      let a, b;
      if (kind === '+' || kind === '-'){
        a = irnd(5 * L, 14 * L + 8); b = irnd(3 * L, 10 * L + 5);
        if (kind === '-' && b > a) [a, b] = [b, a];
        answer = kind === '+' ? a + b : a - b;
      } else if (kind === '×'){
        a = irnd(2, 3 + L * 2); b = irnd(3, 5 + L * 2);
        answer = a * b;
      } else {
        b = irnd(2, 4 + L); answer = irnd(2, 5 + L); a = b * answer;
      }
      q.textContent = `${a} ${kind} ${b}`;
    };

    const begin = () => {
      stage.replaceChildren(hud, q, inp, el('div', { class:'hint', text:'enter to submit' }));
      t0 = performance.now(); make(); paint(); inp.focus();
      api.life.on(inp, 'keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const v = parseInt(inp.value, 10);
        if (!Number.isFinite(v)) return;
        if (v === answer){ solved++; level += .5; api.sfx.click(); q.classList.add('flash'); }
        else { wrong++; level = Math.max(1, level - .5); api.sfx.miss(); q.classList.add('shake'); }
        api.life.after(() => q.classList.remove('flash','shake'), 320);
        inp.value = ''; make(); paint();
      });
      api.life.on(stage, 'pointerdown', () => inp.focus());
      api.life.frame(() => { paint(); if (performance.now() - t0 >= DUR){ end(); return false; } });
    };
    const end = () => {
      inp.disabled = true;
      api.finish(solved, curve(solved - wrong * .5, 6, 42), { label:'sums solved',
        breakdown:[['wrong', String(wrong)], ['hardest level', Math.floor(level)+'']] });
    };
    countdown(stage, api.life, api.sfx, begin);
  }
};

/* =================================================================== */
/* n-back                                                              */
/* =================================================================== */
const nback = {
  key:'nback', name:'n-back', cat:'mind', family:'memory',
  blurb:'Letters go past. Say when one matches the one from two steps ago.',
  rule:'A letter appears every two seconds. Hit space whenever it is the same as the letter two before it. Thirty letters.',
  unit:'%', higherBetter:true,
  mount(stage, api){
    const N = 2, TOTAL = 30, GAP = 2000;
    const LETTERS = 'BCDFGHKLMNPQRSTVZ'.split('');
    const seq = [];
    for (let i = 0; i < TOTAL; i++){
      if (i >= N && Math.random() < .3) seq.push(seq[i - N]);
      else {
        let c; do { c = pick(LETTERS); } while (i >= N && c === seq[i - N] );
        seq.push(c);
      }
    }
    let i = -1, answered = false, hits = 0, fa = 0, misses = 0;
    const big = el('div', { class:'big' });
    const hud = el('div', { class:'hud' });
    const feed = el('div', { class:'hint', text:'—' });
    const paint = () => hud.replaceChildren(
      el('span', {}, 'letter ', el('b', { text:`${Math.max(0,i+1)}/${TOTAL}` })),
      el('span', {}, 'hits ', el('b', { text:String(hits) })),
      el('span', {}, 'false ', el('b', { text:String(fa) }))
    );

    const step = () => {
      if (i >= 0 && !answered && i >= N && seq[i] === seq[i-N]){ misses++; feed.textContent = 'missed one'; }
      i++;
      if (i >= TOTAL) return end();
      answered = false;
      big.textContent = seq[i];
      big.classList.add('flash');
      api.life.after(() => big.classList.remove('flash'), 200);
      api.audio.tone({ freq: 420, type:'sine', dur:.04, gain:.05, release:.06 });
      paint();
    };
    const hit = () => {
      if (answered || i < 0) return;
      answered = true;
      if (i >= N && seq[i] === seq[i-N]){ hits++; api.sfx.good(); feed.textContent = 'yes'; }
      else { fa++; api.sfx.bad(); feed.textContent = 'no'; }
      paint();
    };
    const end = () => {
      const targets = seq.filter((c, k) => k >= N && c === seq[k-N]).length;
      const acc = clamp((hits - fa * .8) / Math.max(1, targets), 0, 1) * 100;
      api.finish(Math.round(acc), curve(acc, 30, 96), { label:'accuracy %',
        breakdown:[['matches', `${hits}/${targets}`], ['false alarms', String(fa)], ['missed', String(misses)]] });
    };

    api.life.on(window, 'keydown', e => { if (e.code === 'Space'){ e.preventDefault(); hit(); } });
    const zone = el('div', { class:'zone', style:{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'10px', cursor:'pointer', minHeight:'min(240px,34vh)' } }, big, feed);
    api.life.on(zone, 'pointerdown', hit);
    stage.replaceChildren(hud, zone, el('div', { class:'hint', html:'<span class="kbd">space</span> when it matches two back' }));
    countdown(stage, api.life, api.sfx, () => { stage.replaceChildren(hud, zone, el('div', { class:'hint', html:'<span class="kbd">space</span> when it matches two back' })); step(); api.life.every(step, GAP); });
  }
};

/* =================================================================== */
/* line — put the number where it belongs                              */
/* =================================================================== */
const numberline = {
  key:'line', name:'number line', cat:'mind', family:'mind',
  blurb:'A bare line from nought to a thousand. Put the number on it.',
  rule:'Click the spot on the line where the number belongs. Six rounds, no tick marks.',
  unit:'%', higherBetter:true,
  mount(stage, api){
    const N = 6, MAX = 1000; let i = 0; const errs = [];
    const round = () => {
      if (i >= N) return end();
      const target = irnd(7, MAX - 7);
      const track = el('div', { style:{ position:'relative', width:'min(860px,92vw)', height:'80px', cursor:'crosshair' } });
      const rail = el('div', { style:{ position:'absolute', left:0, right:0, top:'40px', height:'2px', background:'rgba(255,255,255,.5)' } });
      const l0 = el('div', { style:{ position:'absolute', left:0, top:'52px', fontFamily:'var(--mono)', fontSize:'12px', color:'var(--dim)' }, text:'0' });
      const l1 = el('div', { style:{ position:'absolute', right:0, top:'52px', fontFamily:'var(--mono)', fontSize:'12px', color:'var(--dim)' }, text:'1000' });
      const tickL = el('div', { style:{ position:'absolute', left:0, top:'30px', width:'2px', height:'22px', background:'rgba(255,255,255,.5)' } });
      const tickR = el('div', { style:{ position:'absolute', right:0, top:'30px', width:'2px', height:'22px', background:'rgba(255,255,255,.5)' } });
      const ghost = el('div', { style:{ position:'absolute', top:'22px', width:'2px', height:'38px', background:'#fff', opacity:0 } });
      track.append(rail, tickL, tickR, l0, l1, ghost);
      track.onpointermove = e => {
        const r = track.getBoundingClientRect();
        ghost.style.left = clamp(e.clientX - r.left, 0, r.width) + 'px'; ghost.style.opacity = 1;
      };
      track.onpointerleave = () => ghost.style.opacity = 0;
      track.onpointerdown = e => {
        const r = track.getBoundingClientRect();
        const frac = clamp((e.clientX - r.left) / r.width, 0, 1);
        const said = Math.round(frac * MAX);
        const err = Math.abs(said - target) / MAX;
        errs.push(err); i++;
        err < .02 ? api.sfx.good() : err < .06 ? api.sfx.click() : api.sfx.miss();
        const truth = el('div', { style:{ position:'absolute', top:'22px', left:(target/MAX*r.width)+'px', width:'2px', height:'38px', background:'var(--good)' } });
        ghost.style.background = 'var(--bad)';
        track.append(truth);
        track.onpointerdown = null; track.onpointermove = null;
        stage.append(el('div', { class:'hint', text:`you said ${said} · it was ${target}` }));
        api.life.after(round, 950);
      };
      stage.replaceChildren(
        el('div', { class:'hud' }, 'round ', el('b', { text:`${i+1}/${N}` })),
        el('div', { class:'big', text:String(target) }),
        track,
        el('div', { class:'hint', text:'click where it goes' })
      );
    };
    const end = () => {
      const avg = errs.reduce((a,b)=>a+b,0)/errs.length;
      const acc = (1 - avg) * 100;
      api.finish(Math.round(acc*10)/10, curve(acc, 88, 99.4), { label:'accuracy %',
        breakdown:[['best', ((1-Math.min(...errs))*100).toFixed(1)+'%'], ['worst', ((1-Math.max(...errs))*100).toFixed(1)+'%']] });
    };
    round();
  }
};

export default [stroop, typing, maths, nback, numberline];
