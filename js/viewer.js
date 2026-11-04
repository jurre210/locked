// locked — 3d: a gallery + viewer for models exported from Blender (.glb, Draco ok, animations ok).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import { applyWear, wearTime } from './wear.js?v=10';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const stage = $('stage');

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // keeps blacks black (AgX lifted them to grey)
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 500);
camera.position.set(3, 1.5, 3);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 1.2;

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0x9fb4ff, 0.0);
scene.add(rim);

const shadowFloor = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.ShadowMaterial({ opacity: 0.45 }));
shadowFloor.rotation.x = -Math.PI / 2;
shadowFloor.receiveShadow = true;
scene.add(shadowFloor);
const grid = new THREE.GridHelper(1, 20, 0x2a2a30, 0x18181c);
grid.visible = false;
scene.add(grid);

const LIGHTS = [
  { name: 'studio', env: 0.6, sun: 2.4, sunCol: 0xffffff, dir: [3, 5, 2], rim: 0.0, exp: 0.95 },
  { name: 'sunset', env: 0.3, sun: 3.4, sunCol: 0xffb070, dir: [-4, 1.6, 2.5], rim: 0.6, exp: 1.0 },
  { name: 'night', env: 0.06, sun: 0.25, sunCol: 0x8fa6ff, dir: [-2, 4, -3], rim: 1.4, exp: 1.2 },
];
let lightIdx = 0;

// per-model surroundings: a 360° render of the model's own scene, projected with a flat ground
const env = { data: null, sky: null, pmrem: null, on: true, cache: new Map() };
const texLoader = new THREE.TextureLoader();
const hdrLoader = new RGBELoader();

async function loadEnv(spec) {
  if (!spec) { env.data = null; applyLight(); return; }
  let e = env.cache.get(spec.background);
  if (!e) {
    const prep = (bg) => {
      bg.mapping = THREE.EquirectangularReflectionMapping;
      bg.colorSpace = THREE.SRGBColorSpace;
      bg.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return bg;
    };
    // a small preview panorama goes up first; the full-resolution one replaces it when it arrives
    const full = texLoader.loadAsync(spec.background).then(prep);
    const [bg, hdr] = await Promise.all([spec.preview ? texLoader.loadAsync(spec.preview).then(prep) : full,
                                         hdrLoader.loadAsync(spec.hdr)]);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const sky = new GroundedSkybox(bg, spec.height, spec.radius, 160);
    sky.position.y = spec.height - 0.01;
    sky.material.toneMapped = false;       // the panorama is already graded like the Blender renders
    e = { spec, sky, pmrem: pmrem.fromEquirectangular(hdr).texture };
    hdr.dispose();
    env.cache.set(spec.background, e);
    if (spec.preview) {
      full.then((tex) => { sky.material.map = tex; sky.material.needsUpdate = true; bg.dispose(); })
        .catch((err) => console.warn('full panorama failed', err));
    }
  }
  env.data = e;
  applyLight();
}

// ---------------------------------------------------------------- state
const state = { models: [], current: null, root: null, mixer: null, duration: 0, playing: true, speed: 1,
                radius: 1, center: new THREE.Vector3(), wire: false, seeking: false };
const clock = new THREE.Clock();
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
loader.setDRACOLoader(draco);
draco.preload();                       // fetch + compile the decoder while the model downloads

function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(r.height, 1);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

function applyLight() {
  const r = state.radius;
  const E = env.on && env.data;
  for (const e of env.cache.values()) scene.remove(e.sky);
  $('t-bg').hidden = !env.data;
  $('t-bg').classList.toggle('on', !!E);
  $('t-light').hidden = !!E;
  if (E) {
    // the scene's own sky: HDR light + matching sun + projected surroundings
    const s = E.spec;
    scene.add(E.sky);
    scene.environment = E.pmrem;
    scene.environmentIntensity = s.envIntensity ?? 1.0;
    sun.intensity = s.sunIntensity ?? 3.0;
    sun.color.set(s.sunColor ?? '#fff1dc');
    sun.position.set(...s.sun).normalize().multiplyScalar(r * 4).add(state.center);
    rim.intensity = 0;
    renderer.toneMappingExposure = s.exposure ?? 0.8;
    shadowFloor.material.opacity = s.shadow ?? 0.55;
    grid.visible = false;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;          // stay above the projected ground
    controls.maxDistance = Math.min(r * 12, s.radius * 0.45);
    $('light-name').textContent = 'scene';
  } else {
    const L = LIGHTS[lightIdx];
    scene.environment = envTex;
    scene.environmentIntensity = L.env;
    sun.intensity = L.sun;
    sun.color.setHex(L.sunCol);
    sun.position.set(...L.dir).normalize().multiplyScalar(r * 4).add(state.center);
    rim.intensity = L.rim;
    rim.position.set(-L.dir[0], 2, -L.dir[2]).normalize().multiplyScalar(r * 4).add(state.center);
    renderer.toneMappingExposure = L.exp;
    shadowFloor.material.opacity = 0.45;
    controls.maxPolarAngle = Math.PI;
    controls.maxDistance = r * 12;
    $('light-name').textContent = L.name;
  }
  sun.target.position.copy(state.center);
}

