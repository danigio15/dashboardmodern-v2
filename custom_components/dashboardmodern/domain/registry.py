"""In-memory dashboard registry."""

from __future__ import annotations

from dataclasses import dataclass, field

from .dashboard import Dashboard
from .exceptions import DashboardAlreadyExistsError, DashboardNotFoundError
from .models import DashboardId


@dataclass(slots=True)
class DashboardRegistry:
    """In-memory registry for dashboard aggregates."""

    _dashboards: dict[DashboardId, Dashboard] = field(default_factory=dict)

    def add(self, dashboard: Dashboard) -> None:
        """Add a dashboard to the registry."""
        if dashboard.id in self._dashboards:
            msg = f"Dashboard already exists: {dashboard.id}"
            raise DashboardAlreadyExistsError(msg)
        self._dashboards[dashboard.id] = dashboard

    def contains(self, dashboard_id: str | DashboardId) -> bool:
        """Return whether a dashboard id exists in the registry."""
        return DashboardId.from_raw(dashboard_id) in self._dashboards

    def replace(self, dashboard: Dashboard) -> None:
        """Replace an existing dashboard while preserving registry order."""
        if dashboard.id not in self._dashboards:
            msg = f"Dashboard not found: {dashboard.id}"
            raise DashboardNotFoundError(msg)
        self._dashboards[dashboard.id] = dashboard

    def remove(self, dashboard_id: str | DashboardId) -> Dashboard:
        """Remove and return a dashboard by id."""
        id_ = DashboardId.from_raw(dashboard_id)
        try:
            return self._dashboards.pop(id_)
        except KeyError as error:
            msg = f"Dashboard not found: {id_}"
            raise DashboardNotFoundError(msg) from error

    def find(self, dashboard_id: str | DashboardId) -> Dashboard | None:
        """Find a dashboard by id."""
        return self._dashboards.get(DashboardId.from_raw(dashboard_id))

    def get(self, dashboard_id: str | DashboardId) -> Dashboard:
        """Return a dashboard or raise when it does not exist."""
        id_ = DashboardId.from_raw(dashboard_id)
        dashboard = self.find(id_)
        if dashboard is None:
            msg = f"Dashboard not found: {id_}"
            raise DashboardNotFoundError(msg)
        return dashboard

    def list(self) -> tuple[Dashboard, ...]:
        """List dashboards in insertion order."""
        return tuple(self._dashboards.values())

    def clear(self) -> None:
        """Remove all dashboards from the registry."""
        self._dashboards.clear()

    def replace_all(self, dashboards: tuple[Dashboard, ...]) -> None:
        """Replace the complete registry contents in the supplied order."""
        replacement: dict[DashboardId, Dashboard] = {}
        for dashboard in dashboards:
            if not isinstance(dashboard, Dashboard):
                msg = "dashboard must be a Dashboard"
                raise TypeError(msg)
            if dashboard.id in replacement:
                msg = f"Dashboard already exists: {dashboard.id}"
                raise DashboardAlreadyExistsError(msg)
            replacement[dashboard.id] = dashboard
        self._dashboards = replacement
