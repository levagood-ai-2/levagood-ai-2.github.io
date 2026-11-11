# Clothes and shoes. A garment is a region of the body (worked out from where each point sits) plus how far it stands
# off the skin. The cloth layer is the body's own surface pushed out, smoothed where the cloth is loose, and cut with an
# alpha map, so it bends with the body. Shoes are lofted around each foot; sandals get a sole and a strap.
import os
import sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont
import scipy.ndimage as nd
from scipy.spatial import cKDTree, ConvexHull
import mh, build, tex
from tex import sstep, mix, hexc

WW = WH = 2048

class Ctx:
    def __init__(self, P, W):
        self.P = P; self.x, self.y, self.z = P[:, 0], P[:, 1], P[:, 2]; self.ax = np.abs(self.x)
        self.arm = W['armL'] + W['armR'] + W['handL'] + W['handR']; self.hand = W['handL'] + W['handR']
        self.leg = W['legL'] + W['legR']; self.foot = W['footL'] + W['footR']; self.nh = W['nh']

_WD = None
def weights_dict():
    global _WD
    if _WD is None:
        W = dict(tex.part_weights()); _, _, M = build.bone_weights(); BI = build.BI
        W['nh'] = M[:, BI['neck']] * 0.5 + M[:, BI['neck2']] + M[:, BI['head']]; _WD = W
    return _WD

def landmarks(c):
    J = c['J']; P = c['P'][:mh.NBODY]; W = weights_dict(); tor = (W['torso'][:mh.NBODY] > 0.5)
    L = dict(yHip=J['legR'][1], xHip=abs(J['legR'][0]), zHip=J['legR'][2], yKnee=J['shinR'][1], yAnk=J['footR'][1], yPel=J['hips'][1], ySp=J['spine'][1], ySp2=J['spine2'][1],
             yCh=J['chest'][1], yCh2=J['chest2'][1], yNeck=J['neck'][1], zNeck=J['neck'][2], ySh=J['armR'][1], xSh=abs(J['armR'][0]), yEl=J['foreR'][1], yWr=J['handR'][1])
    mid = tor & (np.abs(P[:, 0]) < 0.012) & (P[:, 1] < L['yHip'] + 0.03); L['yCr'] = P[mid, 1].min()
    na = (W['armL'] + W['armR'] + W['handL'] + W['handR'])[:mh.NBODY] < 0.3
    band = na & (np.abs(P[:, 1] - (L['yHip'] + 0.04)) < 0.012); L['xSide'] = np.abs(P[band, 0]).max()
    ch = tor & (np.abs(P[:, 1] - L['yCh2']) < 0.02); L['zCh'] = P[ch, 2].mean(); L['zFront'] = P[ch, 2].max()
    return L

# ---------- garment regions ----------
W_ = 0.0025
def legline(X, L, high=0.045):
    p = mix(1.75, 0.9, sstep(-0.02, 0.03, X.z - L['zHip'])); yS = L['yHip'] + high
    return L['yCr'] - 0.004 + (yS - L['yCr']) * np.clip(X.ax / L['xSide'], 0, 1) ** p
def notarm(X): return sstep(0.5, 0.4, X.arm)
def top_cut(X, L, xi=0.42, xo=0.63, neck=0.075, back=0.035, pit=0.078):
    """1 below the neckline and the armholes of a tank: straps between xi and xo (fractions of the shoulder width). Round cuts."""
    xi, xo = xi * L['xSh'], xo * L['xSh']; front = sstep(-0.01, 0.02, X.z - L['zCh']); yTop = L['ySh'] + 0.12
    nl0 = mix(L['yCh2'] + back, L['yCh2'] + neck, front); pitY = L['ySh'] - pit; wo = 0.055
    lim_in = nl0 + (yTop - nl0) * (1 - np.sqrt(np.clip(1 - np.clip(X.ax / xi, 0, 1) ** 2.4, 0, 1)))
    lim_out = pitY + (yTop - pitY) * (1 - np.sqrt(np.clip(1 - np.clip((xo + wo - X.ax) / wo, 0, 1) ** 2.4, 0, 1)))
    lim = np.where(X.ax < (xi + xo) / 2, lim_in, lim_out)
    return sstep(W_, -W_, X.y - lim) * notarm(X) * sstep(0.6, 0.4, X.nh)
