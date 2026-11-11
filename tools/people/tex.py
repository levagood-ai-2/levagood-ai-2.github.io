# Paints the skins. Every texel knows where it sits on the body (position, normal, how open it is to the sky),
# so color is laid down by place: warm cheeks, a darker crease, lips, brows that follow the brow, a lash line, a hairline.
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import scipy.ndimage as nd
import mh, build

HW, HH = 1024, 2048        # the head has its own texture
BW, BH = 2048, 2048        # torso, limbs, hands and feet share one
CACHE = os.environ.get('PEOPLE_CACHE', '/tmp/') + ('' if os.environ.get('PEOPLE_CACHE', '/tmp/').endswith('/') else '/')

def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
def mix(a, b, t):
    a = np.asarray(a, float); b = np.asarray(b, float); t = np.asarray(t, float)
    if t.ndim == 1 and (a.ndim == 2 or b.ndim == 2): t = t[:, None]
    return a * (1 - t) + b * t
def sstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def raster(uv, tris, W, H, tag):
    path = CACHE + 'rast_%s_%d_%d_%d.npz' % (tag, W, H, len(tris))
    if os.path.exists(path): d = np.load(path); return d['tid'], d['bary']
    tid = -np.ones((H, W), np.int32); bary = np.zeros((H, W, 3), np.float32)
    px = uv[:, 0] * W - 0.5; py = (1 - uv[:, 1]) * H - 0.5
    for t, (a, b, c) in enumerate(tris):
        x0, y0, x1, y1, x2, y2 = px[a], py[a], px[b], py[b], px[c], py[c]
        minx = max(int(np.floor(min(x0, x1, x2))), 0); maxx = min(int(np.ceil(max(x0, x1, x2))), W - 1)
        miny = max(int(np.floor(min(y0, y1, y2))), 0); maxy = min(int(np.ceil(max(y0, y1, y2))), H - 1)
        if maxx < minx or maxy < miny: continue
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-12: continue
        X, Y = np.meshgrid(np.arange(minx, maxx + 1), np.arange(miny, maxy + 1))
        l0 = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / den; l1 = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / den; l2 = 1 - l0 - l1
        m = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
        if not m.any(): continue
        sub = tid[miny:maxy + 1, minx:maxx + 1]; sub[m] = t
        sb = bary[miny:maxy + 1, minx:maxx + 1]; sb[m] = np.stack([l0[m], l1[m], l2[m]], -1)
    np.savez_compressed(path, tid=tid, bary=bary)
    return tid, bary

class Tex:
    """A texture's worth of surface points for one mesh: which triangle each texel is in and where in it."""
    def __init__(self, mesh, groups, W, H, tag):
        tr = np.concatenate([mesh['idx'].reshape(-1)[a:a + n].reshape(-1, 3) for a, n in (mesh['ranges'][g] for g in groups)])
        self.W, self.H = W, H; tid, bary = raster(mesh['uv'], tr, W, H, tag)
        self.valid = tid >= 0; self.vt = mesh['orig'][tr[tid[self.valid]]]; self.b = bary[self.valid].astype(np.float64)
        self.fill = nd.distance_transform_edt(~self.valid, return_distances=False, return_indices=True)
        self.py, self.px = np.nonzero(self.valid)
    def field(self, attr):
        a = attr[self.vt]
        return (a * self.b[..., None]).sum(1) if a.ndim == 3 else (a * self.b).sum(1)
    def flat(self, img):                      # sample an H x W image at the valid texels
        return np.asarray(img)[self.py, self.px]
    def image(self, rgb, alpha=None):
        out = np.zeros((self.H, self.W, 3)); out[self.valid] = np.clip(rgb, 0, 1); out = out[self.fill[0], self.fill[1]]
        im = Image.fromarray((out * 255 + 0.5).astype(np.uint8))
        if alpha is not None:
            a = np.zeros((self.H, self.W)); a[self.valid] = np.clip(alpha, 0, 1); im.putalpha(Image.fromarray((a * 255 + 0.5).astype(np.uint8)))
        return im

def noise(P, lam, seed, n=7):
    rng = np.random.default_rng(seed); out = np.zeros(len(P))
    for i in range(n):
        k = rng.normal(size=3); k *= 2 * np.pi / (lam * (0.6 + rng.random())) / np.linalg.norm(k)
        out += np.sin(P @ k + rng.random() * 6.28)
    return out / n

