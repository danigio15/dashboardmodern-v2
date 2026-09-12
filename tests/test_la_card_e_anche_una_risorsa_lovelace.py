"""La card della plancia predefinita arriva anche a una pagina rimasta in cache.

«Se imposto plancia predefinita da utente, da smartphone continua a dare
errore; da pc no.»

È la stessa segnalazione di sempre — «Errore di configurazione» sulla plancia
predefinita — con dentro il pezzo che mancava: da QUALE apparecchio. E quel
pezzo cambia la diagnosi.

Le due strade con cui un modulo del frontend arriva al browser non sono la
stessa cosa. `add_extra_js_url` lo scrive nell'AVVIO della pagina: Home
Assistant lo stampa dentro l'index che serve al primo caricamento. L'app
companion quell'index se lo tiene in cache a lungo — è il pezzo che le fa aprire
la plancia anche senza rete — quindi un index messo in cache prima che
l'integrazione ci fosse non nomina il nostro modulo, e continuerà a non
nominarlo finché la cache dura: `dashboardmodern-card` non viene mai definito, e
al suo posto Home Assistant disegna la schermata rossa. Il browser del computer
l'index lo richiede e basta, e lì il modulo c'è sempre.

Le RISORSE di Lovelace, invece, non stanno nell'index: il frontend se le fa dire
dal socket a ogni apertura della dashboard, e le importa allora. Anche una
pagina in cache le chiede, perché chiederle fa parte dell'apertura della
dashboard.

Queste prove tengono ferma la seconda strada: che la card ci sia fra le risorse,
che un aggiornamento rimetta in pari quella che c'è invece di aggiungerne una
seconda, e che un secondo avvio non ne fabbrichi un doppione.
"""

from __future__ import annotations

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import frontend as fe
from custom_components.dashboardmodern.const import DOMAIN


def _voce(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, entry_id="abcdef1234567890", title="Casa 3.0"
    )
    entry.add_to_hass(hass)
    return entry


def _risorse(hass: HomeAssistant) -> list[dict]:
    collezione = fe._risorse_di_lovelace(hass)
    assert collezione is not None, "Lovelace non espone le risorse"
    return [
        voce
        for voce in (collezione.async_items() or [])
        if "dashboard-card.js" in str(voce.get("url") or "")
    ]


@pytest.mark.asyncio
async def test_la_card_finisce_fra_le_risorse_di_lovelace(hass: HomeAssistant) -> None:
    """Chi apre la dashboard se la fa dire dal socket, non dalla pagina in cache."""
    assert await async_setup_component(hass, "lovelace", {})
    entry = _voce(hass)

    await fe.async_register_frontend(hass, entry.entry_id)
    await hass.async_block_till_done()

    trovate = _risorse(hass)
    assert len(trovate) == 1, trovate
    (risorsa,) = trovate
    assert risorsa["type"] == "module"
    # Lo stesso indirizzo stabile con la firma nella domanda che va nell'avvio
    # della pagina: due strade per lo stesso modulo, non due moduli.
    assert risorsa["url"].startswith("/dashboardmodern_static/dashboard-card.js?v=")


@pytest.mark.asyncio
async def test_un_secondo_avvio_non_fa_un_doppione(hass: HomeAssistant) -> None:
    """Riavviare non deve riempire l'elenco delle risorse della stessa riga."""
    assert await async_setup_component(hass, "lovelace", {})
    entry = _voce(hass)

    await fe.async_register_frontend(hass, entry.entry_id)
    await hass.async_block_till_done()
    await fe.async_register_frontend(hass, entry.entry_id)
    await hass.async_block_till_done()

    assert len(_risorse(hass)) == 1


@pytest.mark.asyncio
async def test_una_firma_vecchia_si_rimette_in_pari(hass: HomeAssistant) -> None:
    """Dopo un aggiornamento la firma cambia: si corregge la riga, non se ne aggiunge
    una."""
    assert await async_setup_component(hass, "lovelace", {})
    collezione = fe._risorse_di_lovelace(hass)
    await collezione.async_load()
    collezione.loaded = True
    await collezione.async_create_item(
        {
            "res_type": "module",
            "url": "/dashboardmodern_static/dashboard-card.js?v=firmavecchia",
        }
    )
    entry = _voce(hass)

    await fe.async_register_frontend(hass, entry.entry_id)
    await hass.async_block_till_done()

    trovate = _risorse(hass)
    assert len(trovate) == 1, trovate
    assert (
        trovate[0]["url"] != "/dashboardmodern_static/dashboard-card.js?v=firmavecchia"
    )


@pytest.mark.asyncio
async def test_senza_lovelace_non_si_rompe_niente(hass: HomeAssistant) -> None:
    """Lovelace in modo YAML o non ancora in piedi: la plancia si registra lo stesso."""
    entry = _voce(hass)

    await fe.async_register_frontend(hass, entry.entry_id)
    await hass.async_block_till_done()

    from homeassistant.components import frontend as ha_frontend

    pannelli = hass.data.get(ha_frontend.DATA_PANELS, {})
    assert "dashboardmodern" in pannelli