def g_onepiece(X, L, **k): return sstep(-W_, W_, X.y - legline(X, L)) * top_cut(X, L, **k)
def g_croptop(X, L, **k): return sstep(-W_, W_, X.y - (L['ySp2'] + 0.045)) * top_cut(X, L, **k)
def g_briefs(X, L): return sstep(-W_, W_, X.y - legline(X, L, 0.03)) * sstep(W_, -W_, X.y - (L['yHip'] + 0.085)) * notarm(X)
def hem_y(L, hem): return (L['yKnee'] + hem * (L['yHip'] - L['yKnee'])) if hem < 1.5 else L['yAnk'] + 0.08       # long pants stop above the ankle, clear of the seam where the foot's own skin begins
def g_bottoms(X, L, hem=0.42, waist=0.095):
    return sstep(-W_, W_, X.y - hem_y(L, hem)) * sstep(W_, -W_, X.y - (L['yHip'] + waist)) * notarm(X) * sstep(0.6, 0.4, X.foot)
def neckhole(X, L, r=0.4, drop=0.035):
    dh = np.hypot(X.x, X.z - L['zNeck']); front = sstep(0.0, 0.03, X.z - L['zNeck'])
    hole = sstep(W_, -W_, dh - r * L['xSh']) * sstep(-W_, W_, X.y - (L['yNeck'] - 0.012 - drop * front))
    return (1 - hole) * sstep(0.62, 0.45, X.nh)
def sleeve_y(L, sleeve): return (L['yEl'] + sleeve * (L['ySh'] - L['yEl'])) if sleeve < 1.5 else L['yWr'] + 0.012
def g_tee(X, L, sleeve=0.5, hem=0.045):
    armpart = sstep(0.45, 0.55, X.arm)
    body = sstep(-W_, W_, X.y - (L['yHip'] + hem)) * (1 - armpart)
    arm = sstep(-W_, W_, X.y - sleeve_y(L, sleeve)) * armpart * sstep(0.5, 0.35, X.hand)
    return np.maximum(body, arm) * neckhole(X, L) * sstep(0.6, 0.4, X.leg + X.foot)
def g_tank(X, L, hem=0.045, **k): return sstep(-W_, W_, X.y - (L['yHip'] + hem)) * top_cut(X, L, **k) * sstep(0.6, 0.4, X.leg + X.foot)
def flare(X, y0, span, amt): return amt * sstep(span, 0.0, X.y - y0) * (X.y > y0 - 0.01)

