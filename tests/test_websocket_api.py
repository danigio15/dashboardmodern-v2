"""Tests for the DashboardModern WebSocket API boundary."""

from __future__ import annotations

import json
from dataclasses import dataclass
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from custom_components.dashboardmodern.api.serializers import serialize_dashboard
from custom_components.dashboardmodern.application import DashboardPersistenceSyncError
from custom_components.dashboardmodern.const import (
    DATA_WEBSOCKET_REGISTERED,
    DOMAIN,
    ERR_DASHBOARD_NOT_FOUND,
    ERR_DASHBOARD_PERSISTENCE,
    ERR_ENTRY_NOT_FOUND,
    ERR_ENTRY_NOT_LOADED,
    ERR_INVALID_DASHBOARD,
    ERR_UNAUTHORIZED,
    WS_TYPE_DASHBOARD_CREATE,
    WS_TYPE_DASHBOARD_DELETE,
    WS_TYPE_DASHBOARD_GET,
    WS_TYPE_DASHBOARD_LIST,
    WS_TYPE_DASHBOARD_REPLACE,
)
from custom_components.dashboardmodern.domain import Dashboard, DashboardRegistry
from custom_components.dashboardmodern.runtime import DashboardModernRuntime
from custom_components.dashboardmodern.websocket_api import (
    async_register_websocket_api,
)
from custom_components.dashboardmodern.websocket_api import (
    websocket_create_dashboard as decorated_create_dashboard,
)
from custom_components.dashboardmodern.websocket_api import (
    websocket_delete_dashboard as decorated_delete_dashboard,
)
from custom_components.dashboardmodern.websocket_api import (
    websocket_get_dashboard as decorated_get_dashboard,
)
from custom_components.dashboardmodern.websocket_api import (
    websocket_list_dashboards as decorated_list_dashboards,
)
from custom_components.dashboardmodern.websocket_api import (
    websocket_replace_dashboard as decorated_replace_dashboard,
)
from tests.helpers import dashboard

websocket_list_dashboards = decorated_list_dashboards.__wrapped__
websocket_get_dashboard = decorated_get_dashboard.__wrapped__
websocket_create_dashboard = decorated_create_dashboard.__wrapped__
websocket_replace_dashboard = decorated_replace_dashboard.__wrapped__
websocket_delete_dashboard = decorated_delete_dashboard.__wrapped__


@dataclass
class FakeEntry:
    """Fake config entry."""

    entry_id: str
    runtime_data: object | None


class FakeConfigEntries:
    """Fake config entry manager."""

    def __init__(self, entries: dict[str, FakeEntry]) -> None:
        self._entries = entries

    def async_get_entry(self, entry_id: str) -> FakeEntry | None:
        """Return a fake config entry."""
        return self._entries.get(entry_id)


class FakeRepository:
    """Fake async repository."""

    async def async_save(self, dashboard: Dashboard) -> None:
        """Pretend to save."""

    async def async_delete(self, dashboard_id: object) -> None:
        """Pretend to delete."""

    async def async_replace_all(self, dashboards: tuple[Dashboard, ...]) -> None:
        """Pretend to replace all."""


class FakeConnection:
    """Fake WebSocket connection."""

    def __init__(self, *, is_admin: bool = True) -> None:
        self.user = SimpleNamespace(is_admin=is_admin)
        self.results: list[tuple[int, dict]] = []
        self.errors: list[tuple[int, str, str]] = []

    def send_result(self, msg_id: int, result: dict) -> None:
        """Capture a result."""
        json.dumps(result)
        self.results.append((msg_id, result))

    def send_error(self, msg_id: int, code: str, message: str) -> None:
        """Capture an error."""
        self.errors.append((msg_id, code, message))


def _runtime(*dashboards: Dashboard) -> DashboardModernRuntime:
    registry = DashboardRegistry()
    for item in dashboards:
        registry.add(item)
    repository = FakeRepository()
    return DashboardModernRuntime(
        hass=SimpleNamespace(),
        entry_id="entry-1",
        repository=repository,
        dashboards=registry,
    )


def _hass(
    entries: dict[str, FakeEntry] | None = None, data: dict[str, object] | None = None
) -> SimpleNamespace:
    return SimpleNamespace(
        data=data if data is not None else {},
        config_entries=FakeConfigEntries(entries or {}),
    )


