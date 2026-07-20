"""Application service coordinating dashboard use cases."""

from __future__ import annotations

import asyncio

from custom_components.dashboardmodern.domain import (
    Dashboard,
    DashboardId,
    DashboardRegistry,
)
from custom_components.dashboardmodern.persistence import DashboardRepository

from .commands import (
    CreateDashboardCommand,
    DeleteDashboardCommand,
    ReplaceDashboardCommand,
)
from .exceptions import (
    DashboardAlreadyExistsError,
    DashboardNotFoundError,
    DashboardPersistenceSyncError,
)


class DashboardApplicationService:
    """Typed use-case boundary for dashboard commands and queries."""

    def __init__(
        self, registry: DashboardRegistry, repository: DashboardRepository
    ) -> None:
        """Initialize the service with one registry and repository."""
        self._registry = registry
        self._repository = repository
        self._lock = asyncio.Lock()

    @property
    def registry(self) -> DashboardRegistry:
        """Return the coordinated dashboard registry."""
        return self._registry

    @property
    def repository(self) -> DashboardRepository:
        """Return the coordinated dashboard repository."""
        return self._repository

    async def async_list_dashboards(self) -> tuple[Dashboard, ...]:
        """List dashboards in deterministic registry order."""
        return self._registry.list()

    async def async_get_dashboard(self, dashboard_id: DashboardId) -> Dashboard:
        """Return one dashboard or fail with an application error."""
        id_ = DashboardId.from_raw(dashboard_id)
        dashboard = self._registry.find(id_)
        if dashboard is None:
            raise DashboardNotFoundError(id_)
        return dashboard

    async def async_create_dashboard(
        self, command: CreateDashboardCommand
    ) -> Dashboard:
        """Create and persist one new dashboard."""
        async with self._lock:
            dashboard = command.dashboard
            if self._registry.contains(dashboard.id):
                raise DashboardAlreadyExistsError(dashboard.id)
            intended = (*self._registry.list(), dashboard)
            await self._async_replace_all_or_raise(intended)
            self._registry.add(dashboard)
            return dashboard

    async def async_replace_dashboard(
        self, command: ReplaceDashboardCommand
    ) -> Dashboard:
        """Replace and persist one existing dashboard."""
        async with self._lock:
            dashboard = command.dashboard
            if not self._registry.contains(dashboard.id):
                raise DashboardNotFoundError(dashboard.id)
            intended = tuple(
                dashboard if item.id == dashboard.id else item
                for item in self._registry.list()
            )
            await self._async_replace_all_or_raise(intended)
            self._registry.replace(dashboard)
            return dashboard

    async def async_delete_dashboard(self, command: DeleteDashboardCommand) -> None:
        """Delete and persist one existing dashboard."""
        async with self._lock:
            dashboard_id = command.dashboard_id
            if not self._registry.contains(dashboard_id):
                raise DashboardNotFoundError(dashboard_id)
            intended = tuple(
                item for item in self._registry.list() if item.id != dashboard_id
            )
            await self._async_replace_all_or_raise(intended)
            self._registry.remove(dashboard_id)

    async def _async_replace_all_or_raise(
        self, dashboards: tuple[Dashboard, ...]
    ) -> None:
        """Persist all dashboards and wrap persistence failures."""
        try:
            await self._repository.async_replace_all(dashboards)
        except Exception as error:  # noqa: BLE001
            msg = "Failed to synchronize dashboard persistence"
            raise DashboardPersistenceSyncError(msg) from error
