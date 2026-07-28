#!/usr/bin/env python3
"""Vendor the legacy DashboardModern dashboard into this integration.

The legacy dashboard lives in danigio15/dashboardmodern and stays the source of
truth. This script copies a pinned tag into
custom_components/dashboardmodern/frontend/legacy/ and applies two small,
verified patches so the integration can host it without a setup wizard:

1. A prelude script that receives the authenticated session from the panel.
2. One line in connect() so a reconnect reads the live bridge token instead of
   the constant captured when the script was parsed.

Everything else is copied byte for byte. Run it again to move to a newer tag:

    python scripts/vendor_legacy.py --ref v0.11.0

The vendored files are committed so HACS ships them; users never download or
edit an HTML file themselves.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
VENDOR_DIR = REPO_ROOT / "custom_components/dashboardmodern/frontend/legacy"
SOURCE_REPO = "https://github.com/danigio15/dashboardmodern.git"
VARIANTS = ("dashboard.html", "dashboard-en.html")

NS_TAG = '<script src="./storage-namespace.js"></script>'
PRELUDE_TAG = '<script src="./bridge-prelude.js"></script>'
# The tested logic the sections call. A module, so it shares one
# implementation with the rest of the integration instead of a copy.
MODULES_TAG = '<script type="module" src="./modules-entry.js"></script>'
FIXES_STYLE_TAG = '<link rel="stylesheet" href="./dashboard-runtime.css">'
HEAD_ANCHOR = "<head>"

WIZARD_ANCHOR = "\n        step: 1,\n        token: conn.token"
WIZARD_PATCHED = (
    "\n        // Integration-hosted: the connection step has nothing left to ask,"
    "\n        // so start at the first step that still needs the user."
    "\n        step: window.__DASHBOARDMODERN_HOSTED__ && conn.token ? 2 : 1,"
    "\n        token: conn.token"
)

# The bake-download control carries a localized title, so it is matched by
# shape rather than by literal text.
BAKE_PATTERN = re.compile(
    r'<div class="ed-head-close" title="[^"]*"'
    r' onclick="cdBakeDownload\(\)">[^<]*</div>'
)

# The hosted page must not read cd_connection: it shares localStorage with the
# standalone dashboard, and a placeholder there would collide. When hosted, the
# connection comes from the in-memory object the prelude set instead.
CONN_ANCHOR = (
    "const _CONN = (typeof cdCfg === 'function' ? cdCfg('cd_connection') : {}) || {};"
)
CONN_PATCHED = (
    "const _CONN = (window.__DASHBOARDMODERN_HOSTED__ "
    "&& window.__DASHBOARDMODERN_CONNECTION__) "
    "|| (typeof cdCfg === 'function' ? cdCfg('cd_connection') : {}) || {};"
)

TOKEN_ANCHOR = "let token = LONG_LIVED_TOKEN;"
# When hosted, the socket is a shim that discards the auth message, so the
# value here is never a credential and never leaves the page.
TOKEN_PATCHED = (
    "let token = window.__DASHBOARDMODERN_HOSTED__ "
    "? '__dashboardmodern_hosted__' : LONG_LIVED_TOKEN;"
)


class PatchError(RuntimeError):
    """Raised when an anchor is missing or ambiguous in the upstream file."""


def _apply_once(source: str, anchor: str, replacement: str, label: str) -> str:
    """Replace a single expected occurrence, refusing to guess."""
    found = source.count(anchor)
    if found != 1:
        raise PatchError(
            f"{label}: expected exactly one occurrence of {anchor!r}, found {found}. "
            "Upstream changed; update this script instead of loosening the anchor."
        )
    return source.replace(anchor, replacement, 1)


def _apply_all(source: str, anchor: str, replacement: str, label: str) -> str:
    """Replace every occurrence of an anchor that appears more than once."""
    found = source.count(anchor)
    if found == 0:
        raise PatchError(
            f"{label}: expected at least one occurrence of {anchor!r}, found 0. "
            "Upstream changed; update this script instead of loosening the anchor."
        )
    return source.replace(anchor, replacement)


def _hide_bake_download(source: str, name: str) -> str:
    """Hide the bake-download control while the integration hosts the dashboard.

    Baking a token and a configuration into a downloadable copy is meaningless
    once Home Assistant supplies both: the file would carry a credential that
    expires in half an hour and a configuration that no longer lives in the
    file. The control stays for standalone use.
    """
    matches = BAKE_PATTERN.findall(source)
    if len(matches) != 1:
        msg = (
            f"{name} bake control: expected exactly one match, found {len(matches)}. "
            "Upstream changed; update this script instead of loosening the pattern."
        )
        raise PatchError(msg)
    control = matches[0]
    if "'" in control:
        msg = f"{name} bake control: unexpected quote breaks the wrapper."
        raise PatchError(msg)
    return source.replace(
        control,
        "${window.__DASHBOARDMODERN_HOSTED__ ? '' : '" + control + "'}",
        1,
    )


# Confirmed upstream bugs, fixed here until they land in the source repository.
# Vendoring from a clean upstream checkout must not silently reintroduce them,
# which is what happens when fixes live only in a separate script someone has
# to remember to run.
UPSTREAM_FIXES: tuple[tuple[str, str, str, int], ...] = (
    (
        "cameras-wipe",
        "localStorage.setItem('cd_cameras','cd_appliances', JSON.stringify(",
        "localStorage.setItem('cd_cameras', JSON.stringify(",
        3,
    ),
    (
        "alarm-entity",
        "let data = { entity_id: 'dm.security_centrale_allarme' };",
        "let data = { entity_id: (typeof resolveEntity === 'function'"
        " ? resolveEntity('dm.security_centrale_allarme')"
        " : 'dm.security_centrale_allarme') };",
        1,
    ),
    (
        "pin-length",
        "if(currentPin.length < 4) { currentPin += num;",
        "if(currentPin.length < 8) { currentPin += num;",
        1,
    ),
    (
        "pin-display",
        "if(i <= currentPin.length) dot.classList.add('filled');",
        "if(i <= Math.min(currentPin.length, 4)) dot.classList.add('filled');",
        1,
    ),
)


def _apply_upstream_fixes(source: str, name: str) -> str:
    """Apply the confirmed upstream fixes, tolerating ones already merged."""
    for label, broken, fixed, expected in UPSTREAM_FIXES:
        found = source.count(broken)
        if found == 0 and fixed in source:
            continue  # Already fixed upstream; nothing to do.
        if found != expected:
            msg = (
                f"{name} {label}: expected {expected} occurrences, found {found}. "
                "Either upstream changed or the fix landed differently; update "
                "this script rather than shipping an unverified vendor."
            )
            raise PatchError(msg)
        source = source.replace(broken, fixed)
    return source


# When the integration hosts the dashboard, it must never write cd_connection:
# that key is shared with the user's own iframe plancia, and overwriting it
# with a placeholder is exactly what left that plancia stuck on "connecting".
# These wrap the two writes so they are skipped while hosted.
CONN_WRITE_WIZARD_ANCHOR = (
    "localStorage.setItem('cd_connection', JSON.stringify({ token: WIZ.token,"
)
CONN_WRITE_WIZARD_PATCHED = (
    "if (!window.__DASHBOARDMODERN_HOSTED__) "
    "localStorage.setItem('cd_connection', JSON.stringify({ token: WIZ.token,"
)
CONN_WRITE_IMPORT_ANCHOR = (
    "conn.token = tk; localStorage.setItem('cd_connection', JSON.stringify(conn)); }"
)
CONN_WRITE_IMPORT_PATCHED = (
    "conn.token = tk; if (!window.__DASHBOARDMODERN_HOSTED__) "
    "localStorage.setItem('cd_connection', JSON.stringify(conn)); }"
)


from vendor_features import FEATURE_PATCHES, RENAME_PATCHES  # noqa: E402

# User-facing vocabulary that must never leak from one vendored locale into
# the other.  Apply this during vending as well as testing the committed
# artifacts: otherwise a future refresh would silently reintroduce mixed UI.
LOCALIZATION_GLOSSARY: tuple[tuple[str, str], ...] = (
    ("No room", "Nessuna stanza"),
    ("Overview", "Panoramica"),
    ("Power", "Potenza"),
    ("Energy", "Energia"),
    ("Duration", "Durata"),
    ("History", "Storico"),
    ("Running", "In funzione"),
    ("On", "Acceso"),
    ("Off", "Spento"),
    ("Not configured", "Non configurato"),
    ("Choose entity", "Scegli entità"),
    ("Edit camera", "Modifica telecamera"),
    ("Current consumption", "Consumo attuale"),
    ("Daily consumption", "Consumo giornaliero"),
    ("Monthly consumption", "Consumo mensile"),
    ("Total", "Totale"),
    ("Camera", "Telecamera"),
    ("Room", "Stanza"),
    ("Cameras", "Telecamere"),
    ("Rooms", "Stanze"),
)


def _localized_word(source: str, old: str, new: str) -> str:
    """Replace a complete UI word without touching identifiers/entity ids."""
    return re.sub(rf"(?<![A-Za-zÀ-ÿ_]){re.escape(old)}(?![A-Za-zÀ-ÿ_])", new, source)


def _localize_variant(source: str, name: str) -> str:
    """Enforce the audited vocabulary for the selected HTML locale."""
    pairs = LOCALIZATION_GLOSSARY
    if name == "dashboard-en.html":
        pairs = tuple((italian, english) for english, italian in pairs)
    for old, new in sorted(pairs, key=lambda pair: len(pair[0]), reverse=True):
        source = _localized_word(source, old, new)
    if name == "dashboard.html":
        source = source.replace(
            "alert('Invalid camera')", "alert('Telecamera non valida')"
        )
    else:
        source = source.replace(">STANZA</label>", ">ROOM</label>")
    return source


def _fix_boiler_entity_picker(source: str, name: str) -> str:
    """Replace the duplicated boiler field with the standard searchable row."""
    pattern = re.compile(
        r'<div class="ed-slot" style="margin-top:12px;">'
        r'<div class="ed-slot-lbl">([^<]+)</div>\s*'
        r'<input class="wz-input mono"'
        r'([^>]+data-ref="switch\.caldaia"[^>]*)></div>\s*'
        r'<div class="ed-slot" style="margin-top:12px; padding-top:12px; '
        r'border-top:1px dashed var\(--card-border\);">.*?</div>\s*'
        r"</div>\s*</details>`",
        re.S,
    )
    replacement = (
        r'<div class="ed-slot" style="margin-top:12px;">'
        r'<div class="ed-slot-lbl">\1</div>'
        r'<div style="display:flex;gap:6px;">'
        r'<input id="wz-boiler-ent" class="wz-input mono"\2>'
        r'<button type="button" onclick="wzPickEntity(\'#wz-boiler-ent\')" '
        r'style="flex:0 0 40px;height:40px;border:none;border-radius:12px;'
        r'background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;cursor:pointer;">🔍</button>'
        r"</div></div></div></details>`"
    )
    source, count = pattern.subn(replacement, source, count=1)
    if count != 1:
        msg = f"{name} boiler picker: expected one duplicated field, found {count}"
        raise PatchError(msg)
    return source


def patch_variant(source: str, name: str) -> str:
    """Apply both bridge patches to one legacy dashboard file."""
    if PRELUDE_TAG in source:
        raise PatchError(f"{name}: already vendored; re-run against a clean checkout.")
    patched = _apply_once(
        source,
        HEAD_ANCHOR,
        f"{HEAD_ANCHOR}\n{NS_TAG}\n{PRELUDE_TAG}\n{MODULES_TAG}\n{FIXES_STYLE_TAG}",
        f"{name} prelude",
    )
    patched = _apply_once(patched, CONN_ANCHOR, CONN_PATCHED, f"{name} connection")
    patched = _apply_once(
        patched,
        CONN_WRITE_WIZARD_ANCHOR,
        CONN_WRITE_WIZARD_PATCHED,
        f"{name} conn-wizard",
    )
    patched = _apply_once(
        patched,
        CONN_WRITE_IMPORT_ANCHOR,
        CONN_WRITE_IMPORT_PATCHED,
        f"{name} conn-import",
    )
    patched = _apply_once(patched, TOKEN_ANCHOR, TOKEN_PATCHED, f"{name} token")
    patched = _apply_once(patched, WIZARD_ANCHOR, WIZARD_PATCHED, f"{name} wizard")
    patched = _hide_bake_download(patched, name)
    for label, anchor, replacement in FEATURE_PATCHES:
        if label.endswith("?"):
            # Optional, language-specific: replace every occurrence, and it
            # is fine if this variant does not contain it at all.
            patched = patched.replace(anchor, replacement)
        else:
            patched = _apply_once(patched, anchor, replacement, f"{name} {label}")
    # Label-only renames: replace-all, and tolerant of a label not being
    # present (the two languages use different wording).
    for old_label, new_label in RENAME_PATCHES:
        patched = patched.replace(old_label, new_label)
    patched = _localize_variant(_apply_upstream_fixes(patched, name), name)
    return _fix_boiler_entity_picker(patched, name)


def _checkout(ref: str, destination: Path) -> str:
    """Clone the pinned ref and return the resolved commit sha."""
    subprocess.run(
        [
            "git",
            "clone",
            "--depth",
            "1",
            "--branch",
            ref,
            SOURCE_REPO,
            str(destination),
        ],
        check=True,
        capture_output=True,
    )
    result = subprocess.run(
        ["git", "-C", str(destination), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def vendor(ref: str) -> dict[str, str]:
    """Copy and patch the pinned legacy dashboard, returning vendor metadata."""
    with tempfile.TemporaryDirectory() as tmp:
        source_dir = Path(tmp) / "legacy"
        commit = _checkout(ref, source_dir)

        digests: dict[str, str] = {}
        for name in VARIANTS:
            source = (source_dir / name).read_text(encoding="utf-8")
            patched = patch_variant(source, name)
            (VENDOR_DIR / name).write_text(patched, encoding="utf-8")
            digests[name] = hashlib.sha256(source.encode("utf-8")).hexdigest()

    metadata = {"source": SOURCE_REPO, "ref": ref, "commit": commit, "sha256": digests}
    (VENDOR_DIR / "VENDOR.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    return metadata


def main() -> int:
    """Vendor the legacy dashboard at the requested ref."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ref", required=True, help="Tag or branch to vendor.")
    args = parser.parse_args()

    VENDOR_DIR.mkdir(parents=True, exist_ok=True)
    try:
        metadata = vendor(args.ref)
    except PatchError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as error:
        print(
            f"error: git failed: {error.stderr.decode(errors='replace')}",
            file=sys.stderr,
        )
        return 1

    print(f"vendored {args.ref} ({metadata['commit'][:12]})")
    for name in VARIANTS:
        print(f"  {name}: {(VENDOR_DIR / name).stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
