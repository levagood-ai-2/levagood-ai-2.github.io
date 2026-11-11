// Levagood Park, the look of it: the sky and its light, shadows that stay sharp where you are, textures, water, trees, grass,
// the finishing passes, and the batching that keeps it all fast. park3d.html builds the park and the people; this file makes it look real.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

// ---------------- how much the machine can take ----------------
// Three levels. The page starts on a guess from the device, then watches its own frame time and steps down if it has to.
export const TIERS = {
  low:    {name: 'low',    pixelRatio: 1.0,  shadow: 1024, shadowHalf: 45, post: false, ao: false, bloom: false, reflect: false, grass: 0,     skyOct: 3, leaves: 0.45, msaa: 0, far: 0.6},
  medium: {name: 'medium', pixelRatio: 1.5,  shadow: 2048, shadowHalf: 55, post: true,  ao: false, bloom: true,  reflect: false, grass: 22000, skyOct: 4, leaves: 0.7,  msaa: 2, far: 0.8},
  high:   {name: 'high',   pixelRatio: 2.0,  shadow: 4096, shadowHalf: 70, post: true,  ao: true,  bloom: true,  reflect: true,  grass: 60000, skyOct: 5, leaves: 1.0,  msaa: 4, far: 1.0}
};
export function pickTier(){
  let want = null; try { want = new URLSearchParams(location.search).get('q') || localStorage.getItem('park_quality'); } catch (e) {}
  if (want && TIERS[want]) return {tier: TIERS[want], auto: false};
  const coarse = matchMedia('(pointer: coarse)').matches, cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4, order = ['low', 'medium', 'high'];
  let guess = coarse ? (cores >= 6 ? 'medium' : 'low') : (cores >= 8 && mem >= 4 ? 'high' : 'medium'), learned = null;
  try { learned = localStorage.getItem('park_quality_auto'); } catch (e) {}   // last time, this device had to step down: start there
  if (learned && TIERS[learned] && order.indexOf(learned) < order.indexOf(guess)) guess = learned;
  return {tier: TIERS[guess], auto: true};
}

