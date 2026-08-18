/**
 * Sound.
 *
 * Everything is synthesised through the site's shared audio core, so the game
 * still ships no audio files. The difference between a beep and a sound is
 * layering: a real effect is a transient (a noise click), a body (a pitched
 * voice with a pitch envelope) and a tail, stacked and slightly detuned. One
 * oscillator on its own always reads as a menu bleep no matter how it is tuned.
 *
 * `setSilent` exists so automated checks can drive the whole game without
 * anything reaching the speakers, and without touching the user's saved volume.
 */
import { tone, noise } from '../../core/audio.js';

let silent = false;
export function setSilent(v){ silent = !!v; }
export function isSilent(){ return silent; }

const T = o => { if (!silent) tone(o); };
const N = o => { if (!silent) noise(o); };
const rnd = (a, b) => a + Math.random() * (b - a);

export const sfx = {
  /* ---- weapons ---- */
  shoot(pitch = 1){
    const f = 540 * pitch * rnd(0.94, 1.07);
    N({ dur:.035, gain:.03, hp:1400, lp:7000 });
    T({ freq:f, type:'triangle', dur:.06, gain:.045, release:.07, slideTo:f * 0.34 });
    T({ freq:f * 1.5, type:'sine', dur:.03, gain:.018, release:.04, slideTo:f * 0.6 });
  },
  bigShoot(){
    N({ dur:.14, gain:.06, hp:180, lp:3400 });
    T({ freq:240, type:'sawtooth', dur:.2, gain:.1, release:.24, slideTo:62 });
    T({ freq:121, type:'square', dur:.16, gain:.05, release:.2, slideTo:40 });
  },
  hit(){
    N({ dur:.05, gain:.06, hp:500, lp:3000 });
    T({ freq:190, type:'square', dur:.045, gain:.05, release:.06, slideTo:88 });
  },
  kill(){
    T({ freq:250, type:'sawtooth', dur:.13, gain:.085, release:.17, slideTo:58 });
    N({ dur:.14, gain:.07, hp:140, lp:1900 });
    N({ dur:.04, gain:.03, hp:2600, lp:11000, when:.01 });
  },

  /* ---- the player ---- */
  hurt(){
    T({ freq:300, type:'sawtooth', dur:.16, gain:.11, release:.2, slideTo:104 });
    T({ freq:151, type:'square', dur:.12, gain:.05, release:.16, slideTo:70 });
    N({ dur:.1, gain:.055, hp:300, lp:2400 });
  },
  step(){ N({ dur:.025, gain:.012, hp:700, lp:2600 }); },
  ward(){
    T({ freq:760, type:'sine', dur:.1, gain:.07, release:.2, slideTo:1240 });
    T({ freq:1140, type:'sine', dur:.09, gain:.035, release:.22, slideTo:1860, when:.02 });
    N({ dur:.06, gain:.02, hp:3000, lp:12000 });
  },
  revive(){
    [0, .1, .2, .34].forEach((d, i) =>
      T({ freq:392 * Math.pow(2, i / 3), type:'sine', dur:.2, gain:.08, release:.4, when:d }));
    T({ freq:98, type:'triangle', dur:.5, gain:.05, release:.7 });
  },
  die(){
    [0, .16, .34, .56].forEach((d, i) =>
      T({ freq:392 - i * 74, type:'sawtooth', dur:.26, gain:.08, release:.42, when:d, slideTo:(392 - i * 74) * 0.7 }));
    T({ freq:70, type:'sine', dur:1.1, gain:.07, release:1.3, slideTo:38 });
    N({ dur:.7, gain:.03, hp:80, lp:900, when:.2 });
  },
  win(){
    [0, .13, .26, .42, .6].forEach((d, i) =>
      T({ freq:262 * Math.pow(2, [0, 4, 7, 12, 16][i] / 12), type:'triangle', dur:.24, gain:.09, release:.5, when:d }));
    T({ freq:131, type:'sine', dur:1.2, gain:.05, release:1.4 });
  },

  /* ---- pickups ---- */
  pickup(){
    T({ freq:720, type:'triangle', dur:.05, gain:.07, release:.09, slideTo:1180 });
    N({ dur:.03, gain:.02, hp:2600, lp:10000 });
  },
  coin(){
    // three detuned partials is what makes metal read as metal
    N({ dur:.02, gain:.03, hp:4000, lp:14000 });
    [1046, 1571, 2094].forEach((f, i) =>
      T({ freq:f * rnd(0.995, 1.006), type:'square', dur:.05, gain:.035 - i * 0.008, release:.13, when:i * 0.012 }));
  },
  heart(){
    T({ freq:392, type:'sine', dur:.1, gain:.09, release:.16, slideTo:588 });
    T({ freq:588, type:'sine', dur:.1, gain:.05, release:.2, slideTo:784, when:.07 });
  },
  key(){
    N({ dur:.03, gain:.03, hp:3500, lp:13000 });
    [1760, 2093].forEach((f, i) => T({ freq:f, type:'triangle', dur:.05, gain:.035, release:.12, when:i * .035 }));
  },
  unlock(){
    N({ dur:.05, gain:.04, hp:1200, lp:6000 });
    T({ freq:220, type:'square', dur:.06, gain:.05, release:.08, slideTo:150 });
    [880, 1320].forEach((f, i) => T({ freq:f, type:'triangle', dur:.08, gain:.045, release:.16, when:.05 + i * .05 }));
  },
  item(){
    [523, 659, 784, 1046].forEach((f, i) =>
      T({ freq:f, type:'sine', dur:.16, gain:.085 - i * .012, release:.34, when:i * .085 }));
    T({ freq:131, type:'triangle', dur:.4, gain:.045, release:.6 });
    N({ dur:.05, gain:.02, hp:3000, lp:12000, when:.25 });
  },
  use(){
    T({ freq:330, type:'triangle', dur:.12, gain:.08, release:.2, slideTo:880 });
    N({ dur:.05, gain:.025, hp:1800, lp:9000 });
  },
  charge(){
    T({ freq:120, type:'sawtooth', dur:.22, gain:.06, release:.24, slideTo:420 });
    N({ dur:.18, gain:.02, hp:900, lp:5200 });
  },
  charged(){
    T({ freq:880, type:'sine', dur:.08, gain:.06, release:.16, slideTo:1400 });
    T({ freq:1320, type:'sine', dur:.06, gain:.03, release:.14, slideTo:2100, when:.03 });
  },

  /* ---- the room ---- */
  door(){
    // wood dragging on stone, not a click
    N({ dur:.26, gain:.07, hp:90, lp:1000 });
    T({ freq:96, type:'sine', dur:.16, gain:.07, release:.22, slideTo:52 });
    N({ dur:.06, gain:.03, hp:1400, lp:5000, when:.16 });
  },
  locked(){
    N({ dur:.05, gain:.04, hp:600, lp:3200 });
    T({ freq:150, type:'square', dur:.06, gain:.05, release:.07, slideTo:118 });
  },
  clear(){
    [523, 784].forEach((f, i) =>
      T({ freq:f, type:'triangle', dur:.12, gain:.075, release:.24, when:i * .1 }));
    T({ freq:131, type:'sine', dur:.34, gain:.05, release:.5 });
  },
  descend(){
    [0, .1, .2, .32].forEach((d, i) =>
      T({ freq:523 - i * 88, type:'triangle', dur:.18, gain:.075, release:.3, when:d }));
    N({ dur:.5, gain:.035, hp:60, lp:800 });
    T({ freq:80, type:'sine', dur:.7, gain:.06, release:.9, slideTo:44 });
  },

  /* ---- explosives ---- */
  bomb(){
    N({ dur:.45, gain:.14, hp:40, lp:1300 });
    T({ freq:130, type:'sine', dur:.42, gain:.13, release:.55, slideTo:26 });
    N({ dur:.06, gain:.07, hp:2200, lp:13000 });
    N({ dur:.3, gain:.04, hp:600, lp:4000, when:.08 });
  },
  fuse(){ N({ dur:.035, gain:.018, hp:3200, lp:11000 }); },

  /* ---- enemies ---- */
  spit(){
    N({ dur:.04, gain:.035, hp:800, lp:5000 });
    T({ freq:300, type:'square', dur:.05, gain:.04, release:.06, slideTo:170 });
  },
  hop(){
    T({ freq:340, type:'sine', dur:.05, gain:.035, release:.06, slideTo:560 });
    N({ dur:.02, gain:.015, hp:1200, lp:6000 });
  },
  scream(){
    T({ freq:340, type:'sawtooth', dur:.3, gain:.09, release:.36, slideTo:96 });
    T({ freq:513, type:'square', dur:.26, gain:.04, release:.32, slideTo:150 });
    N({ dur:.3, gain:.05, hp:350, lp:3200 });
  },
  slam(){
    N({ dur:.3, gain:.12, hp:35, lp:800 });
    T({ freq:88, type:'sine', dur:.3, gain:.12, release:.4, slideTo:30 });
    N({ dur:.1, gain:.04, hp:1500, lp:7000, when:.02 });
  },
  spawn(){
    T({ freq:180, type:'triangle', dur:.1, gain:.055, release:.16, slideTo:420 });
    N({ dur:.08, gain:.03, hp:700, lp:4200 });
  },
  boss(){
    T({ freq:66, type:'sawtooth', dur:.9, gain:.1, release:1.1, slideTo:44 });
    T({ freq:99, type:'square', dur:.7, gain:.05, release:.9, slideTo:62, when:.05 });
    N({ dur:.9, gain:.05, hp:50, lp:700 });
    N({ dur:.2, gain:.04, hp:1200, lp:6000, when:.5 });
  },
  freeze(){
    T({ freq:1600, type:'sine', dur:.1, gain:.05, release:.24, slideTo:520 });
    N({ dur:.14, gain:.03, hp:4000, lp:15000 });
  },
  shatter(){
    N({ dur:.14, gain:.07, hp:2400, lp:14000 });
    [1900, 2600, 3300].forEach((f, i) =>
      T({ freq:f, type:'triangle', dur:.05, gain:.025, release:.1, when:i * .02 }));
  }
};
