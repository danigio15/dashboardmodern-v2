"""Regression tests for DashboardModern frontend cache busting and static mounts.

La firma degli asset guarda nome, dimensione e istante di modifica dei file,
non i loro byte: leggere tredici megabyte in trecentotrenta file — a ogni
avvio e a ogni ricarica, per ogni plancia — su una macchina piccola si
sentiva. E le cartelle del runtime si montano intere, una rotta per cartella,
invece di una rotta per file registrata due volte.
"""

from __future__ import annotations

import os
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from custom_components.dashboardmodern import frontend as frontend_module


def _riscrivi_dopo(path: Path, testo: str) -> None:
    """Riscrive un file come farebbe un aggiornamento: con un istante nuovo.

    Due scritture di fila possono cadere nello stesso tick dell'orologio del
    filesystem, e un aggiornamento vero arriva mesi dopo: qui l'istante si
    alza a mano di un secondo.
    """
    prima = path.stat()
    path.write_text(testo, encoding="utf-8")
    os.utime(path, ns=(prima.st_atime_ns, prima.st_mtime_ns + 1_000_000_000))


def test_frontend_asset_version_changes_when_runtime_file_changes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A HACS in-place update must produce a fresh immutable asset URL."""
    panel = tmp_path / "panel.js"
    panel.write_text("export const version = 'old';\n", encoding="utf-8")

    monkeypatch.setattr(frontend_module, "FRONTEND_DIR", tmp_path)

    first = frontend_module._frontend_asset_version()
    first_url = frontend_module._versioned_static_url_path()

    _riscrivi_dopo(panel, "export const version = 'new';\n")

    second = frontend_module._frontend_asset_version()
    second_url = frontend_module._versioned_static_url_path()

    assert second != first
    assert second_url != first_url
    assert first_url.startswith(frontend_module.STATIC_URL_PATH + "/")
    assert second_url.startswith(frontend_module.STATIC_URL_PATH + "/")


def test_la_firma_non_legge_i_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La firma si calcola dai metadati: nessun byte viene letto."""
    (tmp_path / "panel.js").write_text("export const a = 1;\n", encoding="utf-8")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "modulo.js").write_text("export const b = 2;\n")
    (tmp_path / "src" / "appunti.md").write_text("non conta\n")
    monkeypatch.setattr(frontend_module, "FRONTEND_DIR", tmp_path)

    def vietato(self: Path, *args: Any, **kwargs: Any) -> bytes:
        raise AssertionError(f"letto {self} per calcolare la firma")

    monkeypatch.setattr(Path, "read_bytes", vietato)
    monkeypatch.setattr(Path, "read_text", vietato)

    firma = frontend_module._frontend_asset_version()
    assert len(firma) == 16
    # Un file che il runtime non chiede non entra nella firma.
    _riscrivi_dopo(tmp_path / "src" / "appunti.md", "cambiato\n")
    assert frontend_module._frontend_asset_version() == firma


