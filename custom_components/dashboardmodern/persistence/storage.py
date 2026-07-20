"""Home Assistant Store-backed DashboardModern repository."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, Protocol

from custom_components.dashboardmodern.domain import Dashboard, DashboardId

from .constants import STORAGE_VERSION, storage_key_for_entry
from .migrations import migrate_storage_envelope
from .repository import DashboardRepository
from .schema import deserialize_dashboards, serialize_dashboards

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


class JsonStorageBackend(Protocol):
    """Minimal async JSON storage backend used by the dashboard repository."""

    async def async_load(self) -> object | None:
        """Load raw JSON-compatible data."""

    async def async_save(self, data: object) -> None:
        """Persist raw JSON-compatible data."""


StoreFactory = Callable[["HomeAssistant", int, str], JsonStorageBackend]


class HomeAssistantStoreBackend(JsonStorageBackend):
    """JsonStorageBackend adapter around Home Assistant Store."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry_id: str,
        *,
        store_factory: StoreFactory | None = None,
    ) -> None:
        """Initialize a Home Assistant Store for the config entry."""
        if store_factory is None:
            from homeassistant.helpers.storage import Store

            store_factory = Store

        self._store = store_factory(
            hass, STORAGE_VERSION, storage_key_for_entry(entry_id)
        )

    async def async_load(self) -> object | None:
        """Load raw data from Home Assistant Store."""
        return await self._store.async_load()

    async def async_save(self, data: object) -> None:
        """Save raw data to Home Assistant Store."""
        await self._store.async_save(data)


class HomeAssistantDashboardRepository(DashboardRepository):
    """Persist dashboards for one config entry using an async storage backend."""

    def __init__(
        self,
        hass: HomeAssistant | None = None,
        entry_id: str | None = None,
        *,
        backend: JsonStorageBackend | None = None,
    ) -> None:
        """Initialize the repository for exactly one config entry or backend."""
        if backend is None:
            if hass is None or entry_id is None:
                msg = "hass and entry_id are required when backend is not provided"
                raise ValueError(msg)
            backend = HomeAssistantStoreBackend(hass, entry_id)
        self._backend = backend
        self._lock = asyncio.Lock()

    async def async_load_all(self) -> tuple[Dashboard, ...]:
        """Load all persisted dashboards."""
        async with self._lock:
            return await self._async_load_all_unlocked()

    async def async_save(self, dashboard: Dashboard) -> None:
        """Insert or replace one dashboard atomically."""
        async with self._lock:
            dashboards = await self._async_load_all_unlocked()
            updated = tuple(item for item in dashboards if item.id != dashboard.id)
            await self._async_save_all_unlocked((*updated, dashboard))

    async def async_delete(self, dashboard_id: DashboardId) -> None:
        """Delete one dashboard atomically if present."""
        async with self._lock:
            id_ = DashboardId.from_raw(dashboard_id)
            dashboards = await self._async_load_all_unlocked()
            await self._async_save_all_unlocked(
                tuple(item for item in dashboards if item.id != id_)
            )

    async def async_replace_all(self, dashboards: tuple[Dashboard, ...]) -> None:
        """Replace all dashboards atomically."""
        async with self._lock:
            await self._async_save_all_unlocked(dashboards)

    async def _async_load_all_unlocked(self) -> tuple[Dashboard, ...]:
        data: Any = await self._backend.async_load()
        if data is None:
            return ()
        migrated = migrate_storage_envelope(data)
        return deserialize_dashboards(migrated)

    async def _async_save_all_unlocked(self, dashboards: tuple[Dashboard, ...]) -> None:
        await self._backend.async_save(serialize_dashboards(dashboards))
