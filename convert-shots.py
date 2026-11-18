#!/usr/bin/env python3
"""Convert the headless-shell PNG screenshots in screenshots/ to JPEG (quality 82,
dropping quality until each file is <= 250 KiB) and delete the PNG originals.
Run from the build dir:  python3 convert-shots.py
"""
import sys
from pathlib import Path

from PIL import Image

SHOTS = Path(__file__).resolve().parent / "screenshots"
LIMIT = 250 * 1024


def main() -> int:
    pngs = sorted(SHOTS.glob("*.png"))
    if not pngs:
        print("no PNG screenshots found in", SHOTS)
        return 1
    for png in pngs:
        img = Image.open(png).convert("RGB")
        out = png.with_suffix(".jpg")
        quality = 82
        while quality >= 40:
            img.save(out, "JPEG", quality=quality, optimize=True)
            if out.stat().st_size <= LIMIT:
                break
            quality -= 6
        print(f"{out.name}: {out.stat().st_size // 1024} KiB @ quality {quality} "
              f"(was {png.stat().st_size // 1024} KiB PNG)")
        png.unlink()
    return 0


if __name__ == "__main__":
    sys.exit(main())
