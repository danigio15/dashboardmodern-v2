"""Frontend registration for the DashboardModern integration."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

DATA_STATIC_REGISTERED = "static_registered"
DATA_PANEL_REGISTERED = "panel_registered"
DATA_PANEL_ENTRY_IDS = "panel_entry_ids"
PANEL_URL_PATH = DOMAIN
PANEL_COMPONENT_NAME = "dashboardmodern-panel"
STATIC_URL_PATH = "/dashboardmodern_static"
FRONTEND_DIR = Path(__file__).parent / "frontend"


def _frontend_asset_version() -> str:
    """Return a version that changes whenever a shipped frontend asset changes."""
    mtimes = (
        path.stat().st_mtime_ns
        for path in FRONTEND_DIR.rglob("*")
        if path.is_file() and path.suffix in {".js", ".css", ".json"}
    )
    return format(max(mtimes, default=0), "x")


def _versioned_static_url_path() -> str:
    """Return a unique static mount for the complete ES module graph."""
    return f"{STATIC_URL_PATH}/{_frontend_asset_version()}"


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
    static_url_path = _versioned_static_url_path()
    return {
        "entry_ids": list(entry_ids),
        "_panel_custom": {
            "name": PANEL_COMPONENT_NAME,
            "embed_iframe": False,
            "trust_external": False,
            "module_url": f"{static_url_path}/panel.js",
        },
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


def _remove_panel(hass: HomeAssistant) -> None:
    """Remove the DashboardModern panel from Home Assistant."""
    from homeassistant.components import frontend

    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)


async def _ensure_static_registered(
    hass: HomeAssistant, domain_data: dict[str, Any]
) -> None:
    """Register the current versioned asset path once per Home Assistant run."""
    static_url_path = _versioned_static_url_path()
    if domain_data.get(DATA_STATIC_REGISTERED) == static_url_path:
        return

    from homeassistant.components.http import StaticPathConfig
    from homeassistant.setup import async_setup_component

    if hass.http is None:
        await async_setup_component(hass, "http", {})
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                url_path=static_url_path,
                path=str(FRONTEND_DIR),
                cache_headers=False,
            )
        ]
    )
    domain_data[DATA_STATIC_REGISTERED] = static_url_path


async def async_register_frontend(hass: HomeAssistant, entry_id: str) -> None:
    """Register DashboardModern static assets and current panel config."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    current_entry_ids: list[str] = domain_data.get(DATA_PANEL_ENTRY_IDS, [])
    next_entry_ids = _next_entry_ids(current_entry_ids, entry_id, add=True)
    already_registered = bool(domain_data.get(DATA_PANEL_REGISTERED))

    await _ensure_static_registered(hass, domain_data)
    _register_or_update_panel(hass, next_entry_ids, update=already_registered)
    domain_data[DATA_PANEL_ENTRY_IDS] = next_entry_ids
    domain_data[DATA_PANEL_REGISTERED] = True


async def async_unregister_frontend_entry(hass: HomeAssistant, entry_id: str) -> None:
    """Update DashboardModern panel entry metadata after an entry unloads."""
    domain_data: dict[str, Any] | None = hass.data.get(DOMAIN)
    if domain_data is None:
        return
    current_entry_ids: list[str] = domain_data.get(DATA_PANEL_ENTRY_IDS, [])
    next_entry_ids = _next_entry_ids(current_entry_ids, entry_id, add=False)

    if not next_entry_ids:
        if domain_data.get(DATA_PANEL_REGISTERED):
            _remove_panel(hass)
        domain_data.pop(DATA_PANEL_ENTRY_IDS, None)
        domain_data.pop(DATA_PANEL_REGISTERED, None)
        return

    if domain_data.get(DATA_PANEL_REGISTERED):
        _register_or_update_panel(hass, next_entry_ids, update=True)
    domain_data[DATA_PANEL_ENTRY_IDS] = next_entry_ids