// ---------------- the sky ----------------
// One dome, drawn at the far plane. The color comes from where the sun is: blue at midday, gold late, deep blue at dusk.
// Clouds are noise on a flat layer overhead, lit from the sun's side. The same shader, without the sun's disk, lights the park (see envFromSky).
const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = `
uniform vec3 uSun; uniform float uTime; uniform float uCover; uniform float uEnv; uniform float uScale;
varying vec3 vDir;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < OCT; i++){ s += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir); vec3 sun = normalize(uSun); float e = sun.y;
  float day = smoothstep(-0.04, 0.30, e);
  float gold = smoothstep(0.46, 0.08, e) * smoothstep(-0.14, 0.03, e);
  vec3 zen = mix(vec3(0.030, 0.045, 0.130), vec3(0.060, 0.215, 0.680), day);
  vec3 hor = mix(vec3(0.160, 0.150, 0.280), vec3(0.520, 0.730, 0.960), day);
  hor = mix(hor, vec3(1.00, 0.58, 0.32), gold * 0.72); zen = mix(zen, vec3(0.150, 0.200, 0.480), gold * 0.45);
  vec3 sunCol = mix(vec3(1.0, 0.42, 0.16), vec3(1.0, 0.95, 0.86), smoothstep(0.0, 0.34, e));
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(hor, zen, pow(h, 0.42));
  float c = max(dot(d, sun), 0.0);
  vec2 dxz = normalize(d.xz + vec2(1e-5)), sxz = normalize(sun.xz + vec2(1e-5));
  col += vec3(1.0, 0.50, 0.20) * gold * pow(max(dot(dxz, sxz), 0.0), 3.0) * pow(1.0 - h, 5.0) * 0.55;   // the warm side of the sky late in the day
  col += sunCol * (pow(c, 48.0) * 0.22 + pow(c, 5.0) * 0.07) * (0.35 + 0.65 * day + gold);             // the glow around the sun
  if (uEnv < 0.5){ col += sunCol * (pow(c, 1400.0) * 5.0 + smoothstep(0.99984, 0.99994, c) * 60.0); }   // the sun itself
  if (d.y > 0.0){
    vec2 uv = d.xz / (d.y + 0.14); vec2 w = vec2(uTime * 0.0060, uTime * 0.0022);
    float n = fbm(uv * 0.95 + w), n2 = fbm(uv * 2.6 + w * 1.6 + 31.0);
    float m = n * 0.72 + n2 * 0.28;
    float dens = smoothstep(1.0 - uCover, 1.0 - uCover + 0.26, m);
    vec2 ld = sxz * 0.16; float nl = fbm((uv + ld) * 0.95 + w) * 0.72 + fbm((uv + ld) * 2.6 + w * 1.6 + 31.0) * 0.28;
    float lit = clamp((m - nl) * 3.2 + 0.55, 0.0, 1.0);
    vec3 bright = mix(vec3(1.0), sunCol, 0.55) * (0.50 + 0.62 * day + gold * 0.35);
    vec3 shade = mix(hor, zen, 0.45) * 0.62 + vec3(0.05, 0.06, 0.09) * day;
    vec3 cc = mix(shade, bright, lit * (0.55 + 0.45 * dens));
    cc += sunCol * pow(c, 10.0) * 0.35 * (1.0 - dens * 0.5);                                           // silver lining near the sun
    col = mix(col, cc, dens * smoothstep(0.0, 0.20, d.y) * 0.94);
  }
  vec3 ground = uEnv > 0.5 ? vec3(0.22, 0.27, 0.16) * (0.22 + 0.9 * day) + hor * 0.10 : hor * 0.92 + 0.03;   // lighting the park: the ground bounces green. Looking at it: haze.
  col = mix(ground, col, smoothstep(-0.06, 0.0, d.y));
  gl_FragColor = vec4(col * uScale, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function createSky(scene, tier){
  const sunU = {value: new THREE.Vector3(0.3, 0.8, 0.4).normalize()}, timeU = {value: 0}, coverU = {value: 0.5};
  const mk = (env) => new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false, depthTest: !env, fog: false, defines: {OCT: env ? 3 : tier.skyOct},
    uniforms: {uSun: sunU, uTime: timeU, uCover: coverU, uEnv: {value: env ? 1 : 0}, uScale: {value: env ? 0.42 : 1}}, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG});
  const geo = new THREE.SphereGeometry(900, 40, 20);
  const dome = new THREE.Mesh(geo, mk(false)); dome.frustumCulled = false; dome.renderOrder = -100; dome.userData.dyn = true; dome.name = 'sky'; scene.add(dome);
  const envScene = new THREE.Scene(); const envDome = new THREE.Mesh(geo, mk(true)); envDome.frustumCulled = false; envScene.add(envDome);
  let pmrem = null, envRT = null;
  // the colors the fog and the lights take from the sky, worked out the same way the shader does
  const tmp = new THREE.Color();
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function palette(){ const e = sunU.value.y, day = sm(-0.04, 0.30, e), gold = sm(0.46, 0.08, e) * sm(-0.14, 0.03, e);
    let zen = mix([0.030, 0.045, 0.130], [0.060, 0.215, 0.680], day), hor = mix([0.160, 0.150, 0.280], [0.520, 0.730, 0.960], day);
    hor = mix(hor, [1.0, 0.58, 0.32], gold * 0.72); zen = mix(zen, [0.150, 0.200, 0.480], gold * 0.45);
    const sunCol = mix([1.0, 0.42, 0.16], [1.0, 0.95, 0.86], sm(0, 0.34, e)); return {day, gold, zen, hor, sunCol, e}; }
  return {dome, sunDir: sunU.value, uniforms: {sun: sunU, time: timeU, cover: coverU}, palette,
    follow(camera){ dome.position.copy(camera.position); },
    // light the park from the sky: render the dome into a cube, blur it into an environment map
    envFromSky(renderer){ if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer); const rt = pmrem.fromScene(envScene, 0, 1, 2000); scene.environment = rt.texture; if (envRT) envRT.dispose(); envRT = rt; return rt.texture; }};
}

// ---------------- the sun's shadow, kept sharp around a point ----------------
// One shadow map can't cover a whole park and stay sharp. So it covers a square around where you are (or where you are looking),
// and that square moves in whole texels so the shadow edges don't swim.
export function createSunRig(sun, scene, tier){
  scene.add(sun.target); sun.shadow.mapSize.set(tier.shadow, tier.shadow);
  const dir = new THREE.Vector3(0.3, 0.8, 0.4).normalize(), right = new THREE.Vector3(), up = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), f = new THREE.Vector3(), c = new THREE.Vector3();
  let half = -1;
  return {dir,
    focus(x, z, h){
      h = Math.round(h / 5) * 5; const cam = sun.shadow.camera;
      if (h !== half){ half = h; cam.left = -h; cam.right = h; cam.top = h; cam.bottom = -h; cam.near = 20; cam.far = 760; cam.updateProjectionMatrix(); const texel = 2 * h / sun.shadow.mapSize.x; sun.shadow.normalBias = Math.max(0.02, texel * 1.5); sun.shadow.bias = -0.00025; }
      const texel = 2 * h / sun.shadow.mapSize.x; right.crossVectors(UP, dir).normalize(); up.crossVectors(dir, right).normalize(); f.set(x, 0, z);
      const fx = f.dot(right), fy = f.dot(up); c.copy(f).addScaledVector(right, Math.round(fx / texel) * texel - fx).addScaledVector(up, Math.round(fy / texel) * texel - fy);
      sun.target.position.copy(c); sun.position.copy(c).addScaledVector(dir, 380); sun.target.updateMatrixWorld(); }};
}

// ---------------- textures, drawn in code ----------------
// Each surface gets a color map and a normal map made from the same height field, so the bumps line up with what you see.
// Everything tiles. Sizes are in meters per repeat; the batcher lays the UVs out in world space so nothing stretches.
function lattice(seed){ const p = new Float32Array(4096); let s = seed * 9301 + 49297; for (let i = 0; i < 4096; i++){ s = (s * 16807) % 2147483647; p[i] = s / 2147483647; } return p; }
// value noise that repeats every `per` cells
function pnoise(p, x, y, per){ const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const X0 = ((xi % per) + per) % per, X1 = (X0 + 1) % per, Y0 = ((yi % per) + per) % per, Y1 = (Y0 + 1) % per, at = (a, b) => p[(a * 57 + b * 131) & 4095];
  return (at(X0, Y0) * (1 - u) + at(X1, Y0) * u) * (1 - v) + (at(X0, Y1) * (1 - u) + at(X1, Y1) * u) * v; }
function pfbm(p, u, v, per, oct){ let s = 0, a = 0.5, f = per, n = 0; for (let i = 0; i < oct; i++){ s += a * pnoise(p, u * f, v * f, f); n += a; a *= 0.5; f *= 2; } return s / n; }
const MAXANISO = {v: 8};
function finish(t, srgb){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAXANISO.v; if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (t.isCanvasTexture) t.needsUpdate = true; return t; }
// height(u, v) is 0..1, color(u, v, h) is [r, g, b] in 0..255, strength is how deep the bumps read
export function makeMaps(size, height, color, strength = 2){
  const H = new Float32Array(size * size), cv = document.createElement('canvas'), nv = document.createElement('canvas'); cv.width = cv.height = nv.width = nv.height = size;
  const g = cv.getContext('2d'), ng = nv.getContext('2d'), img = g.createImageData(size, size), nimg = ng.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){ const u = x / size, v = y / size, h = height(u, v); H[y * size + x] = h; const c = color(u, v, h), k = (y * size + x) * 4; img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = c.length > 3 ? c[3] : 255; }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){ const xm = (x + size - 1) % size, xp = (x + 1) % size, ym = (y + size - 1) % size, yp = (y + 1) % size;
    const dx = (H[y * size + xm] - H[y * size + xp]) * strength, dy = (H[ym * size + x] - H[yp * size + x]) * strength, L = Math.hypot(dx, dy, 1), k = (y * size + x) * 4;
    nimg.data[k] = (dx / L * 0.5 + 0.5) * 255; nimg.data[k + 1] = (-dy / L * 0.5 + 0.5) * 255; nimg.data[k + 2] = (1 / L * 0.5 + 0.5) * 255; nimg.data[k + 3] = 255; }
  g.putImageData(img, 0, 0); ng.putImageData(nimg, 0, 0);
  return {map: finish(new THREE.CanvasTexture(cv), true), normalMap: finish(new THREE.CanvasTexture(nv), false)};
}
export function loadTex(url, srgb = true){ const t = new THREE.TextureLoader().load(url); return finish(t, srgb); }
const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const tint = (c, k) => [clamp255(c[0] * k), clamp255(c[1] * k), clamp255(c[2] * k)];
export function makeTextures(renderer){
  MAXANISO.v = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const P1 = lattice(11), P2 = lattice(29), P3 = lattice(53), T = {};
  // pool deck concrete: broom finish, a little mottled, a few pits
  T.concrete = makeMaps(512, (u, v) => { const big = pfbm(P1, u, v, 4, 4), fine = pnoise(P2, u * 128, v * 128, 128), broom = Math.sin((v * 170 + big * 1.5) * Math.PI * 2) * 0.5 + 0.5; return 0.5 + (big - 0.5) * 0.18 + (fine - 0.5) * 0.30 + (broom - 0.5) * 0.10; },
    (u, v, h) => { const m = pfbm(P2, u + 0.3, v + 0.7, 3, 4), sp = pnoise(P3, u * 256, v * 256, 256); return tint([216, 211, 199], 0.955 + (m - 0.5) * 0.10 + (h - 0.5) * 0.08 + (sp > 0.84 ? -0.035 : sp < 0.12 ? 0.03 : 0)); }, 0.8);
  // sidewalks and curbs: smoother, a touch lighter
  T.walk = makeMaps(256, (u, v) => 0.5 + (pfbm(P2, u, v, 4, 4) - 0.5) * 0.3 + (pnoise(P1, u * 64, v * 64, 64) - 0.5) * 0.25,
    (u, v, h) => tint([212, 207, 196], 0.92 + (pfbm(P3, u, v, 3, 3) - 0.5) * 0.18 + (h - 0.5) * 0.12), 1.8);
  // asphalt: dark, with light and dark stone showing through
  T.asphalt = makeMaps(512, (u, v) => 0.5 + (pnoise(P1, u * 128, v * 128, 128) - 0.5) * 0.7 + (pnoise(P2, u * 256, v * 256, 256) - 0.5) * 0.4,
    (u, v, h) => { const m = pfbm(P3, u, v, 3, 3), s = pnoise(P2, u * 256, v * 256, 256); const k = 0.82 + (m - 0.5) * 0.3 + (h - 0.5) * 0.35 + (s > 0.9 ? 0.5 : 0); return tint([74, 76, 82], k); }, 3.0);
  // the bike path and the park paths: packed fine gravel, warm gray
  T.path = makeMaps(256, (u, v) => 0.5 + (pnoise(P1, u * 90, v * 90, 90) - 0.5) * 0.6 + (pfbm(P2, u, v, 4, 3) - 0.5) * 0.3,
    (u, v, h) => tint([186, 172, 148], 0.9 + (h - 0.5) * 0.4 + (pfbm(P3, u, v, 2, 3) - 0.5) * 0.16), 2.6);
  // ball diamond dirt and the volleyball sand
  T.dirt = makeMaps(256, (u, v) => 0.5 + (pnoise(P2, u * 128, v * 128, 128) - 0.5) * 0.5 + (pfbm(P1, u, v, 4, 3) - 0.5) * 0.25,
    (u, v, h) => tint([190, 142, 96], 0.94 + (h - 0.5) * 0.16 + (pfbm(P3, u, v, 3, 3) - 0.5) * 0.10), 1.6);
  T.mulch = makeMaps(256, (u, v) => { const a = pnoise(P1, u * 40, v * 14, 40), b = pnoise(P2, u * 14, v * 40, 40); return Math.max(a, b); },
    (u, v, h) => tint([118, 82, 54], 0.55 + h * 0.75), 4.0);
  // roof shingles: rows of tabs, each a slightly different shade, thicker at the bottom edge. Light gray so the material's color tints it.
  T.shingle = makeMaps(512, (u, v) => { const rows = 10, tabs = 6, r = Math.floor(v * rows), fv = v * rows - r, fu0 = u * tabs + (r % 2) * 0.5, fu = fu0 - Math.floor(fu0); const gap = fu < 0.035 || fu > 0.965 ? -0.5 : 0; return 0.35 + fv * 0.5 + gap + (pnoise(P1, u * 160, v * 160, 160) - 0.5) * 0.25; },
    (u, v, h) => { const rows = 10, tabs = 6, r = Math.floor(v * rows), fv = v * rows - r, fu0 = u * tabs + (r % 2) * 0.5, tab = Math.floor(fu0), fu = fu0 - tab; const shade = 0.78 + P2[(r * 37 + tab * 91) & 4095] * 0.3, gr = pnoise(P3, u * 200, v * 200, 200);
      const edge = fv < 0.08 ? 0.72 : 1, gap = fu < 0.035 || fu > 0.965 ? 0.6 : 1; return tint([214, 208, 204], shade * edge * gap * (0.9 + gr * 0.2)); }, 3.2);
  // pool plaster and the tile band at the waterline
  T.plaster = makeMaps(256, (u, v) => 0.5 + (pfbm(P1, u, v, 6, 4) - 0.5) * 0.4 + (pnoise(P2, u * 80, v * 80, 80) - 0.5) * 0.2,
    (u, v, h) => tint([226, 240, 244], 0.94 + (h - 0.5) * 0.14), 1.2);
  T.tile = makeMaps(256, (u, v) => { const fu = (u * 8) % 1, fv = (v * 8) % 1; return (fu < 0.07 || fv < 0.07) ? 0.15 : 0.7 + (pnoise(P1, u * 30, v * 30, 30) - 0.5) * 0.08; },
    (u, v, h) => { const tu = Math.floor(u * 8), tv = Math.floor(v * 8), fu = (u * 8) % 1, fv = (v * 8) % 1; if (fu < 0.07 || fv < 0.07) return [214, 222, 226]; return tint([46, 108, 196], 0.82 + P2[(tu * 17 + tv * 59) & 4095] * 0.36); }, 2.5);
  // tree bark: ridges that run up the trunk
  T.bark = makeMaps(256, (u, v) => { const r = pnoise(P1, u * 18 + pnoise(P2, u * 4, v * 3, 4) * 2.2, v * 3, 18); return Math.abs(r - 0.5) * 2 * 0.8 + pnoise(P3, u * 60, v * 60, 60) * 0.2; },
    (u, v, h) => tint([112, 86, 66], 0.55 + h * 0.8), 4.2);
  // lap siding for the houses
  T.siding = makeMaps(128, (u, v) => { const fv = (v * 6) % 1; return fv < 0.12 ? 0.2 : 0.55 + fv * 0.4; }, (u, v, h) => { const fv = (v * 6) % 1; return tint([232, 226, 212], fv < 0.12 ? 0.72 : 0.95 + (pnoise(P1, u * 40, v * 6, 40) - 0.5) * 0.06); }, 2.2);
  // chain link: wire diamonds on nothing
  { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.clearRect(0, 0, 128, 128); g.lineCap = 'round';
    const wire = (col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let k = -1; k <= 2; k++){ g.moveTo(k * 64 - 64, 0); g.lineTo(k * 64 + 64, 128); g.moveTo(k * 64 + 64, 0); g.lineTo(k * 64 - 64, 128); } g.stroke(); };
    wire('rgba(96,104,114,1)', 4.6); wire('rgba(176,184,194,1)', 2.6); wire('rgba(232,236,242,.9)', 1.0);
    T.chain = finish(new THREE.CanvasTexture(cv), true); }
  // photos that ship with the park
  T.grass = loadTex('pool/3d/grass.jpg'); T.grassN = loadTex('pool/3d/grass_nm.jpg', false);
  T.brick = loadTex('pool/3d/brick.jpg'); T.brickB = loadTex('pool/3d/brick_bump.jpg', false); T.brickR = loadTex('pool/3d/brick_rough.jpg', false);
  T.wood = loadTex('pool/3d/wood.jpg'); T.waterN = loadTex('pool/3d/waternormals.jpg', false);
  return T;
}

// ---------------- batching: thousands of little meshes become a few big ones ----------------
// The park is built from boxes, posts, planes and cones, one mesh each. Drawn that way it is thousands of draw calls a frame, three times over
// (the picture, the shadow map, the reflection). Here everything that never moves is baked into world space and merged by material and by
// patch of ground, so the card draws a few hundred things instead. A mesh is static when it, or a group above it, carries userData.st,
// and nothing above it carries userData.dyn. Materials that look the same are treated as one.
export function batchStatic(scene, cell = 110){
  scene.updateMatrixWorld(true);
  const sigOf = m => [m.type, m.color ? m.color.getHexString() : '', m.roughness, m.metalness, m.map ? m.map.uuid : '', m.normalMap ? m.normalMap.uuid : '', m.roughnessMap ? m.roughnessMap.uuid : '', m.bumpMap ? m.bumpMap.uuid : '', m.emissive ? m.emissive.getHexString() : '', m.emissiveIntensity,
    m.flatShading, m.side, m.transparent, m.opacity, m.alphaTest, m.depthWrite, m.envMapIntensity, m.userData.worldUV || 0, m.userData.key || '', m.userData.slopeUV ? 1 : 0, m.normalScale ? m.normalScale.x : 0].join('|');
  const canon = new Map(), buckets = new Map(), gone = [], v = new THREE.Vector3(), box = new THREE.Box3();
  const isStatic = o => { let st = false; for (let p = o; p && p !== scene; p = p.parent){ if (p.userData.dyn) return false; if (p.userData.st) st = true; } return st; };
  let nIn = 0;
  scene.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.material || !o.material.isMeshStandardMaterial || !o.geometry || !o.geometry.attributes.position || !o.visible || !isStatic(o)) return;
    const m = o.material, sg = sigOf(m); let cm = canon.get(sg); if (!cm){ cm = m; canon.set(sg, cm); }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    g.morphAttributes = {}; g.clearGroups();
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    if (o.matrixWorld.determinant() < 0){ for (let i = 0; i < n; i += 3){ for (const a of [pos, nor]){ const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1); a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, x, y, z); } } }
    const tile = cm.userData.worldUV;
    if (tile || !g.attributes.uv){ const uv = new Float32Array(n * 2);
      const slope = !!cm.userData.slopeUV;   // roofs: the shingle rows run along the eave, whichever way the roof faces
      if (tile) for (let i = 0; i < n; i++){ const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i)), x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (slope && ny >= nx && ny >= nz && nx > nz){ uv[i * 2] = z / tile; uv[i * 2 + 1] = (x * Math.sign(nor.getX(i)) * -1 + y * 0.5) / tile; }
        else if (slope && ny >= nx && ny >= nz){ uv[i * 2] = x / tile; uv[i * 2 + 1] = (z * Math.sign(nor.getZ(i)) * -1 + y * 0.5) / tile; }
        else if (ny >= nx && ny >= nz){ uv[i * 2] = x / tile; uv[i * 2 + 1] = -z / tile; } else if (nx > nz){ uv[i * 2] = z / tile; uv[i * 2 + 1] = y / tile; } else { uv[i * 2] = x / tile; uv[i * 2 + 1] = y / tile; } }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    g.computeBoundingBox(); g.boundingBox.getCenter(v); g.boundingBox.getSize(box.min);
    const big = Math.max(box.min.x, box.min.z) > cell * 1.5;
    const key = cm.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + (o.renderOrder || 0) + '|' + (big ? 'big' : Math.floor(v.x / cell) + ',' + Math.floor(v.z / cell));
    let b = buckets.get(key); if (!b){ b = {m: cm, cast: o.castShadow, recv: o.receiveShadow, order: o.renderOrder || 0, geos: []}; buckets.set(key, b); }
    b.geos.push(g); gone.push(o); nIn++;
  });
  gone.forEach(o => { if (o.parent) o.parent.remove(o); });
  const root = new THREE.Group(); root.name = 'world'; root.userData.dyn = true; let nOut = 0;
  buckets.forEach(b => { const g = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false); if (!g) return; g.computeBoundingSphere(); g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, b.m); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.order; mesh.matrixAutoUpdate = false; root.add(mesh); nOut++; });
  scene.add(root);
  return {meshesIn: nIn, meshesOut: nOut, materials: canon.size, root};
}

// ---------------- wind ----------------
// One clock for everything that sways: leaves, branches, grass.
export const WIND = {time: {value: 0}, strength: {value: 1}};
const WIND_GLSL = `
  uniform float uWindT; uniform float uWindK;
  vec3 windSway(vec3 wp, float h){   // wp: where the point is in the world, h: how far up the plant it is (0 at the ground)
    float a = sin(uWindT * 1.1 + wp.x * 0.13 + wp.z * 0.11), b = sin(uWindT * 2.3 + wp.x * 0.31 - wp.z * 0.27), c = sin(uWindT * 5.1 + wp.x * 2.1 + wp.y * 1.7 + wp.z * 1.3);
    return vec3(a * 0.9 + b * 0.35 + c * 0.22, 0.0, a * 0.55 - b * 0.4 + c * 0.2) * h * uWindK; }`;
function swayPatch(material, amount, key){
  material.onBeforeCompile = sh => { sh.uniforms.uWindT = WIND.time; sh.uniforms.uWindK = WIND.strength;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + WIND_GLSL)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 swp = instanceMatrix * vec4(position, 1.0);
        #else
          vec4 swp = vec4(position, 1.0);
        #endif
        transformed += windSway(swp.xyz, max(0.0, position.y - 0.22)) * ${amount.toFixed(4)};`);
    if (material.userData.softNormals) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    if (material.userData.a2c) sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', 'diffuseColor.a = smoothstep(alphaTest, alphaTest + max(fwidth(diffuseColor.a), 0.0001) * 1.2, diffuseColor.a); if (diffuseColor.a <= 0.0) discard;'); };
  material.customProgramCacheKey = () => 'sway' + key + amount;
  return material;
}

