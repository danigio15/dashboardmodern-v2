"""The shared configuration is reachable over the WebSocket API.

The commands are driven through the handler and schema that
``async_register_command`` actually registered — the same pair
``ActiveConnection`` looks up when a message arrives — with a stand-in
connection collecting the replies.

No aiohttp test server is started on purpose. Doing that from a custom component
test makes Home Assistant spawn a process-wide ``_run_safe_shutdown_loop`` daemon
thread, which the harness's ``verify_cleanup`` fixture attributes to whichever
test happened to start the server and fails it. Real socket transport is Home
Assistant's own code; what belongs to this integration is the registration, the
schema and the handler behaviour, and all three are exercised here.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
import voluptuous as vol

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern.config_store import (
    PRIMARY_PROFILE,
    async_get_config_store,
)
from custom_components.dashboardmodern.const import DOMAIN
from custom_components.dashboardmodern.websocket_api import (
    TYPE_GET,
    TYPE_RESTORE,
    TYPE_SET,
    TYPE_WWW_LIST,
    async_register_websocket_api,
)

VALUES = {
    "dm_dashboard_state": json.dumps(
        {"schema_version": 4, "sections": {"rooms": [{"id": "r1", "name": "Cucina"}]}}
    ),
    "cd_stanze": json.dumps([{"id": "r1", "name": "Cucina", "temp": "sensor.t"}]),
}


class StubConnection:
    """The surface of ActiveConnection these commands actually use."""

    def __init__(self, hass: HomeAssistant, *, is_admin: bool = True) -> None:
        """Record who is connected and where the replies land."""
        self.hass = hass
        self.user = SimpleUser(is_admin=is_admin)
        self.results: dict[int, Any] = {}
        self.errors: dict[int, tuple[str, str]] = {}

    def send_result(self, message_id: int, result: Any = None) -> None:
        """Collect a successful reply."""
        self.results[message_id] = result

    def send_error(self, message_id: int, code: str, message: str) -> None:
        """Collect an error reply."""
        self.errors[message_id] = (code, message)


class SimpleUser:
    """A connected user, admin or not."""

    def __init__(self, *, is_admin: bool) -> None:
        """Store only what a permission check would read."""
        self.id = "user-1"
        self.is_admin = is_admin


def _registered(hass: HomeAssistant, command: str) -> tuple[Any, vol.Schema]:
    """Return the handler and schema registered for one command."""
    handler, schema = hass.data[websocket_api.const.DOMAIN][command]
    return handler, schema


async def _command(
    hass: HomeAssistant,
    connection: StubConnection,
    payload: dict[str, Any],
    message_id: int,
) -> dict[str, Any]:
    """Validate and run one command, returning its result."""
    handler, schema = _registered(hass, payload["type"])
    message = schema({"id": message_id, **payload})
    # async_response schedules the handler as a background task; functools.wraps
    # keeps the original coroutine reachable, so it is awaited directly instead
    # of leaving a task for the harness to complain about.
    await handler.__wrapped__(hass, connection, message)
    assert message_id not in connection.errors, connection.errors[message_id]
    return connection.results[message_id]


@pytest.fixture(autouse=True)
def _commands(hass: HomeAssistant) -> None:
    """Register the shared configuration commands."""
    hass.data.setdefault(websocket_api.const.DOMAIN, {})
    async_register_websocket_api(hass)


async def test_another_user_reads_the_configuration_it_never_wrote(
    hass: HomeAssistant,
) -> None:
    """The wipe that was really a per-user copy: one plancia for everybody.

    The configuration is stored by somebody else and then read by a different,
    non-admin user — precisely what frontend/get_user_data could not do, since it
    would have answered that user with an empty copy of their own.
    """
    store = await async_get_config_store(hass)
    await store.async_set(PRIMARY_PROFILE, VALUES, keys_revision=2)

    other_user = StubConnection(hass, is_admin=False)
    read = await _command(hass, other_user, {"type": TYPE_GET}, 1)

    assert read["profile"] == PRIMARY_PROFILE
    assert read["snapshot"]["values"] == VALUES

    # And that user may save too: a non-admin plancia has to be able to keep its
    # own edits, so these commands are deliberately not admin-only.
    saved = await _command(
        hass,
        other_user,
        {
            "type": TYPE_SET,
            "snapshot": {
                "values": {**VALUES, "cd_costo_kwh": "0.28"},
                "keys_revision": 2,
            },
            "expected_revision": read["snapshot"]["revision"],
        },
        2,
    )

    assert saved["status"] == "saved"
    stored = await store.async_get(PRIMARY_PROFILE)
    assert stored["snapshot"]["values"]["cd_costo_kwh"] == "0.28"


async def test_an_empty_write_is_refused_over_the_api(hass: HomeAssistant) -> None:
    """A device with nothing configured cannot empty the shared plancia."""
    connection = StubConnection(hass)
    await _command(
        hass,
        connection,
        {"type": TYPE_SET, "snapshot": {"values": VALUES, "keys_revision": 2}},
        1,
    )

    refused = await _command(
        hass,
        connection,
        {
            "type": TYPE_SET,
            "snapshot": {"values": {"cd_stanze": "[]"}, "keys_revision": 2},
        },
        2,
    )

    assert refused["status"] == "refused-empty"
    assert refused["snapshot"]["values"] == VALUES


async def test_a_reset_can_be_undone_from_the_kept_revision(
    hass: HomeAssistant,
) -> None:
    """After an explicit reset the previous revision is still restorable."""
    connection = StubConnection(hass)
    await _command(
        hass,
        connection,
        {"type": TYPE_SET, "snapshot": {"values": VALUES, "keys_revision": 2}},
        1,
    )
    reset = await _command(
        hass,
        connection,
        {
            "type": TYPE_SET,
            "snapshot": {"values": {"cd_stanze": "[]"}, "keys_revision": 2},
            "reset": True,
        },
        2,
    )
    assert reset["status"] == "saved"
    assert [item["revision"] for item in reset["recoverable"]] == [1]

    restored = await _command(
        hass, connection, {"type": TYPE_RESTORE, "revision": 1}, 3
    )

    assert restored["snapshot"]["values"] == VALUES


async def test_the_default_profile_is_the_primary_plancia(hass: HomeAssistant) -> None:
    """A message without a profile addresses the primary plancia."""
    _handler, schema = _registered(hass, TYPE_GET)

    message = schema({"id": 1, "type": TYPE_GET})

    assert message["profile"] == PRIMARY_PROFILE


async def test_an_invalid_snapshot_is_rejected(hass: HomeAssistant) -> None:
    """The payload is validated before it can reach the store."""
    _handler, schema = _registered(hass, TYPE_SET)

    for invalid in (
        {"values": "nope"},
        {"values": {"cd_stanze": 5}},
        {},
    ):
        with pytest.raises(vol.Invalid):
            schema({"id": 1, "type": TYPE_SET, "snapshot": invalid})


async def test_an_oversized_snapshot_is_reported_as_an_error(
    hass: HomeAssistant,
) -> None:
    """A snapshot beyond the accepted size fails the command, not the store."""
    connection = StubConnection(hass)
    handler, schema = _registered(hass, TYPE_SET)
    message = schema(
        {
            "id": 1,
            "type": TYPE_SET,
            "snapshot": {"values": {"cd_stanze": "x" * (3 * 1024 * 1024)}},
        }
    )

    await handler.__wrapped__(hass, connection, message)

    assert connection.results == {}
    assert connection.errors[1][0] == "snapshot_too_large"


async def _errore(
    hass: HomeAssistant,
    connection: StubConnection,
    payload: dict[str, Any],
    message_id: int,
) -> tuple[str, str]:
    """Run one command expecting it to be refused."""
    handler, schema = _registered(hass, payload["type"])
    message = schema({"id": message_id, **payload})
    await handler.__wrapped__(hass, connection, message)
    assert message_id not in connection.results, connection.results[message_id]
    return connection.errors[message_id]


def _plancia(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    """Una plancia installata, con le sue opzioni."""
    entry = MockConfigEntry(
        domain=DOMAIN, entry_id="entry-1", title="Casa", options=options
    )
    entry.add_to_hass(hass)
    return entry


async def test_la_plancia_riservata_agli_admin_lo_e_anche_qui(
    hass: HomeAssistant,
) -> None:
    """Il permesso stava nel browser, e un browser non e' un permesso.

    La lista di chi puo' aprire una plancia viaggiava dentro la configurazione
    del pannello e la applicava il frontend: chi non era in lista non la vedeva
    nella barra laterale e non riusciva ad aprirla, ma poteva chiamare questi
    comandi lo stesso e riscrivere la configurazione — che e' una sola per tutta
    l'installazione. Adesso la stessa regola vale anche qui.
    """
    _plancia(hass, admin_only=True)
    store = await async_get_config_store(hass)
    await store.async_set(PRIMARY_PROFILE, VALUES, keys_revision=2)

    ospite = StubConnection(hass, is_admin=False)
    codice, _ = await _errore(hass, ospite, {"type": TYPE_GET}, 1)
    assert codice == websocket_api.const.ERR_UNAUTHORIZED

    codice, _ = await _errore(
        hass,
        ospite,
        {
            "type": TYPE_SET,
            "snapshot": {
                "values": {**VALUES, "cd_costo_kwh": "9.99"},
                "keys_revision": 2,
            },
        },
        2,
    )
    assert codice == websocket_api.const.ERR_UNAUTHORIZED
    # E la configurazione di tutti e' rimasta quella di prima.
    stored = await store.async_get(PRIMARY_PROFILE)
    assert "cd_costo_kwh" not in stored["snapshot"]["values"]

    # L'amministratore invece passa, come e' sempre stato.
    padrone = StubConnection(hass)
    letto = await _command(hass, padrone, {"type": TYPE_GET}, 3)
    assert letto["snapshot"]["values"] == VALUES


async def test_chi_non_e_in_lista_non_scrive_per_gli_altri(
    hass: HomeAssistant,
) -> None:
    """Con una lista di utenti abilitati, vale per chiunque non ci sia."""
    _plancia(hass, allowed_users=["user-2"])
    store = await async_get_config_store(hass)
    await store.async_set(PRIMARY_PROFILE, VALUES, keys_revision=2)

    # `SimpleUser` si chiama sempre "user-1": fuori dalla lista.
    fuori = StubConnection(hass, is_admin=False)
    codice, _ = await _errore(hass, fuori, {"type": TYPE_WWW_LIST, "path": ""}, 1)
    assert codice == websocket_api.const.ERR_UNAUTHORIZED

    codice, _ = await _errore(hass, fuori, {"type": TYPE_RESTORE, "revision": 1}, 2)
    assert codice == websocket_api.const.ERR_UNAUTHORIZED


async def test_chi_e_in_lista_continua_a_salvare(hass: HomeAssistant) -> None:
    """Chi la plancia la puo' usare la puo' anche salvare.

    E' il motivo per cui questi comandi non sono semplicemente riservati agli
    amministratori: una plancia usata da un utente normale deve poter tenere le
    proprie modifiche. Quello che cambia e' solo che adesso «puo' usarla» lo
    decide il server.
    """
    _plancia(hass, allowed_users=["user-1"])
    store = await async_get_config_store(hass)
    await store.async_set(PRIMARY_PROFILE, VALUES, keys_revision=2)

    dentro = StubConnection(hass, is_admin=False)
    letto = await _command(hass, dentro, {"type": TYPE_GET}, 1)
    salvato = await _command(
        hass,
        dentro,
        {
            "type": TYPE_SET,
            "snapshot": {
                "values": {**VALUES, "cd_costo_kwh": "0.31"},
                "keys_revision": 2,
            },
            "expected_revision": letto["snapshot"]["revision"],
        },
        2,
    )
    assert salvato["status"] == "saved"


async def test_una_plancia_aperta_resta_aperta(hass: HomeAssistant) -> None:
    """Senza restrizioni scelte dal proprietario, non se ne inventano.

    La regola applicata qui e' quella della plancia, non una piu' severa: chi
    non ha ristretto niente continua a vedere la plancia funzionare per tutti in
    casa, che e' la scelta che ha fatto.
    """
    _plancia(hass)
    store = await async_get_config_store(hass)
    await store.async_set(PRIMARY_PROFILE, VALUES, keys_revision=2)

    chiunque = StubConnection(hass, is_admin=False)
    letto = await _command(hass, chiunque, {"type": TYPE_GET}, 1)
    assert letto["snapshot"]["values"] == VALUES
