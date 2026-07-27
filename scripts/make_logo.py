"""Generate the DashboardModern brand assets (icon + wordmark lockup).

Futuristic mark: deep-space gradient tile, faint circuit traces, a minimal
white house outline and a neon energy bolt with glow. Outputs every size the
project needs: the in-app logo, the repo/HACS icons and the wide lockup.

Run:  python3 scripts/make_logo.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "custom_components" / "dashboardmodern" / "frontend" / "legacy"
ASSETS = ROOT / "assets"

# Palette — the dashboard's own colors (hero cards, brand accents).
TOP = (86, 197, 250)  # light sky, top
MID = (32, 156, 238)  # #0ea5e9-ish mid
DEEPBLU = (3, 105, 161)  # #0369a1 hero bottom
AMBER1 = (253, 224, 71)  # #fde047 bolt top
AMBER2 = (245, 158, 11)  # #f59e0b bolt bottom
SKY = (14, 165, 233)
CYAN = (34, 211, 238)
WHITE = (255, 255, 255)


def _diag_gradient(size: int) -> Image.Image:
    """The dashboard hero gradient: light sky down to deep blue."""
    y, _x = np.mgrid[0:size, 0:size].astype(np.float64)
    t = np.clip(y / size, 0, 1)
    stops = [(0.0, TOP), (0.52, MID), (1.0, DEEPBLU)]
    img = np.zeros((size, size, 3), dtype=np.float64)
    for (t0, c0), (t1, c1) in zip(stops, stops[1:], strict=False):
        m = (t >= t0) & (t <= t1)
        f = np.zeros_like(t)
        f[m] = (t[m] - t0) / (t1 - t0)
        for ch in range(3):
            img[..., ch][m] = c0[ch] + (c1[ch] - c0[ch]) * f[m]
    return Image.fromarray(img.astype(np.uint8), "RGB").convert("RGBA")


def _rounded_mask(size: int, radius: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius, fill=255)
    return m


def _circuit_layer(size: int) -> Image.Image:
    """Faint mirrored circuit traces with glowing nodes in the corners."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = size / 512.0
    col = (*CYAN, 42)
    node = (*CYAN, 110)
    w = max(2, int(3 * s))
    base_paths = [
        [(36, 486), (36, 396), (96, 336)],
        [(84, 508), (168, 508), (216, 460)],
    ]
    paths = base_paths + [[(512 - x, 512 - y) for x, y in pts] for pts in base_paths]
    for pts in paths:
        pp = [(int(px * s), int(py * s)) for px, py in pts]
        d.line(pp, fill=col, width=w, joint="curve")
        r = int(6 * s)
        cx, cy = pp[-1]
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=node)
    return layer.filter(ImageFilter.GaussianBlur(max(1, int(1 * s))))


