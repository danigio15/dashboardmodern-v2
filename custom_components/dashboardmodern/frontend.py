"""Frontend registration for the DashboardModern integration."""

from __future__ import annotations

import hashlib
import logging
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
_LOGGER = logging.getLogger(__name__)

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
        "dashboard_card_module": _dashboard_card_module_url(asset_version),
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
    """Registra o aggiorna il pannello di una plancia.

    Gli argomenti sono quelli che `async_register_built_in_panel` accetta
    davvero, e non uno di piu'.

    Qui c'era anche `show_in_sidebar=True`, e quel parametro Home Assistant lo
    ha aggiunto solo nella 2026.3. Dalla 2026.2 in giu' la firma e' `(hass,
    component_name, sidebar_title, sidebar_icon, frontend_url_path, config,
    require_admin, *, update, config_panel_domain)` e basta: passarglielo
    solleva `TypeError: unexpected keyword argument`, il setup della voce
    fallisce e l'integrazione non compare.

    E' l'installazione che «non parte» segnalata sul gruppo, e chi l'ha risolta
    cancellando quella riga aveva ragione. Non si vedeva perche' su una Home
    Assistant recente non succede niente — la riga passa — e chi sviluppa ce
    l'ha recente; a restare fuori sono le case ferme a una versione piu'
    vecchia, cioe' proprio quelle che l'integrazione non l'hanno mai vista
    partire.

    Non serviva nemmeno: nella 2026.3 quel parametro vale `True` di suo, quindi
    scriverlo diceva quello che sarebbe successo comunque. Toglierlo non cambia
    niente dove funzionava e rimette in piedi l'installazione dalla 2025.1 in
    poi, che e' la versione minima che `hacs.json` promette.
    """
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


def _dashboard_card_module_url(asset_version: str) -> str:
    """L'indirizzo con cui il frontend carica la card, e perche' non e' versionato.

    Era `{prefisso}/{firma}/dashboard-card.js`, cioe' un indirizzo che cambia a
    ogni aggiornamento. Quell'indirizzo il frontend se lo porta dentro l'avvio
    della pagina, e l'app companion di Android l'avvio se lo tiene in cache a
    lungo: dopo un aggiornamento la pagina in cache chiede ancora la firma
    vecchia, quel percorso non esiste piu', e l'elemento non viene mai definito.
    Il risultato e' «Custom element doesn't exist: dashboardmodern-card» sulla
    dashboard predefinita — e infatti succedeva sui telefoni con l'app
    installata da tempo e non su uno appena installato (#372).

    Adesso il PERCORSO e' quello stabile, che c'e' sempre, e la firma sta nella
    domanda: una pagina vecchia chiede una firma vecchia allo stesso percorso e
    riceve la card di adesso invece di un 404, e una pagina nuova chiede una
    firma nuova e non riusa quella in cache. La card ricava da se' la sua base
    per il resto degli asset, quindi non le cambia niente.
    """
    return f"{STATIC_URL_PATH}/dashboard-card.js?v={asset_version}"


def _ensure_dashboard_card_registered(
    hass: HomeAssistant, domain_data: dict[str, Any], static_url_path: str
) -> None:
    """Load the companion custom card through the public frontend API."""
    from homeassistant.components import frontend

    module_url = _dashboard_card_module_url(static_url_path.rsplit("/", 1)[-1])
    if domain_data.get(DATA_DASHBOARD_CARD_REGISTERED) == module_url:
        return

    previous = domain_data.get(DATA_DASHBOARD_CARD_REGISTERED)
    if previous:
        frontend.remove_extra_js_url(hass, previous)
    frontend.add_extra_js_url(hass, module_url)
    domain_data[DATA_DASHBOARD_CARD_REGISTERED] = module_url


