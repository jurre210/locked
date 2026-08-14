import { el, clamp, rnd, irnd, pick, shuffle, fmt, countdown, cellSize } from '../core/ui.js';
import { nudge } from '../core/feedback.js';

/* =================================================================== */
/* colour — recreate five colours from memory                          */
/* =================================================================== */
const colour = {
  key:'colour', name:'colour', cat:'perception', family:'color',
  blurb:'One colour at a time. Look, then rebuild it. Five rounds.',
  rule:'You see a colour, it disappears, you rebuild it with hue, saturation and lightness. One at a time — look, build, next.',
  unit:'%', higherBetter:true,
  mount(stage, api){
    const N = 5;
    // targets are authored in HSL so the sliders map onto how the colour was made
    const targets = Array.from({ length:N }, () => hsl2rgb(irnd(0,359), irnd(35,92), irnd(28,72)));
    const guesses = [];

    // show colour i → rebuild colour i → show colour i+1 …
    const showPhase = (i) => {
      if (i >= N) return done();
      const [r,g,b] = targets[i];
      const sw = el('div', { class:'swatch', style:{ width:'min(360px,62vw)', height:'min(340px,40vh)', background:`rgb(${r},${g},${b})` } });
      const bar = el('i');
      stage.replaceChildren(
        el('div', { class:'hud' }, 'colour ', el('b', { text:`${i+1}/${N}` })),
        sw,
        el('div', { class:'hint', text:'look hard.' }),
        el('div', { class:'bar' }, bar),
        el('div', { class:'dots' }, targets.map((_,k) => el('div', { class:'dot' + (k < i ? ' hit' : k === i ? ' on' : '') })))
      );
      api.sfx.step(i);
      const DUR = 2600, t0 = performance.now();
      // the timer owns progression; the frame loop only draws the bar, so a
      // throttled rAF (background tab) can never strand the round
      api.life.after(() => { api.sfx.tick(); guessPhase(i); }, DUR);
      api.life.frame(() => {
        const t = performance.now() - t0;
        bar.style.width = clamp(1 - t / DUR, 0, 1) * 100 + '%';
        if (t >= DUR) return false;
      });
    };

    const guessPhase = (i) => {
      let h = 180, s = 55, l = 50;
      const sw = el('div', { class:'swatch', style:{ width:'min(340px,58vw)', height:'min(200px,24vh)', background:'hsl(180 55% 50%)' } });

      // repaint straight off the pointer — no transition, no rAF in the way
      const paint = () => { sw.style.background = `hsl(${h} ${s}% ${l}%)`; };
      const mk = (label, min, max, get, set, track) => {
        const inp = el('input', { class:'slider', type:'range', min, max, value:get(), step:1 });
        const val = el('span', { style:{ width:'42px', textAlign:'right', fontFamily:'var(--mono)', fontSize:'12px', color:'var(--dim)' } });
        const sync = () => { val.textContent = get() + (label === 'hue' ? '°' : '%'); };
        const row = el('div', { class:'hsl-row' },
          el('span', { class:'hsl-label', text:label }), inp, val);
        // live track colours so you can see where you are heading
        const retint = () => { inp.style.setProperty('--track', track()); };
        inp.oninput = () => { set(+inp.value); paint(); sync(); retintAll(); };
        inp.onchange = () => api.sfx.tick();
        sync(); retint();
        return { row, inp, retint };
      };

      const rows = [];
      const retintAll = () => rows.forEach(r => r.retint());
      rows.push(mk('hue', 0, 359, () => h, v => h = v,
        () => `linear-gradient(90deg,hsl(0 ${s}% ${l}%),hsl(60 ${s}% ${l}%),hsl(120 ${s}% ${l}%),hsl(180 ${s}% ${l}%),hsl(240 ${s}% ${l}%),hsl(300 ${s}% ${l}%),hsl(360 ${s}% ${l}%))`));
      rows.push(mk('sat', 0, 100, () => s, v => s = v,
        () => `linear-gradient(90deg,hsl(${h} 0% ${l}%),hsl(${h} 100% ${l}%))`));
      rows.push(mk('light', 0, 100, () => l, v => l = v,
        () => `linear-gradient(90deg,#000,hsl(${h} ${s}% 50%),#fff)`));
      retintAll();

      const go = el('button', { class:'btn', text: i === N-1 ? 'finish' : 'lock it in' });
      go.onclick = () => {
        api.sfx.click();
        guesses.push(hsl2rgb(h, s, l));
        const acc = 1 - dist(targets[i], guesses[i]);
        // instant feedback, then straight on to the next colour
        stage.replaceChildren(
          el('div', { class:'hud' }, 'round ', el('b', { text:`${i+1}/${N}` })),
          el('div', { style:{ display:'flex', gap:'10px' } },
            el('div', { class:'swatch', style:{ width:'132px', height:'96px', background:`rgb(${targets[i].join(',')})` } }),
            el('div', { class:'swatch', style:{ width:'132px', height:'96px', background:`hsl(${h} ${s}% ${l}%)` } })),
          el('div', { class:'hint', text:'theirs · yours' }),
          el('div', { class:'big', text: Math.round(acc*100) + '%' })
        );
        acc > .93 ? api.sfx.good() : acc > .82 ? api.sfx.click() : api.sfx.miss();
        api.life.after(() => showPhase(i + 1), 1100);
      };

      stage.replaceChildren(
        el('div', { class:'hud' }, 'rebuild ', el('b', { text:`${i+1}/${N}` })),
        sw,
        el('div', { class:'hsl' }, rows.map(r => r.row)),
        go,
        el('div', { class:'hint', html:'drag the sliders · <span class="kbd">enter</span> to lock in' })
      );
      api.life.on(window, 'keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); go.click(); } });
    };

    const done = () => {
      const accs = targets.map((t, i) => 1 - dist(t, guesses[i]));
      const avg = accs.reduce((a,b)=>a+b,0) / N;
      const rows = el('div', { style:{ display:'flex', gap:'6px', marginTop:'10px' } },
        targets.map((t,i) => el('div', { style:{ display:'flex', flexDirection:'column', gap:'3px' } },
          el('div', { class:'swatch', style:{ width:'54px', height:'34px', background:`rgb(${t.join(',')})` } }),
          el('div', { class:'swatch', style:{ width:'54px', height:'34px', background:`rgb(${guesses[i].join(',')})` } }),
          el('div', { style:{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--dim)', textAlign:'center' }, text: Math.round(accs[i]*100)+'' })
        ))
      );
      stage.replaceChildren(rows);
      api.finish(Math.round(avg * 1000) / 10, curve(avg, .70, .965), { label:'accuracy %', raw: Math.round(avg*1000)/10,
        breakdown:[['best round', Math.round(Math.max(...accs)*100)+'%'], ['worst round', Math.round(Math.min(...accs)*100)+'%']] });
    };

    showPhase(0);
  }
};

function hsl2rgb(h, s, l){
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)];
}

// redmean colour distance, normalised 0..1
function dist(a, b){
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0]-b[0], dg = a[1]-b[1], db = a[2]-b[2];
  const d = Math.sqrt((2 + rm/256)*dr*dr + 4*dg*dg + (2 + (255-rm)/256)*db*db);
  return clamp(d / 765, 0, 1);
}
const curve = (v, worst, best) => clamp((v - worst) / (best - worst), 0, 1);

