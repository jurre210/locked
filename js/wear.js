// Rebuilds a Blender material's procedural wear (dust, roughness breakup, micro grain) in the
// three.js shader, from the recipe exported as material extras: userData.wear (JSON).
//   space: 'BIKE'   -> dust collects low down (world height above the floor)
//          'RADIAL' -> dust collects towards the rim of a wheel part (object-space radius)
//          'OBJECT' -> dust by object-space height
import * as THREE from 'three';

const NOISE = /* glsl */ `
varying vec3 vWearW;
varying vec3 vWearO;
uniform float wDirt, wLow, wHigh, wBump, wScale, wRv, wSeed, wSpace, wPeriod, wCv, wBrush;
float wearS = 0.0;       // brushing streak, -0.5..0.5 (0 where it would be finer than a pixel)
float wearWeave = 0.5;   // fabric: 0 in the gaps between threads, 1 on a thread crown
uniform vec3 wCol;
float wHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wHash(i), wHash(i + vec3(1, 0, 0)), f.x), mix(wHash(i + vec3(0, 1, 0)), wHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(wHash(i + vec3(0, 0, 1)), wHash(i + vec3(1, 0, 1)), f.x), mix(wHash(i + vec3(0, 1, 1)), wHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float wFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * wNoise(p); p *= 2.03; a *= 0.5; } return s / 0.9375; }
float wearD = 0.0;
vec3 wearP() { return (wSpace > 0.5 ? vWearO : vWearW) + vec3(wSeed, wSeed * 1.7, wSeed * 0.3); }
`;

// one clock for every animated material (flames); the viewer advances it each frame
export const wearTime = { value: 0 };

