"""WebSocket commands for the shared plancia configuration.

These replace ``frontend/get_user_data`` / ``frontend/set_user_data`` as the
transport of the dashboard configuration. The user_data API stores one copy per
Home Assistant user, which is exactly why a second user or a fresh device saw an
unconfigured plancia; these commands read and write the single shared store, so
every user and every device of one installation see the same configuration.

They are available to any authenticated user on purpose. Restricting writes to
admins would leave a non-admin plancia unable to save its own edits, and the
panel already enforces who may open a plancia at all through its allow-list.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import callback

from .config_store import (
    PRIMARY_PROFILE,
    SnapshotTooLargeError,
    async_get_config_store,
)
from .const import DOMAIN
from .www_files import list_www_folder

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

DATA_WEBSOCKET_REGISTERED = "websocket_registered"

TYPE_GET = f"{DOMAIN}/config/get"
TYPE_SET = f"{DOMAIN}/config/set"
TYPE_RESTORE = f"{DOMAIN}/config/restore"
TYPE_WWW_LIST = f"{DOMAIN}/www/list"

_PROFILE = vol.All(str, vol.Length(min=1, max=64))
_ENTRY_ID = vol.All(str, vol.Length(min=1, max=64))


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_GET,
        vol.Optional("profile", default=PRIMARY_PROFILE): _PROFILE,
        vol.Optional("entry_id"): _ENTRY_ID,
    }
)
@websocket_api.async_response
async def async_get_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the shared snapshot of one plancia."""
    store = await async_get_config_store(hass)
    result = await store.async_get(msg["profile"], entry_id=msg.get("entry_id"))
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_SET,
        vol.Optional("profile", default=PRIMARY_PROFILE): _PROFILE,
        vol.Optional("entry_id"): _ENTRY_ID,
        vol.Required("snapshot"): vol.Schema(
            {
                vol.Required("values"): {str: str},
                vol.Optional("keys_revision", default=0): vol.Coerce(int),
                vol.Optional("updated_at", default=0): vol.Coerce(int),
            },
            extra=vol.REMOVE_EXTRA,
        ),
        vol.Optional("expected_revision"): vol.Any(None, vol.Coerce(int)),
        vol.Optional("reset", default=False): bool,
    }
)
@websocket_api.async_response
async def async_set_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Store a snapshot for one plancia."""
    store = await async_get_config_store(hass)
    snapshot = msg["snapshot"]
    try:
        result = await store.async_set(
            msg["profile"],
            snapshot["values"],
            entry_id=msg.get("entry_id"),
            keys_revision=snapshot["keys_revision"],
            updated_at=snapshot["updated_at"],
            expected_revision=msg.get("expected_revision"),
            reset=msg["reset"],
        )
    except SnapshotTooLargeError as error:
        connection.send_error(msg["id"], "snapshot_too_large", str(error))
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_RESTORE,
        vol.Optional("profile", default=PRIMARY_PROFILE): _PROFILE,
        vol.Optional("entry_id"): _ENTRY_ID,
        vol.Required("revision"): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def async_restore_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Promote a kept revision of one plancia back to current."""
    store = await async_get_config_store(hass)
    result = await store.async_restore(
        msg["profile"], msg["revision"], entry_id=msg.get("entry_id")
    )
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_WWW_LIST,
        vol.Optional("path", default=""): vol.All(str, vol.Length(max=512)),
    }
)
@websocket_api.async_response
async def async_list_www(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Elenca una cartella di ``config/www`` per il selettore delle foto."""
    result = await hass.async_add_executor_job(
        list_www_folder, hass.config.path("www"), msg["path"]
    )
    if result is None:
        connection.send_error(
            msg["id"], "not_found", "La cartella non esiste dentro config/www"
        )
        return
    connection.send_result(msg["id"], result)


@callback
def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register the shared configuration commands once per installation."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_WEBSOCKET_REGISTERED):
        return
    for command in (
        async_get_config,
        async_set_config,
        async_restore_config,
        async_list_www,
    ):
        websocket_api.async_register_command(hass, command)
    domain_data[DATA_WEBSOCKET_REGISTERED] = True
