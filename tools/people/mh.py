# Reads the MakeHuman (MPFB2) CC0 base mesh, shape targets, rig and weights, and turns a set of
# sliders into a posed, weighted human mesh. Units in the source are decimeters; everything here stays
# in decimeters until the exporter scales it.
import numpy as np, gzip, json, os, functools

D = os.environ.get('MPFB_DATA', os.path.expanduser('~/mpfb2/src/mpfb/data'))      # a checkout of github.com/makehumancommunity/mpfb2
NV = 19158
NBODY = 13380

# ---------- base mesh ----------
@functools.lru_cache(None)
def base():
    V, VT, F, G = [], [], [], []
    g = None
    for line in open(D + '/3dobjs/base.obj'):
        if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '): g = line.split()[1]
        elif line.startswith('f '):
            ps = [p.split('/') for p in line.split()[1:]]
            F.append(([int(p[0]) - 1 for p in ps], [int(p[1]) - 1 for p in ps])); G.append(g)
    return np.array(V), np.array(VT), F, G

@functools.lru_cache(None)
def groups():
    vg = json.load(open(D + '/mesh_metadata/basemesh_vertex_groups.json'))
    return {k: np.array([i for a, b in v for i in range(a, b + 1)]) for k, v in vg.items()}

# ---------- targets ----------
@functools.lru_cache(None)
def target(name):
    p = f'{D}/targets/{name}.target.gz'
    if not os.path.exists(p): return None
    idx, d = [], []
    for line in gzip.open(p, 'rt'):
        if not line.strip() or line[0] == '#': continue
        a = line.split(); idx.append(int(a[0])); d.append([float(a[1]), float(a[2]), float(a[3])])
    return np.array(idx, int), np.array(d, float).reshape(-1, 3)

def dense(name):
    out = np.zeros((NV, 3)); t = target(name)
    if t is not None and len(t[0]): out[t[0]] = t[1]
    return out

_MACRO = json.load(open(D + '/targets/macrodetails/macro.json'))['macrotargets']
def _comp(name, value):
    out = []
    for p in _MACRO[name]['parts']:
        lo, hi = p['lowest'], p['highest']
        if lo < value < hi:
            t = (value - lo) / (hi - lo)
            if p['low']: out.append((p['low'], 1 - t))
            if p['high']: out.append((p['high'], t))
    return out

def macro_stack(m, cutoff=0.01):
    c = {k: _comp(k, m[k]) for k in ['gender', 'age', 'muscle', 'weight', 'proportions', 'height', 'cupsize', 'firmness']}
    out = []
    for race, rw in m['race'].items():
        if rw > 1e-4:
            for a, aw in c['age']:
                for g, gw in c['gender']:
                    if rw * gw * aw > cutoff: out.append((f'macrodetails/{race}-{g}-{a}', rw * gw * aw))
    for g, gw in c['gender']:
        for a, aw in c['age']:
            for mu, mw in c['muscle']:
                for we, ww in c['weight']:
                    w = gw * aw * mw * ww
                    if w > cutoff: out.append((f'macrodetails/universal-{g}-{a}-{mu}-{we}', w))
                    for h, hw in c['height']:
                        if w * hw > cutoff: out.append((f'macrodetails/height/{g}-{a}-{mu}-{we}-{h}', w * hw))
                    for pr, pw in c['proportions']:
                        if w * pw > cutoff and a != 'baby': out.append((f'macrodetails/proportions/{g}-{a}-{mu}-{we}-{pr}', w * pw))
                    if g == 'female' and a != 'baby':
                        for cu, cw in c['cupsize']:
                            for fi, fw in c['firmness']:
                                w2 = aw * mw * ww * cw * fw
                                if w2 > cutoff and not (cu == 'averagecup' and fi == 'averagefirmness'):
                                    out.append((f'breast/female-{a}-{mu}-{we}-{cu}-{fi}', w2))
    return out

DEFAULT = dict(gender=0.5, age=0.5, muscle=0.5, weight=0.5, proportions=0.5, height=0.5, cupsize=0.5, firmness=0.5,
               race=dict(caucasian=1 / 3, asian=1 / 3, african=1 / 3))

def human(macro, details=()):
    """macro: dict of sliders; details: [(target name, weight)]. Returns all 19158 vertices in dm."""
    m = dict(DEFAULT); m.update(macro)
    V = base()[0].copy(); missing = []
    for name, w in list(macro_stack(m)) + list(details):
        t = target(name)
        if t is None: missing.append(name); continue
        if len(t[0]): V[t[0]] += w * t[1]
    return V, missing

# ---------- rig ----------
@functools.lru_cache(None)
def rig():
    r = json.load(open(D + '/rigs/standard/rig.default.json'))
    order = []
    def walk(k):
        order.append(k)
        for c in sorted(r):
            if r[c].get('parent') == k: walk(c)
    for k in sorted(r):
        if not r[k].get('parent'): walk(k)
    return r, order

@functools.lru_cache(None)
def weights():
    w = json.load(open(D + '/rigs/standard/weights.default.json'))['weights']
    names = rig()[1]; W = np.zeros((NV, len(names)), np.float32)
    for k, v in w.items():
        if not v: continue
        a = np.array(v); W[a[:, 0].astype(int), names.index(k)] = a[:, 1]
    s = W.sum(1, keepdims=True); s[s == 0] = 1
    return W / s

def _pt(V, spec):
    s = spec['strategy']
    if s == 'CUBE': return V[groups()[spec['cube_name']]].mean(0)
    if s == 'VERTEX': return V[spec['vertex_index']].copy()
    if s == 'MEAN': return V[spec['vertex_indices']].mean(0)
    raise ValueError(s)

def joints(V):
    r, order = rig()
    return {k: _pt(V, r[k]['head']) for k in order}, {k: _pt(V, r[k]['tail']) for k in order}

def nrm(v): return v / (np.linalg.norm(v) + 1e-12)
def rot_axis(axis, ang):
    a = nrm(np.asarray(axis, float)); c, s = np.cos(ang), np.sin(ang); x, y, z = a
    return np.array([[c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s],
                     [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s],
                     [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)]])
def rot_from_to(a, b):
    a, b = nrm(a), nrm(b); ax = np.cross(a, b); s = np.linalg.norm(ax); c = float(a @ b)
    if s < 1e-9: return np.eye(3)
    return rot_axis(ax / s, np.arctan2(s, c))

def repose(V, D_):
    """Pose the 163 bone rig with world-axis delta rotations D_ {bone: 3x3} and skin every vertex.
    Returns the new vertices and the new joint heads/tails."""
    r, order = rig(); H, T = joints(V); W = weights()
    RW, HN = {}, {}
    for k in order:
        p = r[k].get('parent')
        Rp = RW[p] if p else np.eye(3)
        RW[k] = Rp @ D_.get(k, np.eye(3))
        HN[k] = HN[p] + Rp @ (H[k] - H[p]) if p else H[k].copy()
    out = np.zeros_like(V)
    for i, k in enumerate(order):
        w = W[:, i]; nz = np.nonzero(w)[0]
        if len(nz): out[nz] += w[nz, None] * ((V[nz] - H[k]) @ RW[k].T + HN[k])
    TN = {k: HN[k] + RW[k] @ (T[k] - H[k]) for k in order}
    return out, HN, TN, RW
