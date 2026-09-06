"""La casa che sembra abitata: le decisioni, provate senza Home Assistant.

Le regole che contano sono tre, e sono qui: non si muove di giorno, non tiene
accese piu' luci di quante ne terrebbe una famiglia, e non spegne mai una luce
che ha acceso qualcun altro.
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from custom_components.dashboardmodern.presenza import (
    ACCESE_INSIEME,
    MASSIMO_ACCESA,
    MINIMO_ACCESA,
    Mossa,
    durata_accensione,
    e_sera,
    luci_della_plancia,
    prossima_mossa,
    tapparelle_della_plancia,
)

RADICE = Path(__file__).resolve().parents[1]
COMPONENT = RADICE / "custom_components" / "dashboardmodern"

SERA = datetime(2026, 9, 6, 21, 30)
NOTTE = datetime(2026, 9, 6, 23, 30)
GIORNO = datetime(2026, 9, 6, 12, 0)


class SempreSi(random.Random):
    """Un caso che dice sempre di si', per provare la regola e non la sorte."""

    def random(self) -> float:  # noqa: D102
        return 0.0


class SempreNo(random.Random):
    """E uno che dice sempre di no."""

    def random(self) -> float:  # noqa: D102
        return 1.0


def valori(luci: dict[str, str] | None = None, tapparelle: list | None = None) -> dict:
    """La configurazione della plancia com'e' salvata: valori scritti in JSON."""
    dato: dict[str, str] = {}
    if luci is not None:
        dato["cd_luci"] = json.dumps(luci)
    if tapparelle is not None:
        dato["cd_tapparelle"] = json.dumps(tapparelle)
    return dato


def test_le_luci_e_le_tapparelle_sono_quelle_della_plancia() -> None:
    """Nessuna seconda configurazione: si legge quella che c'e' gia'."""
    dato = valori(
        {"light.salone": "Salone", "switch.lampada": "Studio", "rotto": "no"},
        [{"entity": "cover.salone", "name": "Salone"}, {"name": "senza entita"}],
    )
    assert luci_della_plancia(dato) == ["light.salone", "switch.lampada"]
    assert tapparelle_della_plancia(dato) == ["cover.salone"]
    # Una plancia vuota non fa muovere niente, e non esplode.
    assert luci_della_plancia({}) == []
    assert tapparelle_della_plancia({"cd_tapparelle": "non e' json"}) == []


def test_di_giorno_la_casa_non_si_muove() -> None:
    """Una luce accesa a mezzogiorno non dice «c'e' qualcuno»."""
    assert e_sera(GIORNO, buio=False) is False
    assert e_sera(SERA, buio=True) is True
    # Dopo l'ora di dormire si smette, anche se fuori e' buio da un pezzo.
    assert e_sera(NOTTE, buio=True) is False
    mossa = prossima_mossa(
        luci_spente=["light.salone"],
        accese={},
        tapparelle_aperte=[],
        chiuse_da_noi={},
        adesso=GIORNO,
        buio=False,
        caso=SempreSi(),
    )
    assert mossa is None


def test_di_sera_accende_una_luce_per_volta_e_non_piu_di_tre() -> None:
    """Tre stanze illuminate sono una famiglia; dieci sono una vetrina."""
    luci = [f"light.stanza_{indice}" for indice in range(6)]
    mossa = prossima_mossa(
        luci_spente=luci,
        accese={},
        tapparelle_aperte=[],
        chiuse_da_noi={},
        adesso=SERA,
        buio=True,
        caso=SempreSi(),
    )
    assert isinstance(mossa, Mossa)
    assert mossa.azione == "accendi"
    assert mossa.entity in luci

    piene = {
        f"light.stanza_{indice}": SERA + timedelta(minutes=20)
        for indice in range(ACCESE_INSIEME)
    }
    assert (
        prossima_mossa(
            luci_spente=["light.stanza_5"],
            accese=piene,
            tapparelle_aperte=[],
            chiuse_da_noi={},
            adesso=SERA,
            buio=True,
            caso=SempreSi(),
        )
        is None
    )


def test_la_luce_scaduta_si_spegne_prima_di_accenderne_un_altra() -> None:
    """Senza questo ordine la casa accumula luci accese e non le spegne piu'."""
    mossa = prossima_mossa(
        luci_spente=["light.cucina"],
        accese={"light.salone": SERA - timedelta(minutes=1)},
        tapparelle_aperte=[],
        chiuse_da_noi={},
        adesso=SERA,
        buio=True,
        caso=SempreNo(),
    )
    assert mossa == Mossa("spegni", "light.salone")


def test_la_notte_e_il_giorno_rimettono_a_posto() -> None:
    """All'ora di dormire si spegne; col giorno si riaprono le tapparelle."""
    assert prossima_mossa(
        luci_spente=[],
        accese={"light.salone": NOTTE + timedelta(hours=1)},
        tapparelle_aperte=[],
        chiuse_da_noi={},
        adesso=NOTTE,
        buio=True,
        caso=SempreSi(),
    ) == Mossa("spegni", "light.salone")
    assert prossima_mossa(
        luci_spente=[],
        accese={},
        tapparelle_aperte=[],
        chiuse_da_noi={"cover.salone": SERA},
        adesso=GIORNO,
        buio=False,
        caso=SempreSi(),
    ) == Mossa("apri", "cover.salone")
    # Di notte le tapparelle chiuse restano chiuse: una casa che apre alle tre
    # non e' abitata.
    assert (
        prossima_mossa(
            luci_spente=[],
            accese={},
            tapparelle_aperte=[],
            chiuse_da_noi={"cover.salone": SERA},
            adesso=NOTTE,
            buio=True,
            caso=SempreSi(),
        )
        is None
    )


def test_le_tapparelle_si_chiudono_al_buio_una_per_giro() -> None:
    """Come farebbe chi rientra: prima le tapparelle, poi le luci."""
    mossa = prossima_mossa(
        luci_spente=["light.salone"],
        accese={},
        tapparelle_aperte=["cover.salone", "cover.cucina"],
        chiuse_da_noi={},
        adesso=SERA,
        buio=True,
        caso=SempreSi(),
    )
    assert mossa is not None
    assert mossa.azione == "chiudi"
    assert mossa.entity in ("cover.salone", "cover.cucina")


def test_ogni_accensione_dura_un_tempo_diverso() -> None:
    """Un tempo fisso si riconosce da fuori: dieci minuti esatti, ogni volta."""
    caso = random.Random(7)
    durate = {durata_accensione(caso) for _ in range(20)}
    assert len(durate) > 1
    for durata in durate:
        assert MINIMO_ACCESA <= durata <= MASSIMO_ACCESA


def test_spegne_soltanto_quello_che_ha_acceso_lei() -> None:
    """La simulazione non litiga con chi e' in casa.

    Il motore tiene l'elenco di cio' che ha acceso e spegne solo quello: una
    luce accesa da una persona non compare mai fra le candidate allo
    spegnimento. La regola sta nel codice, e qui si guarda che ci sia.
    """
    sorgente = (COMPONENT / "presenza.py").read_text(encoding="utf-8")
    assert "self._accese.pop(mossa.entity, None)" in sorgente
    assert 'if self._stato(entity) != "on":' in sorgente
    # E l'interruttore, spegnendosi, rimette a posto.
    interruttore = (COMPONENT / "switch.py").read_text(encoding="utf-8")
    assert "async_spegni" in interruttore
    assert "async_will_remove_from_hass" in interruttore
