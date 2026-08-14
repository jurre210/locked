// Local records only. Nothing leaves the machine.
const KEY = 'locked.records.v1';

let data = load();

function load(){
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch(e){ return {}; }
}
function save(){
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(e){}
}

export function rec(key){
  return data[key] || { plays:0, best:null, last:null, bestQ:0, totalQ:0 };
}

/**
 * @param {string} key game key
 * @param {number} value the raw display score
 * @param {number} q quality 0..1
 * @param {boolean} higherBetter
 * @returns {boolean} true if this was a personal best
 */
export function submit(key, value, q, higherBetter = true){
  const r = rec(key);
  r.plays++;
  r.last = value;
  r.totalQ = (r.totalQ || 0) + q;
  let pb = false;
  if (r.best === null || (higherBetter ? value > r.best : value < r.best)){
    if (r.plays > 1) pb = true;
    r.best = value;
  }
  if (q > (r.bestQ || 0)) r.bestQ = q;
  data[key] = r;
  save();
  return pb;
}

export function all(){ return { ...data }; }

export function wipe(){ data = {}; save(); }

/** Overall "dialed rating" — mean of best qualities across played games, 0-100. */
export function rating(){
  const vals = Object.values(data).filter(r => r.plays > 0).map(r => r.bestQ || 0);
  if (!vals.length) return null;
  const mean = vals.reduce((a,b)=>a+b,0) / vals.length;
  // reward breadth a little
  const breadth = Math.min(1, vals.length / 10);
  return Math.round((mean * 0.85 + breadth * 0.15) * 100);
}
