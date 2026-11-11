# Hair and hats, grown on each person's own head. The scalp gets a cap with real thickness; long hair is laid in sheets
# that follow the head, clear the shoulders and hang; bangs, bunches and curls are variations. Hats sit on the same head.
import os
import sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mh, build, tex
from tex import sstep, hexc

BI = build.BI
def dirv(phi): return np.stack([np.sin(phi), np.zeros_like(phi), -np.cos(phi)], -1)     # 0 = straight back, +90 deg = the +x side, 180 = front

class Out:
    def __init__(self): self.pos, self.uv, self.idx, self.si, self.sw, self.col = [], [], [], [], [], []
    def add(self, pts, uv, tris, w, col=None):
        """w: (bone index array n x 4, weight array n x 4 in 0..1)"""
        base = len(self.pos); self.pos.extend(np.asarray(pts).tolist()); self.uv.extend(np.asarray(uv).tolist()); self.idx.extend((np.asarray(tris) + base).reshape(-1).tolist())
        self.si.extend(np.asarray(w[0]).tolist()); self.sw.extend(np.asarray(w[1]).tolist())
        self.col.extend((np.tile(col, (len(pts), 1)) if col is not None else np.ones((len(pts), 3))).tolist())
    def put(self, pk, key, color=False):
        if not self.pos: return False
        sw = np.array(self.sw); sw = sw / sw.sum(1, keepdims=True); q = np.floor(sw * 255 + 0.5).astype(int); q[:, 0] += 255 - q.sum(1)
        pk.add(key + '.pos', np.array(self.pos, np.float32), 3); pk.add(key + '.uv', np.array(self.uv, np.float32), 2); pk.add(key + '.idx', np.array(self.idx, np.uint16 if len(self.pos) < 65536 else np.uint32))
        pk.add(key + '.si', np.array(self.si, np.uint8), 4); pk.add(key + '.sw', q.astype(np.uint8), 4)
        if color: pk.add(key + '.col', np.clip(np.round(np.array(self.col) * 255), 0, 255).astype(np.uint8), 3)
        return True

def rigid(n, bone='head'): si = np.zeros((n, 4), int); si[:, 0] = BI[bone]; sw = np.zeros((n, 4)); sw[:, 0] = 1; return si, sw
def hang(y, f, L):
    """Hair near the head rides the head; hair lying on the shoulders and back rides the chest."""
    n = len(y); t = sstep(f['chin'] + 0.02, L['ySh'] - 0.05, y) * 0.85
    si = np.zeros((n, 4), int); si[:, 0] = BI['head']; si[:, 1] = BI['chest2']; sw = np.zeros((n, 4)); sw[:, 0] = 1 - t; sw[:, 1] = t
    return si, sw

def fix_wrap(pos, uv, tris, period):
    """Where a triangle straddles the seam of a wrapped coordinate, give it its own copies of the low side."""
    pos, uv, tris = list(map(list, pos)), list(map(list, uv)), [list(t) for t in tris]; dup = {}
    for t in tris:
        us = [uv[v][0] for v in t]
        if max(us) - min(us) > period / 2:
            for k, v in enumerate(t):
                if uv[v][0] < period / 2:
                    if v not in dup: dup[v] = len(pos); pos.append(pos[v]); uv.append([uv[v][0] + period, uv[v][1]])
                    t[k] = dup[v]
    return np.array(pos), np.array(uv), np.array(tris), dup

def ring_depth(A, inside, n=6):
    """How many rings of neighbors each inside vertex is from the edge of the set, 0..1 over n rings."""
    d = np.where(inside, 1.0, 0.0); cur = inside.copy(); depth = np.zeros(len(inside))
    for k in range(n):
        edge = cur & ((A @ cur.astype(float)) < 0.999); cur = cur & ~edge; depth[cur] = k + 1
    return np.clip(depth / n, 0, 1)

def casts(inter, org, d, far=0.32, first=False):
    """How far out the body's surface is along each ray: the farthest hit within reach (past any cavity), or the first one."""
    loc, ray, _ = inter.intersects_location(org, d, multiple_hits=True); r = np.full(len(org), np.inf if first else 0.0)
    if len(ray):
        dist = np.linalg.norm(loc - org[ray], axis=1); ok = dist < far
        if first: np.minimum.at(r, ray[ok], dist[ok])
        else: np.maximum.at(r, ray[ok], dist[ok])
    r[~np.isfinite(r)] = 0
    return r

