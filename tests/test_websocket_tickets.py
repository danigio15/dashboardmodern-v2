"""I comandi delle segnalazioni: chi puo' chiamarli, e cosa ottiene.

Come per la configurazione, i comandi si guidano attraverso l'handler e lo
schema che ``async_register_command`` ha davvero registrato — la stessa coppia
che ``ActiveConnection`` cerca all'arrivo di un messaggio — con una
connessione finta che raccoglie le risposte. Nessun server aiohttp: il
trasporto e' codice di Home Assistant, quello che appartiene a questa
integrazione sono registrazione, schema e comportamento.
"""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern.const import (
    DOMAIN,
    OPTION_MAINTAINER_TOKEN,
    OPTION_TICKET_ENDPOINT,
    OPTION_TICKETS_ENABLED,
)
from custom_components.dashboardmodern.ticket_store import (
    STATE_DRAFT,
    TYPE_BUG,
    TYPE_SUPPORT,
    async_get_ticket_store,
)
from custom_components.dashboardmodern.websocket_api import (
    TYPE_TICKET_ANSWER,
    TYPE_TICKET_CREATE,
    TYPE_TICKET_DELETE,
    TYPE_TICKET_LIST,
    TYPE_TICKET_QUEUE,
    async_register_websocket_api,
)


class StubConnection:
    """La superficie di ActiveConnection che questi comandi usano davvero."""

    def __init__(
        self, hass: HomeAssistant, *, is_admin: bool = True, user_id: str = "user-1"
    ) -> None:
        """Registra chi e' connesso e dove finiscono le risposte."""
        self.hass = hass
        self.user = SimpleUser(is_admin=is_admin, user_id=user_id)
        self.results: dict[int, Any] = {}
        self.errors: dict[int, tuple[str, str]] = {}

    def send_result(self, message_id: int, result: Any = None) -> None:
        """Raccogli una risposta riuscita."""
        self.results[message_id] = result

    def send_error(self, message_id: int, code: str, message: str) -> None:
        """Raccogli un rifiuto."""
        self.errors[message_id] = (code, message)


class SimpleUser:
    """Un utente connesso, amministratore o no."""

    def __init__(self, *, is_admin: bool, user_id: str) -> None:
        """Tieni solo quello che un controllo dei permessi leggerebbe."""
        self.id = user_id
        self.is_admin = is_admin


def _registered(hass: HomeAssistant, command: str) -> tuple[Any, Any]:
    handler, schema = hass.data[websocket_api.const.DOMAIN][command]
    return handler, schema


async def _run(
    hass: HomeAssistant,
    connection: StubConnection,
    payload: dict[str, Any],
    message_id: int,
) -> None:
    handler, schema = _registered(hass, payload["type"])
    # Uno schema con il solo «type» Home Assistant lo registra come `False`:
    # non c'e' niente da convalidare oltre alla busta, che qui e' gia' quella.
    message = {"id": message_id, **payload}
    if schema is not False:
        message = schema(message)
    await handler.__wrapped__(hass, connection, message)


async def _command(
    hass: HomeAssistant,
    connection: StubConnection,
    payload: dict[str, Any],
    message_id: int,
) -> Any:
    """Esegui un comando che deve riuscire."""
    await _run(hass, connection, payload, message_id)
    assert message_id not in connection.errors, connection.errors[message_id]
    return connection.results[message_id]


async def _refused(
    hass: HomeAssistant,
    connection: StubConnection,
    payload: dict[str, Any],
    message_id: int,
) -> tuple[str, str]:
    """Esegui un comando che deve essere rifiutato."""
    await _run(hass, connection, payload, message_id)
    assert message_id not in connection.results
    return connection.errors[message_id]


@pytest.fixture(autouse=True)
def _commands(hass: HomeAssistant) -> None:
    """Registra i comandi una volta per prova."""
    hass.data.setdefault(websocket_api.const.DOMAIN, {})
    async_register_websocket_api(hass)


