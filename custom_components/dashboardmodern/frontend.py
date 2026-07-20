"""Frontend registration for the DashboardModern integration."""

from __future__ import annotations

import inspect
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


async def async_register_frontend(hass: HomeAssistant, entry_id: str) -> None:
    """Register DashboardModern static assets and panel once per HA instance."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    entry_ids: list[str] = domain_data.setdefault(DATA_PANEL_ENTRY_IDS, [])
    if entry_id not in entry_ids:
        entry_ids.append(entry_id)
        entry_ids.sort()

    if domain_data.get(DATA_FRONTEND_REGISTERED):
        return

    from homeassistant.components import panel_custom
    from homeassistant.components.http import StaticPathConfig
    from homeassistant.setup import async_setup_component

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
    register_result = panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_COMPONENT_NAME,
        sidebar_title="DashboardModern",
        sidebar_icon="mdi:view-dashboard-edit",
        frontend_url_path=PANEL_URL_PATH,
        config={"entry_ids": entry_ids},
        require_admin=True,
        module_url=f"{STATIC_URL_PATH}/panel.js",
        embed_iframe=False,
    )
    if inspect.isawaitable(register_result):
        await register_result
    domain_data[DATA_FRONTEND_REGISTERED] = True


async def async_unregister_frontend_entry(hass: HomeAssistant, entry_id: str) -> None:
    """Update DashboardModern panel entry metadata after an entry unloads."""
    domain_data: dict[str, Any] | None = hass.data.get(DOMAIN)
    if domain_data is None:
        return
    entry_ids: list[str] = domain_data.setdefault(DATA_PANEL_ENTRY_IDS, [])
    if entry_id in entry_ids:
        entry_ids.remove(entry_id)
