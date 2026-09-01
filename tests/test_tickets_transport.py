"""La consegna delle segnalazioni, con il relay simulato al posto della rete.

Quello che si prova qui e' il contratto verso il servizio: cosa si spedisce —
e soprattutto cosa non si spedisce — cosa succede quando dall'altra parte non
risponde nessuno, e chi puo' chiamare la coda del manutentore.
"""

from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import tickets
from custom_components.dashboardmodern.const import (
    DOMAIN,
    OPTION_MAINTAINER_TOKEN,
    OPTION_TICKET_ENDPOINT,
    OPTION_TICKETS_ENABLED,
)
from custom_components.dashboardmodern.ticket_store import (
    STATE_DRAFT,
    STATE_SENT,
    STATE_TRIAGED,
    TYPE_BUG,
    async_get_ticket_store,
)

ENDPOINT = "https://relay.example.com"


def _entry(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, data={"name": "Plancia", "primary": True}, options=options
    )
    entry.add_to_hass(hass)
    return entry


class Relay:
    """Un relay finto: registra cosa gli arriva e risponde quello che gli si dice."""

    def __init__(self, *, answers: dict[str, Any] | None = None) -> None:
        """Prepara le risposte per percorso, e il registro delle chiamate."""
        self.calls: list[tuple[str, dict[str, Any], str]] = []
        self.answers = answers or {}
        self.raises: Exception | None = None

    async def __call__(
        self,
        hass: HomeAssistant,
        path: str,
        payload: dict[str, Any],
        *,
        token: str = "",
    ) -> dict[str, Any]:
        """Prendi il posto di ``tickets._post``."""
        self.calls.append((path, payload, token))
        if self.raises is not None:
            raise self.raises
        return self.answers.get(path, {})


@pytest.fixture
def relay(monkeypatch: pytest.MonkeyPatch) -> Relay:
    """Sostituisci la chiamata di rete, e lascia intatto tutto il resto."""
    finto = Relay()
    monkeypatch.setattr(tickets, "_post", finto)
    return finto


async def _bug(hass: HomeAssistant, **kwargs: Any) -> dict[str, Any]:
    store = await async_get_ticket_store(hass)
    campi: dict[str, Any] = {
        "ticket_type": TYPE_BUG,
        "title": "Le tapparelle non si fermano",
        "body": "Premo stop e continuano a scendere.",
        "diagnostics": {"ha_version": "2026.8.0", "integration_version": "1.0.0"},
        "opened_by": "anna",
    }
    campi.update(kwargs)
    return await store.async_create(**campi)


async def test_senza_indirizzo_non_parte_una_richiesta(
    hass: HomeAssistant, relay: Relay
) -> None:
    """Chi tiene la plancia su una rete senza uscita non se ne accorge."""
    _entry(hass)
    await _bug(hass)
    assert await tickets.async_deliver_pending(hass) == 0
    assert await tickets.async_sync_states(hass) == 0
    assert relay.calls == []


async def test_spegnendole_non_parte_una_richiesta(
    hass: HomeAssistant, relay: Relay
) -> None:
    """L'interruttore vale davvero, anche con un indirizzo configurato."""
    _entry(
        hass,
        **{OPTION_TICKET_ENDPOINT: ENDPOINT, OPTION_TICKETS_ENABLED: False},
    )
    await _bug(hass)
    assert await tickets.async_deliver_pending(hass) == 0
    assert relay.calls == []


async def test_una_segnalazione_parte_e_torna_col_suo_numero(
    hass: HomeAssistant, relay: Relay
) -> None:
    """Consegnata: lo stato cambia, e il numero remoto resta scritto."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: ENDPOINT})
    relay.answers["/ticket"] = {"id": "R-42"}
    ticket = await _bug(hass)
    assert await tickets.async_deliver_pending(hass) == 1
    store = await async_get_ticket_store(hass)
    consegnato = store.list(every=True)[0]
    assert consegnato["id"] == ticket["id"]
    assert consegnato["state"] == STATE_SENT
    assert consegnato["remote_id"] == "R-42"


async def test_parte_solo_quello_che_e_stato_dichiarato(
    hass: HomeAssistant, relay: Relay
) -> None:
    """Il corpo della richiesta e' una lista chiusa, non il ticket com'e'.

    In particolare non ci sono ``opened_by`` — l'utente di Home Assistant che
    ha scritto — ne' l'identificativo locale del ticket.
    """
    _entry(hass, **{OPTION_TICKET_ENDPOINT: ENDPOINT})
    relay.answers["/ticket"] = {"id": "R-1"}
    await _bug(hass)
    await tickets.async_deliver_pending(hass)
    _, payload, _ = relay.calls[0]
    assert set(payload) == {
        "installation",
        "type",
        "title",
        "body",
        "contact",
        "diagnostics",
    }
    assert "anna" not in repr(payload)


async def test_la_diagnostica_che_parte_e_solo_quella_ammessa(
    hass: HomeAssistant, relay: Relay
) -> None:
    """Un frontend piu' nuovo del backend non allarga quello che esce di casa."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: ENDPOINT})
    relay.answers["/ticket"] = {"id": "R-1"}
    await _bug(
        hass,
        diagnostics={
            "ha_version": "2026.8.0",
            "ha_url": "https://casa.example.com",
            "token": "segreto",
        },
    )
    await tickets.async_deliver_pending(hass)
    _, payload, _ = relay.calls[0]
    assert payload["diagnostics"] == {"ha_version": "2026.8.0"}


