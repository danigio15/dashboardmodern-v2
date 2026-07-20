"""Home Assistant Store-backed DashboardModern repository."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

from custom_components.dashboardmodern.domain import Dashboard, DashboardId

from .constants import STORAGE_VERSION, storage_key_for_entry
from .migrations import migrate_storage_envelope
from .repository import DashboardRepository
from .schema import deserialize_dashboards, serialize_dashboards

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


class HomeAssistantDashboardRepository(DashboardRepository):
    """Persist dashboards for one config entry using Home Assistant Store."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialize the repository for a config entry."""
        from homeassistant.helpers.storage import Store

        self._store = Store(hass, STORAGE_VERSION, storage_key_for_entry(entry_id))
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
        data: Any = await self._store.async_load()
        if data is None:
            return ()
        migrated = migrate_storage_envelope(data)
        return deserialize_dashboards(migrated)

    async def _async_save_all_unlocked(self, dashboards: tuple[Dashboard, ...]) -> None:
        await self._store.async_save(serialize_dashboards(dashboards))
