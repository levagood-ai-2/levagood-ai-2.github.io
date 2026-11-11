// The park's people. Real human shapes (built offline from the MakeHuman CC0 base mesh), a small skeleton with a neck,
// collar bones, wrists, fingers and toes, and face shapes that blink, look, smile and talk.
// loadPeople() fetches the pack once; buildPerson() makes one person from it.
import * as THREE from 'three';

const TYPES = {uint8: Uint8Array, int8: Int8Array, uint16: Uint16Array, int16: Int16Array, uint32: Uint32Array, float32: Float32Array};

export async function loadPeople(url = 'pool/people/people.bin'){
  const res = await fetch(url); if (!res.ok) throw new Error('people pack ' + res.status);
  const buf = await res.arrayBuffer(), dv = new DataView(buf), hl = dv.getUint32(0, true);
  const info = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), base = 4 + hl;
  const arr = name => { const a = info.arrays[name]; if (!a) return null; return new TYPES[a.t](buf, base + a.o, a.n); };
  const DB = {info, arr, meta: n => info.arrays[n], shared: {}, cache: {}};
  // what every person shares: uvs, skin weights, triangles
  for (const m of Object.keys(info.meshes)){
    const uvq = arr(m + '.uv'), uv = new Float32Array(uvq.length); for (let i = 0; i < uvq.length; i += 2){ uv[i] = uvq[i] / 65535; uv[i + 1] = uvq[i + 1] / 65535; }
    const swq = arr(m + '.sw'), sw = new Float32Array(swq.length); for (let i = 0; i < swq.length; i++) sw[i] = swq[i] / 255;
    DB.shared[m] = {uv: new THREE.BufferAttribute(uv, 2), si: new THREE.BufferAttribute(new Uint16Array(arr(m + '.si')), 4), sw: new THREE.BufferAttribute(sw, 4),
      idx: new THREE.BufferAttribute(arr(m + '.idx'), 1), orig: arr(m + '.orig'), nv: info.meshes[m].nv, groups: info.meshes[m].groups};
  }
  return DB;
}

// face shapes for one mix of the three base faces, as dense arrays the GPU can blend
function morphsFor(DB, race){
  const key = Object.entries(race).filter(e => e[1] > 1e-3).map(e => e[0] + e[1].toFixed(2)).join('|');
  if (DB.cache[key]) return DB.cache[key];
  const nv = DB.shared.head.nv, out = [];
  for (const name of DB.info.morphs){
    const d = new Float32Array(nv * 3);
    for (const r in race){ const w = race[r]; if (w <= 1e-3) continue;
      const ii = DB.arr('morph.' + r + '.' + name + '.i'), dd = DB.arr('morph.' + r + '.' + name + '.d'), q = DB.meta('morph.' + r + '.' + name + '.d').q * w;
      for (let k = 0; k < ii.length; k++){ const o = ii[k] * 3; d[o] += dd[k * 3] * q; d[o + 1] += dd[k * 3 + 1] * q; d[o + 2] += dd[k * 3 + 2] * q; } }
    const a = new THREE.BufferAttribute(d, 3); a.name = name; out.push(a);
  }
  return DB.cache[key] = out;
}

function geometryFor(DB, id, m){
  const key = 'geo:' + id + ':' + m; if (DB.cache[key]) return DB.cache[key];
  const S = DB.shared[m], pq = DB.arr(id + '.' + m + '.pos'), nq = DB.arr(id + '.' + m + '.nrm'), ps = DB.meta(id + '.' + m + '.pos').q;
  const pos = new Float32Array(pq.length), nrm = new Float32Array(nq.length);
  for (let i = 0; i < pq.length; i++){ pos[i] = pq[i] * ps; nrm[i] = nq[i] / 127; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', S.uv); g.setAttribute('skinIndex', S.si); g.setAttribute('skinWeight', S.sw); g.setIndex(S.idx);
  return DB.cache[key] = g;
}

// smooth normals across UV seams: triangles add their normal to the original vertex, every copy of it reads the sum
function smoothNormals(pos, idx, orig){
  const acc = new Float32Array(65536 * 3), out = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3){ const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]){ const o = orig[v / 3] * 3; acc[o] += nx; acc[o + 1] += ny; acc[o + 2] += nz; } }
  for (let i = 0; i < orig.length; i++){ const o = orig[i] * 3, l = Math.hypot(acc[o], acc[o + 1], acc[o + 2]) || 1; out[i * 3] = acc[o] / l; out[i * 3 + 1] = acc[o + 1] / l; out[i * 3 + 2] = acc[o + 2] / l; }
  return out;
}

