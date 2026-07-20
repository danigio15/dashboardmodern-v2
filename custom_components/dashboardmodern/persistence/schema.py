"""Versioned storage schema helpers for DashboardModern persistence."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, TypedDict, cast

from custom_components.dashboardmodern.domain import Dashboard, DashboardId
from custom_components.dashboardmodern.domain.exceptions import ValidationError

from .constants import STORAGE_VERSION
from .exceptions import MalformedStorageError


class StorageEnvelope(TypedDict):
    """Versioned DashboardModern storage envelope."""

    version: int
    dashboards: list[dict[str, Any]]


def serialize_dashboards(dashboards: tuple[Dashboard, ...]) -> StorageEnvelope:
    """Serialize dashboards into a versioned JSON-compatible envelope."""
    _ensure_unique_dashboard_ids(dashboards)
    return {
        "version": STORAGE_VERSION,
        "dashboards": [dashboard.to_dict() for dashboard in dashboards],
    }


def deserialize_dashboards(envelope: Mapping[str, Any]) -> tuple[Dashboard, ...]:
    """Deserialize dashboards from a migrated storage envelope."""
    dashboards_data = envelope.get("dashboards")
    if not isinstance(dashboards_data, list):
        msg = "Dashboard storage envelope must contain a dashboards list"
        raise MalformedStorageError(msg)

    dashboards = tuple(_deserialize_dashboard(item) for item in dashboards_data)
    _ensure_unique_dashboard_ids(dashboards)
    return dashboards


def validate_envelope_shape(data: object) -> Mapping[str, Any]:
    """Validate that raw storage data is a minimally valid envelope mapping."""
    if not isinstance(data, Mapping):
        msg = "Dashboard storage envelope must be a mapping"
        raise MalformedStorageError(msg)
    version = data.get("version")
    if not isinstance(version, int):
        msg = "Dashboard storage envelope version must be an integer"
        raise MalformedStorageError(msg)
    if "dashboards" not in data:
        msg = "Dashboard storage envelope is missing dashboards"
        raise MalformedStorageError(msg)
    return data


def _deserialize_dashboard(data: object) -> Dashboard:
    if not isinstance(data, Mapping):
        msg = "Stored dashboard must be a mapping"
        raise MalformedStorageError(msg)
    try:
        return Dashboard.from_dict(cast(dict[str, Any], dict(data)))
    except (KeyError, TypeError, ValueError, ValidationError) as error:
        msg = "Stored dashboard is malformed or invalid"
        raise MalformedStorageError(msg) from error


def _ensure_unique_dashboard_ids(dashboards: Sequence[Dashboard]) -> None:
    seen: set[DashboardId] = set()
    for dashboard in dashboards:
        if dashboard.id in seen:
            msg = f"Duplicate dashboard id in persisted data: {dashboard.id}"
            raise MalformedStorageError(msg)
        seen.add(dashboard.id)