def _msg(type_: str, **extra: object) -> dict[str, object]:
    return {"id": 1, "type": type_, "entry_id": "entry-1", **extra}


@pytest.mark.asyncio
async def test_list_empty() -> None:
    runtime = _runtime()
    entry = FakeEntry("entry-1", runtime)
    hass = _hass({"entry-1": entry}, {DOMAIN: {"entry-1": runtime}})
    connection = FakeConnection()

    await websocket_list_dashboards(hass, connection, _msg(WS_TYPE_DASHBOARD_LIST))

    assert connection.results == [(1, {"dashboards": []})]


@pytest.mark.asyncio
async def test_list_existing_dashboards_and_order() -> None:
    first = dashboard("b-dashboard", "B")
    second = dashboard("a-dashboard", "A")
    runtime = _runtime(first, second)
    entry = FakeEntry("entry-1", runtime)
    hass = _hass({"entry-1": entry}, {DOMAIN: {"entry-1": runtime}})
    connection = FakeConnection()

    await websocket_list_dashboards(hass, connection, _msg(WS_TYPE_DASHBOARD_LIST))

    assert connection.results[0][1] == {
        "dashboards": [serialize_dashboard(first), serialize_dashboard(second)]
    }


@pytest.mark.asyncio
async def test_get_existing_and_missing() -> None:
    item = dashboard()
    runtime = _runtime(item)
    entry = FakeEntry("entry-1", runtime)
    hass = _hass({"entry-1": entry}, {DOMAIN: {"entry-1": runtime}})

    ok = FakeConnection()
    await websocket_get_dashboard(
        hass, ok, _msg(WS_TYPE_DASHBOARD_GET, dashboard_id=str(item.id))
    )
    assert ok.results[0][1] == {"dashboard": serialize_dashboard(item)}

    missing = FakeConnection()
    await websocket_get_dashboard(
        hass, missing, _msg(WS_TYPE_DASHBOARD_GET, dashboard_id="missing")
    )
    assert missing.errors[0][1] == ERR_DASHBOARD_NOT_FOUND


@pytest.mark.asyncio
async def test_create_replace_delete_semantics_and_missing_errors() -> None:
    runtime = _runtime()
    entry = FakeEntry("entry-1", runtime)
    hass = _hass({"entry-1": entry}, {DOMAIN: {"entry-1": runtime}})
    item = dashboard()

    created = FakeConnection()
    await websocket_create_dashboard(
        hass,
        created,
        _msg(WS_TYPE_DASHBOARD_CREATE, dashboard=serialize_dashboard(item)),
    )
    assert created.results[0][1] == {"dashboard": serialize_dashboard(item)}

    duplicate = FakeConnection()
    await websocket_create_dashboard(
        hass,
        duplicate,
        _msg(WS_TYPE_DASHBOARD_CREATE, dashboard=serialize_dashboard(item)),
    )
    assert duplicate.errors[0][1] == "dashboard_already_exists"

    updated = item.copy_with(title="Updated")
    replaced = FakeConnection()
    await websocket_replace_dashboard(
        hass,
        replaced,
        _msg(WS_TYPE_DASHBOARD_REPLACE, dashboard=serialize_dashboard(updated)),
    )
    assert replaced.results[0][1] == {"dashboard": serialize_dashboard(updated)}

    missing_replace = FakeConnection()
    await websocket_replace_dashboard(
        hass,
        missing_replace,
        _msg(
            WS_TYPE_DASHBOARD_REPLACE,
            dashboard=serialize_dashboard(dashboard("missing")),
        ),
    )
    assert missing_replace.errors[0][1] == ERR_DASHBOARD_NOT_FOUND

    deleted = FakeConnection()
    await websocket_delete_dashboard(
        hass, deleted, _msg(WS_TYPE_DASHBOARD_DELETE, dashboard_id=str(item.id))
    )
    assert deleted.results[0][1] == {"dashboard_id": str(item.id), "deleted": True}

    missing_delete = FakeConnection()
    await websocket_delete_dashboard(
        hass, missing_delete, _msg(WS_TYPE_DASHBOARD_DELETE, dashboard_id=str(item.id))
    )
    assert missing_delete.errors[0][1] == ERR_DASHBOARD_NOT_FOUND