function frameView() {
  const r = state.radius, c = state.center, s = state.size || new THREE.Vector3(r, r, r);
  // fit the box height to the vertical fov and its longest side to the horizontal fov
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const th = tv * camera.aspect;
  const depth = Math.min(s.x, s.z) / 2;
  const dist = Math.max((s.y / 2) / tv, (Math.max(s.x, s.z) / 2) / th) * 1.35 + depth;
  camera.position.copy(c).add(new THREE.Vector3(0.75, 0.38, 1.0).normalize().multiplyScalar(dist));
  camera.near = dist / 100;
  camera.far = dist * 50;
  camera.updateProjectionMatrix();
  controls.target.copy(c);
  controls.minDistance = r * 0.25;
  controls.update();
}

// ---------------------------------------------------------------- loading
function clearModel() {
  if (state.mixer) state.mixer.stopAllAction();
  if (state.root) {
    scene.remove(state.root);
    state.root.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
  }
  state.root = state.mixer = state.follow = state.chain = null;
  state.duration = 0;
}

function showError(msg) {
  $('error').textContent = msg;
  $('error').hidden = false;
}

let loadToken = 0;
function load(url, meta, size) {
  const token = ++loadToken;
  clearModel();
  $('error').hidden = true;
  $('loading').hidden = false;
  $('bar').style.width = '0%';
  $('load-txt').textContent = 'loading ' + (meta.name || '');
  loader.load(url, async (gltf) => {
    performance.mark('model-parsed');
    const root = gltf.scene;
    let tris = 0, meshes = 0;
    const mats = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      o.castShadow = true;
      o.receiveShadow = true;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        mats.add(m);
        const w = m.userData && m.userData.wear;      // Blender's procedural wear recipe
        if (w) { try { applyWear(m, typeof w === 'string' ? JSON.parse(w) : w); } catch (e) { console.warn(e); } }
        if (m.userData.isFire) o.castShadow = o.receiveShadow = false;     // light, not matter
      });
    });
    // sit it on the floor, centred (precise: rotated parts would otherwise inflate the box)
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root, true);
    const c = box.getCenter(new THREE.Vector3());
    root.position.x -= c.x;
    root.position.z -= c.z;
    root.position.y -= box.min.y;
    // compile every shader off the main thread (parallel compile) before the model goes in, so the page never
    // freezes on the first frame; the spinner keeps turning meanwhile
    $('load-txt').textContent = 'preparing ' + (meta.name || '');
    try { await renderer.compileAsync(root, camera, scene); } catch (e) { console.warn(e); }
    performance.mark('model-compiled');
    if (token !== loadToken) return;               // another model was picked meanwhile
    scene.add(root);
    state.chain = setupChain(root);
    state.markFrame = true;
    state.root = root;
    root.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(root, true);
    const sph = b2.getBoundingSphere(new THREE.Sphere());
    state.center.copy(sph.center);
    state.radius = sph.radius;
    state.size = b2.getSize(new THREE.Vector3());
    shadowFloor.scale.setScalar(sph.radius * 3);
    grid.scale.setScalar(sph.radius * 4);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -sph.radius * 2.6;
    sc.right = sc.top = sph.radius * 2.6;
    sc.near = 0.01;
    sc.far = sph.radius * 10;
    sc.updateProjectionMatrix();
    applyLight();
    frameView();
    setWire(state.wire);
    // animations: every clip plays together on one timeline
    if (gltf.animations.length) {
      state.mixer = new THREE.AnimationMixer(root);
      gltf.animations.forEach((clip) => state.mixer.clipAction(clip).play());
      state.duration = Math.max(...gltf.animations.map((a) => a.duration));
      // camera follows the height of the top-most moving node (jumps stay in frame)
      const depth = (o) => { let d = 0; while (o && o !== root) { o = o.parent; d++; } return d; };
      let best = null;
      gltf.animations.forEach((a) => a.tracks.forEach((t) => {
        if (!t.name.endsWith('.position')) return;
        const n = root.getObjectByName(t.name.slice(0, -'.position'.length));
        if (n && (!best || depth(n) < depth(best))) best = n;
      }));
      state.follow = best;
      state.followY = best ? best.getWorldPosition(new THREE.Vector3()).y : 0;
      $('transport').hidden = false;
      setPlaying(true);
    } else {
      $('transport').hidden = true;
    }
    $('loading').hidden = true;
    showInfo(meta, { tris, meshes, mats: mats.size, anims: gltf.animations.length, size });
  }, (e) => {
    if (e.total) $('bar').style.width = Math.round((e.loaded / e.total) * 100) + '%';
  }, (err) => {
    $('loading').hidden = true;
    showError('could not load this model: ' + (err.message || err));
  });
}