// an eye: a white ball with an iris at the front pole and a clear dome over it, on a pivot that turns to look
const irisCache = {};
export function irisTexture(color = '#6b7d5a'){
  if (irisCache[color]) return irisCache[color];
  const W = 256, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  // rows run from the front pole (top) to the back of the eye (bottom); the iris takes the first 29 degrees, the pupil the first 9
  const IR = H * 29 / 180, PU = H * 9.5 / 180, c = new THREE.Color(color), dark = c.clone().multiplyScalar(0.4), lite = c.clone().lerp(new THREE.Color('#ffffff'), 0.22);
  g.fillStyle = '#e4dfd9'; g.fillRect(0, 0, W, H);
  const sg = g.createLinearGradient(0, IR, 0, H * 0.62); sg.addColorStop(0, 'rgba(214,190,180,.55)'); sg.addColorStop(0.25, 'rgba(240,232,226,0)'); sg.addColorStop(1, 'rgba(226,170,160,.5)'); g.fillStyle = sg; g.fillRect(0, IR, W, H);
  const ig = g.createLinearGradient(0, PU, 0, IR); ig.addColorStop(0, '#' + lite.getHexString()); ig.addColorStop(0.55, '#' + c.getHexString()); ig.addColorStop(1, '#' + dark.getHexString());
  g.fillStyle = ig; g.fillRect(0, 0, W, IR);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 150; i++){ const x = rnd() * W; g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.2)'; g.lineWidth = 0.8 + rnd() * 1.4; g.beginPath(); g.moveTo(x, PU); g.lineTo(x + (rnd() - 0.5) * 5, IR - 2); g.stroke(); }
  g.fillStyle = 'rgba(20,14,10,.7)'; g.fillRect(0, IR - 4, W, 5.5);
  g.fillStyle = '#0a0808'; g.fillRect(0, 0, W, PU);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return irisCache[color] = t;
}
let EYE_GEO = null, CORNEA_GEO = null;
function eyeGeos(){
  if (!EYE_GEO){ EYE_GEO = new THREE.SphereGeometry(1, 28, 20); EYE_GEO.rotateX(Math.PI / 2);                 // the pole faces forward (+z)
    CORNEA_GEO = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, 0.62); CORNEA_GEO.rotateX(Math.PI / 2); }
  return [EYE_GEO, CORNEA_GEO];
}
function makeEye(c, r, color, parent, origin){
  const [eg, cg] = eyeGeos(), piv = new THREE.Group(); piv.position.set(c[0] - origin.x, c[1] - origin.y, c[2] - origin.z); parent.add(piv);
  const ball = new THREE.Mesh(eg, new THREE.MeshStandardMaterial({map: irisTexture(color), roughness: 0.35, envMapIntensity: 0.3})); ball.scale.setScalar(r); piv.add(ball);
  // the clear dome over the iris adds only what it reflects: a little sky and the glint of the sun
  const cor = new THREE.Mesh(cg, new THREE.MeshPhysicalMaterial({color: '#000000', transparent: true, blending: THREE.AdditiveBlending, roughness: 0.04, depthWrite: false, envMapIntensity: 0.55}));
  cor.scale.set(r * 0.56, r * 0.56, r * 0.5); cor.position.z = r * 0.62; cor.renderOrder = 2; piv.add(cor);
  return piv;
}

// hair: every column is a strand with its own shade and its own length, so the ends come out uneven like cut hair
let HAIR_TEX = null;
export function hairTexture(){
  if (HAIR_TEX) return HAIR_TEX;
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), im = g.createImageData(W, H), d = im.data;
  let s = 91; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const fine = new Float32Array(W), clump = new Float32Array(W), len = new Float32Array(W);
  for (let x = 0; x < W; x++) fine[x] = rnd();
  for (let x = 0; x < W; x++){ let a = 0; for (let k = -6; k <= 6; k++) a += fine[(x + k + W) % W]; clump[x] = a / 13; }
  let L = 0.9; for (let x = 0; x < W; x++){ if (x % 7 === 0) L = 0.86 + rnd() * 0.14; len[x] = Math.min(1, L + (rnd() - 0.5) * 0.08); }
  for (let y = 0; y < H; y++){ const v = 1 - y / (H - 1);
    for (let x = 0; x < W; x++){ const b = 0.66 + 0.2 * (fine[x] - 0.5) + 1.0 * (clump[x] - 0.5) + 0.1 * v, a = v < len[x] - 0.05 ? 1 : Math.max(0, (len[x] - v) / 0.05), o = (y * W + x) * 4, c = Math.max(0, Math.min(1, b)) * 255;
      d[o] = d[o + 1] = d[o + 2] = c; d[o + 3] = a * 255; } }
  g.putImageData(im, 0, 0);
  HAIR_TEX = new THREE.CanvasTexture(cv); HAIR_TEX.colorSpace = THREE.SRGBColorSpace; HAIR_TEX.wrapS = THREE.RepeatWrapping; HAIR_TEX.anisotropy = 4; return HAIR_TEX;
}

