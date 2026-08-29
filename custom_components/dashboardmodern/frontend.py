"""Frontend registration for the DashboardModern integration."""

from __future__ import annotations

import hashlib
from collections.abc import Iterator
from pathlib import Path
from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

DATA_STATIC_REGISTERED = "static_registered"
DATA_STATIC_BASE_REGISTERED = "static_base_registered"
DATA_DASHBOARD_CARD_REGISTERED = "dashboard_card_registered"
DATA_PANEL_PATHS = "panel_paths"
PANEL_URL_PATH = DOMAIN
PANEL_COMPONENT_NAME = "dashboardmodern-panel"
STATIC_URL_PATH = "/dashboardmodern_static"
FRONTEND_DIR = Path(__file__).parent / "frontend"
LEGACY_DIR = FRONTEND_DIR / "legacy"
AVATAR_DIR = FRONTEND_DIR / "avatars"
AVATAR_URL_PATH = f"{STATIC_URL_PATH}/avatars"
BRAND_DIR = FRONTEND_DIR / "brands"
BRAND_URL_PATH = f"{STATIC_URL_PATH}/brands"

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
        # I caratteri arrivano con la plancia: senza questi due suffissi il
        # foglio in legacy/vendor/caratteri.css chiederebbe file che
        # l'integrazione non serve, e la plancia tornerebbe al carattere di
        # sistema — che e' esattamente cio' che si voleva smettere di fare.
        ".woff2",
        ".woff",
    }
)
RUNTIME_ROOT_FILES = frozenset({"panel.js", "dashboard-card.js"})
RUNTIME_DIRECTORIES = ("legacy", "src")
IGNORED_RUNTIME_PARTS = frozenset({"e2e", "tests", "__pycache__"})
IGNORED_RUNTIME_FILES = frozenset({"legacy/VENDOR.json"})


def _runtime_assets() -> Iterator[Path]:
    """Yield only files that can be requested by the production runtime."""
    for name in sorted(RUNTIME_ROOT_FILES):
        path = FRONTEND_DIR / name
        if path.is_file():
            yield path
    for directory_name in RUNTIME_DIRECTORIES:
        directory = FRONTEND_DIR / directory_name
        if not directory.is_dir():
            continue
        for path in sorted(directory.rglob("*")):
            relative = path.relative_to(FRONTEND_DIR).as_posix()
            if (
                path.is_file()
                and path.suffix in ASSET_SUFFIXES
                and relative not in IGNORED_RUNTIME_FILES
                and not IGNORED_RUNTIME_PARTS.intersection(path.parts)
            ):
                yield path