// ---------------- trees ----------------
// Two kinds, each built once at unit height and drawn everywhere with instancing: a broad shade tree (maple, oak) and a spruce.
// A shade tree is a trunk that forks, a dark core so you can't see through it, and a few hundred leaf sprays that face every which way.
// Leaves are lit as if the whole crown were one round thing, which is how a real crown reads from across a park.
function leafSprayTexture(){ const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 150; i++){ const a = r() * 6.283, d = Math.sqrt(r()) * 104, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, L = 15 + r() * 15, W = L * (0.42 + r() * 0.2), rot = a + (r() - 0.5) * 1.6, k = 0.62 + (d / 104) * 0.45 + (r() - 0.5) * 0.22;
    g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = `rgb(${Math.round(132 * k)},${Math.round(176 * k)},${Math.round(92 * k)})`;
    g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -W, L / 2, 0); g.quadraticCurveTo(0, W, -L / 2, 0); g.fill();
    g.strokeStyle = `rgba(${Math.round(190 * k)},${Math.round(214 * k)},${Math.round(140 * k)},.55)`; g.lineWidth = 1; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke(); g.restore(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function needleTexture(){ const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const g = cv.getContext('2d'); let s = 23; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.clearRect(0, 0, 128, 256); g.lineCap = 'round';
  // a bough: the twig runs down the middle from the trunk (top) to the tip (bottom), side twigs fan out, needles on all of them
  const twig = (x0, y0, x1, y1, w) => { const n = Math.max(6, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3.2)); for (let i = 0; i <= n; i++){ const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const sd of [-1, 1]){ const k = 0.55 + r() * 0.55, L = w * (0.75 + r() * 0.5), a = Math.atan2(y1 - y0, x1 - x0) + sd * (0.75 + r() * 0.5);
        g.strokeStyle = `rgb(${Math.round(70 * k)},${Math.round(128 * k)},${Math.round(84 * k)})`; g.lineWidth = 2.1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); } }
    g.strokeStyle = '#4a3a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  twig(64, 4, 64, 250, 12);
  for (let i = 0; i < 9; i++){ const y = 20 + i * 24, L = 14 + i * 4.6; twig(64, y, 64 - L, y + L * 0.9, 9); twig(64, y, 64 + L, y + L * 0.9, 9); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function quad(out, c, ax, ay, n, uv0 = 0, uv1 = 1){   // a card at c, spanned by half-axes ax and ay, shaded with normal n at every corner
  const P = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]], U = [[uv0, 0], [uv1, 0], [uv1, 1], [uv0, 0], [uv1, 1], [uv0, 1]];
  for (let i = 0; i < 6; i++){ out.pos.push(c.x + ax.x * P[i][0] + ay.x * P[i][1], c.y + ax.y * P[i][0] + ay.y * P[i][1], c.z + ax.z * P[i][0] + ay.z * P[i][1]); out.nor.push(n.x, n.y, n.z); out.uv.push(U[i][0], U[i][1]); } }