function fmtSize(b) {
  if (!b) return '—';
  return b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB';
}

function showInfo(meta, s) {
  $('m-name').textContent = meta.name || 'model';
  $('m-desc').textContent = meta.description || '';
  const rows = [
    ['triangles', Math.round(s.tris).toLocaleString('en')],
    ['parts', s.meshes],
    ['materials', s.mats],
    ['animation', state.duration ? state.duration.toFixed(1) + ' s' : 'none'],
    ['file', fmtSize(s.size)],
    ['made', meta.made || '—'],
  ];
  $('m-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}

// ---------------------------------------------------------------- gallery
function renderList() {
  const ul = $('list');
  ul.innerHTML = '';
  state.models.forEach((m) => {
    const li = document.createElement('li');
    li.className = 'card' + (state.current === m ? ' active' : '');
    li.innerHTML = (m.poster ? `<img src="${m.poster}" alt="" loading="lazy" decoding="async">` : '<div class="ph"></div>') +
      `<div><div class="t">${m.name}</div><div class="s">${m.tags ? m.tags.join(' · ') : ''}</div></div>`;
    li.onclick = () => select(m);
    ul.appendChild(li);
  });
  const n = state.models.filter((m) => !m.local).length;
  $('count').textContent = n + (n === 1 ? ' model' : ' models');
}

async function select(m) {
  state.current = m;
  renderList();
  if (!m.local) history.replaceState(null, '', '#' + m.id);
  let size = m.bytes;
  if (!size && !m.local) {
    try {
      const h = await fetch(m.file, { method: 'HEAD' });
      size = +h.headers.get('content-length') || 0;
    } catch { size = 0; }
  }
  setupPhoto(m);
  // model and surroundings download side by side; the model shows as soon as it is ready
  loadEnv(m.env).catch((err) => { console.warn('environment failed', err); return loadEnv(null); });
  // ?v=<size> so a re-exported model is never served from a stale browser cache
  load(m.url || (m.file + (m.bytes ? '?v=' + m.bytes : '')), m, size);
}

async function init() {
  resize();
  try {
    const r = await fetch('models/models.json', { cache: 'no-cache' });
    state.models = (await r.json()).models;
  } catch {
    state.models = [];
  }
  renderList();
  const want = location.hash.slice(1);
  const first = state.models.find((m) => m.id === want) || state.models[0];
  if (first) select(first);
  else { $('m-name').textContent = 'no models yet'; }
  animate();
}

// ---------------------------------------------------------------- controls
function setPlaying(p) {
  state.playing = p;
  $('play').textContent = p ? '❚❚' : '▶';
}
function setWire(w) {
  state.wire = w;
  $('t-wire').classList.toggle('on', w);
  state.root?.traverse((o) => {
    if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.wireframe = w; });
  });
}
$('play').onclick = () => setPlaying(!state.playing);
$('speed').onchange = (e) => { state.speed = +e.target.value; };
$('scrub').addEventListener('input', (e) => {
  if (!state.mixer) return;
  state.mixer.setTime((e.target.value / 1000) * state.duration);
});
$('scrub').addEventListener('pointerdown', () => { state.seeking = true; });
window.addEventListener('pointerup', () => { state.seeking = false; });
$('t-rotate').onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  $('t-rotate').classList.toggle('on', controls.autoRotate);
};
$('t-wire').onclick = () => setWire(!state.wire);
$('t-light').onclick = () => { lightIdx = (lightIdx + 1) % LIGHTS.length; applyLight(); };
$('t-bg').onclick = () => { env.on = !env.on; applyLight(); };
$('t-grid').onclick = () => { grid.visible = !grid.visible; $('t-grid').classList.toggle('on', grid.visible); };
$('t-reset').onclick = frameView;
$('t-full').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else stage.requestFullscreen?.();
};
$('t-shot').onclick = () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = (state.current?.id || 'model') + '.png';
  a.click();
};
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); setPlaying(!state.playing); }
  else if (k === 'a') $('t-rotate').click();
  else if (k === 'w') $('t-wire').click();
  else if (k === 'l') $('t-light').click();
  else if (k === 'b') $('t-bg').click();
  else if (k === 'p' && photo.n) setMode(!photo.on);
  else if (photo.on && (k === 'arrowleft' || k === 'arrowright')) showFrame(photo.idx + (k === 'arrowleft' ? 1 : -1));
  else if (k === 'g') $('t-grid').click();
  else if (k === 'r') frameView();
  else if (k === 'f') $('t-full').click();
});

