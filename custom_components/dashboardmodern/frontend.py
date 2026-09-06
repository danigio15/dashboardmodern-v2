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
# Cosa resta fuori dalla firma degli asset. Le cartelle si servono intere —
# vedi `_ensure_static_registered` — ma la firma guarda solo i file che il
# runtime puo' chiedere davvero: un appunto di manutenzione che cambia non
# deve far riscaricare la plancia a tutti.
IGNORED_RUNTIME_PARTS = frozenset({"e2e", "tests", "__pycache__"})
IGNORED_RUNTIME_FILES = frozenset({"legacy/VENDOR.json"})
# Cosa si monta sotto i due prefissi: i due moduli d'ingresso come file, le
# due cartelle intere. Prima ogni file aveva la sua rotta — trecentotrenta
# file, e due volte — e aiohttp le scorreva una per una a ogni richiesta.
RUNTIME_MOUNTS = (*sorted(RUNTIME_ROOT_FILES), *RUNTIME_DIRECTORIES)
# Le cartelle che non cambiano da un rilascio all'altro: i ritratti delle
# persone e i loghi dei marchi auto — questi ultimi prima venivano da un CDN,
# e su una plancia che non esce su internet non arrivavano mai. Si montano
# una volta, fuori dalla versione (nel percorso versionato vorrebbero dire
# riscaricarle a ogni aggiornamento) e fuori dalla firma.
SHARED_DIRECTORIES = ("avatars", "brands")


def _runtime_assets() -> Iterator[Path]:
    """Yield the files that count for the asset version."""
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

    La firma viene da nome, dimensione e istante di modifica di ogni file, non
    dal contenuto: leggere tredici megabyte in trecentotrenta file — a ogni
    avvio e a ogni ricarica, per ogni plancia — su una macchina piccola si
    sentiva. Un aggiornamento di HACS riscrive i file, e un file riscritto ha
    un istante nuovo: la firma cambia lo stesso, ed e' l'unica cosa che le si
    chiede.
    """
    digest = hashlib.blake2b(digest_size=8)
    for path in _runtime_assets():
        info = path.stat()
        digest.update(
            f"{path.relative_to(FRONTEND_DIR).as_posix()}\0"
            f"{info.st_size}\0{info.st_mtime_ns}\0".encode()
        )
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

    Il titolo pero' non basta a distinguerle: chi aggiunge una plancia lascia il
    nome proposto, e due plance chiamate allo stesso modo finivano nello stesso
    profilo — la nuova nasceva gia' piena della configurazione dell'altra.
    Adesso i profili si assegnano guardando tutte le plance insieme, e chi
    arriva su un nome gia' occupato ne riceve uno suo.
    """
    from .config_store import profile_for_entry, unique_profiles

    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        return profile_for_entry(
            primary=_entry_is_primary(hass, entry),
            title=entry.title or "",
            entry_id=entry.entry_id,
        )
    profili = unique_profiles(
        [
            (item.entry_id, item.title or "", _entry_is_primary(hass, item))
            for item in entries
        ]
    )
    return profili.get(entry.entry_id) or profile_for_entry(
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
    variants: list[str] | None = None,
) -> dict[str, Any]:
    """Build the panel config snapshot for one plancia.

    `variants` e' l'elenco delle plance legacy sul disco: chi lo ha gia' letto
    nell'executor lo passa, cosi' questa funzione — che gira nel loop — non
    tocca il disco. Senza, lo legge da se', ed e' il caso delle prove.
    """
    from .config_flow import OPTION_ADMIN_ONLY, OPTION_REGISTER_LOVELACE

    if asset_version is None:
        asset_version = _frontend_asset_version()
    if static_url_path is None:
        static_url_path = f"{STATIC_URL_PATH}/{asset_version}"
    if variants is None:
        variants = legacy_variants()
    return {
        "entry_ids": [entry.entry_id],
        "instance_id": entry.entry_id,
        "config_profile": _config_profile(hass, entry),
        "title": entry.title or "DashboardModern",
        "primary": _entry_is_primary(hass, entry),
        "static_base": static_url_path,
        "legacy_variants": list(variants),
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
    variants: list[str] | None = None,
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
            variants=variants,
        ),
        require_admin=bool(entry.options.get(OPTION_ADMIN_ONLY, False)),
        show_in_sidebar=True,
        update=update,
    )


def _remove_panel(hass: HomeAssistant, url_path: str) -> None:
    """Remove one plancia panel from Home Assistant."""
    from homeassistant.components import frontend

    frontend.async_remove_panel(hass, url_path, warn_if_unknown=False)


def _mounts_on_disk() -> tuple[list[str], list[str]]:
    """Which of the mounts exist on disk. E' disco: gira nell'executor."""

    def existing(names: tuple[str, ...]) -> list[str]:
        return [name for name in names if (FRONTEND_DIR / name).exists()]

    return existing(RUNTIME_MOUNTS), existing(SHARED_DIRECTORIES)


async def _ensure_static_registered(
    hass: HomeAssistant, domain_data: dict[str, Any], static_url_path: str
) -> None:
    """Monta gli asset del runtime sui due prefissi, stabile e versionato.

    Le cartelle si montano intere: una rotta per `legacy/`, una per `src/`,
    piu' i due moduli d'ingresso. Prima si registrava una rotta per ogni
    file, e due volte — sotto il prefisso versionato con la cache e sotto
    quello stabile senza — cioe' seicentosessanta rotte che aiohttp scorreva
    a ogni richiesta e che ogni ricarica dell'integrazione ricostruiva.

    Il prefisso stabile resta: e' la strada di recupero del guscio
    (`host.js`, `loadHostedDocument`) quando l'indirizzo versionato che un
    browser ha in mano non esiste piu' dopo un aggiornamento. Senza cache,
    perche' li' i file cambiano sotto lo stesso indirizzo.
    """
    if domain_data.get(DATA_STATIC_REGISTERED) == static_url_path:
        return

    from homeassistant.components.http import StaticPathConfig
    from homeassistant.setup import async_setup_component

    if hass.http is None:
        await async_setup_component(hass, "http", {})

    # Guardare il disco e' lavoro da executor: questa funzione gira nel loop
    # di Home Assistant, e dalla 2026.8 lo dice ad alta voce — «Detected
    # blocking call ... inside the event loop».
    runtime, shared = await hass.async_add_executor_job(_mounts_on_disk)

    def configs(
        prefix: str, names: list[str], cache_headers: bool
    ) -> list[StaticPathConfig]:
        return [
            StaticPathConfig(
                url_path=f"{prefix}/{name}",
                path=str(FRONTEND_DIR / name),
                cache_headers=cache_headers,
            )
            for name in names
        ]

    paths = configs(static_url_path, runtime, True)
    if not domain_data.get(DATA_STATIC_BASE_REGISTERED):
        paths = configs(STATIC_URL_PATH, runtime, False) + paths
        paths += configs(STATIC_URL_PATH, shared, True)

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
    # Anche l'elenco delle plance legacy e' una lettura del disco (`is_dir`,
    # `glob`): si fa qui, fuori dal loop, e si passa giu' gia' letto.
    variants = await hass.async_add_executor_job(legacy_variants)

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
        variants=variants,
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
