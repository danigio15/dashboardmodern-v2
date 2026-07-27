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


DATA_PANEL_PATHS = "panel_paths"


def _entry_is_primary(hass: HomeAssistant, entry: Any) -> bool:
    """Whether this entry is the primary plancia (historic URL and sync key)."""
    if entry.data.get("primary"):
        return True
    entries = hass.config_entries.async_entries(DOMAIN)
    if any(e.data.get("primary") for e in entries):
        return False
    return bool(entries) and entries[0].entry_id == entry.entry_id


def _panel_url_path(hass: HomeAssistant, entry: Any, taken: set[str]) -> str:
    """Stable sidebar URL: the primary keeps the historic path."""
    if _entry_is_primary(hass, entry):
        return PANEL_URL_PATH
    from homeassistant.util import slugify

    slug = slugify(entry.title or "") or entry.entry_id[:6]
    path = f"{PANEL_URL_PATH}-{slug}"
    if path in taken:
        path = f"{PANEL_URL_PATH}-{slug}-{entry.entry_id[:6]}"
    return path


def _panel_config(hass: HomeAssistant, entry: Any) -> dict[str, Any]:
    """Build the panel config snapshot for one plancia."""
    static_url_path = _versioned_static_url_path()
    return {
        "entry_ids": [entry.entry_id],
        "instance_id": entry.entry_id,
        "primary": _entry_is_primary(hass, entry),
        "static_base": static_url_path,
        "legacy_variants": legacy_variants(),
        "_panel_custom": {
            "name": PANEL_COMPONENT_NAME,
            "embed_iframe": False,
            "trust_external": False,
            "module_url": f"{static_url_path}/panel.js",
        },
    }


def _register_or_update_panel(
    hass: HomeAssistant, entry: Any, url_path: str, *, update: bool
) -> None:
    """Register or update the panel for one plancia."""
    from homeassistant.components import frontend

    from .config_flow import OPTION_ADMIN_ONLY

    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=entry.title or "DashboardModern",
        sidebar_icon="mdi:view-dashboard-edit",
        frontend_url_path=url_path,
        config=_panel_config(hass, entry),
        require_admin=bool(entry.options.get(OPTION_ADMIN_ONLY, False)),
        update=update,
    )


def _remove_panel(hass: HomeAssistant, url_path: str) -> None:
    """Remove one plancia panel from Home Assistant."""
    from homeassistant.components import frontend

    frontend.async_remove_panel(hass, url_path, warn_if_unknown=False)


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
    """Register static assets and this plancia's own sidebar panel."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None:
        return

    await _ensure_static_registered(hass, domain_data)

    paths: dict[str, str] = domain_data.setdefault(DATA_PANEL_PATHS, {})
    taken = {p for eid, p in paths.items() if eid != entry_id}
    new_path = _panel_url_path(hass, entry, taken)
    old_path = paths.get(entry_id)
    if old_path and old_path != new_path:
        _remove_panel(hass, old_path)
    _register_or_update_panel(hass, entry, new_path, update=old_path == new_path)
    paths[entry_id] = new_path


async def async_unregister_frontend_entry(hass: HomeAssistant, entry_id: str) -> None:
    """Remove this plancia's panel after its entry unloads."""
    domain_data: dict[str, Any] | None = hass.data.get(DOMAIN)
    if domain_data is None:
        return
    paths: dict[str, str] = domain_data.get(DATA_PANEL_PATHS, {})
    path = paths.pop(entry_id, None)
    if path:
        _remove_panel(hass, path)
