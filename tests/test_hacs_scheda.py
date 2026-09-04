"""La scheda che HACS mostra di questa integrazione.

«Su HACS non si vede nulla»: la scheda diceva «lo sviluppatore non ha fornito
ulteriori informazioni» e il numero di versione era fermo a una beta cancellata
da un pezzo.

La versione ferma e' il deposito di chi guarda, che va aggiornato dal suo menu.
Ma la scheda vuota no, quella e' nostra: `hacs.json` diceva `render_readme`, e
allora HACS doveva disegnare il README intero — centoventi chilobyte,
milletrecento righe, centotrenta immagini, e in testa dell'HTML che il suo
lettore scarta. Per una scheda di presentazione su un telefono e' troppa roba,
ed e' fragile: basta poco perche' non mostri niente.

Adesso HACS legge `info.md`, che e' scritto per quello spazio. Queste prove
tengono insieme le due cose — la casella che dice dove guardare e il file che
si trova dall'altra parte — perche' separate si perdono: togliere il file
lasciando la casella, o rimettere `render_readme` lasciando il file, riporta
la scheda vuota senza che nessuno se ne accorga.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _hacs() -> dict:
    return json.loads((ROOT / "hacs.json").read_text(encoding="utf-8"))


def test_hacs_legge_la_scheda_scritta_per_lui() -> None:
    """Niente README nella scheda: c'e' `info.md`, e HACS deve puntarci."""
    assert _hacs().get("render_readme") is False
    scheda = ROOT / "info.md"
    assert scheda.is_file(), "hacs.json manda HACS su info.md, che non c'e'"


def test_la_scheda_sta_in_una_schermata() -> None:
    """Corta abbastanza da leggersi, lunga abbastanza da dire qualcosa.

    Il README puo' pesare quanto vuole: e' un manuale. Questa e' la vetrina, e
    se ricomincia a crescere torna il difetto da cui siamo partiti.
    """
    testo = (ROOT / "info.md").read_text(encoding="utf-8")
    assert 400 < len(testo) < 8_000, f"info.md pesa {len(testo)} byte"


def test_la_scheda_dice_le_tre_cose_che_servono() -> None:
    """Cos'e', cosa serve per averla, e come si installa."""
    testo = (ROOT / "info.md").read_text(encoding="utf-8").lower()
    assert "dashboardmodern v2" in testo
    assert "2025.1" in testo, "la versione minima di Home Assistant non c'e'"
    assert "installa" in testo
    # E la strada per il resto, che in una scheda non ci sta.
    assert "readme" in testo
    assert "changelog.md" in testo


def test_il_pacchetto_resta_quello_dichiarato() -> None:
    """`zip_release` e il nome del file li scrive il rilascio: se cambiano qui
    e non la', HACS scarica un file che non esiste."""
    hacs = _hacs()
    assert hacs.get("zip_release") is True
    assert hacs.get("filename") == "dashboardmodern.zip"
    rilascio = (ROOT / ".github/workflows/release.yml").read_text(encoding="utf-8")
    assert "dashboardmodern.zip" in rilascio
