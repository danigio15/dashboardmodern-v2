"""Persistence-specific exceptions for DashboardModern."""

from __future__ import annotations


class DashboardPersistenceError(Exception):
    """Base class for DashboardModern persistence failures."""


class MalformedStorageError(DashboardPersistenceError):
    """Raised when stored DashboardModern data is malformed or invalid."""


class UnsupportedStorageVersionError(DashboardPersistenceError):
    """Raised when persisted data uses an unsupported schema version."""