def _companion_view(entry: Any, config_profile: str, primary: bool) -> dict[str, Any]:
    """La vista della dashboard di appoggio: una sola card, la plancia intera.

    Scritta qui e in nessun altro posto. Prima la scriveva `panel.js`, cioe' il
    pannello: e il pannello gira solo quando qualcuno apre la plancia dalla barra
    laterale. Chi la mette come dashboard predefinita e riavvia apre quella
    dashboard senza passare dal pannello, e se il contenuto non era mai stato
    scritto Home Assistant risponde «Errore di configurazione» — mentre aprirla
    dalla barra la riparava. Era esattamente la segnalazione: «quando si imposta
    la plancia come predefinita ed apro app HA va in errore, se invece la
    seleziono dal menu laterale funziona».

    Adesso la scrive l'integrazione all'avvio, che e' l'unico momento che
    succede comunque, qualunque cosa si apra per prima.
    """
    allowed = _allowed_user_ids(entry)
    return {
        "title": entry.title or "DashboardModern",
        "path": "home",
        "type": "panel",
        # Niente filtro `visible` su questa vista, ed e' una scelta.
        #
        # E' l'UNICA vista della dashboard. Un filtro su una vista sola non puo'
        # fare la cosa per cui i filtri esistono — mostrare a questo utente meno
        # schede che a quell'altro — perche' sotto non resta niente. Puo' fare
        # solo due cose: niente, se chi guarda e' nell'elenco; oppure lasciare
        # la dashboard senza nemmeno una vista, e allora Home Assistant, quando
        # la si apre, risponde «Errore di configurazione».
        #
        # Chi la tiene come dashboard predefinita apre quella schermata rossa
        # ogni volta che apre l'app, e non ha modo di indovinare da dove venga:
        # la stessa plancia, aperta dalla barra laterale, funziona.
        #
        # Il permesso non si perde: sta dove funziona davvero. La dashboard
        # porta `require_admin`, e la card porta il suo `allowed_user_ids` —
        # che e' lo stesso elenco con cui il pannello decide chi entra, e che
        # sotto una vista vuota non ci finisce mai.
        "cards": [
            {
                "type": "custom:dashboardmodern-card",
                "entry_id": entry.entry_id,
                "title": entry.title or "DashboardModern",
                "primary": primary,
                # La card ospita la stessa plancia, quindi deve leggere e
                # scrivere lo stesso profilo di configurazione del pannello.
                "config_profile": config_profile,
                # Niente `static_base` qui dentro: contiene la firma degli asset
                # di adesso e diventa vecchia al primo aggiornamento. La card la
                # ricava dal proprio `import.meta.url`.
                "allowed_user_ids": allowed,
            }
        ],
    }


async def _aggiorna_scheda_compagna(
    collezione: Any, url_path: str, titolo: str, solo_admin: bool
) -> None:
    """Rimetti in pari nome, «solo amministratori» e il fuori dalla barra.

    Creare la dashboard di appoggio scriveva il titolo una volta sola. Chi poi
    rinominava la plancia — o la chiudeva agli amministratori — si ritrovava il
    nome vecchio nel menu delle dashboard di Home Assistant a ogni riavvio: le
    viste si riscrivevano, la scheda della collezione no. Il pannello, prima che
    questo lo sostituisse, l'aggiornava con `lovelace/dashboards/update`; qui si
    fa la stessa cosa dal di dentro.

    E il fuori dalla barra e' la terza cosa, che qui mancava.

    «Perche' nel mio ha ci sono 2 plance Dashboard modern v2?», con la
    schermata di una barra laterale che porta due volte «iPhone Dash», stesso
    nome e stessa icona. Sono il pannello e la dashboard di appoggio: portano
    il titolo della plancia tutt'e due — e devono, perche' l'appoggio si sceglie
    per nome nel selettore delle dashboard — e l'unica cosa che li teneva
    distinti era che l'appoggio sta fuori dalla barra.

    Quel «fuori» si scriveva alla nascita e mai piu'. Basta che una volta sola
    diventi «dentro» — un tocco su «Mostra nella barra laterale» nelle
    impostazioni delle dashboard, una versione di Lovelace che al momento della
    nascita non ha letto il campo, un'importazione da un backup — e resta dentro
    per sempre: nessuno lo rimetteva a posto, e chi guardava la barra vedeva due
    plance identiche di cui una sola funziona come plancia.

    Adesso si rimette a posto a ogni avvio, come il nome. Si scrive solo se
    qualcosa e' davvero cambiato: la collezione salva su disco a ogni
    aggiornamento, e un avvio non e' una modifica.
    """
    elenca = getattr(collezione, "async_items", None)
    aggiorna = getattr(collezione, "async_update_item", None)
    if elenca is None or aggiorna is None:
        return
    voce = next(
        (v for v in elenca() if isinstance(v, dict) and v.get("url_path") == url_path),
        None,
    )
    if voce is None:
        return
    cambi = {}
    if voce.get("title") != titolo:
        cambi["title"] = titolo
    if bool(voce.get("require_admin", False)) != solo_admin:
        cambi["require_admin"] = solo_admin
    if bool(voce.get("show_in_sidebar", True)):
        # Nella barra c'e' gia' il pannello: due voci con lo stesso nome e la
        # stessa icona sono due plance per chi guarda, e una delle due non e'
        # la plancia.
        cambi["show_in_sidebar"] = False
        _LOGGER.info(
            "La dashboard di appoggio %s era finita nella barra laterale "
            "accanto al pannello: la rimetto fuori",
            url_path,
        )
    if not cambi:
        return
    await aggiorna(voce["id"], cambi)


