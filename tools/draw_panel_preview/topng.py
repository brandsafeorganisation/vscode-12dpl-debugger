#!/usr/bin/env python3
"""Replay the preview's .draw snapshots (a frame's draw calls, in order) into .png files."""
import glob, os, sys
from PIL import Image, ImageDraw, ImageFont

FONTS = ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']


def font(size):
    for f in FONTS:
        if os.path.exists(f):
            return ImageFont.truetype(f, max(6, int(round(size * 0.8))))
    return ImageFont.load_default()


for path in sorted(glob.glob(os.path.join(sys.argv[1], '*.draw'))):
    lines = open(path, encoding='utf-8', errors='replace').read().split('\n')
    w, h = map(int, lines[0].split())
    im = Image.new('RGB', (w, h), (255, 0, 255))
    d = ImageDraw.Draw(im)
    for line in lines[1:]:
        if not line:
            continue
        op, rest = line.split(' ', 1)
        if op == 'text':
            head, text = rest.split('\t', 1)
            r, g, b, x, y, size, al = head.split()
            # Windows TA_* flags: TA_CENTER 6, TA_RIGHT 2; TA_BOTTOM 8, TA_BASELINE 24 (else the top is at y)
            al = int(al)
            across = 'm' if al & 6 == 6 else ('r' if al & 2 else 'l')
            down = 's' if al & 24 == 24 else ('d' if al & 8 else 'a')
            d.text((float(x), h - float(y)), text, fill=(int(r), int(g), int(b)), font=font(float(size)), anchor=across + down)
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