/* =================================================================== */
/* shade — find the odd tile                                           */
/* =================================================================== */
const shade = {
  key:'shade', name:'shade', cat:'perception', family:'color',
  blurb:'One tile is a slightly different colour. Every round it gets harder.',
  rule:'Click the tile that does not match. Three mistakes and it ends.',
  unit:'lvl', higherBetter:true,
  mount(stage, api){
    let level = 1, lives = 3;
    const round = () => {
      // both the grid and the colour gap were tightening far too quickly
      const size = Math.min(2 + Math.ceil(level / 3), 7);
      const n = size * size;
      const odd = irnd(0, n - 1);
      const hue = irnd(0, 359), sat = irnd(45, 85), lig = irnd(40, 62);
      const delta = Math.max(1.8, 38 * Math.pow(0.915, level));
      const base = `hsl(${hue} ${sat}% ${lig}%)`;
      const diff = `hsl(${hue} ${sat}% ${clamp(lig + (Math.random() < .5 ? -delta : delta), 8, 92)}%)`;
      const px = cellSize(size, { maxPx:120, minPx:26 });

      const pad = el('div', { class:'pad', style:{ gridTemplateColumns:`repeat(${size},${px}px)` } });
      for (let i = 0; i < n; i++){
        const c = el('button', { class:'cell', style:{ width:px+'px', height:px+'px', background: i === odd ? diff : base, border:'0' } });
        c.onclick = () => {
          if (i === odd){ api.sfx.good(); level++; paintHud(); round(); }
          else {
            lives--; api.sfx.bad(); pad.classList.add('shake');
            api.life.after(() => pad.classList.remove('shake'), 340);
            paintHud();
            if (lives <= 0) end();
          }
        };
        pad.append(c);
      }
      const hud = el('div', { class:'hud' });
      const paintHud = () => hud.replaceChildren(
        el('span', {}, 'level ', el('b', { text:String(level) })),
        el('span', {}, 'lives ', el('b', { text:'●'.repeat(Math.max(0,lives)) + '○'.repeat(3 - Math.max(0,lives)) }))
      );
      paintHud();
      stage.replaceChildren(hud, pad);
    };
    const end = () => {
      api.finish(level, curve(level, 4, 30), { label:'level reached',
        breakdown:[['grid', `${Math.min(2 + Math.ceil(level / 3), 7)}×`],
                   ['final gap', (Math.max(1.8, 38 * Math.pow(0.915, level))).toFixed(1) + '%']] });
    };
    round();
  }
};

