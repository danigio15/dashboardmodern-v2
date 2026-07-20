"""JSON API serialization helpers for DashboardModern domain objects."""

from __future__ import annotations

from typing import Any

from custom_components.dashboardmodern.domain import Dashboard


def serialize_dashboard(dashboard: Dashboard) -> dict[str, Any]:
    """Serialize a dashboard into a JSON-compatible API payload."""
    return dashboard.to_dict()


def deserialize_dashboard(payload: dict[str, Any]) -> Dashboard:
    """Deserialize an API payload into a Dashboard domain object."""
    return Dashboard.from_dict(payload)
