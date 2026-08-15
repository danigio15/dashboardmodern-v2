#!/usr/bin/env python3
"""Split vendored monoliths into shells and cacheable locale assets."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "custom_components/dashboardmodern/frontend/legacy"
VARIANTS = {"dashboard.html": "it", "dashboard-en.html": "en"}
STYLE_RE = re.compile(r"<style(?P<attrs>[^>]*)>(?P<body>.*?)</style>", re.I | re.S)
SCRIPT_RE = re.compile(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", re.I | re.S)
HEADER = "/* Extracted from {filename}; feature changes belong in src/sections. */\n"


class SplitError(RuntimeError):
    """Raised when the audited monolith structure is not present."""


def _classify_script(attrs: str, body: str) -> str:
    """Return the content-anchored role of one inline script."""
    signatures = {
        "debug": body.startswith("function toggleDebug"),
        "theme": body.startswith(
            "(function(){try{var p=localStorage.getItem('cd_theme')"
        ),
        "runtime": body.startswith("/* ═"),
        "watchdog": "data-dashboardmodern-bootstrap-watchdog" in attrs,
    }
    matches = [name for name, matched in signatures.items() if matched]
    if len(matches) != 1:
        raise SplitError(
            "inline script must match exactly one signature; "
            f"matched {matches or 'none'}"
        )
    return matches[0]


def build_variant(filename: str, locale: str, source: str) -> dict[str, str]:
    """Build every output for one variant without touching the filesystem."""
    if f"./dashboard-runtime-{locale}.css" in source:
        raise SplitError(f"{filename} is already split")
    styles = list(STYLE_RE.finditer(source))
    if not styles:
        raise SplitError(f"{filename} contains no inline styles")
    css = "\n\n".join(
        m.group("body").strip() for m in styles if m.group("body").strip()
    )
    outputs = {
        f"dashboard-runtime-{locale}.css": (
            f"/* Extracted from {filename}; "
            "section overrides live in src/sections. */\n"
            f"{css}\n"
        )
    }
    first_style = True

    def replace_style(_match: re.Match[str]) -> str:
        nonlocal first_style
        if first_style:
            first_style = False
            return f'<link rel="stylesheet" href="./dashboard-runtime-{locale}.css">'
        return ""

    shell = STYLE_RE.sub(replace_style, source)
    roles: set[str] = set()

    def replace_script(match: re.Match[str]) -> str:
        attrs, body = match.group("attrs"), match.group("body").strip()
        if re.search(r"\bsrc\s*=", attrs, re.I) or not body:
            return match.group(0)
        role = _classify_script(attrs, body)
        if role in roles:
            raise SplitError(f"{filename} contains duplicate {role} scripts")
        roles.add(role)
        output_name = f"dashboard-{role}-{locale}.js"
        outputs[output_name] = HEADER.format(filename=filename) + body + "\n"
        return f'<script{attrs.rstrip()} src="./{output_name}"></script>'

    shell = SCRIPT_RE.sub(replace_script, shell)
    expected = {"debug", "theme", "runtime", "watchdog"}
    if roles != expected:
        raise SplitError(
            f"{filename}: expected {sorted(expected)}, found {sorted(roles)}"
        )
    outputs[filename] = shell
    return outputs


def main() -> int:
    """Validate the complete two-locale output set, then commit it to disk."""
    try:
        outputs: dict[str, str] = {}
        for filename, locale in VARIANTS.items():
            source = (LEGACY / filename).read_text(encoding="utf-8")
            variant = build_variant(filename, locale, source)
            overlap = outputs.keys() & variant.keys()
            if overlap:
                raise SplitError(f"duplicate outputs: {sorted(overlap)}")
            outputs.update(variant)
    except (OSError, SplitError) as error:
        print(f"error: {error}")
        return 1

    # No write occurs until both variants and their complete asset sets pass.
    for name, content in outputs.items():
        (LEGACY / name).write_text(content, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
