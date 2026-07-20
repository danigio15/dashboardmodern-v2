"""Storage layer boundary for DashboardModern."""

from __future__ import annotations

from homeassistant.core import HomeAssistant


class DashboardModernStorage:
    """Entry-scoped storage boundary for future dashboard documents."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialize the storage boundary."""
        self.hass = hass
        self.entry_id = entry_id

    async def async_setup(self) -> None:
        """Set up storage resources for this config entry."""

    async def async_unload(self) -> None:
        """Unload storage resources for this config entry."""