@pytest.mark.asyncio
async def test_invalid_payload_id_entry_and_unloaded_errors() -> None:
    runtime = _runtime()
    entry = FakeEntry("entry-1", runtime)
    hass = _hass({"entry-1": entry}, {DOMAIN: {"entry-1": runtime}})

    invalid_payload = FakeConnection()
    await websocket_create_dashboard(
        hass, invalid_payload, _msg(WS_TYPE_DASHBOARD_CREATE, dashboard={"id": "bad"})
    )
    assert invalid_payload.errors[0][1] == ERR_INVALID_DASHBOARD

    invalid_id = FakeConnection()
    await websocket_get_dashboard(
        hass, invalid_id, _msg(WS_TYPE_DASHBOARD_GET, dashboard_id=" ")
    )
    assert invalid_id.errors[0][1] == ERR_INVALID_DASHBOARD

    unknown = FakeConnection()
    await websocket_list_dashboards(
        hass, unknown, _msg(WS_TYPE_DASHBOARD_LIST, entry_id="unknown")
    )
    assert unknown.errors[0][1] == ERR_ENTRY_NOT_FOUND

    unloaded = FakeConnection()
    unloaded_entry = FakeEntry("entry-2", None)
    hass_unloaded = _hass({"entry-2": unloaded_entry}, {DOMAIN: {}})
    await websocket_list_dashboards(
        hass_unloaded, unloaded, _msg(WS_TYPE_DASHBOARD_LIST, entry_id="entry-2")
    )
    assert unloaded.errors[0][1] == ERR_ENTRY_NOT_LOADED


@pytest.mark.asyncio
async def test_persistence_failure_and_admin_authorization() -> None:
    runtime = _runtime()
    runtime.application.async_create_dashboard = AsyncMock(
        side_effect=DashboardPersistenceSyncError("failure")
    )
    entry = FakeEntry("entry-1", runtime)
    hass = _hass({"entry-1": entry}, {DOMAIN: {"entry-1": runtime}})
    item = serialize_dashboard(dashboard())

    non_admin = FakeConnection(is_admin=False)
    await websocket_create_dashboard(
        hass, non_admin, _msg(WS_TYPE_DASHBOARD_CREATE, dashboard=item)
    )
    assert non_admin.errors[0][1] == ERR_UNAUTHORIZED
    runtime.application.async_create_dashboard.assert_not_called()

    admin = FakeConnection()
    await websocket_create_dashboard(
        hass, admin, _msg(WS_TYPE_DASHBOARD_CREATE, dashboard=item)
    )
    assert admin.errors[0][1] == ERR_DASHBOARD_PERSISTENCE


@pytest.mark.asyncio
async def test_handlers_use_runtime_application_and_correct_entry_runtime() -> None:
    first_runtime = _runtime(dashboard("first"))
    second_runtime = _runtime(dashboard("second"))
    first_runtime.application.async_list_dashboards = AsyncMock(
        return_value=(dashboard("first"),)
    )
    second_runtime.application.async_list_dashboards = AsyncMock(
        return_value=(dashboard("second"),)
    )
    hass = _hass(
        {
            "entry-1": FakeEntry("entry-1", first_runtime),
            "entry-2": FakeEntry("entry-2", second_runtime),
        },
        {DOMAIN: {"entry-1": first_runtime, "entry-2": second_runtime}},
    )

    connection = FakeConnection()
    await websocket_list_dashboards(
        hass, connection, _msg(WS_TYPE_DASHBOARD_LIST, entry_id="entry-2")
    )

    second_runtime.application.async_list_dashboards.assert_awaited_once()
    first_runtime.application.async_list_dashboards.assert_not_called()
    assert connection.results[0][1]["dashboards"][0]["id"] == "second"


def test_command_registration_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    monkeypatch.setattr(
        "custom_components.dashboardmodern.websocket_api.websocket_api.async_register_command",
        lambda hass, handler: calls.append(handler),
    )
    hass = _hass(data={})

    async_register_websocket_api(hass)
    async_register_websocket_api(hass)

    assert len(calls) == 5
    assert getattr(hass, DATA_WEBSOCKET_REGISTERED) is True
