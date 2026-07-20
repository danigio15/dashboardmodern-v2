"""Constants for DashboardModern persistence."""

from __future__ import annotations

from custom_components.dashboardmodern.const import DOMAIN

STORAGE_VERSION = 1
STORAGE_KEY_PREFIX = DOMAIN
STORAGE_KEY_SUFFIX = "dashboards"


def storage_key_for_entry(entry_id: str) -> str:
    """Return the stable Home Assistant storage key for a config entry."""
    return f"{STORAGE_KEY_PREFIX}.{entry_id}.{STORAGE_KEY_SUFFIX}"
