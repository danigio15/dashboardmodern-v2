#!/usr/bin/env python3
"""One-shot branch patcher for the 0.15.20 hardening release.

This file is removed by the branch-only workflow after it applies the audited fixes.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "custom_components/dashboardmodern/frontend"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 regex match, found {count}")
    return text


def sri(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "DashboardModern-release-hardening/0.15.20"})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read()
    digest = base64.b64encode(hashlib.sha384(body).digest()).decode("ascii")
    return f"sha384-{digest}"


def pin_legacy_cdns() -> dict[str, str]:
    urls = {
        "chart": "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js",
        "panzoom": "https://cdn.jsdelivr.net/npm/panzoom@9.4.0/dist/panzoom.min.js",
        "hls": "https://cdn.jsdelivr.net/npm/hls.js@1.6.17/dist/hls.min.js",
    }
    integrities = {key: sri(url) for key, url in urls.items()}
    tags = {
        key: f'<script src="{url}" integrity="{integrities[key]}" crossorigin="anonymous"></script>'
        for key, url in urls.items()
    }
    old_tags = {
        "chart": '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>',
        "panzoom": '<script src="https://cdn.jsdelivr.net/npm/panzoom@9.4.0/dist/panzoom.min.js"></script>',
        "hls": '<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>',
    }
    for variant in (
        "custom_components/dashboardmodern/frontend/legacy/dashboard.html",
        "custom_components/dashboardmodern/frontend/legacy/dashboard-en.html",
    ):
        text = read(variant)
        for key in ("chart", "panzoom", "hls"):
            text = replace_once(text, old_tags[key], tags[key], f"{variant} {key} CDN")
        write(variant, text)

    path = "scripts/vendor_legacy.py"
    text = read(path)
    anchor = 'HEAD_ANCHOR = "<head>"\n'
    constants = anchor + "\n" + "\n".join(
        [
            f"{key.upper()}_CDN_ANCHOR = {old_tags[key]!r}",
            f"{key.upper()}_CDN_PINNED = {tags[key]!r}",
        ]
        for key in ()
    )
    # Build constants without nested-list formatting surprises.
    constants = anchor + "\n" + "\n".join(
        line
        for key in ("chart", "panzoom", "hls")
        for line in (
            f"{key.upper()}_CDN_ANCHOR = {old_tags[key]!r}",
            f"{key.upper()}_CDN_PINNED = {tags[key]!r}",
        )
    ) + "\n"
    text = replace_once(text, anchor, constants, "vendor CDN constants")
    apply_all_anchor = '''def _apply_all(source: str, anchor: str, replacement: str, label: str) -> str:\n    \"\"\"Replace every occurrence of an anchor that appears more than once.\"\"\"\n    found = source.count(anchor)\n    if found == 0:\n        raise PatchError(\n            f\"{label}: expected at least one occurrence of {anchor!r}, found 0. \"\n            \"Upstream changed; update this script instead of loosening the anchor.\"\n        )\n    return source.replace(anchor, replacement)\n'''
    pin_function = apply_all_anchor + '''\n\ndef _pin_cdn_dependencies(source: str, name: str) -> str:\n    \"\"\"Pin third-party scripts and enforce Subresource Integrity.\"\"\"\n    dependencies = (\n        (\"chart.js\", CHART_CDN_ANCHOR, CHART_CDN_PINNED),\n        (\"panzoom\", PANZOOM_CDN_ANCHOR, PANZOOM_CDN_PINNED),\n        (\"hls.js\", HLS_CDN_ANCHOR, HLS_CDN_PINNED),\n    )\n    for label, anchor, replacement in dependencies:\n        source = _apply_once(source, anchor, replacement, f\"{name} {label} CDN\")\n    return source\n'''
    text = replace_once(text, apply_all_anchor, pin_function, "vendor CDN function")
    call_anchor = '''    patched = _apply_once(\n        source,\n        HEAD_ANCHOR,\n        f\"{HEAD_ANCHOR}\\n{NS_TAG}\\n{PRELUDE_TAG}\\n{MODULES_TAG}\\n{FIXES_STYLE_TAG}\",\n        f\"{name} prelude\",\n    )\n'''
    call_replacement = call_anchor + "    patched = _pin_cdn_dependencies(patched, name)\n"
    text = replace_once(text, call_anchor, call_replacement, "vendor CDN call")
    write(path, text)
    return {**urls, **{f"{key}_integrity": value for key, value in integrities.items()}}


def fix_appliance_editor_preview() -> None:
    path = "custom_components/dashboardmodern/frontend/src/sections/editor-contracts-section.js"
    text = read(path)
    text = replace_once(
        text,
        'import {\n  clean,\n',
        'import { applianceArtwork } from "../core/appliance-artwork.js";\nimport {\n  clean,\n',
        "editor contracts artwork import",
    )
    pattern = r'''function selectedOptionGlyph\(select\) \{.*?\n\}\n\nexport function syncApplianceEditorPreview\(\n  modal = doc\?\.getElementById\("dm-appliance-editor-modal"\),\n\) \{.*?\n\}\n\nfunction energyEditorActive'''
    replacement = '''function selectedOptionGlyph(select) {\n  const option = select?.selectedOptions?.[0] || select?.options?.[select?.selectedIndex];\n  const text = clean(option?.textContent || option?.label);\n  if (!text) return "🔌";\n  return text.split(/\\s+/)[0] || "🔌";\n}\n\nexport function syncApplianceEditorPreview(\n  modal = doc?.getElementById("dm-appliance-editor-modal"),\n) {\n  const select = modal?.querySelector('select[name="icon"]');\n  const preview = modal?.querySelector("[data-icon-preview]");\n  if (!select || !preview) return false;\n\n  const value = clean(select.value).toLowerCase();\n  const artwork = applianceArtwork(value, 72);\n  if (artwork) {\n    if (preview.innerHTML !== artwork) preview.innerHTML = artwork;\n  } else {\n    const glyph = selectedOptionGlyph(select);\n    preview.innerHTML = `<span class="dm-appliance-menu-glyph">${glyph}</span>`;\n  }\n  preview.dataset.dmPreviewSource = "artwork";\n  preview.setAttribute("aria-label", clean(select.selectedOptions?.[0]?.textContent) || value);\n\n  const field = select.closest(".dm-appliance-icon-field");\n  const help = field?.querySelector("small");\n  if (help) {\n    help.textContent = t(\n      "L’anteprima usa la stessa illustrazione della card per il tipo selezionato.",\n      "The preview uses the same card artwork for the selected appliance type.",\n    );\n  }\n  return true;\n}\n\nfunction energyEditorActive'''
    text = regex_once(text, pattern, replacement, "appliance preview contract", re.S)
    text = text.replace(
        'data-dm-preview-source="dropdown"', 'data-dm-preview-source="artwork"'
    )
    write(path, text)

    e2e = "custom_components/dashboardmodern/frontend/e2e/weekly-analysis-editor-polish.spec.js"
    text = read(e2e)
    text = replace_once(
        text,
        '''    await expect(preview).toHaveAttribute("data-dm-preview-source", "dropdown");\n    await expect(preview.locator(".dm-appliance-menu-glyph")).toHaveText("🍽️");\n    await expect(preview.locator("svg")).toHaveCount(0);''',
        '''    await expect(preview).toHaveAttribute("data-dm-preview-source", "artwork");\n    await expect(preview.locator('.dm-appliance-art[data-dm-art="dishwasher"]')).toHaveCount(1);\n    await expect(preview.locator("svg")).toHaveCount(1);\n    await expect(preview.locator(".dm-appliance-menu-glyph")).toHaveCount(0);''',
        "appliance E2E assertion",
    )
    write(e2e, text)

    test_path = "custom_components/dashboardmodern/frontend/tests/weekly-analysis-editor-polish.test.js"
    text = read(test_path)
    text = replace_once(
        text,
        '  assert.match(contracts, /data-dm-preview-source=|dmPreviewSource/);',
        '  assert.match(contracts, /applianceArtwork/);\n  assert.match(contracts, /dmPreviewSource = "artwork"/);',
        "appliance unit contract",
    )
    write(test_path, text)


def fix_frontend_registration() -> None:
    path = "custom_components/dashboardmodern/frontend.py"
    text = read(path)
    text = replace_once(
        text,
        'IGNORED_RUNTIME_PARTS = frozenset({"e2e", "tests", "__pycache__"})\n',
        'IGNORED_RUNTIME_PARTS = frozenset({"e2e", "tests", "__pycache__"})\nIGNORED_RUNTIME_FILES = frozenset({"legacy/VENDOR.json"})\n',
        "runtime ignored metadata",
    )
    old_yield = '''            if (\n                path.is_file()\n                and path.suffix in ASSET_SUFFIXES\n                and not IGNORED_RUNTIME_PARTS.intersection(path.parts)\n            ):\n                yield path'''
    new_yield = '''            relative = path.relative_to(FRONTEND_DIR).as_posix()\n            if (\n                path.is_file()\n                and path.suffix in ASSET_SUFFIXES\n                and relative not in IGNORED_RUNTIME_FILES\n                and not IGNORED_RUNTIME_PARTS.intersection(path.parts)\n            ):\n                yield path'''
    text = replace_once(text, old_yield, new_yield, "runtime asset filter")

    panel_old = '''def _panel_config(hass: HomeAssistant, entry: Any) -> dict[str, Any]:\n    \"\"\"Build the panel config snapshot for one plancia.\"\"\"\n    from .config_flow import OPTION_ADMIN_ONLY, OPTION_REGISTER_LOVELACE\n\n    asset_version = _frontend_asset_version()\n    static_url_path = f\"{STATIC_URL_PATH}/{asset_version}\"'''
    panel_new = '''def _panel_config(\n    hass: HomeAssistant,\n    entry: Any,\n    *,\n    asset_version: str | None = None,\n    static_url_path: str | None = None,\n) -> dict[str, Any]:\n    \"\"\"Build the panel config snapshot for one plancia.\"\"\"\n    from .config_flow import OPTION_ADMIN_ONLY, OPTION_REGISTER_LOVELACE\n\n    if asset_version is None:\n        asset_version = _frontend_asset_version()\n    if static_url_path is None:\n        static_url_path = f\"{STATIC_URL_PATH}/{asset_version}\"'''
    text = replace_once(text, panel_old, panel_new, "panel config digest injection")

    register_sig_old = '''def _register_or_update_panel(\n    hass: HomeAssistant, entry: Any, url_path: str, *, update: bool\n) -> None:'''
    register_sig_new = '''def _register_or_update_panel(\n    hass: HomeAssistant,\n    entry: Any,\n    url_path: str,\n    *,\n    update: bool,\n    asset_version: str,\n    static_url_path: str,\n) -> None:'''
    text = replace_once(text, register_sig_old, register_sig_new, "panel register signature")
    text = replace_once(
        text,
        '        config=_panel_config(hass, entry),',
        '        config=_panel_config(\n            hass,\n            entry,\n            asset_version=asset_version,\n            static_url_path=static_url_path,\n        ),',
        "panel register config",
    )

    static_start = text.index("async def _ensure_static_registered(")
    static_end = text.index("\n\ndef _ensure_dashboard_card_registered", static_start)
    static_replacement = '''async def _ensure_static_registered(\n    hass: HomeAssistant, domain_data: dict[str, Any], static_url_path: str\n) -> None:\n    \"\"\"Register only production runtime assets on stable/versioned URLs.\"\"\"\n    if domain_data.get(DATA_STATIC_REGISTERED) == static_url_path:\n        return\n\n    from homeassistant.components.http import StaticPathConfig\n    from homeassistant.setup import async_setup_component\n\n    if hass.http is None:\n        await async_setup_component(hass, "http", {})\n\n    assets = list(_runtime_assets())\n\n    def configs(prefix: str, cache_headers: bool) -> list[StaticPathConfig]:\n        return [\n            StaticPathConfig(\n                url_path=f"{prefix}/{path.relative_to(FRONTEND_DIR).as_posix()}",\n                path=str(path),\n                cache_headers=cache_headers,\n            )\n            for path in assets\n        ]\n\n    paths = configs(static_url_path, True)\n    if not domain_data.get(DATA_STATIC_BASE_REGISTERED):\n        paths = configs(STATIC_URL_PATH, False) + paths\n\n    await hass.http.async_register_static_paths(paths)\n    domain_data[DATA_STATIC_BASE_REGISTERED] = True\n    domain_data[DATA_STATIC_REGISTERED] = static_url_path\n'''
    text = text[:static_start] + static_replacement + text[static_end:]

    dash_start = text.index("def _ensure_dashboard_card_registered(")
    dash_end = text.index("\n\nasync def async_register_frontend", dash_start)
    dash_replacement = '''def _ensure_dashboard_card_registered(\n    hass: HomeAssistant, domain_data: dict[str, Any], static_url_path: str\n) -> None:\n    \"\"\"Load the companion custom card through the public frontend API.\"\"\"\n    from homeassistant.components import frontend\n\n    module_url = f"{static_url_path}/dashboard-card.js"\n    if domain_data.get(DATA_DASHBOARD_CARD_REGISTERED) == module_url:\n        return\n\n    previous = domain_data.get(DATA_DASHBOARD_CARD_REGISTERED)\n    if previous:\n        frontend.remove_extra_js_url(hass, previous)\n    frontend.add_extra_js_url(hass, module_url)\n    domain_data[DATA_DASHBOARD_CARD_REGISTERED] = module_url\n'''
    text = text[:dash_start] + dash_replacement + text[dash_end:]

    async_old = '''    await _ensure_static_registered(hass, domain_data)\n    _ensure_dashboard_card_registered(hass, domain_data)\n\n    paths: dict[str, str] = domain_data.setdefault(DATA_PANEL_PATHS, {})'''
    async_new = '''    asset_version = await hass.async_add_executor_job(_frontend_asset_version)\n    static_url_path = f"{STATIC_URL_PATH}/{asset_version}"\n\n    await _ensure_static_registered(hass, domain_data, static_url_path)\n    _ensure_dashboard_card_registered(hass, domain_data, static_url_path)\n\n    paths: dict[str, str] = domain_data.setdefault(DATA_PANEL_PATHS, {})'''
    text = replace_once(text, async_old, async_new, "async digest once")
    register_call_old = '''    _register_or_update_panel(hass, entry, new_path, update=old_path == new_path)'''
    register_call_new = '''    _register_or_update_panel(\n        hass,\n        entry,\n        new_path,\n        update=old_path == new_path,\n        asset_version=asset_version,\n        static_url_path=static_url_path,\n    )'''
    text = replace_once(text, register_call_old, register_call_new, "panel precomputed digest call")
    write(path, text)

    test_path = "tests/test_setup_unload.py"
    text = read(test_path)
    text = replace_once(
        text,
        '''        *,\n        update: bool,\n    ) -> None:''',
        '''        *,\n        update: bool,\n        asset_version: str,\n        static_url_path: str,\n    ) -> None:''',
        "setup fake panel signature",
    )
    write(test_path, text)


def fix_versions_and_docs() -> None:
    manifest_path = "custom_components/dashboardmodern/manifest.json"
    manifest = json.loads(read(manifest_path))
    if manifest.get("version") != "0.15.19":
        raise RuntimeError(f"unexpected manifest version: {manifest.get('version')}")
    manifest["version"] = "0.15.20"
    write(manifest_path, json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    build_path = "custom_components/dashboardmodern/frontend/legacy/build-info.js"
    text = read(build_path).replace('integrationVersion: "0.15.19"', 'integrationVersion: "0.15.20"')
    text = text.replace('dashboardVersion: "0.15.19"', 'dashboardVersion: "0.15.20"')
    write(build_path, text)

    energy_path = "custom_components/dashboardmodern/frontend/src/sections/energy-section.js"
    text = read(energy_path)
    text = replace_once(
        text,
        'import { runtimeMetrics } from "../core/runtime-metrics.js";\n',
        'import { runtimeMetrics } from "../core/runtime-metrics.js";\nimport { BUILD_INFO } from "../../legacy/build-info.js";\n',
        "Energy build-info import",
    )
    text = replace_once(
        text,
        'const VERSION = "0.15.12";',
        'const VERSION = BUILD_INFO.dashboardVersion || BUILD_INFO.integrationVersion || "UNBUILT";',
        "Energy runtime version",
    )
    write(energy_path, text)

    for path, old, new in (
        ("custom_components/dashboardmodern/frontend/src/core/period-service.js", "/* DashboardModern 0.15.0 — pure period/statistics service. */", "/* Pure period/statistics service. */"),
        ("custom_components/dashboardmodern/frontend/src/core/appliance-artwork.js", "/* DashboardModern 0.15.0 — pure appliance artwork helpers. */", "/* Pure appliance artwork helpers. */"),
    ):
        text = read(path)
        text = replace_once(text, old, new, f"stale header {path}")
        write(path, text)

    readme_path = "README.md"
    text = read(readme_path)
    text = text.replace("version-0.15.19-0ea5e9", "version-0.15.20-0ea5e9")
    text = text.replace('alt="Versione 0.15.19"', 'alt="Versione 0.15.20"')
    text = replace_once(
        text,
        '''> Assistant dashboard distributed as a HACS custom integration. Release 0.15.19\n> adds a Recorder-backed current-week vs previous-week Home consumption\n> comparison and polishes the Energy, Appliances, Lights and Temperature editors\n> without changing the Energy calculation engine stabilized in 0.15.18.''',
        '''> Assistant dashboard distributed as a HACS custom integration. Release 0.15.20\n> restores identical appliance artwork between Add/Edit/card views and hardens\n> frontend delivery, release immutability, version provenance and CI against the\n> class of regressions that can leave a green build but a stale/broken dashboard.''',
        "README English overview",
    )
    old_heading = '''## Novità 0.15.19\n\nLa 0.15.19 parte dal motore Energia della 0.15.18, già allineato alla distribuzione Energia di Home Assistant, e interviene soltanto su **Analisi** e sull'esperienza grafica dell'Editor Dashboard.'''
    new_heading = '''## Novità 0.15.20\n\nLa 0.15.20 corregge la regressione dell'anteprima **Modifica elettrodomestico** e chiude i problemi emersi dall'audit della pipeline e del runtime.\n\n- l'anteprima Modifica usa di nuovo lo stesso `applianceArtwork()` della prima configurazione e della card, non l'emoji del menu;\n- Chart.js, panzoom e hls.js sono versionati esattamente e protetti da SRI;\n- il digest frontend viene calcolato una sola volta fuori dall'event loop e riusato per statici, custom card e pannello;\n- i file statici pubblici sono limitati agli asset runtime realmente raggiungibili;\n- la release fallisce se il tag della versione esiste già e gli E2E girano anche su push a `main` e nel gate di release;\n- il marker Energia usa `build-info.js` e non una versione hardcoded obsoleta;\n- `strings.json` torna alla sorgente inglese prevista da Home Assistant e la selezione utenti è documentata correttamente come filtro UI;\n- rimossi duplicati bridge, riferimenti di packaging morti e la copia brand installata non usata.\n\n### 0.15.19 — Analisi settimanale e polish Editor\n\nLa 0.15.19 parte dal motore Energia della 0.15.18, già allineato alla distribuzione Energia di Home Assistant, e interviene soltanto su **Analisi** e sull'esperienza grafica dell'Editor Dashboard.'''
    text = replace_once(text, old_heading, new_heading, "README 0.15.20 heading")
    write(readme_path, text)

    changelog_path = "CHANGELOG.md"
    text = read(changelog_path)
    if "## 0.15.13" in text:
        raise RuntimeError("CHANGELOG already contains post-0.15.12 entries")
    marker = "## 0.15.12 — 2026-08-07\n"
    entries = '''## 0.15.20 — 2026-08-08\n\n### Corretto\n\n- Ripristinata nel modal **Modifica elettrodomestico** la stessa illustrazione SVG canonica usata dalla prima configurazione e dalla card.\n- Il runtime Energia deriva la versione da `build-info.js` invece di dichiararsi ancora 0.15.12.\n- Rimossi duplicati nella allow-list WebSocket e descrizioni fuorvianti sulla selezione utenti.\n\n### Sicurezza, prestazioni e release\n\n- Chart.js 4.5.1, panzoom 9.4.0 e hls.js 1.6.17 sono pinnati e protetti con SRI; `vendor_legacy.py` applica lo stesso contratto ai futuri re-vendoring.\n- Il digest degli asset viene calcolato una sola volta via executor per registrazione e riusato da statici, card e pannello.\n- Le route statiche espongono soltanto file runtime espliciti, non test/E2E/documentazione interna.\n- Una versione già taggata non può essere ripubblicata silenziosamente; gli E2E sono gate della release e girano anche sui push a `main`.\n- Rimossi riferimenti di packaging morti, `dashboardmodern.zip` è ignorato e la copia brand interna non usata non entra più nel componente.\n\n## 0.15.19 — 2026-08-08\n\n### Aggiunto\n\n- Confronto settimanale dei consumi Casa basato su Recorder con flow-balance Home Assistant e fallback al contatore totale.\n- Migliorata la leggibilità della Config Energia e i layout mobile di Luci e Temperatura.\n\n### Nota\n\n- La preview Modifica Elettrodomestici introdotta come glyph del menu viene sostituita dalla 0.15.20 con l'artwork canonico, coerente con Add e card.\n\n## 0.15.18 — 2026-08-08\n\n### Corretto\n\n- Riallineato Casa al bilancio Energia di Home Assistant quando i flussi completi sono disponibili.\n- Inizializzato e aggiornato automaticamente il mese corrente senza cambio manuale del selettore.\n- Spostato lo Storico elettrodomestici sul WebSocket autenticato `history/history_during_period`.\n\n## 0.15.17 — 2026-08-08\n\n### Corretto\n\n- Riparato l'overflow mobile della Config Elettrodomestici e la geometria degli input/picker.\n- Consolidati i contratti Casa/Report poi ulteriormente corretti in 0.15.18 dopo il confronto con i valori reali Home Assistant.\n\n## 0.15.16 — 2026-08-08\n\n### Corretto\n\n- I riferimenti Giorno/Mese/Anno non più esistenti non bloccano il fallback Recorder; ripristinata la ricostruzione mensile da contatori cumulativi.\n- Allineate le preview degli editor a artwork, icone MDI e gruppi canonici.\n\n## 0.15.15 — 2026-08-08\n\n### Corretto\n\n- Rimosso il caching di processo del digest frontend che poteva far apparire invariata una release HACS aggiornata.\n- Gli URL immutabili cambiano insieme ai file realmente presenti su disco.\n\n## 0.15.14 — 2026-08-08\n\n### Corretto\n\n- Un campo Energia annuale svuotato resta vuoto dopo salvataggio/reload; la compatibilità annuale/lifetime viene applicata solo ai dati legacy.\n- Compattate e corrette su mobile le card Elettrodomestici e Temperature; `[hidden]` resta autorevole.\n\n## 0.15.13 — 2026-08-08\n\n### Corretto\n\n- Stabilizzate regressioni UI/live-state ed Energia con contratti automatici e Browser E2E dedicati.\n- Allineati i marker di release e la documentazione del relativo hotfix.\n\n'''
    text = replace_once(text, marker, entries + marker, "CHANGELOG missing releases")
    write(changelog_path, text)

    old_release = ROOT / "custom_components/dashboardmodern/frontend/tests/release-01519-version.test.js"
    new_release = ROOT / "custom_components/dashboardmodern/frontend/tests/release-01520-version.test.js"
    source = old_release.read_text(encoding="utf-8")
    source = source.replace("0.15.19", "0.15.20").replace("0\\.15\\.19", "0\\.15\\.20")
    source = source.replace(
        'assert.match(contracts, /dm-appliance-menu-glyph/);',
        'assert.match(contracts, /applianceArtwork/);\n  assert.match(contracts, /dmPreviewSource = "artwork"/);',
    )
    source = source.replace(
        'the weekly Analysis and editor polish release is consistently versioned as 0.15.20',
        'the hardening and appliance artwork release is consistently versioned as 0.15.20',
    )
    new_release.write_text(source, encoding="utf-8")
    old_release.unlink()


def fix_release_and_ci() -> None:
    path = ".github/workflows/e2e.yml"
    text = read(path)
    text = replace_once(
        text,
        '''on:\n  pull_request:\n  workflow_dispatch:\n''',
        '''on:\n  pull_request:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n''',
        "E2E push main trigger",
    )
    write(path, text)

    path = ".github/workflows/release.yml"
    text = read(path)
    resolve_old = '''      - name: Resolve and verify release version\n        id: version\n        run: |\n          manifest=$(python -c \"import json;print(json.load(open('custom_components/dashboardmodern/manifest.json'))['version'])\")\n          release_tag=\"v$manifest\"\n          if [ \"$GITHUB_EVENT_NAME\" = \"push\" ] && [[ \"$GITHUB_REF\" == refs/tags/* ]]; then\n            tag=\"v${GITHUB_REF_NAME#v}\"\n            if [ \"$release_tag\" != \"$tag\" ]; then\n              echo \"Tag ${tag#v} does not match manifest version $manifest\" >&2\n              exit 1\n            fi\n          fi\n          echo \"release_tag=$release_tag\" >> \"$GITHUB_OUTPUT\"\n'''
    resolve_new = '''      - name: Resolve and verify release version\n        id: version\n        run: |\n          manifest=$(python -c \"import json;print(json.load(open('custom_components/dashboardmodern/manifest.json'))['version'])\")\n          release_tag=\"v$manifest\"\n          if [ \"$GITHUB_EVENT_NAME\" = \"push\" ] && [[ \"$GITHUB_REF\" == refs/tags/* ]]; then\n            tag=\"v${GITHUB_REF_NAME#v}\"\n            if [ \"$release_tag\" != \"$tag\" ]; then\n              echo \"Tag ${tag#v} does not match manifest version $manifest\" >&2\n              exit 1\n            fi\n          elif git ls-remote --exit-code --tags origin \"refs/tags/$release_tag\" >/dev/null 2>&1; then\n            echo \"Release tag $release_tag already exists. Bump manifest.json instead of overwriting an existing release.\" >&2\n            exit 1\n          fi\n          echo \"release_tag=$release_tag\" >> \"$GITHUB_OUTPUT\"\n'''
    text = replace_once(text, resolve_old, resolve_new, "release immutable-tag guard")
    test_old = '''      - name: Test\n        run: |\n          python scripts/generate_build_info.py --expected-commit \"$GITHUB_SHA\"\n          python -m pytest -q\n          npm run check:inline-syntax\n          npm run test:frontend\n'''
    test_new = '''      - name: Install frontend dependencies\n        run: npm ci\n      - name: Test\n        run: |\n          python scripts/generate_build_info.py --expected-commit \"$GITHUB_SHA\"\n          python -m pytest -q\n          npm run check:inline-syntax\n          npm run test:frontend\n      - name: Install Playwright Chromium\n        run: npx playwright install --with-deps chromium\n      - name: Browser E2E release gate\n        run: npm run test:e2e -- --project=chromium-desktop --project=chromium-mobile\n'''
    text = replace_once(text, test_old, test_new, "release E2E gate")
    write(path, text)


def fix_packaging_brand_and_misc() -> None:
    path = "scripts/build_release.py"
    text = read(path)
    text = replace_once(
        text,
        'EXCLUDED_RELEASE_FILES = frozenset({"frontend/index.html", "frontend/styles.css"})\n',
        "",
        "dead release file exclusions",
    )
    text = replace_once(
        text,
        '''    return relative.as_posix() not in EXCLUDED_RELEASE_FILES''',
        '''    return True''',
        "dead release inclusion check",
    )
    text = text.replace(
        '''                "brand/icon.png",\n                "brand/icon@2x.png",\n''',
        "",
    )
    write(path, text)

    component_brand = ROOT / "custom_components/dashboardmodern/brand"
    if not component_brand.is_dir():
        raise RuntimeError("component brand directory unexpectedly missing")
    shutil.rmtree(component_brand)

    path = "custom_components/dashboardmodern/frontend/tests/hacs-brand-contract.test.js"
    text = read(path)
    text = replace_once(
        text,
        '''test("HACS root brand and installed integration expose a square 256px icon", async () => {\n  for (const path of ["brand/icon.png", "custom_components/dashboardmodern/brand/icon.png"]) {\n    const content = await readFile(new URL(path, root));\n    assert.deepEqual(pngDimensions(content), { width: 256, height: 256 }, path);\n  }\n});''',
        '''test("HACS root brand exposes the canonical square 256px icon", async () => {\n  const path = "brand/icon.png";\n  const content = await readFile(new URL(path, root));\n  assert.deepEqual(pngDimensions(content), { width: 256, height: 256 }, path);\n});''',
        "HACS brand test",
    )
    write(path, text)

    path = "custom_components/dashboardmodern/frontend/tests/brand-assets.test.js"
    text = read(path)
    start = text.index('test("brand copies are limited')
    replacement = '''test("root HACS brand stays canonical without a duplicated installed copy", async () => {\n  for (const path of [\n    "brand/icon.png",\n    "brand/icon@2x.png",\n    "brand/logo.png",\n    "brand/logo@2x.png",\n  ]) {\n    await access(new URL(path, root));\n  }\n  await assertSame([\n    "brand/icon@2x.png",\n    "custom_components/dashboardmodern/frontend/legacy/logo.png",\n  ]);\n  await assert.rejects(access(new URL("custom_components/dashboardmodern/brand/icon.png", root)));\n  await assert.rejects(\n    access(new URL("custom_components/dashboardmodern/frontend/legacy/icon.png", root)),\n  );\n});\n'''
    text = text[:start] + replacement
    write(path, text)

    path = "custom_components/dashboardmodern/frontend/tests/release-artifact.test.js"
    text = read(path)
    text = text.replace(
        'test("HACS release artifact has root integration layout, brand assets and exact provenance", () => {',
        'test("HACS release artifact has root integration layout without duplicated brand ballast and exact provenance", () => {',
    )
    text = text.replace(
        '''  assert.ok(names.includes("brand/icon.png"));\n  assert.ok(names.includes("brand/icon@2x.png"));\n''',
        '''  assert.equal(names.some((name) => name.startsWith("brand/")), false);\n''',
    )
    write(path, text)

    path = ".gitignore"
    text = read(path)
    if "dashboardmodern.zip" not in text.splitlines():
        text += "dashboardmodern.zip\n"
    write(path, text)

    path = "custom_components/dashboardmodern/frontend/src/legacy/bridge-socket.js"
    text = read(path)
    # Keep the first occurrence of each message type and remove the two duplicates.
    text = replace_once(
        text,
        '  "config/entity_registry/list",\n  "recorder/statistics_during_period",\n  "recorder/list_statistic_ids",\n  "history/history_during_period",\n',
        '  "config/entity_registry/list",\n  "recorder/list_statistic_ids",\n',
        "bridge duplicate message types",
    )
    write(path, text)


def fix_strings_and_visibility_docs() -> None:
    en_path = "custom_components/dashboardmodern/translations/en.json"
    it_path = "custom_components/dashboardmodern/translations/it.json"
    en = json.loads(read(en_path))
    it = json.loads(read(it_path))
    en_options = en["options"]["step"]["init"]
    en_options["description"] = (
        "Choose which signed-in users should see this dashboard in the DashboardModern UI. "
        "This is a frontend visibility filter, not a replacement for Home Assistant permissions. "
        "Lovelace registration makes DashboardModern appear in Settings → Dashboards."
    )
    en_options["data_description"]["allowed_users"] = (
        "UI visibility filter only. Home Assistant permissions still govern data and service access."
    )
    it_options = it["options"]["step"]["init"]
    it_options["description"] = (
        "Scegli quali utenti già autenticati devono vedere questa plancia nell'interfaccia DashboardModern. "
        "È un filtro di visibilità frontend, non sostituisce i permessi Home Assistant. "
        "La registrazione Lovelace fa comparire DashboardModern in Impostazioni → Plance."
    )
    it_options["data_description"]["allowed_users"] = (
        "Solo filtro di visibilità UI. Dati e servizi restano soggetti ai permessi Home Assistant dell'utente autenticato."
    )
    write(en_path, json.dumps(en, ensure_ascii=False, indent=2) + "\n")
    write(it_path, json.dumps(it, ensure_ascii=False, indent=2) + "\n")
    # Home Assistant convention: strings.json is the English source catalogue.
    write("custom_components/dashboardmodern/strings.json", json.dumps(en, ensure_ascii=False, indent=2) + "\n")


def add_hardening_contract(cdn: dict[str, str]) -> None:
    path = ROOT / "custom_components/dashboardmodern/frontend/tests/release-hardening.test.js"
    content = f'''import assert from "node:assert/strict";\nimport {{ access, readFile }} from "node:fs/promises";\nimport test from "node:test";\n\nconst root = new URL("../../../../", import.meta.url);\nconst read = (path) => readFile(new URL(path, root), "utf8");\n\ntest("legacy third-party scripts are immutable and SRI protected", async () => {{\n  for (const file of [\n    "custom_components/dashboardmodern/frontend/legacy/dashboard.html",\n    "custom_components/dashboardmodern/frontend/legacy/dashboard-en.html",\n  ]) {{\n    const source = await read(file);\n    assert.match(source, /chart\\.js@4\\.5\\.1\\/dist\\/chart\\.umd\\.min\\.js/);\n    assert.match(source, /panzoom@9\\.4\\.0\\/dist\\/panzoom\\.min\\.js/);\n    assert.match(source, /hls\\.js@1\\.6\\.17\\/dist\\/hls\\.min\\.js/);\n    assert.equal((source.match(/integrity="sha384-/g) || []).length >= 3, true);\n    assert.doesNotMatch(source, /hls\\.js@latest|npm\\/chart\\.js\"><\\/script>/);\n  }}\n}});\n\ntest("future re-vendoring preserves the CDN integrity contract", async () => {{\n  const source = await read("scripts/vendor_legacy.py");\n  assert.match(source, /_pin_cdn_dependencies/);\n  assert.match(source, /CHART_CDN_PINNED/);\n  assert.match(source, /HLS_CDN_PINNED/);\n  assert.match(source, /integrity=/);\n}});\n\ntest("frontend registration hashes off-loop once and exposes only explicit runtime assets", async () => {{\n  const source = await read("custom_components/dashboardmodern/frontend.py");\n  assert.match(source, /async_add_executor_job\\(_frontend_asset_version\\)/);\n  assert.match(source, /relative_to\\(FRONTEND_DIR\\)\\.as_posix\\(\\)/);\n  assert.match(source, /IGNORED_RUNTIME_FILES/);\n  assert.match(source, /add_extra_js_url/);\n  assert.doesNotMatch(source, /DATA_EXTRA_MODULE_URL/);\n}});\n\ntest("build provenance is canonical and bridge message types are unique", async () => {{\n  const energy = await read("custom_components/dashboardmodern/frontend/src/sections/energy-section.js");\n  assert.match(energy, /BUILD_INFO/);\n  assert.doesNotMatch(energy, /const VERSION = ["']0\\.15\\.12["']/);\n  const {{ ALLOWED_MESSAGE_TYPES }} = await import("../src/legacy/bridge-socket.js");\n  assert.equal(ALLOWED_MESSAGE_TYPES.length, new Set(ALLOWED_MESSAGE_TYPES).size);\n}});\n\ntest("Home Assistant strings use English source and installed brand ballast is absent", async () => {{\n  const strings = JSON.parse(await read("custom_components/dashboardmodern/strings.json"));\n  assert.equal(strings.config.step.user.title, "New DashboardModern panel");\n  assert.match(strings.options.step.init.data_description.allowed_users, /UI visibility filter/);\n  await assert.rejects(access(new URL("custom_components/dashboardmodern/brand/icon.png", root)));\n}});\n'''
    path.write_text(content, encoding="utf-8")


def main() -> None:
    cdn = pin_legacy_cdns()
    fix_appliance_editor_preview()
    fix_frontend_registration()
    fix_versions_and_docs()
    fix_release_and_ci()
    fix_packaging_brand_and_misc()
    fix_strings_and_visibility_docs()
    add_hardening_contract(cdn)
    print(json.dumps({"version": "0.15.20", "cdn": cdn}, indent=2))


if __name__ == "__main__":
    main()