// Flames (recipe.kind 'fire'): additive, unlit, double-sided. UV v runs base -> tip in Blender, which glTF flips, so
// the height up a flame is 1 - vUv.y. Vertices sway more towards the tip; the colour runs white-yellow -> orange ->
// deep red, and fbm noise scrolling upwards cuts the flame into licks (same recipe as the Blender material).
function applyFire(material, recipe) {
  material.userData.isFire = true;
  material.transparent = true;
  material.blending = THREE.AdditiveBlending;
  material.depthWrite = false;
  material.side = THREE.DoubleSide;
  material.defines = { ...(material.defines || {}), USE_UV: '' };
  const uniforms = { wTime: wearTime, wSeed: { value: recipe.seed || 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float wTime, wSeed;\nvarying vec3 vWearO;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float fh = 1.0 - uv.y;
        float sway = 0.006 * fh * fh;
        transformed.x += sin(wTime * 7.0 + position.y * 60.0 + wSeed) * sway;
        transformed.z += cos(wTime * 5.3 + position.y * 45.0 + wSeed * 2.0) * sway;
        transformed.y += sin(wTime * 9.0 + position.x * 50.0) * 0.004 * fh;
      }`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWearO = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float wTime, wSeed;\nvarying vec3 vWearO;\n' +
        NOISE.replace('varying vec3 vWearW;', '').replace('varying vec3 vWearO;', '')
          .replace('uniform float wDirt, wLow, wHigh, wBump, wScale, wRv, wSeed, wSpace, wPeriod, wCv, wBrush;', '')
          .replace('uniform vec3 wCol;', '').replace(/vec3 wearP\(\)[^\n]*\n/, ''))
      .replace('#include <opaque_fragment>', `
      {
        float fh = 1.0 - vUv.y;
        float n = wFbm(vWearO * 35.0 + vec3(0.0, -wTime * 3.5, 0.0) + wSeed);
        float inten = pow(1.0 - fh, 0.7) * smoothstep(0.32, 0.7, n + 0.4 * (1.0 - fh));
        vec3 col = mix(mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 0.42, 0.04), smoothstep(0.0, 0.4, fh)),
                       vec3(0.55, 0.05, 0.01), smoothstep(0.4, 1.0, fh));
        gl_FragColor = vec4(col * inten * 2.4, 1.0);
      }`);
  };
  material.customProgramCacheKey = () => 'fire';
  material.needsUpdate = true;
}

// Ground glow (recipe.kind 'glow'): an additive pool of light fading to a rounded-rectangle edge across the UV square,
// breathing slowly - the neon underglow under the car.
function applyGlow(material, recipe) {
  material.userData.isFire = true;              // same handling as flames: light, no shadows
  material.transparent = true;
  material.blending = THREE.AdditiveBlending;
  material.depthWrite = false;
  material.side = THREE.DoubleSide;
  material.defines = { ...(material.defines || {}), USE_UV: '' };
  const uniforms = { wTime: wearTime, gCol: { value: new THREE.Color().fromArray(recipe.col || [0.25, 1, 0.12]) } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float wTime;\nuniform vec3 gCol;')
      .replace('#include <opaque_fragment>', `
      {
        vec2 q = abs(vUv - 0.5) * 2.0;
        float d = max(q.x, q.y);
        float fall = pow(clamp((1.0 - d) / 0.65, 0.0, 1.0), 2.5);
        gl_FragColor = vec4(gCol * fall * (0.55 + 0.1 * sin(wTime * 2.2)), 1.0);
      }`);
  };
  material.customProgramCacheKey = () => 'glow';
  material.needsUpdate = true;
}

// Living goo (recipe.kind 'ooze'): lit as usual, but the surface breathes (a slow ripple along the normal) and a
// silver rim light runs round every silhouette, so liquid black never reads as a flat hole.
function applyOoze(material, recipe) {
  const uniforms = { wTime: wearTime, wSeed: { value: recipe.seed || 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float wTime, wSeed;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed += objectNormal * 0.0016 * sin(wTime * 2.6 + position.x * 40.0 + position.z * 31.0 + wSeed)
                   * (0.6 + 0.4 * sin(wTime * 0.7 + position.y * 23.0));`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float wTime, wSeed;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += vec3(0.78, 0.8, 0.88) * rim * (0.45 + 0.15 * sin(wTime * 1.8 + wSeed));
      }`);
  };
  material.customProgramCacheKey = () => 'ooze';
  material.needsUpdate = true;
}

// White veins / infalling streaks (recipe.kind 'pulse'): lit white, plus waves of light running along them.
function applyPulse(material, recipe) {
  const uniforms = { wTime: wearTime, wSeed: { value: recipe.seed || 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWearW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWearW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float wTime, wSeed;\nvarying vec3 vWearW;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float w = 0.5 + 0.5 * sin(wTime * 2.4 - (vWearW.x * 9.0 + vWearW.y * 6.0) + wSeed);
        totalEmissiveRadiance += vec3(0.9, 0.95, 1.0) * (0.15 + 1.1 * pow(w, 6.0));
      }`);
  };
  material.customProgramCacheKey = () => 'pulse';
  material.needsUpdate = true;
}

// Accretion disc (recipe.kind 'disc'): additive light over an annulus whose UVs run u round it, v inner -> outer.
// White-hot at the inner edge, fading out; spiral arms wind in, the inner orbit turning fastest.
function applyDisc(material, recipe) {
  material.userData.isFire = true;
  material.transparent = true;
  material.blending = THREE.AdditiveBlending;
  material.depthWrite = false;
  material.side = THREE.DoubleSide;
  material.defines = { ...(material.defines || {}), USE_UV: '' };
  const uniforms = { wTime: wearTime, wSeed: { value: recipe.seed || 0 }, wArms: { value: recipe.arms || 3 },
    wGain: { value: recipe.gain || 1.6 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float wTime, wSeed, wArms, wGain;\n' +
        NOISE.replace('varying vec3 vWearW;', '').replace('varying vec3 vWearO;', '')
          .replace('uniform float wDirt, wLow, wHigh, wBump, wScale, wRv, wSeed, wSpace, wPeriod, wCv, wBrush;', '')
          .replace('uniform vec3 wCol;', '').replace(/vec3 wearP\(\)[^\n]*\n/, ''))
      .replace('#include <opaque_fragment>', `
      {
        float v = 1.0 - vUv.y;                                 // glTF flips v: 0 at the inner edge again
        float spin = wTime * (0.9 / (v + 0.35));                // inner orbits faster
        float a = vUv.x * 6.2831853 + spin + wSeed;
        float arms = 0.5 + 0.5 * sin(a * wArms + v * 9.0);
        float grain = wFbm(vec3(cos(a) * (2.0 + v * 6.0), sin(a) * (2.0 + v * 6.0), v * 4.0 + wTime * 0.2));
        float inten = pow(1.0 - v, 1.5) * smoothstep(0.0, 0.05, v) * (0.25 + 0.75 * arms * (0.5 + 1.0 * grain));
        inten += smoothstep(0.07, 0.0, v) * (1.1 + 0.4 * sin(wTime * 6.0 + wSeed));   // photon ring, flickering
        // hot clumps riding the arms inward
        float clump = pow(wNoise(vec3(a * 3.0 - wTime * 2.0, v * 12.0 + wTime * 1.5, wSeed)), 6.0) * 4.0;
        inten += clump * (1.0 - v);
        gl_FragColor = vec4(vec3(0.92, 0.95, 1.0) * inten * wGain, 1.0);
      }`);
  };
  material.customProgramCacheKey = () => 'disc';
  material.needsUpdate = true;
}

