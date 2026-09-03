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

from custom_components.dashboardmodern import github_client
from custom_components.dashboardmodern.const import DOMAIN, OPTION_TICKETS_ENABLED
from custom_components.dashboardmodern.github_tokens import async_get_token_store
from custom_components.dashboardmodern.ticket_store import (
    STATE_DRAFT,
    TYPE_BUG,
    TYPE_SUPPORT,
)
from custom_components.dashboardmodern.websocket_api import (
    TYPE_TICKET_ANSWER,
    TYPE_TICKET_AUTH_FORGET,
    TYPE_TICKET_AUTH_START,
    TYPE_TICKET_CREATE,
    TYPE_TICKET_DELETE,
    TYPE_TICKET_LIST,
    TYPE_TICKET_QUEUE,
    TYPE_TICKET_THREAD,
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
def _commands(hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch) -> None:
    """Registra i comandi, e fingi che l'autorizzazione sia configurata.

    Senza `client_id` l'integrazione non parla con GitHub — che e' il
    comportamento giusto di serie — e meta' di quello che si prova qui non si
    vedrebbe affatto.
    """
    hass.data.setdefault(websocket_api.const.DOMAIN, {})
    monkeypatch.setattr(github_client, "configured", lambda: True)

    async def _mai_sulla_rete(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise AssertionError("una prova dei comandi non deve chiamare GitHub")

    # La porta verso GitHub e' una sola, e qui si tappa per tutte: quello che
    # si prova in questo file sono i comandi, non il trasporto.
    monkeypatch.setattr(github_client, "_request", _mai_sulla_rete)
    async_register_websocket_api(hass)


async def _collega(
    hass: HomeAssistant, user_id: str, *, maintainer: bool = False
) -> None:
    """Fingi che questo utente abbia gia' fatto il giro su github.com."""
    store = await async_get_token_store(hass)
    await store.async_remember(
        user_id, token=f"gho_{user_id}", login=f"{user_id}-hub", maintainer=maintainer
    )


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
    # La plancia saprebbe spedire, ma chi scrive non ha collegato il proprio
    # account: la segnalazione resta scritta, e non e' partito niente.
    assert creata["delivered"] is False

    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 2)
    assert [ticket["id"] for ticket in elenco["tickets"]] == [creata["ticket"]["id"]]
    assert elenco["delivery"] is True
    assert elenco["account"]["connected"] is False


async def test_senza_autorizzazione_la_plancia_lo_dice(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un tasto «invia» che non spedisce e' peggio di un tasto assente."""
    _entry(hass)
    monkeypatch.setattr(github_client, "configured", lambda: False)
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 1)
    assert elenco["delivery"] is False


async def test_spegnendole_non_parte_niente(hass: HomeAssistant) -> None:
    """Chi non vuole che la plancia parli fuori casa ha un interruttore."""
    _entry(hass, **{OPTION_TICKETS_ENABLED: False})
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 1)
    assert elenco["delivery"] is False


async def test_l_elenco_dice_chi_ha_collegato_l_account(
    hass: HomeAssistant,
) -> None:
    """La finestra deve sapere se offrire «invia» o «collega GitHub»."""
    _entry(hass)
    scollegato = await _command(
        hass, StubConnection(hass, user_id="anna"), {"type": TYPE_TICKET_LIST}, 1
    )
    assert scollegato["account"] == {
        "connected": False,
        "login": "",
        "maintainer": False,
    }
    await _collega(hass, "anna")
    collegato = await _command(
        hass, StubConnection(hass, user_id="anna"), {"type": TYPE_TICKET_LIST}, 2
    )
    assert collegato["account"]["login"] == "anna-hub"


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


async def test_la_console_chiede_amministratore_e_permessi(
    hass: HomeAssistant,
) -> None:
    """Due cose insieme: nessuna delle due, da sola, apre la coda di tutti."""
    _entry(hass)
    await _collega(hass, "anna", maintainer=True)
    code, _ = await _refused(
        hass,
        StubConnection(hass, is_admin=False, user_id="anna"),
        {"type": TYPE_TICKET_QUEUE},
        1,
    )
    assert code == websocket_api.const.ERR_UNAUTHORIZED

    # Amministratore di casa propria, ma senza permessi sulla repository:
    # non e' la console.
    await _collega(hass, "user-1", maintainer=False)
    code, _ = await _refused(hass, StubConnection(hass), {"type": TYPE_TICKET_QUEUE}, 2)
    assert code == "not_console"


async def test_senza_permessi_non_si_risponde_a_nessuno(
    hass: HomeAssistant,
) -> None:
    """Anche la risposta passa dallo stesso cancello della coda."""
    _entry(hass)
    code, _ = await _refused(
        hass,
        StubConnection(hass),
        {"type": TYPE_TICKET_ANSWER, "number": 1, "reply": "Ciao"},
        1,
    )
    assert code == "not_console"


async def test_la_console_si_accende_con_i_permessi(hass: HomeAssistant) -> None:
    """Lo dice GitHub, non una chiave incollata nelle opzioni."""
    _entry(hass)
    await _collega(hass, "user-1", maintainer=True)
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 1)
    assert elenco["console"] is True

    # E per chi non amministra Home Assistant resta spenta, permessi o no.
    await _collega(hass, "anna", maintainer=True)
    altro = await _command(
        hass,
        StubConnection(hass, is_admin=False, user_id="anna"),
        {"type": TYPE_TICKET_LIST},
        2,
    )
    assert altro["console"] is False


async def test_il_gettone_non_esce_mai_verso_il_browser(
    hass: HomeAssistant,
) -> None:
    """Nessuna risposta di questi comandi contiene il gettone, in nessuna forma."""
    _entry(hass)
    await _collega(hass, "user-1", maintainer=True)
    elenco = await _command(hass, StubConnection(hass), {"type": TYPE_TICKET_LIST}, 1)
    assert "gho_user-1" not in repr(elenco)
    assert elenco["account"]["login"] == "user-1-hub"


async def test_scollegare_dimentica_il_proprio_account(
    hass: HomeAssistant,
) -> None:
    """E ognuno scollega il proprio, non quello di un altro."""
    _entry(hass)
    await _collega(hass, "anna")
    anna = StubConnection(hass, is_admin=False, user_id="anna")
    assert await _command(hass, anna, {"type": TYPE_TICKET_AUTH_FORGET}, 1) == {
        "removed": True
    }
    elenco = await _command(hass, anna, {"type": TYPE_TICKET_LIST}, 2)
    assert elenco["account"]["connected"] is False


async def test_chi_non_puo_usare_la_plancia_non_collega_niente(
    hass: HomeAssistant,
) -> None:
    """Il cancello dell'autorizzazione e' lo stesso di tutti gli altri comandi."""
    _entry(hass, admin_only=True)
    code, _ = await _refused(
        hass,
        StubConnection(hass, is_admin=False, user_id="ospite"),
        {"type": TYPE_TICKET_AUTH_START},
        1,
    )
    assert code == websocket_api.const.ERR_UNAUTHORIZED


async def test_chi_non_puo_usare_la_plancia_non_apre_il_filo(
    hass: HomeAssistant,
) -> None:
    """Aprire il filo spegne il pallino di tutta la casa: non e' una lettura
    qualsiasi, e chiede lo stesso permesso degli altri comandi.
    """
    _entry(hass, admin_only=True)
    estraneo = StubConnection(hass, is_admin=False, user_id="ospite")
    code, _ = await _refused(
        hass, estraneo, {"type": TYPE_TICKET_THREAD, "number": 7}, 1
    )
    assert code == websocket_api.const.ERR_UNAUTHORIZED
