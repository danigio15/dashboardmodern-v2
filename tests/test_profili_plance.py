"""Ogni plancia ha il suo posto, anche quando si chiamano allo stesso modo.

Dal campo: «se aggiungo una nuova dashboard da integrazioni mi duplica quella
attuale, invece doveva crearne una ex novo sciolta dall'altra».

Il profilo — il nome della cassetta dove sta la configurazione — veniva dal
titolo della plancia. Chi ne aggiunge una seconda lascia il nome proposto, e due
plance con lo stesso nome finivano nella stessa cassetta: la nuova nasceva gia'
piena della configurazione dell'altra, e da li' in poi le due si scrivevano
addosso a vicenda.

Queste prove non hanno bisogno di Home Assistant: la parte che assegna i nomi e'
pura, e lo slugify si passa da fuori.
"""

from __future__ import annotations

from typing import Any

from custom_components.dashboardmodern.config_store import (
    PRIMARY_PROFILE,
    unique_profiles,
)


def slugify(value: str) -> str:
    """Uno slugify abbastanza fedele a quello di Home Assistant per la prova."""
    pulito = "".join(
        carattere.lower() if carattere.isalnum() else "-" for carattere in value
    )
    while "--" in pulito:
        pulito = pulito.replace("--", "-")
    return pulito.strip("-")


def test_due_plance_con_lo_stesso_nome_non_condividono_il_profilo() -> None:
    profili = unique_profiles(
        [
            ("aaaaaaaabbbbbbbb", "Casa", True),
            ("11111111cccccccc", "DashboardModern", False),
            ("22222222dddddddd", "DashboardModern", False),
        ],
        slugify=slugify,
    )
    assert profili["aaaaaaaabbbbbbbb"] == PRIMARY_PROFILE
    # Chi c'era prima tiene il suo posto: una plancia gia' configurata non si
    # sposta e non perde niente.
    assert profili["11111111cccccccc"] == "plancia-dashboardmodern"
    # Chi arriva dopo su un nome occupato ne riceve uno suo.
    assert profili["22222222dddddddd"] != profili["11111111cccccccc"]
    assert profili["22222222dddddddd"].startswith("plancia-dashboardmodern-")
    assert len(set(profili.values())) == 3


def test_nomi_diversi_restano_quelli_di_prima() -> None:
    """Chi ha nomi distinti non cambia posto: nessuna migrazione a sorpresa."""
    profili = unique_profiles(
        [
            ("aaaaaaaabbbbbbbb", "Casa", True),
            ("11111111cccccccc", "Casa al mare", False),
            ("22222222dddddddd", "Taverna", False),
        ],
        slugify=slugify,
    )
    assert profili["11111111cccccccc"] == "plancia-casa-al-mare"
    assert profili["22222222dddddddd"] == "plancia-taverna"


def test_una_plancia_senza_nome_si_riconosce_dal_suo_identificativo() -> None:
    profili = unique_profiles(
        [("aaaaaaaabbbbbbbb", "", False), ("11111111cccccccc", "", False)],
        slugify=slugify,
    )
    assert len(set(profili.values())) == 2


def _negozio(profiles: dict, entry_profiles: dict) -> Any:
    """Un negozio senza Home Assistant: serve solo la sua tabella dei nomi."""
    from custom_components.dashboardmodern.config_store import (
        DashboardConfigStore,
    )

    negozio = object.__new__(DashboardConfigStore)
    negozio._data = {"profiles": profiles, "entry_profiles": entry_profiles}
    return negozio


def test_il_ricordo_non_rimette_insieme_due_plance_separate() -> None:
    """Il ricordo del profilo segue un rinomino, non una cassetta di un'altra.

    Le due plance condividevano `plancia-dashboardmodern`. Da oggi la seconda ha
    il suo nome: se il ricordo la riportasse indietro, il giorno dopo sarebbero
    di nuovo la stessa.
    """
    negozio = _negozio(
        {"primary": {"values": {}}, "plancia-dashboardmodern": {"values": {}}},
        {
            "11111111cccccccc": "plancia-dashboardmodern",
            "22222222dddddddd": "plancia-dashboardmodern",
        },
    )
    risolto, _ = negozio._resolve("plancia-dashboardmodern-222222", "22222222dddddddd")
    assert risolto == "plancia-dashboardmodern-222222"


def test_il_ricordo_segue_ancora_un_rinomino() -> None:
    """Una plancia sola che cambia nome ritrova la sua configurazione."""
    negozio = _negozio(
        {"plancia-taverna": {"values": {}}},
        {"11111111cccccccc": "plancia-taverna"},
    )
    risolto, richiesto = negozio._resolve("plancia-cantina", "11111111cccccccc")
    assert risolto == "plancia-taverna"
    assert richiesto == "plancia-cantina"
