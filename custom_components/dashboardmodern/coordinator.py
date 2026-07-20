"""Coordinator layer boundary for DashboardModern."""

from __future__ import annotations

from homeassistant.core import HomeAssistant


class DashboardModernCoordinator:
    """Entry-scoped coordinator boundary for future derived state."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialize the coordinator boundary."""
        self.hass = hass
        self.entry_id = entry_id

    async def async_setup(self) -> None:
        """Set up coordinator resources for this config entry."""

    async def async_unload(self) -> None:
        """Unload coordinator resources for this config entry."""
