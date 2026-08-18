/**
 * Game modes and challenge runs.
 *
 * A mode is a bag of modifiers the Game reads: it never branches on a mode id
 * anywhere, so a new mode is one entry here rather than edits across the loop.
 */
import { dayKey } from '../../core/ui.js';

export const MODES = [
  { id:'normal', name:'normal', blurb:'Nine floors, one life, whatever the floor gives you.' },
  { id:'hard',   name:'hard',   blurb:'More enemies, tougher enemies, meaner floors.', hard:true },
  { id:'daily',  name:'daily',  blurb:'The same run for everyone, until midnight.', seeded:true },
  { id:'rush',   name:'boss rush', blurb:'Five bosses back to back. No normal rooms.', bossRush:true },
  { id:'endless',name:'endless', blurb:'It never stops. See how deep you get.', endless:true },
  { id:'challenge', name:'challenges', blurb:'Ten fixed runs with the rules changed.', picker:true }
];

export const CHALLENGES = [
  { id:'bareHands', name:'bare hands', blurb:'No items on the floor. You are the build.',
    char:'wren', mods:{ noItems:true, bonus:{ damage:2.2, tears:0.6 } } },
  { id:'glass', name:'glass', blurb:'One heart. Double damage. Do not get touched.',
    char:'pip', mods:{ startHp:1, bonus:{ damage:3 }, flags:{ glass:1 } } },
  { id:'swarm', name:'swarm', blurb:'Three times the enemies. You get to shoot through them.',
    char:'wren', mods:{ enemyMult:3, items:['splitStone'] } },
  { id:'blind', name:'blind', blurb:'Every floor is dark. Every floor.',
    char:'nought', mods:{ forceCurse:'dark' } },
  { id:'purist', name:'purist', blurb:'Only stat items exist. Nothing clever.',
    char:'wren', mods:{ itemFilter: it => !!it.stats && !it.flags && !it.familiar } },
  { id:'oneShot', name:'one shot', blurb:'One enormous shot every two seconds.',
    char:'tallow', mods:{ bonus:{ damage:22, tears:-2.1 }, items:['splitStone', 'heavyShot'] } },
  { id:'broke', name:'broke', blurb:'No coins, no shops, no arcades.',
    char:'dregs', mods:{ noMoney:true } },
  { id:'heavy', name:'heavy', blurb:'Everything you fire explodes. Including near you.',
    char:'ash', mods:{ items:['blackPowder', 'nailBomb'], bonus:{ speed:-0.3 } } },
  { id:'longWay', name:'the long way', blurb:'Twelve floors instead of nine.',
    char:'mabel', mods:{ extraFloors:3 } },
  { id:'hive', name:'the hive', blurb:'You start with four friends and nothing else.',
    char:'runt', mods:{ items:['palGnat', 'palFly', 'palBlob'], bonus:{ damage:-1.4 } } }
];

/** Build the mode object the Game consumes. */
export function makeMode(id, challengeId){
  const base = MODES.find(m => m.id === id) || MODES[0];
  const mode = { ...base };
  if (id === 'challenge'){
    const c = CHALLENGES.find(x => x.id === challengeId) || CHALLENGES[0];
    Object.assign(mode, { challenge: c, ...c.mods, name: c.name });
  }
  return mode;
}

/* ------------------------------------------------------------------ */
/* seeds                                                               */
/* ------------------------------------------------------------------ */
/**
 * A run is identified by an 8-character code rather than a raw integer, so it
 * can be read off the screen and typed back in. I and O are left out because
 * they are indistinguishable from 1 and 0 when someone copies one by hand.
 */
export const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

export function randomSeedString(rand = Math.random){
  let out = '';
  for (let i = 0; i < 8; i++) out += SEED_ALPHABET[(rand() * SEED_ALPHABET.length) | 0];
  return out;
}

/** Fold anything the user typed into a legal 8-character code. */
export function normaliseSeed(str){
  const up = String(str || '').toUpperCase().replace(/O/g, '0').replace(/I/g, '1');
  const kept = [...up].filter(ch => SEED_ALPHABET.includes(ch)).join('');
  if (!kept) return null;
  return kept.slice(0, 8).padEnd(8, SEED_ALPHABET[0]);
}

/** The code is the identity; the integer the generator wants is derived. */
export function seedFromString(code){
  let h = 2166136261;
  for (let i = 0; i < code.length; i++){ h ^= code.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Daily code: same eight characters for everybody, for the whole day. */
export function dailySeedString(){
  let n = (dayKey() * 2654435761) >>> 0;
  let out = '';
  for (let i = 0; i < 8; i++){ out += SEED_ALPHABET[n % SEED_ALPHABET.length]; n = Math.floor(n / 3) + 7919; }
  return out;
}

/** @returns {{code:string, value:number}} */
export function resolveSeed(mode, typed){
  const code = mode.seeded ? dailySeedString() : (normaliseSeed(typed) || randomSeedString());
  return { code, value: seedFromString(code) };
}
