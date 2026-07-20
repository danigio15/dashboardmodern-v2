"""Runtime container for DashboardModern config entries."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.core import HomeAssistant


@dataclass(slots=True)
class DashboardModernRuntime:
    """Minimal per-entry runtime container for DashboardModern."""

    hass: HomeAssistant
    entry_id: str


def create_runtime(hass: HomeAssistant, entry_id: str) -> DashboardModernRuntime:
    """Create the runtime container for a config entry."""
    return DashboardModernRuntime(hass=hass, entry_id=entry_id)