def sheet(inter, C, phis, y0, ytip, M, clr, f, L, back=0.0, to=None, wave=None, tip_out=0.0, slope=0.3, u0=0.0, vr=(0.35, 1.0), seed=0):
    """A sheet of hair: one strand per angle around the head, each coming down from y0 to its tip, outside the body all the way.
    back: how far the strands swing round toward the back by the time they reach the shoulders (hair worn behind the shoulders)."""
    N = len(phis); ys = np.array([np.linspace(y0[i] if np.ndim(y0) else y0, ytip[i] if np.ndim(ytip) else ytip, M) for i in range(N)]); t = np.linspace(0, 1, M)[None, :]
    s = sstep(f['earTop'], L['ySh'] + 0.02, ys)                                             # 0 above the ears, 1 at the shoulders and below
    ph = phis[:, None] * (1 - back * s) if to is None else phis[:, None] + (np.sign(phis)[:, None] * to - phis[:, None]) * s      # to: every strand heads for this direction by the shoulders
    d = dirv(ph.reshape(-1)); org = np.c_[np.zeros(N * M), ys.reshape(-1), np.full(N * M, C[2])]
    rf = casts(inter, org, d, far=0.17).reshape(N, M); r1 = casts(inter, org, d, first=True).reshape(N, M)
    rs = np.where(ys > f['chin'] + 0.012, rf, r1); c = clr(ys) if callable(clr) else clr; r = rs + c
    for j in range(1, M): r[:, j] = np.maximum(r[:, j], r[:, j - 1] - slope * np.abs(ys[:, j] - ys[:, j - 1]))
    r = r + tip_out * t ** 3
    if wave:
        amp, lam = wave; rng = np.random.default_rng(seed); psi = 1.6 * np.sin(phis * 2.3 + seed) + rng.normal(0, 0.3, N); psi = np.convolve(np.r_[psi[:1], psi, psi[-1:]], [0.25, 0.5, 0.25], 'valid')
        sl = (ys[:, :1] - ys); grow = np.clip(t * 1.6, 0, 1); r = r + amp * grow * (1 + np.sin(2 * np.pi * sl / lam + psi[:, None])); ph = ph + (amp / 0.09) * 0.35 * grow * np.cos(2 * np.pi * sl / lam + psi[:, None] + 0.7)
    dd = dirv(ph.reshape(-1)); pts = org + dd * r.reshape(-1)[:, None]
    root = pts.reshape(N, M, 3)[:, 0]; arc = np.r_[0, np.cumsum(np.linalg.norm(np.diff(root, axis=0), axis=1))]
    uv = np.stack([np.repeat(u0 + arc / 0.085, M), np.tile(vr[0] + (vr[1] - vr[0]) * t[0], N)], -1); tr = []
    for i in range(N - 1):
        for j in range(M - 1):
            a = i * M + j; tr += [[a, a + M, a + 1], [a + 1, a + M, a + M + 1]]
    return pts, uv, np.array(tr), hang(pts[:, 1], f, L)

def tube(path, rad, K, f, L, u_rep=2.0, vr=(0.35, 1.0), flat=1.0):
    """Hair gathered into a tail: rings around a path."""
    pts, uv = [], []; n = len(path)
    for i, p in enumerate(path):
        t_ = path[min(i + 1, n - 1)] - path[max(i - 1, 0)]; t_ /= np.linalg.norm(t_) + 1e-9
        a = np.cross(t_, [0, 0, 1.0]); a /= np.linalg.norm(a) + 1e-9; b = np.cross(t_, a)
        for q in range(K + 1):
            an = q / K * 2 * np.pi; pts.append(p + (a * np.cos(an) + b * np.sin(an) * flat) * rad[i]); uv.append([q / K * u_rep, vr[0] + (vr[1] - vr[0]) * i / (n - 1)])
    tr = []
    for i in range(n - 1):
        for q in range(K):
            a0 = i * (K + 1) + q; tr += [[a0, a0 + K + 1, a0 + 1], [a0 + 1, a0 + K + 1, a0 + K + 2]]
    pts = np.array(pts); return pts, np.array(uv), np.array(tr), hang(pts[:, 1], f, L)