// lashes: fine dark strokes that fade toward the tip, drawn once
let LASH_TEX = null;
export function lashTexture(){
  if (LASH_TEX) return LASH_TEX;
  const W = 256, H = 64, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.clearRect(0, 0, W, H);
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.lineCap = 'round';
  for (let i = 0; i < 120; i++){ const x = (i + rnd()) / 120 * W, len = H * (0.45 + rnd() * 0.5), lean = (x / W - 0.5) * 26 + (rnd() - 0.5) * 6;
    const gr = g.createLinearGradient(0, H, 0, H - len); gr.addColorStop(0, 'rgba(20,14,10,1)'); gr.addColorStop(0.6, 'rgba(20,14,10,.8)'); gr.addColorStop(1, 'rgba(20,14,10,0)');
    g.strokeStyle = gr; g.lineWidth = 1.2 + rnd() * 1.4; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.3, H - len * 0.6, x + lean, H - len); g.stroke(); }
  g.fillStyle = 'rgba(20,14,10,.95)'; g.fillRect(0, H - 5, W, 5);
  LASH_TEX = new THREE.CanvasTexture(cv); LASH_TEX.colorSpace = THREE.SRGBColorSpace; return LASH_TEX;
}

/** One person. mats: {head, body, mouth, socket, lash, lashLow, teeth, tongue}. Returns the bones by name, the two skinned meshes and the face handles. */
export function buildPerson(DB, id, mats, o = {}){
  const C = DB.info.chars[id]; if (!C) throw new Error('no person ' + id);
  const names = DB.info.bones, parents = DB.info.parents, J = DB.arr(id + '.joints'), FA = DB.arr(id + '.fax');
  const root = new THREE.Group(), bones = [], B = {};
  names.forEach((n, i) => { const b = new THREE.Bone(); b.name = n; const p = parents[i];
    if (p < 0){ b.position.set(J[i * 3], J[i * 3 + 1], J[i * 3 + 2]); root.add(b); }
    else { b.position.set(J[i * 3] - J[p * 3], J[i * 3 + 1] - J[p * 3 + 1], J[i * 3 + 2] - J[p * 3 + 2]); bones[p].add(b); }
    if (FA && (FA[i * 3] || FA[i * 3 + 1] || FA[i * 3 + 2])) b.userData.ax = new THREE.Vector3(FA[i * 3], FA[i * 3 + 1], FA[i * 3 + 2]);
    bones.push(b); B[n] = b; });
  const joint = n => { const i = names.indexOf(n); return new THREE.Vector3(J[i * 3], J[i * 3 + 1], J[i * 3 + 2]); };
  root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(bones);
  const hg = geometryFor(DB, id, 'head'), bg = geometryFor(DB, id, 'body'), fresh = !hg.groups.length;
  const G = DB.shared.head.groups, order = DB.info.meshes.head.order;
  const hm = {skin: mats.head, mouth: mats.mouth, socket: mats.socket, lashU: mats.lash, lashL: mats.lashLow || mats.lash, teeth: mats.teeth, tongue: mats.tongue};
  if (fresh){ order.forEach((k, i) => hg.addGroup(G[k][0], G[k][1], i)); hg.morphAttributes.position = morphsFor(DB, C.race); hg.morphTargetsRelative = true; }
  const head = new THREE.SkinnedMesh(hg, order.map(k => hm[k] || mats.head)), body = new THREE.SkinnedMesh(bg, mats.body);
  [head, body].forEach(m => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; root.add(m); m.bind(skel); });
  // clothes: the body's own surface pushed off the skin and cut by the alpha in the wear texture; shoes ride in the same layer
  const Wd = DB.info.wear[id] || {}, extra = {};
  if (mats.wear && DB.cache['wear:' + id]) extra.wear = new THREE.SkinnedMesh(DB.cache['wear:' + id], mats.wear);
  else if (mats.wear && DB.arr(id + '.wear.idx')){
    const S = DB.shared.body, pos = new Float32Array(bg.attributes.position.array), vi = DB.arr(id + '.wear.vi'), wp = DB.arr(id + '.wear.pos'), q = DB.meta(id + '.wear.pos').q;
    for (let k = 0; k < vi.length; k++){ const v = vi[k] * 3; pos[v] = wp[k * 3] * q; pos[v + 1] = wp[k * 3 + 1] * q; pos[v + 2] = wp[k * 3 + 2] * q; }
    const idx = DB.arr(id + '.wear.idx'), wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); wg.setAttribute('normal', new THREE.BufferAttribute(smoothNormals(pos, idx, S.orig), 3));
    wg.setAttribute('uv', S.uv); wg.setAttribute('skinIndex', S.si); wg.setAttribute('skinWeight', S.sw); wg.setIndex(new THREE.BufferAttribute(idx, 1));
    DB.cache['wear:' + id] = wg; extra.wear = new THREE.SkinnedMesh(wg, mats.wear);
  }
  const loose = (key, mat) => { const pp = DB.arr(id + '.' + key + '.pos'); if (!pp || !mat) return null; const ck = 'loose:' + id + ':' + key; if (DB.cache[ck]) return new THREE.SkinnedMesh(DB.cache[ck], mat); const g = DB.cache[ck] = new THREE.BufferGeometry();
    const sw8 = DB.arr(id + '.' + key + '.sw'), sw = new Float32Array(sw8.length); for (let i = 0; i < sw8.length; i++) sw[i] = sw8[i] / 255;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pp), 3)); g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(DB.arr(id + '.' + key + '.si')), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const uu = DB.arr(id + '.' + key + '.uv'); if (uu) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uu), 2));
    const cc = DB.arr(id + '.' + key + '.col'); if (cc){ const col = new Float32Array(cc.length); for (let i = 0; i < cc.length; i++) col[i] = Math.pow(cc[i] / 255, 2.2); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    g.setIndex(new THREE.BufferAttribute(DB.arr(id + '.' + key + '.idx'), 1)); g.computeVertexNormals(); return new THREE.SkinnedMesh(g, mat); };
  extra.flip = loose('flip', mats.flip); extra.skirt = loose('skirt', mats.skirt); extra.shoe = loose('shoe', mats.shoe); extra.hair = loose('hair', mats.hair); extra.hat = loose('hat', mats.hat); extra.tie = loose('tie', mats.hat); extra.lod = loose('lod', mats.lod); if (extra.lod) extra.lod.visible = false;
  for (const k in extra){ const m = extra[k]; if (m){ m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; root.add(m); m.bind(skel); } }
  if (Wd.lift) B.hips.position.y += Wd.lift;
  const morph = {}; DB.info.morphs.forEach((n, i) => { morph[n] = i; }); head.morphTargetInfluences = new Array(DB.info.morphs.length).fill(0); head.morphTargetDictionary = morph;
  const hj = joint('head'), eyeL = makeEye(C.eyes.L.c, C.eyes.L.r, o.eyes, B.head, hj), eyeR = makeEye(C.eyes.R.c, C.eyes.R.r, o.eyes, B.head, hj);
  const q = new THREE.Quaternion();
  const P = {root, bones, B, skel, head, body, wear: extra.wear, flip: extra.flip, skirt: extra.skirt, shoe: extra.shoe, hair: extra.hair, hat: extra.hat, tie: extra.tie, lod: extra.lod, wearInfo: Wd, hairInfo: DB.info.hair[id] || {}, morph, mscale: C.mscale, eyeL, eyeR, eyes: C.eyes, hands: C.hands, joint, info: C,
    // set a face shape by name, 0..1
    shape(name, v){ const i = morph[name]; if (i !== undefined) head.morphTargetInfluences[i] = v * C.mscale; },
    // curl one finger (1 thumb .. 5 pinky) on one side: a is the bend at each of its three joints, in radians
    finger(side, f, a, b = a, c = b){ [a, b, c].forEach((v, j) => { const bn = B['f' + f + (j + 1) + side]; if (bn && bn.userData.ax) bn.quaternion.setFromAxisAngle(bn.userData.ax, v); }); },
    // a whole hand: 0 open and flat, 0.35 hanging relaxed, 1 a fist
    grip(side, k, thumb = k){ const t = Math.max(0, k); for (let f = 2; f <= 5; f++){ const e = 1 + (f - 2) * 0.09; P.finger(side, f, t * 1.25 * e, t * 1.45 * e, t * 0.95 * e); } P.finger(side, 1, thumb * 0.45, thumb * 0.5, thumb * 0.7); }};
  // the wrist: flex bends the hand toward the palm, dev tips it toward the thumb or the little finger; both about the hand's own axes
  const wq = new THREE.Quaternion(), wax = {};
  ['L', 'R'].forEach(sd => { const h = C.hands[sd], d = new THREE.Vector3(...h.d), n = new THREE.Vector3(...h.n); wax[sd] = {flex: d.clone().cross(n).normalize(), dev: n.clone().normalize()}; });
  P.wrist = (side, flex, dev = 0, k = 1) => { const b = B['hand' + side]; q.setFromAxisAngle(wax[side].flex, flex); wq.setFromAxisAngle(wax[side].dev, dev); q.multiply(wq); if (k >= 1) b.quaternion.copy(q); else b.quaternion.slerp(q, k); };
  // far away, the light copy stands in for the body, the head, the clothes and the eyes
  let lodOn = false;
  P.far = on => { if (on === lodOn || !extra.lod) return; lodOn = on; extra.lod.visible = on; body.visible = head.visible = !on; if (extra.wear) extra.wear.visible = !on; eyeL.visible = eyeR.visible = !on; };
  P.grip('L', 0.3); P.grip('R', 0.3);
  return P;
}

