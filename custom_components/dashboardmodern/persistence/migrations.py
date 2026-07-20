"""Storage migration infrastructure for DashboardModern persistence."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from .constants import STORAGE_VERSION
from .exceptions import UnsupportedStorageVersionError
from .schema import validate_envelope_shape

Migration = Callable[[Mapping[str, Any]], Mapping[str, Any]]
_MIGRATIONS: dict[int, Migration] = {}


def migrate_storage_envelope(data: object) -> Mapping[str, Any]:
    """Validate and migrate a raw envelope to the current storage version."""
    envelope = validate_envelope_shape(data)
    version = envelope["version"]
    if version > STORAGE_VERSION:
        msg = f"Unsupported DashboardModern storage version: {version}"
        raise UnsupportedStorageVersionError(msg)
    while version < STORAGE_VERSION:
        migration = _MIGRATIONS.get(version)
        if migration is None:
            msg = (
                f"No DashboardModern storage migration registered for version {version}"
            )
            raise UnsupportedStorageVersionError(msg)
        envelope = validate_envelope_shape(migration(envelope))
        version = envelope["version"]
    return envelope
