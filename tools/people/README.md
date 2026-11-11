# How the park's people are made

The people in the 3D park (`pool/people/`) are built offline by the scripts in this folder and loaded by `pool/park-people.js`.

The body shapes come from the MakeHuman base mesh, shape targets, skeleton and skin weights as shipped in MPFB2
(https://github.com/makehumancommunity/mpfb2). Those assets are released under CC0, so nothing here needs a license notice;
this note is so the next person knows where the shapes came from.

What each script does:

- `mh.py` reads the base mesh, targets and rig, and turns a set of sliders (age, build, and so on) into a body.
- `build.py` sets each person in a standing rest pose, folds the rig into the park's small skeleton, bakes soft shading, packs face shapes.
- `tex.py` paints the skin: lips, brows, lashes, freckles, hairline, nails.
- `wear.py` cuts the clothes from the body's own surface, and makes sandals and sneakers.
- `hair.py` grows hair and hats on each head.
- `lod.py` makes the light far-away copy of each person, and runs everything.

To rebuild: `pip install numpy scipy pillow trimesh embreex fast-simplification`, clone MPFB2, then

    MPFB_DATA=/path/to/mpfb2/src/mpfb/data python3 tools/people/lod.py

It writes `pool/people/people.bin` and the `.webp` skins. Who wears what is in `wear.py` (`outfit`), hair is in `hair.py` (`HAIR`),
and body sliders are in `build.py` (`CHARS`).
