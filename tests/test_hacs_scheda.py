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


NUMERI = {
    12: "dodici",
    13: "tredici",
    14: "quattordici",
    15: "quindici",
    16: "sedici",
    17: "diciassette",
    18: "diciotto",
}


def _lingue_tradotte() -> int:
    """Quante lingue parla davvero la plancia.

    Un catalogo per lingua, piu' i due perni che un catalogo non ce l'hanno:
    le chiavi sono in inglese e la plancia e' nata in italiano. Le varianti
    regionali servite da un catalogo altrui — il cinese tradizionale legge
    quello semplificato — non sono una lingua in piu', e la vetrina non le
    conta.
    """
    cataloghi = ROOT / "custom_components/dashboardmodern/frontend/src/i18n"
    tradotte = {p.stem for p in cataloghi.glob("*.js")} - {"source-index"}
    return len(tradotte) + 2


def test_la_scheda_conta_le_lingue_che_ci_sono() -> None:
    """Il numero in vetrina lo decidono i cataloghi, non la memoria.

    Diceva tredici quando erano quindici: un numero scritto a mano invecchia
    alla prima traduzione aggiunta, e chi valuta l'integrazione da HACS legge
    una capacita' che non e' quella vera.
    """
    quante = _lingue_tradotte()
    parola = NUMERI[quante]
    testo = " ".join((ROOT / "info.md").read_text(encoding="utf-8").lower().split())
    assert f"in {parola} lingue" in testo, (
        f"i cataloghi dicono {quante} lingue: info.md deve dire «in {parola} lingue»"
    )


def test_la_scheda_non_promette_un_aggiornamento_senza_riavvio() -> None:
    """«Installa» posa i file nuovi; il Python in esecuzione resta il vecchio.

    La scheda diceva che il tasto «fa tutto» e nominava il riavvio solo per la
    strada di HACS: chi aggiorna dagli Aggiornamenti di Home Assistant resta
    convinto di aver finito e continua a far girare il codice di prima. Il
    riavvio vale per tutte e due le strade, e qui si controlla che la vetrina
    lo dica quanto lo dice il codice.
    """
    installa = (ROOT / "custom_components/dashboardmodern/update.py").read_text(
        encoding="utf-8"
    )
    assert "riavvia Home Assistant" in installa, (
        "se l'aggiornamento non chiede piu' il riavvio, questa prova va rivista"
    )
    # Il markdown va a capo dove gli pare: una frase si cerca a righe unite.
    testo = " ".join((ROOT / "info.md").read_text(encoding="utf-8").lower().split())
    assert "in tutti e due i casi" in testo
    assert "si riavvia home assistant" in testo


def test_il_pacchetto_resta_quello_dichiarato() -> None:
    """`zip_release` e il nome del file li scrive il rilascio: se cambiano qui
    e non la', HACS scarica un file che non esiste."""
    hacs = _hacs()
    assert hacs.get("zip_release") is True
    assert hacs.get("filename") == "dashboardmodern.zip"
    rilascio = (ROOT / ".github/workflows/release.yml").read_text(encoding="utf-8")
    assert "dashboardmodern.zip" in rilascio