def _la_compagna_e_gia_registrata(collezione: Any, plance: Any, url_path: str) -> bool:
    """Se la scheda della dashboard di appoggio c'e' gia', ovunque risulti.

    La mappa `dashboards` da sola non basta: quella la riempie un ascoltatore
    della collezione, e all'avvio puo' essere ancora vuota mentre la scheda sul
    disco c'e' da un pezzo — e' la stessa corsa che `_magazzino_della_compagna`
    aspetta piu' sotto. Chi guarda solo li' crede che manchi e la crea daccapo,
    e la guardia di Lovelace contro i doppioni guarda quella stessa mappa,
    quindi nemmeno lei se ne accorge: sul disco restano due schede con lo stesso
    indirizzo, e nel menu delle dashboard due voci con lo stesso nome — proprio
    quelle che poi non si sa quale scegliere come predefinita.

    La collezione le sue schede le sa sempre, anche prima che l'ascoltatore
    abbia girato. Si guardano tutt'e due: basta una a dire che c'e'.
    """
    if url_path in plance:
        return True
    elenca = getattr(collezione, "async_items", None)
    if elenca is None:
        return False
    return any(
        isinstance(voce, dict) and voce.get("url_path") == url_path for voce in elenca()
    )


async def _magazzino_della_compagna(plance: Any, url_path: str) -> Any:
    """Il magazzino della dashboard appena creata, dandogli il tempo di nascere.

    Chi crea una dashboard nella collezione di Lovelace non riceve indietro il
    suo magazzino: lo costruisce un ascoltatore della collezione, e la mappa
    `dashboards` si popola quando quell'ascoltatore ha girato. Su una macchina
    carica — o su una versione di Home Assistant che lo fa in coda invece che
    subito — chiedere il magazzino nella riga dopo la creazione lo trova vuoto.

    E li' finiva: si tornava indietro senza scrivere niente, lasciando una
    dashboard REGISTRATA E VUOTA. Home Assistant, aprendola, risponde «Errore
    di configurazione» — e la risposta resta uguale a ogni riavvio, perche' al
    giro dopo la dashboard c'e' gia' e si prende la stessa strada.

    Qui le si lascia il tempo di comparire: un paio di giri del ciclo di
    eventi, che e' quello che serve a un ascoltatore messo in coda.
    """
    import asyncio

    for attesa in (0, 0, 0.05):
        magazzino = plance.get(url_path)
        if magazzino is not None and hasattr(magazzino, "async_save"):
            return magazzino
        await asyncio.sleep(attesa)
    return None


async def _la_compagna_e_piena(magazzino: Any) -> bool:
    """Se quello che si e' appena scritto si rilegge davvero.

    Scrivere e non ricontrollare vuol dire scoprire dall'utente che non era
    stato scritto. Qui si rilegge: se manca la configurazione, o non ha viste,
    chi apre quella dashboard vedra' «Errore di configurazione», e conviene che
    stia scritto nel registro adesso invece che in una segnalazione domani.
    """
    leggi = getattr(magazzino, "async_load", None)
    if leggi is None:
        # Una Lovelace che non sa rileggere non e' una prova che sia vuota.
        return True
    try:
        letta = await leggi(False)
    except Exception:  # noqa: BLE001 - il perche' lo dice chi chiama
        return False
    viste = letta.get("views") if isinstance(letta, dict) else None
    return bool(viste)


async def _nasce_la_compagna(
    collezione: Any, plance: Any, url_path: str, titolo: str, solo_admin: bool
) -> bool:
    """Scrivi la scheda della dashboard di appoggio. `False` se non ce l'ha fatta.

    Lovelace rifiuta una creazione per due motivi che qui non sono guasti ma
    corse: l'indirizzo e' gia' quello di un pannello registrato, oppure la
    scheda c'e' gia'. In tutti e due i casi la dashboard ESISTE — che e'
    esattamente quello che si voleva — e la strada giusta e' rimetterla in pari
    e riempirla, non arrendersi.

    Arrendersi voleva dire, per chi ci capitava, «il flag c'e' ma tra le plance
    non la vedo»: la dashboard non compariva nel menu delle plance, e non ci
    compariva mai piu', perche' al riavvio si ripercorreva la stessa strada e
    si prendeva lo stesso rifiuto.

    Se invece dopo il rifiuto la scheda continua a non esserci, il rifiuto e'
    un guasto vero: si scrive nel registro cosa non funzionera', perche' chi
    apre il menu delle dashboard non ha modo di indovinarlo.
    """
    try:
        await collezione.async_create_item(
            {
                "allow_single_word": True,
                "icon": "mdi:view-dashboard-edit",
                "title": titolo,
                "url_path": url_path,
                "show_in_sidebar": False,
                "require_admin": solo_admin,
            }
        )
    except Exception:  # noqa: BLE001 - il perche' lo dicono le due strade qui sotto
        if not _la_compagna_e_gia_registrata(collezione, plance, url_path):
            _LOGGER.error(
                "Lovelace ha rifiutato la dashboard di appoggio %s: la plancia "
                "non comparira' fra le dashboard e non si potra' scegliere come "
                "predefinita",
                url_path,
                exc_info=True,
            )
            return False
        _LOGGER.info(
            "La dashboard di appoggio %s c'era gia' quando ho provato a "
            "crearla: la rimetto in pari e la riempio",
            url_path,
        )
        await _aggiorna_scheda_compagna(collezione, url_path, titolo, solo_admin)
    return True