HAIR = {
    'em':    dict(style='long', part=True, thick=0.016, length=0.2, bangs=True),
    'mel':   dict(style='tails', part=True, thick=0.015, bangs=True, tie='#3fb3b4'),
    'yen':   dict(style='long', part=True, thick=0.02, length=0.17, wave=(0.005, 0.09), layers=2),
    'gma':   dict(style='curls', thick=0.028, soft=True),
    'guard': dict(style='short', thick=0.008, hat='#f4f3ee', brim='#d7263b'),
    'guardf': dict(style='pony', thick=0.012, hat='#f4f3ee', brim='#d7263b', tie='#d7263b'),
    'nutty': dict(style='short', thick=0.007, hat='#d7263b'),
}

def build_hair(c, pk, info):
    import trimesh
    from trimesh.ray.ray_pyembree import RayMeshIntersector
    cid = c['id']; H = HAIR[cid]; st = tex.STYLE[cid]; topo = build.topology(); P = c['P']; f = c['frame']; L = c['L']; A = build.adjacency()
    N = build.vertex_normals(P, topo['skin_tris']); inter = RayMeshIntersector(trimesh.Trimesh(P, topo['skin_tris'], process=False))
    head = topo['head']; a0, n0 = head['ranges']['skin']; htris = head['orig'][head['idx'].reshape(-1)[a0:a0 + n0].reshape(-1, 3)]
    hv = np.unique(htris); hf = np.zeros(mh.NV); hf[hv] = tex.hairiness(P[hv], f, st.get('hairline', 'full'), st.get('burn', 0))
    ears = np.zeros(mh.NV)                                                # keep hair off the ears: read the ear mask at each vertex
    em = tex.head_mask('ears'); uvh = head['uv']; px = np.clip((uvh[:, 0] * tex.HW).astype(int), 0, tex.HW - 1); py = np.clip(((1 - uvh[:, 1]) * tex.HH).astype(int), 0, tex.HH - 1)
    np.maximum.at(ears, head['orig'], em[py, px]); inside = (hf > 0.5) & (ears < 0.25)
    depth = ring_depth(A, inside, 7)
    out = Out(); hat = Out(); tie_ = Out(); C = np.array([0, f['ey'] + 0.3 * (f['top'] - f['ey']), (f['front'] + f['back']) / 2])
    hatline = None
    if H.get('hat'):
        # a ball cap: its edge runs from above the brows, over the tops of the ears, to the back of the head
        yF = f['ey'] + 2.5 * f['r']; yB = f['earTop'] + 0.02; hatline = lambda p: yB + (yF - yB) * sstep(f['back'], f['front'], p[:, 2]) ** 1.3
    # ---- the cap of hair on the scalp: full thickness inside, thinning to a fringe of strand ends at the hairline ----
    sc = inside[htris].any(1) & (ears[htris] < 0.3).all(1); st_ = htris[sc]; sv = np.unique(st_); ins = inside[sv]
    thick = np.where(ins, H['thick'] * (0.12 + 0.88 * depth[sv] ** 0.7), 0.0012)
    if hatline is not None: under = sstep(-0.004, 0.012, P[sv, 1] - hatline(P[sv])); thick = thick * (1 - 0.55 * under)
    Pc = P.copy(); Pc[sv] = P[sv] + N[sv] * thick[:, None]
    for it in range(2): avg = A @ Pc; Pc[sv] = Pc[sv] * 0.6 + avg[sv] * 0.4
    loc = {v: i for i, v in enumerate(sv)}; q = Pc[sv] - C
    vv = np.where(ins, 0.25 + 0.66 * (1 - depth[sv]) ** 1.6, 1.08)        # strands run out to their tips at the edge of the scalp
    if H.get('part'):
        cuv = np.c_[(q[:, 2] - q[:, 2].min()) / 0.085, vv]; ctr = np.array([[loc[a] for a in t] for t in st_]); cpos = Pc[sv]
    else:
        ax = np.array([0, 0.86, -0.5]) if H['style'] != 'pony' else np.array([0, -0.12, -1.0]); ax /= np.linalg.norm(ax); e1 = np.cross(ax, [1.0, 0, 0]); e1 /= np.linalg.norm(e1); e2 = np.cross(ax, e1)
        qa = q / (np.linalg.norm(q, axis=1, keepdims=True) + 1e-9); az = np.arctan2(qa @ e2, qa @ e1) % (2 * np.pi)
        rep = 14.0 if H.get('soft') else 7.0; cpos, cuv, ctr, dup = fix_wrap(Pc[sv], np.c_[az / (2 * np.pi) * rep, vv], [[loc[a] for a in t] for t in st_], rep)
    if H['style'] == 'curls':
        import trimesh as tm
        for it in range(1):
            cpos2, ctr = tm.remesh.subdivide(np.c_[cpos, cuv], np.asarray(ctr)); cpos, cuv = cpos2[:, :3], cpos2[:, 3:]
        m_ = tm.Trimesh(cpos, ctr, process=False); nn = np.asarray(m_.vertex_normals); amt = np.clip((0.95 - cuv[:, 1]) / 0.4, 0, 1)
        cpos = cpos + nn * (0.008 * amt * (0.2 + tex.noise(cpos, 0.026, 31, 12) + 0.5 * tex.noise(cpos, 0.016, 33, 12)))[:, None]
    out.add(cpos, cuv, ctr, rigid(len(cpos)))
    Tk = H['thick']; clr = lambda ys: 0.004 + Tk * sstep(f['earBot'] - 0.02, f['earTop'] + 0.03, ys) + 0.009 * sstep(f['chin'], f['chin'] - 0.06, ys)
    ytop = f['ey'] + 0.8 * (f['top'] - f['ey'])
    if H['style'] == 'long':
        n = 40; ph = np.radians(np.linspace(-98, 98, n)); rng = np.random.default_rng(3); tipy = L['ySh'] - H['length'] + 0.025 * np.abs(np.sin(ph * 1.5)) + rng.normal(0, 0.005, n)
        for layer in range(H.get('layers', 2)):
            pts, uv, tr, w = sheet(inter, C, ph, ytop - 0.012 * layer, tipy + 0.03 * layer, 24, (lambda ys, k=layer: clr(ys) - 0.003 * k), f, L, back=0.72, wave=H.get('wave'), u0=layer * 3.7, seed=layer)
            out.add(pts, uv, tr, w)
        if H.get('front'):
            for sgn in (-1, 1):
                ph2 = sgn * np.radians(np.linspace(98, 134, 10)); tip2 = L['ySh'] - H['length'] * 0.6 + 0.025 * np.linspace(0, 1, 10)
                pts, uv, tr, w = sheet(inter, C, ph2, ytop, tip2, 22, clr, f, L, to=np.radians(150) + np.radians(np.linspace(-24, 24, 10))[:, None], wave=H.get('wave'), u0=11 + sgn, seed=5 + sgn)
                out.add(pts, uv, tr, w)
    if H['style'] == 'tails':
        for sgn in (-1, 1):
            tie = np.array([sgn * f['earX'] * 0.96, f['earBot'] - 0.006, f['earZ'] - 0.034]); n = 12; s = np.linspace(0, 1, n)
            path = np.stack([tie[0] + sgn * (0.022 * np.sin(s * 2.2) + 0.006 * np.sin(s * 9)), tie[1] - 0.15 * s ** 1.15, tie[2] - 0.01 * s + 0.006 * np.sin(s * 8 + 1)], -1)
            rad = 0.012 + 0.02 * np.sin(np.clip(s * 1.9, 0, np.pi)) ** 0.8 * (1 - 0.55 * s); rad[0] = 0.012
            pts, uv, tr, w = tube(path, rad, 10, f, L, u_rep=1.6); out.add(pts, uv, tr, w)
            pts, uv, tr, w = tube(np.stack([tie + np.array([0, 0.004, 0]), tie - np.array([0, 0.006, 0])]), np.array([0.0145, 0.0145]), 10, f, L); tie_.add(pts, uv, tr, rigid(len(pts)), hexc(H['tie']))
    if H['style'] == 'pony':
        tie = np.array([0, f['earTop'] + 0.012, f['back'] - 0.004]); n = 12; s = np.linspace(0, 1, n)
        path = np.stack([0.004 * np.sin(s * 7), tie[1] + 0.012 * np.sin(s * 3.0) - 0.2 * s ** 1.3, tie[2] - 0.03 * np.sin(s * 2.4) - 0.012 * s], -1)
        rad = 0.011 + 0.017 * np.sin(np.clip(s * 2.2, 0, np.pi)) ** 0.7 * (1 - 0.5 * s)
        pts, uv, tr, w = tube(path, rad, 10, f, L, u_rep=1.6); out.add(pts, uv, tr, w)
        pts, uv, tr, w = tube(np.stack([tie + np.array([0, 0.003, 0.003]), tie - np.array([0, 0.004, 0.006])]), np.array([0.0135, 0.0135]), 10, f, L); tie_.add(pts, uv, tr, rigid(len(pts)), hexc(H['tie']))
    if H.get('bangs'):
        n = 16; ph = np.radians(np.linspace(180 - 46, 180 + 46, n)); yb = f['ey'] + 1.32 * f['r'] + 0.006 * np.cos(np.linspace(-1.2, 1.2, n))
        pts, uv, tr, w = sheet(inter, C, ph, f['ey'] + 0.86 * (f['top'] - f['ey']), yb, 12, 0.0045, f, L, tip_out=0.004, slope=2.0, u0=20, vr=(0.45, 1.0)); out.add(pts, uv, tr, rigid(len(pts)))
    # ---- hat ----
    if H.get('hat'):
        line = hatline(P); ab = np.zeros(mh.NV, bool); ab[hv] = (P[hv, 1] > line[hv]) & (ears[hv] < 0.3)
        ht = htris[ab[htris].any(1)]; hvs = np.unique(ht); crown = sstep(f['earTop'], f['top'], P[hvs, 1])
        Pb = P.copy(); low = hvs[P[hvs, 1] < line[hvs]]; Pb[low, 1] = line[low]                         # a clean edge: bring the bottom row up to the line
        Ph = Pb.copy(); Ph[hvs] = Pb[hvs] + N[hvs] * (0.0065 + 0.006 * crown)[:, None]
        mask_h = np.zeros(mh.NV); mask_h[hvs] = 1; inner = hvs[(A @ mask_h)[hvs] > 0.999]; inner = inner[P[inner, 1] > line[inner] + 0.004]
        for it in range(5): avg = A @ Ph; Ph[inner] = Ph[inner] * 0.5 + avg[inner] * 0.5; d = ((Ph[inner] - Pb[inner]) * N[inner]).sum(1); Ph[inner] += N[inner] * np.clip(0.006 - d, 0, None)[:, None]
        lh = {v: i for i, v in enumerate(hvs)}; col = hexc(H['hat']); hat.add(Ph[hvs], np.zeros((len(hvs), 2)), [[lh[a] for a in t] for t in ht], rigid(len(hvs)), col)
        # the bill: a rounded tongue out from the front edge of the cap, drooping a little at the sides
        nb = 21; bm = np.radians(64); be = np.linspace(-bm, bm, nb); yF = f['ey'] + 2.5 * f['r']
        org = np.c_[np.zeros(nb), np.full(nb, yF), np.full(nb, C[2])]; dd = dirv(np.pi + be); rr = casts(inter, org, dd, far=0.17) + 0.013
        inner = org + dd * rr[:, None]; ext = 0.08 * np.sqrt(np.clip(1 - (be / bm) ** 2, 0, 1)); drop = 0.014 * (be / bm) ** 2; rows = []
        for e in (0, 0.34, 0.68, 1.0): rows.append(inner + np.c_[np.zeros(nb), -(0.013 * e + drop * e) - 0.002, ext * e])
        pts = np.concatenate(rows); tr = []
        for k in range(3):
            for i in range(nb - 1):
                a = k * nb + i; tr += [[a, a + 1, a + nb], [a + 1, a + nb + 1, a + nb]]
        hat.add(pts, np.zeros((len(pts), 2)), tr, rigid(len(pts)), hexc(H.get('brim', H['hat'])))
    out.put(pk, cid + '.hair'); has_hat = hat.put(pk, cid + '.hat', color=True); tie_.put(pk, cid + '.tie', color=True)
    fr = {k: (v.tolist() if hasattr(v, 'tolist') else float(v)) for k, v in f.items() if k != 'hv'}
    info['hair'][cid] = dict(style=H['style'], soft=bool(H.get('soft')), hat=bool(has_hat), frame=fr, tris=len(out.idx) // 3)
    print('  hair', cid, H['style'], 'verts', len(out.pos), 'tris', len(out.idx) // 3)

def run(only=None):
    import wear
    topo, pk, info, chars = wear.run(only)
    for cid, c in chars.items(): build_hair(c, pk, info)
    return topo, pk, info, chars

if __name__ == '__main__':
    topo, pk, info, chars = run(sys.argv[1:] or None); build.finish(pk, info)