// ---------- materials and the things people wear on top ----------
const texLoader = new THREE.TextureLoader(), texWait = {};
function loadTex(url){ return texWait[url] || (texWait[url] = new Promise(res => texLoader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, () => res(null)))); }

/** Materials for one person. f: {skin: color => material, hair: color => material}. The painted skins and clothes arrive a moment later;
 *  mats.ready resolves when they are all in, and the person should stay hidden until then. A look can ask for another skin tone: the paint is tinted. */
export function personMaterials(DB, id, o, f, base = 'pool/people/', ver = ''){
  const C = DB.info.chars[id], Wd = DB.info.wear[id] || {}, tone = o.skin || C.skin;
  const head = f.skin(tone), body = f.skin(tone), tint = new THREE.Color(tone), b0 = new THREE.Color(C.skin); tint.setRGB(tint.r / b0.r, tint.g / b0.g, tint.b / b0.b);
  const wear = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.8, alphaTest: 0.5, side: THREE.DoubleSide});
  const put = (m, file, col) => loadTex(base + id + '_' + file + '.webp' + ver).then(t => { if (t){ m.map = t; if (col) m.color.copy(col); m.needsUpdate = true; } return !!t; });
  const ready = Promise.all([put(head, 'head', tint), put(body, 'body', tint), put(wear, 'wear')]);
  const hair = f.hair(o.hair || '#4a2e1a'); hair.map = hairTexture(); hair.alphaTest = 0.45; hair.side = THREE.DoubleSide;
  const lash = new THREE.MeshBasicMaterial({map: lashTexture(), transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, depthWrite: false}), lashLow = lash.clone(); lashLow.opacity = 0.3;
  const flat = (c, r = 0.6) => new THREE.MeshStandardMaterial({color: c, roughness: r});
  return {ready, head, body, wear, hair, lash, lashLow, mouth: flat('#5a1f24'), socket: flat('#3a1a16'), teeth: flat('#f4f1ea', 0.3), tongue: flat('#c9737a'),
    lod: new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.62, color: tint}), hat: new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.82, side: THREE.DoubleSide}), shoe: new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.6}),
    flip: flat(Wd.shoeColor || '#15171c', 0.8), skirt: new THREE.MeshStandardMaterial({color: Wd.skirt || '#efe4d2', roughness: 0.85, side: THREE.DoubleSide})};
}