def _frontend_asset_version() -> str:
    """Return the live digest of the runtime assets currently on disk.

    Do not cache this value across integration reloads. HACS replaces frontend
    files in place while the Home Assistant Python process may stay alive; a
    process-lifetime cache would keep publishing the previous versioned URL and
    let browsers reuse stale immutable assets after a successful update.
    """
    digest = hashlib.blake2b(digest_size=8)
    for path in _runtime_assets():
        digest.update(str(path.relative_to(FRONTEND_DIR).as_posix()).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def _versioned_static_url_path() -> str:
    """Return a unique static mount for the complete ES module graph."""
    return f"{STATIC_URL_PATH}/{_frontend_asset_version()}"


def legacy_variants() -> list[str]:
    """Return the vendored legacy dashboards that are actually shipped."""
    if not LEGACY_DIR.is_dir():
        return []
    return sorted(path.name for path in LEGACY_DIR.glob("dashboard*.html"))


def _entry_is_primary(hass: HomeAssistant, entry: Any) -> bool:
    """Whether this entry is the primary plancia."""
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


def _config_profile(hass: HomeAssistant, entry: Any) -> str:
    """Return the shared configuration profile of this plancia.

    Deliberately independent of the entry_id: removing and re-adding the
    integration used to change the storage key of the configuration and left the
    plancia empty. The primary plancia keeps a fixed profile, the others follow
    their title, and a rename is followed by the store itself.
    """
    from .config_store import profile_for_entry

    return profile_for_entry(
        primary=_entry_is_primary(hass, entry),
        title=entry.title or "",
        entry_id=entry.entry_id,
    )


def _lovelace_url_path(entry: Any) -> str:
    """Return the stable URL of the companion Lovelace dashboard."""
    return f"dashboardmodern-{entry.entry_id[:8].lower()}"


def _allowed_user_ids(entry: Any) -> list[str]:
    """Return the exact user allow-list stored in the entry options."""
    from .config_flow import OPTION_ALLOWED_USERS

    value = entry.options.get(OPTION_ALLOWED_USERS, [])
    if not isinstance(value, list):
        return []
    return [str(user_id) for user_id in value if user_id]


def _panel_config(
    hass: HomeAssistant,
    entry: Any,
    *,
    asset_version: str | None = None,
    static_url_path: str | None = None,
) -> dict[str, Any]:
    """Build the panel config snapshot for one plancia."""
    from .config_flow import OPTION_ADMIN_ONLY, OPTION_REGISTER_LOVELACE

    if asset_version is None:
        asset_version = _frontend_asset_version()
    if static_url_path is None:
        static_url_path = f"{STATIC_URL_PATH}/{asset_version}"
    return {
        "entry_ids": [entry.entry_id],
        "instance_id": entry.entry_id,
        "config_profile": _config_profile(hass, entry),
        "title": entry.title or "DashboardModern",
        "primary": _entry_is_primary(hass, entry),
        "static_base": static_url_path,
        "legacy_variants": legacy_variants(),
        "allowed_user_ids": _allowed_user_ids(entry),
        "register_lovelace_dashboard": bool(
            entry.options.get(OPTION_REGISTER_LOVELACE, True)
        ),
        "admin_only": bool(entry.options.get(OPTION_ADMIN_ONLY, False)),
        "lovelace_url_path": _lovelace_url_path(entry),
        "dashboard_card_module": f"{static_url_path}/dashboard-card.js",
        "_panel_custom": {
            "name": f"{PANEL_COMPONENT_NAME}-{asset_version[:8]}",
            "embed_iframe": False,
            "trust_external": False,
            "module_url": f"{static_url_path}/panel.js",
        },
    }


def _register_or_update_panel(
    hass: HomeAssistant,
    entry: Any,
    url_path: str,
    *,
    update: bool,
    asset_version: str,
    static_url_path: str,
) -> None:
    """Register or update the custom panel for one plancia."""
    from homeassistant.components import frontend

    from .config_flow import OPTION_ADMIN_ONLY

    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=entry.title or "DashboardModern",
        sidebar_icon="mdi:view-dashboard-edit",
        frontend_url_path=url_path,
        config=_panel_config(
            hass,
            entry,
            asset_version=asset_version,
            static_url_path=static_url_path,
        ),
        require_admin=bool(entry.options.get(OPTION_ADMIN_ONLY, False)),
        show_in_sidebar=True,
        update=update,
    )


def _remove_panel(hass: HomeAssistant, url_path: str) -> None:
    """Remove one plancia panel from Home Assistant."""
    from homeassistant.components import frontend

    frontend.async_remove_panel(hass, url_path, warn_if_unknown=False)