def outfit(cid, L):
    """Who wears what, bottoms first. f: region, off: stand-off, loose: smoothing passes (0 = skin tight), fl: extra stand-off at hems."""
    red, white = '#d7263b', '#f4f3ee'; Z = lambda X: 0 * X.y
    if cid == 'em': return [dict(f=lambda X: g_onepiece(X, L), color='#1e2340', off=0.0024)]
    if cid == 'mel': return [dict(f=lambda X: g_briefs(X, L), pattern='floral', off=0.0024),
                             dict(f=lambda X: g_croptop(X, L, xi=0.4, xo=0.6, neck=0.085, back=0.05), pattern='floral', off=0.0024)]
    if cid == 'yen': return [dict(f=lambda X: g_onepiece(X, L), color='#1b1b1b', off=0.002),
                             dict(f=lambda X: g_tank(X, L, hem=0.02, xi=0.44, xo=0.6, neck=0.07, back=0.04), color='#efe4d2', off=0.006, loose=14, knit=1)]
    if cid == 'gma': return [dict(f=lambda X: g_bottoms(X, L, hem=2, waist=0.11), color='#c9b68a', off=0.011, loose=34, fl=lambda X: flare(X, hem_y(L, 2), 0.1, 0.008)),
                             dict(f=lambda X: g_tee(X, L, sleeve=2, hem=-0.01), color='#a9cbe8', off=0.016, loose=70, knit=1,
                                  fl=lambda X: flare(X, L['yHip'] - 0.01, 0.06, 0.007) * (X.arm < 0.5) + flare(X, sleeve_y(L, 2), 0.05, 0.004) * (X.arm > 0.5))]
    if cid == 'guard': return [dict(f=lambda X: g_bottoms(X, L, hem=0.3, waist=0.1), color=red, off=0.012, loose=30, fl=lambda X: flare(X, hem_y(L, 0.3), 0.09, 0.013)),
                               dict(f=lambda X: g_tank(X, L, hem=0.05, xi=0.36, xo=0.74, neck=0.085, back=0.1, pit=0.095), color=white, off=0.0075, loose=16, trimc=red,
                                    fl=lambda X: flare(X, L['yHip'] + 0.05, 0.05, 0.006))]
    if cid == 'guardf': return [dict(f=lambda X: g_onepiece(X, L, xi=0.4, xo=0.62, neck=0.07, back=0.03), color=red, off=0.0024, trimc=white)]
    if cid == 'nutty': return [dict(f=lambda X: g_bottoms(X, L, hem=2, waist=0.1), color='#1e2026', off=0.011, loose=34, fl=lambda X: flare(X, hem_y(L, 2), 0.1, 0.009)),
                               dict(f=lambda X: g_tee(X, L, sleeve=0.5, hem=0.03), color=white, off=0.010, loose=24,
                                    fl=lambda X: flare(X, L['yHip'] + 0.03, 0.05, 0.007) * (X.arm < 0.5) + flare(X, sleeve_y(L, 0.5), 0.04, 0.008) * (X.arm > 0.5))]
    return []
SHOES = {'em': ('bare', None), 'mel': ('flip', '#f06a9b'), 'yen': ('flip', '#15171c'), 'gma': ('shoe', '#f4f3ee'), 'guard': ('flip', '#1c1f26'), 'guardf': ('flip', '#1c1f26'), 'nutty': ('shoe', '#30333b')}

_FLORAL = None
def floral():
    global _FLORAL
    if _FLORAL is None:
        S = 256; im = Image.new('RGB', (S * 3, S * 3), '#3fb3b4'); d = ImageDraw.Draw(im); rng = np.random.default_rng(7)
        def rep(fn):
            for ox in (0, S, 2 * S):
                for oy in (0, S, 2 * S): fn(ox, oy)
        for i in range(16):
            x, y, a, b = rng.random() * S, rng.random() * S, 26 + rng.random() * 26, 18 + rng.random() * 16; col = ['#5cc5c9', '#2f9fa6', '#7fd0e8'][i % 3]
            rep(lambda ox, oy: d.ellipse((ox + x - a, oy + y - b, ox + x + a, oy + y + b), fill=col))
        for i in range(13):
            x, y, r = rng.random() * S, rng.random() * S, 9 + rng.random() * 6; col = ['#f48fb1', '#ffffff', '#9fd3f0', '#f8bbd0'][i % 4]; ph = rng.random() * 6
            def fl(ox, oy):
                for p in range(5):
                    a = ph + p / 5 * 6.2832; cx, cy = ox + x + np.cos(a) * r, oy + y + np.sin(a) * r; d.ellipse((cx - r * 0.75, cy - r * 0.75, cx + r * 0.75, cy + r * 0.75), fill=col)
                d.ellipse((ox + x - r * 0.45, oy + y - r * 0.45, ox + x + r * 0.45, oy + y + r * 0.45), fill='#ffd36b')
            rep(fl)
        for i in range(34):
            x, y = rng.random() * S, rng.random() * S; rep(lambda ox, oy: d.ellipse((ox + x - 2, oy + y - 2, ox + x + 2, oy + y + 2), fill='#1b2a58'))
        _FLORAL = np.asarray(im.crop((S, S, 2 * S, 2 * S)), float) / 255
    return _FLORAL

