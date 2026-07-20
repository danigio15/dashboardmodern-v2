"""Tests for the DashboardModern WebSocket API through Home Assistant."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any
from unittest.mock import AsyncMock

import aiohttp.connector
import aiohttp.resolver
import homeassistant.helpers.aiohttp_client
import pytest
import pytest_asyncio
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern.api.serializers import serialize_dashboard
from custom_components.dashboardmodern.application import DashboardPersistenceSyncError
from custom_components.dashboardmodern.const import (
    DATA_RUNTIMES,
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
from custom_components.dashboardmodern.domain import Dashboard
from custom_components.dashboardmodern.persistence.storage import (
    HomeAssistantDashboardRepository,
)
from tests.helpers import MemoryStorageBackend, dashboard

WebSocketClientFactory = Callable[..., Awaitable[Any]]


@pytest.fixture
def use_threaded_aiohttp_resolver(monkeypatch: pytest.MonkeyPatch) -> None:
    """Avoid aiohttp's pycares resolver background shutdown thread in WS tests."""
    monkeypatch.setattr(
        aiohttp.resolver, "AsyncResolver", aiohttp.resolver.ThreadedResolver
    )
    monkeypatch.setattr(
        aiohttp.resolver, "DefaultResolver", aiohttp.resolver.ThreadedResolver
    )
    monkeypatch.setattr(
        aiohttp.connector, "DefaultResolver", aiohttp.resolver.ThreadedResolver
    )
    monkeypatch.setattr(
        homeassistant.helpers.aiohttp_client,
        "AsyncResolver",
        aiohttp.resolver.ThreadedResolver,
    )


@pytest_asyncio.fixture
async def dashboard_ws_client(
    hass_ws_client: WebSocketClientFactory, use_threaded_aiohttp_resolver: None
) -> WebSocketClientFactory:
    """Create real hass_ws_client connections and close them after each test."""
    clients: list[Any] = []

    async def factory(*args: Any, **kwargs: Any) -> Any:
        client = await hass_ws_client(*args, **kwargs)
        clients.append(client)
        return client

    yield factory

    for client in clients:
        await client.close()


@pytest.fixture(autouse=True)
def memory_repository(
    monkeypatch: pytest.MonkeyPatch, enable_custom_integrations: None
) -> None:
    """Use in-memory persistence for WebSocket API tests."""
    import custom_components.dashboardmodern.runtime as runtime_module

    backends: dict[str, MemoryStorageBackend] = {}

    def repository_factory(
        _hass: HomeAssistant, entry_id: str
    ) -> HomeAssistantDashboardRepository:
        return HomeAssistantDashboardRepository(
            backend=backends.setdefault(entry_id, MemoryStorageBackend())
        )

    monkeypatch.setattr(
        runtime_module, "HomeAssistantDashboardRepository", repository_factory
    )


