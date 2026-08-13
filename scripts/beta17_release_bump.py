from __future__ import annotations

import json
from pathlib import Path

VERSION = "1.0.0-beta.17"

manifest_path = Path("custom_components/dashboardmodern/manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["version"] = VERSION
manifest_path.write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)

readme_path = Path("README.md")
readme = readme_path.read_text(encoding="utf-8")
readme = readme.replace("version-1.0.0--beta.16-", "version-1.0.0--beta.17-")
readme = readme.replace(
    'alt="Versione 1.0.0-beta.16"',
    'alt="Versione 1.0.0-beta.17"',
)
readme_path.write_text(readme, encoding="utf-8")

version_test_path = Path(
    "custom_components/dashboardmodern/frontend/tests/release-01520-version.test.js"
)
version_test = version_test_path.read_text(encoding="utf-8")
version_test = version_test.replace(
    'const RELEASE_VERSION = "1.0.0-beta.16";',
    'const RELEASE_VERSION = "1.0.0-beta.17";',
)
version_test = version_test.replace(r"beta\.16", r"beta\.17")
version_test_path.write_text(version_test, encoding="utf-8")

build_info_path = Path(
    "custom_components/dashboardmodern/frontend/legacy/build-info.js"
)
build_info = build_info_path.read_text(encoding="utf-8").replace(
    "1.0.0-beta.16",
    VERSION,
)
build_info_path.write_text(build_info, encoding="utf-8")

changelog_path = Path("CHANGELOG.md")
changelog = changelog_path.read_text(encoding="utf-8")
heading = "## 1.0.0-beta.17 — 2026-08-13"
if heading not in changelog:
    section = """## 1.0.0-beta.17 — 2026-08-13

### Corretto

- Eliminato lo sfarfallio delle icone nelle **Azioni rapide**: picker e preview nascono direttamente con il glifo colorato definitivo, senza passaggi SVG intermedi.
- Unificato il picker icone delle **Stanze** tra primo inserimento e modifica usando il catalogo canonico, con ricerca bilingue e nomi accessibili per ogni scelta.
- Rimossa dalla pagina **Temperature** la copia transitoria `Aggiornamento in corso...` senza nascondere il timestamp `Aggiornato alle ...` quando arriva il dato reale.
- Caricato l'owner Beta17 anche dal `legacy/build-info.js` versionato, così checkout sorgente, sviluppo ed E2E usano lo stesso runtime del pacchetto generato.
- Allineati gli E2E storici al picker Beta17 mantenendo i guard architetturali su ownership, cicli, polling e observer confinati al solo `#page-temp`.
- Copertura Browser E2E su italiano/inglese e Chromium/WebKit desktop/mobile per picker stanze, stabilità first-paint e regressioni del runtime editor.

"""
    anchor = "## 1.0.0-beta.16 — 2026-08-13"
    if anchor not in changelog:
        raise SystemExit("beta16 changelog anchor not found")
    changelog = changelog.replace(anchor, section + anchor, 1)
    changelog_path.write_text(changelog, encoding="utf-8")

for cleanup_path in (
    Path(".github/workflows/beta17-release-bump.yml"),
    Path("scripts/beta17_release_bump.py"),
):
    if cleanup_path.exists():
        cleanup_path.unlink()
