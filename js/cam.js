// Camera rig for the locked viewer: view presets that fly along an arc (never under the ground), a lens
// choice that keeps the framing, double-click to focus on a part, and a walk mode to go round the model on
// foot (WASD + drag, Q/E eye height, shift run, scroll zoom). Models can add their own views in models.json:
//   "views": { "wheel": { "pos": [x,y,z], "target": [x,y,z], "fov": 30 }, ... }   (viewer coordinates)
import * as THREE from 'three';

const LENSES = [[24, 53.1], [35, 37.8], [50, 27.0], [85, 16.1]];          // full-frame mm -> vertical fov
const VIEWS = [
  ['¾ front', [0.75, 0.38, 1.0]], ['front', [1, 0.13, 0]], ['side', [0, 0.13, 1]], ['¾ rear', [-0.8, 0.3, 0.95]],
  ['rear', [-1, 0.13, 0]], ['top', [0.002, 1, 0.002]], ['low', [0.9, 0.07, 0.62]],
];
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class CameraRig {
  constructor({ camera, controls, canvas, state, limits }) {
    Object.assign(this, { camera, controls, canvas, state, limits });
    this.fly = null;
    this.walking = false;
    this.keys = new Set();
    this.lensFov = 37.8;
    this.yaw = 0; this.pitch = 0; this.eye = 1.6;
    this.ray = new THREE.Raycaster();
    this.ui = {
      views: document.getElementById('cam-views'), lens: document.getElementById('cam-lens'),
      walk: document.getElementById('cam-walk'), hint: document.getElementById('walk-hint'),
    };
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    this.buildLens();
    this.ui.walk.onclick = () => this.setWalk(!this.walking);
    canvas.addEventListener('dblclick', (e) => { if (!this.walking) this.focusAt(e); });
    canvas.addEventListener('pointerdown', (e) => this.lookStart(e));
    canvas.addEventListener('pointermove', (e) => this.lookMove(e));
    window.addEventListener('pointerup', () => { this.drag = null; });
    canvas.addEventListener('wheel', (e) => this.walkZoom(e), { passive: false });
    window.addEventListener('keydown', (e) => {
      if (!this.walking || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { this.setWalk(false); return; }
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        this.keys.add(k);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // ---------------------------------------------------------------- per model
  setModel(meta) {
    this.meta = meta || {};
    if (this.walking) this.setWalk(false);
    this.fly = null;
    const custom = Object.entries(this.meta.views || {});
    this.ui.views.innerHTML = '';
    for (const [name, v] of [...VIEWS, ...custom]) {
      const b = document.createElement('button');
      b.textContent = name;
      b.onclick = () => this.view(name, v);
      this.ui.views.appendChild(b);
    }
  }

  markView(name) {
    for (const b of this.ui.views.children) b.classList.toggle('on', b.textContent === name);
  }

  fitDist(dir) {
    const s = this.state.size || new THREE.Vector3(1, 1, 1);
    const tv = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2), th = tv * this.camera.aspect;
    // extent of the box as seen along dir (horizontal footprint vs height)
    const d = new THREE.Vector3(...dir).normalize();
    const across = Math.abs(d.z) * s.x + Math.abs(d.x) * s.z;
    const along = Math.abs(d.x) * s.x + Math.abs(d.z) * s.z;
    const tall = Math.sqrt(1 - d.y * d.y) * s.y + Math.abs(d.y) * along;
    return Math.max(tall / 2 / tv, Math.max(across, Math.abs(d.y) * Math.max(s.x, s.z)) / 2 / th) * 1.25 + along / 2;
  }

  view(name, v) {
    if (this.walking) this.setWalk(false);
    this.markView(name);
    const c = this.state.center;
    if (Array.isArray(v)) {
      const dir = new THREE.Vector3(...v).normalize();
      const dist = Math.min(this.fitDist(v), this.limits().maxDist * 0.95);
      this.flyTo(c.clone().addScaledVector(dir, dist), c.clone(), this.lensFov);
    } else {
      this.flyTo(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target), v.fov ?? this.lensFov, v.inside);
    }
  }

  flyTo(pos, target, fov = this.camera.fov, inside = false, dur = 1.0) {
    const t0 = this.controls.target.clone(), p0 = this.camera.position.clone();
    this.fly = {
      t0, t1: target, f0: this.camera.fov, f1: fov, k: 0, dur,
      s0: new THREE.Spherical().setFromVector3(p0.clone().sub(t0)),
      s1: new THREE.Spherical().setFromVector3(pos.clone().sub(target)), inside,
    };
    this.controls.enabled = false;
    // inside a car the orbit limits would push the camera back out
    this.controls.minDistance = inside ? 0.01 : this.state.radius * 0.25;
  }

  buildLens() {
    this.ui.lens.innerHTML = '';
    for (const [mm, fov] of LENSES) {
      const b = document.createElement('button');
      b.textContent = mm;
      b.title = `${mm} mm lens`;
      b.classList.toggle('on', fov === this.lensFov);
      b.onclick = () => this.setLens(fov);
      this.ui.lens.appendChild(b);
    }
  }

  setLens(fov) {
    const old = this.camera.fov;
    this.lensFov = fov;
    [...this.ui.lens.children].forEach((b, i) => b.classList.toggle('on', LENSES[i][1] === fov));
    if (this.walking) { this.zoomFov = fov; return; }
    // dolly so the subject keeps its size in frame
    const t = this.controls.target, off = this.camera.position.clone().sub(t);
    const k = Math.tan(THREE.MathUtils.degToRad(old) / 2) / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const len = THREE.MathUtils.clamp(off.length() * k, this.controls.minDistance, this.limits().maxDist);
    this.flyTo(t.clone().add(off.setLength(len)), t.clone(), fov, false, 0.7);
  }

  // ---------------------------------------------------------------- double-click focus
  focusAt(e) {
    const root = this.state.root;
    if (!root) return;
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.ray.intersectObject(root, true).find((h) => h.object.visible);
    const t = this.controls.target, dir = this.camera.position.clone().sub(t).normalize();
    this.markView('');
    if (hit) {
      const d = Math.max(this.state.radius * 0.45, 1.1);
      this.flyTo(hit.point.clone().addScaledVector(dir, d), hit.point.clone(), this.camera.fov, false, 0.8);
    } else {
      const c = this.state.center;
      this.flyTo(c.clone().addScaledVector(dir, this.fitDist(dir.toArray())), c.clone(), this.camera.fov, false, 0.8);
    }
  }

  // ---------------------------------------------------------------- walk mode
  setWalk(on) {
    this.walking = on;
    this.fly = null;
    this.keys.clear();
    this.ui.walk.classList.toggle('on', on);
    this.ui.hint.hidden = !on;
    this.controls.enabled = !on;
    this.canvas.style.cursor = on ? 'crosshair' : '';
    this.markView('');
    const cam = this.camera;
    if (on) {
      const c = this.state.center;
      const p = cam.position;
      const flat = new THREE.Vector3(p.x - c.x, 0, p.z - c.z);
      const box = this.box();
      // start on foot where the camera is (outside the model, inside the scene)
      if (flat.length() < box.r + 1.2) flat.setLength(box.r + 1.6);
      flat.setLength(Math.min(flat.length(), this.limits().maxDist * 0.9));
      p.set(c.x + flat.x, 1.6, c.z + flat.z);
      this.eye = 1.6;
      const look = c.clone().sub(p);
      this.yaw = Math.atan2(-look.x, -look.z);
      this.pitch = Math.atan2(look.y, Math.hypot(look.x, look.z));
      this.zoomFov = this.lensFov;
    } else {
      // back to orbiting round the model from where you stand
      const c = this.state.center;
      const off = cam.position.clone().sub(c);
      off.setLength(THREE.MathUtils.clamp(off.length(), this.state.radius * 0.6, this.limits().maxDist));
      if (off.y < 0.15) off.y = 0.15;
      this.flyTo(c.clone().add(off), c.clone(), this.lensFov, false, 0.6);
    }
  }

  box() {
    const s = this.state.size, c = this.state.center;
    return { x0: c.x - s.x / 2 - 0.35, x1: c.x + s.x / 2 + 0.35, z0: c.z - s.z / 2 - 0.35, z1: c.z + s.z / 2 + 0.35,
             top: s.y + 0.25, r: Math.hypot(s.x, s.z) / 2 };
  }

  lookStart(e) {
    if (!this.walking) return;
    this.drag = { x: e.clientX, y: e.clientY };
    this.canvas.setPointerCapture?.(e.pointerId);
  }

  lookMove(e) {
    if (!this.walking || !this.drag) return;
    const k = 0.0042 * (this.camera.fov / 40);
    this.yaw -= (e.clientX - this.drag.x) * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - this.drag.y) * k, -1.45, 1.45);
    this.drag = { x: e.clientX, y: e.clientY };
  }

  walkZoom(e) {
    if (!this.walking) return;
    e.preventDefault();
    this.zoomFov = THREE.MathUtils.clamp((this.zoomFov || this.camera.fov) * (1 + Math.sign(e.deltaY) * 0.08), 14, 80);
  }

  // ---------------------------------------------------------------- per frame; true = the rig drove the camera
  update(dt) {
    const cam = this.camera;
    if (this.fly) {
      const f = this.fly;
      f.k = Math.min(f.k + dt / f.dur, 1);
      const e = ease(f.k);
      const tgt = f.t0.clone().lerp(f.t1, e);
      const s = new THREE.Spherical(
        THREE.MathUtils.lerp(f.s0.radius, f.s1.radius, e),
        THREE.MathUtils.lerp(f.s0.phi, f.s1.phi, e),
        f.s0.theta + wrap(f.s1.theta - f.s0.theta) * e);
      cam.position.setFromSpherical(s).add(tgt);
      cam.fov = THREE.MathUtils.lerp(f.f0, f.f1, e);
      cam.updateProjectionMatrix();
      this.controls.target.copy(tgt);
      cam.lookAt(tgt);
      if (f.k >= 1) {
        this.fly = null;
        this.controls.enabled = !this.walking;
        this.controls.update();
      }
      return true;
    }
    if (!this.walking) return false;
    const K = this.keys;
    const run = K.has('shift') ? 5.5 : 2.2;
    const fwd = (K.has('w') || K.has('arrowup') ? 1 : 0) - (K.has('s') || K.has('arrowdown') ? 1 : 0);
    const side = (K.has('d') || K.has('arrowright') ? 1 : 0) - (K.has('a') || K.has('arrowleft') ? 1 : 0);
    const up = (K.has('e') ? 1 : 0) - (K.has('q') ? 1 : 0);
    const p = cam.position;
    if (fwd || side) {
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const v = new THREE.Vector3(-sy * fwd + cy * side, 0, -cy * fwd - sy * side).normalize().multiplyScalar(run * dt);
      p.add(v);
    }
    this.eye = THREE.MathUtils.clamp(this.eye + up * 1.4 * dt, 0.3, 3.2);
    p.y += (this.eye - p.y) * Math.min(1, dt * 10);
    // stay out of the bodywork (unless above it) and inside the scene
    const b = this.box();
    if (p.y < b.top && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1) {
      const push = [[p.x - b.x0, 'x', b.x0], [b.x1 - p.x, 'x', b.x1], [p.z - b.z0, 'z', b.z0], [b.z1 - p.z, 'z', b.z1]]
        .sort((m, n) => m[0] - n[0])[0];
      p[push[1]] = push[2];
    }
    const c = this.state.center, lim = this.limits().maxDist;
    const flat = new THREE.Vector2(p.x - c.x, p.z - c.z);
    if (flat.length() > lim) { flat.setLength(lim); p.x = c.x + flat.x; p.z = c.z + flat.y; }
    cam.fov += ((this.zoomFov || cam.fov) - cam.fov) * Math.min(1, dt * 8);
    cam.updateProjectionMatrix();
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    return true;
  }
}