def _entry(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, data={"name": "Plancia", "primary": True}, options=options
    )
    entry.add_to_hass(hass)
    return entry


_NUOVA = {
    "type": TYPE_TICKET_CREATE,
    "ticket_type": TYPE_BUG,
    "title": "Le tapparelle non si fermano",
    "body": "Premo stop e continuano a scendere.",
}


async def test_una_segnalazione_si_apre_dalla_plancia(hass: HomeAssistant) -> None:
    """Il giro completo: si scrive, si conserva, si rilegge."""
    creata = await _command(hass, StubConnection(hass), _NUOVA, 1)
    assert creata["ticket"]["title"] == "Le tapparelle non si fermano"
    assert creata["ticket"]["state"] == STATE_DRAFT
    # Nessun indirizzo configurato: non e' partito niente, e viene detto.
    assert creata["delivered"] is False

    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 2)
    assert [ticket["id"] for ticket in elenco["tickets"]] == [creata["ticket"]["id"]]
    assert elenco["delivery"] is False


async def test_senza_indirizzo_la_plancia_lo_dice(hass: HomeAssistant) -> None:
    """Un tasto «invia» che non spedisce e' peggio di un tasto assente."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: ""})
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 1)
    assert elenco["delivery"] is False


async def test_un_indirizzo_in_chiaro_non_vale(hass: HomeAssistant) -> None:
    """Quello che l'utente scrive a una persona sola non viaggia in chiaro."""
    _entry(hass, **{OPTION_TICKET_ENDPOINT: "http://relay.example.com"})
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 1)
    assert elenco["delivery"] is False


async def test_spegnendole_non_parte_niente(hass: HomeAssistant) -> None:
    """Chi non vuole che la plancia parli fuori casa ha un interruttore."""
    _entry(
        hass,
        **{
            OPTION_TICKET_ENDPOINT: "https://relay.example.com",
            OPTION_TICKETS_ENABLED: False,
        },
    )
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 1)
    assert elenco["delivery"] is False


async def test_ognuno_vede_le_proprie(hass: HomeAssistant) -> None:
    """La richiesta di assistenza di uno non e' lettura per gli altri."""
    anna = StubConnection(hass, is_admin=False, user_id="anna")
    bruno = StubConnection(hass, is_admin=False, user_id="bruno")
    await _command(hass, anna, {**_NUOVA, "ticket_type": TYPE_SUPPORT}, 1)
    elenco_bruno = await _command(hass, bruno, {"type": TYPE_TICKET_LIST}, 2)
    assert elenco_bruno["tickets"] == []
    elenco_anna = await _command(hass, anna, {"type": TYPE_TICKET_LIST}, 3)
    assert len(elenco_anna["tickets"]) == 1


async def test_l_amministratore_le_vede_tutte(hass: HomeAssistant) -> None:
    """Chi governa la plancia governa anche la sua coda."""
    await _command(
        hass, StubConnection(hass, is_admin=False, user_id="anna"), _NUOVA, 1
    )
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 2)
    assert len(elenco["tickets"]) == 1


async def test_chi_non_puo_usare_la_plancia_non_apre_ticket(
    hass: HomeAssistant,
) -> None:
    """La coda e' della plancia: chi non ce l'ha non ci scrive dentro."""
    _entry(hass, admin_only=True)
    estraneo = StubConnection(hass, is_admin=False, user_id="ospite")
    code, _ = await _refused(hass, estraneo, _NUOVA, 1)
    assert code == websocket_api.const.ERR_UNAUTHORIZED


async def test_un_tipo_inventato_non_passa_lo_schema(hass: HomeAssistant) -> None:
    """Il primo filtro e' lo schema, prima ancora dello store."""
    _, schema = _registered(hass, TYPE_TICKET_CREATE)
    with pytest.raises(vol.Invalid):
        schema({"id": 1, **_NUOVA, "ticket_type": "reclamo"})