def chest_text(Pt, L, text, y0, h, halfw):
    """Letters across the front of the chest: 0..1 where the ink is."""
    font = ImageFont.truetype('/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf', 96); im = Image.new('L', (700, 140), 0); d = ImageDraw.Draw(im)
    bb = d.textbbox((0, 0), text, font=font); d.text(((700 - (bb[2] - bb[0])) / 2 - bb[0], (140 - (bb[3] - bb[1])) / 2 - bb[1]), text, fill=255, font=font)
    arr = np.asarray(im, float) / 255; u = (Pt[:, 0] + halfw) / (2 * halfw); v = (y0 + h - Pt[:, 1]) / h
    ok = (u > 0) & (u < 1) & (v > 0) & (v < 1) & (Pt[:, 2] > L['zCh'])
    out = np.zeros(len(Pt)); out[ok] = arr[np.clip((v[ok] * 139).astype(int), 0, 139), np.clip((u[ok] * 699).astype(int), 0, 699)]
    return out

def build_wear(c, pk, info):
    cid = c['id']; topo = build.topology(); body = topo['body']; orig = body['orig']; W = weights_dict(); L = landmarks(c); c['L'] = L
    P, N = c['P'], build.vertex_normals(c['P'], topo['skin_tris']); A = build.adjacency(); Xv = Ctx(P, W); gs = outfit(cid, L)
    Pw = P.copy(); cov = np.zeros(mh.NV)
    for g in gs:
        cg = g['f'](Xv); on = cg > 0.02; base = g['off']; fl = g['fl'](Xv) if g.get('fl') else np.zeros(mh.NV)
        Pg = P + N * (base + fl)[:, None]
        for it in range(g.get('loose', 0)):
            avg = A @ Pg; Pg[on] = Pg[on] * 0.45 + avg[on] * 0.55
            d = ((Pg - P) * N).sum(1); need = np.clip(base * 0.8 + fl - d, 0, None); Pg[on] += N[on] * need[on, None]
        take = on & (((Pg - P) * N).sum(1) > ((Pw - P) * N).sum(1)); Pw[take] = Pg[take]; cov = np.maximum(cov, cg)
    a0, n0 = body['ranges']['skin']; tris = body['idx'].reshape(-1)[a0:a0 + n0].reshape(-1, 3)
    hit = (cov[orig][tris] > 0.02).any(1); T = tris[hit]; used = np.unique(T)
    # the ring of vertices just past the cut: stand them off like their covered neighbors, so the cut edge lies on cloth
    ring = np.unique(orig[used]); ring = ring[cov[ring] <= 0.02]
    if len(ring):
        d = ((Pw - P) * N).sum(1); dn = (A @ np.where(cov > 0.02, d, 0)) / np.maximum(A @ (cov > 0.02).astype(float), 1e-6); Pw[ring] = P[ring] + N[ring] * dn[ring, None]
    pk.add(cid + '.wear.vi', used.astype(np.uint16)); pk.add(cid + '.wear.pos', np.round(Pw[orig[used]] * 16000).astype(np.int16), 3, q=1 / 16000); pk.add(cid + '.wear.idx', T.reshape(-1).astype(np.uint16))
    # ---- texture: color and alpha, with the same regions worked out per texel ----
    Tx = tex.Tex(body, build.BODY_ORDER, WW, WH, 'wear'); Pt = Tx.field(P); ao = Tx.field(c['ao'])
    Wt = getattr(build_wear, '_wt', None)
    if Wt is None: Wt = build_wear._wt = {k: Tx.field(v) for k, v in W.items() if k in ('armL', 'armR', 'handL', 'handR', 'legL', 'legR', 'footL', 'footR', 'nh')}
    Xt = Ctx(Pt, Wt); RGB = np.zeros((len(Pt), 3)); Aa = np.zeros(len(Pt)); under = []
    for g in gs:
        cg = g['f'](Xt)
        col = floral()[Tx.py % 256, Tx.px % 256] if g.get('pattern') == 'floral' else np.tile(hexc(g['color']), (len(Pt), 1))
        col = col * (1 + 0.03 * tex.noise(Pt, 0.004 if g.get('knit') else 0.02, 21))[:, None]
        if g.get('knit'): col = col * (0.95 + 0.05 * np.sin(Pt[:, 1] * 2 * np.pi / 0.0045))[:, None]
        if g.get('text'): col = mix(col, hexc(g['text'][1]), chest_text(Pt, L, g['text'][0], L['yCh2'] + 0.004, 0.058, 0.115))
        if g.get('trimc'): col = mix(col, hexc(g['trimc']), sstep(0.3, 0.5, cg) * sstep(0.9995, 0.985, cg))                # a colored binding along the cut
        else: col = col * (1 - 0.15 * sstep(0.35, 0.6, cg) * sstep(0.995, 0.9, cg))[:, None]            # a hem line just inside the cut
        col = tex.shade(col, ao, 0.5 if not g.get('loose') else 0.25, (0.45, 0.42, 0.45))
        k = cg > 0.02; RGB[k] = col[k]; Aa[k] = np.maximum(Aa[k], cg[k]); under.append((cg, col))
    out = np.zeros((WH, WW, 3)); al = np.zeros((WH, WW)); out[Tx.valid] = RGB; al[Tx.valid] = Aa; have = al > 0.02
    if have.any():
        fill = nd.distance_transform_edt(~have, return_distances=False, return_indices=True); out = out[fill[0], fill[1]]
    im = Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)); im.putalpha(Image.fromarray((np.clip(al, 0, 1) * 255 + 0.5).astype(np.uint8)))
    kb = tex.save(im, build.OUT + cid + '_wear.webp', 88)
    # ---- shoes ----
    kind, scol = SHOES.get(cid, ('bare', None)); lift = 0.0
    if kind == 'shoe': lift = 0.016; put(pk, cid + '.shoe', shoes(c, L, lift, scol), color=True)
    elif kind == 'flip': lift = 0.012; put(pk, cid + '.flip', flipflops(c, L, lift))
    info['wear'][cid] = dict(lift=lift, shoes=kind, shoeColor=scol, tris=int(len(T)), armOut=max([0.0] + [0.055 if g.get('loose') else 0.0 for g in gs]) + (0.03 if cid == 'yen' else 0.0)); info['chars'][cid]['skin'] = tex.STYLE[cid]['skin']; info['chars'][cid]['L'] = {k: float(v) for k, v in L.items()}
    if cid == 'yen': skirt(c, L, pk, info, '#efe4d2')
    print('  wear', cid, 'tris', len(T), 'verts', len(used), 'tex', kb, 'KB', 'shoes', kind)
    return dict(under=under, Tx=Tx, kind=kind, L=L)