/* =================================================================== */
/* angle — recreate an angle                                           */
/* =================================================================== */
const angle = {
  key:'angle', name:'angle', cat:'perception', family:'mind',
  blurb:'See an angle for a second and a half. Draw it back.',
  rule:'Watch the angle, then drag the arm until it matches. Five rounds.',
  unit:'°', higherBetter:false,
  mount(stage, api){
    const N = 5; const errs = []; let i = 0;
    const R = 150;
    const svg = (deg, live) => {
      const rad = deg * Math.PI / 180;
      const x = 180 + Math.cos(-rad) * R, y = 180 + Math.sin(-rad) * R;
      return `<svg viewBox="0 0 360 220" style="width:min(560px,88vw)">
        <line x1="180" y1="180" x2="${180+R}" y2="180" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
        <line x1="180" y1="180" x2="${x}" y2="${y}" stroke="${live?'#fff':'#fff'}" stroke-width="3" stroke-linecap="round"/>
        <path d="M ${180+52} 180 A 52 52 0 0 0 ${180+Math.cos(-rad)*52} ${180+Math.sin(-rad)*52}" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
        <circle cx="180" cy="180" r="4" fill="#fff"/>
      </svg>`;
    };
    const show = () => {
      if (i >= N) return end();
      const target = irnd(12, 168);
      stage.replaceChildren(
        el('div', { class:'hud' }, 'round ', el('b', { text:`${i+1}/${N}` })),
        el('div', { html: svg(target, false) }),
        el('div', { class:'hint', text:'remember it' })
      );
      api.sfx.step(i);
      api.life.after(() => guess(target), 1500);
    };
    const guess = (target) => {
      let cur = 90;
      const box = el('div', { html: svg(cur, true), style:{ cursor:'grab' } });
      const readout = el('div', { class:'mid', text:'90°' });
      const move = (e) => {
        const s = box.querySelector('svg').getBoundingClientRect();
        const cx = s.left + s.width * (180/360), cy = s.top + s.height * (180/220);
        const p = e.touches ? e.touches[0] : e;
        let d = Math.atan2(cy - p.clientY, p.clientX - cx) * 180 / Math.PI;
        cur = clamp(Math.round(d), 0, 180);
        box.innerHTML = svg(cur, true); readout.textContent = cur + '°';
      };
      let down = false;
      api.life.on(box, 'pointerdown', e => { down = true; move(e); });
      api.life.on(window, 'pointermove', e => { if (down) move(e); });
      api.life.on(window, 'pointerup', () => { down = false; });
      const go = el('button', { class:'btn', text:'lock it in' });
      go.onclick = () => {
        const err = Math.abs(cur - target);
        errs.push(err);
        err <= 4 ? api.sfx.good() : err <= 12 ? api.sfx.click() : api.sfx.miss();
        i++;
        stage.replaceChildren(el('div', { class:'big', text: err + '°' }),
          el('div', { class:'hint', text: err <= 4 ? nudge('hit') : err <= 12 ? nudge('near') : nudge('miss') }));
        api.life.after(show, 850);
      };
      stage.replaceChildren(
        el('div', { class:'hud' }, 'round ', el('b', { text:`${i+1}/${N}` })),
        box, readout, go,
        el('div', { class:'hint', text:'drag anywhere in the box · enter to lock in' })
      );
      api.life.on(window, 'keydown', e => {
        if (e.key === 'Enter'){ e.preventDefault(); go.click(); }
        if (e.key === 'ArrowLeft'){ cur = clamp(cur+1,0,180); box.innerHTML = svg(cur,true); readout.textContent = cur+'°'; }
        if (e.key === 'ArrowRight'){ cur = clamp(cur-1,0,180); box.innerHTML = svg(cur,true); readout.textContent = cur+'°'; }
      });
    };
    const end = () => {
      const avg = errs.reduce((a,b)=>a+b,0) / errs.length;
      api.finish(Math.round(avg*10)/10, curve(avg, 22, 1.5), { label:'average error °', higherBetter:false,
        breakdown:[['best', Math.min(...errs)+'°'], ['worst', Math.max(...errs)+'°']] });
    };
    show();
  }
};

