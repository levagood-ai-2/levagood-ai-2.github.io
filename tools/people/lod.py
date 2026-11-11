# A light copy of each person for when they are far away: the same body thinned to a few thousand triangles,
# with the painted skin and clothes baked into vertex colors and the same bones.
import os
import sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from scipy.spatial import cKDTree
import fast_simplification as fs
import mh, build, tex

def vertex_colors(c):
    """The color of every original vertex, read from the finished textures (clothes over skin)."""
    topo = build.topology(); cid = c['id']; col = np.zeros((mh.NV, 3)); col[:] = tex.hexc(tex.STYLE[cid]['skin'])
    def sample(path, uv): im = np.asarray(Image.open(path).convert('RGBA'), float) / 255; H, W = im.shape[:2]; return im[np.clip(((1 - uv[:, 1]) * H).astype(int), 0, H - 1), np.clip((uv[:, 0] * W).astype(int), 0, W - 1)]
    hd, bd = topo['head'], topo['body']
    hs = hd['idx'].reshape(-1)[:hd['ranges']['skin'][1]]; hv = np.unique(hs); col[hd['orig'][hv]] = sample(build.OUT + cid + '_head.webp', hd['uv'][hv])[:, :3]
    bv = np.arange(len(bd['orig'])); b = sample(build.OUT + cid + '_body.webp', bd['uv']); w = sample(build.OUT + cid + '_wear.webp', bd['uv'])
    cb = np.where(w[:, 3:4] > 0.5, w[:, :3], b[:, :3]); col[bd['orig'][bv]] = cb
    return col

def build_lod(c, pk, info, target=3000):
    topo = build.topology(); si, sw, M = build.bone_weights(); P = c['P']; cid = c['id']
    hd = topo['head']; hs = hd['orig'][hd['idx'].reshape(-1)[:hd['ranges']['skin'][1]].reshape(-1, 3)]
    tris = np.concatenate([topo['body']['orig'][topo['body']['idx']], hs]); used = np.unique(tris); loc = np.zeros(mh.NV, int); loc[used] = np.arange(len(used))
    pts, faces = fs.simplify(P[used].astype(np.float32), loc[tris].astype(np.int32), target_count=target)
    d, j = cKDTree(P[used]).query(pts); ov = used[j]; col = vertex_colors(c)[ov]
    pk.add(cid + '.lod.pos', np.asarray(pts, np.float32), 3); pk.add(cid + '.lod.idx', np.asarray(faces, np.uint16).reshape(-1)); pk.add(cid + '.lod.si', si[ov], 4); pk.add(cid + '.lod.sw', sw[ov], 4)
    pk.add(cid + '.lod.col', np.clip(np.round(col * 255), 0, 255).astype(np.uint8), 3)
    print('  lod', cid, 'verts', len(pts), 'tris', len(faces))

def run(only=None):
    import hair
    topo, pk, info, chars = hair.run(only)
    for cid, c in chars.items(): build_lod(c, pk, info)
    return topo, pk, info, chars

if __name__ == '__main__':
    topo, pk, info, chars = run(sys.argv[1:] or None); build.finish(pk, info)
