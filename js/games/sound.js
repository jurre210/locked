import { el, clamp, rnd, irnd, pick, sample, shuffle, dayKey, seededSample } from '../core/ui.js';
import { MELODIES } from '../data/melodies.js';
import { CHARTS } from '../data/charts.js';

const curve = (v, worst, best) => clamp((v - worst) / (best - worst), 0, 1);

/* =================================================================== */
/* songless — name the tune from a very short clip                     */
/* =================================================================== */
const STEPS = [1, 2, 4, 7, 11, 16];
const TOTAL = STEPS[STEPS.length - 1];

const songless = {
  key:'songless', name:'songless', cat:'sound', family:'song',
  blurb:'One second of a tune. Name it. Get it wrong and you earn another second.',
  rule:'Five tunes. Each starts with one second of audio — every miss or skip unlocks more of it. Six tries each.',
  unit:'pts', higherBetter:true,
  mount(stage, api){
    let library = MELODIES.map(m => ({ ...m, kind:'synth' }));
    // What you can type in the box. In charts mode only five songs are ever
    // fetched, but you must be able to guess from the whole catalogue.
    let searchPool = library;
    let round = 0, points = 0, solved = 0, firstTries = 0;
    let picks = [];
    let handle = null;
    let mode = 'melodies';

    // Seeded off the calendar date, so the five change once a day and are the
    // same five for everyone until midnight. `nonce` reshuffles for replays.
    let nonce = 0;
    const setup = () => {
      picks = mode === 'files'
        ? sample(library, Math.min(5, library.length))
        : seededSample(library, Math.min(5, library.length), dayKey() + nonce * 7919);
      round = 0; points = 0; solved = 0; firstTries = 0;
      next();
    };
    const next = () => { if (round >= picks.length) return end(); play(picks[round]); };

    const play = (song) => {
      let step = 0, over = false;
      const rows = [];                       // one per try, filled as you go
      const unlocked = () => STEPS[Math.min(step, STEPS.length - 1)];

      /* --- guess rows --- */
      const guesses = el('div', { class:'guesses' });
      for (let i = 0; i < STEPS.length; i++){
        const r = el('div', { class:'guess empty', text:'·' });
        rows.push(r); guesses.append(r);
      }
      const paintRows = () => rows.forEach((r, i) => {
        if (i === step && !over) r.classList.add('now'); else r.classList.remove('now');
      });

      /* --- segmented unlock bar --- */
      const segs = el('div', { class:'sl-seg' });
      const fills = [];
      STEPS.forEach((s, i) => {
        const width = ((s - (STEPS[i-1] || 0)) / TOTAL) * 100;
        const f = el('i');
        const seg = el('span', { style:{ flex:`0 0 ${width}%` } }, f);
        fills.push({ seg, f, from: STEPS[i-1] || 0, to: s });
        segs.append(seg);
      });
      const head = el('div', { class:'sl-head', text:'0.0 seconds' });
      const ticks = el('div', { class:'sl-ticks' },
        STEPS.map((s, i) => el('span', { style:{ flex:`0 0 ${((s - (STEPS[i-1]||0)) / TOTAL) * 100}%` }, text:s + 's' })));
      const track = el('div', { class:'sl-track' }, head, segs, ticks);

      const paintBar = (played = 0) => {
        fills.forEach(({ seg, f, from, to }) => {
          seg.classList.toggle('open', to <= unlocked());
          const within = Math.min(Math.max(played - from, 0), to - from);
          f.style.width = (within / (to - from)) * 100 + '%';
        });
        head.style.left = (played / TOTAL) * 100 + '%';
        head.textContent = played.toFixed(1) + ' seconds';
      };

      /* --- transport --- */
      const playBtn = el('button', { class:'sl-play', title:'play', html:'&#9654;' });
      const stopAudio = () => { handle?.stop(); handle = null; playBtn.classList.remove('playing'); };

      const hear = (secs = unlocked()) => {
        stopAudio();
        handle = song.kind === 'buffer'
          ? api.audio.playBuffer(song.buffer, { from: song.offset || 0, until: (song.offset || 0) + secs })
          : song.kind === 'url'
            ? api.audio.playUrl(song.url, { from: song.offset || 0, until: (song.offset || 0) + secs })
            : api.audio.playMelody(song.notes, { bpm: song.bpm, from: 0, until: secs });
        playBtn.classList.add('playing');
        const t0 = performance.now();
        api.life.frame(() => {
          const p = (performance.now() - t0) / 1000;
          if (p >= secs){ paintBar(secs); playBtn.classList.remove('playing'); return false; }
          paintBar(p);
        });
      };
      playBtn.onclick = () => hear();

      /* --- search + autocomplete --- */
      const inp = el('input', { type:'text', placeholder:'Search a tune', autocomplete:'off', spellcheck:'false' });
      const sug = el('div', { class:'suggest', hidden:true });
      const search = el('div', { class:'sl-search' }, inp, sug);
      const skipBtn = el('button', { class:'sl-skip' });
      const paintSkip = () => {
        const gain = STEPS[Math.min(step + 1, STEPS.length - 1)] - STEPS[step];
        skipBtn.textContent = step >= STEPS.length - 1 ? 'Give up' : `Skip (+${gain}s)`;
      };

      let sel = -1, matches = [];
      const paintSug = () => [...sug.children].forEach((c, i) => c.classList.toggle('on', i === sel));
      const refresh = () => {
        const q = inp.value.trim().toLowerCase();
        matches = !q ? [] : searchPool
          .filter(m => m.title.toLowerCase().includes(q) || (m.by || '').toLowerCase().includes(q))
          .slice(0, 8);
        sel = matches.length ? 0 : -1;
        sug.replaceChildren(...matches.map((m, i) => {
          const b = el('button', { class: i === sel ? 'on' : '', text: m.title + (m.by ? ' — ' + m.by : '') });
          b.onmousedown = e => { e.preventDefault(); submit(m); };
          return b;
        }));
        sug.hidden = !matches.length;
      };
      inp.oninput = refresh;
      inp.onblur = () => api.life.after(() => { sug.hidden = true; }, 120);
      api.life.on(inp, 'keydown', e => {
        if (e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(sel + 1, matches.length - 1); paintSug(); }
        else if (e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(sel - 1, 0); paintSug(); }
        else if (e.key === 'Enter'){ e.preventDefault(); if (matches[sel]) submit(matches[sel]); }
      });

      /* --- flow --- */
      const hud = el('div', { class:'hud' });
      const paintHud = () => hud.replaceChildren(
        el('span', {}, 'tune ', el('b', { text:`${round + 1}/${picks.length}` })),
        el('span', {}, 'points ', el('b', { text:String(points) })),
        el('span', {}, 'tries left ', el('b', { text:String(STEPS.length - step) }))
      );

      const advance = (text, cls) => {
        rows[step].className = 'guess ' + cls;
        rows[step].textContent = text;
        step++;
        if (step >= STEPS.length) return reveal(false);
        inp.value = ''; sug.hidden = true; matches = [];
        paintRows(); paintSkip(); paintHud(); paintBar(0);
        api.sfx.miss();
        hear();
      };

      const submit = (m) => {
        if (over) return;
        if (m.id === song.id){
          over = true;
          const gained = STEPS.length - step;
          points += gained; solved++;
          if (step === 0) firstTries++;
          rows[step].className = 'guess yes';
          rows[step].textContent = m.title;
          api.sfx.great();
          reveal(true, gained);
        } else advance(m.title, 'no');
      };
      skipBtn.onclick = () => { if (!over) advance('skipped', 'skip'); };

      const reveal = (won, gained = 0) => {
        over = true; stopAudio(); paintRows();
        handle = song.kind === 'buffer'
          ? api.audio.playBuffer(song.buffer, { from: song.offset || 0, until: (song.offset || 0) + 14 })
          : song.kind === 'url'
            ? api.audio.playUrl(song.url, { from: song.offset || 0, until: (song.offset || 0) + 20 })
            : api.audio.playMelody(song.notes, { bpm: song.bpm });
        const cont = el('button', { class:'btn', text: round + 1 >= picks.length ? 'see the damage' : 'next tune' });
        cont.onclick = () => { stopAudio(); round++; next(); };
        stage.replaceChildren(
          hud,
          el('div', { class:'mid', style:{ color: won ? 'var(--good)' : 'var(--bad)' }, text: won ? `+${gained}` : 'nobody got that one' }),
          el('div', { style:{ fontSize:'clamp(26px,5vw,54px)', fontWeight:500, letterSpacing:'-.04em', textAlign:'center' }, text: song.title }),
          el('div', { class:'hint', text:(song.by ? song.by + ' · ' : '') + (won ? `solved in ${step + 1} ${step === 0 ? 'try' : 'tries'}` : 'the full tune is playing now') }),
          guesses, cont
        );
        api.life.on(window, 'keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); cont.click(); } });
      };

      paintHud(); paintRows(); paintSkip(); paintBar(0);
      stage.replaceChildren(hud, el('div', { class:'sl' },
        guesses, track, playBtn,
        el('div', { class:'sl-bottom' }, search, skipBtn),
        step === STEPS.length - 1 ? el('div', { class:'hint', text:song.hint }) : null
      ));
      inp.focus();
      hear();
    };

    const end = () => {
      const max = picks.length * STEPS.length;
      api.finish(points, curve(points / max, .12, .90), { label:`points of ${max}`,
        breakdown:[['solved', `${solved}/${picks.length}`], ['first try', String(firstTries)]] });
    };

    /* --- optional: play with your own audio files, entirely locally --- */
    const fileInput = el('input', { type:'file', accept:'audio/*', multiple:true, style:{ display:'none' } });
    fileInput.onchange = async () => {
      const files = [...fileInput.files].filter(f => f.type.startsWith('audio'));
      if (files.length < 4) return alert('Pick at least 4 audio files.');
      stage.replaceChildren(el('div', { class:'mid', text:'decoding…' }));
      const out = [];
      for (const f of files.slice(0, 60)){
        try {
          const buf = await api.audio.decode(await f.arrayBuffer());
          const title = f.name.replace(/\.[^.]+$/,'').replace(/^\d+[\s._-]+/,'').replace(/_+/g,' ').trim();
          out.push({ id:'f'+out.length, title, by:'your library', kind:'buffer', buffer:buf,
            offset: Math.min(Math.max(0, buf.duration * 0.28), Math.max(0, buf.duration - 18)),
            hint:'From your own files.' });
        } catch(e){ /* skip undecodable */ }
      }
      if (out.length < 4){ alert('Could not decode enough of those.'); return menu(); }
      mode = 'files';
      library = out;
      searchPool = out;
      setup();
    };

    /* --- charts: real, well-known songs, streamed as official previews --- */
    const lookup = async (song) => {
      const term = encodeURIComponent(`${song.title} ${song.by}`);
      const r = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=6`);
      const j = await r.json();
      const hit = (j.results || []).find(x => x.previewUrl);
      return hit ? { ...song, kind:'url', url:hit.previewUrl, offset:0,
                     hint:`${song.by}. The preview is a 30-second clip from the middle of the track.` } : null;
    };

    const loadCharts = async () => {
      mode = 'charts';
      stage.replaceChildren(el('div', { class:'mid', text:'finding today\'s songs…' }),
        el('div', { class:'hint', text:'Looking up previews. This is the one mode that needs a connection.' }));
      // Ask for more than five so failed lookups do not shrink the round.
      const shortlist = seededSample(CHARTS, 9, dayKey() + nonce * 7919);
      const found = [];
      for (const s of shortlist){
        if (found.length >= 5) break;
        try { const hit = await lookup(s); if (hit) found.push(hit); } catch(e){ /* skip */ }
      }
      if (found.length < 3){
        stage.replaceChildren(
          el('div', { class:'mid', text:'could not reach the preview service' }),
          el('div', { class:'hint', text:'The charts mode needs a working connection to Apple\'s public search API. The melody bank works offline.' }),
          el('button', { class:'btn', text:'back', onclick: menu })
        );
        return;
      }
      found.slice(1).forEach(s => api.audio.prefetch(s.url));
      library = found;
      searchPool = CHARTS;          // guess from all of them, not just the five
      picks = found.slice(0, 5);
      round = 0; points = 0; solved = 0; firstTries = 0;
      api.sfx.start();
      next();
    };

    const menu = () => {
      mode = 'melodies';
      const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long' });
      stage.replaceChildren(
        el('div', { class:'mid', text:'songless' }),
        el('div', { class:'hint', text:`Five songs a day, swapping over at midnight. Today is ${today}.` }),
        el('div', { style:{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center', marginTop:'6px' } },
          el('button', { class:'btn', text:`charts · ${CHARTS.length} songs`, onclick: loadCharts }),
          el('button', { class:'btn ghost', text:`melodies · ${MELODIES.length}`, onclick(){ mode = 'melodies'; library = MELODIES.map(m => ({ ...m, kind:'synth' })); searchPool = library; api.sfx.start(); setup(); } }),
          el('button', { class:'btn ghost', text:'my own files', onclick(){ mode = 'files'; fileInput.click(); } })
        ),
        el('div', { class:'hint', style:{ opacity:.65, maxWidth:'52ch' },
          text:'Charts plays the official 30-second previews from Apple\'s public search API — needs a connection. Melodies are synthesised in your browser and work offline. Your own files never leave the page.' }),
        el('button', { class:'tbtn', style:{ marginTop:'4px' }, text:'shuffle to a different set', onclick(){ nonce++; api.sfx.click(); menu(); } }),
        fileInput
      );
    };
    menu();
  }
};

/* =================================================================== */
/* pitch — how small an interval can you hear                          */
/* =================================================================== */
const pitch = {
  key:'pitch', name:'pitch', cat:'sound', family:'sound',
  blurb:'Two tones. Was the second one higher or lower? They get closer together.',
  rule:'Say whether the second tone is higher or lower. Correct answers narrow the gap; mistakes widen it. Ends after five reversals.',
  unit:'cents', higherBetter:false,
  mount(stage, api){
    let cents = 120, base = 440, dir = 1, reversals = [], lastWrong = null, trial = 0, busy = false;
    const hud = el('div', { class:'hud' });
    const up = el('button', { class:'btn', text:'higher ↑' });
    const down = el('button', { class:'btn', text:'lower ↓' });
    const again = el('button', { class:'btn ghost', text:'hear it again' });
    const hint = el('div', { class:'hint', text:'listen' });

    const paint = () => hud.replaceChildren(
      el('span', {}, 'trial ', el('b', { text:String(trial) })),
      el('span', {}, 'gap ', el('b', { text: Math.round(cents) + '¢' })),
      el('span', {}, 'reversals ', el('b', { text:`${reversals.length}/5` }))
    );

    const present = () => {
      busy = true;
      base = rnd(320, 620);
      dir = Math.random() < .5 ? 1 : -1;
      const f2 = base * Math.pow(2, (dir * cents) / 1200);
      api.audio.tone({ freq: base, type:'sine', dur:.42, gain:.16, release:.42 });
      api.audio.tone({ freq: f2, type:'sine', dur:.42, gain:.16, release:.42, when:.62 });
      api.life.after(() => { busy = false; hint.textContent = 'higher or lower?'; }, 1080);
      hint.textContent = 'listen';
      trial++; paint();
    };

    const answer = (guessUp) => {
      if (busy) return;
      const right = (guessUp && dir > 0) || (!guessUp && dir < 0);
      if (right){
        api.sfx.good();
        if (lastWrong === true) reversals.push(cents);
        lastWrong = false;
        cents = Math.max(1, cents * 0.72);
      } else {
        api.sfx.bad();
        if (lastWrong === false) reversals.push(cents);
        lastWrong = true;
        cents = Math.min(600, cents * 1.6);
      }
      if (reversals.length >= 5) return end();
      api.life.after(present, 420);
      paint();
    };

    up.onclick = () => answer(true);
    down.onclick = () => answer(false);
    again.onclick = () => {
      if (busy) return;
      const f2 = base * Math.pow(2, (dir * cents) / 1200);
      api.audio.tone({ freq: base, type:'sine', dur:.42, gain:.16, release:.42 });
      api.audio.tone({ freq: f2, type:'sine', dur:.42, gain:.16, release:.42, when:.62 });
    };
    api.life.on(window, 'keydown', e => {
      if (e.key === 'ArrowUp'){ e.preventDefault(); answer(true); }
      if (e.key === 'ArrowDown'){ e.preventDefault(); answer(false); }
      if (e.key === ' '){ e.preventDefault(); again.click(); }
    });

    const end = () => {
      const thr = reversals.slice(-4).reduce((a,b)=>a+b,0) / Math.min(4, reversals.length);
      const semis = thr / 100;
      api.finish(Math.round(thr), curve(thr, 90, 6), { label:'smallest gap heard', higherBetter:false,
        breakdown:[['in semitones', semis.toFixed(2)], ['trials', String(trial)]] });
    };

    stage.replaceChildren(hud, hint,
      el('div', { style:{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' } }, up, down),
      again,
      el('div', { class:'hint', html:'<span class="kbd">↑</span> higher · <span class="kbd">↓</span> lower · <span class="kbd">space</span> replay' }));
    paint();
    api.life.after(present, 500);
  }
};

/* =================================================================== */
/* tempo — guess the bpm                                               */
/* =================================================================== */
const tempo = {
  key:'tempo', name:'tempo', cat:'sound', family:'sound',
  blurb:'A beat plays. Put a number on it. Five rounds.',
  rule:'Listen to the click track and set the slider to the tempo you think it is. Five rounds, averaged.',
  unit:'%', higherBetter:true,
  mount(stage, api){
    const N = 5; let i = 0; const errs = []; let loop = null, bpm = 100;
    const startLoop = () => {
      stopLoop();
      let beat = 0;
      const fire = () => { api.sfx.metro(beat % 4 === 0); beat++; };
      fire();
      loop = api.life.every(fire, 60000 / bpm);
    };
    const stopLoop = () => { if (loop){ api.life.clear(loop); loop = null; } };

    const round = () => {
      if (i >= N) return end();
      bpm = irnd(56, 184);
      let guess = 120;
      const val = el('div', { class:'big', text:'120' });
      const sl = el('input', { class:'slider', type:'range', min:40, max:220, value:120, style:{ width:'min(520px,88vw)' } });
      sl.oninput = () => { guess = +sl.value; val.textContent = String(guess); };
      const go = el('button', { class:'btn', text:'lock it in' });
      go.onclick = () => {
        stopLoop();
        const err = Math.abs(guess - bpm) / bpm;
        errs.push(err); i++;
        err < .04 ? api.sfx.good() : err < .12 ? api.sfx.click() : api.sfx.miss();
        stage.replaceChildren(
          el('div', { class:'big', text:String(bpm) }),
          el('div', { class:'hint', text:`you said ${guess} — ${Math.round(err*100)}% off` })
        );
        api.life.after(round, 950);
      };
      stage.replaceChildren(
        el('div', { class:'hud' }, 'round ', el('b', { text:`${i+1}/${N}` })),
        val,
        el('div', { class:'hint', text:'beats per minute' }),
        sl, go
      );
      startLoop();
      api.life.on(window, 'keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); go.click(); } });
    };
    const end = () => {
      const avg = errs.reduce((a,b)=>a+b,0)/errs.length;
      const acc = (1 - avg) * 100;
      api.finish(Math.round(acc*10)/10, curve(acc, 78, 98.5), { label:'accuracy %' });
    };
    round();
  }
};

/* =================================================================== */
/* rhythm — keep the beat after the click track stops                  */
/* =================================================================== */
const rhythm = {
  key:'rhythm', name:'rhythm', cat:'sound', family:'sound',
  blurb:'Four beats of a click track, then silence. Keep it going for eight more.',
  rule:'Tap on the beat. The metronome cuts out after four — your job is to stay exactly where it would have been.',
  unit:'ms', higherBetter:false,
  mount(stage, api){
    const bpm = irnd(72, 128);
    const period = 60000 / bpm;
    const LEAD = 4, TAPS = 8;
    let t0 = 0, taps = [], started = false;
    const big = el('div', { class:'big', text:'—' });
    const hint = el('div', { class:'hint', text:'listen to four, then take over' });
    const dots = el('div', { class:'dots' }, Array.from({length:TAPS}, () => el('div', { class:'dot' })));

    const begin = () => {
      started = true;
      t0 = performance.now();
      for (let i = 0; i < LEAD; i++) api.life.after(() => {
        api.sfx.metro(i === 0);
        big.textContent = String(LEAD - i);
      }, i * period);
      api.life.after(() => { big.textContent = 'you'; hint.textContent = 'keep it going — eight taps'; }, LEAD * period);
    };

    const tap = () => {
      if (!started) return;
      const now = performance.now();
      const beat = (now - t0) / period;
      if (beat < LEAD - 0.5) return; // still the lead-in
      const n = taps.length;
      const ideal = LEAD + n;
      const offBeats = beat - ideal;
      // accept the nearest beat if they drift a whole beat
      const off = (offBeats - Math.round(offBeats - 0) * 0) * period;
      const err = (beat - Math.round(beat)) * period;
      taps.push(Math.abs(err));
      api.sfx.metro(false);
      const d = dots.children[Math.min(n, TAPS-1)];
      d.className = 'dot ' + (Math.abs(err) < 45 ? 'hit' : Math.abs(err) < 100 ? 'on' : 'miss');
      big.textContent = (err >= 0 ? '+' : '−') + Math.round(Math.abs(err)) + 'ms';
      if (taps.length >= TAPS) api.life.after(end, 500);
    };

    const end = () => {
      const avg = taps.reduce((a,b)=>a+b,0) / taps.length;
      api.finish(Math.round(avg), curve(avg, 130, 14), { label:'average drift', higherBetter:false,
        breakdown:[['tempo was', bpm + ' bpm'], ['best tap', Math.round(Math.min(...taps)) + 'ms']] });
    };

    api.life.on(window, 'keydown', e => { if (e.code === 'Space'){ e.preventDefault(); tap(); } });
    const zone = el('div', { class:'zone', style:{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px', cursor:'pointer', minHeight:'min(260px,36vh)' } }, big, hint, dots);
    api.life.on(zone, 'pointerdown', tap);
    stage.replaceChildren(
      el('div', { class:'hud' }, 'tempo ', el('b', { text:'hidden' })),
      zone,
      el('div', { class:'hint', html:'click the box or hit <span class="kbd">space</span>' })
    );
    api.life.after(begin, 900);
  }
};

export default [songless, pitch, tempo, rhythm];
