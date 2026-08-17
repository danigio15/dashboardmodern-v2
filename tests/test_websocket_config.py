"""The shared configuration is reachable over the WebSocket API."""

from __future__ import annotations

import json
from typing import Any

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.dashboardmodern.config_store import (
    PRIMARY_PROFILE,
    async_get_config_store,
)
from custom_components.dashboardmodern.websocket_api import (
    TYPE_GET,
    TYPE_RESTORE,
    TYPE_SET,
    async_register_websocket_api,
)

VALUES = {
    "dm_dashboard_state": json.dumps(
        {"schema_version": 4, "sections": {"rooms": [{"id": "r1", "name": "Cucina"}]}}
    ),
    "cd_stanze": json.dumps([{"id": "r1", "name": "Cucina", "temp": "sensor.t"}]),
}


async def _command(
    client: Any, payload: dict[str, Any], message_id: int
) -> dict[str, Any]:
    """Send one command and return its result."""
    await client.send_json({"id": message_id, **payload})
    message = await client.receive_json()
    assert message["success"] is True, message
    return message["result"]


@pytest.fixture(autouse=True)
async def _websocket_api(hass: HomeAssistant) -> None:
    """Register the commands on a Home Assistant with the WebSocket API up."""
    assert await async_setup_component(hass, "websocket_api", {})
    async_register_websocket_api(hass)


async def test_another_user_reads_the_configuration_it_never_wrote(
    hass: HomeAssistant,
    hass_ws_client: Any,
    hass_read_only_access_token: str,
) -> None:
    """The wipe that was really a per-user copy: one plancia for everybody.

    The configuration is stored by somebody else, and then read over the API by
    a different — and non-admin — user, which is precisely what
    frontend/get_user_data could not do: it would have answered this user with
    an empty copy of their own.
    """
    store = await async_get_config_store(hass)
    await store.async_set(PRIMARY_PROFILE, VALUES, keys_revision=2)

    other_user = await hass_ws_client(hass, hass_read_only_access_token)
    read = await _command(other_user, {"type": TYPE_GET}, 1)

    assert read["profile"] == PRIMARY_PROFILE
    assert read["snapshot"]["values"] == VALUES

    # And that user may save too: a non-admin plancia has to be able to keep its
    # own edits, so the commands are deliberately not admin-only.
    saved = await _command(
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


async def test_an_empty_write_is_refused_over_the_api(
    hass: HomeAssistant, hass_ws_client: Any
) -> None:
    """A device with nothing configured cannot empty the shared plancia."""
    client = await hass_ws_client(hass)
    await _command(
        client,
        {"type": TYPE_SET, "snapshot": {"values": VALUES, "keys_revision": 2}},
        1,
    )

    refused = await _command(
        client,
        {
            "type": TYPE_SET,
            "snapshot": {"values": {"cd_stanze": "[]"}, "keys_revision": 2},
        },
        2,
    )

    assert refused["status"] == "refused-empty"
    assert refused["snapshot"]["values"] == VALUES


async def test_a_reset_can_be_undone_from_the_kept_revision(
    hass: HomeAssistant, hass_ws_client: Any
) -> None:
    """After an explicit reset the previous revision is still restorable."""
    client = await hass_ws_client(hass)
    await _command(
        client,
        {"type": TYPE_SET, "snapshot": {"values": VALUES, "keys_revision": 2}},
        1,
    )
    reset = await _command(
        client,
        {
            "type": TYPE_SET,
            "snapshot": {"values": {"cd_stanze": "[]"}, "keys_revision": 2},
            "reset": True,
        },
        2,
    )
    assert reset["status"] == "saved"
    assert [item["revision"] for item in reset["recoverable"]] == [1]

    restored = await _command(client, {"type": TYPE_RESTORE, "revision": 1}, 3)

    assert restored["snapshot"]["values"] == VALUES


async def test_an_invalid_snapshot_is_rejected(
    hass: HomeAssistant, hass_ws_client: Any
) -> None:
    """The payload is validated before it can reach the store."""
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": TYPE_SET, "snapshot": {"values": "nope"}})
    message = await client.receive_json()
    assert message["success"] is False
