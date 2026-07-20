"""Application-layer exceptions for DashboardModern use cases."""

from __future__ import annotations

from custom_components.dashboardmodern.domain import DashboardId


class DashboardApplicationError(Exception):
    """Base exception for dashboard application use-case failures."""


class DashboardAlreadyExistsError(DashboardApplicationError):
    """Raised when creating a dashboard whose id already exists."""

    def __init__(self, dashboard_id: str | DashboardId) -> None:
        """Initialize the error with the conflicting dashboard id."""
        super().__init__(
            f"Dashboard already exists: {DashboardId.from_raw(dashboard_id)}"
        )


class DashboardNotFoundError(DashboardApplicationError):
    """Raised when a requested dashboard id does not exist."""

    def __init__(self, dashboard_id: str | DashboardId) -> None:
        """Initialize the error with the missing dashboard id."""
        super().__init__(f"Dashboard not found: {DashboardId.from_raw(dashboard_id)}")


class DashboardPersistenceSyncError(DashboardApplicationError):
    """Raised when persisted state could not be synchronized."""
