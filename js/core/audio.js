// Procedural audio. No files, no network — everything is synthesised.
let ctx = null;
let master = null;
let enabled = localStorage.getItem('locked.sound') !== '0';
// Streamed previews were mastered far louder than the synth, so the default
// sits well below full scale and everything is scaled against it.
let volume = (() => {
  const v = parseFloat(localStorage.getItem('locked.volume'));
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.55;
})();

function ac(){
  if (!ctx){
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function getVolume(){ return volume; }
export function setVolume(v){
  volume = Math.max(0, Math.min(1, v));
  localStorage.setItem('locked.volume', String(volume));
  if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  liveEls.forEach(a => { try { a.volume = volume; } catch(e){} });
  return volume;
}
// <audio> elements bypass the Web Audio graph, so they are tracked and set directly
const liveEls = new Set();

export function unlock(){ try { ac(); } catch(e){} }
export function isOn(){ return enabled; }
export function setOn(v){ enabled = v; localStorage.setItem('locked.sound', v ? '1' : '0'); }
export function toggle(){ setOn(!enabled); return enabled; }

/** One synth voice. */
export function tone(opts = {}){
  if (!enabled) return;
  const c = ac();
  const {
    freq = 440, type = 'sine', dur = 0.18,
    gain = 0.18, when = 0, attack = 0.006, release = null,
    detune = 0, slideTo = null, pan = 0
  } = opts;
  const t0 = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.detune.value = detune;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  const rel = release ?? dur;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + rel);
  let node = g;
  if (pan && c.createStereoPanner){
    const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p;
  }
  o.connect(g); node.connect(master);
  o.start(t0); o.stop(t0 + attack + rel + 0.05);
  return o;
}

export function noise(opts = {}){
  if (!enabled) return;
  const c = ac();
  const { dur = 0.12, gain = 0.12, when = 0, hp = 300, lp = 6000 } = opts;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f1 = c.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp;
  const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f1); f1.connect(f2); f2.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

/* ------------------------------------------------------------------ */
/* sfx vocabulary — kept dry, short and non-cute                       */
/* ------------------------------------------------------------------ */
export const sfx = {
  tick(){ tone({ freq: 1300, type:'square', dur:.02, gain:.035, release:.03 }); },
  click(){ tone({ freq: 620, type:'triangle', dur:.035, gain:.09, release:.05 }); },
  hover(){ tone({ freq: 1800, type:'sine', dur:.015, gain:.02, release:.02 }); },
  step(i = 0){ tone({ freq: 300 + i * 55, type:'triangle', dur:.06, gain:.11, release:.09 }); },
  good(){
    tone({ freq: 784, type:'sine', dur:.07, gain:.12, release:.10 });
    tone({ freq: 1175, type:'sine', dur:.09, gain:.09, release:.18, when:.055 });
  },
  great(){
    [523.25, 659.25, 784, 1046.5].forEach((f, i) =>
      tone({ freq: f, type:'sine', dur:.08, gain:.11, release:.22, when: i * .062 }));
  },
  perfect(){
    [523.25, 659.25, 784, 1046.5, 1318.5].forEach((f, i) =>
      tone({ freq: f, type:'triangle', dur:.07, gain:.10, release:.34, when: i * .052 }));
    tone({ freq: 2093, type:'sine', dur:.6, gain:.05, release:.9, when:.30 });
  },
  bad(){
    tone({ freq: 174, type:'sawtooth', dur:.16, gain:.10, release:.16, slideTo:98 });
    noise({ dur:.09, gain:.05, hp:120, lp:1400 });
  },
  miss(){ tone({ freq: 220, type:'square', dur:.05, gain:.06, release:.07, slideTo:150 }); },
  start(){
    tone({ freq: 392, type:'sine', dur:.06, gain:.10, release:.09 });
    tone({ freq: 587.33, type:'sine', dur:.08, gain:.09, release:.14, when:.07 });
  },
  over(){
    tone({ freq: 392, type:'sine', dur:.12, gain:.10, release:.2 });
    tone({ freq: 311.1, type:'sine', dur:.14, gain:.09, release:.28, when:.11 });
    tone({ freq: 233.1, type:'sine', dur:.2, gain:.08, release:.5, when:.24 });
  },
  metro(strong = false){
    tone({ freq: strong ? 1600 : 1050, type:'square', dur:.018, gain: strong ? .10 : .055, release:.03 });
  },
  whoosh(){ noise({ dur:.22, gain:.05, hp:400, lp:3000 }); }
};

/* ------------------------------------------------------------------ */
/* melody engine — used by songless / pitch / rhythm                   */
/* ------------------------------------------------------------------ */
const SEMI = { c:0, 'c#':1, db:1, d:2, 'd#':3, eb:3, e:4, f:5, 'f#':6, gb:6, g:7, 'g#':8, ab:8, a:9, 'a#':10, bb:10, b:11 };

/** "a#4" | "f4" | "-" (rest) -> Hz (0 for rest) */
export function noteFreq(name){
  if (!name || name === '-') return 0;
  const m = /^([a-g][#b]?)(-?\d)$/i.exec(name.trim().toLowerCase());
  if (!m) return 0;
  const n = SEMI[m[1]];
  const oct = parseInt(m[2], 10);
  return 440 * Math.pow(2, (n - 9) / 12 + (oct - 4));
}

/**
 * Plays a melody. `notes` is "e5:1 d#5:1 e5:2" — name:beats, "-" is a rest.
 * Returns a handle with .stop() and .duration (seconds).
 */
export function playMelody(notes, { bpm = 110, gain = 0.16, from = 0, until = Infinity, bass = true, voice = 'triangle' } = {}){
  const c = ac();
  const beat = 60 / bpm;
  const parts = (typeof notes === 'string' ? notes.trim().split(/\s+/) : notes).map(tok => {
    const [n, b] = String(tok).split(':');
    return { n, beats: parseFloat(b || 1) };
  });
  const stops = [];
  let t = 0, total = 0;
  const t0 = c.currentTime + 0.06;
  let bassIdx = 0;
  for (const p of parts){
    const dur = p.beats * beat;
    const f = noteFreq(p.n);
    if (f && t + dur > from && t < until && enabled){
      const start = t0 + Math.max(0, t - from);
      const len = Math.min(dur, until - t) * 0.94;
      // plucked lead: two detuned voices + a soft sine body
      for (const [ty, dt, g] of [[voice, -6, gain], ['sine', 6, gain * .55]]){
        const o = c.createOscillator(); const gg = c.createGain();
        o.type = ty; o.frequency.value = f; o.detune.value = dt;
        gg.gain.setValueAtTime(0.0001, start);
        gg.gain.exponentialRampToValueAtTime(g, start + 0.012);
        gg.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(.08, len));
        o.connect(gg); gg.connect(master);
        o.start(start); o.stop(start + Math.max(.1, len) + .05);
        stops.push(o);
      }
      // simple root-ish bass pulse every 2 beats
      if (bass && bassIdx % 2 === 0){
        const o = c.createOscillator(); const gg = c.createGain();
        o.type = 'sine'; o.frequency.value = f / 4;
        gg.gain.setValueAtTime(0.0001, start);
        gg.gain.exponentialRampToValueAtTime(gain * .5, start + .02);
        gg.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(.2, len * 1.4));
        o.connect(gg); gg.connect(master);
        o.start(start); o.stop(start + Math.max(.25, len * 1.5) + .05);
        stops.push(o);
      }
      bassIdx++;
    }
    t += dur; total = t;
  }
  return {
    duration: total,
    stop(){ stops.forEach(o => { try { o.stop(); } catch(e){} }); }
  };
}

export function melodyDuration(notes, bpm = 110){
  const beat = 60 / bpm;
  const parts = (typeof notes === 'string' ? notes.trim().split(/\s+/) : notes);
  return parts.reduce((s, tok) => s + parseFloat(String(tok).split(':')[1] || 1), 0) * beat;
}

/** Raw audio-file playback (for the "use my own music" mode). */
export function playBuffer(buffer, { from = 0, until = 3, gain = 0.9 } = {}){
  if (!enabled) return { stop(){} };
  const c = ac();
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.03);
  src.connect(g); g.connect(master);
  src.start(0, from, Math.max(0.1, until - from));
  return { stop(){ try { src.stop(); } catch(e){} } };
}

export async function decode(arrayBuffer){
  return await ac().decodeAudioData(arrayBuffer);
}

/**
 * Streams a remote clip through an <audio> element (no CORS needed, unlike
 * decodeAudioData). Used for the charts mode's preview URLs.
 */
export function playUrl(url, { from = 0, until = 3, gain = 1 } = {}){
  if (!enabled) return { stop(){} };
  const a = new Audio();
  a.crossOrigin = 'anonymous';
  a.preload = 'auto';
  a.volume = Math.max(0, Math.min(1, gain * volume));
  a.src = url;
  liveEls.add(a);
  let stopper = null;
  const begin = () => {
    try { a.currentTime = from; } catch(e){}
    a.play().catch(() => {});
    stopper = setTimeout(() => { a.pause(); }, Math.max(120, (until - from) * 1000));
  };
  if (a.readyState >= 1) begin();
  else a.addEventListener('loadedmetadata', begin, { once:true });
  return {
    el: a,
    stop(){ clearTimeout(stopper); try { a.pause(); } catch(e){} liveEls.delete(a); }
  };
}

/** Warms the network cache so the first play is not a stutter. */
export function prefetch(url){
  try { const a = new Audio(); a.preload = 'auto'; a.src = url; return a; } catch(e){ return null; }
}