// ---------------------------------------------------------------- photo mode: cycles turntable
const photo = { on: false, frames: [], idx: 0, drag: null, acc: 0, n: 0 };
function setupPhoto(m) {
  const tt = m && m.turntable;
  $('modes').hidden = !tt;
  photo.frames = [];
  photo.n = tt ? tt.count : 0;
  photo.dir = tt ? tt.dir : '';
  if (photo.on) setMode(false);
}
function frameUrl(i) { return `${photo.dir}${String(i).padStart(3, '0')}.jpg`; }
function showFrame(i) {
  photo.idx = ((Math.round(i) % photo.n) + photo.n) % photo.n;
  $('photo').src = frameUrl(photo.idx);
}
async function setMode(p) {
  photo.on = p;
  $('mode-3d').classList.toggle('on', !p);
  $('mode-photo').classList.toggle('on', p);
  $('photo').hidden = !p;
  $('photo-hint').hidden = !p;
  canvas.style.visibility = p ? 'hidden' : '';
  $('transport').hidden = p || !state.mixer;
  ['t-bg', 't-wire', 't-light', 't-grid', 't-reset', 't-shot'].forEach((id) => {
    $(id).style.display = p ? 'none' : '';
  });
  $('light-name').style.display = p ? 'none' : '';
  if (p && !photo.frames.length) {     // preload every angle once so dragging is instant
    $('loading').hidden = false;
    let done = 0;
    await Promise.all([...Array(photo.n).keys()].map((i) => new Promise((res) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        done++;
        $('bar').style.width = Math.round((done / photo.n) * 100) + '%';
        $('load-txt').textContent = `loading cycles renders ${done}/${photo.n}`;
        res();
      };
      img.src = frameUrl(i);
      photo.frames.push(img);
    })));
    $('loading').hidden = true;
  }
  if (p) showFrame(photo.idx);
}
$('mode-3d').onclick = () => setMode(false);
$('mode-photo').onclick = () => setMode(true);
$('photo').addEventListener('pointerdown', (e) => {
  photo.drag = e.clientX;
  photo.acc = photo.idx;
  $('photo').setPointerCapture(e.pointerId);
});
$('photo').addEventListener('pointermove', (e) => {
  if (photo.drag === null) return;
  const w = stage.clientWidth;
  showFrame(photo.acc - ((e.clientX - photo.drag) / w) * photo.n * 0.9);
});
$('photo').addEventListener('pointerup', () => { photo.drag = null; });

