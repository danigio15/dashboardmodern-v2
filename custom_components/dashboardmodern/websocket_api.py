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
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import callback

from .config_flow import OPTION_ADMIN_ONLY, OPTION_ALLOWED_USERS
from .config_store import (
    PRIMARY_PROFILE,
    SnapshotTooLargeError,
    async_get_config_store,
)
from .const import DOMAIN
from .www_files import MAX_UPLOAD_BYTES, list_www_folder, save_www_upload

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

DATA_WEBSOCKET_REGISTERED = "websocket_registered"

TYPE_GET = f"{DOMAIN}/config/get"
TYPE_SET = f"{DOMAIN}/config/set"
TYPE_RESTORE = f"{DOMAIN}/config/restore"
TYPE_WWW_LIST = f"{DOMAIN}/www/list"
TYPE_WWW_UPLOAD = f"{DOMAIN}/www/upload"

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


def _authorized(hass: HomeAssistant, connection: Any, entry_id: str | None) -> bool:
    """Se chi chiama puo' usare la plancia a cui si riferisce.

    Senza `entry_id` — e' il caso normale, la plancia principale — basta poterne
    usare almeno una: chi non puo' usarne nessuna non ha niente da fare qui.
    """
    user = getattr(connection, "user", None)
    if user is not None and getattr(user, "is_admin", False):
        return True
    entries = _entries(hass)
    # Nessuna plancia installata, nessuna regola da applicare: qui non c'e'
    # niente da proteggere, e rifiutare vorrebbe dire rompere il negozio
    # condiviso per chi lo usa senza pannelli.
    if not entries:
        return True
    if entry_id:
        scelta = next((entry for entry in entries if entry.entry_id == entry_id), None)
        return bool(scelta and _may_use(scelta, user))
    return any(_may_use(entry, user) for entry in entries)


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
    if not _authorized(hass, connection, msg.get("entry_id")):
        _deny(connection, msg)
        return
    store = await async_get_config_store(hass)
    result = await store.async_get(msg["profile"], entry_id=msg.get("entry_id"))
    connection.send_result(msg["id"], result)


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
    if not _authorized(hass, connection, msg.get("entry_id")):
        _deny(connection, msg)
        return
    store = await async_get_config_store(hass)
    snapshot = msg["snapshot"]
    try:
        result = await store.async_set(
            msg["profile"],
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
    connection.send_result(msg["id"], result)


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
    if not _authorized(hass, connection, msg.get("entry_id")):
        _deny(connection, msg)
        return
    store = await async_get_config_store(hass)
    result = await store.async_restore(
        msg["profile"], msg["revision"], entry_id=msg.get("entry_id")
    )
    connection.send_result(msg["id"], result)


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
    if not _authorized(hass, connection, None):
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


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_WWW_UPLOAD,
        vol.Required("filename"): vol.All(str, vol.Length(min=1, max=255)),
        # Base64 della foto: il tetto tiene conto del +33% della codifica.
        vol.Required("data"): vol.All(str, vol.Length(min=1, max=MAX_UPLOAD_BYTES * 2)),
    }
)
@websocket_api.async_response
async def async_upload_www(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Salva una foto in ``config/www`` per il selettore.

    La plancia servita dall'integrazione non possiede nessun token — il suo
    WebSocket si autentica qui, lato server — e ogni chiamata REST del browser
    rispondeva 401. La foto viaggia percio' su questo stesso canale, e chi puo'
    scrivere e' chi puo' gia' scrivere la configurazione.
    """
    if not _authorized(hass, connection, None):
        _deny(connection, msg)
        return
    import base64

    try:
        payload = base64.b64decode(msg["data"], validate=True)
    except (ValueError, TypeError):
        connection.send_error(msg["id"], "invalid_data", "La foto non e' leggibile.")
        return
    result = await hass.async_add_executor_job(
        save_www_upload, hass.config.path("www"), msg["filename"], payload
    )
    if result is None:
        connection.send_error(
            msg["id"],
            "invalid_upload",
            "Il file non e' un'immagine, o e' piu' grande di 10 MB.",
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
        async_upload_www,
    ):
        websocket_api.async_register_command(hass, command)
    domain_data[DATA_WEBSOCKET_REGISTERED] = True