function toGeo(o){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2)); return g; }
function limb(a, b, ra, rb, seg = 7, vrep = 1){   // a tapered branch from a to b
  const L = a.distanceTo(b), g = new THREE.CylinderGeometry(rb, ra, L, seg, 1, true); g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * vrep); return g; }
function shadeTreeGeo(seed, density){
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const wood = [], core = [], leaves = {pos: [], nor: [], uv: []};
  const R = 0.36, top = 0.5 + R * 0.6, C = V(0, top + R * 0.1, 0);                         // the crown's center
  // the trunk, flared at the root, then the forks out to each part of the crown
  wood.push(limb(V(0, -0.02, 0), V(0, 0.07, 0), 0.062, 0.04, 9, 0.6)); wood.push(limb(V(0, 0.07, 0), V((r() - 0.5) * 0.03, 0.44, (r() - 0.5) * 0.03), 0.04, 0.03, 9, 2.4));
  const blobs = [{c: V(0, top, 0), r: R * 0.95}];
  for (let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2 + r() * 0.5, d = R * (0.55 + r() * 0.25); blobs.push({c: V(Math.cos(a) * d, top + (r() - 0.6) * R * 0.5, Math.sin(a) * d), r: R * (0.5 + r() * 0.3)}); }
  blobs.push({c: V(R * 0.1, top + R * 0.65, -R * 0.1), r: R * 0.6});
  blobs.forEach((b, i) => { if (i === 0) return; const from = V(0, 0.36 + r() * 0.08, 0), to = b.c.clone().lerp(V(0, top, 0), 0.25); wood.push(limb(from, to, 0.022, 0.008, 6, 1.6)); });
  blobs.forEach(b => { const g = new THREE.IcosahedronGeometry(b.r * 0.78, 1); g.translate(b.c.x, b.c.y, b.c.z); core.push(g); });
  const ax = V(), ay = V(), n = V(), d = V(), up = V(0, 1, 0), p = V();
  blobs.forEach(b => { const N = Math.round((16 + b.r * 70) * density);
    for (let i = 0; i < N; i++){ const u = r() * 2 - 0.55, t = r() * Math.PI * 2, q = Math.sqrt(Math.max(0, 1 - Math.min(1, u * u))); d.set(q * Math.cos(t), Math.min(1, u), q * Math.sin(t)).normalize();
      p.copy(b.c).addScaledVector(d, b.r * (0.78 + r() * 0.3)); const sz = b.r * (0.42 + r() * 0.3);
      n.copy(d).add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.3)).normalize();           // which way the spray faces
      ax.crossVectors(n, Math.abs(n.y) > 0.9 ? V(1, 0, 0) : up).normalize(); ay.crossVectors(ax, n).normalize(); const roll = r() * 6.283, cs = Math.cos(roll), sn = Math.sin(roll);
      const A = ax.clone().multiplyScalar(cs).addScaledVector(ay, sn).multiplyScalar(sz), B = ay.clone().multiplyScalar(cs).addScaledVector(ax, -sn).multiplyScalar(sz);
      const sn2 = p.clone().sub(C).normalize().lerp(up, 0.25).normalize();                          // lit as part of one round crown
      quad(leaves, p, A, B, sn2); } });
  return {wood: mergeGeometries(wood, false), core: mergeGeometries(core.map(g => { const q = g.index ? g.toNonIndexed() : g; q.computeVertexNormals(); return q; }), false), leaves: toGeo(leaves)};
}
function spruceGeo(seed, density){
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const boughs = {pos: [], nor: [], uv: []}, layers = Math.round(11 * (0.6 + 0.4 * density));
  const wood = limb(V(0, -0.02, 0), V(0, 0.93, 0), 0.026, 0.004, 7, 5);
  const core = new THREE.ConeGeometry(0.115, 0.8, 9, 1, true); core.translate(0, 0.56, 0);
  for (let k = 0; k < layers; k++){ const t = k / (layers - 1), y = 0.16 + t * 0.8, R = 0.30 * Math.pow(1 - t, 0.85) + 0.035, n = Math.max(4, Math.round((5 + (1 - t) * 4) * density)), a0 = r() * 6.283;
    for (let i = 0; i < n; i++){ const a = a0 + i / n * Math.PI * 2 + (r() - 0.5) * 0.35, droop = 0.32 + r() * 0.3 - t * 0.2, L = R * (0.85 + r() * 0.3), W = L * 0.52;
      const dir = V(Math.cos(a) * Math.cos(droop), -Math.sin(droop), Math.sin(a) * Math.cos(droop)), side = V(-Math.sin(a), 0, Math.cos(a));
      const c = V(0, y, 0).addScaledVector(dir, L * 0.5), nn = V(Math.cos(a) * 0.55, 0.85, Math.sin(a) * 0.55).normalize();
      quad(boughs, c, side.clone().multiplyScalar(W), dir.clone().multiplyScalar(-L * 0.5), nn); } }
  // the leader at the very top
  for (let i = 0; i < 3; i++){ const a = i / 3 * Math.PI; quad(boughs, V(0, 0.95, 0), V(Math.cos(a) * 0.035, 0, Math.sin(a) * 0.035), V(0, 0.07, 0), V(0, 1, 0)); }
  return {wood, core: (() => { const q = core.toNonIndexed(); q.computeVertexNormals(); return q; })(), leaves: toGeo(boughs)};
}
export function createForest(scene, T, tier){
  const leafTex = leafSprayTexture(), needleTex = needleTexture(), dummy = new THREE.Object3D(), col = new THREE.Color();
  const kinds = {
    shade: {variants: [shadeTreeGeo(101, tier.leaves), shadeTreeGeo(202, tier.leaves), shadeTreeGeo(303, tier.leaves)], tex: leafTex, sway: 0.016, leafCol: '#ffffff', coreCol: '#3f6d36', list: []},
    spruce: {variants: [spruceGeo(11, tier.leaves), spruceGeo(22, tier.leaves)], tex: needleTex, sway: 0.006, leafCol: '#ffffff', coreCol: '#2c5038', list: []}};
  const barkM = swayPatch(new THREE.MeshStandardMaterial({map: T.bark.map, normalMap: T.bark.normalMap, roughness: 0.95}), 0.016, 'bark');
  const meshes = [];
  return {
    add(kind, x, z, h, tone = 0){ kinds[kind].list.push({x, z, h, tone, rot: Math.random() * 6.283, w: 0.9 + Math.random() * 0.25}); },
    build(){
      for (const key of Object.keys(kinds)){ const K = kinds[key]; if (!K.list.length) continue;
        const leafM = new THREE.MeshStandardMaterial({map: K.tex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, alphaToCoverage: true}); leafM.userData.softNormals = true; leafM.userData.a2c = true; swayPatch(leafM, K.sway, key);
        const coreM = swayPatch(new THREE.MeshStandardMaterial({color: K.coreCol, roughness: 1, metalness: 0}), K.sway, key + 'core');
        const depthM = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, map: K.tex, alphaTest: 0.42, side: THREE.DoubleSide});
        K.variants.forEach((G, vi) => { const list = K.list.filter((_, i) => i % K.variants.length === vi); if (!list.length) return;
          const mk = (geo, m, cast, depth) => { const im = new THREE.InstancedMesh(geo, m, list.length); im.castShadow = cast; im.receiveShadow = true; if (depth) im.customDepthMaterial = depth; im.userData.dyn = true; im.frustumCulled = false; scene.add(im); meshes.push(im); return im; };
          const wood = mk(G.wood, key === 'shade' ? barkM : swayPatch(new THREE.MeshStandardMaterial({map: T.bark.map, normalMap: T.bark.normalMap, color: '#8a7a6a', roughness: 0.95}), K.sway, 'bark2'), true), core = mk(G.core, coreM, true), leaves = mk(G.leaves, leafM, true, depthM);
          list.forEach((t, i) => { dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, t.rot, 0); dummy.scale.set(t.h * t.w, t.h, t.h * t.w); dummy.updateMatrix(); wood.setMatrixAt(i, dummy.matrix); core.setMatrixAt(i, dummy.matrix); leaves.setMatrixAt(i, dummy.matrix);
            // every tree its own green: some yellower, some deeper, the dark ones darker
            const hsl = key === 'shade' ? [0.27 + (Math.random() - 0.5) * 0.07, 0.42 + Math.random() * 0.2, (t.tone ? 0.40 : 0.52) + Math.random() * 0.1] : [0.37 + (Math.random() - 0.5) * 0.04, 0.3 + Math.random() * 0.15, 0.42 + Math.random() * 0.1];
            col.setHSL(hsl[0], hsl[1], hsl[2]); leaves.setColorAt(i, col); col.setHSL(hsl[0], hsl[1] * 0.9, hsl[2] * 0.8); core.setColorAt(i, col); });
          [wood, core, leaves].forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }); });
      }
      return meshes; } };
}

