# Builds the park's people from the MakeHuman CC0 base: shape, rest pose (arms down, palms in), a small skeleton,
# skin weights, face morphs, landmarks, baked soft shading. Writes pool/people/people.bin; tex.py paints the skins,
# wear.py cuts the clothes and shoes, hair.py grows the hair.
import os
import sys, json, struct, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mh
from mh import nrm, rot_axis, rot_from_to

OUT = os.environ.get('PEOPLE_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'pool', 'people')) + os.sep
LOCAL_H = 1.70                      # everybody is this tall in local units; the park scales the group by the look's size

CAU = dict(caucasian=1.0, asian=0.0, african=0.0)
def both(name, w): return [(name.replace('*', 'l'), w), (name.replace('*', 'r'), w)]
CHARS = {
    'em':    dict(macro=dict(gender=0.0, age=0.205, weight=0.45, muscle=0.45, race=CAU),
                  details=both('eyes/*-eye-scale-incr', 0.1) + both('cheek/*-cheek-volume-incr', 0.3) + [('nose/nose-scale-horiz-decr', 0.3), ('nose/nose-scale-vert-decr', 0.2), ('chin/chin-jaw-drop-decr', 0.3)]),
    'mel':   dict(macro=dict(gender=0.0, age=0.172, weight=0.56, muscle=0.45, race=CAU),
                  details=both('eyes/*-eye-scale-incr', 0.12) + both('cheek/*-cheek-volume-incr', 0.4)),
    'yen':   dict(macro=dict(gender=0.0, age=0.56, weight=0.42, muscle=0.5, cupsize=0.38, firmness=0.7, race=dict(caucasian=0.5, asian=0.5, african=0.0)), details=[]),
    'gma':   dict(macro=dict(gender=0.0, age=0.86, weight=0.6, muscle=0.4, cupsize=0.22, firmness=0.9, race=CAU), details=[]),
    'guard': dict(macro=dict(gender=1.0, age=0.47, weight=0.48, muscle=0.66, race=CAU), details=[]),
    'guardf': dict(macro=dict(gender=0.0, age=0.46, weight=0.44, muscle=0.62, cupsize=0.36, firmness=0.75, race=CAU), details=[]),
    'nutty': dict(macro=dict(gender=1.0, age=0.56, weight=0.62, muscle=0.5, race=dict(caucasian=0.3, asian=0.2, african=0.5)), details=[]),
}

# ---------- the park skeleton ----------
def skeleton_spec():
    S = [('hips', None, 'spine05', ['root', 'pelvis.L', 'pelvis.R', 'spine05']),
         ('spine', 'hips', 'spine04', ['spine04']), ('spine2', 'spine', 'spine03', ['spine03']),
         ('chest', 'spine2', 'spine02', ['spine02', 'breast.L', 'breast.R']), ('chest2', 'chest', 'spine01', ['spine01']),
         ('neck', 'chest2', 'neck01', ['neck01']), ('neck2', 'neck', 'neck02', ['neck02', 'neck03']), ('head', 'neck2', 'head', [])]
    for m, s in (('L', 'R'), ('R', 'L')):       # MakeHuman's .L is the +x side, which the park rig calls R
        S += [('clav' + s, 'chest2', 'clavicle.' + m, ['clavicle.' + m, 'shoulder01.' + m]),
              ('arm' + s, 'clav' + s, 'upperarm01.' + m, ['upperarm01.' + m, 'upperarm02.' + m]),
              ('fore' + s, 'arm' + s, 'lowerarm01.' + m, ['lowerarm01.' + m]),
              ('tw' + s, 'fore' + s, 'lowerarm02.' + m, ['lowerarm02.' + m]),
              ('hand' + s, 'tw' + s, 'wrist.' + m, ['wrist.' + m] + ['metacarpal%d.%s' % (i, m) for i in range(1, 5)])]
        for f in range(1, 6):
            for j in range(1, 4):
                S.append(('f%d%d%s' % (f, j, s), ('f%d%d%s' % (f, j - 1, s)) if j > 1 else 'hand' + s, 'finger%d-%d.%s' % (f, j, m), ['finger%d-%d.%s' % (f, j, m)]))
        S += [('leg' + s, 'hips', 'upperleg01.' + m, ['upperleg01.' + m, 'upperleg02.' + m]),
              ('shin' + s, 'leg' + s, 'lowerleg01.' + m, ['lowerleg01.' + m, 'lowerleg02.' + m]),
              ('foot' + s, 'shin' + s, 'foot.' + m, ['foot.' + m]),
              ('toe' + s, 'foot' + s, 'BALL.' + m, [b for b in mh.rig()[1] if b.startswith('toe') and b.endswith('.' + m)])]
    used = {b for _, _, _, bs in S for b in bs}
    S[7] = ('head', 'neck2', 'head', [b for b in mh.rig()[1] if b not in used])
    return S

SPEC = skeleton_spec()
BONES = [s[0] for s in SPEC]
BI = {b: i for i, b in enumerate(BONES)}
_BW = None
def bone_weights():
    """163 MakeHuman bones folded into the park skeleton, top four per vertex, as bytes."""
    global _BW
    if _BW is None:
        W = mh.weights(); order = mh.rig()[1]; M = np.zeros((mh.NV, len(SPEC)), np.float32)
        for i, (_, _, _, bs) in enumerate(SPEC):
            for b in bs: M[:, i] += W[:, order.index(b)]
        idx = np.argsort(-M, axis=1)[:, :4]; w = np.take_along_axis(M, idx, 1); w /= w.sum(1, keepdims=True)
        q = np.floor(w * 255 + 0.5).astype(int); q[:, 0] += 255 - q.sum(1)
        _BW = (idx.astype(np.uint8), q.astype(np.uint8), M)
    return _BW

def palm_frame(H, T, s):
    """Palm normal (out of the palm), hand direction and knuckle line for one MakeHuman side, from joint positions."""
    W_, I_, K_, M_ = H['wrist.' + s], H['finger2-1.' + s], H['finger5-1.' + s], H['finger3-1.' + s]
    n = nrm(np.cross(I_ - W_, K_ - W_)); tip = T['finger3-3.' + s]
    if (tip - M_) @ n < 0: n = -n
    return n, nrm(M_ - W_), nrm(K_ - I_)

def bake(V):
    """Rest pose for the park: arms hanging straight with the palms toward the thighs, legs straight under the hips, feet flat."""
    H, T = mh.joints(V); Dm = {}; down = np.array([0, -1.0, 0])
    for s in 'LR':
        sh, el, wr = H['upperarm01.' + s], H['lowerarm01.' + s], H['wrist.' + s]
        u, f = nrm(el - sh), nrm(wr - el)
        Dm['upperarm01.' + s] = rot_from_to(u, down)
        Dm['lowerarm01.' + s] = rot_from_to(f, u)
        hp, kn, an = H['upperleg01.' + s], H['lowerleg01.' + s], H['foot.' + s]
        th, sn = nrm(kn - hp), nrm(an - kn)
        Dm['upperleg01.' + s] = rot_from_to(th, down)
        Dm['lowerleg01.' + s] = rot_from_to(sn, th)
        Dm['foot.' + s] = (Dm['upperleg01.' + s] @ Dm['lowerleg01.' + s]).T
    # where does the palm face once the arm hangs? turn the forearm so it faces the thigh, a little to the back
    _, HN, TN, RW = mh.repose(V, Dm)
    for s in 'LR':
        n, d, kl = palm_frame(HN, TN, s); sx = 1 if s == 'L' else -1
        want = np.array([-sx * np.cos(np.radians(22)), 0, -np.sin(np.radians(22))])
        a0 = np.arctan2(n[0], n[2]); a1 = np.arctan2(want[0], want[2]); th = (a1 - a0 + np.pi) % (2 * np.pi) - np.pi     # turn about +y
        f = nrm(H['wrist.' + s] - H['lowerarm01.' + s])            # the forearm in the source pose; it ends up pointing down, so +y there is -f here
        Dm['lowerarm02.' + s] = rot_axis(-f, th * 0.5); Dm['wrist.' + s] = rot_axis(-f, th * 0.5)
    return Dm

class Pack:
    def __init__(self): self.blobs = []; self.meta = {}; self.off = 0
    def add(self, name, arr, c=1, **kw):
        a = np.ascontiguousarray(arr); b = a.tobytes(); pad = (-len(b)) % 4
        self.meta[name] = dict(t=str(a.dtype), o=self.off, n=int(a.size), c=c, **kw); self.blobs.append(b + b'\0' * pad); self.off += len(b) + pad
    def write(self, path, extra):
        h = json.dumps(dict(arrays=self.meta, **extra), separators=(',', ':')).encode(); h += b' ' * ((-len(h)) % 4)
        with open(path, 'wb') as f:
            f.write(struct.pack('<I', len(h))); f.write(h)
            for b in self.blobs: f.write(b)
        return 4 + len(h) + self.off

# ---------- face morphs ----------
MORPHS = [
    ('blinkR', ['eye-left-closure']), ('blinkL', ['eye-right-closure']), ('squint', ['eye-left-slit', 'eye-right-slit']), ('wide', ['eye-left-opened-up', 'eye-right-opened-up']),
    ('browUp', ['eyebrows-left-up', 'eyebrows-right-up']), ('browDown', ['eyebrows-left-down', 'eyebrows-right-down']), ('browIn', ['eyebrows-left-inner-up', 'eyebrows-right-inner-up']),
    ('smile', ['mouth-corner-puller']), ('open', ['mouth-open']), ('purse', ['mouth-pursing']), ('wideM', ['mouth-retraction']), ('lift', ['mouth-elevation']),
]
def morph(units, race):
    d = np.zeros((mh.NV, 3))
    for u in units:
        for r, w in race.items():
            if w > 1e-4: d += w * mh.dense('expression/units/%s/%s' % (r, u))
    return d

# ---------- topology: the head mesh and the body mesh ----------
def classify_islands():
    V0, VT, F, G = mh.base(); par = list(range(len(VT)))
    def find(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for (vi, ti), g in zip(F, G):
        if g == 'body':
            r = find(ti[0])
            for t in ti[1:]: par[find(t)] = r
    comp = {}
    for fi, ((vi, ti), g) in enumerate(zip(F, G)):
        if g == 'body': comp.setdefault(find(ti[0]), []).append(fi)
    lab = {}
    for root, fs in comp.items():
        m = V0[[v for f in fs for v in F[f][0]]].mean(0); n = len(fs)
        if m[1] > 6.3 and n > 2000: l = 'head'
        elif m[1] > 6.0 and n < 500 and abs(m[0]) < 0.1: l = 'mouth'
        elif m[1] > 6.8 and n < 500: l = 'socket'
        elif m[1] < -7: l = 'foot'
        elif abs(m[0]) > 3.5 and n < 2000: l = 'hand'
        else: l = 'torso'
        for f in fs: lab[f] = l
    return lab

HEAD_ORDER = ['skin', 'mouth', 'socket', 'lashU', 'lashL', 'teeth', 'tongue']
BODY_ORDER = ['skin', 'hands', 'feet']
_TOPO = None
def topology():
    """Render vertices (split at UV seams) and triangles for the head mesh and the body mesh.
    The head keeps its own texture: its UVs are stretched to fill it."""
    global _TOPO
    if _TOPO is not None: return _TOPO
    V0, VT, F, G = mh.base(); lab = classify_islands(); gr = mh.groups()
    huv = VT[[t for fi, l in lab.items() if l == 'head' for t in F[fi][1]]]; pad = 0.004
    box = (huv[:, 0].min() - pad, huv[:, 0].max() + pad, huv[:, 1].min() - pad, huv[:, 1].max() + pad)
    lashuv = {}
    for m in 'lr':
        c = V0[gr['helper-%s-eye' % m]].mean(0)
        for part in (1, 2):
            idx = gr['helper-%s-eyelashes-%d' % (m, part)]; p = V0[idx] - c; d = np.linalg.norm(p, axis=1)
            v = (d - d.min()) / (d.max() - d.min()); u = (p[:, 0] - p[:, 0].min()) / (p[:, 0].max() - p[:, 0].min())
            for i, a, b in zip(idx, u, v): lashuv[int(i)] = (float(a), float(b))
    meshes = {'head': dict(key={}, orig=[], uv=[], groups={k: [] for k in HEAD_ORDER}), 'body': dict(key={}, orig=[], uv=[], groups={k: [] for k in BODY_ORDER})}
    def vert(m, vi, key, uv):
        k = (vi, key)
        if k not in m['key']: m['key'][k] = len(m['orig']); m['orig'].append(vi); m['uv'].append(uv)
        return m['key'][k]
    for fi, ((vi, ti), g) in enumerate(zip(F, G)):
        if g == 'body':
            l = lab[fi]
            if l == 'head': m, gname = meshes['head'], 'skin'; uvs = [((VT[t][0] - box[0]) / (box[1] - box[0]), (VT[t][1] - box[2]) / (box[3] - box[2])) for t in ti]
            elif l in ('mouth', 'socket'): m, gname = meshes['head'], l; uvs = [tuple(VT[t]) for t in ti]
            else: m, gname = meshes['body'], {'torso': 'skin', 'hand': 'hands', 'foot': 'feet'}[l]; uvs = [tuple(VT[t]) for t in ti]
            ids = [vert(m, a, (b, gname == 'skin'), u) for a, b, u in zip(vi, ti, uvs)]
        elif 'eyelash' in g: m, gname = meshes['head'], ('lashL' if g.endswith('-1') else 'lashU'); ids = [vert(m, a, 'lash', lashuv[a]) for a in vi]
        elif 'teeth' in g: m, gname = meshes['head'], 'teeth'; ids = [vert(m, a, b, tuple(VT[b])) for a, b in zip(vi, ti)]
        elif g == 'helper-tongue': m, gname = meshes['head'], 'tongue'; ids = [vert(m, a, b, tuple(VT[b])) for a, b in zip(vi, ti)]
        else: continue
        tri = m['groups'][gname]
        for k in range(1, len(ids) - 1): tri += [ids[0], ids[k], ids[k + 1]]
    for name, m in meshes.items():
        m['orig'] = np.array(m['orig']); m['uv'] = np.array(m['uv'], float); order = HEAD_ORDER if name == 'head' else BODY_ORDER
        m['ranges'] = {}; idx = []
        for g in order: m['ranges'][g] = [len(idx), len(m['groups'][g])]; idx += m['groups'][g]
        m['idx'] = np.array(idx, int).reshape(-1, 3)
    meshes['headbox'] = box
    # triangles of real skin (no lashes, teeth, tongue), in original vertex numbers: for normals and baked shading
    sk = []
    for name in ('head', 'body'):
        m = meshes[name]
        for g in (['skin', 'mouth', 'socket'] if name == 'head' else BODY_ORDER):
            a, n = m['ranges'][g]; sk.append(m['orig'][m['idx'].reshape(-1)[a:a + n].reshape(-1, 3)])
    meshes['skin_tris'] = np.concatenate(sk)
    meshes['all_tris'] = np.concatenate([meshes[n]['orig'][meshes[n]['idx']] for n in ('head', 'body')])
    _TOPO = meshes
    return meshes

_ADJ = None
def adjacency():
    """Row-normalized neighbor matrix over original vertices, from the skin triangles."""
    global _ADJ
    if _ADJ is None:
        import scipy.sparse as sp
        t = topology()['skin_tris']; i = np.concatenate([t[:, 0], t[:, 1], t[:, 2], t[:, 1], t[:, 2], t[:, 0]]); j = np.concatenate([t[:, 1], t[:, 2], t[:, 0], t[:, 0], t[:, 1], t[:, 2]])
        A = sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(mh.NV, mh.NV)).tocsr(); A.data[:] = 1; d = np.asarray(A.sum(1)).ravel(); d[d == 0] = 1
        _ADJ = sp.diags(1 / d) @ A
    return _ADJ

def soften_bust(P):
    """Grown women: round the bust off into one soft, modest shape, the way a swimsuit or a bra holds it, before anything is dressed over it."""
    r = mh.rig()[0]; A = adjacency(); P = P.copy(); w = np.zeros(mh.NV)
    for b in ('breast.L', 'breast.R'):
        v = r[b]['tail']['vertex_index']; d = np.linalg.norm(P[:mh.NBODY] - P[v], axis=1); t = np.clip((0.085 - d) / 0.05, 0, 1); w[:mh.NBODY] = np.maximum(w[:mh.NBODY], t * t * (3 - 2 * t))
    sel = w > 0
    for it in range(70):
        avg = A @ P; P[sel] = P[sel] * (1 - 0.6 * w[sel, None]) + avg[sel] * (0.6 * w[sel, None])
    return P

def smooth_chest(P, R=0.017):
    """This is a family pool: the chest is a plain smooth surface on everybody. The small raised detail at the tip of each
    breast is replaced by the smooth surface its surroundings describe (a quadratic fitted to the ring around it)."""
    r = mh.rig()[0]; P = P.copy(); N = vertex_normals(P, topology()['skin_tris'])
    for b in ('breast.L', 'breast.R'):
        v = r[b]['tail']['vertex_index']; c0 = P[v].copy(); d = P[:mh.NBODY] - c0; dist = np.linalg.norm(d, axis=1)
        near = np.nonzero(dist < 3.2 * R)[0]; n0 = N[near[dist[near] > R]].mean(0); n0 /= np.linalg.norm(n0)
        t1 = np.cross(n0, [0, 1.0, 0]); t1 /= np.linalg.norm(t1); t2 = np.cross(n0, t1)
        a_, b_, h_ = d[near] @ t1, d[near] @ t2, d[near] @ n0; rr = np.hypot(a_, b_)
        ring = (rr > 1.15 * R) & (rr < 2.6 * R) & (np.abs(h_) < 2.5 * R)
        Q = lambda a, b: np.c_[np.ones(len(a)), a, b, a * a, a * b, b * b]
        co = np.linalg.lstsq(Q(a_[ring], b_[ring]), h_[ring], rcond=None)[0]
        w = np.clip((1.35 * R - rr) / (0.45 * R), 0, 1); w = w * w * (3 - 2 * w); w *= (np.abs(h_) < 2.5 * R)
        P[near] += n0 * ((Q(a_, b_) @ co - h_) * w)[:, None]
    return P

def vertex_normals(V, tris):
    a, b, c = V[tris[:, 0]], V[tris[:, 1]], V[tris[:, 2]]; fn = np.cross(b - a, c - a)
    N = np.zeros_like(V)
    for k in range(3): np.add.at(N, tris[:, k], fn)
    l = np.linalg.norm(N, axis=1, keepdims=True); l[l == 0] = 1
    return N / l

def ambient(P, N, tris, dist=0.09, rays=48, seed=3):
    """How open each vertex is to the sky around it: 1 in the open, lower in creases. Short rays only, so it holds in any pose."""
    import trimesh
    from trimesh.ray.ray_pyembree import RayMeshIntersector
    used = np.unique(tris); inter = RayMeshIntersector(trimesh.Trimesh(P, tris, process=False))
    rng = np.random.default_rng(seed); n = N[used]
    t = np.cross(n, [0, 1.0, 0]); bad = np.linalg.norm(t, axis=1) < 1e-3; t[bad] = np.cross(n[bad], [1.0, 0, 0]); t /= np.linalg.norm(t, axis=1, keepdims=True); b = np.cross(n, t)
    u1, u2 = rng.random((1, rays)), rng.random((1, rays)); r = np.sqrt(u1); ph = 2 * np.pi * u2
    dx, dy, dz = r * np.cos(ph), r * np.sin(ph), np.sqrt(1 - u1)
    dirs = (t[:, None, :] * dx[..., None] + b[:, None, :] * dy[..., None] + n[:, None, :] * dz[..., None]).reshape(-1, 3)
    org = np.repeat(P[used] + n * 0.0012, rays, axis=0)
    loc, ray, _ = inter.intersects_location(org, dirs, multiple_hits=False)
    occ = np.zeros(len(org)); occ[ray] = np.clip(1 - np.linalg.norm(loc - org[ray], axis=1) / dist, 0, 1)
    ao = np.ones(len(P)); ao[used] = 1 - occ.reshape(len(used), rays).mean(1)
    return ao

def build_char(cid, cfg):
    topo = topology(); gr = mh.groups()
    V, miss = mh.human(cfg['macro'], cfg.get('details', []))
    if miss: print('  missing targets:', miss)
    race = cfg['macro'].get('race', mh.DEFAULT['race'])
    V2, HN, TN, RW = mh.repose(V, bake(V))
    body = V2[:mh.NBODY]; ymin = body[:, 1].min(); h = body[:, 1].max() - ymin
    hipz = (HN['upperleg01.L'][2] + HN['upperleg01.R'][2]) / 2
    k = LOCAL_H / h; org = np.array([0, ymin, hipz])
    tf = lambda p: (np.asarray(p) - org) * k
    grown_f = cfg['macro'].get('gender', 0.5) < 0.5 and cfg['macro'].get('age', 0.5) > 0.3
    P = tf(V2)
    if grown_f: P = soften_bust(P)
    P = smooth_chest(P, 0.027 if grown_f else 0.017); J = {}
    for name, parent, src, bs in SPEC:
        if src.startswith('BALL.'): s = src[-1]; J[name] = tf(np.mean([HN['toe%d-1.%s' % (i, s)] for i in range(1, 6)], 0))
        else: J[name] = tf(HN[src])
    eyes = {}
    for m, s in (('l', 'R'), ('r', 'L')):
        e = P[gr['helper-%s-eye' % m]]; A = np.c_[2 * e, np.ones(len(e))]; sol = np.linalg.lstsq(A, (e ** 2).sum(1), rcond=None)[0]; c = sol[:3]; rr = float(np.sqrt(sol[3] + c @ c))
        eyes[s] = dict(c=c.tolist(), r=rr, mean=float(np.linalg.norm(e - e.mean(0), axis=1).mean()), front=float(e[:, 2].max() - c[2]))
    # hands: the axis each finger bone curls about, the palm normal, the direction of the hand
    fax = np.zeros((len(BONES), 3), np.float32); hands = {}
    for m, s in (('L', 'R'), ('R', 'L')):
        n, d, kl = palm_frame(HN, TN, m); hands[s] = dict(n=n.tolist(), d=d.tolist(), k=kl.tolist())
        for f in range(1, 6):
            for j in range(1, 4):
                b = 'finger%d-%d.%s' % (f, j, m); dd = nrm(TN[b] - HN[b])
                ax = nrm(np.cross(dd, n)) if f > 1 else nrm(np.cross(dd, nrm(kl * 0.75 + n * 0.5)))
                fax[BI['f%d%d%s' % (f, j, s)]] = ax
    base_head = mh.base()[0]; hb = mh.joints(base_head)[0]
    head_h0 = base_head[:mh.NBODY, 1].max() - hb['head'][1]; head_h = body[:, 1].max() - HN['head'][1]
    N = vertex_normals(P, topo['all_tris'])
    # soft shading is measured in the open pose the body was sculpted in, arms and legs apart, so a hand hanging by a thigh leaves no dark print on it
    Pu = tf(V); ao = ambient(Pu, vertex_normals(Pu, topo['skin_tris']), topo['skin_tris'])
    return dict(id=cid, cfg=cfg, P=P, N=N, J=J, eyes=eyes, hands=hands, fax=fax, ao=ao, mscale=float(head_h / head_h0 * k), k=float(k), height_m=float(h * 0.1), race=race, tf=tf, HN=HN, TN=TN)

def main(only=None):
    import os; os.makedirs(OUT, exist_ok=True)
    topo = topology(); si, sw, M = bone_weights()
    pk = Pack(); info = dict(bones=BONES, parents=[BI[s[1]] if s[1] else -1 for s in SPEC], morphs=[m[0] for m in MORPHS], meshes={}, chars={}, wear={}, hair={})
    for mname in ('head', 'body'):
        m = topo[mname]; orig = m['orig']
        pk.add(mname + '.orig', orig.astype(np.uint16)); pk.add(mname + '.uv', np.floor(np.clip(m['uv'], 0, 1) * 65535 + 0.5).astype(np.uint16), 2)
        pk.add(mname + '.si', si[orig], 4); pk.add(mname + '.sw', sw[orig], 4); pk.add(mname + '.idx', m['idx'].reshape(-1).astype(np.uint16))
        info['meshes'][mname] = dict(nv=len(orig), groups=m['ranges'], order=HEAD_ORDER if mname == 'head' else BODY_ORDER)
        print(mname, 'verts', len(orig), 'tris', len(m['idx']), {g: v[1] // 3 for g, v in m['ranges'].items()})
    horig = topo['head']['orig']
    races = sorted({r for cid, cfg in CHARS.items() if not only or cid in only for r, w in cfg['macro'].get('race', mh.DEFAULT['race']).items() if w > 1e-3})
    for r in races:
        for name, units in MORPHS:
            d = morph(units, {r: 1.0})[horig]; nz = np.nonzero(np.abs(d).max(1) > 2e-4)[0]
            pk.add('morph.%s.%s.i' % (r, name), nz.astype(np.uint16)); pk.add('morph.%s.%s.d' % (r, name), np.round(d[nz] * 2000).astype(np.int16), 3, q=1 / 2000)
    chars = {}
    for cid, cfg in CHARS.items():
        if only and cid not in only: continue
        c = build_char(cid, cfg); chars[cid] = c
        for mname in ('head', 'body'):
            o = topo[mname]['orig']
            pk.add('%s.%s.pos' % (cid, mname), np.round(c['P'][o] * 16000).astype(np.int16), 3, q=1 / 16000)
            pk.add('%s.%s.nrm' % (cid, mname), np.round(c['N'][o] * 127).astype(np.int8), 3, q=1 / 127)
        pk.add(cid + '.joints', np.array([c['J'][b] for b in BONES], np.float32), 3)
        pk.add(cid + '.fax', c['fax'], 3)
        info['chars'][cid] = dict(eyes=c['eyes'], hands=c['hands'], mscale=c['mscale'], k=c['k'], race=c['race'])
        print(cid, 'natural height %.2f m' % c['height_m'], 'ao min %.2f mean %.2f' % (c['ao'].min(), c['ao'][:mh.NBODY].mean()))
    return topo, pk, info, chars

def finish(pk, info):
    n = pk.write(OUT + 'people.bin', info); print('people.bin', n // 1024, 'KB')

if __name__ == '__main__':
    topo, pk, info, chars = main(); finish(pk, info)
