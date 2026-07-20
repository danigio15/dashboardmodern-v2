"""WebSocket API registration boundary for DashboardModern."""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from .runtime import DashboardModernRuntime


async def async_setup_websocket_api(
    hass: HomeAssistant, runtime: DashboardModernRuntime
) -> None:
    """Set up WebSocket commands for one DashboardModern config entry."""


async def async_unload_websocket_api(
    hass: HomeAssistant, runtime: DashboardModernRuntime
) -> None:
    """Unload WebSocket commands for one DashboardModern config entry."""
