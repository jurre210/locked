// Tyre smoke for burnout clips. A model opts in with a node whose extras carry
//   burnout: { wheels: [node names], radius, start, full, end }   (seconds on the clip's timeline)
// Soft billboard puffs (one instanced draw), thrown back and out from each wheel's contact patch,
// growing, rising and thinning; lit from the scene's sun on one side. Time follows the animation:
// paused clip = frozen smoke, loop restart = the cloud drifts off while the wheels are still again.
import * as THREE from 'three';

const MAX = 1100;

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  let s = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 5; o++) { s += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return s / 0.97;
}
const smooth = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };

// 2x2 atlas of ragged, lumpy puffs
function puffAtlas() {
  const N = 128, c = document.createElement('canvas');
  c.width = c.height = N * 2;
  const g = c.getContext('2d');
  const img = g.createImageData(N * 2, N * 2);
  for (let tile = 0; tile < 4; tile++) {
    const ox = (tile % 2) * N, oy = Math.floor(tile / 2) * N, seed = tile * 17.31 + 3.7;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = ((x + 0.5) / N) * 2 - 1, v = ((y + 0.5) / N) * 2 - 1;
      const n = fbm(u * 2.3 + seed, v * 2.3 - seed);
      const edge = Math.hypot(u, v) * 1.08 + (n - 0.5) * 0.6;
      const a = Math.min(Math.max(smooth(1.0, 0.25, edge) * (0.45 + 0.75 * n), 0), 1);
      const i = ((oy + y) * N * 2 + ox + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const VERT = /* glsl */`
attribute vec3 iPos;
attribute vec4 iData;            // size, alpha, rotation, atlas tile
attribute float iShade;
uniform vec3 uSunView;           // direction to the sun, view space
varying vec2 vLocal;
varying vec2 vTile;
varying vec2 vSun;               // sun direction in the puff's own texture space
varying float vAlpha;
varying float vShade;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iData.z), s = sin(iData.z);
  mv.xy += mat2(c, s, -s, c) * position.xy * iData.x;
  gl_Position = projectionMatrix * mv;
  vec2 sd = uSunView.xy;
  float sl = length(sd);
  vSun = mat2(c, -s, s, c) * (sl > 1e-3 ? sd / sl : vec2(0.0, 1.0)) * min(sl * 1.5, 1.0);
  vLocal = uv;
  vTile = vec2(mod(iData.w, 2.0), floor(iData.w / 2.0));
  vAlpha = iData.y;
  vShade = iShade;
}`;

// one-step light march toward the sun inside each puff: thick parts on the far side go dark, the rim
// facing the sun glows; front-lit smoke is bright all over, back-lit smoke glows only where it is thin
const FRAG = /* glsl */`
uniform sampler2D map;
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uSunView;
varying vec2 vLocal;
varying vec2 vTile;
varying vec2 vSun;
varying float vAlpha;
varying float vShade;
float A(vec2 l) { return texture2D(map, (clamp(l, 0.0, 1.0) + vTile) * 0.5).a; }
void main() {
  float a0 = A(vLocal);
  float a = a0 * vAlpha;
  if (a < 0.003) discard;
  float d = A(vLocal + vSun * 0.12) + 0.8 * A(vLocal + vSun * 0.25);
  float light = exp(-1.3 * d);
  light = mix(light, 0.9 - 0.3 * a0, clamp(uSunView.z, 0.0, 1.0));
  light = mix(light, exp(-2.2 * a0) * 1.25, clamp(-uSunView.z, 0.0, 1.0) * 0.7);
  vec3 col = mix(uShade, uLit, clamp(light, 0.0, 1.2)) * vShade;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Smoke {
  constructor(scene) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aShade = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iData', this.aData);
    geo.setAttribute('iShade', this.aShade);
    geo.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: {
        map: { value: puffAtlas() },
        uLit: { value: new THREE.Color(0.95, 0.93, 0.9) },
        uShade: { value: new THREE.Color(0.42, 0.43, 0.47) },
        uSunView: { value: new THREE.Vector3(0, 1, 0) },
      },
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.parts = [];
    this.order = [];
    this.recipe = null;
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }

  attach(root) {
    this.detach();
    let host = null;
    root.traverse((o) => { if (!host && o.userData && o.userData.burnout) host = o; });
    if (!host) return false;
    const raw = host.userData.burnout;
    const r = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const wheels = r.wheels.map((n) => root.getObjectByName(n)).filter(Boolean);
    if (!wheels.length) return false;
    this.root = root;
    this.recipe = r;
    this.wheels = wheels.map(() => ({ acc: 0 }));
    this.wheelNodes = wheels;
    this.mesh.visible = true;
    return true;
  }

  detach() {
    this.recipe = null;
    this.root = null;
    this.parts.length = 0;
    this.mesh.visible = false;
    this.mesh.geometry.instanceCount = 0;
  }

  // colours follow the scene light: sunlit side takes the sun's colour, the shadow side the sky's
  setLight(sunColor, sunIntensity, envOn) {
    // white smoke tinted by the sun on its lit side, by the sky on its shaded side
    const lit = this.mat.uniforms.uLit.value.setRGB(1, 1, 1).lerp(sunColor, 0.4);
    lit.multiplyScalar((envOn ? 0.95 : 0.9) * Math.min(0.75 + 0.1 * sunIntensity, 1.1));
    this.mat.uniforms.uShade.value.setRGB(0.34, 0.37, 0.44).multiplyScalar(envOn ? 1.0 : 1.15);
  }

  rate(t) {
    const r = this.recipe;
    if (t < r.start || t > r.end) return 0;
    return 46 * smooth(r.start, r.full + 0.6, t) * (0.8 + 0.2 * Math.sin(t * 9.0));
  }

  spawn(w, frac, t) {
    const node = this.wheelNodes[w];
    const hub = node.getWorldPosition(this.tmp);
    const centre = this.root.getWorldPosition(this.tmp2);
    const out = Math.sign(hub.z - centre.z) || 1;
    const k = smooth(this.recipe.start, this.recipe.full + 0.4, t);
    const R = this.recipe.radius || 0.32;
    if (this.parts.length >= MAX) this.parts.shift();
    const kind = Math.random();
    const p = {
      x: hub.x - 0.05 - Math.random() * 0.35, y: 0.08 + Math.random() * 0.15, z: hub.z + (Math.random() - 0.5) * 0.24,
      vx: -(0.8 + Math.random() * 4.7) * (0.4 + 0.6 * k), vy: 0.25 + Math.random() * 0.75,
      vz: out * (0.2 + Math.random() * 1.4) + (Math.random() - 0.5) * 0.6,
      age: frac, life: 4.0 + Math.random() * 2.5, s0: 0.3 + Math.random() * 0.2, s1: 2.6 + Math.random() * 2.0,
      rot: Math.random() * 6.283, rv: (Math.random() - 0.5) * 0.7, tile: Math.floor(Math.random() * 4),
      peak: 0.14 + Math.random() * 0.12, ph: Math.random() * 6.283, shade: 0.82 + Math.random() * 0.26,
    };
    if (kind < 0.2) {                 // billowing out of the wheel arch
      p.x = hub.x + (Math.random() - 0.5) * 0.5; p.y = R * (1.0 + Math.random() * 0.5);
      p.z = hub.z + out * 0.15; p.vx *= 0.3; p.vy = 0.5 + Math.random() * 0.6; p.vz = out * (0.6 + Math.random() * 1.0);
    } else if (kind < 0.32) {         // rolling forward along the ground beside the car
      p.vx = 0.3 + Math.random() * 1.0; p.vz = out * (0.8 + Math.random() * 1.2); p.vy = 0.1 + Math.random() * 0.3;
    }
    this.parts.push(p);
  }

  update(dt, t, camera, sunPos) {
    if (!this.recipe) return;
    if (dt > 0) {
      const r = this.rate(t);
      this.wheels.forEach((w, i) => {
        w.acc += r * dt;
        while (w.acc >= 1) { w.acc -= 1; this.spawn(i, w.acc / Math.max(r, 1e-3), t); }
      });
      const drag = Math.exp(-1.3 * dt);
      let n = 0;
      for (const p of this.parts) {
        p.age += dt;
        if (p.age >= p.life) continue;
        p.vx = p.vx * drag - 0.12 * dt;
        p.vz = p.vz * drag + Math.cos(p.age * 1.1 + p.ph * 1.7) * 0.45 * dt;
        p.vy = p.vy * drag + 0.28 * dt + Math.sin(p.age * 1.3 + p.ph) * 0.2 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rot += p.rv * dt;
        this.parts[n++] = p;
      }
      this.parts.length = n;
    }
    // write instances back to front
    const cam = camera.position, dir = camera.getWorldDirection(this.tmp);
    const P = this.parts;
    this.order.length = P.length;
    for (let i = 0; i < P.length; i++) this.order[i] = i;
    const depth = (p) => (p.x - cam.x) * dir.x + (p.y - cam.y) * dir.y + (p.z - cam.z) * dir.z;
    for (const p of P) p.d = depth(p);
    this.order.sort((a, b) => P[b].d - P[a].d);
    const pos = this.aPos.array, dat = this.aData.array, sh = this.aShade.array;
    for (let j = 0; j < this.order.length; j++) {
      const p = P[this.order[j]];
      const u = p.age / p.life;
      const size = p.s0 + (p.s1 - p.s0) * (1 - Math.exp(-p.age * 0.7));
      const a = p.peak * smooth(0, 0.18, p.age) * Math.pow(1 - u, 1.4);
      pos[j * 3] = p.x; pos[j * 3 + 1] = Math.max(p.y, size * 0.28); pos[j * 3 + 2] = p.z;
      dat[j * 4] = size; dat[j * 4 + 1] = a; dat[j * 4 + 2] = p.rot; dat[j * 4 + 3] = p.tile;
      sh[j] = p.shade;
    }
    this.mesh.geometry.instanceCount = this.order.length;
    this.aPos.needsUpdate = this.aData.needsUpdate = this.aShade.needsUpdate = true;
    if (sunPos) this.mat.uniforms.uSunView.value.copy(sunPos).transformDirection(camera.matrixWorldInverse);
  }
}