async def test_un_titolo_vuoto_torna_col_suo_codice(hass: HomeAssistant) -> None:
    """Il frontend sceglie cosa dire in base al codice, non al testo."""
    code, _ = await _refused(hass, StubConnection(hass), {**_NUOVA, "title": "  "}, 1)
    assert code == "empty_title"


async def test_si_puo_ripensarci(hass: HomeAssistant) -> None:
    """Una segnalazione e' di chi l'ha scritta."""
    anna = StubConnection(hass, is_admin=False, user_id="anna")
    creata = await _command(hass, anna, _NUOVA, 1)
    tolta = await _command(
        hass,
        anna,
        {"type": TYPE_TICKET_DELETE, "ticket_id": creata["ticket"]["id"]},
        2,
    )
    assert tolta == {"removed": True}


async def test_nessuno_cancella_quella_di_un_altro(hass: HomeAssistant) -> None:
    """E il rifiuto non rivela nemmeno che esiste."""
    anna = StubConnection(hass, is_admin=False, user_id="anna")
    bruno = StubConnection(hass, is_admin=False, user_id="bruno")
    creata = await _command(hass, anna, _NUOVA, 1)
    code, _ = await _refused(
        hass,
        bruno,
        {"type": TYPE_TICKET_DELETE, "ticket_id": creata["ticket"]["id"]},
        2,
    )
    assert code == "not_found"


async def test_la_console_chiede_amministratore_e_chiave(
    hass: HomeAssistant,
) -> None:
    """Due cose insieme: nessuna delle due, da sola, apre la coda di tutti."""
    _entry(hass)
    code, _ = await _refused(
        hass,
        StubConnection(hass, is_admin=False, user_id="anna"),
        {"type": TYPE_TICKET_QUEUE},
        1,
    )
    assert code == websocket_api.const.ERR_UNAUTHORIZED

    # Amministratore di casa propria, ma senza chiave: non e' la console.
    code, _ = await _refused(hass, StubConnection(hass), {"type": TYPE_TICKET_QUEUE}, 2)
    assert code == "not_console"


async def test_senza_chiave_non_si_risponde_a_nessuno(hass: HomeAssistant) -> None:
    """Anche la risposta passa dallo stesso cancello della coda."""
    _entry(hass)
    code, _ = await _refused(
        hass,
        StubConnection(hass),
        {"type": TYPE_TICKET_ANSWER, "remote_id": "R-1", "state": "in-carico"},
        1,
    )
    assert code == "not_console"


async def test_la_console_si_accende_con_la_chiave(hass: HomeAssistant) -> None:
    """Con la chiave configurata, la plancia sa di essere la console."""
    _entry(
        hass,
        **{
            OPTION_MAINTAINER_TOKEN: "chiave-segreta",
            OPTION_TICKET_ENDPOINT: "https://relay.example.com",
        },
    )
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 1)
    assert elenco["console"] is True
    # E per chi non amministra resta spenta, chiave o non chiave.
    altro = await _command(
        hass,
        StubConnection(hass, is_admin=False, user_id="anna"),
        {"type": TYPE_TICKET_LIST},
        2,
    )
    assert altro["console"] is False


async def test_la_chiave_non_esce_mai_verso_il_browser(hass: HomeAssistant) -> None:
    """Nessuna risposta di questi comandi contiene la chiave, in nessuna forma."""
    _entry(
        hass,
        **{
            OPTION_MAINTAINER_TOKEN: "chiave-segreta",
            OPTION_TICKET_ENDPOINT: "https://relay.example.com",
        },
    )
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 1)
    assert "chiave-segreta" not in repr(elenco)
    assert elenco["console"] is True


async def test_l_identificativo_non_esce_verso_il_browser(
    hass: HomeAssistant,
) -> None:
    """Serve al relay per raggruppare, non alla plancia per mostrarlo."""
    await _command(hass, StubConnection(hass), _NUOVA, 1)
    store = await async_get_ticket_store(hass)
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 2)
    assert store.installation_id not in repr(elenco)
