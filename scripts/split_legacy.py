#!/usr/bin/env python3
"""Split vendored monolithic dashboards into HTML shells and runtime assets."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "custom_components/dashboardmodern/frontend/legacy"
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

# Inline script positions are part of the pinned upstream document structure.
# Naming unexpected positions would silently change the committed asset tree, so
# fail and require an intentional splitter update when upstream changes.
SCRIPT_NAMES = {
    5: "dashboard-debug-{locale}.js",
    8: "dashboard-theme-{locale}.js",
    10: "dashboard-runtime-{locale}.js",
}


class SplitError(RuntimeError):
    """Raised when a monolith no longer has the audited structure."""


def _script_name(index: int, attrs: str, locale: str) -> str:
    if "data-dashboardmodern-bootstrap-watchdog" in attrs:
        return f"dashboard-watchdog-{locale}.js"
    pattern = SCRIPT_NAMES.get(index)
    if pattern is None:
        raise SplitError(f"unexpected inline script at index {index} ({locale})")
    return pattern.format(locale=locale)


def split_variant(filename: str, locale: str) -> None:
    """Extract one patched monolith, refusing partially split input."""
    path = LEGACY / filename
    html = path.read_text(encoding="utf-8")
    if f'./dashboard-runtime-{locale}.css' in html:
        raise SplitError(f"{filename} is already split")

    styles = list(STYLE_RE.finditer(html))
    if not styles:
        raise SplitError(f"{filename} contains no inline styles")
    css = "\n\n".join(
        match.group("body").strip()
        for match in styles
        if match.group("body").strip()
    )
    (LEGACY / f"dashboard-runtime-{locale}.css").write_text(
        f"/* Extracted from {filename}; section overrides live in src/sections. */\n"
        f"{css}\n",
        encoding="utf-8",
    )

    first_style = True

    def replace_style(_match: re.Match[str]) -> str:
        nonlocal first_style
        if first_style:
            first_style = False
            return f'<link rel="stylesheet" href="./dashboard-runtime-{locale}.css">'
        return ""

    html = STYLE_RE.sub(replace_style, html)
    script_index = 0
    extracted: set[str] = set()

    def replace_script(match: re.Match[str]) -> str:
        nonlocal script_index
        index = script_index
        script_index += 1
        attrs = match.group("attrs")
        body = match.group("body")
        if re.search(r"\bsrc\s*=", attrs, re.IGNORECASE) or not body.strip():
            return match.group(0)
        output_name = _script_name(index, attrs, locale)
        if output_name in extracted:
            raise SplitError(f"duplicate output asset {output_name}")
        extracted.add(output_name)
        (LEGACY / output_name).write_text(
            f"/* Extracted from {filename}; "
            "feature changes belong in src/sections. */\n"
            f"{body.strip()}\n",
            encoding="utf-8",
        )
        return f'<script{attrs.rstrip()} src="./{output_name}"></script>'

    html = SCRIPT_RE.sub(replace_script, html)
    expected = {
        f"dashboard-debug-{locale}.js",
        f"dashboard-theme-{locale}.js",
        f"dashboard-watchdog-{locale}.js",
        f"dashboard-runtime-{locale}.js",
    }
    if extracted != expected:
        raise SplitError(
            f"{filename}: expected {sorted(expected)}, extracted {sorted(extracted)}"
        )
    path.write_text(html, encoding="utf-8")


def main() -> int:
    """Split both language variants."""
    try:
        for filename, locale in VARIANTS.items():
            split_variant(filename, locale)
    except SplitError as error:
        print(f"error: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