def put(pk, key, m, color=False):
    pk.add(key + '.pos', m['pos'].astype(np.float32), 3); pk.add(key + '.idx', m['idx'].astype(np.uint16)); pk.add(key + '.si', m['si'].astype(np.uint8), 4); pk.add(key + '.sw', m['sw'].astype(np.uint8), 4)
    if color: pk.add(key + '.col', np.clip(np.round(m['col'] * 255), 0, 255).astype(np.uint8), 3)

def underpaint(extra):
    """Paint the garment colors into the skin texture too, pulled in from the cut, so nothing bare ever shows through; socks for shoes."""
    def fn(c, T, P, N, C):
        for cg, col in extra['under']: C = mix(C, col, sstep(0.75, 0.97, cg))
        if extra['kind'] == 'shoe':
            L = extra['L']; s = sstep(L['yAnk'] + 0.115, L['yAnk'] + 0.108, P[:, 1])
            C = mix(C, np.array([0.95, 0.95, 0.93]) * (0.95 + 0.05 * np.sin(P[:, 1] * 2 * np.pi / 0.0035))[:, None], s)
        return C
    return fn

def foot_tools(c):
    import trimesh
    from trimesh.ray.ray_pyembree import RayMeshIntersector
    topo = build.topology(); body = topo['body']; orig = body['orig']; si, sw, M = build.bone_weights()
    fa, fn = body['ranges']['feet']; ft = orig[body['idx'].reshape(-1)[fa:fa + fn].reshape(-1, 3)]; P = c['P']; fv = np.unique(ft)
    return trimesh, RayMeshIntersector, P, ft, fv, si, sw

