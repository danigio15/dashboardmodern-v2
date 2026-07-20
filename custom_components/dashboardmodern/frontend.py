"""Frontend registration for the DashboardModern integration."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

DATA_FRONTEND_REGISTERED = "frontend_registered"
DATA_PANEL_ENTRY_IDS = "panel_entry_ids"
PANEL_URL_PATH = DOMAIN
PANEL_COMPONENT_NAME = "dashboardmodern-panel"
STATIC_URL_PATH = "/dashboardmodern_static"
FRONTEND_DIR = Path(__file__).parent / "frontend"
_CUSTOM_PANEL_CONFIG = {
    "name": PANEL_COMPONENT_NAME,
    "embed_iframe": False,
    "trust_external": False,
    "module_url": f"{STATIC_URL_PATH}/panel.js",
}


def _next_entry_ids(current: list[str], entry_id: str, *, add: bool) -> list[str]:
    """Return the sorted frontend entry id set after a membership change."""
    entry_ids = set(current)
    if add:
        entry_ids.add(entry_id)
    else:
        entry_ids.discard(entry_id)
    return sorted(entry_ids)


def _panel_config(entry_ids: list[str]) -> dict[str, Any]:
    """Build a fresh Home Assistant panel config snapshot."""
    return {
        "entry_ids": list(entry_ids),
        "_panel_custom": dict(_CUSTOM_PANEL_CONFIG),
    }


def _register_or_update_panel(
    hass: HomeAssistant, entry_ids: list[str], *, update: bool
) -> None:
    """Register or update the DashboardModern panel with current entry ids."""
    from homeassistant.components import frontend

    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="DashboardModern",
        sidebar_icon="mdi:view-dashboard-edit",
        frontend_url_path=PANEL_URL_PATH,
        config=_panel_config(entry_ids),
        require_admin=True,
        update=update,
    )


async def async_register_frontend(hass: HomeAssistant, entry_id: str) -> None:
    """Register DashboardModern static assets and current panel config."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    current_entry_ids: list[str] = domain_data.get(DATA_PANEL_ENTRY_IDS, [])
    next_entry_ids = _next_entry_ids(current_entry_ids, entry_id, add=True)
    already_registered = bool(domain_data.get(DATA_FRONTEND_REGISTERED))

    from homeassistant.components.http import StaticPathConfig
    from homeassistant.setup import async_setup_component

    if not already_registered:
        if hass.http is None:
            await async_setup_component(hass, "http", {})
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    url_path=STATIC_URL_PATH,
                    path=str(FRONTEND_DIR),
                    cache_headers=False,
                )
            ]
        )

    _register_or_update_panel(hass, next_entry_ids, update=already_registered)
    domain_data[DATA_PANEL_ENTRY_IDS] = next_entry_ids
    domain_data[DATA_FRONTEND_REGISTERED] = True


async def async_unregister_frontend_entry(hass: HomeAssistant, entry_id: str) -> None:
    """Update DashboardModern panel entry metadata after an entry unloads."""
    domain_data: dict[str, Any] | None = hass.data.get(DOMAIN)
    if domain_data is None:
        return
    current_entry_ids: list[str] = domain_data.get(DATA_PANEL_ENTRY_IDS, [])
    next_entry_ids = _next_entry_ids(current_entry_ids, entry_id, add=False)
    if domain_data.get(DATA_FRONTEND_REGISTERED):
        _register_or_update_panel(hass, next_entry_ids, update=True)
    domain_data[DATA_PANEL_ENTRY_IDS] = next_entry_ids
