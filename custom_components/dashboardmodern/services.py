"""Service registration boundary for DashboardModern."""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from .runtime import DashboardModernRuntime


async def async_setup_services(
    hass: HomeAssistant, runtime: DashboardModernRuntime
) -> None:
    """Set up services for one DashboardModern config entry."""


async def async_unload_services(
    hass: HomeAssistant, runtime: DashboardModernRuntime
) -> None:
    """Unload services for one DashboardModern config entry."""