class MeshOut:
    def __init__(self, P, fv, si, sw): self.pos, self.idx, self.wi, self.ww, self.col = [], [], [], [], []; self.tree = cKDTree(P[fv]); self.fv, self.si, self.sw = fv, si, sw
    def add(self, pts, tris, col=None):
        base = len(self.pos); d, j = self.tree.query(pts); self.pos.extend(np.asarray(pts).tolist()); self.idx.extend((np.asarray(tris) + base).reshape(-1).tolist())
        self.wi.extend(self.si[self.fv[j]].tolist()); self.ww.extend(self.sw[self.fv[j]].tolist())
        self.col.extend((np.tile(col, (len(pts), 1)) if col is not None and np.ndim(col) == 1 else np.asarray(col) if col is not None else np.ones((len(pts), 3))).tolist())
    def done(self): return dict(pos=np.array(self.pos), idx=np.array(self.idx), si=np.array(self.wi), sw=np.array(self.ww), col=np.array(self.col))

def shoes(c, L, lift, color):
    """A sneaker lofted around each foot: rings of points cast from the middle of the foot out to its hull, a flat sole under it."""
    trimesh, RMI, P, ft, fv, si, sw = foot_tools(c); out = MeshOut(P, fv, si, sw)
    upper = hexc(color); light = upper.mean() > 0.6; sole = np.array([0.80, 0.80, 0.78]) if light else np.array([0.93, 0.92, 0.88]); trimc = np.array([0.55, 0.6, 0.68]) if light else np.clip(upper * 1.6 + 0.12, 0, 1)
    yC = L['yAnk'] + 0.004; NS, M = 18, 22
    for sx in (1, -1):
        pts = P[fv[(np.sign(P[fv, 0]) == sx) & (P[fv, 1] < yC)]]; hull = trimesh.convex.convex_hull(pts); inter = RMI(hull)
        z0, z1 = pts[:, 2].min(), pts[:, 2].max(); rings = []; cols = []
        for i in range(NS):
            t = (i + 0.5) / NS; z = z0 + (z1 - z0) * (0.5 - 0.5 * np.cos(np.pi * (0.04 + 0.92 * t)))
            near = pts[np.abs(pts[:, 2] - z) < 0.014]
            if len(near) < 3: near = pts
            cx = (near[:, 0].min() + near[:, 0].max()) / 2; cy = max(0.012, 0.42 * near[:, 1].max())
            th = np.arange(M) / M * 2 * np.pi; d = np.c_[np.cos(th), np.sin(th), np.zeros(M)]; o = np.tile([cx, cy, z], (M, 1))
            loc, ray, _ = inter.intersects_location(o, d, multiple_hits=False); hit = np.tile([cx, cy, z], (M, 1)).astype(float); hit[ray] = loc
            r = np.linalg.norm(hit - o, axis=1) + 0.0045; p = o + d * r[:, None]
            # the sole: anything near the ground drops to the bottom of the sole and steps out a little for a rim
            lowm = p[:, 1] < 0.012; p[lowm, 1] = -lift; side = (p[:, 1] >= 0.012) & (p[:, 1] < 0.03); p[side, 0] += np.sign(p[side, 0] - cx) * 0.0015
            col = np.tile(upper, (M, 1)); col[p[:, 1] < 0.016] = sole; col[lowm & (np.abs(d[:, 1]) > 0.8)] = sole * 0.5
            up = d[:, 1] > 0.78; lace = up & (t > 0.42) & (t < 0.8)
            col[lace] = trimc if i % 2 == 0 else mix(upper, trimc, 0.35); col[up & (t <= 0.42) & (p[:, 1] > yC - 0.006)] = np.array([0.95, 0.95, 0.93])
            col[(t > 0.86) & (p[:, 1] > 0.016)] = mix(upper, sole, 0.5)
            rings.append(p); cols.append(col)
        heel = np.array([rings[0][:, 0].mean(), 0.03, z0 - 0.004]); toe = np.array([rings[-1][:, 0].mean(), 0.012, z1 + 0.005])
        V = np.concatenate(rings + [heel[None], toe[None]]); Cc = np.concatenate(cols + [upper[None], mix(upper, sole, 0.5)[None]]); tr = []
        for i in range(NS - 1):
            for j in range(M):
                a, b = i * M + j, i * M + (j + 1) % M; tr += [[a, b, a + M], [b, b + M, a + M]]
        hi, ti = NS * M, NS * M + 1
        for j in range(M): tr += [[hi, (j + 1) % M, j], [ti, (NS - 1) * M + j, (NS - 1) * M + (j + 1) % M]]
        tr = np.array(tr); a, b, d_ = V[tr[0]]
        if np.cross(b - a, d_ - a) @ (a - np.array([rings[0][:, 0].mean(), 0.03, a[2]])) < 0: tr = tr[:, ::-1]
        out.add(V, tr, Cc)
    return out.done()

