# Convert /tmp/shot-*.png to JPEG <=256KiB in screenshots/ (names from shots.json).
import json, os
from PIL import Image
mapping = {'cover': '1-chase.jpg', 'street': '2-street.jpg', 'police': '3-police.jpg', 'mission': '4-mission.jpg'}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')
os.makedirs(out, exist_ok=True)
for name, fname in mapping.items():
    src = f'/tmp/shot-{name}.png'
    dst = os.path.join(out, fname)
    im = Image.open(src).convert('RGB')
    q = 88
    while q >= 40:
        im.save(dst, 'JPEG', quality=q, optimize=True)
        if os.path.getsize(dst) <= 262144:
            break
        q -= 8
    print(fname, os.path.getsize(dst), 'bytes q=', q, im.size)
