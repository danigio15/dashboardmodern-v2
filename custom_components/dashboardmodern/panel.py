"""Frontend panel registration boundary for DashboardModern."""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from .runtime import DashboardModernRuntime


async def async_setup_panel(
    hass: HomeAssistant, runtime: DashboardModernRuntime
) -> None:
    """Set up the frontend panel for one DashboardModern config entry."""


async def async_unload_panel(
    hass: HomeAssistant, runtime: DashboardModernRuntime
) -> None:
    """Unload the frontend panel for one DashboardModern config entry."""