def flipflops(c, L, lift):
    """A sole under each foot and a Y strap that follows the top of the foot."""
    trimesh, RMI, P, ft, fv, si, sw = foot_tools(c); out = MeshOut(P, fv, si, sw); inter = RMI(trimesh.Trimesh(P, ft, process=False))
    def top_of_foot(x, z):
        loc, ray, _ = inter.intersects_location(np.array([[x, 0.25, z]]), np.array([[0, -1.0, 0]]), multiple_hits=False)
        return loc[0][1] if len(loc) else 0.0
    for s, sx in (('R', 1), ('L', -1)):
        fvs = fv[np.sign(P[fv, 0]) == sx]; low = P[fvs][P[fvs, 1] < 0.02][:, [0, 2]]
        hull = low[ConvexHull(low).vertices]; cen = hull.mean(0); hull = cen + (hull - cen) * 1.07
        seg = np.r_[hull, hull[:1]]; dl = np.r_[0, np.cumsum(np.linalg.norm(np.diff(seg, axis=0), axis=1))]; n = 40; tt = np.linspace(0, dl[-1], n, endpoint=False)
        ring = np.c_[np.interp(tt, dl, seg[:, 0]), np.interp(tt, dl, seg[:, 1])]
        topr = np.c_[ring[:, 0], np.full(n, -0.001), ring[:, 1]]; botr = np.c_[ring[:, 0], np.full(n, -lift), ring[:, 1]]
        ct, cb = np.array([cen[0], -0.001, cen[1]]), np.array([cen[0], -lift, cen[1]])
        pts = np.r_[topr, botr, [ct], [cb]]; tr = []
        for i in range(n):
            j = (i + 1) % n; tr += [[i, j, n + i], [j, n + j, n + i], [2 * n, j, i], [2 * n + 1, n + i, n + j]]
        A_ = np.array(tr); a, b, d_ = pts[A_[0]]
        if np.cross(b - a, d_ - a) @ (a - ct) < 0: A_ = A_[:, ::-1]
        out.add(pts, A_)
        H = c['HN']; tf = c['tf']; m = 'L' if s == 'R' else 'R'
        t1, t2 = tf(H['toe1-1.' + m]), tf(H['toe2-1.' + m]); post = (t1 + t2) / 2; post = np.array([post[0], 0.0, post[2] + 0.008])
        zmid = c['J']['foot' + s][2] + 0.03
        for side in (-1, 1):
            k = np.argmin(np.abs(ring[:, 1] - zmid) + (np.sign(ring[:, 0] - cen[0]) != side) * 9); end = np.array([ring[k, 0], -0.004, ring[k, 1]])
            path = [[post[0], -0.003, post[2]]]
            for u in np.linspace(0, 1, 14):
                x = post[0] + (end[0] - post[0]) * u ** 1.2; z = post[2] + (end[2] - post[2]) * u ** 0.85
                y = max(top_of_foot(x, z), 0.0) + 0.005 if u < 0.9 else -0.004 + (path[-1][1] + 0.004) * 0.35
                path.append([x, y, z])
            path[1][1] = max(path[1][1], 0.013); path = np.array(path); ringn = 8; pp = []
            # a flat band: carry one "up" along the path so the band never twists
            up = np.array([side * 1.0, 0.25, 0.0]); up /= np.linalg.norm(up)
            for i, p_ in enumerate(path):
                t_ = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]; t_ /= np.linalg.norm(t_) + 1e-9
                up = up - (up @ t_) * t_; up /= np.linalg.norm(up) + 1e-9; wd = np.cross(t_, up)
                for q in range(ringn): an = q / ringn * 6.2832; pp.append(p_ + wd * np.cos(an) * 0.0075 + up * np.sin(an) * 0.0026)
            tr = []
            for i in range(len(path) - 1):
                for q in range(ringn):
                    a0, a1 = i * ringn + q, i * ringn + (q + 1) % ringn; tr += [[a0, a0 + ringn, a1], [a1, a0 + ringn, a1 + ringn]]
            out.add(np.array(pp), np.array(tr))
    return out.done()

