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
                if (
                    not path.is_file()
                    or "__pycache__" in path.parts
                    or path.name == "build-info.js"
                ):
                    continue
                relative = path.relative_to(ROOT)
                archive.write(path, relative)
            archive.write(
                generated,
                "custom_components/dashboardmodern/frontend/legacy/build-info.js",
            )
    manifest = json.loads((COMPONENT / "manifest.json").read_text())
    print(f"Built {args.output} for {manifest['version']} at {args.expected_commit}")


if __name__ == "__main__":
    main()