/* =================================================================== */
/* count — how many dots was that                                      */
/* =================================================================== */
const count = {
  key:'count', name:'count', cat:'perception', family:'mind',
  blurb:'Dots flash for a moment. How many were there? Close counts.',
  rule:'Six flashes, each busier than the last. Type roughly how many you saw — you are scored on how close you get, not on being exact.',
  unit:'%', higherBetter:true,
  mount(stage, api){
    const N = 6; let i = 0; const errs = [];
    // starts genuinely countable and ramps into estimation territory
    const RANGES = [[4,7], [8,13], [14,21], [22,32], [33,46], [47,64]];
    const flash = () => {
      if (i >= N) return end();
      const n = irnd(...RANGES[i]);
      const zone = el('div', { class:'zone', style:{ minHeight:'min(340px,44vh)', cursor:'default' } });
      for (let k = 0; k < n; k++){
        const s = rnd(9, 15);
        zone.append(el('div', { class:'target', style:{
          left: rnd(6, 94) + '%', top: rnd(8, 92) + '%', width:s+'px', height:s+'px'
        }}));
      }
      stage.replaceChildren(el('div', { class:'hud' }, 'flash ', el('b', { text:`${i+1}/${N}` })), zone);
      api.sfx.tick();
      // more dots, more looking time — a fifth of a second for 60 dots was absurd
      api.life.after(() => ask(n), 320 + i * 90);
    };
    const ask = (n) => {
      const inp = el('input', { class:'field', type:'text', inputmode:'numeric', placeholder:'how many?', autocomplete:'off' });
      const go = el('button', { class:'btn', text:'submit' });
      const submit = () => {
        const g = parseInt(inp.value, 10);
        if (!Number.isFinite(g)) return;
        const err = Math.abs(g - n) / n;
        errs.push(err); i++;
        err < .10 ? api.sfx.good() : err < .25 ? api.sfx.click() : api.sfx.miss();
        stage.replaceChildren(
          el('div', { class:'big', text:String(n) }),
          el('div', { class:'hint', text: `you said ${g}` })
        );
        api.life.after(flash, 800);
      };
      go.onclick = submit;
      stage.replaceChildren(el('div', { class:'hud' }, 'flash ', el('b', { text:`${i+1}/${N}` })), inp, go);
      inp.focus();
      api.life.on(inp, 'keydown', e => { if (e.key === 'Enter') submit(); });
    };
    const end = () => {
      const avg = errs.reduce((a,b)=>a+b,0) / errs.length;
      const acc = (1 - avg) * 100;
      api.finish(Math.round(acc*10)/10, curve(acc, 55, 93), { label:'accuracy %',
        breakdown:[['best flash', ((1 - Math.min(...errs)) * 100).toFixed(0) + '%'],
                   ['worst flash', ((1 - Math.max(...errs)) * 100).toFixed(0) + '%']] });
    };
    flash();
  }
};

