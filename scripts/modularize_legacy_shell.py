"""Extract legacy dashboard inline CSS/JS into cacheable production assets."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "custom_components/dashboardmodern/frontend/legacy"
ASSETS = ROOT / "assets"
ROOT_BRAND = ROOT / "brand"
INTEGRATION_BRAND = ROOT / "custom_components/dashboardmodern/brand"
VARIANTS = {
    "dashboard.html": "it",
    "dashboard-en.html": "en",
}

STYLE_RE = re.compile(
    r"<style(?P<attrs>[^>]*)>(?P<body>.*?)</style>",
    re.IGNORECASE | re.DOTALL,
)
SCRIPT_RE = re.compile(
    r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)


def _script_name(index: int, attrs: str, locale: str) -> str:
    if "data-dashboardmodern-bootstrap-watchdog" in attrs:
        return f"dashboard-watchdog-{locale}.js"
    return {
        5: f"dashboard-debug-{locale}.js",
        8: f"dashboard-theme-{locale}.js",
        10: f"dashboard-runtime-{locale}.js",
    }.get(index, f"dashboard-inline-{locale}-{index}.js")


def extract_variant(filename: str, locale: str) -> None:
    path = LEGACY / filename
    html = path.read_text(encoding="utf-8")

    styles = list(STYLE_RE.finditer(html))
    if styles:
        css = "\n\n".join(
            match.group("body").strip()
            for match in styles
            if match.group("body").strip()
        )
        css_path = LEGACY / f"dashboard-runtime-{locale}.css"
        css_path.write_text(
            f"/* Extracted from {filename}; "
            "section overrides live in src/sections. */\n"
            f"{css}\n",
            encoding="utf-8",
        )
        first = True

        def replace_style(_match: re.Match[str]) -> str:
            nonlocal first
            if first:
                first = False
                return (
                    '<link rel="stylesheet" '
                    f'href="./dashboard-runtime-{locale}.css">'
                )
            return ""

        html = STYLE_RE.sub(replace_style, html)

    script_index = 0

    def replace_script(match: re.Match[str]) -> str:
        nonlocal script_index
        index = script_index
        script_index += 1
        attrs = match.group("attrs")
        body = match.group("body")
        if re.search(r"\bsrc\s*=", attrs, re.IGNORECASE) or not body.strip():
            return match.group(0)
        output_name = _script_name(index, attrs, locale)
        (LEGACY / output_name).write_text(
            f"/* Extracted from {filename}; "
            "feature changes belong in src/sections. */\n"
            f"{body.strip()}\n",
            encoding="utf-8",
        )
        kept_attrs = attrs.rstrip()
        return f'<script{kept_attrs} src="./{output_name}"></script>'

    html = SCRIPT_RE.sub(replace_script, html)
    path.write_text(html, encoding="utf-8")


def sync_brand_assets() -> None:
    """Keep HACS root and Home Assistant local brand assets canonical."""
    for directory in (ROOT_BRAND, INTEGRATION_BRAND):
        directory.mkdir(parents=True, exist_ok=True)
        for name in ("icon.png", "icon@2x.png", "logo.png", "logo@2x.png"):
            shutil.copyfile(ASSETS / name, directory / name)


if __name__ == "__main__":
    for variant, locale_code in VARIANTS.items():
        extract_variant(variant, locale_code)
    sync_brand_assets()
