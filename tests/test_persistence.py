"""Tests for DashboardModern Home Assistant persistence."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from custom_components.dashboardmodern import async_setup_entry, async_unload_entry
from custom_components.dashboardmodern.const import DOMAIN
from custom_components.dashboardmodern.domain import Card, Dashboard, Section, View
from custom_components.dashboardmodern.persistence.constants import (
    storage_key_for_entry,
)
from custom_components.dashboardmodern.persistence.exceptions import (
    MalformedStorageError,
    UnsupportedStorageVersionError,
)
from custom_components.dashboardmodern.persistence.storage import (
    HomeAssistantDashboardRepository,
)


class _Hass:
    """Minimal Home Assistant state container for Store-backed tests."""

    def __init__(self) -> None:
        """Initialize test storage and integration data."""
        self.data: dict[str, Any] = {}
        self.storage: dict[str, Any] = {}


class _Entry:
    """Minimal config entry for setup tests."""

    def __init__(self, entry_id: str) -> None:
        """Initialize the entry."""
        self.entry_id = entry_id
        self.runtime_data: Any = None


class _MemoryStore:
    """Async in-memory Store test double preserving Home Assistant Store API shape."""

    def __init__(self, hass: _Hass, version: int, key: str) -> None:
        """Initialize the store."""
        self.hass = hass
        self.version = version
        self.key = key

    async def async_load(self) -> Any:
        """Load raw stored data."""
        await asyncio.sleep(0)
        return self.hass.storage.get(self.key)

    async def async_save(self, data: Any) -> None:
        """Save raw stored data."""
        await asyncio.sleep(0)
        self.hass.storage[self.key] = data


@pytest.fixture(autouse=True)
def store(monkeypatch: pytest.MonkeyPatch) -> None:
    """Patch only the Store class used by the repository."""
    monkeypatch.setattr("homeassistant.helpers.storage.Store", _MemoryStore)


def _dashboard(id_: str = "dashboard-1", title: str = "Main") -> Dashboard:
    """Create a valid dashboard."""
    card = Card.create(f"{id_}-card", "Weather", "weather", {"unit": "c"})
    section = Section.from_cards(f"{id_}-section", "Overview", (card,))
    view = View.from_sections(f"{id_}-view", "Home", (section,))
    return Dashboard.create(id_, title, (view,), (section,), (card,))


def _repo(hass: _Hass, entry_id: str = "entry-1") -> HomeAssistantDashboardRepository:
    """Create a repository for tests."""
    return HomeAssistantDashboardRepository(hass, entry_id)


async def test_empty_initial_storage_returns_empty_tuple() -> None:
    """Missing storage loads as no dashboards."""
    assert await _repo(_Hass()).async_load_all() == ()


async def test_save_and_reload() -> None:
    """Saved dashboards reload through a new repository instance."""
    hass = _Hass()
    dashboard = _dashboard()

    await _repo(hass).async_save(dashboard)

    assert await _repo(hass).async_load_all() == (dashboard,)


async def test_update_existing_dashboard() -> None:
    """Saving an existing id replaces that dashboard."""
    hass = _Hass()
    repo = _repo(hass)
    await repo.async_save(_dashboard())
    updated = _dashboard(title="Updated")

    await repo.async_save(updated)

    assert await repo.async_load_all() == (updated,)


async def test_delete_dashboard() -> None:
    """Deleting removes only the matching dashboard id."""
    hass = _Hass()
    repo = _repo(hass)
    first = _dashboard("dashboard-1")
    second = _dashboard("dashboard-2")
    await repo.async_replace_all((first, second))

    await repo.async_delete(first.id)

    assert await repo.async_load_all() == (second,)


async def test_replace_all() -> None:
    """Replace all persists exactly the supplied dashboards."""
    hass = _Hass()
    repo = _repo(hass)
    await repo.async_save(_dashboard("old"))
    replacement = (_dashboard("new-1"), _dashboard("new-2"))

    await repo.async_replace_all(replacement)

    assert await repo.async_load_all() == replacement


async def test_duplicate_dashboard_ids_rejected() -> None:
    """Duplicate dashboard ids are not accepted during load or save."""
    hass = _Hass()
    dashboard = _dashboard()
    hass.storage[storage_key_for_entry("entry-1")] = {
        "version": 1,
        "dashboards": [dashboard.to_dict(), dashboard.to_dict()],
    }

    with pytest.raises(MalformedStorageError):
        await _repo(hass).async_load_all()
    with pytest.raises(MalformedStorageError):
        await _repo(hass).async_replace_all((dashboard, dashboard))


async def test_malformed_envelope() -> None:
    """Malformed envelopes fail clearly."""
    hass = _Hass()
    hass.storage[storage_key_for_entry("entry-1")] = {"version": "1", "dashboards": []}

    with pytest.raises(MalformedStorageError):
        await _repo(hass).async_load_all()


async def test_malformed_dashboard() -> None:
    """Malformed dashboards fail domain deserialization and validation."""
    hass = _Hass()
    hass.storage[storage_key_for_entry("entry-1")] = {
        "version": 1,
        "dashboards": [{"id": "broken", "title": "Broken", "views": []}],
    }

    with pytest.raises(MalformedStorageError):
        await _repo(hass).async_load_all()


async def test_unsupported_schema_version() -> None:
    """Unknown future storage versions fail clearly."""
    hass = _Hass()
    hass.storage[storage_key_for_entry("entry-1")] = {"version": 999, "dashboards": []}

    with pytest.raises(UnsupportedStorageVersionError):
        await _repo(hass).async_load_all()


async def test_storage_key_isolation_between_config_entries() -> None:
    """Each config entry persists to its own stable storage key."""
    hass = _Hass()
    first = _dashboard("first")
    second = _dashboard("second")

    await _repo(hass, "entry-1").async_save(first)
    await _repo(hass, "entry-2").async_save(second)

    assert await _repo(hass, "entry-1").async_load_all() == (first,)
    assert await _repo(hass, "entry-2").async_load_all() == (second,)
    assert set(hass.storage) == {
        storage_key_for_entry("entry-1"),
        storage_key_for_entry("entry-2"),
    }


async def test_concurrent_save_operations() -> None:
    """Concurrent saves are protected by the repository lock."""
    hass = _Hass()
    repo = _repo(hass)
    dashboards = tuple(_dashboard(f"dashboard-{idx}") for idx in range(10))

    await asyncio.gather(*(repo.async_save(dashboard) for dashboard in dashboards))

    assert {dashboard.id for dashboard in await repo.async_load_all()} == {
        dashboard.id for dashboard in dashboards
    }


async def test_setup_loads_persisted_dashboards() -> None:
    """Config entry setup loads persisted dashboards into runtime."""
    hass = _Hass()
    entry = _Entry("entry-1")
    dashboard = _dashboard()
    await _repo(hass, entry.entry_id).async_save(dashboard)

    assert await async_setup_entry(hass, entry) is True

    assert entry.runtime_data is not None
    assert entry.runtime_data.dashboards.list() == (dashboard,)
    assert hass.data[DOMAIN][entry.entry_id] is entry.runtime_data


async def test_unload_cleanup() -> None:
    """Unloading removes per-entry runtime data."""
    hass = _Hass()
    entry = _Entry("entry-1")

    assert await async_setup_entry(hass, entry) is True
    assert await async_unload_entry(hass, entry) is True

    assert entry.runtime_data is None
    assert DOMAIN not in hass.data