async def _setup_entry(hass: HomeAssistant, entry_id: str) -> MockConfigEntry:
    """Set up one DashboardModern config entry through Home Assistant."""
    entry = MockConfigEntry(domain=DOMAIN, entry_id=entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.runtime_data is not None
    return entry


async def _unload_entry(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    """Unload one DashboardModern config entry through Home Assistant."""
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert getattr(entry, "runtime_data", None) is None


async def _ws_request(client: Any, message: dict[str, Any]) -> dict[str, Any]:
    """Send a WebSocket message and return the Home Assistant response envelope."""
    await client.send_json_auto_id(message)
    return await client.receive_json()


def _assert_success(response: dict[str, Any]) -> dict[str, Any]:
    """Assert a Home Assistant success envelope and return its result."""
    assert response["type"] == "result"
    assert response["success"] is True
    return response["result"]


def _assert_error(response: dict[str, Any], code: str) -> None:
    """Assert a Home Assistant error envelope with the expected code."""
    assert response["type"] == "result"
    assert response["success"] is False
    assert response["error"]["code"] == code


async def _create_dashboard(
    client: Any, entry_id: str, item: Dashboard
) -> dict[str, Any]:
    """Create a dashboard through the WebSocket API."""
    return await _ws_request(
        client,
        {
            "type": WS_TYPE_DASHBOARD_CREATE,
            "entry_id": entry_id,
            "dashboard": serialize_dashboard(item),
        },
    )


@pytest.mark.asyncio
async def test_list_empty_uses_real_websocket_client(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """List returns an actual Home Assistant result envelope."""
    entry = await _setup_entry(hass, "entry-1")
    client = await dashboard_ws_client(hass)

    response = await _ws_request(
        client, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": entry.entry_id}
    )

    assert _assert_success(response) == {"dashboards": []}


@pytest.mark.asyncio
async def test_list_existing_dashboards_and_deterministic_order(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """List returns the deterministic application-service ordering."""
    entry = await _setup_entry(hass, "entry-1")
    client = await dashboard_ws_client(hass)
    first = dashboard("b-dashboard", "B")
    second = dashboard("a-dashboard", "A")
    _assert_success(await _create_dashboard(client, entry.entry_id, first))
    _assert_success(await _create_dashboard(client, entry.entry_id, second))

    result = _assert_success(
        await _ws_request(
            client, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": entry.entry_id}
        )
    )

    assert result == {
        "dashboards": [serialize_dashboard(first), serialize_dashboard(second)]
    }


@pytest.mark.asyncio
async def test_get_existing_and_missing(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """Get returns one dashboard or a stable not-found error."""
    entry = await _setup_entry(hass, "entry-1")
    client = await dashboard_ws_client(hass)
    item = dashboard()
    _assert_success(await _create_dashboard(client, entry.entry_id, item))

    found = await _ws_request(
        client,
        {
            "type": WS_TYPE_DASHBOARD_GET,
            "entry_id": entry.entry_id,
            "dashboard_id": str(item.id),
        },
    )
    missing = await _ws_request(
        client,
        {
            "type": WS_TYPE_DASHBOARD_GET,
            "entry_id": entry.entry_id,
            "dashboard_id": "missing",
        },
    )

    assert _assert_success(found) == {"dashboard": serialize_dashboard(item)}
    _assert_error(missing, ERR_DASHBOARD_NOT_FOUND)


@pytest.mark.asyncio
async def test_admin_can_create_replace_and_delete(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """Admin users can perform all mutating WebSocket commands."""
    entry = await _setup_entry(hass, "entry-1")
    client = await dashboard_ws_client(hass)
    item = dashboard()
    updated = item.copy_with(title="Updated")

    created = await _create_dashboard(client, entry.entry_id, item)
    replaced = await _ws_request(
        client,
        {
            "type": WS_TYPE_DASHBOARD_REPLACE,
            "entry_id": entry.entry_id,
            "dashboard": serialize_dashboard(updated),
        },
    )
    deleted = await _ws_request(
        client,
        {
            "type": WS_TYPE_DASHBOARD_DELETE,
            "entry_id": entry.entry_id,
            "dashboard_id": str(item.id),
        },
    )

    assert _assert_success(created) == {"dashboard": serialize_dashboard(item)}
    assert _assert_success(replaced) == {"dashboard": serialize_dashboard(updated)}
    assert _assert_success(deleted) == {"dashboard_id": str(item.id), "deleted": True}


@pytest.mark.asyncio
async def test_duplicate_replace_missing_and_delete_missing_errors(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """Application errors are translated to stable WebSocket error codes."""
    entry = await _setup_entry(hass, "entry-1")
    client = await dashboard_ws_client(hass)
    item = dashboard()
    _assert_success(await _create_dashboard(client, entry.entry_id, item))

    duplicate = await _create_dashboard(client, entry.entry_id, item)
    replace_missing = await _ws_request(
        client,
        {
            "type": WS_TYPE_DASHBOARD_REPLACE,
            "entry_id": entry.entry_id,
            "dashboard": serialize_dashboard(dashboard("missing")),
        },
    )
    delete_missing = await _ws_request(
        client,
        {
            "type": WS_TYPE_DASHBOARD_DELETE,
            "entry_id": entry.entry_id,
            "dashboard_id": "missing",
        },
    )

    _assert_error(duplicate, "dashboard_already_exists")
    _assert_error(replace_missing, ERR_DASHBOARD_NOT_FOUND)
    _assert_error(delete_missing, ERR_DASHBOARD_NOT_FOUND)


@pytest.mark.asyncio
async def test_authenticated_regular_user_can_list_and_get(
    hass: HomeAssistant,
    dashboard_ws_client: WebSocketClientFactory,
    hass_read_only_access_token: str,
) -> None:
    """Authenticated non-admin users can use read commands."""
    entry = await _setup_entry(hass, "entry-1")
    admin = await dashboard_ws_client(hass)
    item = dashboard()
    _assert_success(await _create_dashboard(admin, entry.entry_id, item))
    regular = await dashboard_ws_client(hass, access_token=hass_read_only_access_token)

    listed = await _ws_request(
        regular, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": entry.entry_id}
    )
    found = await _ws_request(
        regular,
        {
            "type": WS_TYPE_DASHBOARD_GET,
            "entry_id": entry.entry_id,
            "dashboard_id": str(item.id),
        },
    )

    assert _assert_success(listed) == {"dashboards": [serialize_dashboard(item)]}
    assert _assert_success(found) == {"dashboard": serialize_dashboard(item)}


@pytest.mark.asyncio
async def test_non_admin_user_cannot_mutate(
    hass: HomeAssistant,
    dashboard_ws_client: WebSocketClientFactory,
    hass_read_only_access_token: str,
) -> None:
    """Authenticated non-admin users receive unauthorized for mutations."""
    entry = await _setup_entry(hass, "entry-1")
    regular = await dashboard_ws_client(hass, access_token=hass_read_only_access_token)
    item = dashboard()

    create = await _create_dashboard(regular, entry.entry_id, item)
    replace = await _ws_request(
        regular,
        {
            "type": WS_TYPE_DASHBOARD_REPLACE,
            "entry_id": entry.entry_id,
            "dashboard": serialize_dashboard(item),
        },
    )
    delete = await _ws_request(
        regular,
        {
            "type": WS_TYPE_DASHBOARD_DELETE,
            "entry_id": entry.entry_id,
            "dashboard_id": str(item.id),
        },
    )

    _assert_error(create, ERR_UNAUTHORIZED)
    _assert_error(replace, ERR_UNAUTHORIZED)
    _assert_error(delete, ERR_UNAUTHORIZED)


@pytest.mark.asyncio
async def test_schema_validation_errors_from_home_assistant_websocket_stack(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """Malformed messages rejected by HA schemas return invalid_format."""
    entry = await _setup_entry(hass, "entry-1")
    client = await dashboard_ws_client(hass)
    item = serialize_dashboard(dashboard())

    malformed_messages = [
        {"type": WS_TYPE_DASHBOARD_LIST},
        {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": ""},
        {"type": WS_TYPE_DASHBOARD_GET, "entry_id": entry.entry_id},
        {
            "type": WS_TYPE_DASHBOARD_GET,
            "entry_id": entry.entry_id,
            "dashboard_id": "",
        },
        {"type": WS_TYPE_DASHBOARD_CREATE, "entry_id": entry.entry_id},
        {
            "type": WS_TYPE_DASHBOARD_CREATE,
            "entry_id": entry.entry_id,
            "dashboard": {"id": "only-id"},
        },
        {
            "type": WS_TYPE_DASHBOARD_CREATE,
            "entry_id": entry.entry_id,
            "dashboard": {**item, "unexpected": True},
        },
        {
            "type": WS_TYPE_DASHBOARD_CREATE,
            "entry_id": entry.entry_id,
            "dashboard": {**item, "views": "not-a-list"},
        },
        {
            "type": WS_TYPE_DASHBOARD_CREATE,
            "entry_id": entry.entry_id,
            "dashboard": {**item, "views": [{"id": "view-only"}]},
        },
        {
            "type": WS_TYPE_DASHBOARD_CREATE,
            "entry_id": entry.entry_id,
            "dashboard": {**item, "sections": [{"id": "section-only"}]},
        },
        {
            "type": WS_TYPE_DASHBOARD_CREATE,
            "entry_id": entry.entry_id,
            "dashboard": {**item, "cards": [{"id": "card-only"}]},
        },
    ]

    for malformed in malformed_messages:
        _assert_error(await _ws_request(client, malformed), "invalid_format")


@pytest.mark.asyncio
async def test_stable_boundary_errors_after_schema_validation(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """Validly shaped messages can still receive DashboardModern stable errors."""
    entry = await _setup_entry(hass, "entry-1")
    client = await dashboard_ws_client(hass)
    item = serialize_dashboard(dashboard())

    unknown_entry = await _ws_request(
        client, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": "unknown"}
    )
    whitespace_dashboard_id = await _ws_request(
        client,
        {
            "type": WS_TYPE_DASHBOARD_GET,
            "entry_id": entry.entry_id,
            "dashboard_id": "   ",
        },
    )
    domain_invalid = await _ws_request(
        client,
        {
            "type": WS_TYPE_DASHBOARD_CREATE,
            "entry_id": entry.entry_id,
            "dashboard": {**item, "title": "   "},
        },
    )

    _assert_error(unknown_entry, ERR_ENTRY_NOT_FOUND)
    _assert_error(whitespace_dashboard_id, ERR_INVALID_DASHBOARD)
    _assert_error(domain_invalid, ERR_INVALID_DASHBOARD)


@pytest.mark.asyncio
async def test_unloaded_entry_returns_stable_error(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """A real unloaded config entry returns entry_not_loaded."""
    entry = await _setup_entry(hass, "entry-1")
    client = await dashboard_ws_client(hass)
    await _unload_entry(hass, entry)

    response = await _ws_request(
        client, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": entry.entry_id}
    )

    _assert_error(response, ERR_ENTRY_NOT_LOADED)


@pytest.mark.asyncio
async def test_multiple_entries_unload_and_reload_lifecycle(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """Commands resolve runtimes per entry across setup, unload, and reload."""
    first = await _setup_entry(hass, "entry-1")
    second = await _setup_entry(hass, "entry-2")
    client = await dashboard_ws_client(hass)
    first_dashboard = dashboard("first")
    second_dashboard = dashboard("second")
    _assert_success(await _create_dashboard(client, first.entry_id, first_dashboard))
    _assert_success(await _create_dashboard(client, second.entry_id, second_dashboard))

    await _unload_entry(hass, first)
    first_after_unload = await _ws_request(
        client, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": first.entry_id}
    )
    second_after_unload = await _ws_request(
        client, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": second.entry_id}
    )

    assert await hass.config_entries.async_setup(first.entry_id)
    await hass.async_block_till_done()
    first_after_reload = await _ws_request(
        client, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": first.entry_id}
    )

    _assert_error(first_after_unload, ERR_ENTRY_NOT_LOADED)
    assert _assert_success(second_after_unload) == {
        "dashboards": [serialize_dashboard(second_dashboard)]
    }
    assert _assert_success(first_after_reload) == {
        "dashboards": [serialize_dashboard(first_dashboard)]
    }


@pytest.mark.asyncio
async def test_runtime_application_is_invoked_by_each_handler(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """Handlers use runtime.application instead of direct repository mutation."""
    entry = await _setup_entry(hass, "entry-1")
    runtime = hass.data[DOMAIN][DATA_RUNTIMES][entry.entry_id]
    client = await dashboard_ws_client(hass)
    item = dashboard()
    runtime.application.async_list_dashboards = AsyncMock(return_value=())
    runtime.application.async_get_dashboard = AsyncMock(return_value=item)
    runtime.application.async_create_dashboard = AsyncMock(return_value=item)
    runtime.application.async_replace_dashboard = AsyncMock(return_value=item)
    runtime.application.async_delete_dashboard = AsyncMock(return_value=None)

    _assert_success(
        await _ws_request(
            client, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": entry.entry_id}
        )
    )
    _assert_success(
        await _ws_request(
            client,
            {
                "type": WS_TYPE_DASHBOARD_GET,
                "entry_id": entry.entry_id,
                "dashboard_id": str(item.id),
            },
        )
    )
    _assert_success(await _create_dashboard(client, entry.entry_id, item))
    _assert_success(
        await _ws_request(
            client,
            {
                "type": WS_TYPE_DASHBOARD_REPLACE,
                "entry_id": entry.entry_id,
                "dashboard": serialize_dashboard(item),
            },
        )
    )
    _assert_success(
        await _ws_request(
            client,
            {
                "type": WS_TYPE_DASHBOARD_DELETE,
                "entry_id": entry.entry_id,
                "dashboard_id": str(item.id),
            },
        )
    )

    runtime.application.async_list_dashboards.assert_awaited_once()
    runtime.application.async_get_dashboard.assert_awaited_once()
    runtime.application.async_create_dashboard.assert_awaited_once()
    runtime.application.async_replace_dashboard.assert_awaited_once()
    runtime.application.async_delete_dashboard.assert_awaited_once()


@pytest.mark.asyncio
async def test_persistence_failure_mapping(
    hass: HomeAssistant, dashboard_ws_client: WebSocketClientFactory
) -> None:
    """Application persistence failures map to a stable WebSocket code."""
    entry = await _setup_entry(hass, "entry-1")
    runtime = hass.data[DOMAIN][DATA_RUNTIMES][entry.entry_id]
    runtime.application.async_create_dashboard = AsyncMock(
        side_effect=DashboardPersistenceSyncError("failure")
    )
    client = await dashboard_ws_client(hass)

    response = await _create_dashboard(client, entry.entry_id, dashboard())

    _assert_error(response, ERR_DASHBOARD_PERSISTENCE)


@pytest.mark.asyncio
async def test_command_registration_is_idempotent_with_real_entry_setup(
    hass: HomeAssistant,
    dashboard_ws_client: WebSocketClientFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """First entry setup registers commands; second setup does not duplicate them."""
    import custom_components.dashboardmodern.websocket_api as websocket_api_module

    calls = []
    original = websocket_api_module.websocket_api.async_register_command

    def wrapped_register(hass_: HomeAssistant, handler: Any) -> None:
        calls.append(handler)
        original(hass_, handler)

    monkeypatch.setattr(
        websocket_api_module.websocket_api, "async_register_command", wrapped_register
    )

    first = await _setup_entry(hass, "entry-1")
    second = await _setup_entry(hass, "entry-2")
    client = await dashboard_ws_client(hass)

    integration_calls = [
        handler
        for handler in calls
        if handler.__module__.startswith("custom_components.dashboardmodern")
    ]
    assert len(integration_calls) == 5
    assert hass.data[DOMAIN][DATA_WEBSOCKET_REGISTERED] is True
    assert first.entry_id in hass.data[DOMAIN][DATA_RUNTIMES]
    assert second.entry_id in hass.data[DOMAIN][DATA_RUNTIMES]
    assert _assert_success(
        await _ws_request(
            client, {"type": WS_TYPE_DASHBOARD_LIST, "entry_id": second.entry_id}
        )
    ) == {"dashboards": []}
