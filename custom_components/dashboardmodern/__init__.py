"""DashboardModern Home Assistant integration."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .const import DATA_RUNTIMES, DOMAIN

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
    from .frontend import async_register_frontend
    from .runtime import async_create_runtime
    from .websocket_api import async_register_websocket_api

    async_register_websocket_api(hass)
    await async_register_frontend(hass, entry.entry_id)
    runtime = await async_create_runtime(hass, entry.entry_id)

    hass.data.setdefault(DOMAIN, {}).setdefault(DATA_RUNTIMES, {})[entry.entry_id] = (
        runtime
    )
    entry.runtime_data = runtime

    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: DashboardModernConfigEntry
) -> bool:
    """Unload a DashboardModern config entry."""
    from .frontend import async_unregister_frontend_entry

    await async_unregister_frontend_entry(hass, entry.entry_id)

    domain_data = hass.data.get(DOMAIN)
    if domain_data is not None:
        runtimes = domain_data.get(DATA_RUNTIMES, {})
        runtimes.pop(entry.entry_id, None)

    entry.runtime_data = None

    return True
