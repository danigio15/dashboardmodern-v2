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

# L'unica piattaforma e' l'avviso di aggiornamento, e la porta una plancia
# sola: chi ne ha due non deve ritrovarsi due voci per la stessa versione.
PLATFORMS: list[str] = ["update"]


def _primary_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Say whether this entry is the one that answers for the integration.

    «Primaria» e' quella creata per prima, e il campo lo scrive il config flow.
    Una configurazione vecchia puo' non averlo su nessuna: in quel caso vale la
    prima per identificativo, che e' un ordine stabile fra un riavvio e
    l'altro — non «quella che capita».
    """
    if entry.data.get("primary"):
        return True
    entries = hass.config_entries.async_entries(entry.domain)
    if any(candidate.data.get("primary") for candidate in entries):
        return False
    return entry.entry_id == min(candidate.entry_id for candidate in entries)


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
    from .config_store import async_get_config_store
    from .frontend import async_register_frontend
    from .websocket_api import async_register_websocket_api

    # The shared configuration store is the authoritative copy of every plancia,
    # so it is loaded and reachable before the panel can ask for it.
    await async_get_config_store(hass)
    async_register_websocket_api(hass)
    await async_register_frontend(hass, entry.entry_id)
    entry.async_on_unload(entry.add_update_listener(_reload_on_options_change))
    if _primary_entry(hass, entry):
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove this entry's panel registration."""
    from .frontend import async_unregister_frontend_entry

    if _primary_entry(hass, entry):
        await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    await async_unregister_frontend_entry(hass, entry.entry_id)
    return True
