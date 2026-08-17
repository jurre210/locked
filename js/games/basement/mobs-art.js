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
const T = '..............'; // 14 wide blank

/* ------------------------------------------------------------------ */
/* head layers (14 x 12)                                               */
/* ------------------------------------------------------------------ */
const SKULL = [
  '....oooooo....',
  '..oossssssoo..',
  '.osssssssssso.',
  'osssssssssssso',
  'osssssssssssso',
  'osssssssssssso',
  'osssssssssssso',
  'osssssssssssso',
  'odssssssssssdo',
  '.oddssssssddo.',
  '..oodddddd oo.'.slice(0, 14),
  '....oooooo....'
];

const HAIR = {
  none: [T,T,T,T,T,T,T,T,T,T,T,T],
  tuft: [
    '.....ohho.....','...ohhhhhho...','..ohhhhhhhho..','.ohhg....ghho.',
    T,T,T,T,T,T,T,T
  ],
  bowl: [
    '....oooooo....','..oohhhhhhoo..','.ohhhhhhhhhho.','ohhhhhhhhhhhho',
    'ohhg......ghho',T,T,T,T,T,T,T
  ],
  braids: [
    '....oooooo....','..oohhhhhhoo..','.ohhhhhhhhhho.','ohhg......ghho',
    'oho........oho','oho........oho','ohho......ohho','.ogo......ogo.',
    '.ogo......ogo.','..o........o..',T,T
  ],
  spikes: [
    '..o..oooo..o..','.oho.ohho.oho.','.ohhoohhoohho.','..ohhhhhhhho..',
    '.ohhg....ghho.',T,T,T,T,T,T,T
  ],
  hood: [
    '....oooooo....','..oohhhhhhoo..','.ohhhhhhhhhho.','ohhhhhhhhhhhho',
    'ohhho......ohh'.slice(0,14),'ohho........oh'.slice(0,14),'oho..........o'.slice(0,14),'oho...........',
    'ohho..........','ohhho.........','.ohhhoo.......','..ooooo.......'
  ],
  mop: [
    '...oooooooo...','..ohhhhhhhho..','.ohhhhhhhhhho.','ohhhhhhhhhhhho',
    'ohgohgggohgoho','.o.o.....o.o..',T,T,T,T,T,T
  ]
};

const EYES = {
  normal: [T,T,T,T,'...oo....oo...','...oeo...oeo..','...oo....oo...',T,T,T,T,T],
  sad:    [T,T,T,'...oo....oo...','..oeeo..oeeo..','...oo....oo...',T,T,T,T,T,T],
  wide:   [T,T,'...ooo..ooo...','..oeeeooeeeo..','..oeeeooeeeo..','...ooo..ooo...',T,T,T,T,T,T],
  hollow: [T,T,T,'..oooo..oooo..','..oeeo..oeeo..','..oeeo..oeeo..','..oooo..oooo..',T,T,T,T,T],
  slit:   [T,T,T,T,'..oooo..oooo..','..oeeeooeeeo..','...oo....oo...',T,T,T,T,T],
  cross:  [T,T,T,'..oe.o..o.eo..','...oeo..oeo...','...oeo..oeo...','..oe.o..o.eo..',T,T,T,T,T],
  glow:   [T,T,T,'..oeeeooeeeo..','..oeeeooeeeo..','..oeeeooeeeo..',T,T,T,T,T,T],
  one:    [T,T,T,'.....oooo.....','....oeeeeo....','....oeeeeo....','.....oooo.....',T,T,T,T,T]
};

