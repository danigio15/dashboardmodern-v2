"""Dedicated setup/unload lifecycle tests for DashboardModern."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern.const import DATA_RUNTIMES, DOMAIN
from custom_components.dashboardmodern.persistence.storage import (
    HomeAssistantDashboardRepository,
)

from .helpers import MemoryStorageBackend, dashboard


def _repo(backend: MemoryStorageBackend) -> HomeAssistantDashboardRepository:
    """Create a repository with an injected storage backend."""
    return HomeAssistantDashboardRepository(backend=backend)


@pytest.mark.asyncio
async def test_setup_entry_creates_one_runtime_per_entry(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Setup creates a runtime, stores it in both locations, and uses one repo."""
    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry

    repository = _repo(MemoryStorageBackend())
    repository_factory = MagicMock(return_value=repository)
    monkeypatch.setattr(
        runtime_module, "HomeAssistantDashboardRepository", repository_factory
    )
    entry = MockConfigEntry(domain=DOMAIN, entry_id="entry-1")
    entry.add_to_hass(hass)

    assert await async_setup_entry(hass, entry) is True
    await hass.async_block_till_done()

    assert entry.runtime_data is not None
    assert hass.data[DOMAIN][DATA_RUNTIMES][entry.entry_id] is entry.runtime_data
    assert entry.runtime_data.repository is repository
    assert entry.runtime_data.application.repository is repository
    assert entry.runtime_data.application.registry is entry.runtime_data.dashboards
    repository_factory.assert_called_once_with(hass, entry.entry_id)


@pytest.mark.asyncio
async def test_setup_loads_persisted_dashboards(hass: HomeAssistant) -> None:
    """Config entry setup loads persisted dashboards into runtime."""
    from custom_components.dashboardmodern import async_setup_entry

    entry = MockConfigEntry(domain=DOMAIN, entry_id="entry-1")
    entry.add_to_hass(hass)
    item = dashboard()
    await HomeAssistantDashboardRepository(hass, entry.entry_id).async_save(item)
    await hass.async_block_till_done()

    assert await async_setup_entry(hass, entry) is True
    await hass.async_block_till_done()

    assert entry.runtime_data.dashboards.list() == (item,)
    assert (
        entry.runtime_data.repository
        is hass.data[DOMAIN][DATA_RUNTIMES][entry.entry_id].repository
    )
    assert entry.runtime_data.application.registry is entry.runtime_data.dashboards
    assert entry.runtime_data.application.repository is entry.runtime_data.repository


