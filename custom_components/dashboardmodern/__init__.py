"""DashboardModern: serve the dashboardmodern HTML dashboard as an integration.

The integration hosts the dashboard so there is no HTML file for the user to
save and extract: it is served directly, versioned for cache-busting, and shown
in a panel. The dashboard talks to Home Assistant through the frontend's own
authenticated connection, so no token is stored anywhere.

New features are added inside the HTML dashboard itself, applied as reproducible
patches by scripts/vendor_legacy.py — not as a separate native renderer.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

PLATFORMS: list[str] = []


async def _reload_on_options_change(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Re-register the panel when visibility options change."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate v1 single-instance entries: they become the primary plancia."""
    if entry.version == 1:
        from .const import NAME

        data = {**entry.data}
        data.setdefault("name", entry.title or NAME)
        data["primary"] = True
        hass.config_entries.async_update_entry(entry, data=data, version=2)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Register the frontend that serves the HTML dashboard."""
    from .frontend import async_register_frontend

    await async_register_frontend(hass, entry.entry_id)
    entry.async_on_unload(entry.add_update_listener(_reload_on_options_change))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove this entry's panel registration."""
    from .frontend import async_unregister_frontend_entry

    await async_unregister_frontend_entry(hass, entry.entry_id)
    return True