// ---------------- grass you can see the blades of ----------------
// The lawn is a photo of grass on the ground. Around you, real blades stand up out of it: a square of them that follows you and wraps,
// so the same blades are reused as you run. They lean in the wind and part around your feet. A mask says where there is lawn.
export function createGrass(scene, tier, mask){
  const N = tier.grass; if (!N) return null;
  const SIZE = 46, pos = new Float32Array(N * 9), off = new Float32Array(N * 9), rnd = new Float32Array(N * 9); let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++){ const x = r() * SIZE, z = r() * SIZE, w = 0.022 + r() * 0.022, h = 0.10 + r() * r() * 0.20, a = r(), b = r(), c = r();
    for (let k = 0; k < 3; k++){ const j = i * 9 + k * 3; pos[j] = x; pos[j + 1] = 0; pos[j + 2] = z; off[j] = k === 0 ? -w : k === 1 ? w : 0; off[j + 1] = k === 2 ? h : 0; off[j + 2] = k === 2 ? 1 : 0; rnd[j] = a; rnd[j + 1] = b; rnd[j + 2] = c; } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aOff', new THREE.BufferAttribute(off, 3)); geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const U = {uCenter: {value: new THREE.Vector3()}, uFeet: {value: new THREE.Vector3(0, -100, 0)}, uMask: {value: mask.texture}, uMaskMin: {value: new THREE.Vector2(mask.x0, mask.z0)}, uMaskSize: {value: new THREE.Vector2(mask.w, mask.d)}};
  const m = new THREE.MeshLambertMaterial({color: '#ffffff', side: THREE.DoubleSide});
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, {uWindT: WIND.time, uWindK: WIND.strength});
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec3 aOff; attribute vec3 aRnd; uniform vec3 uCenter; uniform vec3 uFeet; uniform sampler2D uMask; uniform vec2 uMaskMin; uniform vec2 uMaskSize; uniform float uWindT; uniform float uWindK; varying float vTip; varying float vTone;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `
        const float SZ = ${SIZE.toFixed(1)};
        vec2 cell = mod(position.xz - uCenter.xz + SZ * 0.5, SZ) - SZ * 0.5; vec3 wp = vec3(uCenter.x + cell.x, 0.0, uCenter.z + cell.y);
        float lawn = texture2D(uMask, (wp.xz - uMaskMin) / uMaskSize).r; float grow = (1.0 - smoothstep(SZ * 0.30, SZ * 0.49, length(cell))) * smoothstep(0.45, 0.6, lawn);
        float yaw = aRnd.x * 6.2831; vec2 across = vec2(cos(yaw), sin(yaw)); float tip = aOff.z;
        vec2 wind = vec2(sin(uWindT * 1.7 + wp.x * 0.41 + wp.z * 0.29) + 0.4 * sin(uWindT * 4.3 + wp.x * 1.3), cos(uWindT * 1.3 + wp.x * 0.33 - wp.z * 0.47)) * 0.045 * uWindK;
        vec2 away = wp.xz - uFeet.xz; float near = 1.0 - smoothstep(0.15, 0.85, length(away)); vec2 push = normalize(away + vec2(1e-4)) * near * 0.16 * step(abs(uFeet.y), 0.5);
        vec2 lean = vec2(aRnd.y - 0.5, aRnd.z - 0.5) * 0.09;
        wp.xz += across * aOff.x * grow + (wind + push + lean) * tip * grow; wp.y += aOff.y * grow * (1.0 - near * 0.45 * step(abs(uFeet.y), 0.5));
        vTip = tip; vTone = aRnd.y;
        vec3 transformed = wp;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTip; varying float vTone;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= mix(vec3(0.12, 0.26, 0.07), vec3(0.42, 0.62, 0.20), vTip) * (0.82 + vTone * 0.36);'); };
  m.customProgramCacheKey = () => 'blades';
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; mesh.userData.dyn = true; mesh.name = 'blades'; scene.add(mesh);
  return {mesh, at(x, y, z, on){ U.uCenter.value.set(x, 0, z); U.uFeet.value.set(x, on ? y : -100, z); mesh.visible = on !== null; }};
}

// ---------------- the lawn ----------------
// A photo of grass, sampled at two sizes so the repeat never shows, with brown and bright patches, and mowing stripes on the park's own lawn.
export function lawnMaterial(T, color, stripes){
  const m = new THREE.MeshStandardMaterial({map: T.grass, normalMap: T.grassN, color, roughness: 1, metalness: 0}); m.userData.worldUV = 5.5; m.userData.key = 'lawn' + stripes; m.normalScale.set(0.8, 0.8);
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLawnW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLawnW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLawnW;
      float lhash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float lnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(lhash(i), lhash(i + vec2(1.0, 0.0)), f.x), mix(lhash(i + vec2(0.0, 1.0)), lhash(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 g1 = texture2D(map, vMapUv), g2 = texture2D(map, vMapUv * 0.23 + vec2(0.37, 0.11));
        vec4 sampledDiffuseColor = mix(g1, g2, 0.5);
        float patchy = lnoise(vLawnW.xz * 0.045) * 0.6 + lnoise(vLawnW.xz * 0.17 + 7.0) * 0.4;
        sampledDiffuseColor.rgb *= 0.80 + patchy * 0.42;
        sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, sampledDiffuseColor.rgb * vec3(1.14, 1.03, 0.70), smoothstep(0.62, 0.9, lnoise(vLawnW.xz * 0.021 + 3.0)) * 0.5);
        ${stripes ? 'float stripe = sin((vLawnW.x * 0.955 + vLawnW.z * 0.296) * 3.14159 / 3.2); sampledDiffuseColor.rgb *= 1.0 + smoothstep(-0.25, 0.25, stripe) * 0.10 - 0.05;' : ''}
        diffuseColor *= sampledDiffuseColor;
      #endif`); };
  m.customProgramCacheKey = () => 'lawn' + stripes;
  return m;
}

