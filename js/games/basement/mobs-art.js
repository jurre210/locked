/**
 * Character, enemy and boss art. All original.
 *
 * Characters are built out of layers — a skull, a hairstyle, a pair of eyes and
 * an optional accessory — composited once at boot. Fourteen distinct faces come
 * out of about a dozen hand-drawn layers, and adding a character is a palette
 * plus three layer names rather than a new sprite.
 */
import { sprite, bake, compose } from './sprite.js';

const O = '#191118';
const T = '................'; // 16 wide blank

/* ------------------------------------------------------------------ */
/* head layers (16 x 14)                                               */
/* ------------------------------------------------------------------ */
/* l = lit skin, s = skin, d = shaded skin. The light sits top-left on
   every layer so the head, hair and body agree about where it comes from. */
const SKULL = [
  '.....oooooo.....',
  '...oolllllloo...',
  '..ollllsssssso..',
  '.ollllsssssssso.',
  'ollllssssssssddo',
  'olllssssssssdddo',
  'ollsssssssssdddo',
  'olsssssssssssddo',
  'osssssssssssssdo',
  'ossssssssssssddo',
  'odssssssssssdddo',
  '.odsssssssssddo.',
  '..oddsssssdddo..',
  '...ooddddddoo...'
];

const HAIR = {
  none: [T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  tuft: [
    '......ohho......','....oohhhhoo....','..oohhhhhhhhoo..','.ohhhhhhhhhhho..',
    'ohg..........gho',T,T,T,T,T,T,T,T,T
  ],
  bowl: [
    '.....oooooo.....','...oohhhhhhoo...','..ohhhhhhhhhho..','.ohhhhhhhhhhhho.',
    'ohhhhhhhhhhhhhho','ohhg........ghho',T,T,T,T,T,T,T,T
  ],
  braids: [
    '.....oooooo.....','...oohhhhhhoo...','..ohhhhhhhhhho..','.ohhhhhhhhhhhho.',
    'ohhhhhhhhhhhhhho','ohg..........gho','oho..........oho','oho..........oho',
    'ogo..........ogo','.o............o.',T,T,T,T
  ],
  spikes: [
    '..o...oooo...o..','.oho.oohhoo.oho.','.ohhhoohhhhoohho','..ohhhhhhhhhho..',
    '.ohg........gho.',T,T,T,T,T,T,T,T,T
  ],
  hood: [
    '.....oooooo.....','...oohhhhhhoo...','..ohhhhhhhhhho..','.ohhhhhhhhhhhho.',
    'ohhhhhhhhhhhhhho','ohhho........ohh','ohho..........oh','oho............o',
    'oho.............','ohho............','ohhho...........','.ohhoo..........',
    '..ooo...........',T
  ],
  mop: [
    '...oooooooooo...','..ohhhhhhhhhho..','.ohhhhhhhhhhhho.','ohhhhhhhhhhhhhho',
    'ohho.ohho.ohho.o','.o..o.o..o.o..o.',T,T,T,T,T,T,T,T
  ]
};

/* w = eye white, e = iris. Whites are what stop the face reading as a skull. */
const EYES = {
  normal: [T,T,T,T,T,T,'...oooo..oooo...','..owwwo..owwwo..','..oweeo..oweeo..','..oweeo..oweeo..','...oooo..oooo...',T,T,T],
  sad:    [T,T,T,T,T,T,T,'...ooo....ooo...','..owweo..owweo..','..oweeo..oweeo..','...ooo....ooo...',T,T,T],
  wide:   [T,T,T,T,T,'..oooo...oooo...','.owwwwo.owwwwo..','.oweeeo.oweeeo..','.oweeeo.oweeeo..','..oooo...oooo...',T,T,T,T],
  hollow: [T,T,T,T,T,T,'...oooo..oooo...','..oeeeo..oeeeo..','..oeeeo..oeeeo..','..oeeeo..oeeeo..','...oooo..oooo...',T,T,T],
  slit:   [T,T,T,T,T,T,T,'..oooo....oooo..','..oeeo....oeeo..','...oo......oo...',T,T,T,T],
  cross:  [T,T,T,T,T,T,T,'..oe.eo..oe.eo..','...oeo....oeo...','..oe.eo..oe.eo..',T,T,T,T],
  glow:   [T,T,T,T,T,T,'...oooo..oooo...','..oeeeo..oeeeo..','..oeeeo..oeeeo..','..oeeeo..oeeeo..','...oooo..oooo...',T,T,T],
  one:    [T,T,T,T,T,'.....oooooo.....','....owwwwwwo....','....oweeeewo....','....oweeeewo....','.....oooooo.....',T,T,T,T]
};

const ACC = {
  none: [T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  horns: [
    'oo............oo','oaao........oaao','.oaao......oaao.','..oao......oao..',
    T,T,T,T,T,T,T,T,T,T
  ],
  halo: [
    '....oaaaaaaao...','....o.......o...','.....oaaaaao....',T,T,T,T,T,T,T,T,T,T,T
  ],
  mask: [T,T,T,T,T,'.oaaaaaaaaaaaao.','oaaaaaaaaaaaaaao','oaao.oo..oo.oaao',
    'oaaaaaaaaaaaaaao','.oaaaaaaaaaaaao.','..oaaaaaaaaaao..',T,T,T],
  bandage: [T,T,T,T,T,T,'oaaaaaaaaaaaaaao','oaaaaaaaaaaaaaao',T,T,'.oaaaaaaaaaaaao.',T,T,T],
  flame: [
    '.......aa.......','......aaaa......','.....aaaaaa.....','......aaaa......',
    '.......aa.......',T,T,T,T,T,T,T,T,T
  ],
  antenna: [
    '.a............a.','..a..........a..','...a........a...','....aa....aa....',
    T,T,T,T,T,T,T,T,T,T
  ],
  crown: [
    '..o..o.oo.o..o..','..oao.oaao.oao..','..oaaaaaaaaaao..','..oaaaaaaaaaao..',
    T,T,T,T,T,T,T,T,T,T
  ],
  wings: [
    T,T,T,T,'aa............aa','aaa..........aaa','aaaa........aaaa','.aaa........aaa.',
    '..aa........aa..',T,T,T,T,T
  ],
  tears: [T,T,T,T,T,T,T,T,T,T,'...oao....oao...','...oao....oao...','....a......a....',T]
};

/* ------------------------------------------------------------------ */
/* bodies (16 x 10) — three facings, two walk frames each              */
/* ------------------------------------------------------------------ */
/* b = shirt, k = shirt shade, s = bare skin (arms and legs). */
const BODY = {
  down: [[
    '...oooooooooo...','..obbbbbbbbbbo..','.osbbbbbbbbbbso.','.osbbbbbbbbbbso.',
    '.oskbbbbbbbbkso.','..okbbbbbbbbko..','...okbbbbbbko...','...osso..osso...',
    '...osso..osso...','...oooo..oooo...'
  ],[
    '...oooooooooo...','..obbbbbbbbbbo..','.osbbbbbbbbbbso.','.osbbbbbbbbbbso.',
    '.oskbbbbbbbbkso.','..okbbbbbbbbko..','...okbbbbbbko...','..osso....osso..',
    '..osso....osso..','..oooo....oooo..'
  ]],
  side: [[
    '...oooooooooo...','..obbbbbbbbbbo..','.osbbbbbbbbbbo..','.osbbbbbbbbbbo..',
    '..okbbbbbbbbko..','..okbbbbbbbbko..','...okbbbbbbko...','....osssso......',
    '...osso.sso.....','...oooo.ooo.....'
  ],[
    '...oooooooooo...','..obbbbbbbbbbo..','.osbbbbbbbbbbo..','.osbbbbbbbbbbo..',
    '..okbbbbbbbbko..','..okbbbbbbbbko..','...okbbbbbbko...','....osssso......',
    '..oss..osso.....','..oooo..ooo.....'
  ]],
  up: [[
    '...oooooooooo...','..obbbbbbbbbbo..','.osbbbbbbbbbbso.','.osbbbbbbbbbbso.',
    '.oskbbbbbbbbkso.','..okbbbbbbbbko..','...okbbbbbbko...','...osso..osso...',
    '...osso..osso...','...oooo..oooo...'
  ],[
    '...oooooooooo...','..obbbbbbbbbbo..','.osbbbbbbbbbbso.','.osbbbbbbbbbbso.',
    '.oskbbbbbbbbkso.','..okbbbbbbbbko..','...okbbbbbbko...','..osso....osso..',
    '..osso....osso..','..oooo....oooo..'
  ]]
};

/**
 * Build every frame a character needs.
 * Returns { down:[f0,f1], side:[f0,f1], up:[f0,f1] } of 16x22 sprites.
 */
export function buildCharacter(def){
  const key = 'ch:' + def.id;
  const skin = def.skin;
  const skinPal = {
    o:O, s:skin, d:def.skinShade || shade(skin, 0.74), l:def.skinLit || lift(skin)
  };
  const hairPal = { o:O, h:def.hair || '#3a2c22', g:def.hairShade || shade(def.hair || '#3a2c22') };
  const eyePal  = { o:O, e:def.eye || '#2a2a3a', w:def.eyeWhite || '#f4f2ea' };
  const accPal  = { o:O, a:def.accent || '#ffd166' };
  const shirt   = def.shirt || '#c9c2b0';
  const bodyPal = { o:O, b:shirt, k:shade(shirt, 0.72), s:skin };

  const skullS = bake(SKULL, skinPal);
  const hairS  = bake(HAIR[def.hairStyle] || HAIR.none, hairPal);
  const accS   = bake(ACC[def.acc] || ACC.none, accPal);

  const head = compose(key + ':head', 16, 14, [
    { s: skullS, dx:0, dy:0 },
    { s: hairS, dx:0, dy:0 },
    { s: bake(EYES[def.eyes] || EYES.normal, eyePal), dx:0, dy:0 },
    { s: accS, dx:0, dy:0 }
  ]);
  // walking away should show the back of a head, not a face pasted on a back
  const backHead = compose(key + ':back', 16, 14, [
    { s: skullS, dx:0, dy:0 },
    { s: hairS, dx:0, dy:0 },
    { s: accS, dx:0, dy:0 }
  ]);

  const out = {};
  for (const facing of ['down', 'side', 'up']){
    const h = facing === 'up' ? backHead : head;
    out[facing] = BODY[facing].map((rows, i) => compose(
      `${key}:${facing}:${i}`, 16, 22,
      [ { s: bake(rows, bodyPal), dx:0, dy:12 }, { s: h, dx:0, dy:0 } ]
    ));
  }
  out.head = head;
  return out;
}

/** Lighter sibling of a hex colour, for the lit side of a form. */
function lift(hex, k = 0.16){
  const n = parseInt(hex.slice(1), 16);
  const ch = i => { const v = (n >> i) & 255; return Math.round(v + (255 - v) * k); };
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** Darker sibling of a hex colour — saves declaring a shade for every palette. */
function shade(hex, k = 0.62){
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
export { shade };

/* ------------------------------------------------------------------ */
/* enemies                                                             */
/* ------------------------------------------------------------------ */
/* Authored 14x14 unless noted. Palette: o outline, a main, b shade,
   c highlight, d accent (eyes / teeth / cores). */
const E = {
  grub: [
    '..............','...oooooo.....','..occccccо....'.slice(0,14),'.occaaaacco...',
    'ocaaddaaaaco..','oaaddddaaaao..','oaaddddaaaao..','ocaaddaaaaco..',
    '.occaaaacco...','..occbbbbco...','...obbbbbo....','....oooooo....','..............','..............'
  ],
  hopper: [
    '.....oooo.....','...occccccо...'.slice(0,14),'..occaaaacco..','.ocaadddaaco..',
    '.oaadddddaao..','.oaadddddaao..','.ocaadddaaco..','..occaaaacco..',
    '...obbbbbbo...','..ob.oooo.bo..','.obo......obo.','.oo........oo.','..............','..............'
  ],
  spitter: [
    '..............','....oooooo....','..oocccccco...','.occaaaaaaco..',
    'ocaaaaaaaaaco.','oaaadddddaaao','oaaadddddaaao','ocaaaaaaaaaco.',
    '.obaaaaaaabo..','..obbbbbbbo...','...oooooooo...','..............','..............','..............'
  ],
  charger: [
    '..............','..oo......oo..','.oaao....oaao.','.oaaooooooaao.',
    'ocaaaaaaaaaaco','oaaddaaaaddaao','oaaddaaaaddaao','ocaaaaaaaaaaco',
    '.obaaaaaaaabo.','..obbbbbbbbo..','...o.oooo.o...','..oo......oo..','..............','..............'
  ],
  floater: [
    '.....oooo.....','...oocccco....','..occaaaacco..','.ocaaddaaaco..',
    'ocaadddddaaco.','ocaadddddaaco.','.ocaaddaaaco..','..occaaaacco..',
    '...obb..bbo...','..ob..bb..bo..','.o...o..o...o.','..............','..............','..............'
  ],
  mite: [
    '..............','..............','.....oo.......','....occo......',
    '...ocaaco.....','..ocaddaco....','..ocaddaco....','...ocaaco.....',
    '....obbo......','.....oo.......','..............','..............','..............','..............'
  ],
  bulb: [
    '..............','....oooooo....','..oodddddoo...','.oddddddddo...',
    'oddaaaaaaddo..','odaaaaaaaado..','odaaaaaaaado..','oddaaaaaaddo..',
    '.obddddddbo...','..obbbbbbo....','...oooooo.....','..............','..............','..............'
  ],
  sacwalker: [
    '..............','...oooooo.....','..occccccо....'.slice(0,14),'.occaaaacco...',
    'ocaaaaaaaaco..','oaaadddaaaao..','oaadddddaaao..','ocaadddaaaco..',
    '.occaaaacco...','..obbbbbbo....','...o.oo.o.....','..oo....oo....','..............','..............'
  ],
  crawler: [
    '..............','.o..oooo...o..','.oo occo  oo..'.slice(0,14),'..oocaaacoo...',
    '.ocaadddaaco..','ocaaddddda co'.slice(0,14),'ocaadddddaco..','.ocaaaaaaaco..',
    '..occaaaacco..','.o.obbbbo..o..','.oo......oo...','..............','..............','..............'
  ],
  spinner: [
    '......oo......','....oocco.....','..oocaaacoo...','.ocaaddaaaco..',
    'ocaadddddaaco.','oaddddddddaao','ocaadddddaaco.','.ocaaddaaaco..',
    '..oocaaacoo...','....oocco.....','......oo......','..............','..............','..............'
  ],
  gazer: [
    '..............','...oooooooo...','.occcccccccо..'.slice(0,14),'occaaaaaaacco.',
    'ocaaddddddaco.','oaadd oo ddaao'.slice(0,14),'oaadd oo ddaao'.slice(0,14),'ocaaddddddaco.',
    'occaaaaaaacco.','.occcccccccо..'.slice(0,14),'...oooooooo...','..............','..............','..............'
  ],
  tickler: [
    '..............','.....oo.......','....ocao......','...ocaaco.....',
    '..ocaddaco....','.ocaddddaco...','.ocaddddaco...','..ocaddaco....',
    '...ocaaco.....','..o.obo.o.....','.o...o...o....','..............','..............','..............'
  ],
  boiler: [
    '....oooooo....','..oodddddoo...','.oddaaaaddo...','oddaaaaaaddo..',
    'odaadddd aado'.slice(0,14),'odaadddddaado','odaadddddaado','odaaddddaaado',
    '.oddaaaaddo...','..obdddddbo...','...oooooo.....','..............','..............','..............'
  ],
  leech: [
    '..............','..............','....oooooo....','..occaaaacco..',
    '.ocaadddaaco..','ocaaddddda co'.slice(0,14),'ocaadddddaco..','.ocaaaaaaaco..',
    '..occbbbbco...','....oooooo....','..............','..............','..............','..............'
  ],
  spiderling: [
    '.o..........o.','..o..oooo..o..','...occaacco...','.o.ocaddaco.o.',
    '..oocaddaacoo.','.o.ocaaaaco.o.','..o.oaaaao..o.','...oobbbboo...',
    '..o..o..o..o..','.o..........o.','..............','..............','..............','..............'
  ],
  wisp: [
    '.....oooo.....','...oocccco....','..occaaaacco..','.ocaddddddco..',
    'ocaaddddddaco.','ocaaddddddaco.','.ocaaddddaco..','..occaaaacco..',
    '...oo....oo...','.....oo.......','..............','..............','..............','..............'
  ],
  husker: [
    '...oooooooo...','..obbbbbbbbo..','.obcccccccbo..','obcaaaaaaacbo.',
    'obcaddddddacbo','obcaddddddacbo','obcaaaaaaacbo.','.obcccccccbo..',
    '..obbbbbbbbo..','...o.oooo.o...','..oo......oo..','..............','..............','..............'
  ],
  sporecap: [
    '...oooooooo...','..occaaaacco..','.ocaddddddaco.','ocaadddddda co'.slice(0,14),
    'oaaddddddddaao','.obaaaaaaaabo.','..oobbbbbboo..','....occcco....',
    '....occcco....','....occcco....','.....oooo.....','..............','..............','..............'
  ],
  bonewalker: [
    '....oooooo....','..occccccco...','.occaaaaacco..','ocaaoo..oo aco'.slice(0,14),
    'ocaaoo..ooaco.','ocaaaaaaaaaco.','.ocadddddaco..','..occaaaacco..',
    '...ocaaaaco...','...o.oooo.o...','..oo......oo..','..............','..............','..............'
  ],
  slugger: [
    '..............','..............','...oooooooo...','..occaaaacco..',
    '.ocaadddaaaco.','ocaadddddaaaco','ocaadddddaaaco','.ocaaaaaaaaco.',
    '..obbbbbbbbo..','...oooooooo...','..............','..............','..............','..............'
  ],
  flyswarm: [
    '..............','.....oo.......','....occo......','...ocddco.....',
    '..o.ocdco.o...','.oo.ocaco.oo..','..o.occo..o...','.....oo.......',
    '..............','..............','..............','..............','..............','..............'
  ],
  thorn: [
    '......o.......','.....oao......','.....oao......','..o..oao..o...',
    '.oao.oao.oao..','.oaoocacooao..','oaaacaaacaaao.','.oaoocacooao..',
    '.oao.oao.oao..','..o..oao..o...','.....oao......','......o.......','..............','..............'
  ],
  ghoul: [
    '.....oooo.....','...oocccco....','..occaaaacco..','.ocaaddaaaco..',
    'ocaadddddaaco.','ocaadddddaaco.','ocaaaaaaaaaco.','.ocaaaaaaaco..',
    '..oca.a.acо...'.slice(0,14),'...o.o.o.o....','..............','..............','..............','..............'
  ],
  bomber: [
    '....oooooo....','..occccccco...','.occaaaaacco..','ocaadddddaaco.',
    'ocaadddddaaco.','.ocaaaaaaaco..','..obbbbbbbo...','.ob.oo..oo.bo.',
    'ob..o.o..o..bo','o...o.o..o...o','.....oo..oo...','..............','..............','..............'
  ],
  screamer: [
    '...oooooooo...','..occcccccco..','.ocaaaaaaaaco.','ocaaddddddaaco',
    'ocaddddddddaco','ocaaddddddaaco','.ocaaaaaaaaco.','..oc oooo cо..'.slice(0,14),
    '...occccccо...'.slice(0,14),'....oooooo....','..............','..............','..............','..............'
  ],
  pillar: [
    '...oooooooo...','..obbbbbbbbo..','.obcccccccbo..','obcaaaaaaacbo.',
    'obcaddddddacbo','obcaddddddacbo','obcaaaaaaacbo.','.obcccccccbo..',
    '..obbbbbbbbo..','..obbbbbbbbo..','..obbbbbbbbo..','...oooooooo...','..............','..............'
  ],
  broodmother: [
    '..oooooooooo..','.occcccccccco.','occaaaaaaaacco','ocaaddddddaaco',
    'oaadddddddda ao'.slice(0,14),'oaaddoooodda ao'.slice(0,14),'oaadddddddd ao'.slice(0,14),'ocaaddddddaaco',
    'occaaaaaaaacco','.obbbbbbbbbbo.','..o.o.oo.o.o..','.oo..o..o..oo.','..............','..............'
  ],
  mimic: [
    '..............','..oooooooooo..','.oaaaaaaaaaao.','oabbbbbbbbbbao',
    'oabb dd dd bao'.slice(0,14),'oabbbbbbbbbbao','ooooccccccoooo','oaaccddddccaao',
    'oaaccddddccaao','oabbbbbbbbbbao','oaaaaaaaaaaaao','.oooooooooooo.','..............','..............'
  ]
};

/** Palettes are declared with the enemy so a champion variant is a recolour. */
export function enemySprite(kind, palette){
  const rows = E[kind] || E.grub;
  const [a, b, c, d] = palette;
  return sprite(`e:${kind}:${a}${d}`, rows, { o:O, a, b, c, d });
}
export const ENEMY_ART_KEYS = Object.keys(E);

/* ------------------------------------------------------------------ */
/* bosses (20x20)                                                      */
/* ------------------------------------------------------------------ */
const B = {
  blob: [
    '......oooooooo......','....oocccccccccoo...','..occcaaaaaaaccco...','.occaaaaaaaaaaacco..',
    'occaaaaaaaaaaaaacco.','ocaaaaddddddaaaaaco.','ocaaaddddddddaaaaco.','oaaaadd oo dd aaaao'.slice(0,20),
    'oaaaadd oo ddaaaaao','oaaaaddddddddaaaaao','oaaaaddddddddaaaaao','ocaaaaddddddaaaaaco',
    'ocaaaaaaaaaaaaaaaco','.occaaaaaaaaaaacco..','..obbaaaaaaaabbo....','...obbbbbbbbbbo.....',
    '....oobbbbbbboo.....','......oooooooo......','....................','....................'
  ],
  bird: [
    '.........oo.........','........occo........','.......ocaaco.......','......ocaaaaco......',
    'oo...ocaadddaaco..oo','oao.ocaaddddddaco.oa'.slice(0,20),'oaaoocaadddddda co'.slice(0,20),'oaaaocaaaaaaaaaacoaa'.slice(0,20),
    'oaaacaaaaaaaaaaaacaa'.slice(0,20),'.oaaaaaaaaaaaaaaaao.','..oaaaaaaaaaaaaaao..','...obaaaaaaaaaabo...',
    '....obbaaaaaabbo....','.....obbbbbbbbo.....','......oo.oo.oo......','.....oao.oao.oao....',
    '.....oao.oao.oao....','......oo.oo.oo......','....................','....................'
  ],
  spider: [
    'o................o..','.o..............o...','..o.oooooooooo.o....','...ooccccccccoo.....',
    'o..occaaaaaacco..o..','.o.ocaadddddaaco.o..','..oocaddddddda co'.slice(0,20),'.oocaadd oo ddaacoo.',
    'oocaaadd oo ddaaacoo','.ocaaaddddddddaaaco.','..ocaaaaaaaaaaaaco..','.o.occaaaaaaaacco.o.',
    'o..o.obbbbbbbbo.o..o','.o....oooooooo....o.','o..o..o......o..o..o','.o...o........o...o.',
    'o...o..........o...o','....................','....................','....................'
  ],
  maw: [
    '....oooooooooooo....','..oocccccccccccco...','.occaaaaaaaaaaacco..','occaaaaaaaaaaaaacco.',
    'ocaaaaaaaaaaaaaaaco.','oaoooooooooooooooao.','oaoddddddddddddoao..','oaodoooooooooodoao..',
    'oaodo dd dd dd odoao'.slice(0,20),'oaodo dd dd dd odoao'.slice(0,20),'oaodoooooooooodoao..','oaodddddddddddd oao'.slice(0,20),
    'oaoooooooooooooooao.','ocaaaaaaaaaaaaaaaco.','occaaaaaaaaaaaaacco.','.occcaaaaaaaaaccco..',
    '..oobbbbbbbbbbboo...','....oooooooooooo....','....................','....................'
  ],
  eye: [
    '.......oooooo.......','.....oocccccccoo....','...occcaaaaaaccco...','..occaaaaaaaaaacco..',
    '.occaaaaaaaaaaaacco.','occaaaadddddaaaacco.','ocaaaadddddddaaaaco.','ocaaadddoooodddaaco.',
    'oaaaaddoo  oodda ao'.slice(0,20),'oaaaaddo    odda aao'.slice(0,20),'oaaaaddoo  ooddaaaao','ocaaadddoooodddaaco.',
    'ocaaaadddddddaaaaco.','occaaaadddddaaaacco.','.occaaaaaaaaaaaacco.','..occaaaaaaaaaacco..',
    '...occcaaaaaaccco...','.....oocccccccoo....','.......oooooo.......','....................'
  ],
  wraith: [
    '......oooooo........','....oocccccco.......','..occcaaaaaccо......'.slice(0,20),'.occaaaaaaaacco.....',
    'occaaaddddaaaacco...','ocaaadd oo ddaaaco..','ocaaadd oo ddaaaco..','ocaaaddddddddaaaco..',
    'ocaaaaaaaaaaaaaaco..','.ocaaaaaaaaaaaaco...','..ocaaaaaaaaaaco....','..ocaaaaaaaaaaco....',
    '.ocaaaaaaaaaaaaco...','ocaaaaaaaaaaaaaaco..','.oc.oca.aco.acо.....'.slice(0,20),'..o..o.o.o.o..o.....',
    '....................','....................','....................','....................'
  ],
  golem: [
    '....oooooooooooo....','...obbbbbbbbbbbbo...','..obcccccccccccbo...','.obcaaaaaaaaaaacbo..',
    'obcaaddddddddaaacbo.','obcaadd oo oo ddacbo'.slice(0,20),'obcaadd oo oo ddacbo'.slice(0,20),'obcaaddddddddaaacbo.',
    'obcaaaaaaaaaaaaacbo.','.obcaaaaaaaaaaacbo..','..obcccccccccccbo...','..obbbbbbbbbbbbbo...',
    '.ob.obbbbbbbbo.obo..','ob...obbbbbbo...obo.','o.....oooooo.....o..','....o..o..o..o......',
    '...oao.oao.oao......','....oo..oo..oo......','....................','....................'
  ],
  pile: [
    '........oooo........','......oocccco.......','....occcaaaccо......'.slice(0,20),'...occaaaaaacco.....',
    '..occaaaddaaaacco...','.ocaaaadddda aaaco'.slice(0,20),'.ocaaaddddddaaaco...','occaaaddddddaaacco..',
    'ocaaaaddddddaaaaco..','ocaaaaaaaaaaaaaaco..','occaaaaaaaaaaaacco..','.occaaaaaaaaaacco...',
    '..occaaaaaaaacco....','...obbaaaaaabbo.....','..obbbbbbbbbbbbo....','.obbbbbbbbbbbbbbo...',
    'obbbbbbbbbbbbbbbbo..','.oooooooooooooooo...','....................','....................'
  ]
};

export function bossSprite(kind, palette){
  const rows = B[kind] || B.blob;
  const [a, b, c, d] = palette;
  return sprite(`b:${kind}:${a}${d}`, rows, { o:O, a, b, c, d });
}
export const BOSS_ART_KEYS = Object.keys(B);

/* ------------------------------------------------------------------ */
/* familiars (10x10)                                                   */
/* ------------------------------------------------------------------ */
const FAM = {
  blob: ['..oooo....','.occaaco..','ocadddaco.','oaddddda o'.slice(0,10),'oadd  ddao','oaddddddao','ocaddddaco','.ocaaaaco.','..oooooo..','..........'],
  fly:  ['..........','.o......o.','.oo.oo.oo.','..ocaaco..','..oadd ao'.slice(0,10),'..oaddao..','..ocaaco..','...oooo...','..........','..........'],
  spirit:['..oooo....','.occccco..','ocaaaaaco.','oaaddddao.','oaddddd ao'.slice(0,10),'oaaddddao.','ocaaaaaco.','.oc.a.co..','..o.o.o...','..........'],
  cube: ['.oooooooo.','oaaaaaaaao','oacccccca o'.slice(0,10),'oaccddccao','oaccddccao','oacccccca o'.slice(0,10),'oaaaaaaaao','.oooooooo.','..........','..........'],
  skull:['..oooooo..','.occccccо.'.slice(0,10),'ocaaaaaaco','oaoo..ooao','oaoo..ooao','oaaadddaao','.oaaaaaao.','..oa.a.ao.','...o.o.o..','..........']
};
export function familiarSprite(kind, palette){
  const rows = FAM[kind] || FAM.blob;
  const [a, b, c, d] = palette;
  return sprite(`f:${kind}:${a}${d}`, rows, { o:O, a, b, c, d });
}
