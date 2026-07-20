"""Tests for DashboardModern persistence."""

from __future__ import annotations

import asyncio

import pytest

from custom_components.dashboardmodern.persistence.constants import (
    storage_key_for_entry,
)
from custom_components.dashboardmodern.persistence.exceptions import (
    MalformedStorageError,
    UnsupportedStorageVersionError,
)
from custom_components.dashboardmodern.persistence.storage import (
    HomeAssistantDashboardRepository,
    HomeAssistantStoreBackend,
)

from .helpers import MemoryStorageBackend, dashboard


def _repo(backend: MemoryStorageBackend) -> HomeAssistantDashboardRepository:
    """Create a repository with an injected storage backend."""
    return HomeAssistantDashboardRepository(backend=backend)


@pytest.mark.asyncio
async def test_empty_initial_storage_returns_empty_tuple() -> None:
    """Missing storage loads as no dashboards."""
    assert await _repo(MemoryStorageBackend()).async_load_all() == ()


@pytest.mark.asyncio
async def test_save_and_reload() -> None:
    """Saved dashboards reload through a new repository instance."""
    backend = MemoryStorageBackend()
    item = dashboard()

    await _repo(backend).async_save(item)

    assert await _repo(backend).async_load_all() == (item,)


@pytest.mark.asyncio
async def test_update_existing_dashboard() -> None:
    """Saving an existing id replaces that dashboard."""
    backend = MemoryStorageBackend()
    repo = _repo(backend)
    await repo.async_save(dashboard())
    updated = dashboard(title="Updated")

    await repo.async_save(updated)

    assert await repo.async_load_all() == (updated,)


@pytest.mark.asyncio
async def test_delete_dashboard() -> None:
    """Deleting removes only the matching dashboard id."""
    backend = MemoryStorageBackend()
    repo = _repo(backend)
    first = dashboard("dashboard-1")
    second = dashboard("dashboard-2")
    await repo.async_replace_all((first, second))

    await repo.async_delete(first.id)

    assert await repo.async_load_all() == (second,)


@pytest.mark.asyncio
async def test_replace_all() -> None:
    """Replace all persists exactly the supplied dashboards."""
    backend = MemoryStorageBackend()
    repo = _repo(backend)
    await repo.async_save(dashboard("old"))
    replacement = (dashboard("new-1"), dashboard("new-2"))

    await repo.async_replace_all(replacement)

    assert await repo.async_load_all() == replacement


@pytest.mark.asyncio
async def test_duplicate_dashboard_ids_rejected() -> None:
    """Duplicate dashboard ids are not accepted during load or save."""
    item = dashboard()
    backend = MemoryStorageBackend(
        {
            "version": 1,
            "dashboards": [item.to_dict(), item.to_dict()],
        }
    )

    with pytest.raises(MalformedStorageError):
        await _repo(backend).async_load_all()
    with pytest.raises(MalformedStorageError):
        await _repo(MemoryStorageBackend()).async_replace_all((item, item))


@pytest.mark.asyncio
async def test_malformed_envelope() -> None:
    """Malformed envelopes fail clearly."""
    backend = MemoryStorageBackend({"version": "1", "dashboards": []})

    with pytest.raises(MalformedStorageError):
        await _repo(backend).async_load_all()


@pytest.mark.asyncio
async def test_boolean_schema_version_is_rejected() -> None:
    """Boolean schema versions are rejected instead of treated as integers."""
    backend = MemoryStorageBackend({"version": True, "dashboards": []})

    with pytest.raises(MalformedStorageError):
        await _repo(backend).async_load_all()


@pytest.mark.asyncio
async def test_malformed_dashboard() -> None:
    """Malformed dashboards fail domain deserialization and validation."""
    backend = MemoryStorageBackend(
        {
            "version": 1,
            "dashboards": [{"id": "broken", "title": "Broken", "views": []}],
        }
    )

    with pytest.raises(MalformedStorageError):
        await _repo(backend).async_load_all()


@pytest.mark.asyncio
async def test_unsupported_schema_version() -> None:
    """Unknown future storage versions fail clearly."""
    backend = MemoryStorageBackend({"version": 999, "dashboards": []})

    with pytest.raises(UnsupportedStorageVersionError):
        await _repo(backend).async_load_all()


@pytest.mark.asyncio
async def test_storage_key_isolation_between_config_entries() -> None:
    """Each config entry persists to its own stable storage key."""
    stores: dict[str, MemoryStorageBackend] = {}

    def store_factory(hass: object, version: int, key: str) -> MemoryStorageBackend:
        stores.setdefault(key, MemoryStorageBackend())
        return stores[key]

    first_backend = HomeAssistantStoreBackend(
        object(), "entry-1", store_factory=store_factory
    )
    second_backend = HomeAssistantStoreBackend(
        object(), "entry-2", store_factory=store_factory
    )
    first = dashboard("first")
    second = dashboard("second")

    await HomeAssistantDashboardRepository(backend=first_backend).async_save(first)
    await HomeAssistantDashboardRepository(backend=second_backend).async_save(second)

    assert set(stores) == {
        storage_key_for_entry("entry-1"),
        storage_key_for_entry("entry-2"),
    }


@pytest.mark.asyncio
async def test_concurrent_save_operations() -> None:
    """Concurrent saves are protected by the repository lock."""
    backend = MemoryStorageBackend()
    repo = _repo(backend)
    dashboards = tuple(dashboard(f"dashboard-{idx}") for idx in range(10))

    await asyncio.gather(*(repo.async_save(item) for item in dashboards))

    assert {item.id for item in await repo.async_load_all()} == {
        item.id for item in dashboards
    }