/* =================================================================== */
/* odd — spot the different glyph, against the clock                   */
/* =================================================================== */
const odd = {
  key:'odd', name:'odd one', cat:'perception', family:'mind',
  blurb:'One shape in the grid is wrong. Find as many as you can in 40 seconds.',
  rule:'Every grid hides one shape that differs. Click it. Forty seconds on the clock.',
  unit:'found', higherBetter:true,
  mount(stage, api){
    const GLYPHS = ['◆','●','■','▲','★','✚','◗','⬢','◐','⬟'];
    let found = 0, misses = 0, level = 0, running = false, t0 = 0;
    const DUR = 40000;

    const hud = el('div', { class:'hud' });
    const board = el('div');
    const paintHud = () => {
      const left = Math.max(0, DUR - (performance.now() - t0));
      hud.replaceChildren(
        el('span', {}, 'found ', el('b', { text:String(found) })),
        el('span', {}, 'misses ', el('b', { text:String(misses) })),
        el('span', {}, 'time ', el('b', { text:(left/1000).toFixed(1) }))
      );
    };

    const round = () => {
      const size = clamp(3 + Math.floor(level / 5), 3, 6);
      const n = size * size;
      const oddIdx = irnd(0, n - 1);
      const g = pick(GLYPHS);
      const rot = irnd(0, 359);
      const drift = Math.max(9, 40 - level * 1.2);
      const px = cellSize(size, { maxPx:110, minPx:30, vFrac:.40 });
      const pad = el('div', { class:'pad', style:{ gridTemplateColumns:`repeat(${size},${px}px)` } });
      for (let k = 0; k < n; k++){
        const c = el('button', { class:'cell', style:{
          width:px+'px', height:px+'px', fontSize: Math.round(px*.5)+'px',
          transform:`rotate(${k === oddIdx ? rot + drift : rot}deg)`,
          background:'#0d0d0d'
        }, text:g });
        c.onclick = () => {
          if (!running) return;
          if (k === oddIdx){ found++; level++; api.sfx.good(); round(); }
          else { misses++; api.sfx.miss(); c.classList.add('no'); }
          paintHud();
        };
        pad.append(c);
      }
      board.replaceChildren(pad);
    };

    const begin = () => {
      running = true; t0 = performance.now();
      round();
      stage.replaceChildren(hud, board);
      api.life.frame(() => {
        paintHud();
        if (performance.now() - t0 >= DUR){ end(); return false; }
      });
    };
    const end = () => {
      running = false;
      const score = Math.max(0, found - misses * 0.5);
      api.finish(found, curve(score, 3, 22), { label:'shapes found',
        breakdown:[['misses', String(misses)], ['hardest grid', `${clamp(3 + Math.floor(level / 5), 3, 6)}×`]] });
    };
    countdown(stage, api.life, api.sfx, begin);
  }
};

/* =================================================================== */
/* gradient — order the shades                                         */
/* =================================================================== */
const gradient = {
  key:'gradient', name:'gradient', cat:'perception', family:'color',
  blurb:'Shuffled shades of one colour. Put them back in order.',
  rule:'Click two tiles to swap them until the row runs light to dark. Fewer swaps is better.',
  unit:'%', higherBetter:true,
  mount(stage, api){
    const n = 9;
    const hue = irnd(0, 359), sat = irnd(35, 80);
    const light = Array.from({ length:n }, (_, i) => 18 + i * (62 / (n - 1)));
    let order = shuffle(light.slice());
    while (order.every((v, i) => v === light[i])) order = shuffle(light.slice());
    let sel = -1, swaps = 0;
    const t0 = performance.now();

    const paint = () => {
      const px = cellSize(n, { maxPx:96, minPx:26, vFrac:.30 });
      const row = el('div', { class:'pad', style:{ gridTemplateColumns:`repeat(${n},${px}px)` } });
      order.forEach((L, i) => {
        const c = el('button', { class:'cell' + (i === sel ? ' lit' : ''), style:{
          width:px+'px', height: Math.round(px*1.6)+'px', background:`hsl(${hue} ${sat}% ${L}%)`,
          outline: i === sel ? '2px solid #fff' : 'none', outlineOffset:'2px', border:'0'
        }});
        c.onclick = () => {
          if (sel === -1){ sel = i; api.sfx.click(); }
          else if (sel === i){ sel = -1; api.sfx.tick(); }
          else { [order[sel], order[i]] = [order[i], order[sel]]; swaps++; sel = -1; api.sfx.step(swaps % 6); }
          paint();
        };
        row.append(c);
      });
      const go = el('button', { class:'btn', text:'done' });
      go.onclick = end;
      stage.replaceChildren(
        el('div', { class:'hud' }, 'swaps ', el('b', { text:String(swaps) })),
        row,
        el('div', { class:'hint', text:'lightest on the left, darkest on the right' }),
        go
      );
    };
    const end = () => {
      // Spearman-style positional accuracy
      const err = order.reduce((s, v, i) => s + Math.abs(light.indexOf(v) - i), 0);
      const maxErr = Math.floor(n * n / 2);
      const acc = (1 - err / maxErr) * 100;
      const secs = (performance.now() - t0) / 1000;
      api.finish(Math.round(acc*10)/10, curve(acc, 55, 100), { label:'accuracy %',
        breakdown:[['swaps', String(swaps)], ['time', secs.toFixed(1)+'s']] });
    };
    paint();
  }
};

export default [colour, shade, gradient, angle, count, odd];