def skirt(c, L, pk, info, color):
    V0, VT, F, G = mh.base(); si, sw, M = build.bone_weights(); P = c['P']
    cut = L['yKnee'] + 0.02; tris = []; vmap = {}
    for (vi, ti), g in zip(F, G):
        if g != 'helper-skirt' or min(P[v][1] for v in vi) < cut: continue
        ids = [vmap.setdefault(v, len(vmap)) for v in vi]
        for k in range(1, len(ids) - 1): tris += [ids[0], ids[k], ids[k + 1]]
    vs = np.array(sorted(vmap, key=vmap.get)); pos = P[vs].copy()
    cen = np.array([0, 0, L['zHip']]); t = sstep(L['yHip'] + 0.09, cut, pos[:, 1]); d = pos - cen; d[:, 1] = 0; pos += d * (0.03 + 0.1 * t)[:, None]
    # a skirt hangs from the hips: give every vertex a good share of the hip bone so the cloth doesn't split when one leg lifts
    ssi = np.zeros((len(vs), 4), np.uint8); ssw = np.zeros((len(vs), 4), np.uint8); hb = build.BI['hips']
    for i, v in enumerate(vs):
        w = {int(b): float(x) * 0.5 for b, x in zip(si[v], sw[v].astype(float) / 255) if x > 0}; w[hb] = w.get(hb, 0) + 0.5
        top = sorted(w.items(), key=lambda t: -t[1])[:4]; tot = sum(x for _, x in top); q = [int(round(x / tot * 255)) for _, x in top]; q[0] += 255 - sum(q)
        for k, ((b, _), qq) in enumerate(zip(top, q)): ssi[i, k] = b; ssw[i, k] = qq
    pk.add(c['id'] + '.skirt.pos', pos.astype(np.float32), 3); pk.add(c['id'] + '.skirt.idx', np.array(tris, np.uint16)); pk.add(c['id'] + '.skirt.si', ssi, 4); pk.add(c['id'] + '.skirt.sw', ssw, 4)
    info['wear'][c['id']]['skirt'] = color

def run(only=None):
    topo, pk, info, chars = build.main(only)
    for cid, c in chars.items():
        st = tex.STYLE[cid]; ex = build_wear(c, pk, info)
        kb1 = tex.save(tex.paint_head(c, st), build.OUT + cid + '_head.webp'); kb2 = tex.save(tex.paint_body(c, st, underpaint(ex)), build.OUT + cid + '_body.webp')
        print(cid, 'head', kb1, 'KB body', kb2, 'KB')
    return topo, pk, info, chars

if __name__ == '__main__':
    topo, pk, info, chars = run(sys.argv[1:] or None); build.finish(pk, info)