async def test_il_servizio_muto_non_perde_la_segnalazione(
    hass: HomeAssistant, relay: Relay
) -> None:
    """Resta bozza, con scritto perche'; e al giro dopo riparte da sola."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: ENDPOINT})
    relay.raises = tickets.RelayUnavailable("Servizio non raggiungibile.")
    await _bug(hass)
    assert await tickets.async_deliver_pending(hass) == 0
    store = await async_get_ticket_store(hass)
    rimasta = store.list(every=True)[0]
    assert rimasta["state"] == STATE_DRAFT
    assert rimasta["delivery_error"] == "Servizio non raggiungibile."

    relay.raises = None
    relay.answers["/ticket"] = {"id": "R-7"}
    assert await tickets.async_deliver_pending(hass) == 1
    assert store.list(every=True)[0]["state"] == STATE_SENT


async def test_una_risposta_senza_numero_non_e_una_consegna(
    hass: HomeAssistant, relay: Relay
) -> None:
    """Un 200 vuoto non vale come «arrivata»: senza numero non si sincronizza."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: ENDPOINT})
    relay.answers["/ticket"] = {}
    await _bug(hass)
    assert await tickets.async_deliver_pending(hass) == 0
    store = await async_get_ticket_store(hass)
    assert store.list(every=True)[0]["state"] == STATE_DRAFT


async def test_lo_stato_torna_a_casa(hass: HomeAssistant, relay: Relay) -> None:
    """Chi ha aperto la segnalazione vede «presa in carico» senza chiedere."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: ENDPOINT})
    relay.answers["/ticket"] = {"id": "R-9"}
    await _bug(hass)
    await tickets.async_deliver_pending(hass)
    relay.answers["/sync"] = {
        "tickets": [
            {"remote_id": "R-9", "state": STATE_TRIAGED, "reply": "Riprodotta."}
        ]
    }
    assert await tickets.async_sync_states(hass) == 1
    store = await async_get_ticket_store(hass)
    aggiornata = store.list(every=True)[0]
    assert aggiornata["state"] == STATE_TRIAGED
    assert aggiornata["reply"] == "Riprodotta."


async def test_niente_da_chiedere_niente_da_spedire(
    hass: HomeAssistant, relay: Relay
) -> None:
    """Senza ticket gia' partiti la sync non disturba il relay."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: ENDPOINT})
    assert await tickets.async_sync_states(hass) == 0
    assert relay.calls == []


async def test_la_coda_chiede_la_chiave(hass: HomeAssistant, relay: Relay) -> None:
    """Senza chiave la richiesta non parte nemmeno: non e' la console."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: ENDPOINT})
    with pytest.raises(tickets.RelayUnavailable):
        await tickets.async_fetch_queue(hass)
    with pytest.raises(tickets.RelayUnavailable):
        await tickets.async_answer_ticket(hass, remote_id="R-1", state=STATE_TRIAGED)
    assert relay.calls == []


async def test_la_console_porta_la_chiave_nell_intestazione(
    hass: HomeAssistant, relay: Relay
) -> None:
    """La chiave viaggia dal backend, e solo verso il relay."""
    _entry(
        hass,
        **{
            OPTION_TICKET_ENDPOINT: ENDPOINT,
            OPTION_MAINTAINER_TOKEN: "chiave-segreta",
        },
    )
    relay.answers["/queue"] = {"tickets": [{"remote_id": "R-1", "title": "una"}]}
    coda = await tickets.async_fetch_queue(hass)
    assert coda == [{"remote_id": "R-1", "title": "una"}]
    percorso, _, token = relay.calls[0]
    assert (percorso, token) == ("/queue", "chiave-segreta")


async def test_un_indirizzo_in_chiaro_non_e_un_indirizzo(
    hass: HomeAssistant,
) -> None:
    """Solo https: quello che si scrive a una persona sola non viaggia in chiaro."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: "http://relay.example.com"})
    assert tickets.relay_endpoint(hass) == ""


async def test_la_barra_finale_non_raddoppia(hass: HomeAssistant) -> None:
    """Un indirizzo incollato con la barra non produce «//ticket»."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: f"{ENDPOINT}/"})
    assert tickets.relay_endpoint(hass) == ENDPOINT
