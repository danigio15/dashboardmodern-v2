"""Dedicated setup/unload lifecycle tests for DashboardModern."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from custom_components.dashboardmodern.const import DOMAIN
from custom_components.dashboardmodern.persistence.storage import (
    HomeAssistantDashboardRepository,
)

from .helpers import (
    HomeAssistantHarness,
    MemoryStorageBackend,
    MockConfigEntry,
    dashboard,
)


@pytest.fixture
async def hass() -> HomeAssistantHarness:
    """Return the lifecycle test hass object."""
    return HomeAssistantHarness()


def _repo(backend: MemoryStorageBackend) -> HomeAssistantDashboardRepository:
    """Create a repository with an injected storage backend."""
    return HomeAssistantDashboardRepository(backend=backend)


@pytest.mark.asyncio
async def test_setup_entry_creates_one_runtime_per_entry(
    hass: HomeAssistantHarness, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Setup creates a runtime, stores it in both locations, and uses one repo."""
    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry

    repository = _repo(MemoryStorageBackend())
    repository_factory = MagicMock(return_value=repository)
    monkeypatch.setattr(
        runtime_module, "HomeAssistantDashboardRepository", repository_factory
    )
    entry = MockConfigEntry("entry-1")

    assert await async_setup_entry(hass, entry) is True
    await hass.async_block_till_done()

    assert entry.runtime_data is not None
    assert hass.data[DOMAIN][entry.entry_id] is entry.runtime_data
    assert entry.runtime_data.repository is repository
    repository_factory.assert_called_once_with(hass, entry.entry_id)


@pytest.mark.asyncio
async def test_setup_loads_persisted_dashboards(
    hass: HomeAssistantHarness, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Config entry setup loads persisted dashboards into runtime."""
    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry

    item = dashboard()
    backend = MemoryStorageBackend()
    repository = _repo(backend)
    await repository.async_save(item)
    monkeypatch.setattr(
        runtime_module, "HomeAssistantDashboardRepository", lambda *_: repository
    )
    entry = MockConfigEntry("entry-1")

    assert await async_setup_entry(hass, entry) is True
    await hass.async_block_till_done()

    assert entry.runtime_data.dashboards.list() == (item,)


@pytest.mark.asyncio
async def test_unload_entry_clears_runtime_data(
    hass: HomeAssistantHarness, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unloading an entry clears its runtime and domain storage."""
    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry, async_unload_entry

    monkeypatch.setattr(
        runtime_module,
        "HomeAssistantDashboardRepository",
        lambda *_: _repo(MemoryStorageBackend()),
    )
    entry = MockConfigEntry("entry-1")
    assert await async_setup_entry(hass, entry) is True

    assert await async_unload_entry(hass, entry) is True
    await hass.async_block_till_done()

    assert entry.runtime_data is None
    assert DOMAIN not in hass.data


@pytest.mark.asyncio
async def test_unload_one_entry_preserves_another_runtime(
    hass: HomeAssistantHarness, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unloading one entry does not remove another entry's runtime."""
    import custom_components.dashboardmodern.runtime as runtime_module
    from custom_components.dashboardmodern import async_setup_entry, async_unload_entry

    monkeypatch.setattr(
        runtime_module,
        "HomeAssistantDashboardRepository",
        lambda *_: _repo(MemoryStorageBackend()),
    )
    first = MockConfigEntry("entry-1")
    second = MockConfigEntry("entry-2")
    assert await async_setup_entry(hass, first) is True
    assert await async_setup_entry(hass, second) is True

    assert await async_unload_entry(hass, first) is True
    await hass.async_block_till_done()

    assert first.runtime_data is None
    assert second.runtime_data is hass.data[DOMAIN][second.entry_id]
    assert first.entry_id not in hass.data[DOMAIN]
