// Slow colour field behind everything. Black base, colour that drifts.
// Six blurred blobs on the GPU — no canvas, no per-frame JS.

const PALETTES = {
  home:       ['#ff3d81', '#4d7cff', '#00e0c6', '#ffb703', '#b14dff', '#ff5c39'],
  perception: ['#ff2d78', '#ffb703', '#00d4ff', '#b14dff', '#ff5c39', '#3dff9e'],
  reflex:     ['#ff5c39', '#ff2d55', '#ffb703', '#ff8a00', '#ff3d81', '#ffd84d'],
  memory:     ['#7b5cff', '#4d7cff', '#b14dff', '#2ee6ff', '#5c9dff', '#e05cff'],
  sound:      ['#00e0a4', '#3dff9e', '#00d4ff', '#4d7cff', '#2ee6c9', '#8affc1'],
  mind:       ['#ffb703', '#ff6f3d', '#ff3d81', '#ffe14d', '#ff9d5c', '#c94dff']
};

let layer = null;
let blobs = [];
let current = '';

export function mount(){
  if (layer) return;
  layer = document.createElement('div');
  layer.id = 'bg';
  const grain = document.createElement('div');
  grain.id = 'bg-grain';
  for (let i = 0; i < 6; i++){
    const b = document.createElement('div');
    b.className = 'blob';
    // each blob gets its own lazy orbit so they never sync up
    b.style.setProperty('--dur', (26 + i * 7) + 's');
    b.style.setProperty('--delay', (-i * 5.5) + 's');
    b.style.setProperty('--x', (8 + (i * 37) % 84) + '%');
    b.style.setProperty('--y', (12 + (i * 53) % 72) + '%');
    b.style.setProperty('--s', (0.75 + (i % 3) * 0.32).toFixed(2));
    layer.append(b);
    blobs.push(b);
  }
  document.body.prepend(layer);
  document.body.append(grain);
}

/** Swap the palette. `cat` is a category name, or 'home'. */
export function theme(cat){
  const key = PALETTES[cat] ? cat : 'home';
  if (key === current) return;
  current = key;
  const p = PALETTES[key];
  blobs.forEach((b, i) => { b.style.background = p[i % p.length]; });
}

/** A quick pulse of brightness — used on a good result. */
export function pulse(strength = 1){
  if (!layer) return;
  layer.style.transition = 'none';
  layer.style.opacity = String(Math.min(1, 0.9 * strength));
  requestAnimationFrame(() => {
    layer.style.transition = 'opacity 1.4s cubic-bezier(.22,.61,.36,1)';
    layer.style.opacity = '';
  });
}
