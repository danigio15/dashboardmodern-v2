"""DashboardModern Home Assistant integration."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .panel import async_setup_panel, async_unload_panel
from .runtime import DashboardModernRuntime, create_runtime
from .services import async_setup_services, async_unload_services
from .websocket_api import async_setup_websocket_api, async_unload_websocket_api

PLATFORMS: list[str] = []

type DashboardModernConfigEntry = ConfigEntry[DashboardModernRuntime]


async def async_setup_entry(
    hass: HomeAssistant, entry: DashboardModernConfigEntry
) -> bool:
    """Set up DashboardModern from a config entry."""
    runtime = create_runtime(hass, entry.entry_id)
    await runtime.async_setup()
    await async_setup_services(hass, runtime)
    await async_setup_websocket_api(hass, runtime)
    await async_setup_panel(hass, runtime)

    entry.runtime_data = runtime
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = runtime

    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: DashboardModernConfigEntry
) -> bool:
    """Unload a DashboardModern config entry."""
    runtime = entry.runtime_data

    await async_unload_panel(hass, runtime)
    await async_unload_websocket_api(hass, runtime)
    await async_unload_services(hass, runtime)
    await runtime.async_unload()

    domain_data = hass.data.get(DOMAIN, {})
    domain_data.pop(entry.entry_id, None)
    if not domain_data:
        hass.data.pop(DOMAIN, None)

    return True
