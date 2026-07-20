"""Typed immutable dashboard application commands."""

from __future__ import annotations

from dataclasses import dataclass

from custom_components.dashboardmodern.domain import Dashboard, DashboardId


@dataclass(frozen=True, slots=True)
class CreateDashboardCommand:
    """Command to create one dashboard."""

    dashboard: Dashboard

    def __post_init__(self) -> None:
        """Validate command payload."""
        if not isinstance(self.dashboard, Dashboard):
            msg = "dashboard must be a Dashboard"
            raise TypeError(msg)


@dataclass(frozen=True, slots=True)
class ReplaceDashboardCommand:
    """Command to replace one existing dashboard."""

    dashboard: Dashboard

    def __post_init__(self) -> None:
        """Validate command payload."""
        if not isinstance(self.dashboard, Dashboard):
            msg = "dashboard must be a Dashboard"
            raise TypeError(msg)


@dataclass(frozen=True, slots=True)
class DeleteDashboardCommand:
    """Command to delete one existing dashboard."""

    dashboard_id: DashboardId

    def __post_init__(self) -> None:
        """Normalize and validate command payload."""
        object.__setattr__(
            self, "dashboard_id", DashboardId.from_raw(self.dashboard_id)
        )
