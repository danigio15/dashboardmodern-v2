"""Le foto di ``config/www`` si lasciano elencare, e solo quelle.

La cartella ``www`` e' servita da Home Assistant come ``/local``: e' li' che
quasi tutti tengono le immagini della plancia, ed e' l'unica che Home Assistant
non sa elencare da se'. Queste prove tengono ferme le due cose che contano —
cosa finisce nell'elenco, e dove l'elenco non arriva.
"""

from __future__ import annotations

import os
from pathlib import Path

from custom_components.dashboardmodern.www_files import MAX_ENTRIES, list_www_folder


def _casa(tmp_path: Path) -> Path:
    """Una cartella www con dentro qualcosa di ogni tipo."""
    www = tmp_path / "www"
    (www / "auto").mkdir(parents=True)
    (www / "auto" / "mia.PNG").write_bytes(b"")
    (www / "auto" / "appunti.txt").write_text("niente")
    (www / "sfondo.jpg").write_bytes(b"")
    (www / ".nascosta").mkdir()
    return www


def test_elenca_cartelle_e_sole_immagini(tmp_path: Path) -> None:
    """Le cartelle si aprono, i file che non sono foto restano fuori."""
    www = _casa(tmp_path)

    radice = list_www_folder(str(www))
    assert radice is not None
    assert radice["available"] is True
    assert [voce["name"] for voce in radice["folders"]] == ["auto"]
    assert [voce["name"] for voce in radice["images"]] == ["sfondo.jpg"]

    dentro = list_www_folder(str(www), "auto")
    assert dentro is not None
    assert dentro["path"] == "auto"
    assert dentro["folders"] == []
    # Il percorso e' gia' quello che il browser sa servire, senza traduzioni.
    assert dentro["images"] == [
        {"name": "mia.PNG", "path": "auto/mia.PNG", "url": "/local/auto/mia.PNG"}
    ]


def test_i_nomi_col_punto_davanti_non_si_elencano(tmp_path: Path) -> None:
    """Le cartelle di sistema non sono foto e non si mostrano."""
    www = _casa(tmp_path)
    radice = list_www_folder(str(www))
    assert radice is not None
    assert all(not voce["name"].startswith(".") for voce in radice["folders"])


def test_da_www_non_si_esce(tmp_path: Path) -> None:
    """Il percorso risolto deve restare dentro www: e' l'unico confine."""
    www = _casa(tmp_path)
    (tmp_path / "segreti").mkdir()
    (tmp_path / "segreti" / "chiavi.png").write_bytes(b"")

    assert list_www_folder(str(www), "..") is None
    assert list_www_folder(str(www), "../segreti") is None
    assert list_www_folder(str(www), "auto/../../segreti") is None


def test_un_collegamento_che_porta_fuori_non_apre_la_strada(tmp_path: Path) -> None:
    """Un symlink e' un percorso come un altro: conta dove finisce."""
    www = _casa(tmp_path)
    (tmp_path / "segreti").mkdir()
    (tmp_path / "segreti" / "chiavi.png").write_bytes(b"")
    try:
        os.symlink(tmp_path / "segreti", www / "scorciatoia")
    except (OSError, NotImplementedError):  # pragma: no cover - sistemi senza symlink
        return

    assert list_www_folder(str(www), "scorciatoia") is None
    radice = list_www_folder(str(www))
    assert radice is not None
    assert [voce["name"] for voce in radice["folders"]] == ["auto"]


def test_una_www_che_non_esiste_non_e_un_errore(tmp_path: Path) -> None:
    """Una casa senza foto dentro si racconta, non fallisce."""
    risposta = list_www_folder(str(tmp_path / "manca"))
    assert risposta == {
        "path": "",
        "folders": [],
        "images": [],
        "available": False,
        "truncated": False,
    }


def test_un_file_al_posto_di_una_cartella_non_si_elenca(tmp_path: Path) -> None:
    """Chiedere l'elenco di una foto non ha senso e non si finge che l'abbia."""
    www = _casa(tmp_path)
    assert list_www_folder(str(www), "sfondo.jpg") is None


def test_una_cartella_enorme_si_ferma_e_lo_dice(tmp_path: Path) -> None:
    """Meglio un elenco troncato dichiarato che un messaggio da migliaia di voci."""
    www = tmp_path / "www"
    www.mkdir()
    for indice in range(MAX_ENTRIES + 20):
        (www / f"foto-{indice:04d}.png").write_bytes(b"")

    radice = list_www_folder(str(www))
    assert radice is not None
    assert radice["truncated"] is True
    assert len(radice["images"]) == MAX_ENTRIES