_MASK = {}
def mask(name):
    if name not in _MASK: _MASK[name] = Image.open(mh.D + '/textures/mpfb_%s.jpg' % name).convert('L')
    return _MASK[name]
def head_mask(name):
    b = build.topology()['headbox']; S = 2048
    im = mask(name).crop((int(round(b[0] * S)), int(round((1 - b[3]) * S)), int(round(b[1] * S)), int(round((1 - b[2]) * S)))).resize((HW, HH), Image.BILINEAR)
    return np.asarray(im, float) / 255
def body_mask(name): return np.asarray(mask(name).resize((BW, BH), Image.BILINEAR), float) / 255

_T = {}
def texes():
    if not _T:
        topo = build.topology()
        _T['head'] = Tex(topo['head'], ['skin'], HW, HH, 'head'); _T['body'] = Tex(topo['body'], build.BODY_ORDER, BW, BH, 'body')
    return _T

def seg_dist(P, poly):
    """Distance from each point to a polyline."""
    d = np.full(len(P), 1e9)
    for a, b in zip(poly[:-1], poly[1:]):
        ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab + 1e-12), 0, 1); d = np.minimum(d, np.linalg.norm(P - (a + t[:, None] * ab), axis=1))
    return d

def head_frame(c):
    """Where things are on this head, in local units."""
    topo = build.topology(); P = c['P']; hv = np.unique(topo['head']['orig'][topo['head']['idx'].reshape(-1)[:topo['head']['ranges']['skin'][1]]])
    eL, eR = c['eyes']['L'], c['eyes']['R']; r = (eL['r'] + eR['r']) / 2
    f = dict(ex=abs(eR['c'][0] - eL['c'][0]) / 2, ey=(eL['c'][1] + eR['c'][1]) / 2, ez=(eL['c'][2] + eR['c'][2]) / 2, r=r, hv=hv)
    hp = P[hv]; f['top'] = hp[:, 1].max(); f['back'] = hp[:, 2].min(); f['halfw'] = np.abs(hp[:, 0]).max()
    mid = hp[np.abs(hp[:, 0]) < 0.3 * r]; f['nose'] = mid[np.argmax(mid[:, 2])]
    hd = topo['head']; em = head_mask('ears'); px = np.clip((hd['uv'][:, 0] * HW).astype(int), 0, HW - 1); py = np.clip(((1 - hd['uv'][:, 1]) * HH).astype(int), 0, HH - 1)
    ev = np.zeros(mh.NV); np.maximum.at(ev, hd['orig'], em[py, px]); ear = P[hv[ev[hv] > 0.5]]          # the ears, by the ear mask
    f['earY'] = ear[:, 1].mean(); f['earZ'] = ear[:, 2].mean(); f['earTop'] = ear[:, 1].max(); f['earBot'] = ear[:, 1].min(); f['earX'] = np.abs(ear[:, 0]).max()
    # skull half width above the ears, and the chin
    up = hp[hp[:, 1] > f['earTop'] + 0.5 * r]; f['skullw'] = np.abs(up[:, 0]).max(); f['front'] = up[:, 2].max()
    front = hp[(np.abs(hp[:, 0]) < 0.5 * r) & (hp[:, 2] > f['ez'] - r)]; f['chin'] = front[:, 1].min()
    return f

