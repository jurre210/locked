import { el, clamp, rnd, irnd, pick, shuffle, fmt, countdown, cellSize, countUp } from '../core/ui.js';
import { nudge } from '../core/feedback.js';

/* =================================================================== */
/* colour — recreate five colours from memory                          */
/* =================================================================== */
const colour = {
  key:'colour', name:'colour', cat:'perception', family:'color',
  blurb:'One colour at a time. Look, then rebuild it. Five rounds.',
  rule:'You see a colour, it disappears, you rebuild it with hue, saturation and lightness. One at a time — look, build, next.',
  unit:'/10', higherBetter:true,
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
        const pts = score10(targets[i], guesses[i]);
        const num = el('div', { class:'big', text:'0.0' });
        stage.replaceChildren(
          el('div', { class:'hud' }, 'round ', el('b', { text:`${i+1}/${N}` })),
          el('div', { style:{ display:'flex', gap:'10px' } },
            el('div', { class:'swatch', style:{ width:'132px', height:'96px', background:`rgb(${targets[i].join(',')})` } }),
            el('div', { class:'swatch', style:{ width:'132px', height:'96px', background:`hsl(${h} ${s}% ${l}%)` } })),
          el('div', { class:'hint', text:'theirs · yours' }),
          el('div', { style:{ display:'flex', alignItems:'baseline', gap:'4px' } },
            num, el('div', { class:'mid', style:{ color:'var(--dim)' }, text:'/10' }))
        );
        countUp(num, pts, { ms:900, decimals:1, life:api.life });
        pts >= 8.5 ? api.sfx.good() : pts >= 6 ? api.sfx.click() : api.sfx.miss();
        api.life.after(() => showPhase(i + 1), 1700);
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
      const pts = targets.map((t, i) => score10(t, guesses[i]));
      const avg = pts.reduce((a,b)=>a+b,0) / N;
      const rows = el('div', { style:{ display:'flex', gap:'6px', marginTop:'10px' } },
        targets.map((t,i) => el('div', { style:{ display:'flex', flexDirection:'column', gap:'3px' } },
          el('div', { class:'swatch', style:{ width:'54px', height:'34px', background:`rgb(${t.join(',')})` } }),
          el('div', { class:'swatch', style:{ width:'54px', height:'34px', background:`rgb(${guesses[i].join(',')})` } }),
          el('div', { style:{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--dim)', textAlign:'center' }, text: pts[i].toFixed(1) })
        ))
      );
      stage.replaceChildren(rows);
      api.finish(Math.round(avg * 10) / 10, curve(avg, 4.6, 9.4), { label:'score out of 10',
        breakdown:[['best round', Math.max(...pts).toFixed(1)], ['worst round', Math.min(...pts).toFixed(1)]] });
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

/* Colour difference in CIE Lab. Redmean is a cheap approximation of how
   different two colours *look*, and it scored obviously-close matches as
   badly as obviously-wrong ones. Lab is built for exactly this, so the
   number now tracks what your eye says. */
function rgb2lab([r, g, b]){
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = lin(r), G = lin(g), B = lin(b);
  // sRGB -> XYZ (D65), then normalised against the white point
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** Perceptual distance. ~1 is the smallest difference an eye can catch. */
function deltaE(a, b){
  const A = rgb2lab(a), B = rgb2lab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/** deltaE -> a score out of 10. dE 0 = perfect, dE 60+ = nothing.
    60 rather than 50 so a wrong-but-honest attempt still separates itself
    from not having tried at all. */
function score10(a, b){
  return clamp(10 * (1 - deltaE(a, b) / 60), 0, 10);
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
  levels:['easy','normal','hard'],
  mount(stage, api){
    const L = {
      easy:   { grow:4, maxSize:5, d0:42, decay:0.940, floor:3.2, lives:4, anchors:[5, 34] },
      normal: { grow:3, maxSize:7, d0:38, decay:0.915, floor:1.8, lives:3, anchors:[4, 30] },
      hard:   { grow:2, maxSize:8, d0:30, decay:0.880, floor:0.9, lives:2, anchors:[3, 26] }
    }[api.level] || {};
    let level = 1, lives = L.lives;
    const sizeAt = lv => Math.min(2 + Math.ceil(lv / L.grow), L.maxSize);
    const deltaAt = lv => Math.max(L.floor, L.d0 * Math.pow(L.decay, lv));
    const round = () => {
      const size = sizeAt(level);
      const n = size * size;
      const odd = irnd(0, n - 1);
      const hue = irnd(0, 359), sat = irnd(45, 85), lig = irnd(40, 62);
      const delta = deltaAt(level);
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
        el('span', {}, 'lives ', el('b', { text:'●'.repeat(Math.max(0,lives)) + '○'.repeat(Math.max(0, L.lives - Math.max(0,lives))) }))
      );
      paintHud();
      stage.replaceChildren(hud, pad);
    };
    const end = () => {
      api.finish(level, curve(level, L.anchors[0], L.anchors[1]), { label:'level reached',
        breakdown:[['grid', `${sizeAt(level)}×`], ['final gap', deltaAt(level).toFixed(1) + '%']] });
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
  levels:['easy','normal','hard'],
  mount(stage, api){
    const L = {
      easy:   { ranges:[[3,6],[6,10],[10,15],[15,22],[22,30],[30,40]], base:460, step:120, anchors:[62, 95] },
      normal: { ranges:[[4,7],[8,13],[14,21],[22,32],[33,46],[47,64]], base:320, step:90,  anchors:[55, 93] },
      hard:   { ranges:[[6,11],[12,20],[21,34],[35,52],[53,74],[75,99]], base:200, step:45, anchors:[48, 90] }
    }[api.level] || {};
    const N = 6; let i = 0; const errs = [];
    // starts genuinely countable and ramps into estimation territory
    const RANGES = L.ranges;
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
      api.life.after(() => ask(n), L.base + i * L.step);
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
      api.finish(Math.round(acc*10)/10, curve(acc, L.anchors[0], L.anchors[1]), { label:'accuracy %',
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
  levels:['easy','normal','hard'],
  mount(stage, api){
    const GLYPHS = ['◆','●','■','▲','★','✚','◗','⬢','◐','⬟'];
    const L = {
      easy:   { grow:7, maxSize:5, d0:44, decay:0.9, floor:15, anchors:[4, 26] },
      normal: { grow:5, maxSize:6, d0:40, decay:1.2, floor:9,  anchors:[3, 22] },
      hard:   { grow:3, maxSize:7, d0:32, decay:1.5, floor:4,  anchors:[3, 18] }
    }[api.level] || {};
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
      const size = clamp(3 + Math.floor(level / L.grow), 3, L.maxSize);
      const n = size * size;
      const oddIdx = irnd(0, n - 1);
      const g = pick(GLYPHS);
      const rot = irnd(0, 359);
      const drift = Math.max(L.floor, L.d0 - level * L.decay);
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
      api.finish(found, curve(score, L.anchors[0], L.anchors[1]), { label:'shapes found',
        breakdown:[['misses', String(misses)], ['hardest grid', `${clamp(3 + Math.floor(level / L.grow), 3, L.maxSize)}×`]] });
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
