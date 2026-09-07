"""Il timer non è un permesso in più: è lo stesso spegnimento, detto due ore prima.

Lo spegnimento programmato del clima (#364) lo fa scattare l'integrazione, con
`hass.services.async_call` e senza il contesto di chi l'aveva chiesto: Home
Assistant, a quel punto, non ha più modo di rimetterci sopra le sue regole sulle
entità. Il comando che arma il timer accettava qualunque entità esistesse — la
sola domanda era «esiste?» — e `homeassistant.turn_off` sceglie il dominio da
sé: una luce, una presa, una serranda, un'automazione.

Bastava poter aprire una plancia. Un utente non amministratore poteva quindi
spegnere, a scoppio ritardato, roba che la sua utenza non ha il diritto di
toccare.

Adesso la domanda si fa qui, ed è quella di Home Assistant: un amministratore
può sempre, gli altri solo dove hanno il controllo. La si fa quando si programma
e non a scadenza, di proposito — a scadenza, un permesso tolto nel frattempo
lascerebbe acceso il condizionatore tutta la notte, che è il guasto per cui
questa funzione esiste.
"""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from custom_components.dashboardmodern.websocket_api import (
    TYPE_CLIMA_TIMER_CLEAR,
    TYPE_CLIMA_TIMER_SET,
    async_register_websocket_api,
)


class _Permessi:
    """Le regole sulle entità di un utente, quel tanto che il codice ne legge."""

    def __init__(self, consentite: set[str]) -> None:
        self.consentite = consentite
        self.domande: list[tuple[str, str]] = []

    def check_entity(self, entita: str, quale: str) -> bool:
        self.domande.append((entita, quale))
        return entita in self.consentite


class _Utente:
    def __init__(self, *, is_admin: bool, consentite: set[str] | None = None) -> None:
        self.id = "user-1"
        self.is_admin = is_admin
        if consentite is not None:
            self.permissions = _Permessi(consentite)


class _Connessione:
    def __init__(self, hass: HomeAssistant, utente: Any) -> None:
        self.hass = hass
        self.user = utente
        self.results: dict[int, Any] = {}
        self.errors: dict[int, tuple[str, str]] = {}

    def send_result(self, message_id: int, result: Any = None) -> None:
        self.results[message_id] = result

    def send_error(self, message_id: int, code: str, message: str) -> None:
        self.errors[message_id] = (code, message)


@pytest.fixture(autouse=True)
def _comandi(hass: HomeAssistant) -> None:
    hass.data.setdefault(websocket_api.const.DOMAIN, {})
    async_register_websocket_api(hass)


async def _chiama(
    hass: HomeAssistant,
    connessione: _Connessione,
    payload: dict[str, Any],
    message_id: int = 1,
) -> None:
    handler, schema = hass.data[websocket_api.const.DOMAIN][payload["type"]]
    messaggio = schema({"id": message_id, **payload})
    await handler.__wrapped__(hass, connessione, messaggio)


async def _disarma(hass: HomeAssistant, entita: str) -> None:
    """Togli il timer che la prova ha armato: un allarme appeso è un test sporco."""
    from custom_components.dashboardmodern.spegnimento import (
        async_get_spegnimento_store,
    )

    store = await async_get_spegnimento_store(hass)
    await store.async_annulla(entita)


def _apri(hass: HomeAssistant) -> None:
    """Due entità in casa: quella del clima e una che non c'entra niente."""
    hass.states.async_set("climate.salotto", "heat", {})
    hass.states.async_set("lock.ingresso", "locked", {})


@pytest.mark.parametrize(
    "tipo", [TYPE_CLIMA_TIMER_SET, TYPE_CLIMA_TIMER_CLEAR], ids=["arma", "annulla"]
)
async def test_chi_non_comanda_l_entita_non_le_programma_niente(
    hass: HomeAssistant, tipo: str
) -> None:
    _apri(hass)
    ospite = _Connessione(hass, _Utente(is_admin=False, consentite={"climate.salotto"}))
    payload: dict[str, Any] = {"type": tipo, "entity_id": "lock.ingresso"}
    if tipo == TYPE_CLIMA_TIMER_SET:
        payload["minuti"] = 120

    await _chiama(hass, ospite, payload)

    assert 1 not in ospite.results
    codice, _ = ospite.errors[1]
    assert codice == websocket_api.const.ERR_UNAUTHORIZED
    assert ("lock.ingresso", "control") in ospite.user.permissions.domande


async def test_chi_comanda_l_entita_arma_il_timer(hass: HomeAssistant) -> None:
    _apri(hass)
    ospite = _Connessione(hass, _Utente(is_admin=False, consentite={"climate.salotto"}))

    await _chiama(
        hass,
        ospite,
        {"type": TYPE_CLIMA_TIMER_SET, "entity_id": "climate.salotto", "minuti": 90},
    )

    assert 1 not in ospite.errors, ospite.errors
    assert ospite.results[1]["entity_id"] == "climate.salotto"
    assert ospite.results[1]["scadenza"] > 0
    await _disarma(hass, "climate.salotto")


async def test_un_amministratore_non_deve_chiedere_permesso(
    hass: HomeAssistant,
) -> None:
    """Le regole sulle entità non si applicano a chi amministra, come in HA."""
    _apri(hass)
    padrone = _Connessione(hass, _Utente(is_admin=True))

    await _chiama(
        hass,
        padrone,
        {"type": TYPE_CLIMA_TIMER_SET, "entity_id": "lock.ingresso", "minuti": 30},
    )

    assert 1 not in padrone.errors, padrone.errors
    assert padrone.results[1]["entity_id"] == "lock.ingresso"
    await _disarma(hass, "lock.ingresso")


async def test_un_utente_senza_regole_leggibili_non_passa(
    hass: HomeAssistant,
) -> None:
    """Se non si riesce a fare la domanda, la risposta è no.

    È l'unico verso sicuro: il contrario vorrebbe dire che una connessione senza
    utente — o con un utente che non espone i suoi permessi — vale come un
    amministratore.
    """
    _apri(hass)
    ignoto = _Connessione(hass, _Utente(is_admin=False))

    await _chiama(
        hass,
        ignoto,
        {"type": TYPE_CLIMA_TIMER_SET, "entity_id": "climate.salotto", "minuti": 30},
    )

    assert ignoto.errors[1][0] == websocket_api.const.ERR_UNAUTHORIZED


async def test_un_entita_che_non_esiste_resta_un_non_trovato(
    hass: HomeAssistant,
) -> None:
    """La domanda sui permessi non deve coprire quella di prima."""
    _apri(hass)
    padrone = _Connessione(hass, _Utente(is_admin=True))

    await _chiama(
        hass,
        padrone,
        {"type": TYPE_CLIMA_TIMER_SET, "entity_id": "climate.mai_vista", "minuti": 30},
    )

    assert padrone.errors[1][0] == "not_found"


def test_la_firma_del_permesso_e_quella_di_home_assistant() -> None:
    """`POLICY_CONTROL` è la costante di HA, non una stringa scritta a mano."""
    from homeassistant.auth.permissions.const import POLICY_CONTROL

    assert POLICY_CONTROL == "control"


assert vol  # il modulo è importato per il tipo dello schema
