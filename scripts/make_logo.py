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

# Palette
DEEP = (11, 16, 38)  # #0b1026 deep space
MID = (30, 58, 138)  # #1e3a8a indigo
SKY = (14, 165, 233)  # #0ea5e9 electric blue
CYAN = (34, 211, 238)  # #22d3ee bolt head
LIME = (163, 230, 53)  # #a3e635 bolt tail
WHITE = (255, 255, 255)


def _diag_gradient(size: int) -> Image.Image:
    """Deep-space diagonal gradient DEEP -> MID -> SKY."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    t = np.clip((x + y) / (2 * size), 0, 1)
    stops = [(0.0, DEEP), (0.55, MID), (1.0, SKY)]
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
    """Faint circuit traces with glowing nodes, bottom-left biased."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = size / 512.0
    col = (*CYAN, 46)
    node = (*CYAN, 120)
    w = max(2, int(3 * s))
    paths = [
        [(40, 470), (40, 380), (110, 310)],
        [(90, 500), (170, 500), (230, 440)],
        [(470, 60), (470, 140), (410, 200)],
        [(500, 250), (430, 250), (400, 285)],
    ]
    for pts in paths:
        pts = [(int(px * s), int(py * s)) for px, py in pts]
        d.line(pts, fill=col, width=w, joint="curve")
        r = int(6 * s)
        cx, cy = pts[-1]
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=node)
    return layer.filter(ImageFilter.GaussianBlur(max(1, int(1 * s))))


def _house_bolt(size: int) -> Image.Image:
    """Minimal white house stroke + neon gradient bolt with glow."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = size / 512.0
    w = max(6, int(20 * s))

    # House: open outline (roof apex high, walls, floor open at center)
    apex = (256, 96)
    l_e, r_e = (116, 226), (396, 226)  # eaves
    l_b, r_b = (136, 400), (376, 400)  # base
    house = (*WHITE, 235)
    d.line(
        [l_b, (l_e[0], l_e[1] + 4), apex, (r_e[0], r_e[1] + 4), r_b],
        fill=house,
        width=w,
        joint="curve",
    )
    d.line([(l_b[0] - w // 2 + 1, 400), (208, 400)], fill=house, width=w)
    d.line([(304, 400), (r_b[0] + w // 2 - 1, 400)], fill=house, width=w)
    for px, py in [apex, l_b, r_b]:
        r = w // 2
        d.ellipse(
            (px * s - r, py * s - r, px * s + r, py * s + r)
            if False
            else (px - r, py - r, px + r, py + r),
            fill=house,
        )

    # Bolt through the doorway gap
    bolt_pts = [
        (283, 178),
        (222, 302),
        (262, 302),
        (229, 452),
        (322, 288),
        (277, 288),
        (312, 178),
    ]
    bolt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bolt)
    bd.polygon([(int(px * s), int(py * s)) for px, py in bolt_pts], fill=(*CYAN, 255))
    # vertical gradient CYAN->LIME inside the bolt
    grad = np.zeros((size, size, 4), dtype=np.uint8)
    yy = np.mgrid[0:size, 0:size][0] / size
    for ch in range(3):
        grad[..., ch] = (CYAN[ch] + (LIME[ch] - CYAN[ch]) * yy).astype(np.uint8)
    grad[..., 3] = 255
    bolt_col = Image.fromarray(grad, "RGBA")
    bolt_only = Image.composite(
        bolt_col, Image.new("RGBA", (size, size), (0, 0, 0, 0)), bolt.split()[3]
    )
    glow = bolt_only.filter(ImageFilter.GaussianBlur(int(14 * s)))

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # scale house layer drawn in 512-space
    if size != 512:
        layer = layer.resize((size, size), Image.LANCZOS)
    out.alpha_composite(glow)
    out.alpha_composite(glow)
    out.alpha_composite(layer)
    out.alpha_composite(bolt_only)
    return out


def make_icon(size: int) -> Image.Image:
    base = 512
    tile = _diag_gradient(base)
    tile.alpha_composite(_circuit_layer(base))
    hb = _house_bolt(base)
    tile.alpha_composite(hb)
    # inner top-light border
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle(
        (1, 1, base - 2, base - 2),
        int(base * 0.26),
        outline=(255, 255, 255, 34),
        width=2,
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
