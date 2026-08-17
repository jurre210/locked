/**
 * Sound. Everything is synthesised through the site's shared audio core, so
 * this game ships no audio files and still respects the global mute.
 */
import { tone, noise } from '../../core/audio.js';

export const sfx = {
  shoot(pitch = 1){ tone({ freq: 620 * pitch, type:'triangle', dur:.03, gain:.05, release:.05, slideTo: 380 * pitch }); },
  bigShoot(){ tone({ freq: 300, type:'sawtooth', dur:.1, gain:.09, release:.14, slideTo:120 }); },
  hit(){ noise({ dur:.05, gain:.05, hp:900, lp:5200 }); },
  kill(){ tone({ freq: 190, type:'square', dur:.07, gain:.07, release:.12, slideTo:70 }); noise({ dur:.09, gain:.05, hp:300, lp:2600 }); },
  hurt(){ tone({ freq: 240, type:'sawtooth', dur:.1, gain:.1, release:.16, slideTo:90 }); },
  pickup(){ tone({ freq: 880, type:'triangle', dur:.05, gain:.08, release:.09, slideTo:1320 }); },
  coin(){ tone({ freq: 1240, type:'square', dur:.03, gain:.05, release:.06 }); tone({ freq: 1660, type:'square', dur:.03, gain:.04, release:.08, when:.04 }); },
  heart(){ tone({ freq: 520, type:'sine', dur:.09, gain:.09, release:.12, slideTo:780 }); },
  key(){ tone({ freq: 1500, type:'triangle', dur:.04, gain:.05, release:.08 }); },
  door(){ noise({ dur:.16, gain:.05, hp:200, lp:1400 }); tone({ freq:120, type:'sine', dur:.1, gain:.06, release:.14 }); },
  locked(){ tone({ freq: 180, type:'square', dur:.05, gain:.05, release:.05 }); },
  clear(){ tone({ freq: 660, type:'triangle', dur:.08, gain:.08, release:.14 }); tone({ freq: 990, type:'triangle', dur:.1, gain:.07, release:.2, when:.09 }); },
  bomb(){ noise({ dur:.32, gain:.13, hp:60, lp:1800 }); tone({ freq: 90, type:'sine', dur:.22, gain:.12, release:.34, slideTo:30 }); },
  fuse(){ noise({ dur:.04, gain:.02, hp:2600, lp:9000 }); },
  charge(){ tone({ freq: 160, type:'sawtooth', dur:.16, gain:.07, release:.16, slideTo:340 }); },
  charged(){ tone({ freq: 1050, type:'sine', dur:.06, gain:.07, release:.12, slideTo:1500 }); },
  use(){ tone({ freq: 440, type:'triangle', dur:.1, gain:.09, release:.18, slideTo:880 }); },
  item(){ tone({ freq: 520, type:'sine', dur:.12, gain:.1, release:.2 }); tone({ freq: 780, type:'sine', dur:.14, gain:.08, release:.26, when:.1 }); tone({ freq: 1040, type:'sine', dur:.16, gain:.07, release:.34, when:.2 }); },
  spit(){ tone({ freq: 340, type:'square', dur:.04, gain:.04, release:.06, slideTo:200 }); },
  hop(){ tone({ freq: 420, type:'sine', dur:.04, gain:.03, release:.05, slideTo:620 }); },
  scream(){ tone({ freq: 320, type:'sawtooth', dur:.24, gain:.09, release:.3, slideTo:110 }); noise({ dur:.24, gain:.05, hp:400, lp:3000 }); },
  slam(){ noise({ dur:.24, gain:.11, hp:40, lp:900 }); tone({ freq: 70, type:'sine', dur:.2, gain:.11, release:.3, slideTo:35 }); },
  spawn(){ tone({ freq: 240, type:'triangle', dur:.08, gain:.06, release:.14, slideTo:420 }); },
  ward(){ tone({ freq: 900, type:'sine', dur:.09, gain:.08, release:.16, slideTo:1400 }); },
  revive(){ [0, .12, .24].forEach((d, i) => tone({ freq: 520 + i * 260, type:'sine', dur:.16, gain:.09, release:.3, when:d })); },
  descend(){ [0, .1, .2, .3].forEach((d, i) => tone({ freq: 660 - i * 90, type:'triangle', dur:.14, gain:.08, release:.26, when:d })); },
  boss(){ [0, .16].forEach((d, i) => tone({ freq: 110 + i * 40, type:'sawtooth', dur:.4, gain:.1, release:.5, when:d })); noise({ dur:.5, gain:.05, hp:60, lp:800 }); },
  die(){ [0, .14, .3, .5].forEach((d, i) => tone({ freq: 400 - i * 80, type:'square', dur:.2, gain:.09, release:.4, when:d })); },
  win(){ [0, .14, .28, .44, .6].forEach((d, i) => tone({ freq: 440 + i * 130, type:'triangle', dur:.2, gain:.1, release:.5, when:d })); },
  freeze(){ tone({ freq: 1400, type:'sine', dur:.08, gain:.05, release:.2, slideTo:600 }); },
  shatter(){ noise({ dur:.12, gain:.06, hp:2400, lp:12000 }); },
  step(){ noise({ dur:.02, gain:.015, hp:900, lp:3200 }); }
};