@pytest.mark.asyncio
async def test_runtime_creates_exactly_one_application_service(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Runtime creates one application service using exposed dependencies."""
    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern.runtime import async_create_runtime

    repository = _repo(MemoryStorageBackend())
    application_factory = MagicMock(
        side_effect=runtime_module.DashboardApplicationService
    )
    monkeypatch.setattr(
        runtime_module,
        "HomeAssistantDashboardRepository",
        lambda *_: repository,
    )
    monkeypatch.setattr(
        runtime_module, "DashboardApplicationService", application_factory
    )

    runtime = await async_create_runtime(hass, "entry-1")

    first_access = runtime.application
    second_access = runtime.application
    assert first_access is second_access
    assert runtime.application.registry is runtime.dashboards
    assert runtime.application.repository is runtime.repository
    application_factory.assert_called_once_with(runtime.dashboards, runtime.repository)


@pytest.mark.asyncio
async def test_unload_entry_clears_runtime_data(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unloading an entry clears its runtime and domain storage."""
    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry, async_unload_entry

    monkeypatch.setattr(
        runtime_module,
        "HomeAssistantDashboardRepository",
        lambda *_: _repo(MemoryStorageBackend()),
    )
    entry = MockConfigEntry(domain=DOMAIN, entry_id="entry-1")
    entry.add_to_hass(hass)
    assert await async_setup_entry(hass, entry) is True

    assert await async_unload_entry(hass, entry) is True
    await hass.async_block_till_done()

    assert entry.runtime_data is None
    assert entry.entry_id not in hass.data[DOMAIN][DATA_RUNTIMES]


@pytest.mark.asyncio
async def test_unload_one_entry_preserves_another_runtime(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unloading one entry does not remove another entry's runtime."""
    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry, async_unload_entry

    monkeypatch.setattr(
        runtime_module,
        "HomeAssistantDashboardRepository",
        lambda *_: _repo(MemoryStorageBackend()),
    )
    first = MockConfigEntry(domain=DOMAIN, entry_id="entry-1")
    second = MockConfigEntry(domain=DOMAIN, entry_id="entry-2")
    first.add_to_hass(hass)
    second.add_to_hass(hass)
    assert await async_setup_entry(hass, first) is True
    assert await async_setup_entry(hass, second) is True

    assert await async_unload_entry(hass, first) is True
    await hass.async_block_till_done()

    assert first.runtime_data is None
    assert second.runtime_data is hass.data[DOMAIN][DATA_RUNTIMES][second.entry_id]
    assert first.entry_id not in hass.data[DOMAIN][DATA_RUNTIMES]


@pytest.mark.asyncio
async def test_frontend_static_and_panel_registered_during_setup(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Setup registers the DashboardModern static path and panel."""
    from homeassistant.components import panel_custom

    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry

    static_calls: list[list[object]] = []
    panel_calls: list[dict[str, object]] = []

    async def fake_static(paths: list[object]) -> None:
        static_calls.append(paths)

    hass.http = SimpleNamespace(async_register_static_paths=fake_static)
    monkeypatch.setattr(
        panel_custom,
        "async_register_panel",
        lambda *args, **kwargs: panel_calls.append(kwargs),
    )
    monkeypatch.setattr(
        runtime_module,
        "HomeAssistantDashboardRepository",
        lambda *_: _repo(MemoryStorageBackend()),
    )

    entry = MockConfigEntry(domain=DOMAIN, entry_id="entry-1")
    entry.add_to_hass(hass)

    assert await async_setup_entry(hass, entry) is True

    assert len(static_calls) == 1
    assert len(panel_calls) == 1
    assert panel_calls[0]["frontend_url_path"] == "dashboardmodern"
    assert panel_calls[0]["module_url"] == "/dashboardmodern_static/panel.js"
    assert panel_calls[0]["config"] == {"entry_ids": ["entry-1"]}


@pytest.mark.asyncio
async def test_frontend_registration_idempotent_for_multiple_entries(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Multiple entries update panel metadata without duplicate registrations."""
    from homeassistant.components import panel_custom

    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry
    from custom_components.dashboardmodern.frontend import DATA_PANEL_ENTRY_IDS

    static_count = 0
    panel_count = 0

    async def fake_static(paths: list[object]) -> None:
        nonlocal static_count
        static_count += 1

    def fake_panel(*args: object, **kwargs: object) -> None:
        nonlocal panel_count
        panel_count += 1

    hass.http = SimpleNamespace(async_register_static_paths=fake_static)
    monkeypatch.setattr(panel_custom, "async_register_panel", fake_panel)
    monkeypatch.setattr(
        runtime_module,
        "HomeAssistantDashboardRepository",
        lambda *_: _repo(MemoryStorageBackend()),
    )

    first = MockConfigEntry(domain=DOMAIN, entry_id="entry-b")
    second = MockConfigEntry(domain=DOMAIN, entry_id="entry-a")
    first.add_to_hass(hass)
    second.add_to_hass(hass)

    assert await async_setup_entry(hass, first) is True
    assert await async_setup_entry(hass, second) is True

    assert static_count == 1
    assert panel_count == 1
    assert hass.data[DOMAIN][DATA_PANEL_ENTRY_IDS] == ["entry-a", "entry-b"]


@pytest.mark.asyncio
async def test_frontend_unload_reload_updates_deterministic_entry_ids(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unload removes entry metadata and reload adds it back deterministically."""
    from homeassistant.components import panel_custom

    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry, async_unload_entry
    from custom_components.dashboardmodern.frontend import DATA_PANEL_ENTRY_IDS

    async def fake_static(paths: list[object]) -> None:
        return None

    hass.http = SimpleNamespace(async_register_static_paths=fake_static)
    monkeypatch.setattr(panel_custom, "async_register_panel", lambda *_, **__: None)
    monkeypatch.setattr(
        runtime_module,
        "HomeAssistantDashboardRepository",
        lambda *_: _repo(MemoryStorageBackend()),
    )

    first = MockConfigEntry(domain=DOMAIN, entry_id="entry-1")
    second = MockConfigEntry(domain=DOMAIN, entry_id="entry-2")
    first.add_to_hass(hass)
    second.add_to_hass(hass)

    assert await async_setup_entry(hass, first) is True
    assert await async_setup_entry(hass, second) is True
    assert hass.data[DOMAIN][DATA_PANEL_ENTRY_IDS] == ["entry-1", "entry-2"]

    assert await async_unload_entry(hass, first) is True
    assert hass.data[DOMAIN][DATA_PANEL_ENTRY_IDS] == ["entry-2"]

    assert await async_setup_entry(hass, first) is True
    assert hass.data[DOMAIN][DATA_PANEL_ENTRY_IDS] == ["entry-1", "entry-2"]
