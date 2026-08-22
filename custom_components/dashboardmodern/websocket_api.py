"""WebSocket commands for the shared plancia configuration.

These replace ``frontend/get_user_data`` / ``frontend/set_user_data`` as the
transport of the dashboard configuration. The user_data API stores one copy per
Home Assistant user, which is exactly why a second user or a fresh device saw an
unconfigured plancia; these commands read and write the single shared store, so
every user and every device of one installation see the same configuration.

Chi puo' chiamarli e' la stessa domanda di chi puo' aprire una plancia, e la
risposta va data qui.

Prima erano aperti a qualsiasi utente autenticato, e la motivazione scritta era
che «il pannello decide gia' chi puo' aprire una plancia con la sua
allow-list». Ma quella lista viaggia dentro la configurazione del pannello e la
applica il browser: e' un controllo lato client, cioe' un controllo che chi
vuole aggirarlo non incontra nemmeno. Un utente fuori dalla lista non vede la
plancia nella barra laterale e non riesce ad aprirla, e intanto puo' chiamare
questi comandi direttamente e riscrivere la configurazione di tutti — che e'
una sola per l'installazione, non una per utente.

In una casa con un solo utente non cambia niente. In una casa con piu' utenti —
un figlio, un coinquilino, un ospite — e' la differenza fra una preferenza e un
permesso.

La regola adesso e' una sola, e sta dove conta: **chi chiama deve poter usare
quella plancia**. Amministratore se la plancia e' riservata agli
amministratori, dentro la lista se una lista c'e'. La lettura resta aperta a
chi la plancia la puo' usare, perche' senza leggere non la si puo' nemmeno
disegnare; scrittura, ripristino ed elenco dei file chiedono lo stesso
permesso, non uno piu' debole.

E c'e' una seconda regola, altrettanto importante: **il profilo non lo sceglie
il client**. Il permesso e' legato all'``entry_id``, ma il ``profile`` arrivava
a parte, come stringa libera. Un utente autorizzato per la sua plancia poteva
percio' passare il proprio ``entry_id`` — che il controllo accetta — e nominare
il profilo di un'altra plancia, leggendolo, riscrivendolo o ripristinandolo. E
poteva inventare profili qualunque, facendo crescere lo storage condiviso senza
limite.

Adesso il profilo si deriva dal server a partire dall'``entry_id`` (la stessa
derivazione che il pannello inietta, quindi per un client legittimo non cambia
niente) e il ``profile`` del client non e' piu' fidato: chi chiama puo'
raggiungere soltanto la plancia principale o una plancia il cui ``entry_id`` gli
e' consentito. Solo un amministratore, e solo quando non indica un ``entry_id``,
puo' ancora nominare un profilo esplicito, perche' e' lui a gestirli. L'elenco
completo dei profili resta visibile ai soli amministratori, e il numero
complessivo dei profili e' limitato.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import callback

from .config_flow import OPTION_ADMIN_ONLY, OPTION_ALLOWED_USERS
from .config_store import (
    PRIMARY_PROFILE,
    ProfileLimitError,
    SnapshotTooLargeError,
    async_get_config_store,
    profile_for_entry,
)
from .const import DOMAIN
from .www_files import list_www_folder

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

DATA_WEBSOCKET_REGISTERED = "websocket_registered"

TYPE_GET = f"{DOMAIN}/config/get"
TYPE_SET = f"{DOMAIN}/config/set"
TYPE_RESTORE = f"{DOMAIN}/config/restore"
TYPE_WWW_LIST = f"{DOMAIN}/www/list"

_PROFILE = vol.All(str, vol.Length(min=1, max=64))
_ENTRY_ID = vol.All(str, vol.Length(min=1, max=64))


def _entries(hass: HomeAssistant) -> list[Any]:
    """Le plance installate."""
    return list(hass.config_entries.async_entries(DOMAIN))


def _allowed_users(entry: Any) -> set[str]:
    value = entry.options.get(OPTION_ALLOWED_USERS, [])
    if not isinstance(value, list):
        return set()
    return {str(user_id) for user_id in value if user_id}


def _is_admin(connection: Any) -> bool:
    user = getattr(connection, "user", None)
    return bool(user is not None and getattr(user, "is_admin", False))


def _may_use(entry: Any, user: Any) -> bool:
    """Se questo utente puo' usare questa plancia.

    E' la stessa domanda che il pannello si fa per mostrarla: amministratore se
    la plancia e' riservata agli amministratori, dentro la lista se una lista
    c'e'. Detta qui, pero', vale davvero.
    """
    if user is not None and getattr(user, "is_admin", False):
        return True
    if entry.options.get(OPTION_ADMIN_ONLY, False):
        return False
    consentiti = _allowed_users(entry)
    if not consentiti:
        return True
    return str(getattr(user, "id", "")) in consentiti


def _entry_is_primary(hass: HomeAssistant, entry: Any, entries: list[Any]) -> bool:
    """Se questa e' la plancia principale.

    Stessa regola di ``frontend._entry_is_primary``, cosi' il profilo derivato
    qui coincide con quello che il pannello inietta e per un client legittimo
    non cambia nulla.
    """
    if entry.data.get("primary"):
        return True
    if any(e.data.get("primary") for e in entries):
        return False
    return bool(entries) and entries[0].entry_id == entry.entry_id


def _profile_for(hass: HomeAssistant, entry: Any, entries: list[Any]) -> str:
    """Il profilo condiviso di questa plancia, derivato dal server."""
    return profile_for_entry(
        primary=_entry_is_primary(hass, entry, entries),
        title=entry.title or "",
        entry_id=entry.entry_id,
    )


def _resolve_profile(
    hass: HomeAssistant,
    connection: Any,
    entry_id: str | None,
    requested_profile: str,
) -> str | None:
    """Il profilo su cui questo utente puo' agire, o ``None`` per negare.

    Il profilo si deriva dall'``entry_id`` lato server: il ``requested_profile``
    del client non e' fidato e serve solo a un amministratore che gestisce i
    profili senza indicare una plancia. Cosi' chi chiama puo' raggiungere
    soltanto la plancia principale o una plancia il cui ``entry_id`` gli e'
    consentito, e non puo' inventare profili arbitrari.
    """
    user = getattr(connection, "user", None)
    entries = _entries(hass)
    if entry_id:
        scelta = next((e for e in entries if e.entry_id == entry_id), None)
        if scelta is None or not _may_use(scelta, user):
            return None
        return _profile_for(hass, scelta, entries)
    # Senza `entry_id`. Un amministratore puo' nominare un profilo esplicito
    # (gestione, enumerazione); chiunque altro raggiunge solo la principale.
    if not entries:
        # Nessuna plancia installata: negozio condiviso senza pannelli, niente
        # da proteggere. Un profilo arbitrario resta pero' riservato agli admin.
        return requested_profile if _is_admin(connection) else PRIMARY_PROFILE
    if not any(_may_use(e, user) for e in entries):
        return None
    return requested_profile if _is_admin(connection) else PRIMARY_PROFILE


def _visible_profiles(connection: Any, result: dict[str, Any]) -> dict[str, Any]:
    """Nascondi l'elenco completo dei profili a chi non e' amministratore.

    Sapere quali altre plance esistono e' informazione che un utente normale
    non deve ricavare da questi comandi; vede solo il proprio profilo.
    """
    if _is_admin(connection):
        return result
    proprio = result.get("profile")
    listed = result.get("profiles") or []
    return {**result, "profiles": [p for p in listed if p == proprio]}


def _deny(connection: Any, msg: dict[str, Any]) -> None:
    connection.send_error(
        msg["id"],
        websocket_api.const.ERR_UNAUTHORIZED,
        "Questa plancia non e' abilitata per il tuo utente.",
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_GET,
        vol.Optional("profile", default=PRIMARY_PROFILE): _PROFILE,
        vol.Optional("entry_id"): _ENTRY_ID,
    }
)
@websocket_api.async_response
async def async_get_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the shared snapshot of one plancia."""
    profile = _resolve_profile(hass, connection, msg.get("entry_id"), msg["profile"])
    if profile is None:
        _deny(connection, msg)
        return
    store = await async_get_config_store(hass)
    result = await store.async_get(profile, entry_id=msg.get("entry_id"))
    connection.send_result(msg["id"], _visible_profiles(connection, result))


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_SET,
        vol.Optional("profile", default=PRIMARY_PROFILE): _PROFILE,
        vol.Optional("entry_id"): _ENTRY_ID,
        vol.Required("snapshot"): vol.Schema(
            {
                vol.Required("values"): {str: str},
                vol.Optional("keys_revision", default=0): vol.Coerce(int),
                vol.Optional("updated_at", default=0): vol.Coerce(int),
            },
            extra=vol.REMOVE_EXTRA,
        ),
        vol.Optional("expected_revision"): vol.Any(None, vol.Coerce(int)),
        vol.Optional("reset", default=False): bool,
    }
)
@websocket_api.async_response
async def async_set_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Store a snapshot for one plancia."""
    profile = _resolve_profile(hass, connection, msg.get("entry_id"), msg["profile"])
    if profile is None:
        _deny(connection, msg)
        return
    store = await async_get_config_store(hass)
    snapshot = msg["snapshot"]
    try:
        result = await store.async_set(
            profile,
            snapshot["values"],
            entry_id=msg.get("entry_id"),
            keys_revision=snapshot["keys_revision"],
            updated_at=snapshot["updated_at"],
            expected_revision=msg.get("expected_revision"),
            reset=msg["reset"],
        )
    except SnapshotTooLargeError as error:
        connection.send_error(msg["id"], "snapshot_too_large", str(error))
        return
    except ProfileLimitError as error:
        connection.send_error(msg["id"], "too_many_profiles", str(error))
        return
    connection.send_result(msg["id"], _visible_profiles(connection, result))


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_RESTORE,
        vol.Optional("profile", default=PRIMARY_PROFILE): _PROFILE,
        vol.Optional("entry_id"): _ENTRY_ID,
        vol.Required("revision"): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def async_restore_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Promote a kept revision of one plancia back to current."""
    profile = _resolve_profile(hass, connection, msg.get("entry_id"), msg["profile"])
    if profile is None:
        _deny(connection, msg)
        return
    store = await async_get_config_store(hass)
    result = await store.async_restore(
        profile, msg["revision"], entry_id=msg.get("entry_id")
    )
    connection.send_result(msg["id"], _visible_profiles(connection, result))


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_WWW_LIST,
        vol.Optional("path", default=""): vol.All(str, vol.Length(max=512)),
    }
)
@websocket_api.async_response
async def async_list_www(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Elenca una cartella di ``config/www`` per il selettore delle foto."""
    if _resolve_profile(hass, connection, None, PRIMARY_PROFILE) is None:
        _deny(connection, msg)
        return
    result = await hass.async_add_executor_job(
        list_www_folder, hass.config.path("www"), msg["path"]
    )
    if result is None:
        connection.send_error(
            msg["id"], "not_found", "La cartella non esiste dentro config/www"
        )
        return
    connection.send_result(msg["id"], result)


@callback
def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register the shared configuration commands once per installation."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_WEBSOCKET_REGISTERED):
        return
    for command in (
        async_get_config,
        async_set_config,
        async_restore_config,
        async_list_www,
    ):
        websocket_api.async_register_command(hass, command)
    domain_data[DATA_WEBSOCKET_REGISTERED] = True
