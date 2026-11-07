"""Draws the Director Kollo logo (orange circle, purple camera) as app icons.
Run:  python tools/make-icons.py      (needs:  pip install pillow)
It writes public/icons/icon-32.png, icon-192.png and icon-512.png with a TRANSPARENT background (the round logo only).
The maskable icons (full orange square) and the iPhone icon are kept opaque on purpose: Android crops maskable icons to its own
shape and iPhones fill transparent areas with black, so both need a solid background."""
from PIL import Image, ImageDraw
import os

ORANGE = (245, 154, 31)
PURPLE = (75, 34, 176)
WHITE = (255, 255, 255)

def logo(size):
    S = size * 8                       # draw big, then shrink, for smooth edges
    k = S / 64                         # the logo is designed on a 64 x 64 grid
    # transparent, but filled with the orange colour so shrinking never makes a dark or white fringe
    im = Image.new('RGBA', (S, S), ORANGE + (0,))
    d = ImageDraw.Draw(im)
    box = lambda x, y, w, h: [x * k, y * k, (x + w) * k, (y + h) * k]
    circle = lambda cx, cy, r, c: d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=c + (255,))
    circle(32, 32, 31, ORANGE)                                                         # the round badge
    d.rounded_rectangle(box(14, 22, 36, 26), radius=5 * k, fill=PURPLE + (255,))       # camera body
    d.rounded_rectangle(box(21, 17, 12, 7), radius=2 * k, fill=PURPLE + (255,))        # top bump
    d.rounded_rectangle(box(40, 25, 6, 3), radius=1.5 * k, fill=ORANGE + (255,))       # flash
    circle(32, 36, 9, WHITE)                                                           # lens ring
    circle(32, 36, 5.5, PURPLE)                                                        # lens
    circle(30, 34, 1.6, WHITE)                                                         # glint
    im = im.resize((size, size), Image.LANCZOS)
    # the only semi-transparent pixels are the soft edge of the orange badge: make sure they are exactly orange
    px = im.load()
    for y in range(size):
        for x in range(size):
            a = px[x, y][3]
            if 0 < a < 255:
                px[x, y] = ORANGE + (a,)
    return im

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
for s in (32, 192, 512):
    logo(s).save(os.path.join(out, f'icon-{s}.png'), optimize=True)
    print('wrote icon-%d.png' % s)
