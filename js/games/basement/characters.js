/**
 * Playable characters. Each is a face (layers for the sprite builder) plus a
 * starting kit — containers, stat offsets, items and consumables.
 * All original designs.
 */

export const BASE_STATS = {
  damage: 3.5,      // per shot
  tears: 2.6,       // shots per second
  speed: 2.0,       // px per frame at 60fps
  range: 300,       // px a shot travels
  shotSpeed: 5.5,   // px per frame
  luck: 0
};

export const CHARACTERS = [
  {
    id:'wren', name:'Wren', blurb:'Nothing special. That is the point.',
    skin:'#f0cdb4', hair:'#6b4a2f', hairStyle:'tuft', eyes:'sad', acc:'none', shirt:'#d8d2c4', accent:'#ffd166',
    hp:3, soul:0, bombs:1, keys:0, coins:0, stats:{}
  },
  {
    id:'mabel', name:'Mabel', blurb:'Carries a card and a lot of hope.',
    skin:'#f2d2bc', hair:'#c96a2a', hairStyle:'braids', eyes:'normal', acc:'none', shirt:'#8fbfd8', accent:'#ffd166',
    hp:4, soul:0, bombs:1, keys:1, coins:2, stats:{ luck:2, damage:-0.4 }, card:'random'
  },
  {
    id:'ash', name:'Ash', blurb:'Everything he touches keeps burning.',
    skin:'#c9a48e', hair:'#2a2028', hairStyle:'spikes', eyes:'slit', acc:'none', shirt:'#5a3a34', accent:'#ff8a3d',
    hp:3, soul:0, bombs:2, keys:0, coins:0, stats:{ damage:0.5, tears:-0.3 }, items:['brandIron']
  },
  {
    id:'pip', name:'Pip', blurb:'Small, quick, and made of paper.',
    skin:'#ffe0c4', hair:'#e8c05a', hairStyle:'mop', eyes:'wide', acc:'none', shirt:'#c9e04a', accent:'#c9e04a',
    hp:2, soul:0, bombs:1, keys:0, coins:0, stats:{ speed:0.45, tears:0.8, damage:-0.9, range:-40 }
  },
  {
    id:'sable', name:'Sable', blurb:'Runs on borrowed hearts only.',
    skin:'#b8b0c4', hair:'#2e2838', hairStyle:'hood', eyes:'hollow', acc:'none', shirt:'#3a3448', accent:'#9b7ed6',
    hp:0, soul:6, bombs:1, keys:0, coins:0, stats:{ damage:0.4 },
    flags:{ noRed:1, spectral:1 }, items:[]
  },
  {
    id:'husk', name:'Husk', blurb:'What is left after the rest gave up.',
    skin:'#8a8494', hair:'#1e1a24', hairStyle:'bowl', eyes:'cross', acc:'none', shirt:'#26232c', accent:'#b07fff',
    hp:0, soul:0, black:4, bombs:2, keys:0, coins:0, stats:{ damage:1.2, speed:-0.15 },
    flags:{ noRed:1 }
  },
  {
    id:'tallow', name:'Tallow', blurb:'Hold it in until it means something.',
    skin:'#f0d8b0', hair:'#f2e2b8', hairStyle:'none', eyes:'one', acc:'flame', shirt:'#e8d8a8', accent:'#ffe066',
    hp:3, soul:0, bombs:1, keys:0, coins:0, stats:{ damage:0.3, tears:-0.5 }, items:['boltThrower']
  },
  {
    id:'crick', name:'Crick', blurb:'Something got in and stayed.',
    skin:'#c8d8a0', hair:'#4a6a2a', hairStyle:'none', eyes:'glow', acc:'antenna', shirt:'#6f9a2a', accent:'#9fd83a',
    hp:3, soul:0, bombs:1, keys:0, coins:0, stats:{ speed:0.25, damage:-0.3 }, items:['rotGland']
  },
  {
    id:'nought', name:'Nought', blurb:'Walks through what stops everyone else.',
    skin:'#d8d2c4', hair:'#3a3448', hairStyle:'none', eyes:'hollow', acc:'mask', shirt:'#4a4650', accent:'#d0d6e0',
    hp:2, soul:2, bombs:1, keys:1, coins:0, stats:{}, items:['ghostGlass']
  },
  {
    id:'veil', name:'Veil', blurb:'Feet have not touched the floor in years.',
    skin:'#dfe6f2', hair:'#c8d4e8', hairStyle:'none', eyes:'glow', acc:'wings', shirt:'#a8c0d8', accent:'#ffffff',
    hp:1, soul:4, bombs:1, keys:0, coins:0, stats:{ damage:-0.5, speed:0.2 },
    flags:{ fly:1, spectral:1 }
  },
  {
    id:'bramble', name:'Bramble', blurb:'Better up close than she should be.',
    skin:'#e8c8a8', hair:'#2f6a3a', hairStyle:'spikes', eyes:'slit', acc:'horns', shirt:'#3f7a4a', accent:'#5ec9a0',
    hp:4, soul:0, bombs:1, keys:0, coins:0, stats:{ damage:0.6, tears:-0.4, speed:0.15 },
    flags:{ thorns:2 }
  },
  {
    id:'runt', name:'Runt', blurb:'Found something on the way in.',
    skin:'#f0cdb4', hair:'#8a5f2a', hairStyle:'bowl', eyes:'wide', acc:'bandage', shirt:'#c9a06a', accent:'#e8e2d0',
    hp:2, soul:0, bombs:1, keys:0, coins:5, stats:{ luck:1 }, items:['random']
  },
  {
    id:'dregs', name:'Dregs', blurb:'Starts with nothing. Ends with everything.',
    skin:'#c4b8a4', hair:'#4a4038', hairStyle:'mop', eyes:'cross', acc:'none', shirt:'#6b5340', accent:'#8a8494',
    hp:1, soul:0, bombs:0, keys:0, coins:0,
    stats:{ damage:-1.2, tears:-0.4, speed:-0.1 },
    flags:{ scaling:1 }   // +0.35 damage and +0.06 speed per item collected
  },
  {
    id:'cinder', name:'Cinder', blurb:'Always has one more use left.',
    skin:'#e8b89a', hair:'#c94f2a', hairStyle:'tuft', eyes:'normal', acc:'crown', shirt:'#b4593a', accent:'#ff8a3d',
    hp:3, soul:0, bombs:1, keys:0, coins:0, stats:{ tears:0.2 },
    active:'random', flags:{ fastCharge:1 }
  }
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

/** Two-player and up: everyone after player 1 gets the same kit but no items. */
export const CO_OP_DEFAULT = 'pip';