def hairiness(P, f, style='full', burn=0.0):
    """0..1: how much this point of the head is under hair. One smooth field, used for the scalp paint and for growing the hair.
    The line is drawn by direction around the head: level across the forehead, down in front of the ear, round behind it, down to the nape."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]; ax = np.abs(x); r = f['r']; H = f['top'] - f['ey']; zc = (f['front'] + f['back']) / 2
    v = (y - f['ey']) / H; al = np.degrees(np.arctan2(ax, z - zc))            # 0 straight ahead, 90 at the ear, 180 behind
    v0 = dict(full=0.60, high=0.66, low=0.56, receding=0.70).get(style, 0.60)
    vt = (f['earTop'] + 0.006 - f['ey']) / H; nape = f['ey'] - 0.66 * (f['ey'] - f['chin'])
    vline = v0 - (v0 - vt) * sstep(50, 80, al) ** 0.9 + (0.09 * np.exp(-((al - 36) / 13) ** 2) if style == 'receding' else 0)
    vback = (mix(f['earTop'] + 0.004, nape, sstep(98, 124, al)) - f['ey']) / H
    s = sstep(-0.025, 0.025, v - np.where(al < 80, vline, vback))
    if burn > 0:
        sb = sstep(68, 74, al) * sstep(90, 84, al) * sstep(-0.004, 0.004, y - (f['earTop'] - burn * (f['earTop'] - f['earBot'])))
        s = np.maximum(s, sb * 0.9)
    return np.clip(s, 0, 1)

STYLE = {
    'em':    dict(skin='#eec6a6', hair='#846243', freckles=0.45, blush=0.32, lip=(0.93, 0.68, 0.68), brow=0.78, kid=True),
    'mel':   dict(skin='#f1cfae', hair='#a8835a', freckles=1.0, blush=0.45, lip=(0.94, 0.70, 0.70), brow=0.72, kid=True),
    'yen':   dict(skin='#cf9a6c', hair='#241710', freckles=0, blush=0.16, lip=(0.86, 0.58, 0.58), brow=0.85),
    'gma':   dict(skin='#f0cfb4', hair='#e0e0e0', browc='#a39a92', freckles=0, blush=0.28, lipc='#b07a74', brow=0.7),
    'guard': dict(skin='#e2b48c', hair='#3a2a1c', freckles=0, blush=0.12, lip=(0.88, 0.68, 0.64), brow=1.0, burn=0.5),
    'guardf': dict(skin='#e2b48c', hair='#3a2a1c', freckles=0, blush=0.2, lip=(0.88, 0.62, 0.62), brow=0.8),
    'nutty': dict(skin='#c68642', hair='#2a1a12', freckles=0, blush=0.05, lip=(0.84, 0.62, 0.6), brow=1.05, burn=0.5),
}

def shade(C, ao, s=0.9, tint=(0.56, 0.40, 0.36)):
    f = np.clip((1 - ao) * s, 0, 1)[:, None]
    return C * (1 - f * (1 - np.array(tint)))

def paint_head(c, st, debug=False):
    T = texes()['head']; f = head_frame(c); c['frame'] = f
    P = T.field(c['P']); N = T.field(c['N']); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9; ao = T.field(c['ao'])
    x, y, z = P[:, 0], P[:, 1], P[:, 2]; ax = np.abs(x); ex, ey, ez, r = f['ex'], f['ey'], f['ez'], f['r']
    skin = hexc(st['skin']); C = np.tile(skin, (len(x), 1))
    lips = T.flat(head_mask('lips')); lids = T.flat(head_mask('eyelids')); ears = T.flat(head_mask('ears'))
    # skin is not one flat color
    C *= (1 + 0.022 * noise(P, 0.05, 1) + 0.012 * noise(P, 0.006, 2))[:, None]
    facing = np.clip(N[:, 2] * 1.3, 0, 1)
    cheek = np.exp(-((ax - (ex + 0.5 * r)) ** 2 + (y - (ey - 1.95 * r)) ** 2) / (2 * (1.15 * r) ** 2)) * facing
    nose = np.exp(-((P - f['nose']) ** 2).sum(1) / (2 * (0.6 * r) ** 2))
    chin = np.exp(-((ax) ** 2 + (y - (f['chin'] + 0.6 * r)) ** 2) / (2 * (0.8 * r) ** 2)) * facing
    red = np.clip(st['blush'] * 1.7 * cheek + (0.22 + 0.5 * st['blush']) * nose + 0.34 * ears + 0.1 * chin + 0.16 * lids, 0, 0.85)
    C = mix(C, C * np.array([1.03, 0.80, 0.77]), red)
    C = shade(C, np.clip(ao + 0.35 * lids, 0, 1), 0.95)
    # lips
    lipc = hexc(st['lipc']) if st.get('lipc') else skin * np.array(st['lip'])
    C = mix(C, lipc * (0.82 + 0.18 * ao)[:, None], np.clip(lips * 1.15, 0, 0.92))
    # brows: they sit where the face moves most when the brows go up
    browc = hexc(st.get('browc', st['hair'])) * (0.62 if not st.get('browc') else 1.0)
    for sx, unit in ((1, 'eyebrows-left-up'), (-1, 'eyebrows-right-up')):
        mag = np.linalg.norm(build.morph([unit], c['race']), axis=1); m = T.field(mag); X = sx * x
        sel = (X > ex - 1.5 * r) & (X < ex + 2.0 * r) & (y > ey + 0.6 * r) & (y < ey + 2.7 * r) & (N[:, 2] > 0.1) & (m > 0.25 * m.max())
        bins = np.linspace(ex - 1.15 * r, ex + 1.6 * r, 26); bx, by = [], []
        for a, b in zip(bins[:-1], bins[1:]):
            k = sel & (X >= a) & (X < b)
            if k.sum() < 8: continue
            w = m[k] ** 6; bx.append((a + b) / 2); by.append((y[k] * w).sum() / w.sum())
        if len(bx) < 6: continue
        co = np.polyfit(bx, by, 2); t = np.clip((X - (ex - 1.15 * r)) / (2.75 * r), 0, 1)
        line = np.polyval(co, np.clip(X, ex - 1.15 * r, ex + 1.6 * r)) + r * (st.get('browlift', 0.0) - 0.16 * t ** 2)
        half = r * st['brow'] * (0.07 + 0.2 * (1 - t) ** 0.8) * sstep(0.0, 0.07, t)
        band = sstep(1.0, 0.55, np.abs(y - line) / (half + 1e-9)) * sstep(0.0, 0.05, t) * sstep(1.0, 0.86, t) * (N[:, 2] > 0.05) * (X > ex - 1.3 * r) * (X < ex + 1.75 * r)
        th = np.radians(68 - 52 * sstep(0.05, 0.6, t)); lam = 0.0011
        stroke = 0.5 + 0.5 * np.sin(2 * np.pi * (y * np.cos(th) - X * np.sin(th)) / lam + 2.2 * noise(P, 0.004, 5 + sx))
        C = mix(C, browc, np.clip(band * (0.5 + 0.5 * stroke) * 0.95, 0, 1))
        if debug: print('  brow', sx, 'bins', len(bx), 'y-ey over r at mid', (np.polyval(co, ex) - ey) / r)
    # the lash line, upper and a faint lower
    topo = build.topology(); gr = mh.groups(); V0 = mh.base()[0]
    for m_ in 'lr':
        cen = V0[gr['helper-%s-eye' % m_]].mean(0)
        for part, a in ((2, 0.85), (1, 0.28)):
            idx = gr['helper-%s-eyelashes-%d' % (m_, part)]; d0 = np.linalg.norm(V0[idx] - cen, axis=1); root = idx[d0 < d0.min() + 0.25 * (d0.max() - d0.min())]
            poly = c['P'][root]; poly = poly[np.argsort(poly[:, 0])]; near = np.linalg.norm(P - poly.mean(0), axis=1) < 2.2 * r
            d = seg_dist(P[near], poly); k = np.zeros(len(x)); k[near] = np.exp(-(d / 0.0008) ** 2) * a + np.exp(-(d / 0.0022) ** 2) * a * 0.3
            C = mix(C, np.array([0.13, 0.085, 0.07]), np.clip(k, 0, 0.9))
    # freckles
    if st.get('freckles'):
        rng = np.random.default_rng(11); w = np.exp(-((y - (ey - 1.25 * r)) / (0.95 * r)) ** 2) * np.exp(-(ax / (2.6 * r)) ** 2) * (N[:, 2] > 0.45) * (lips < 0.1) * (ao > 0.72) * (y < ey - 0.45 * r)
        n = int(260 * st['freckles']); pick = rng.choice(len(x), n, p=w / w.sum()); fk = np.zeros(len(x)); img = np.zeros((HH, HW))
        for i in pick:
            rad = 1.2 + rng.random() * 2.0; a = 0.3 + 0.4 * rng.random(); cy, cx = T.py[i], T.px[i]
            y0, y1, x0, x1 = max(cy - 5, 0), min(cy + 6, HH), max(cx - 5, 0), min(cx + 6, HW); yy, xx = np.mgrid[y0:y1, x0:x1]
            img[y0:y1, x0:x1] = np.maximum(img[y0:y1, x0:x1], a * np.exp(-((yy - cy) ** 2 + (xx - cx) ** 2) / (2 * (rad * 0.6) ** 2)))
        C = mix(C, skin * np.array([0.74, 0.52, 0.38]), T.flat(img) * 0.75)
    # the scalp under the hair
    if st.get('hair'):
        s = hairiness(P, f, st.get('hairline', 'full'), st.get('burn', 0)) * (ears < 0.2)
        edge = np.clip(s + 0.35 * (s > 0.02) * (s < 0.98) * noise(P, 0.0025, 9), 0, 1)
        hc = hexc(st['hair']) * (0.78 + 0.12 * noise(P, 0.003, 10))[:, None]
        C = mix(C, hc, sstep(0.35, 0.75, edge) * st.get('scalp', 0.94))
    return T.image(C)

def part_weights():
    _, _, M = build.bone_weights(); BI = build.BI; W = {}
    W['torso'] = sum(M[:, BI[b]] for b in ['hips', 'spine', 'spine2', 'chest', 'chest2', 'neck', 'neck2', 'head', 'clavL', 'clavR'])
    for s in 'LR':
        W['arm' + s] = sum(M[:, BI[b + s]] for b in ['arm', 'fore', 'tw']); W['hand' + s] = sum(M[:, i] for b, i in BI.items() if (b.startswith('hand') or b[0] == 'f' and b[1].isdigit()) and b.endswith(s))
        W['leg' + s] = M[:, BI['leg' + s]] + M[:, BI['shin' + s]]; W['foot' + s] = M[:, BI['foot' + s]] + M[:, BI['toe' + s]]
        W['upper' + s] = M[:, BI['arm' + s]]; W['fore' + s] = M[:, BI['fore' + s]] + M[:, BI['tw' + s]]; W['thigh' + s] = M[:, BI['leg' + s]]; W['shin' + s] = M[:, BI['shin' + s]]
    return W

def paint_body(c, st, wear=None):
    T = texes()['body']; J = c['J']
    P = T.field(c['P']); N = T.field(c['N']); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9; ao = T.field(c['ao'])
    skin = hexc(st['skin']); C = np.tile(skin, (len(P), 1))
    C *= (1 + 0.022 * noise(P, 0.07, 1) + 0.01 * noise(P, 0.008, 2))[:, None]
    W = part_weights(); red = np.zeros(len(P)); pale = np.zeros(len(P))
    for s in 'LR':
        kn = J['shin' + s] + np.array([0, 0.0, 0.05]); red += 0.26 * np.exp(-((P - kn) ** 2).sum(1) / (2 * 0.045 ** 2)) * T.field(W['leg' + s])
        el = J['fore' + s] + np.array([0, 0.0, -0.04]); red += 0.26 * np.exp(-((P - el) ** 2).sum(1) / (2 * 0.035 ** 2)) * T.field(W['arm' + s])
        hw = T.field(W['hand' + s]); n = np.array(c['hands'][s]['n']); palm = hw * sstep(0.1, 0.6, N @ n)
        pale += 0.55 * palm; red += 0.12 * hw
        fw = T.field(W['foot' + s]); sole = fw * sstep(0.3, 0.8, -N[:, 1]); pale += 0.5 * sole; red += 0.1 * fw + 0.25 * fw * np.exp(-((P[:, 1] - 0.03) / 0.03) ** 2) * (P[:, 2] < J['foot' + s][2] - 0.01)
    C = mix(C, C * np.array([1.03, 0.80, 0.77]), np.clip(red, 0, 0.6))
    C = mix(C, np.clip(skin * np.array([1.07, 0.96, 0.93]) + 0.04, 0, 1), np.clip(pale, 0, 0.7))
    C = shade(C, ao, 0.8)
    nails = np.maximum(T.flat(body_mask('fingernails')), T.flat(body_mask('toenails')))
    C = mix(C, np.clip(skin * np.array([1.05, 0.9, 0.9]) * 0.75 + 0.27, 0, 1), np.clip(nails * 1.2, 0, 0.85))
    if wear is not None: C = wear(c, T, P, N, C)
    return T.image(C)

def save(im, path, q=86):
    im.save(path, 'WEBP', quality=q, method=6); return os.path.getsize(path) // 1024

if __name__ == '__main__':
    only = sys.argv[1:] or None
    topo, pk, info, chars = build.main(only)
    for cid, c in chars.items():
        st = STYLE[cid]
        kb1 = save(paint_head(c, st, True), build.OUT + cid + '_head.webp'); kb2 = save(paint_body(c, st), build.OUT + cid + '_body.webp')
        print(cid, 'head', kb1, 'KB body', kb2, 'KB')
    build.finish(pk, info)
