"""Persistence support for DashboardModern dashboard aggregates."""

from __future__ import annotations

from .exceptions import (
    DashboardPersistenceError,
    MalformedStorageError,
    UnsupportedStorageVersionError,
)
from .repository import DashboardRepository
from .storage import HomeAssistantDashboardRepository

__all__ = [
    "DashboardPersistenceError",
    "DashboardRepository",
    "HomeAssistantDashboardRepository",
    "MalformedStorageError",
    "UnsupportedStorageVersionError",
]
