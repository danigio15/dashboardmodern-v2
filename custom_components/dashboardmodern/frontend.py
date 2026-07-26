"""Frontend registration for the DashboardModern integration."""

from __future__ import annotations

import hashlib
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

DATA_STATIC_REGISTERED = "static_registered"
DATA_STATIC_BASE_REGISTERED = "static_base_registered"
DATA_PANEL_REGISTERED = "panel_registered"
DATA_PANEL_ENTRY_IDS = "panel_entry_ids"
PANEL_URL_PATH = DOMAIN
PANEL_COMPONENT_NAME = "dashboardmodern-panel"
STATIC_URL_PATH = "/dashboardmodern_static"
FRONTEND_DIR = Path(__file__).parent / "frontend"
LEGACY_DIR = FRONTEND_DIR / "legacy"


# .html covers the vendored legacy dashboard, so shipping a new one changes
# the versioned mount and users get it without clearing anything.
# Images too: a release that only changes an icon must still change the
# versioned mount, or browsers keep serving the old one indefinitely.
ASSET_SUFFIXES = frozenset(
    {
        ".js",
        ".css",
        ".json",
        ".html",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".svg",
        ".gif",
        ".ico",
    }
)


@lru_cache(maxsize=1)
def _frontend_asset_version() -> str:
    """Return a version that changes whenever a shipped frontend asset changes.

    The version is derived from asset content rather than modification times so
    that the same installed release always produces the same URL. HACS and git
    both rewrite mtimes on download, which previously invalidated the browser
    cache on every reinstall even when nothing had changed.

    Assets are read once per Home Assistant process; shipped files do not change
    while Home Assistant is running.
    """
    digest = hashlib.blake2b(digest_size=8)
    for path in sorted(
        path
        for path in FRONTEND_DIR.rglob("*")
        if path.is_file() and path.suffix in ASSET_SUFFIXES
    ):
        digest.update(str(path.relative_to(FRONTEND_DIR).as_posix()).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def _versioned_static_url_path() -> str:
    """Return a unique static mount for the complete ES module graph."""
    return f"{STATIC_URL_PATH}/{_frontend_asset_version()}"


def legacy_variants() -> list[str]:
    """Return the vendored legacy dashboards that are actually shipped.

    Vendoring is a separate step, so a checkout may legitimately have none.
    The panel reads this instead of probing with a request that 404s.
    """
    if not LEGACY_DIR.is_dir():
        return []
    return sorted(path.name for path in LEGACY_DIR.glob("dashboard*.html"))


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
        "static_base": static_url_path,
        "legacy_variants": legacy_variants(),
        "_panel_custom": {
            "name": PANEL_COMPONENT_NAME,
            "embed_iframe": False,
            "trust_external": False,
            "module_url": f"{static_url_path}/panel.js",
        },
    }


def _admin_only_option(hass: HomeAssistant) -> bool:
    """Whether any config entry asks to restrict the panel to admins."""
    from .config_flow import OPTION_ADMIN_ONLY

    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.options.get(OPTION_ADMIN_ONLY):
            return True
    return False


def _register_or_update_panel(
    hass: HomeAssistant, entry_ids: list[str], *, update: bool, admin_only: bool = False
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
        # Default: everyone in the house sees the dashboard, since mutations
        # already require admin. When admin_only is set in the options, the
        # panel is hidden from non-admins — the finest per-user control Home
        # Assistant offers for a panel.
        require_admin=admin_only,
        update=update,
    )


def _remove_panel(hass: HomeAssistant) -> None:
    """Remove the DashboardModern panel from Home Assistant."""
    from homeassistant.components import frontend

    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)


async def _ensure_static_registered(
    hass: HomeAssistant, domain_data: dict[str, Any]
) -> None:
    """Register current versioned modules and the stable shared-asset path."""
    static_url_path = _versioned_static_url_path()
    if domain_data.get(DATA_STATIC_REGISTERED) == static_url_path:
        return

    from homeassistant.components.http import StaticPathConfig
    from homeassistant.setup import async_setup_component

    if hass.http is None:
        await async_setup_component(hass, "http", {})

    configs = [
        StaticPathConfig(
            url_path=static_url_path,
            path=str(FRONTEND_DIR),
            cache_headers=False,
        )
    ]
    # The stable mount serves shared assets and must be registered exactly once
    # per process; re-registering the same aiohttp route raises at runtime.
    if not domain_data.get(DATA_STATIC_BASE_REGISTERED):
        configs.insert(
            0,
            StaticPathConfig(
                url_path=STATIC_URL_PATH,
                path=str(FRONTEND_DIR),
                cache_headers=False,
            ),
        )

    await hass.http.async_register_static_paths(configs)
    domain_data[DATA_STATIC_BASE_REGISTERED] = True
    domain_data[DATA_STATIC_REGISTERED] = static_url_path


async def async_register_frontend(hass: HomeAssistant, entry_id: str) -> None:
    """Register DashboardModern static assets and current panel config."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    admin_only = _admin_only_option(hass)
    current_entry_ids: list[str] = domain_data.get(DATA_PANEL_ENTRY_IDS, [])
    next_entry_ids = _next_entry_ids(current_entry_ids, entry_id, add=True)
    already_registered = bool(domain_data.get(DATA_PANEL_REGISTERED))

    await _ensure_static_registered(hass, domain_data)
    _register_or_update_panel(
        hass, next_entry_ids, update=already_registered, admin_only=admin_only
    )
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
        _register_or_update_panel(
            hass, next_entry_ids, update=True, admin_only=_admin_only_option(hass)
        )
    domain_data[DATA_PANEL_ENTRY_IDS] = next_entry_ids
