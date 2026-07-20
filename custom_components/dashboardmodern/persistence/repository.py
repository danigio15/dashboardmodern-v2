"""Repository abstractions for DashboardModern persistence."""

from __future__ import annotations

from typing import Protocol

from custom_components.dashboardmodern.domain import Dashboard, DashboardId


class DashboardRepository(Protocol):
    """Typed repository interface for persisted dashboard aggregates."""

    async def async_load_all(self) -> tuple[Dashboard, ...]:
        """Load all persisted dashboards."""

    async def async_save(self, dashboard: Dashboard) -> None:
        """Insert or replace a dashboard by id."""

    async def async_delete(self, dashboard_id: DashboardId) -> None:
        """Delete a dashboard by id if it exists."""

    async def async_replace_all(self, dashboards: tuple[Dashboard, ...]) -> None:
        """Replace all persisted dashboards atomically."""