async def _ensure_static_registered(
    hass: HomeAssistant, domain_data: dict[str, Any], static_url_path: str
) -> None:
    """Register only production runtime assets on stable/versioned URLs."""
    if domain_data.get(DATA_STATIC_REGISTERED) == static_url_path:
        return

    from homeassistant.components.http import StaticPathConfig
    from homeassistant.setup import async_setup_component

    if hass.http is None:
        await async_setup_component(hass, "http", {})

    # Percorrere la cartella e' un'operazione di disco, e questa funzione gira
    # nell'event loop di Home Assistant: dalla 2026.8 lo dice ad alta voce —
    # «Detected blocking call to scandir». Non e' un avviso pedante: sono
    # centosettanta moduli piu' il guscio, e mentre il ciclo cammina fra i file
    # nessun'altra integrazione va avanti. L'elenco si costruisce quindi da
    # parte, come si fa gia' per il digest degli asset qui sopra.
    assets = await hass.async_add_executor_job(lambda: list(_runtime_assets()))

    def configs(prefix: str, cache_headers: bool) -> list[StaticPathConfig]:
        return [
            StaticPathConfig(
                url_path=f"{prefix}/{path.relative_to(FRONTEND_DIR).as_posix()}",
                path=str(path),
                cache_headers=cache_headers,
            )
            for path in assets
        ]

    paths = configs(static_url_path, True)
    if not domain_data.get(DATA_STATIC_BASE_REGISTERED):
        paths = configs(STATIC_URL_PATH, False) + paths
        # I ritratti delle persone sono duecentocinquanta immagini che non
        # cambiano da un rilascio all'altro: si montano come cartella, una
        # volta, fuori dalla versione. Metterle nel percorso versionato
        # vorrebbe dire riscaricarle a ogni aggiornamento, e leggerne ogni
        # byte a ogni avvio solo per calcolare la firma degli asset.
        if AVATAR_DIR.is_dir():
            paths.append(
                StaticPathConfig(
                    url_path=AVATAR_URL_PATH,
                    path=str(AVATAR_DIR),
                    cache_headers=True,
                )
            )
        # I loghi dei marchi auto, per la stessa ragione. Prima venivano da un
        # CDN: su una plancia che sta su una rete di casa e non esce su
        # internet non arrivavano mai, e nessuno se ne accorgeva perche'
        # un'immagine che non arriva non fa rumore.
        if BRAND_DIR.is_dir():
            paths.append(
                StaticPathConfig(
                    url_path=BRAND_URL_PATH,
                    path=str(BRAND_DIR),
                    cache_headers=True,
                )
            )

    await hass.http.async_register_static_paths(paths)
    domain_data[DATA_STATIC_BASE_REGISTERED] = True
    domain_data[DATA_STATIC_REGISTERED] = static_url_path


def _ensure_dashboard_card_registered(
    hass: HomeAssistant, domain_data: dict[str, Any], static_url_path: str
) -> None:
    """Load the companion custom card through the public frontend API."""
    from homeassistant.components import frontend

    module_url = f"{static_url_path}/dashboard-card.js"
    if domain_data.get(DATA_DASHBOARD_CARD_REGISTERED) == module_url:
        return

    previous = domain_data.get(DATA_DASHBOARD_CARD_REGISTERED)
    if previous:
        frontend.remove_extra_js_url(hass, previous)
    frontend.add_extra_js_url(hass, module_url)
    domain_data[DATA_DASHBOARD_CARD_REGISTERED] = module_url


async def async_register_frontend(hass: HomeAssistant, entry_id: str) -> None:
    """Register static assets, custom card and this plancia's sidebar panel."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None:
        return

    asset_version = await hass.async_add_executor_job(_frontend_asset_version)
    static_url_path = f"{STATIC_URL_PATH}/{asset_version}"

    await _ensure_static_registered(hass, domain_data, static_url_path)
    _ensure_dashboard_card_registered(hass, domain_data, static_url_path)

    paths: dict[str, str] = domain_data.setdefault(DATA_PANEL_PATHS, {})
    taken = {p for eid, p in paths.items() if eid != entry_id}
    new_path = _panel_url_path(hass, entry, taken)
    old_path = paths.get(entry_id)
    if old_path and old_path != new_path:
        _remove_panel(hass, old_path)
    _register_or_update_panel(
        hass,
        entry,
        new_path,
        update=old_path == new_path,
        asset_version=asset_version,
        static_url_path=static_url_path,
    )
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
