// Modes built out of the other games. Registered last so they close off the grid.
import { el, shuffle } from '../core/ui.js';

/** Deterministic PRNG so `daily` is the same run for the same date. */
function seeded(seed){
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const dayKey = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate(); };

/**
 * Runs several games back to back and averages their quality.
 * Sub-games get a proxied api whose finish() feeds this instead of the result screen.
 */
function runSeries({ stage, api, games, title, blurb, onDone, seedRandom = null }){
  let i = 0;
  const results = [];
  let restore = null;

  if (seedRandom){
    const rng = seeded(seedRandom);
    const real = Math.random;
    Math.random = rng;
    restore = () => { Math.random = real; };
    api.life.offs.push(restore);
  }

  const intro = () => {
    stage.replaceChildren(
      el('div', { class:'hud' }, 'game ', el('b', { text:`${i + 1}/${games.length}` })),
      el('div', { style:{ fontSize:'clamp(38px,7vw,80px)', fontWeight:500, letterSpacing:'-.05em' }, text: games[i].name }),
      el('div', { class:'hint', text: games[i].rule }),
      el('button', { class:'btn', text:'start', onclick: launch })
    );
    api.life.on(window, 'keydown', e => {
      if (e.key === 'Enter' || e.code === 'Space'){ e.preventDefault(); const b = stage.querySelector('.btn'); if (b) b.click(); }
    });
  };

  const launch = () => {
    const g = games[i];
    const sub = {
      ...api,
      finish(value, q, opts = {}){
        results.push({ game: g, value, q, unit: opts.label || g.unit });
        api.sfx.click();
        i++;
        if (i >= games.length) return finishAll();
        api.life.after(intro, 320);
      },
      setRule(){}
    };
    stage.replaceChildren();
    g.mount(stage, sub);
  };

  const finishAll = () => {
    restore?.();
    const mean = results.reduce((s, r) => s + r.q, 0) / results.length;
    onDone(mean, results);
  };

  stage.replaceChildren(
    el('div', { style:{ fontSize:'clamp(30px,5vw,54px)', fontWeight:500, letterSpacing:'-.04em' }, text:title }),
    el('div', { class:'hint', text:blurb }),
    el('div', { class:'pill-row' }, games.map(g => el('span', { class:'pill', text:g.name }))),
    el('button', { class:'btn', text:'begin', onclick: intro })
  );
}

/** Built once main.js knows the full game list. */
export function makeMeta(ALL){
  const playable = ALL.filter(g => g.cat !== 'gauntlet');

  const gauntlet = {
    key:'gauntlet', name:'gauntlet', cat:'gauntlet', family:'mind', special:true,
    blurb:'Five random games, back to back, one combined rating. No warm-up.',
    rule:'Five games drawn at random. Every score folds into a single number at the end.',
    unit:'/100', higherBetter:true,
    mount(stage, api){
      const games = shuffle(playable).slice(0, 5);
      runSeries({
        stage, api, games,
        title:'gauntlet',
        blurb:'Five games, drawn fresh every time. One score at the end, and nowhere to hide.',
        onDone(mean, results){
          api.finish(Math.round(mean * 100), mean, { label:'combined rating',
            breakdown: results.map(r => [r.game.name, Math.round(r.q * 100) + '']) });
        }
      });
    }
  };

  const daily = {
    key:'daily', name:'daily', cat:'gauntlet', family:'mind', special:true,
    blurb:'Three games chosen by the date. Identical for everyone, until midnight.',
    rule:'Today\'s three games, with today\'s exact colours, numbers and tunes. Same for every player, every time.',
    unit:'/100', higherBetter:true,
    mount(stage, api){
      const key = dayKey();
      const rng = seeded(key);
      const order = playable.map(g => ({ g, r: rng() })).sort((a, b) => a.r - b.r).map(x => x.g);
      const games = order.slice(0, 3);
      const d = new Date();
      runSeries({
        stage, api, games, seedRandom: key,
        title: d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' }),
        blurb:'Three games picked by today\'s date, seeded so everyone gets the identical run. Resets at midnight.',
        onDone(mean, results){
          api.finish(Math.round(mean * 100), mean, { label:'today\'s rating',
            breakdown: results.map(r => [r.game.name, Math.round(r.q * 100) + '']) });
        }
      });
    }
  };

  return [gauntlet, daily];
}
