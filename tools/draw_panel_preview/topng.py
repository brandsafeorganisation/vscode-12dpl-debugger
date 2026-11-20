#!/usr/bin/env python3
"""Replay the preview's .draw snapshots (a frame's draw calls, in order) into .png files."""
import glob, os, sys
from PIL import Image, ImageDraw, ImageFont

# The fonts 12d would draw with, by the name the macro asks for, and a
# scale so the stand-in is as wide as the real one. Liberation Sans at
# 104% is as wide as Segoe UI was in 12d's screenshots.
FONTS = {
    'segoe ui': [('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 1.04)],
    'inter':    [('/usr/share/fonts/opentype/inter/Inter-Regular.otf', 1.0)],
}
FALLBACK = [('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 0.95),
            ('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 1.0)]
_cache = {}


def font(name, size):
    key = (name, size)
    if key not in _cache:
        _cache[key] = ImageFont.load_default()
        for path, scale in FONTS.get(name.lower(), []) + FALLBACK:
            if os.path.exists(path):
                _cache[key] = ImageFont.truetype(path, max(6, int(round(size * scale))))
                break
    return _cache[key]


for path in sorted(glob.glob(os.path.join(sys.argv[1], '*.draw'))):
    lines = open(path, encoding='utf-8', errors='replace').read().split('\n')
    w, h = map(int, lines[0].split())
    im = Image.new('RGB', (w, h), (255, 0, 255))
    d = ImageDraw.Draw(im)
    name = 'Segoe UI'
    for line in lines[1:]:
        if not line:
            continue
        op, rest = line.split(' ', 1)
        if op == 'font':
            name = rest.split('\t', 1)[1]
            continue
        if op == 'text':
            head, text = rest.split('\t', 1)
            r, g, b, x, y, size, al = head.split()
            # Windows TA_* flags: TA_CENTER 6, TA_RIGHT 2; TA_BOTTOM 8, TA_BASELINE 24 (else the top is at y)
            al = int(al)
            across = 'm' if al & 6 == 6 else ('r' if al & 2 else 'l')
            down = 's' if al & 24 == 24 else ('d' if al & 8 else 'a')
            d.text((float(x), h - float(y)), text, fill=(int(r), int(g), int(b)), font=font(name, float(size)), anchor=across + down)
            continue
        v = rest.split()
        colour = (int(v[0]), int(v[1]), int(v[2]))
        pts = [float(t) for t in v[3:]]
        xy = [(pts[i], h - 1 - pts[i + 1]) for i in range(0, len(pts), 2)]   # y up, pixel rows down
        if op == 'clear':
            d.rectangle((0, 0, w, h), fill=colour)
        elif op == 'poly':
            d.polygon(xy, fill=colour)
        elif op == 'line':
            d.line(xy, fill=colour)
    im.save(path[:-5] + '.png')
    os.remove(path)
print('png files in', sys.argv[1])