async def test_le_cartelle_si_montano_intere(
    hass: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Una rotta per cartella, non una per file; e il prefisso stabile resta.

    Il prefisso stabile e' la strada di recupero del guscio quando l'indirizzo
    versionato che un browser ha in mano non esiste piu' dopo un
    aggiornamento: si monta una volta, senza cache. Le cartelle condivise —
    i ritratti, i loghi — stanno solo li'.
    """
    pytest.importorskip("homeassistant")
    for name in ("panel.js", "dashboard-card.js"):
        (tmp_path / name).write_text("export {};\n", encoding="utf-8")
    for name in ("legacy", "src", "avatars"):
        (tmp_path / name).mkdir()
        (tmp_path / name / "a.js").write_text("export {};\n", encoding="utf-8")
    monkeypatch.setattr(frontend_module, "FRONTEND_DIR", tmp_path)

    registrati: list[Any] = []

    async def registra(configs: list[Any]) -> None:
        registrati.extend(configs)

    viste: list[Any] = []
    hass.http = SimpleNamespace(
        async_register_static_paths=registra, register_view=viste.append
    )
    domain_data: dict[str, Any] = {}
    base = frontend_module.STATIC_URL_PATH

    await frontend_module._ensure_static_registered(hass, domain_data, f"{base}/v1")

    assert {(item.url_path, item.cache_headers) for item in registrati} == {
        (f"{base}/v1/dashboard-card.js", True),
        (f"{base}/v1/panel.js", True),
        (f"{base}/v1/legacy", True),
        (f"{base}/v1/src", True),
        (f"{base}/panel.js", False),
        (f"{base}/legacy", False),
        (f"{base}/src", False),
        (f"{base}/avatars", True),
    }
    # Cartelle intere, non i file che contengono.
    assert {Path(item.path).name for item in registrati} == {
        "dashboard-card.js",
        "panel.js",
        "legacy",
        "src",
        "avatars",
    }
    # La card sul percorso stabile non e' un file montato: e' una nostra vista.
    # Se la montassimo anche come statico, aiohttp avrebbe due gestori per lo
    # stesso indirizzo e rifiuterebbe il secondo.
    assert [vista.url for vista in viste] == [frontend_module.PERCORSO_DELLA_CARD]

    # Una versione nuova monta solo le sue quattro rotte: la base c'e' gia'.
    registrati.clear()
    await frontend_module._ensure_static_registered(hass, domain_data, f"{base}/v2")
    assert [item.url_path for item in registrati] == [
        f"{base}/v2/dashboard-card.js",
        f"{base}/v2/panel.js",
        f"{base}/v2/legacy",
        f"{base}/v2/src",
    ]
    # E la stessa versione non si monta due volte.
    registrati.clear()
    await frontend_module._ensure_static_registered(hass, domain_data, f"{base}/v2")
    assert registrati == []


async def _monta(
    hass: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[dict[str, Any], Any]:
    """Monta gli asset su un `hass` finto e restituisci dati e vista della card."""
    for name in ("panel.js", "dashboard-card.js"):
        (tmp_path / name).write_text("export const marchio = 1;\n", encoding="utf-8")
    for name in ("legacy", "src"):
        (tmp_path / name).mkdir()
    monkeypatch.setattr(frontend_module, "FRONTEND_DIR", tmp_path)

    viste: list[Any] = []

    async def registra(_configs: list[Any]) -> None:
        return None

    hass.http = SimpleNamespace(
        async_register_static_paths=registra, register_view=viste.append
    )
    domain_data: dict[str, Any] = hass.data.setdefault(frontend_module.DOMAIN, {})
    base = frontend_module.STATIC_URL_PATH
    await frontend_module._ensure_static_registered(hass, domain_data, f"{base}/v1")
    (vista,) = viste
    return domain_data, vista


async def test_la_card_stabile_rimanda_alla_firma_di_adesso(
    hass: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Il percorso stabile della card rimanda al versionato, e non si cachea.

    «L'integrazione portava versione 1.4.24 ma nella plancia 1.4.23.» La card
    sta sul percorso stabile — e deve starci, se no una pagina vecchia in cache
    chiede una firma che non esiste piu' (#372) — ma un modulo risolve i suoi
    `import` rispetto a dove lo si e' preso: da li' tutto `src/` e tutto
    `legacy/` arrivavano dal prefisso stabile, che Home Assistant serve senza
    nemmeno un `Cache-Control`. Senza istruzioni il browser decide da se', e
    dopo un aggiornamento continuava a usare i file di prima.
    """
    pytest.importorskip("homeassistant")
    base = frontend_module.STATIC_URL_PATH
    domain_data, vista = await _monta(hass, tmp_path, monkeypatch)

    assert vista.url == frontend_module.PERCORSO_DELLA_CARD
    # Gli asset della plancia non hanno mai chiesto di autenticarsi: e' un
    # modulo che il frontend carica prima di sapere chi sta guardando.
    assert vista.requires_auth is False

    risposta = await vista.get(None)
    assert risposta.status == 302
    assert risposta.headers["Location"] == f"{base}/v1/dashboard-card.js"
    assert risposta.headers["Cache-Control"] == "no-cache"

    # E un aggiornamento cambia la firma: lo stesso indirizzo rimanda altrove,
    # ed e' per questo che il rimando non si deve tenere in cache.
    domain_data[frontend_module.DATA_STATIC_REGISTERED] = f"{base}/v2"
    risposta = await vista.get(None)
    assert risposta.headers["Location"] == f"{base}/v2/dashboard-card.js"


async def test_la_card_stabile_si_serve_anche_senza_firma(
    hass: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Se la firma di adesso non si sa, il file si serve lo stesso.

    Non deve mai succedere che la porta della plancia risponda «non c'e'»: chi
    ha questa plancia come predefinita vedrebbe «Errore di configurazione».
    """
    pytest.importorskip("homeassistant")
    domain_data, vista = await _monta(hass, tmp_path, monkeypatch)
    domain_data.pop(frontend_module.DATA_STATIC_REGISTERED)

    risposta = await vista.get(None)
    assert risposta.status == 200
    assert Path(risposta._path).name == "dashboard-card.js"
    assert risposta.headers["Cache-Control"] == "no-cache"