// drag & drop your own .glb (stays on your computer, nothing is uploaded)
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('drop').hidden = false; });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop').hidden = true; } });
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop').hidden = true;
  const f = [...e.dataTransfer.files].find((x) => /\.(glb|gltf)$/i.test(x.name));
  if (!f) { showError('drop a .glb or .gltf file (export it from Blender: File → Export → glTF 2.0)'); return; }
  const m = { id: 'local-' + f.name, name: f.name.replace(/\.(glb|gltf)$/i, ''), local: true,
              url: URL.createObjectURL(f), bytes: f.size, tags: ['your file'],
              description: 'opened from your computer — not uploaded anywhere' };
  state.models.unshift(m);
  select(m);
});

// ---------------------------------------------------------------- chain
// The export leaves the chain links standing still and ships their path (swingarm space, as the links' own
// local coordinates) plus the chain's advance per frame; each link sits at its share of the loop, turned along
// the chord to the next link. Same maths as the export, ~2 MB less to download than baked keyframes.
function setupChain(root) {
  let host = null;
  root.traverse((o) => { if (!host && o.userData && o.userData.chain_web) host = o; });
  if (!host) return null;
  const raw = host.userData.chain_web;
  const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const P = [];
  for (let i = 0; i < d.pts.length; i += 3) P.push(new THREE.Vector3(d.pts[i], d.pts[i + 1], d.pts[i + 2]));
  const cum = [0];
  for (let i = 0; i < P.length; i++) cum.push(cum[i] + P[i].distanceTo(P[(i + 1) % P.length]));
  const links = [];
  for (let i = 0; i < d.n; i++) links.push(host.getObjectByName('ChainLink_' + String(i).padStart(3, '0')));
  if (links.some((l) => !l)) return null;
  return { d, P, cum, total: cum[cum.length - 1], links };
}
const chainA = new THREE.Vector3(), chainB = new THREE.Vector3(), Z_AXIS = new THREE.Vector3(0, 0, 1);
function chainAt(C, s, out) {
  s = ((s % C.total) + C.total) % C.total;
  let lo = 0, hi = C.P.length;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (C.cum[mid] <= s) lo = mid; else hi = mid; }
  const a = C.P[lo], b = C.P[(lo + 1) % C.P.length];
  return out.lerpVectors(a, b, (s - C.cum[lo]) / Math.max(C.cum[lo + 1] - C.cum[lo], 1e-9));
}
function updateChain(t) {
  const C = state.chain;
  if (!C) return;
  const offs = C.d.offs, last = offs.length - 1;
  const f = Math.min(Math.max(t * C.d.fps - C.d.start, 0), last);
  const k = Math.floor(f), w = f - k;
  const off = offs[k] * (1 - w) + offs[Math.min(k + 1, last)] * w;
  const n = C.links.length, step = C.total / n;
  for (let i = 0; i < n; i++) {
    const s = ((((i / n + off) % 1) + 1) % 1) * C.total;
    chainAt(C, s, chainA);
    chainAt(C, s + step, chainB);
    const L = C.links[i];
    L.position.copy(chainA);
    L.quaternion.setFromAxisAngle(Z_AXIS, Math.atan2(chainB.y - chainA.y, chainB.x - chainA.x));
  }
}

// ---------------------------------------------------------------- loop
let spinT = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  wearTime.value += dt;
  if (photo.on) {                       // the 3d scene is hidden; only the auto-spin runs
    if (controls.autoRotate && photo.drag === null && (spinT += dt) > 1 / 14) { spinT = 0; showFrame(photo.idx - 1); }
    return;
  }
  if (state.mixer && state.playing && !state.seeking) {
    state.mixer.update(dt * state.speed);
  }
  if (state.mixer && state.duration) {
    const t = state.mixer.time % state.duration;
    updateChain(t);
    if (!state.seeking) $('scrub').value = Math.round((t / state.duration) * 1000);
    $('time').textContent = `${t.toFixed(1)} / ${state.duration.toFixed(1)} s`;
  }
  if (state.follow) {
    // damped: the camera glides after the model instead of copying every frame's motion
    const y = state.follow.getWorldPosition(tmpV).y;
    const d = (y - state.followY) * Math.min(1, dt * 4);
    state.followY += d;
    camera.position.y += d * 0.8;
    controls.target.y += d * 0.8;
  }
  controls.update();
  renderer.render(scene, camera);
  if (state.markFrame) { state.markFrame = false; performance.mark('model-first-frame'); }
}
const tmpV = new THREE.Vector3();

window.__viewer = { renderer, scene, camera, controls, state, applyLight, LIGHTS, updateChain };   // debug handle
init();
