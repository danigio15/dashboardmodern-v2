"""Build the HACS zip with generated, verified frontend provenance."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components/dashboardmodern"
# `test-results` e `playwright-report` sono i resti di chi ha appena eseguito la
# suite: schermate, tracce, report. In CI il rilascio parte da un checkout
# pulito e non li ha, quindi il pacchetto pubblicato e' sempre stato a posto —
# ma chi costruisce il pacchetto sulla propria macchina, dopo aver eseguito le
# prove, ci spediva dentro tre megabyte e mezzo di PNG. Trovato misurando lo
# zip, non leggendo il codice.
EXCLUDED_RELEASE_PARTS = frozenset(
    {"__pycache__", "e2e", "tests", "test-results", "playwright-report", "node_modules"}
)


def _include_release_file(path: Path) -> bool:
    if not path.is_file() or path.name == "build-info.js":
        return False
    relative = path.relative_to(COMPONENT)
    return not EXCLUDED_RELEASE_PARTS.intersection(relative.parts)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-commit", required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "dashboardmodern.zip")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as temporary:
        generated = Path(temporary) / "build-info.js"
        subprocess.run(
            [
                "python",
                "scripts/generate_build_info.py",
                "--expected-commit",
                args.expected_commit,
                "--output",
                str(generated),
            ],
            cwd=ROOT,
            check=True,
        )
        with zipfile.ZipFile(args.output, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in COMPONENT.rglob("*"):
                if not _include_release_file(path):
                    continue
                # HACS extracts a zip_release directly into
                # /config/custom_components/dashboardmodern. Integration files
                # therefore have to live at the archive root, not under a second
                # custom_components/dashboardmodern directory.
                relative = path.relative_to(COMPONENT)
                archive.write(path, relative)
            archive.write(generated, "frontend/legacy/build-info.js")

        with zipfile.ZipFile(args.output) as archive:
            names = set(archive.namelist())
            required = {
                "__init__.py",
                "manifest.json",
                # Da HA 2026.3 l'icona dell'integrazione la serve Home Assistant
                # da qui: `/api/brands/integration/<dominio>/<file>` guarda dentro
                # `custom_components/<dominio>/brand/` prima di chiedere al
                # catalogo, e gli basta che la cartella esista. Se queste non
                # partono, l'integrazione installata resta senza icona.
                "brand/icon.png",
                "brand/icon@2x.png",
                "brand/logo.png",
                "brand/logo@2x.png",
                "brand/dark_icon.png",
                "brand/dark_icon@2x.png",
                "frontend/panel.js",
                "frontend/dashboard-card.js",
                "frontend/legacy/dashboard.html",
                "frontend/legacy/dashboard-en.html",
                "frontend/legacy/dashboard-runtime-it.js",
                "frontend/legacy/dashboard-runtime-en.js",
                "frontend/legacy/build-info.js",
                "frontend/src/legacy/host.js",
            }
            missing = required - names
            if missing:
                details = ", ".join(sorted(missing))
                message = f"Release archive missing required root files: {details}"
                raise RuntimeError(message)
            if any(name.startswith("custom_components/") for name in names):
                raise RuntimeError(
                    "Release archive contains an invalid nested "
                    "custom_components directory"
                )
            if any("/e2e/" in name or "/tests/" in name for name in names):
                raise RuntimeError(
                    "Release archive contains development-only frontend files"
                )

    manifest = json.loads((COMPONENT / "manifest.json").read_text())
    print(f"Built {args.output} for {manifest['version']} at {args.expected_commit}")


if __name__ == "__main__":
    main()
