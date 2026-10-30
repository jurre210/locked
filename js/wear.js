// Rebuilds a Blender material's procedural wear (dust, roughness breakup, micro grain) in the
// three.js shader, from the recipe exported as material extras: userData.wear (JSON).
//   space: 'BIKE'   -> dust collects low down (world height above the floor)
//          'RADIAL' -> dust collects towards the rim of a wheel part (object-space radius)
//          'OBJECT' -> dust by object-space height
import * as THREE from 'three';

const NOISE = /* glsl */ `
varying vec3 vWearW;
varying vec3 vWearO;
uniform float wDirt, wLow, wHigh, wBump, wScale, wRv, wSeed, wSpace;
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

export function applyWear(material, recipe) {
  if (!recipe || material.userData.wearApplied) return;
  material.userData.wearApplied = true;
  const space = recipe.space === 'BIKE' ? 0 : 1;
  const uniforms = {
    wDirt: { value: recipe.dirt || 0 }, wLow: { value: recipe.low ?? 0.15 }, wHigh: { value: recipe.high ?? 0.55 },
    wBump: { value: Math.min(recipe.bump || 0, 1.0) }, wScale: { value: Math.min(recipe.scale || 200, 420) },
    wRv: { value: recipe.rv ?? 0.06 }, wSeed: { value: recipe.seed || 0 }, wSpace: { value: space },
    wCol: { value: new THREE.Color().fromArray(recipe.col || [0.21, 0.165, 0.115]) },  // linear, like Blender
  };
  const radial = recipe.space === 'RADIAL';
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
        float brk = smoothstep(0.35, 0.65, wFbm(p * 7.0));
        wearD = clamp(hm * brk * wDirt, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, wCol, wearD);
      }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + wRv * (2.0 * wFbm(wearP() * 9.0) - 1.0), 0.02, 1.0);
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
          float h = (wFbm(q) - 0.5) * 0.0006 * amt;
          vec2 dH = vec2(dFdx(h), dFdy(h));
          vec3 sp = -vViewPosition, sx = dFdx(sp), sy = dFdy(sp);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          normal = normalize(abs(det) * normal - sign(det) * (dH.x * r1 + dH.y * r2));
        }
      }`);
  };
  material.customProgramCacheKey = () => 'wear-' + (radial ? 'r' : space);
  material.needsUpdate = true;
}
