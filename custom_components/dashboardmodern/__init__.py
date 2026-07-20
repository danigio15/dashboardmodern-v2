"""DashboardModern Home Assistant integration."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

    from .runtime import DashboardModernRuntime

    type DashboardModernConfigEntry = ConfigEntry[DashboardModernRuntime | None]
else:
    DashboardModernConfigEntry = Any
    HomeAssistant = Any

PLATFORMS: list[str] = []


async def async_setup_entry(
    hass: HomeAssistant, entry: DashboardModernConfigEntry
) -> bool:
    """Set up DashboardModern from a config entry."""
    from .runtime import async_create_runtime
    from .websocket_api import async_register_websocket_api

    async_register_websocket_api(hass)
    runtime = await async_create_runtime(hass, entry.entry_id)

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = runtime
    entry.runtime_data = runtime

    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: DashboardModernConfigEntry
) -> bool:
    """Unload a DashboardModern config entry."""
    domain_data = hass.data.get(DOMAIN)
    if domain_data is not None:
        domain_data.pop(entry.entry_id, None)
        if not domain_data:
            hass.data.pop(DOMAIN, None)

    entry.runtime_data = None

    return True
