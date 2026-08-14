import { el, clamp, rnd, irnd, pick, countdown } from '../core/ui.js';
import { nudge } from '../core/feedback.js';

const curve = (v, worst, best) => clamp((v - worst) / (best - worst), 0, 1);

/* =================================================================== */
/* reaction                                                            */
/* =================================================================== */
const reaction = {
  key:'reaction', name:'reaction', cat:'reflex', family:'reflex',
  blurb:'The screen changes. Click. Five rounds, averaged.',
  rule:'Wait for the screen to flip, then click as fast as you can. Click early and the round is void.',
  unit:'ms', higherBetter:false,
  mount(stage, api){
    const N = 5; const times = []; let state = 'wait', t0 = 0, timer = null;
    const zone = el('div', { class:'zone', style:{ display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' } });
    const label = el('div', { class:'mid' });
    const hud = el('div', { class:'hud' });
    const paint = () => hud.replaceChildren(
      el('span', {}, 'round ', el('b', { text:`${times.length+1}/${N}` })),
      times.length ? el('span', {}, 'avg ', el('b', { text: Math.round(times.reduce((a,b)=>a+b,0)/times.length) + 'ms' })) : null
    );

    const arm = () => {
      state = 'wait';
      zone.style.background = '#0a0a0a';
      label.textContent = 'wait for white…';
      label.style.color = 'var(--dim)';
      timer = api.life.after(() => {
        state = 'go'; t0 = performance.now();
        zone.style.background = '#fff';
        label.textContent = 'CLICK';
        label.style.color = '#000';
        api.sfx.tick();
      }, rnd(1200, 4200));
    };

    const hit = () => {
      if (state === 'wait'){
        api.life.clear(timer);
        api.sfx.bad();
        state = 'early';
        zone.style.background = '#180000';
        label.style.color = 'var(--bad)';
        label.textContent = 'too early. click to retry.';
        return;
      }
      if (state === 'early'){ arm(); return; }
      if (state === 'go'){
        const ms = performance.now() - t0;
        times.push(ms);
        state = 'shown';
        zone.style.background = '#0a0a0a';
        label.style.color = '#fff';
        label.textContent = Math.round(ms) + ' ms';
        ms < 220 ? api.sfx.good() : api.sfx.click();
        paint();
        if (times.length >= N) api.life.after(end, 850);
        else api.life.after(arm, 850);
      }
    };

    const end = () => {
      const avg = times.reduce((a,b)=>a+b,0) / times.length;
      api.finish(Math.round(avg), curve(avg, 400, 165), { label:'average', higherBetter:false,
        breakdown:[['best', Math.round(Math.min(...times))+'ms'], ['worst', Math.round(Math.max(...times))+'ms']] });
    };

    zone.append(label);
    api.life.on(zone, 'pointerdown', hit);
    api.life.on(window, 'keydown', e => { if (e.code === 'Space'){ e.preventDefault(); hit(); } });
    stage.replaceChildren(hud, zone, el('div', { class:'hint', html:'click the box or hit <span class="kbd">space</span>' }));
    paint(); arm();
  }
};

/* =================================================================== */
/* aim                                                                 */
/* =================================================================== */
const aim = {
  key:'aim', name:'aim', cat:'reflex', family:'aim',
  blurb:'Thirty targets, one at a time, shrinking. Go.',
  rule:'Hit thirty targets as fast as you can. They get smaller. Misses cost you.',
  unit:'ms', higherBetter:false,
  mount(stage, api){
    const N = 30; let hits = 0, misses = 0, t0 = 0, first = 0;
    const zone = el('div', { class:'zone' });
    const hud = el('div', { class:'hud' });
    const paint = () => hud.replaceChildren(
      el('span', {}, 'target ', el('b', { text:`${hits}/${N}` })),
      el('span', {}, 'miss ', el('b', { text:String(misses) })),
      el('span', {}, 'time ', el('b', { text: t0 ? ((performance.now()-t0)/1000).toFixed(1)+'s' : '0.0s' }))
    );
    let dot = null;
    const spawn = () => {
      const size = clamp(78 - hits * 1.7, 22, 78);
      dot?.remove();
      dot = el('div', { class:'target', style:{
        left: rnd(8, 92)+'%', top: rnd(10, 90)+'%', width:size+'px', height:size+'px',
        boxShadow:'0 0 0 1px rgba(0,0,0,.6)'
      }});
      dot.addEventListener('pointerdown', e => {
        e.stopPropagation();
        hits++; api.sfx.click();
        if (hits >= N) return end();
        spawn(); paint();
      });
      zone.append(dot);
    };
    const begin = () => {
      stage.replaceChildren(hud, zone, el('div', { class:'hint', text:'click the circles. only the circles.' }));
      t0 = performance.now(); first = t0;
      spawn(); paint();
      api.life.on(zone, 'pointerdown', () => { misses++; api.sfx.miss(); paint(); });
      api.life.frame(() => { if (hits < N) paint(); else return false; });
    };
    const end = () => {
      const total = performance.now() - t0;
      const per = total / N;
      const penalty = misses * 90;
      const eff = per + penalty / N;
      api.finish(Math.round(per), curve(eff, 900, 330), { label:'ms per target', higherBetter:false, raw: Math.round(per),
        breakdown:[['total', (total/1000).toFixed(1)+'s'], ['misses', String(misses)],
                   ['accuracy', Math.round(N/(N+misses)*100)+'%']] });
    };
    countdown(stage, api.life, api.sfx, begin);
  }
};

/* =================================================================== */
/* track — stay on the moving dot                                      */
/* =================================================================== */
const track = {
  key:'track', name:'track', cat:'reflex', family:'aim',
  blurb:'A circle wanders. Keep your cursor inside it for 25 seconds.',
  rule:'Hold your cursor inside the circle. It speeds up. Score is the share of time you stayed on it.',
  unit:'%', higherBetter:true,
  mount(stage, api){
    const DUR = 25000;
    const zone = el('div', { class:'zone', style:{ cursor:'none' } });
    const ring = el('div', { style:{ position:'absolute', borderRadius:'50%', border:'2px solid #fff', transform:'translate(-50%,-50%)', transition:'background .12s' } });
    const cur = el('div', { style:{ position:'absolute', width:'8px', height:'8px', borderRadius:'50%', background:'var(--warn)', transform:'translate(-50%,-50%)', pointerEvents:'none' } });
    const hud = el('div', { class:'hud' });
    zone.append(ring, cur);

    let px = 0.5, py = 0.5, vx = rnd(-1,1), vy = rnd(-1,1);
    let mx = -999, my = -999, onFrames = 0, frames = 0, t0 = 0;
    const norm = () => { const m = Math.hypot(vx,vy) || 1; vx/=m; vy/=m; };
    norm();

    const begin = () => {
      stage.replaceChildren(hud, zone, el('div', { class:'hint', text:'no clicking. just follow.' }));
      t0 = performance.now();
      api.life.on(zone, 'pointermove', e => {
        const r = zone.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height;
      });
      let last = performance.now();
      api.life.frame(now => {
        const dt = Math.min(50, now - last); last = now;
        const el2 = performance.now() - t0;
        const speed = (0.055 + el2 / DUR * 0.10) * dt / 16;
        if (Math.random() < 0.035){ vx += rnd(-.7,.7); vy += rnd(-.7,.7); norm(); }
        px += vx * speed * 0.01 * 60; py += vy * speed * 0.01 * 60;
        if (px < .08 || px > .92){ vx *= -1; px = clamp(px,.08,.92); }
        if (py < .10 || py > .90){ vy *= -1; py = clamp(py,.10,.90); }

        const r = zone.getBoundingClientRect();
        const rad = clamp(58 - el2/DUR*22, 34, 58);
        ring.style.width = ring.style.height = rad*2 + 'px';
        ring.style.left = px*100 + '%'; ring.style.top = py*100 + '%';
        cur.style.left = mx*100 + '%'; cur.style.top = my*100 + '%';

        const d = Math.hypot((mx-px)*r.width, (my-py)*r.height);
        const on = d < rad;
        ring.style.background = on ? 'rgba(94,224,138,.28)' : 'transparent';
        ring.style.borderColor = on ? 'var(--good)' : '#fff';
        frames++; if (on) onFrames++;

        hud.replaceChildren(
          el('span', {}, 'on target ', el('b', { text: Math.round(onFrames/Math.max(1,frames)*100)+'%' })),
          el('span', {}, 'time ', el('b', { text: ((DUR-el2)/1000).toFixed(1) }))
        );
        if (el2 >= DUR){ end(onFrames/Math.max(1,frames)); return false; }
      });
    };
    const end = (p) => {
      const pct = p * 100;
      api.finish(Math.round(pct*10)/10, curve(pct, 40, 96), { label:'time on target %' });
    };
    countdown(stage, api.life, api.sfx, begin);
  }
};

/* =================================================================== */
/* clock — stop at exactly ten seconds, blind                          */
/* =================================================================== */
const clock = {
  key:'clock', name:'clock', cat:'reflex', family:'time',
  blurb:'Start the timer, stop it at exactly ten seconds. No display.',
  rule:'Press to start, press again when you think ten seconds have passed. You will not be able to see the clock.',
  unit:'ms off', higherBetter:false,
  mount(stage, api){
    const TARGET = 10000;
    let t0 = 0, running = false, done = false;
    const big = el('div', { class:'big', text:'10.000' });
    const hint = el('div', { class:'hint', html:'press <span class="kbd">space</span> or click to start' });
    const zone = el('div', { class:'zone', style:{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'14px', cursor:'pointer' } }, big, hint);

    const go = () => {
      if (done) return;
      if (!running){
        running = true; t0 = performance.now();
        big.textContent = '· · ·'; big.style.color = 'var(--dimmer)';
        hint.innerHTML = 'stop it at ten.';
        api.sfx.start();
        // heartbeat you cannot count on: a soft tick at a random early moment only
        api.life.after(() => api.sfx.tick(), rnd(400, 1400));
      } else {
        done = true;
        const t = performance.now() - t0;
        const off = Math.abs(t - TARGET);
        big.style.color = '#fff';
        big.textContent = (t/1000).toFixed(3);
        off < 120 ? api.sfx.perfect() : off < 500 ? api.sfx.good() : api.sfx.miss();
        hint.textContent = (t > TARGET ? 'late by ' : 'early by ') + (off/1000).toFixed(3) + 's';
        api.life.after(() => {
          api.finish(Math.round(off), curve(off, 2200, 40), { label:'off by (ms)', higherBetter:false,
            breakdown:[['you stopped at', (t/1000).toFixed(3)+'s'], ['drift', (t>TARGET?'+':'−') + (off/1000).toFixed(3)+'s']] });
        }, 900);
      }
    };
    api.life.on(zone, 'pointerdown', go);
    api.life.on(window, 'keydown', e => { if (e.code === 'Space'){ e.preventDefault(); go(); } });
    stage.replaceChildren(zone);
  }
};

/* =================================================================== */
/* dodge — survive                                                     */
/* =================================================================== */
const dodge = {
  key:'dodge', name:'dodge', cat:'reflex', family:'aim',
  blurb:'Steer a dot through a room that is filling up with things that kill it.',
  rule:'Your dot follows the cursor. Touch nothing. Survive as long as you can.',
  unit:'s', higherBetter:true,
  mount(stage, api){
    const zone = el('div', { class:'zone', style:{ cursor:'none', minHeight:'min(380px,48vh)' } });
    const you = el('div', { style:{ position:'absolute', width:'14px', height:'14px', borderRadius:'50%', background:'#fff', transform:'translate(-50%,-50%)', boxShadow:'0 0 14px rgba(255,255,255,.7)' } });
    const hud = el('div', { class:'hud' });
    zone.append(you);
    let mx = .5, my = .5, t0 = 0, alive = true;
    const balls = [];

    const spawn = () => {
      const edge = irnd(0,3);
      const b = { r: rnd(11, 26), s: rnd(.14, .32) };
      if (edge === 0){ b.x = -.06; b.y = rnd(0,1); }
      if (edge === 1){ b.x = 1.06; b.y = rnd(0,1); }
      if (edge === 2){ b.y = -.06; b.x = rnd(0,1); }
      if (edge === 3){ b.y = 1.06; b.x = rnd(0,1); }
      const ang = Math.atan2(my - b.y, mx - b.x) + rnd(-.5,.5);
      b.vx = Math.cos(ang) * b.s; b.vy = Math.sin(ang) * b.s;
      b.node = el('div', { style:{ position:'absolute', width:b.r*2+'px', height:b.r*2+'px', borderRadius:'50%',
        border:'1px solid rgba(255,255,255,.5)', background:'rgba(255,255,255,.10)', transform:'translate(-50%,-50%)' } });
      zone.append(b.node); balls.push(b);
      api.sfx.hover();
    };

    const begin = () => {
      stage.replaceChildren(hud, zone, el('div', { class:'hint', text:'move the mouse. that is the whole control scheme.' }));
      t0 = performance.now();
      api.life.on(zone, 'pointermove', e => {
        const r = zone.getBoundingClientRect();
        mx = clamp((e.clientX - r.left) / r.width, 0, 1);
        my = clamp((e.clientY - r.top) / r.height, 0, 1);
      });
      let last = performance.now(), nextSpawn = 600;
      api.life.frame(now => {
        if (!alive) return false;
        const dt = Math.min(48, now - last); last = now;
        const age = now - t0;
        nextSpawn -= dt;
        if (nextSpawn <= 0){ spawn(); nextSpawn = clamp(900 - age/60, 190, 900); }
        const r = zone.getBoundingClientRect();
        you.style.left = mx*100+'%'; you.style.top = my*100+'%';
        for (let i = balls.length - 1; i >= 0; i--){
          const b = balls[i];
          b.x += b.vx * dt / 1000; b.y += b.vy * dt / 1000;
          b.node.style.left = b.x*100+'%'; b.node.style.top = b.y*100+'%';
          if (b.x < -.2 || b.x > 1.2 || b.y < -.2 || b.y > 1.2){ b.node.remove(); balls.splice(i,1); continue; }
          const d = Math.hypot((b.x-mx)*r.width, (b.y-my)*r.height);
          if (d < b.r + 6){ alive = false; end(age); return false; }
        }
        hud.replaceChildren(
          el('span', {}, 'alive ', el('b', { text:(age/1000).toFixed(1)+'s' })),
          el('span', {}, 'hazards ', el('b', { text:String(balls.length) }))
        );
      });
    };
    const end = (age) => {
      you.style.background = 'var(--bad)';
      zone.classList.add('shake');
      api.sfx.bad();
      const s = age/1000;
      api.finish(Math.round(s*10)/10, curve(s, 6, 60), { label:'seconds survived' });
    };
    countdown(stage, api.life, api.sfx, begin);
  }
};

export default [reaction, aim, track, dodge, clock];
