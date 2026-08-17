/**
 * Input for up to four local players, plus gamepads.
 *
 * Player 1 gets WASD + arrows (or mouse aim, which switches on the moment the
 * mouse is used and back off the moment a key is). Player 2 gets IJKL + numpad.
 * Players 3 and 4 are gamepad only — there is no third sane keyboard layout,
 * and pretending otherwise just produces a control scheme nobody can use.
 */

const EMPTY = { mx:0, my:0, ax:0, ay:0, active:false, bomb:false, card:false, map:false, drop:false, pause:false };

export const LAYOUTS = [
  {
    name:'WASD + arrows',
    move:{ up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD' },
    aim:{ up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight' },
    active:'KeyE', bomb:'Space', card:'KeyQ', map:'Tab', drop:'KeyR'
  },
  {
    name:'IJKL + numpad',
    move:{ up:'KeyI', down:'KeyK', left:'KeyJ', right:'KeyL' },
    aim:{ up:'Numpad8', down:'Numpad5', left:'Numpad4', right:'Numpad6' },
    active:'KeyU', bomb:'KeyO', card:'KeyP', map:'KeyM', drop:'KeyN'
  }
];

export class Input {
  constructor(life, canvas){
    this.keys = new Set();
    this.pressed = new Set();     // edge-triggered, cleared each frame
    this.mouse = { x:0, y:0, down:false, active:false, inside:false };
    this.pads = [];               // gamepad index per player slot
    this.canvas = canvas;
    this.useMouse = false;

    life.on(window, 'keydown', e => {
      if (e.repeat) return;
      // the game owns these keys while it is on screen
      if (['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.useMouse = false;
    });
    life.on(window, 'keyup', e => this.keys.delete(e.code));
    life.on(window, 'blur', () => { this.keys.clear(); });

    life.on(canvas, 'pointermove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) / r.width;
      this.mouse.y = (e.clientY - r.top) / r.height;
      this.mouse.inside = true;
      if (e.movementX || e.movementY) this.useMouse = true;
    });
    life.on(canvas, 'pointerdown', e => { this.mouse.down = true; this.useMouse = true; canvas.setPointerCapture?.(e.pointerId); });
    life.on(window, 'pointerup', () => { this.mouse.down = false; });
    life.on(canvas, 'pointerleave', () => { this.mouse.inside = false; });
    life.on(canvas, 'contextmenu', e => e.preventDefault());
  }

  /** Call once per frame, before reading any player state. */
  poll(){
    this.padStates = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean);
  }
  endFrame(){ this.pressed.clear(); }

  down(code){ return this.keys.has(code); }
  hit(code){ return this.pressed.has(code); }

  /** Gamepad for a player slot, or null. Slot 0 takes pad 0 only if it exists. */
  padFor(slot){
    const list = this.padStates || [];
    return list[slot] || null;
  }

  /**
   * Resolved state for one local player.
   * @param {number} slot 0-based local player index
   * @param {object} ctx { px, py, view } for mouse aiming
   */
  read(slot, ctx){
    const out = { ...EMPTY };
    const L = LAYOUTS[slot];
    const pad = this.padFor(slot);

    if (L){
      const ax = (this.down(L.move.right) ? 1 : 0) - (this.down(L.move.left) ? 1 : 0);
      const ay = (this.down(L.move.down) ? 1 : 0) - (this.down(L.move.up) ? 1 : 0);
      out.mx += ax; out.my += ay;
      const fx = (this.down(L.aim.right) ? 1 : 0) - (this.down(L.aim.left) ? 1 : 0);
      const fy = (this.down(L.aim.down) ? 1 : 0) - (this.down(L.aim.up) ? 1 : 0);
      out.ax += fx; out.ay += fy;
      out.active = this.hit(L.active);
      out.bomb = this.hit(L.bomb);
      out.card = this.hit(L.card);
      out.map = this.down(L.map);
      out.drop = this.hit(L.drop);
    }

    // mouse aim for player one: point and hold
    if (slot === 0 && this.useMouse && this.mouse.down && ctx && !out.ax && !out.ay){
      const dx = this.mouse.x * ctx.vw - ctx.px;
      const dy = this.mouse.y * ctx.vh - ctx.py;
      const d = Math.hypot(dx, dy) || 1;
      out.ax = dx / d; out.ay = dy / d;
    }

    if (pad){
      const dz = v => Math.abs(v) > 0.28 ? v : 0;
      out.mx += dz(pad.axes[0] || 0);
      out.my += dz(pad.axes[1] || 0);
      out.ax += dz(pad.axes[2] || 0);
      out.ay += dz(pad.axes[3] || 0);
      const b = pad.buttons || [];
      const pressed = i => b[i] && b[i].pressed;
      // d-pad doubles as movement
      if (pressed(12)) out.my -= 1;
      if (pressed(13)) out.my += 1;
      if (pressed(14)) out.mx -= 1;
      if (pressed(15)) out.mx += 1;
      out.active = out.active || this.padEdge(slot, 'a', pressed(0));
      out.bomb   = out.bomb   || this.padEdge(slot, 'b', pressed(1) || pressed(7));
      out.card   = out.card   || this.padEdge(slot, 'c', pressed(2));
      out.drop   = out.drop   || this.padEdge(slot, 'd', pressed(3));
      out.map    = out.map    || pressed(8);
      out.pause  = out.pause  || this.padEdge(slot, 'p', pressed(9));
      if (pressed(6)) { /* left trigger reserved */ }
    }

    const m = Math.hypot(out.mx, out.my);
    if (m > 1){ out.mx /= m; out.my /= m; }
    const a = Math.hypot(out.ax, out.ay);
    if (a > 1){ out.ax /= a; out.ay /= a; }
    return out;
  }

  padEdge(slot, k, now){
    this._pe = this._pe || {};
    const key = slot + k;
    const was = this._pe[key];
    this._pe[key] = now;
    return now && !was;
  }

  /** True while any gamepad is connected, for the controls hint. */
  anyPad(){ return (this.padStates || []).length > 0; }
}

/** Human-readable control list, shown on the pause screen. */
export const CONTROL_HELP = [
  ['move', 'W A S D'],
  ['shoot', 'arrow keys, or hold left mouse'],
  ['bomb', 'space'],
  ['use item', 'E'],
  ['card / pill', 'Q'],
  ['drop trinket', 'R'],
  ['map', 'hold Tab'],
  ['pause', 'Esc'],
  ['player 2', 'I J K L to move, numpad 8 4 5 6 to shoot'],
  ['controllers', 'plug one in — it takes the next free slot']
];