const rod = (a, b, th, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(th, th, 1), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.z = a.distanceTo(b); m.lookAt(b); return m; };
/** Sunglasses, a whistle, a necklace, a watch, an apron: small things placed by where this person's eyes, ears, neck and wrists are. */
export function accessories(DB, id, p, o){
  const fr = (DB.info.hair[id] || {}).frame, L = DB.info.chars[id].L, hj = p.joint('head'), made = {};
  if (!fr || !L) return made;
  const shades = () => { const g = new THREE.Group(), r = fr.r, dark = new THREE.MeshPhysicalMaterial({color: '#0b0c0f', roughness: 0.1, metalness: 0.45, clearcoat: 1, side: THREE.DoubleSide}), lens = new THREE.CircleGeometry(1, 22);
    [-1, 1].forEach(k => { const m = new THREE.Mesh(lens, dark); m.scale.set(r * 1.5, r * 1.2, 1); m.position.set(k * fr.ex, 0, 0); m.rotation.y = k * 0.17; g.add(m);
      g.add(rod(new THREE.Vector3(k * (fr.ex + r * 1.42), r * 0.25, -r * 0.2), new THREE.Vector3(k * fr.earX * 0.97, fr.earTop - 0.004 - fr.ey, fr.earZ - (fr.ez + r + 0.011)), 0.0045, dark)); });
    g.add(rod(new THREE.Vector3(-fr.ex + r * 1.2, r * 0.3, 0.002), new THREE.Vector3(fr.ex - r * 1.2, r * 0.3, 0.002), 0.005, dark));
    g.traverse(m => { if (m.isMesh) m.castShadow = true; }); return g; };
  if (o.sunglasses){ const g = shades(); g.position.set(0, fr.ey - 0.003 - hj.y, fr.ez + fr.r + 0.011 - hj.z); p.B.head.add(g); made.shades = g; }
  if (o.shadesUp){ const g = shades(); g.position.set(0, fr.top - 0.012 - hj.y, fr.front - 0.045 - hj.z); g.rotation.x = -1.12; p.B.head.add(g); made.shadesUp = g; }
  const cj = p.joint('chest2'), at = (x, y, z) => new THREE.Vector3(x - cj.x, y - cj.y, z - cj.z), metal = (c, r = 0.3) => new THREE.MeshStandardMaterial({color: c, metalness: 0.85, roughness: r});
  if (o.whistle){ const cord = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.0022, 6, 28), new THREE.MeshStandardMaterial({color: '#1b1d24', roughness: 0.8})); cord.position.copy(at(0, L.yNeck - 0.05, L.zNeck + 0.035)); cord.rotation.x = 1.05; cord.scale.set(0.8, 1.12, 1); p.B.chest2.add(cord);
    const w = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.016, 4, 10), metal('#d9dee5')); w.position.copy(at(0, L.yNeck - 0.125, L.zFront + 0.012)); w.rotation.z = Math.PI / 2; p.B.chest2.add(w); made.whistle = w; }
  if (o.necklace){ const gold = metal('#d9b24a'); const n = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.0018, 6, 28), gold); n.position.copy(at(0, L.yNeck - 0.035, L.zNeck + 0.028)); n.rotation.x = 1.15; n.scale.set(0.82, 1.08, 1); p.B.chest2.add(n);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), gold); d.position.copy(at(0, L.yNeck - 0.095, L.zFront + 0.004)); p.B.chest2.add(d); made.necklace = n; }
  if (o.watch){ const tj = p.joint('twR'), hjn = p.joint('handR'), w = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.017, 18), metal('#d9b24a', 0.28)); w.position.copy(hjn).sub(tj).multiplyScalar(0.8); w.scale.set(1, 1, 0.8); p.B.twR.add(w); made.watch = w; }
  if (o.apron){ const sj = p.joint('spine'), y1 = L.yCh2 - 0.06, y0 = L.yHip - 0.16, zc = L.zHip + 0.01, R = L.zFront - zc + 0.028, white = new THREE.MeshStandardMaterial({color: '#f4f3ee', roughness: 0.9, side: THREE.DoubleSide});
    const a = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, y1 - y0, 14, 1, true, -0.62, 1.24), white); a.position.set(0, (y0 + y1) / 2 - sj.y, zc - sj.z); a.scale.x = 1.15; a.castShadow = true; p.B.spine.add(a);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 20, Math.PI), white); strap.position.copy(at(0, L.yNeck - 0.06, L.zNeck + 0.02)); strap.rotation.x = -0.35; p.B.chest2.add(strap); made.apron = a; }
  return made;
}
/** Where a held thing goes: the middle of the right palm. */
export function palm(p, side = 'R'){ const o = new THREE.Object3D(), h = p.hands[side]; o.position.set(h.d[0] * 0.075 + h.n[0] * 0.028, h.d[1] * 0.075 + h.n[1] * 0.028, h.d[2] * 0.075 + h.n[2] * 0.028); p.B['hand' + side].add(o); return o; }