// ---------------- the pools ----------------
// The light that dances on a pool floor: a net of bright lines. Two copies drift across each other and the floor takes the darker of the two.
function causticTexture(){ const n = 256, cells = 7, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d'), img = g.createImageData(n, n); let s = 91; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pts = []; for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.15 + r() * 0.7) / cells, (j + 0.15 + r() * 0.7) / cells]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){ const u = x / n, v = y / n, ci = Math.floor(u * cells), cj = Math.floor(v * cells); let f1 = 9, f2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++){ const i = (ci + di + cells) % cells, j = (cj + dj + cells) % cells, p = pts[j * cells + i]; let dx = Math.abs(p[0] - u), dy = Math.abs(p[1] - v); if (dx > 0.5) dx = 1 - dx; if (dy > 0.5) dy = 1 - dy; const d = Math.hypot(dx, dy) * cells; if (d < f1){ f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
    const e = Math.max(0, 1 - (f2 - f1) / 0.42), c = Math.pow(e, 2.6) * 255, k = (y * n + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = c; img.data[k + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
const POOL = {time: {value: 0}, caustic: {value: null}, sunK: {value: 1}};
// what the basins are made of: pale plaster, with the light net moving over it wherever it is under water
export function poolFloorMaterial(T, color, o = {}){
  if (!POOL.caustic.value) POOL.caustic.value = causticTexture();
  const m = new THREE.MeshStandardMaterial(Object.assign({map: T.plaster.map, normalMap: T.plaster.normalMap, color, roughness: 0.7, metalness: 0}, o)); m.userData.worldUV = 1.6; m.userData.key = 'poolfloor';
  m.onBeforeCompile = sh => { sh.uniforms.uPoolT = POOL.time; sh.uniforms.tCaustic = POOL.caustic; sh.uniforms.uCausK = POOL.sunK;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPoolW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPoolW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPoolW; uniform float uPoolT; uniform sampler2D tCaustic; uniform float uCausK;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec2 cp = vPoolW.xz + vec2(vPoolW.y * 0.35, vPoolW.y * 0.2);
          float ca = min(texture2D(tCaustic, cp * 0.21 + vec2(uPoolT * 0.021, uPoolT * 0.013)).r, texture2D(tCaustic, cp * 0.27 - vec2(uPoolT * 0.017, -uPoolT * 0.019)).r);
          float under = smoothstep(0.03, -0.12, vPoolW.y);
          diffuseColor.rgb *= 1.0 + (ca * 1.5 - 0.10) * under * uCausK; }`); };
  m.customProgramCacheKey = () => 'poolfloor';
  return m;
}
const WATER_VERT = `
  attribute float aDepth; uniform mat4 uReflM; varying vec3 vW; varying vec4 vRefl; varying float vDepth;
  #include <fog_pars_vertex>
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vDepth = aDepth; vRefl = uReflM * wp; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const WATER_FRAG = `
  uniform float uTime; uniform vec3 uSun; uniform vec3 uSunCol; uniform sampler2D tNormal; uniform sampler2D tReflect; uniform float uPlanar; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uLight;
  varying vec3 vW; varying vec4 vRefl; varying float vDepth;
  #include <common>
  #include <fog_pars_fragment>
  void main(){
    vec2 uv = vW.xz;
    vec3 a = texture2D(tNormal, uv * 0.115 + vec2(uTime * 0.016, uTime * 0.010)).xyz * 2.0 - 1.0;
    vec3 b = texture2D(tNormal, uv * 0.263 - vec2(uTime * 0.012, -uTime * 0.020)).xyz * 2.0 - 1.0;
    vec3 c = texture2D(tNormal, uv * 0.71 + vec2(-uTime * 0.03, uTime * 0.024)).xyz * 2.0 - 1.0;
    vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
    float calm = 1.0 / (1.0 + dist * 0.035);                                  // far water reads flatter, so it mirrors the sky instead of sparkling to noise
    vec3 n = normalize(vec3((a.x + b.x) * 0.10 + c.x * 0.05 * calm, 1.0, (a.y + b.y) * 0.10 + c.y * 0.05 * calm));
    float cosT = max(dot(V, n), 0.0), fres = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
    vec3 R = reflect(-V, n); R.y = abs(R.y);
    vec3 refl = mix(uHor, uZen, pow(clamp(R.y, 0.0, 1.0), 0.42));
    if (uPlanar > 0.5){ vec2 ruv = vRefl.xy / vRefl.w + n.xz * 0.045; refl = texture2D(tReflect, clamp(ruv, 0.001, 0.999)).rgb; }
    float sd = max(dot(R, uSun), 0.0); vec3 glint = uSunCol * (pow(sd, 900.0) * 28.0 + pow(sd, 90.0) * 0.55);
    float path = vDepth / max(V.y, 0.22);                                     // how much water the eye looks through
    vec3 body = mix(uShallow, uDeep, 1.0 - exp(-path * 0.42)) * uLight;
    float alpha = clamp((1.0 - exp(-path * 0.62)) * 0.86 + fres, 0.0, 1.0);
    alpha *= smoothstep(0.0, 0.05, vDepth);                                   // the beach edge fades to nothing
    vec3 col = mix(body, refl, fres) + glint;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
export function createPoolWater(scene, T, tier, sky, renderer){
  const U = {uTime: POOL.time, uSun: {value: sky.sunDir}, uSunCol: {value: new THREE.Color(1, 1, 1)}, tNormal: {value: T.waterN}, tReflect: {value: null}, uPlanar: {value: 0}, uReflM: {value: new THREE.Matrix4()},
    uZen: {value: new THREE.Color()}, uHor: {value: new THREE.Color()}, uShallow: {value: new THREE.Color(0.30, 0.78, 0.86)}, uDeep: {value: new THREE.Color(0.03, 0.30, 0.56)}, uLight: {value: 1}};
  const mat = new THREE.ShaderMaterial({uniforms: Object.assign(U, THREE.UniformsUtils.clone(THREE.UniformsLib.fog)), vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, fog: true});
  const meshes = [], bounds = new THREE.Box3();
  function add(geo, depthOf){ const pos = geo.attributes.position, d = new Float32Array(pos.count); for (let i = 0; i < pos.count; i++) d[i] = depthOf(pos.getX(i), pos.getZ(i)); geo.setAttribute('aDepth', new THREE.BufferAttribute(d, 1));
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 1; m.userData.dyn = true; m.name = 'water'; scene.add(m); meshes.push(m); geo.computeBoundingBox(); bounds.union(geo.boundingBox); return m; }
  // the mirror: the park drawn once more from under the water line, shared by every pool since they all sit at the same height
  let rt = null; const vcam = new THREE.PerspectiveCamera(), plane = new THREE.Plane(), nrm = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), camP = new THREE.Vector3(), view = new THREE.Vector3(), rot = new THREE.Matrix4(), look = new THREE.Vector3(), tgt = new THREE.Vector3(), clip = new THREE.Vector4(), q = new THREE.Vector4(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  const Y = 0.02;
  function mirror(scene_, camera, hide){
    if (!tier.reflect){ U.uPlanar.value = 0; return; }
    camP.setFromMatrixPosition(camera.matrixWorld); pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    if (camP.y < Y + 0.05 || !frustum.intersectsBox(bounds) || bounds.distanceToPoint(camP) > 260){ U.uPlanar.value = 0; return; }
    if (!rt){ const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); rt = new THREE.WebGLRenderTarget(Math.max(256, Math.round(sz.x * 0.5)), Math.max(256, Math.round(sz.y * 0.5)), {type: THREE.HalfFloatType, samples: 0}); U.tReflect.value = rt.texture; }
    at.set(camP.x, Y, camP.z); view.subVectors(at, camP).reflect(nrm).negate().add(at);
    rot.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(camP); tgt.subVectors(at, look).reflect(nrm).negate().add(at);
    vcam.position.copy(view); vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(nrm); vcam.lookAt(tgt); vcam.near = camera.near; vcam.far = camera.far; vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(camera.projectionMatrix); vcam.matrixWorldInverse.copy(vcam.matrixWorld).invert();
    U.uReflM.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
    plane.setFromNormalAndCoplanarPoint(nrm, at).applyMatrix4(vcam.matrixWorldInverse); clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = vcam.projectionMatrix.elements; q.x = (Math.sign(clip.x) + P[8]) / P[0]; q.y = (Math.sign(clip.y) + P[9]) / P[5]; q.z = -1; q.w = (1 + P[10]) / P[14]; clip.multiplyScalar(2 / clip.dot(q));
    P[2] = clip.x; P[6] = clip.y; P[10] = clip.z + 1 - 0.003; P[14] = clip.w;
    const was = hide.map(o => o.visible); hide.forEach(o => { o.visible = false; }); meshes.forEach(m => { m.visible = false; });
    const cur = renderer.getRenderTarget(), auto = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene_, vcam); renderer.setRenderTarget(cur); renderer.shadowMap.autoUpdate = auto;
    hide.forEach((o, i) => { o.visible = was[i]; }); meshes.forEach(m => { m.visible = true; }); U.uPlanar.value = 1;
  }
  return {mat, meshes, add, mirror, uniforms: U,
    rect(x0, z0, x1, z1, depth){ const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, Y, (z0 + z1) / 2); return add(g, () => depth); },
    setLight(P){ U.uZen.value.setRGB(P.zen[0], P.zen[1], P.zen[2]); U.uHor.value.setRGB(P.hor[0], P.hor[1], P.hor[2]); U.uSunCol.value.setRGB(P.sunCol[0], P.sunCol[1], P.sunCol[2]).multiplyScalar(0.25 + 0.75 * P.day); U.uLight.value = 0.16 + 0.84 * P.day; POOL.sunK.value = 0.15 + 0.85 * P.day; },
    resize(){ if (rt){ rt.dispose(); rt = null; U.tReflect.value = null; } }};
}

// the clocks everything shares
export function tick(dt){ WIND.time.value += dt; POOL.time.value += dt; }

// ---------------- the finishing passes ----------------
// The park is drawn into a wide-range buffer, then: soft shadow in the creases where things meet (ambient occlusion, worked out from depth),
// a glow off anything brighter than white (the sun on the water, the sun itself), and last the film: tone curve, a little contrast and color, darker corners.
const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const AO_FRAG = `
  uniform sampler2D tDepth; uniform vec2 uPx; uniform mat4 uInvProj; uniform float uProjScale; uniform float uRadius; uniform float uNear; uniform float uFar;
  varying vec2 vUv;
  vec3 vpos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
  void main(){
    float d0 = texture2D(tDepth, vUv).x; if (d0 >= 0.99999){ gl_FragColor = vec4(1.0); return; }
    vec3 p = vpos(vUv); float dist = -p.z; if (dist > 140.0){ gl_FragColor = vec4(1.0); return; }
    vec3 pl = vpos(vUv - vec2(uPx.x, 0.0)), pr = vpos(vUv + vec2(uPx.x, 0.0)), pu = vpos(vUv + vec2(0.0, uPx.y)), pd = vpos(vUv - vec2(0.0, uPx.y));
    vec3 dx = abs(pr.z - p.z) < abs(p.z - pl.z) ? pr - p : p - pl, dy = abs(pu.z - p.z) < abs(p.z - pd.z) ? pu - p : p - pd;
    vec3 n = normalize(cross(dx, dy));
    float rpx = clamp(uRadius * uProjScale / dist, 3.0, 48.0);
    float rnd = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
    float sum = 0.0; const int N = 10;
    for (int i = 0; i < N; i++){ float fi = float(i), a = fi * 2.3999632 + rnd, r = sqrt((fi + 0.5) / float(N)) * rpx; vec2 uv2 = vUv + vec2(cos(a), sin(a)) * r * uPx;
      vec3 v = vpos(uv2) - p; float d2 = dot(v, v), vn = dot(v, n) - 0.012 * dist - 0.02;
      sum += max(0.0, vn) / (d2 + 0.01) * (1.0 - smoothstep(uRadius * 0.6, uRadius * 1.6, sqrt(d2))); }
    float ao = clamp(1.0 - sum * (2.0 * 0.10 / float(N)) * 3.2, 0.0, 1.0);
    ao = mix(ao, 1.0, smoothstep(70.0, 140.0, dist));
    gl_FragColor = vec4(ao, dist / 200.0, 0.0, 1.0);
  }`;
const AO_BLUR_FRAG = `
  uniform sampler2D tAO; uniform vec2 uPx; varying vec2 vUv;
  void main(){ vec2 c = texture2D(tAO, vUv).xy; float sum = 0.0, w = 0.0;
    for (int j = -2; j <= 1; j++) for (int i = -2; i <= 1; i++){ vec2 s = texture2D(tAO, vUv + (vec2(float(i), float(j)) + 0.5) * uPx).xy; float k = 1.0 / (1.0 + abs(s.y - c.y) * 900.0); sum += s.x * k; w += k; }
    gl_FragColor = vec4(sum / w, c.y, 0.0, 1.0); }`;
const AO_MIX_FRAG = `uniform sampler2D tColor; uniform sampler2D tAO; uniform float uK; varying vec2 vUv;
  void main(){ vec4 c = texture2D(tColor, vUv); float ao = texture2D(tAO, vUv).x; c.rgb *= mix(1.0, ao, uK); gl_FragColor = c; }`;
const FILM_FRAG = `
  uniform sampler2D tColor; uniform float uSat; uniform float uContrast; uniform float uVig; uniform float uFade; varying vec2 vUv;
  void main(){
    gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 c = gl_FragColor.rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat); c = (c - 0.5) * uContrast + 0.5;
    vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * uVig;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0) * uFade, 1.0);
  }`;
export function createPost(renderer, tier){
  if (!tier.post) return null;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null), qscene = new THREE.Scene(), qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); quad.frustumCulled = false; qscene.add(quad);
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(qscene, qcam); };
  const sm = (frag, uniforms, o = {}) => new THREE.ShaderMaterial(Object.assign({vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false}, o));
  const size = new THREE.Vector2(); let sceneRT, compRT, aoRT, aoRT2, bloom = null, W = 0, H = 0;
  const aoM = sm(AO_FRAG, {tDepth: {value: null}, uPx: {value: new THREE.Vector2()}, uInvProj: {value: new THREE.Matrix4()}, uProjScale: {value: 1}, uRadius: {value: 0.55}, uNear: {value: 0.1}, uFar: {value: 2000}});
  const blurM = sm(AO_BLUR_FRAG, {tAO: {value: null}, uPx: {value: new THREE.Vector2()}});
  const mixM = sm(AO_MIX_FRAG, {tColor: {value: null}, tAO: {value: null}, uK: {value: 0.85}});
  const filmM = sm(FILM_FRAG, {tColor: {value: null}, uSat: {value: 1.12}, uContrast: {value: 1.06}, uVig: {value: 0.55}, uFade: {value: 1}}, {toneMapped: true});
  function build(){
    renderer.getDrawingBufferSize(size); W = size.x; H = size.y; [sceneRT, compRT, aoRT, aoRT2].forEach(t => t && t.dispose());
    sceneRT = new THREE.WebGLRenderTarget(W, H, {type: THREE.HalfFloatType, samples: tier.msaa}); sceneRT.depthTexture = new THREE.DepthTexture(W, H); sceneRT.depthTexture.type = THREE.UnsignedIntType;
    compRT = new THREE.WebGLRenderTarget(W, H, {type: THREE.HalfFloatType, depthBuffer: false});
    const hw = Math.max(2, W >> 1), hh = Math.max(2, H >> 1); aoRT = new THREE.WebGLRenderTarget(hw, hh, {depthBuffer: false}); aoRT2 = new THREE.WebGLRenderTarget(hw, hh, {depthBuffer: false});
    if (tier.bloom){ if (bloom) bloom.setSize(W, H); else { bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.32, 0.55, 1.15); } }
  }
  build();
  return {film: filmM.uniforms, ao: aoM.uniforms, aoMix: mixM.uniforms, get bloom(){ return bloom; },
    resize(){ build(); },
    render(scene, camera){
      const cur = renderer.getRenderTarget();
      renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
      let color = sceneRT;
      if (tier.ao){
        aoM.uniforms.tDepth.value = sceneRT.depthTexture; aoM.uniforms.uPx.value.set(1 / aoRT.width, 1 / aoRT.height); aoM.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); aoM.uniforms.uProjScale.value = camera.projectionMatrix.elements[5] * aoRT.height * 0.5;
        pass(aoM, aoRT); blurM.uniforms.tAO.value = aoRT.texture; blurM.uniforms.uPx.value.set(1 / aoRT.width, 1 / aoRT.height); pass(blurM, aoRT2);
        mixM.uniforms.tColor.value = sceneRT.texture; mixM.uniforms.tAO.value = aoRT2.texture; pass(mixM, compRT); color = compRT;
      }
      if (bloom) bloom.render(renderer, null, color, 0, false);
      filmM.uniforms.tColor.value = color.texture; pass(filmM, cur);
    }};
}

// ---------------- what people are made of ----------------
// Small maps for the cast: hair that reads as strands, cloth with a weave, a knit, and an iris with fibers and a dark rim.
export function charTextures(){
  const P = lattice(71), P2 = lattice(97), C = {};
  C.hair = makeMaps(256, (u, v) => 0.5 + (pnoise(P, u * 110, v * 3, 110) - 0.5) * 0.9 + (pnoise(P2, u * 34, v * 2 + 5, 34) - 0.5) * 0.6, () => [255, 255, 255], 2.6).normalMap; C.hair.repeat.set(2, 1);
  C.cloth = makeMaps(128, (u, v) => (Math.sin(u * 48 * Math.PI) * 0.5 + 0.5) * 0.5 + (Math.sin(v * 48 * Math.PI) * 0.5 + 0.5) * 0.5 + (pnoise(P, u * 40, v * 40, 40) - 0.5) * 0.2, () => [255, 255, 255], 1.4).normalMap; C.cloth.repeat.set(9, 12);
  C.knit = makeMaps(128, (u, v) => { const fu = (u * 16) % 1, fv = (v * 12) % 1; return Math.abs(Math.sin((fu + (fv < 0.5 ? fv : 1 - fv) * 0.9) * Math.PI)) * 0.8; }, () => [255, 255, 255], 2.4).normalMap; C.knit.repeat.set(3, 4);
  C.fur = makeMaps(128, (u, v) => 0.5 + (pnoise(P, u * 90, v * 24, 90) - 0.5) * 0.9 + (pnoise(P2, u * 30, v * 10, 30) - 0.5) * 0.4, () => [255, 255, 255], 2.0).normalMap; C.fur.repeat.set(2, 2);
  // the iris, unrolled: across is around the eye, down is from the pupil out to the rim
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d'); let s = 13; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 260; i++){ const x = r() * 256, k = 120 + r() * 135; g.strokeStyle = `rgba(${k},${k},${k},.55)`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); g.moveTo(x, 20); g.lineTo(x + (r() - 0.5) * 8, 60); g.stroke(); }
    let gr = g.createLinearGradient(0, 20, 0, 36); gr.addColorStop(0, 'rgba(255,240,200,.75)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 20, 256, 16);   // the lighter ring round the pupil
    gr = g.createLinearGradient(0, 46, 0, 64); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,.8)'); gr.addColorStop(1, 'rgba(0,0,0,.95)'); g.fillStyle = gr; g.fillRect(0, 46, 256, 18);   // the dark rim
    g.fillStyle = '#050505'; g.fillRect(0, 0, 256, 21);                                                                                                                                  // the pupil
    C.iris = new THREE.CanvasTexture(cv); C.iris.colorSpace = THREE.SRGBColorSpace; C.iris.wrapS = THREE.RepeatWrapping; }
  return C;
}
// an iris: a shallow dome with the unrolled picture wrapped round its pole, so the fibers run out from the pupil
export function irisGeometry(rad){ const th = 0.9, rs = rad / Math.sin(th), g = new THREE.SphereGeometry(rs, 28, 8, 0, Math.PI * 2, 0, th), uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++){ const y = pos.getY(i), t = Math.acos(Math.max(-1, Math.min(1, y / rs))) / th; uv.setY(i, 1 - t); }
  g.translate(0, -rs * Math.cos(th), 0); g.rotateX(Math.PI / 2); return g; }
// the leva heart, pixel for pixel from the logo: a is the heart, b is the light on it
export const LEVA_HEART = ['..aaaaaa..aaaaaa....', '.aaaaaaaaaaaaaaaa...', '.abbbbaaaaaaaaaaa...', 'aabbbbaaaaaaaaaaaa..', 'aabbbbaaaaaaaaaaaa..', '.aabbbbaaaaaaaaaaaa.', 'aaaaaaaaaaaaaaaaa...', 'aaaaaaaaaaaaaaaaaa..', '.aaaaaaaaaaaaaaaa...', '.aaaaaaaaaaaaaaaa...', '.aaaaaaaaaaaaaaaa...', '..aaaaaaaaaaaaaa....', '...aaaaaaaaaaaa.....', '....aaaaaaaaaaaa....', '....aaaaaaaaaa......', '......aaaaaa........', '.......aaaa.........', '........aa..........'];
export function heartCanvas(px = 6){ const cv = document.createElement('canvas'); cv.width = 20 * px; cv.height = 18 * px; const g = cv.getContext('2d'); LEVA_HEART.forEach((row, y) => { for (let x = 0; x < 20; x++){ const c = row[x]; if (c === '.') continue; g.fillStyle = c === 'b' ? '#FF96C8' : '#FF2E88'; g.fillRect(x * px, y * px, px, px); } }); return cv; }
// the heart as a little slab of boxes, for leva's chest
export function heartGeometry(w = 0.1, depth = 0.012){ const s = w / 20, geos = { a: [], b: [] }; LEVA_HEART.forEach((row, y) => { let x = 0; while (x < 20){ const c = row[x]; if (c === '.'){ x++; continue; } let x1 = x; while (x1 < 20 && row[x1] === c) x1++; const g = new THREE.BoxGeometry((x1 - x) * s, s, depth); g.translate(((x + x1) / 2 - 10) * s, (9 - y - 0.5) * s, 0); geos[c].push(g); x = x1; } });
  return {a: mergeGeometries(geos.a, false), b: mergeGeometries(geos.b, false)}; }