def _house_bolt(size: int) -> Image.Image:
    """Symmetric white house stroke + centered neon bolt with glow."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = size / 512.0
    w = max(6, int(21 * s))
    cx = 256

    # House, mirror-symmetric around cx: apex high, eaves, base with a
    # centered doorway gap for the bolt.
    apex = (cx, 92)
    l_e, r_e = (cx - 138, 224), (cx + 138, 224)
    l_b, r_b = (cx - 118, 398), (cx + 118, 398)
    gap = 46  # half-width of the doorway gap
    house = (*WHITE, 238)

    def pt(pair: tuple[int, int]) -> tuple[int, int]:  # scale a 512-space point
        return (int(pair[0] * s), int(pair[1] * s))

    d.line(
        [pt(l_b), pt(l_e), pt(apex), pt(r_e), pt(r_b)],
        fill=house,
        width=w,
        joint="curve",
    )
    d.line([pt(l_b), pt((cx - gap, 398))], fill=house, width=w)
    d.line([pt((cx + gap, 398)), pt(r_b)], fill=house, width=w)
    r = w // 2
    for px, py in (apex, l_b, r_b, (cx - gap, 398), (cx + gap, 398)):
        x, y = pt((px, py))
        d.ellipse((x - r, y - r, x + r, y + r), fill=house)

    # Bolt: symmetric silhouette centered on cx, tip landing in the doorway.
    bolt_pts = [
        (cx + 26, 168),
        (cx - 40, 296),
        (cx - 4, 296),
        (cx - 26, 444),
        (cx + 40, 300),
        (cx + 4, 300),
        (cx + 26, 168),
    ]
    bolt = Image.new("L", (size, size), 0)
    ImageDraw.Draw(bolt).polygon([pt(q) for q in bolt_pts], fill=255)
    grad = np.zeros((size, size, 4), dtype=np.uint8)
    yy = np.mgrid[0:size, 0:size][0] / size
    for ch in range(3):
        grad[..., ch] = (AMBER1[ch] + (AMBER2[ch] - AMBER1[ch]) * yy).astype(np.uint8)
    grad[..., 3] = 255
    bolt_only = Image.composite(
        Image.fromarray(grad, "RGBA"),
        Image.new("RGBA", (size, size), (0, 0, 0, 0)),
        bolt,
    )
    glow = bolt_only.filter(ImageFilter.GaussianBlur(int(15 * s)))

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(glow)
    out.alpha_composite(layer)
    out.alpha_composite(bolt_only)
    return out


def make_icon(size: int) -> Image.Image:
    base = 1024
    tile = _diag_gradient(base)
    tile.alpha_composite(_circuit_layer(base))
    tile.alpha_composite(_house_bolt(base))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle(
        (2, 2, base - 3, base - 3),
        int(base * 0.26),
        outline=(255, 255, 255, 32),
        width=3,
    )
    mask = _rounded_mask(base, int(base * 0.26))
    out = Image.new("RGBA", (base, base), (0, 0, 0, 0))
    out.paste(tile, (0, 0), mask)
    if size != base:
        out = out.resize((size, size), Image.LANCZOS)
    return out


def make_lockup(height: int = 512) -> Image.Image:
    """Wide transparent lockup: icon + DASHBOARD / MODERN wordmark."""
    icon = make_icon(height - 64)
    font_path = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
    f1 = ImageFont.truetype(font_path, int(height * 0.30))
    f2 = ImageFont.truetype(font_path, int(height * 0.30))

    def text_w(f: ImageFont.FreeTypeFont, t: str, ls: int) -> int:
        return sum(f.getbbox(c)[2] - f.getbbox(c)[0] + ls for c in t)

    ls1, ls2 = int(height * 0.015), int(height * 0.06)
    w1 = text_w(f1, "DASHBOARD", ls1)
    w2 = text_w(f2, "MODERN", ls2)
    tw = max(w1, w2)
    W = icon.width + int(height * 0.12) + tw + int(height * 0.06)
    img = Image.new("RGBA", (W, height), (0, 0, 0, 0))
    img.alpha_composite(icon, (0, 32))
    d = ImageDraw.Draw(img)
    x0 = icon.width + int(height * 0.12)

    def draw_spaced(  # noqa: PLR0913
        x: int,
        y: int,
        t: str,
        f: ImageFont.FreeTypeFont,
        ls: int,
        fills: object,
    ) -> None:
        for i, c in enumerate(t):
            fill = fills(i / max(1, len(t) - 1))
            d.text((x, y), c, font=f, fill=fill)
            bb = f.getbbox(c)
            x += (bb[2] - bb[0]) + ls

    y1 = int(height * 0.14)
    y2 = int(height * 0.50)
    draw_spaced(x0, y1, "DASHBOARD", f1, ls1, lambda t: (23, 37, 84, 255))
    draw_spaced(
        x0,
        y2,
        "MODERN",
        f2,
        ls2,
        lambda t: (
            *(int(CYAN[c] + (SKY[c] - CYAN[c]) * t) for c in range(3)),
            255,
        ),
    )
    return img


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    make_icon(512).save(LEGACY / "logo.png")
    make_icon(256).save(LEGACY / "icon.png")
    make_icon(256).save(ASSETS / "icon.png")
    make_icon(512).save(ASSETS / "icon@2x.png")
    lock = make_lockup(256)
    lock.save(ASSETS / "logo.png")
    make_lockup(512).save(ASSETS / "logo@2x.png")
    print("brand rigenerato:", LEGACY / "logo.png", ASSETS)


if __name__ == "__main__":
    main()