async def _ensure_companion_dashboard(hass: HomeAssistant, entry_id: str) -> bool:
    """Crea e riempie la dashboard di appoggio di questa plancia.

    E' quella che permette di scegliere la plancia come dashboard predefinita:
    Home Assistant lascia scegliere una dashboard Lovelace, non un pannello
    personalizzato. Sta fuori dalla barra laterale — nella barra c'e' gia' il
    pannello — e porta dentro una card sola.

    Se Lovelace non e' ancora in piedi non si insiste: si riprova quando lo e'.
    """
    from .config_flow import OPTION_ADMIN_ONLY, OPTION_REGISTER_LOVELACE

    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None:
        return False
    if not entry.options.get(OPTION_REGISTER_LOVELACE, True):
        return False

    dati = hass.data.get("lovelace")
    collezione = getattr(dati, "dashboards_collection", None)
    plance = getattr(dati, "dashboards", None)
    if collezione is None and isinstance(dati, dict):
        collezione = dati.get("dashboards_collection")
        plance = dati.get("dashboards")
    if collezione is None or plance is None:
        return False

    url_path = _lovelace_url_path(entry)
    titolo = entry.title or "DashboardModern"
    solo_admin = bool(entry.options.get(OPTION_ADMIN_ONLY, False))
    try:
        if _la_compagna_e_gia_registrata(collezione, plance, url_path):
            await _aggiorna_scheda_compagna(collezione, url_path, titolo, solo_admin)
        elif not await _nasce_la_compagna(
            collezione, plance, url_path, titolo, solo_admin
        ):
            return False
        magazzino = await _magazzino_della_compagna(plance, url_path)
        if magazzino is None:
            # Una dashboard che c'e' ma non si riesce a riempire e' peggio di
            # una che non c'e': Home Assistant la apre e risponde «Errore di
            # configurazione». Lo si dice forte, invece di lasciarla muta.
            _LOGGER.error(
                "La dashboard di appoggio %s esiste ma Lovelace non ne espone "
                "il magazzino: resterebbe vuota, e chi la mette come "
                "predefinita vedrebbe «Errore di configurazione»",
                url_path,
            )
            return False
        vista = _companion_view(
            entry, _config_profile(hass, entry), _entry_is_primary(hass, entry)
        )
        await magazzino.async_save({"views": [vista]})
        if not await _la_compagna_e_piena(magazzino):
            _LOGGER.error(
                "La dashboard di appoggio %s risulta vuota subito dopo averla "
                "scritta: chi la apre vedrebbe «Errore di configurazione»",
                url_path,
            )
            return False
    except Exception:  # noqa: BLE001 - una dashboard in meno non ferma la plancia
        _LOGGER.warning(
            "Non sono riuscito a preparare la dashboard di appoggio %s",
            url_path,
            exc_info=True,
        )
        return False
    return True


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

    # La dashboard di appoggio si prepara quando Lovelace ha finito di alzarsi,
    # sempre — non solo quando il primo tentativo e' andato male.
    #
    # Lovelace, mentre parte, mette in `hass.data` la collezione delle dashboard
    # PRIMA di leggere dal disco le schede che ci sono. Chi guarda in quel
    # momento — e un'integrazione che parte insieme a lui ci guarda davvero —
    # trova una collezione vuota, crede che la dashboard di appoggio non ci sia
    # e la crea: sullo stesso indirizzo dove c'e' gia', e l'esito dipende da chi
    # arriva primo. Il tentativo subito non serviva a niente che l'attesa non
    # faccia meglio: `async_when_setup` chiama indietro appena Lovelace ha
    # finito, e subito se aveva gia' finito.
    from homeassistant.setup import async_when_setup

    async def _quando_lovelace(hass: HomeAssistant, _componente: str) -> None:
        await _ensure_companion_dashboard(hass, entry_id)

    async_when_setup(hass, "lovelace", _quando_lovelace)


async def async_unregister_frontend_entry(hass: HomeAssistant, entry_id: str) -> None:
    """Remove this plancia's panel after its entry unloads."""
    domain_data: dict[str, Any] | None = hass.data.get(DOMAIN)
    if domain_data is None:
        return
    paths: dict[str, str] = domain_data.get(DATA_PANEL_PATHS, {})
    path = paths.pop(entry_id, None)
    if path:
        _remove_panel(hass, path)
