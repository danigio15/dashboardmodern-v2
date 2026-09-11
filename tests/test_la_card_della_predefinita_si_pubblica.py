"""La card che serve alla plancia PREDEFINITA viene pubblicata sempre.

«Plancia predefinita: Errore di configurazione» — segnalata dieci volte, e ogni
volta la stessa plancia aperta dalla barra laterale funziona.

Le due strade non usano lo stesso pezzo di codice, ed è tutto lì. La barra
laterale apre il PANNELLO, che si carica da sé. La dashboard predefinita apre
una dashboard Lovelace che dentro ha una card nostra, e quella card esiste solo
se il suo modulo è stato pubblicato con `add_extra_js_url`. Senza quel modulo
Home Assistant non trova l'elemento `dashboardmodern-card`, e quello che disegna
al suo posto è esattamente la schermata rossa: «Errore di configurazione».

E `add_extra_js_url` non è gentile: scrive in una casella di `hass.data` che
apre `frontend` quando si alza, e se quella casella non c'è ancora solleva
`KeyError`. Veniva chiamata a secco, in mezzo all'avvio della voce e PRIMA della
registrazione del pannello: un avvio in cui `frontend` non fosse ancora salito
non pubblicava la card e non registrava nemmeno il pannello.

Queste prove guardano le due cose che tengono in piedi la plancia predefinita:
che la card si pubblichi quando `frontend` c'è, e che un `frontend` in ritardo
non porti giù tutto il resto.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.components import frontend
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import frontend as fe
from custom_components.dashboardmodern.const import DOMAIN

RADICE = Path(__file__).resolve().parents[1]
MANIFEST = RADICE / "custom_components/dashboardmodern/manifest.json"


def _voce(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, entry_id="abcdef1234567890", title="Casa 3.0"
    )
    entry.add_to_hass(hass)
    return entry


def _moduli(hass: HomeAssistant) -> set[str]:
    gestore = hass.data.get(frontend.DATA_EXTRA_MODULE_URL)
    return set(getattr(gestore, "urls", set()) or set())


def test_il_manifest_dichiara_frontend() -> None:
    """Home Assistant alza prima quello che dichiariamo di volere.

    Senza questa riga l'ordine non è garantito da nessuno: la card si pubblica
    in un momento in cui `frontend` può non esserci ancora.
    """
    dati = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert "frontend" in dati["dependencies"]
    assert "http" in dati["dependencies"]


@pytest.mark.asyncio
async def test_la_card_si_pubblica(hass: HomeAssistant) -> None:
    """Col frontend in piedi, il modulo della card finisce dove il browser lo legge."""
    assert await async_setup_component(hass, "frontend", {})
    entry = _voce(hass)

    await fe.async_register_frontend(hass, entry.entry_id)
    await hass.async_block_till_done()

    indirizzi = _moduli(hass)
    assert any("dashboard-card.js" in url for url in indirizzi), indirizzi
    # L'indirizzo è quello stabile con la firma nella domanda: una pagina
    # rimasta in cache dopo un aggiornamento chiede una firma vecchia allo
    # stesso percorso e riceve la card di adesso, invece di un 404.
    (card,) = [url for url in indirizzi if "dashboard-card.js" in url]
    assert card.startswith("/dashboardmodern_static/dashboard-card.js?v=")


@pytest.mark.asyncio
async def test_un_frontend_in_ritardo_non_porta_giu_il_pannello(
    hass: HomeAssistant,
) -> None:
    """È il difetto: la card falliva e si portava dietro tutto il resto.

    `add_extra_js_url` solleva `KeyError` se la casella di `frontend` non c'è
    ancora. Quella riga sta PRIMA della registrazione del pannello: chi la
    incontrava restava senza card E senza voce nella barra laterale, cioè senza
    plancia.
    """
    # Frontend non avviato: la casella che `add_extra_js_url` vuole non esiste.
    assert frontend.DATA_EXTRA_MODULE_URL not in hass.data
    entry = _voce(hass)

    await fe.async_register_frontend(hass, entry.entry_id)
    await hass.async_block_till_done()

    # Il pannello c'è: la plancia si apre dalla barra laterale.
    pannelli = hass.data.get(frontend.DATA_PANELS, {})
    assert "dashboardmodern" in pannelli

    # E la card si pubblica appena il frontend si alza, senza che nessuno debba
    # riavviare o riaprire niente.
    assert await async_setup_component(hass, "frontend", {})
    await hass.async_block_till_done()
    assert any("dashboard-card.js" in url for url in _moduli(hass)), _moduli(hass)