const ACC = {
  none: [T,T,T,T,T,T,T,T,T,T,T,T],
  horns: [
    'oo..........oo','oaao......oaao','.oaao....oaao.','..oao....oao..',
    T,T,T,T,T,T,T,T
  ],
  halo: [
    '...oaaaaaao...','...o......o...','....oaaaao....',T,T,T,T,T,T,T,T,T
  ],
  mask: [T,T,'.oaaaaaaaaaao.','oaaaaaaaaaaaao','oaao.oo.o.oaao'.slice(0,14),'oaaaaaaaaaaaao','.oaaaaaaaaaao.','..oaaaaaaaao..',T,T,T,T],
  bandage: [T,T,T,'oaaaaaaaaaaaao','oaaaaaaaaaaaao',T,T,T,'.oaaaaaaaaaao.',T,T,T],
  flame: [
    '......aa......','.....aaaa.....','....aaaaaa....','.....aaaa.....',
    T,T,T,T,T,T,T,T
  ],
  antenna: [
    'a..........a..','.a........a...','..a......a....','...aa..aa.....',
    T,T,T,T,T,T,T,T
  ],
  crown: [
    '.o..oooo..o...','.oao.oao.oao..','.oaaaaaaaao...','.oaaaaaaaao...',
    T,T,T,T,T,T,T,T
  ],
  wings: [
    T,T,T,'aa..........aa','aaa........aaa','aaaa......aaaa','.aaa........aa'.slice(0,14),'..aa..........',
    T,T,T,T
  ],
  tears: [T,T,T,T,T,T,T,'...oao...oao..','...oao...oao..','....oa....oa..',T,T]
};

/* ------------------------------------------------------------------ */
/* bodies (14 x 8) — three facings, two walk frames each               */
/* ------------------------------------------------------------------ */
const BODY = {
  down: [[
    '..oooooooo....','.obbbbbbbbo...','osbbbbbbbbso..','osbbbbbbbbso..',
    'o.obbbbbbo..o.','...obbbbo.....','..osso.osso...','..oooo..oooo..'
  ],[
    '..oooooooo....','.obbbbbbbbo...','osbbbbbbbbso..','osbbbbbbbbso..',
    'o.obbbbbbo..o.','...obbbbo.....','.osso....osso.','.oooo......ooo'
  ]],
  side: [[
    '...oooooo.....','..obbbbbbo....','.obbbbbbbbo...','.obbbbbbbbo...',
    'ossobbbbbo....','...obbbbo.....','...osso.ss....','...oooo.oo....'
  ],[
    '...oooooo.....','..obbbbbbo....','.obbbbbbbbo...','.obbbbbbbbo...',
    'ossobbbbbo....','...obbbbo.....','..oss....so...','..oooo...oo...'
  ]],
  up: [[
    '..oooooooo....','.obbbbbbbbo...','osbbbbbbbbso..','osbbbbbbbbso..',
    'o.obbbbbbo..o.','...obbbbo.....','..obbo.obbo...','..oooo..oooo..'
  ],[
    '..oooooooo....','.obbbbbbbbo...','osbbbbbbbbso..','osbbbbbbbbso..',
    'o.obbbbbbo..o.','...obbbbo.....','.obbo....obbo.','.oooo......ooo'
  ]]
};

/**
 * Build every frame a character needs.
 * Returns { down:[f0,f1], side:[f0,f1], up:[f0,f1] } of 14x18 sprites.
 */
export function buildCharacter(def){
  const key = 'ch:' + def.id;
  const skinPal = { o:O, s:def.skin, d:def.skinShade || shade(def.skin) };
  const hairPal = { o:O, h:def.hair || '#3a2c22', g:def.hairShade || shade(def.hair || '#3a2c22') };
  const eyePal  = { o:O, e:def.eye || '#2a2a3a' };
  const accPal  = { o:O, a:def.accent || '#ffd166' };
  const bodyPal = { o:O, b:def.shirt || '#c9c2b0', s:def.skin };

  const head = compose(key + ':head', 14, 12, [
    { s: bake(SKULL, skinPal), dx:0, dy:0 },
    { s: bake(HAIR[def.hairStyle] || HAIR.none, hairPal), dx:0, dy:0 },
    { s: bake(EYES[def.eyes] || EYES.normal, eyePal), dx:0, dy:0 },
    { s: bake(ACC[def.acc] || ACC.none, accPal), dx:0, dy:0 }
  ]);

  const out = {};
  for (const facing of ['down', 'side', 'up']){
    out[facing] = BODY[facing].map((rows, i) => compose(
      `${key}:${facing}:${i}`, 14, 18,
      [ { s: bake(rows, bodyPal), dx:0, dy:10 }, { s: head, dx:0, dy:0 } ]
    ));
  }
  out.head = head;
  return out;
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
