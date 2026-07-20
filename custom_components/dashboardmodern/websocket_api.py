"""Home Assistant WebSocket API for DashboardModern dashboards."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from homeassistant.components import websocket_api

from .api.schemas import (
    CREATE_COMMAND,
    DELETE_COMMAND,
    GET_COMMAND,
    LIST_COMMAND,
    REPLACE_COMMAND,
    DashboardMessage,
)
from .api.serializers import deserialize_dashboard, serialize_dashboard
from .application import (
    CreateDashboardCommand,
    DashboardAlreadyExistsError,
    DashboardNotFoundError,
    DashboardPersistenceSyncError,
    DeleteDashboardCommand,
    ReplaceDashboardCommand,
)
from .const import (
    DATA_RUNTIMES,
    DATA_WEBSOCKET_REGISTERED,
    DOMAIN,
    ERR_DASHBOARD_ALREADY_EXISTS,
    ERR_DASHBOARD_NOT_FOUND,
    ERR_DASHBOARD_PERSISTENCE,
    ERR_DASHBOARDMODERN,
    ERR_ENTRY_NOT_FOUND,
    ERR_ENTRY_NOT_LOADED,
    ERR_INVALID_DASHBOARD,
    ERR_UNAUTHORIZED,
)
from .domain import DashboardId
from .domain.exceptions import ValidationError

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .runtime import DashboardModernRuntime

_LOGGER = logging.getLogger(__name__)

_ERROR_MESSAGES = {
    ERR_DASHBOARD_ALREADY_EXISTS: "Dashboard already exists",
    ERR_DASHBOARD_NOT_FOUND: "Dashboard not found",
    ERR_DASHBOARD_PERSISTENCE: "Dashboard persistence failed",
    ERR_ENTRY_NOT_FOUND: "DashboardModern config entry not found",
    ERR_ENTRY_NOT_LOADED: "DashboardModern config entry is not loaded",
    ERR_INVALID_DASHBOARD: "Invalid dashboard payload",
    ERR_UNAUTHORIZED: "Administrator privileges are required",
    ERR_DASHBOARDMODERN: "DashboardModern request failed",
}


def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register DashboardModern WebSocket commands once per Home Assistant instance."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_WEBSOCKET_REGISTERED):
        return

    domain_data.setdefault(DATA_RUNTIMES, {})
    websocket_api.async_register_command(hass, websocket_list_dashboards)
    websocket_api.async_register_command(hass, websocket_get_dashboard)
    websocket_api.async_register_command(hass, websocket_create_dashboard)
    websocket_api.async_register_command(hass, websocket_replace_dashboard)
    websocket_api.async_register_command(hass, websocket_delete_dashboard)
    domain_data[DATA_WEBSOCKET_REGISTERED] = True


def _send_error(
    connection: websocket_api.ActiveConnection, msg: DashboardMessage, code: str
) -> None:
    """Send a stable DashboardModern WebSocket error."""
    connection.send_error(msg["id"], code, _ERROR_MESSAGES[code])


def _require_admin(
    connection: websocket_api.ActiveConnection, msg: DashboardMessage
) -> bool:
    """Return true when the connection is allowed to mutate dashboards."""
    user = getattr(connection, "user", None)
    if getattr(user, "is_admin", False):
        return True
    _send_error(connection, msg, ERR_UNAUTHORIZED)
    return False


def _runtime_for_entry(
    hass: HomeAssistant, entry_id: str
) -> tuple[DashboardModernRuntime | None, str | None]:
    """Resolve loaded runtime data for a config entry."""
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None:
        return None, ERR_ENTRY_NOT_FOUND

    domain_data = hass.data.get(DOMAIN, {})
    runtime = domain_data.get(DATA_RUNTIMES, {}).get(entry_id)
    if runtime is None or getattr(entry, "runtime_data", None) is None:
        return None, ERR_ENTRY_NOT_LOADED
    if runtime is not entry.runtime_data:
        return None, ERR_ENTRY_NOT_LOADED
    if getattr(runtime, "application", None) is None:
        return None, ERR_ENTRY_NOT_LOADED
    return runtime, None


def _handle_application_error(
    connection: websocket_api.ActiveConnection,
    msg: DashboardMessage,
    error: Exception,
) -> None:
    """Map application exceptions to stable WebSocket errors."""
    if isinstance(error, DashboardAlreadyExistsError):
        _send_error(connection, msg, ERR_DASHBOARD_ALREADY_EXISTS)
    elif isinstance(error, DashboardNotFoundError):
        _send_error(connection, msg, ERR_DASHBOARD_NOT_FOUND)
    elif isinstance(error, DashboardPersistenceSyncError):
        _send_error(connection, msg, ERR_DASHBOARD_PERSISTENCE)
    elif isinstance(error, (ValidationError, KeyError, TypeError, ValueError)):
        _send_error(connection, msg, ERR_INVALID_DASHBOARD)
    else:
        _LOGGER.exception("Unexpected DashboardModern WebSocket API failure")
        _send_error(connection, msg, ERR_DASHBOARDMODERN)


def _decode_dashboard(
    connection: websocket_api.ActiveConnection, msg: DashboardMessage
) -> Any | None:
    """Decode and validate a dashboard payload into a domain object."""
    try:
        return deserialize_dashboard(msg["dashboard"])
    except (ValidationError, KeyError, TypeError, ValueError):
        _send_error(connection, msg, ERR_INVALID_DASHBOARD)
        return None


@websocket_api.websocket_command(LIST_COMMAND)
@websocket_api.async_response
async def websocket_list_dashboards(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: DashboardMessage,
) -> None:
    """Handle dashboard list requests."""
    runtime, error = _runtime_for_entry(hass, msg["entry_id"])
    if error is not None:
        _send_error(connection, msg, error)
        return

    try:
        dashboards = await runtime.application.async_list_dashboards()
    except Exception as err:  # noqa: BLE001
        _handle_application_error(connection, msg, err)
        return
    connection.send_result(
        msg["id"], {"dashboards": [serialize_dashboard(item) for item in dashboards]}
    )


@websocket_api.websocket_command(GET_COMMAND)
@websocket_api.async_response
async def websocket_get_dashboard(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: DashboardMessage,
) -> None:
    """Handle dashboard get requests."""
    runtime, error = _runtime_for_entry(hass, msg["entry_id"])
    if error is not None:
        _send_error(connection, msg, error)
        return

    try:
        dashboard = await runtime.application.async_get_dashboard(
            DashboardId.from_raw(msg["dashboard_id"])
        )
    except Exception as err:  # noqa: BLE001
        _handle_application_error(connection, msg, err)
        return
    connection.send_result(msg["id"], {"dashboard": serialize_dashboard(dashboard)})


@websocket_api.websocket_command(CREATE_COMMAND)
@websocket_api.async_response
async def websocket_create_dashboard(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: DashboardMessage,
) -> None:
    """Handle dashboard create requests."""
    if not _require_admin(connection, msg):
        return
    dashboard = _decode_dashboard(connection, msg)
    if dashboard is None:
        return
    runtime, error = _runtime_for_entry(hass, msg["entry_id"])
    if error is not None:
        _send_error(connection, msg, error)
        return

    try:
        created = await runtime.application.async_create_dashboard(
            CreateDashboardCommand(dashboard)
        )
    except Exception as err:  # noqa: BLE001
        _handle_application_error(connection, msg, err)
        return
    connection.send_result(msg["id"], {"dashboard": serialize_dashboard(created)})


@websocket_api.websocket_command(REPLACE_COMMAND)
@websocket_api.async_response
async def websocket_replace_dashboard(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: DashboardMessage,
) -> None:
    """Handle dashboard replace requests."""
    if not _require_admin(connection, msg):
        return
    dashboard = _decode_dashboard(connection, msg)
    if dashboard is None:
        return
    runtime, error = _runtime_for_entry(hass, msg["entry_id"])
    if error is not None:
        _send_error(connection, msg, error)
        return

    try:
        replaced = await runtime.application.async_replace_dashboard(
            ReplaceDashboardCommand(dashboard)
        )
    except Exception as err:  # noqa: BLE001
        _handle_application_error(connection, msg, err)
        return
    connection.send_result(msg["id"], {"dashboard": serialize_dashboard(replaced)})


@websocket_api.websocket_command(DELETE_COMMAND)
@websocket_api.async_response
async def websocket_delete_dashboard(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: DashboardMessage,
) -> None:
    """Handle dashboard delete requests."""
    if not _require_admin(connection, msg):
        return
    runtime, error = _runtime_for_entry(hass, msg["entry_id"])
    if error is not None:
        _send_error(connection, msg, error)
        return

    try:
        dashboard_id = DashboardId.from_raw(msg["dashboard_id"])
        await runtime.application.async_delete_dashboard(
            DeleteDashboardCommand(dashboard_id)
        )
    except Exception as err:  # noqa: BLE001
        _handle_application_error(connection, msg, err)
        return
    connection.send_result(
        msg["id"], {"dashboard_id": msg["dashboard_id"], "deleted": True}
    )