// Lightning (recipe.kind 'arc'): additive electric blue-white that crackles: each arc strobes on and off in
// irregular bursts, with brightness running along it.
function applyArc(material, recipe) {
  material.userData.isFire = true;
  material.transparent = true;
  material.blending = THREE.AdditiveBlending;
  material.depthWrite = false;
  const uniforms = { wTime: wearTime, wSeed: { value: recipe.seed || 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float wTime, wSeed;\nvarying vec3 vWearO;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed += objectNormal * 0.0015 * sin(wTime * 60.0 + position.x * 400.0 + position.z * 300.0);`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWearO = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float wTime, wSeed;\nvarying vec3 vWearO;\n' +
        NOISE.replace('varying vec3 vWearW;', '').replace('varying vec3 vWearO;', '')
          .replace('uniform float wDirt, wLow, wHigh, wBump, wScale, wRv, wSeed, wSpace, wPeriod, wCv, wBrush;', '')
          .replace('uniform vec3 wCol;', '').replace(/vec3 wearP\(\)[^\n]*\n/, ''))
      .replace('#include <opaque_fragment>', `
      {
        float burst = step(0.45, wNoise(vec3(floor(wTime * 14.0), floor(vWearO.x * 6.0 + vWearO.z * 5.0) + wSeed, 1.0)));
        float run = 0.5 + 0.5 * sin(vWearO.x * 90.0 + vWearO.z * 70.0 - wTime * 40.0);
        float inten = burst * (0.6 + 0.8 * run);
        gl_FragColor = vec4(vec3(0.45, 0.85, 1.0) * inten * 3.0 + vec3(0.6) * inten * run, 1.0);
      }`);
  };
  material.customProgramCacheKey = () => 'arc';
  material.needsUpdate = true;
}

export function applyWear(material, recipe) {
  if (!recipe || material.userData.wearApplied) return;
  material.userData.wearApplied = true;
  if (recipe.kind === 'fire') { applyFire(material, recipe); return; }
  if (recipe.kind === 'glow') { applyGlow(material, recipe); return; }
  if (recipe.kind === 'ooze') { applyOoze(material, recipe); return; }
  if (recipe.kind === 'pulse') { applyPulse(material, recipe); return; }
  if (recipe.kind === 'disc') { applyDisc(material, recipe); return; }
  if (recipe.kind === 'arc') { applyArc(material, recipe); return; }
  const space = recipe.space === 'BIKE' ? 0 : 1;
  const uniforms = {
    wDirt: { value: recipe.dirt || 0 }, wLow: { value: recipe.low ?? 0.15 }, wHigh: { value: recipe.high ?? 0.55 },
    wBump: { value: Math.min(recipe.bump || 0, 1.0) }, wScale: { value: Math.min(recipe.scale || 200, 420) },
    wRv: { value: recipe.rv ?? 0.06 }, wSeed: { value: recipe.seed || 0 }, wSpace: { value: space },
    wCol: { value: new THREE.Color().fromArray(recipe.col || [0.21, 0.165, 0.115]) },  // linear, like Blender
    wPeriod: { value: recipe.period || 0.0024 },
    wCv: { value: recipe.cv ?? 0.0 }, wBrush: { value: recipe.brush || 0 },
  };
  const radial = recipe.space === 'RADIAL';
  const fabric = recipe.kind === 'fabric';
  // plain weave in the object's own plane (Blender X,Y -> three X,-Z); fades to the average colour once a
  // thread gets smaller than a pixel, so it never shimmers
  const WEAVE = fabric ? `
        {
          vec2 uv = vec2(vWearO.x, -vWearO.z) / wPeriod;
          float aa = 1.0 - smoothstep(0.08, 0.28, length(fwidth(uv)));   // fade before moire can form
          float warp = pow(0.5 + 0.5 * sin(6.2831853 * uv.x), 0.6);
          float weft = pow(0.5 + 0.5 * sin(6.2831853 * uv.y), 0.6);
          float chk = mod(floor(uv.x) + floor(uv.y), 2.0);
          float fib = wNoise(vec3(chk > 0.5 ? vec2(uv.x * 0.05, uv.y * 3.0) : vec2(uv.x * 3.0, uv.y * 0.05), 1.0) * 6.0);
          wearWeave = mix(0.55, mix(warp, weft, chk) * 0.8 + fib * 0.25, aa);
          diffuseColor.rgb *= mix(0.35, 1.55, wearWeave);
        }` : '';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWearW;\nvarying vec3 vWearO;')
      .replace('#include <project_vertex>',
        '#include <project_vertex>\nvWearO = transformed;\nvWearW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 p = wearP();
        float hm = ${radial
          ? 'smoothstep(wLow, wHigh, length(vWearO.xy))'
          : 'smoothstep(wHigh, wLow, wSpace > 0.5 ? vWearO.y : vWearW.y)'};
        // tone variation: soft blotches a few cm across (Blender: noise scale 4 -> mottling)
        diffuseColor.rgb *= 1.0 + wCv * (2.0 * smoothstep(0.3, 0.7, wFbm(p * 4.0)) - 1.0);
        // brushing: streaks along the part's X (or rings round a wheel's axis), faded before they alias
        if (wBrush > 0.0) {
          vec3 bq = ${radial ? 'vec3(length(vWearO.xy) * 450.0, 0.0, 0.0)' : 'vec3(vWearO.x * 3.0, vWearO.y * 450.0, vWearO.z * 450.0)'};
          float bf = 1.0 - smoothstep(0.3, 0.9, length(fwidth(bq)) / 3.0);
          wearS = (wNoise(bq + wSeed) - 0.5) * bf;
          diffuseColor.rgb *= 1.0 + wBrush * 1.2 * wearS;
        }
        float brk = smoothstep(0.35, 0.65, wFbm(p * 7.0));
        wearD = clamp(hm * brk * wDirt, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, wCol, wearD);
      }${WEAVE}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + wRv * (2.0 * wFbm(wearP() * 9.0) - 1.0) + wBrush * 2.0 * wearS, 0.02, 1.0);
      roughnessFactor = mix(roughnessFactor, 0.93, wearD);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, 0.0, wearD);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        // micro grain as a derivative bump; fades out once the grain gets smaller than a pixel (no glitter)
        vec3 q = wearP() * wScale;
        float fade = 1.0 - smoothstep(0.35, 1.0, length(fwidth(q)));
        float amt = (wBump * 0.6 + wearD * 0.8) * fade;
        if (amt > 0.001) {
          float h = ${fabric ? 'wearWeave * 0.0005' : '(wFbm(q) - 0.5) * 0.0006 * amt'};
          vec2 dH = vec2(dFdx(h), dFdy(h));
          vec3 sp = -vViewPosition, sx = dFdx(sp), sy = dFdy(sp);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          normal = normalize(abs(det) * normal - sign(det) * (dH.x * r1 + dH.y * r2));
        }
      }`);
  };
  material.customProgramCacheKey = () => 'wear-' + (radial ? 'r' : space) + (fabric ? 'f' : '');
  material.needsUpdate = true;
}
