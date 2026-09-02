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
from .github_client import DevicePending, GitHubError
from .github_tokens import async_get_token_store
from .ticket_store import (
    MAX_BODY,
    MAX_REPLY,
    MAX_TITLE,
    TICKET_TYPES,
    TicketRejected,
    async_get_ticket_store,
)
from .tickets import (
    async_answer,
    async_begin_auth,
    async_deliver_pending,
    async_finish_auth,
    async_forget_auth,
    async_queue,
    async_reply,
    async_sync_states,
    async_take,
    async_thread,
)
from .tickets import (
    enabled as tickets_enabled,
)
from .www_files import MAX_UPLOAD_BYTES, list_www_folder, save_www_upload

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

DATA_WEBSOCKET_REGISTERED = "websocket_registered"

TYPE_GET = f"{DOMAIN}/config/get"
TYPE_SET = f"{DOMAIN}/config/set"
TYPE_RESTORE = f"{DOMAIN}/config/restore"
TYPE_WWW_LIST = f"{DOMAIN}/www/list"
TYPE_WWW_UPLOAD = f"{DOMAIN}/www/upload"
TYPE_TICKET_LIST = f"{DOMAIN}/tickets/list"
TYPE_TICKET_CREATE = f"{DOMAIN}/tickets/create"
TYPE_TICKET_DELETE = f"{DOMAIN}/tickets/delete"
TYPE_TICKET_SYNC = f"{DOMAIN}/tickets/sync"
TYPE_TICKET_QUEUE = f"{DOMAIN}/tickets/queue"
TYPE_TICKET_ANSWER = f"{DOMAIN}/tickets/answer"
TYPE_TICKET_THREAD = f"{DOMAIN}/tickets/thread"
TYPE_TICKET_REPLY = f"{DOMAIN}/tickets/reply"
TYPE_TICKET_TAKE = f"{DOMAIN}/tickets/take"
TYPE_TICKET_AUTH_START = f"{DOMAIN}/tickets/auth/start"
TYPE_TICKET_AUTH_POLL = f"{DOMAIN}/tickets/auth/poll"
TYPE_TICKET_AUTH_FORGET = f"{DOMAIN}/tickets/auth/forget"

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
                # La generazione dello scrittore: i runtime vecchi non la
                # mandano, e il frontend nuovo usa l'assenza per riconoscere
                # i loro scatti. Il negozio la conserva e basta.
                vol.Optional("writer_generation", default=0): vol.Coerce(int),
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
            writer_generation=snapshot["writer_generation"],
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


# ─── Segnalazioni ────────────────────────────────────────────────────────────
#
# Chi puo' aprire una segnalazione e' chi puo' usare la plancia: la stessa
# domanda, e la stessa risposta, del resto del file. La coda del manutentore
# invece no — quella chiede due cose insieme, ed e' scritto sotto.

_TICKET_ID = vol.All(str, vol.Length(min=1, max=64))
_REMOTE_ID = vol.All(str, vol.Length(min=1, max=128))


def _caller_id(connection: Any) -> str:
    """L'utente di Home Assistant che sta chiamando, o stringa vuota."""
    return str(getattr(getattr(connection, "user", None), "id", "") or "")


def _is_admin(connection: Any) -> bool:
    return bool(getattr(getattr(connection, "user", None), "is_admin", False))


async def _console_denied(
    hass: HomeAssistant, connection: Any, msg: dict[str, Any]
) -> bool:
    """La console chiede due cose insieme, e servono entrambe.

    Amministratore di questo Home Assistant, **e** un account GitHub che sulla
    repository della plancia puo' scrivere. La prima da sola non basta:
    l'amministratore di casa propria non e' chi tiene la coda di tutti.

    La seconda non e' una chiave da incollare da qualche parte: e' GitHub a
    dirla, quando chi ha autorizzato viene riconosciuto come chi tiene la
    repository. Cosi' la console si accende da sola sulla plancia giusta, e il
    giorno in cui la repository cambia mano non resta nessuna chiave scritta a
    dare un permesso che non c'e' piu'.
    """
    if not _is_admin(connection):
        connection.send_error(
            msg["id"],
            websocket_api.const.ERR_UNAUTHORIZED,
            "La console delle segnalazioni e' riservata agli amministratori.",
        )
        return True
    gettoni = await async_get_token_store(hass)
    if not gettoni.is_maintainer(_caller_id(connection)):
        connection.send_error(
            msg["id"], "not_console", "Questa installazione non e' la console."
        )
        return True
    return False


@websocket_api.websocket_command({vol.Required("type"): TYPE_TICKET_LIST})
@websocket_api.async_response
async def async_list_tickets(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Le segnalazioni di chi chiama — tutte, se chi chiama amministra."""
    if not _authorized(hass, connection, None):
        _deny(connection, msg)
        return
    store = await async_get_ticket_store(hass)
    gettoni = await async_get_token_store(hass)
    chi = _caller_id(connection)
    account = gettoni.describe(chi)
    connection.send_result(
        msg["id"],
        {
            "tickets": store.list(opened_by=chi, every=_is_admin(connection)),
            # Le tre cose che decidono cosa la finestra puo' offrire: se questa
            # plancia parla con GitHub, se chi guarda ha collegato il proprio
            # account, e se quell'account tiene la repository.
            "delivery": tickets_enabled(hass),
            "account": account,
            "console": bool(_is_admin(connection) and account["maintainer"]),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_TICKET_CREATE,
        vol.Required("ticket_type"): vol.In(sorted(TICKET_TYPES)),
        vol.Required("title"): vol.All(str, vol.Length(min=1, max=MAX_TITLE * 2)),
        vol.Required("body"): vol.All(str, vol.Length(min=1, max=MAX_BODY * 2)),
        vol.Optional("diagnostics", default=dict): {
            str: vol.Any(str, int, float, bool)
        },
    }
)
@websocket_api.async_response
async def async_create_ticket(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Scrivi una segnalazione, e prova subito a consegnarla.

    Subito, non al prossimo giro: chi ha appena premuto invia sta guardando, e
    mezz'ora di attesa per sapere se e' partita non e' un'attesa, e' un dubbio.
    Se la consegna non riesce il ticket resta scritto e riparte da solo.
    """
    if not _authorized(hass, connection, None):
        _deny(connection, msg)
        return
    store = await async_get_ticket_store(hass)
    try:
        ticket = await store.async_create(
            ticket_type=msg["ticket_type"],
            title=msg["title"],
            body=msg["body"],
            diagnostics=msg["diagnostics"],
            opened_by=_caller_id(connection),
        )
    except TicketRejected as rifiuto:
        connection.send_error(msg["id"], rifiuto.code, str(rifiuto))
        return
    delivered = 0
    if tickets_enabled(hass):
        # Solo le proprie: la issue nasce a nome di chi ha scritto, e questo
        # comando non e' il momento per spedire le bozze di un altro.
        delivered = await async_deliver_pending(hass, user_id=_caller_id(connection))
    aggiornato = next(
        (voce for voce in store.list(every=True) if voce["id"] == ticket["id"]),
        ticket,
    )
    connection.send_result(
        msg["id"], {"ticket": aggiornato, "delivered": bool(delivered)}
    )


@websocket_api.websocket_command(
    {vol.Required("type"): TYPE_TICKET_DELETE, vol.Required("ticket_id"): _TICKET_ID}
)
@websocket_api.async_response
async def async_delete_ticket(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Butta via una delle proprie segnalazioni."""
    if not _authorized(hass, connection, None):
        _deny(connection, msg)
        return
    store = await async_get_ticket_store(hass)
    removed = await store.async_delete(
        msg["ticket_id"], opened_by=_caller_id(connection), every=_is_admin(connection)
    )
    if not removed:
        connection.send_error(msg["id"], "not_found", "Questa segnalazione non c'e'.")
        return
    connection.send_result(msg["id"], {"removed": True})


@websocket_api.websocket_command({vol.Required("type"): TYPE_TICKET_SYNC})
@websocket_api.async_response
async def async_sync_tickets(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Riprova le consegne rimaste indietro e porta a casa le risposte."""
    if not _authorized(hass, connection, None):
        _deny(connection, msg)
        return
    chi = _caller_id(connection)
    delivered = await async_deliver_pending(hass, user_id=chi)
    changed = await async_sync_states(hass)
    store = await async_get_ticket_store(hass)
    gettoni = await async_get_token_store(hass)
    connection.send_result(
        msg["id"],
        {
            "tickets": store.list(opened_by=chi, every=_is_admin(connection)),
            "delivered": delivered,
            "changed": changed,
            "delivery": tickets_enabled(hass),
            "account": gettoni.describe(chi),
        },
    )


@websocket_api.websocket_command({vol.Required("type"): TYPE_TICKET_QUEUE})
@websocket_api.async_response
async def async_ticket_queue(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """La coda del manutentore: le segnalazioni nate dalle plance."""
    if await _console_denied(hass, connection, msg):
        return
    try:
        coda = await async_queue(hass, _caller_id(connection))
    except GitHubError as errore:
        connection.send_error(msg["id"], errore.code, str(errore))
        return
    connection.send_result(msg["id"], {"tickets": coda})


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_TICKET_ANSWER,
        vol.Required("number"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("reply", default=""): vol.All(str, vol.Length(max=MAX_REPLY * 2)),
        vol.Optional("close", default=""): vol.In(["", "risolto", "chiuso"]),
    }
)
@websocket_api.async_response
async def async_answer_ticket_command(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Rispondi sotto una segnalazione, e se serve chiudila.

    La risposta e' un commento su GitHub: la ritrova chi ha segnalato, dentro
    la sua plancia, e la legge chiunque passi dalla issue. Un posto solo.
    """
    if await _console_denied(hass, connection, msg):
        return
    try:
        fatto = await async_answer(
            hass,
            user_id=_caller_id(connection),
            number=msg["number"],
            reply=msg["reply"],
            close=msg["close"],
        )
    except GitHubError as errore:
        connection.send_error(msg["id"], errore.code, str(errore))
        return
    connection.send_result(msg["id"], fatto)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_TICKET_THREAD,
        vol.Required("number"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    }
)
@websocket_api.async_response
async def async_ticket_thread(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Il filo di una segnalazione: testo, commenti e allegati.

    Serve a non dover uscire dalla plancia per capire cosa e' successo: la foto
    che chi segnala ha allegato vive in un commento, e senza leggere i commenti
    una segnalazione con dentro tutto sembrerebbe nuda.

    Non e' riservato alla console. Lo apre anche chi ha segnalato, sulla sua,
    per leggere la risposta restando qui: mandarlo su github.com per leggerla
    sarebbe farlo uscire proprio dal posto che questa finestra esiste per non
    fargli lasciare. Non c'e' niente da proteggere — la issue e' una pagina
    pubblica, e chiunque puo' aprirla in un browser.
    """
    try:
        filo = await async_thread(hass, _caller_id(connection), msg["number"])
    except GitHubError as errore:
        connection.send_error(msg["id"], errore.code, str(errore))
        return
    connection.send_result(msg["id"], filo)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_TICKET_REPLY,
        vol.Required("number"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Required("message"): vol.All(str, vol.Length(max=MAX_REPLY * 2)),
    }
)
@websocket_api.async_response
async def async_reply_ticket_command(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Scrivi sotto una segnalazione tua, restando nella plancia.

    Non passa dalla console. Chi risponde qui e' chi ha segnalato, e scrive
    sotto la sua: fino a ieri per aggiungere una riga doveva aprire github.com,
    che e' esattamente il posto che questa finestra esiste per non fargli
    aprire. Di chi sia la segnalazione lo verifica `async_reply`, che ha in
    mano il deposito; qui si controlla solo che chi chiama la plancia la possa
    usare.
    """
    if not _authorized(hass, connection, None):
        _deny(connection, msg)
        return
    try:
        fatto = await async_reply(
            hass,
            user_id=_caller_id(connection),
            number=msg["number"],
            message=msg["message"],
        )
    except GitHubError as errore:
        connection.send_error(msg["id"], errore.code, str(errore))
        return
    connection.send_result(msg["id"], fatto)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_TICKET_TAKE,
        vol.Required("number"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("take", default=True): bool,
    }
)
@websocket_api.async_response
async def async_take_ticket_command(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Prendi in carico una segnalazione, o lasciala."""
    if await _console_denied(hass, connection, msg):
        return
    try:
        fatto = await async_take(
            hass,
            user_id=_caller_id(connection),
            number=msg["number"],
            take=msg["take"],
        )
    except GitHubError as errore:
        connection.send_error(msg["id"], errore.code, str(errore))
        return
    connection.send_result(msg["id"], fatto)


# ─── Collegare il proprio account GitHub ─────────────────────────────────────
#
# Lo stesso giro che HACS fa gia' fare a chiunque installi la plancia: un
# codice da digitare su github.com/login/device. Chi e' arrivato fin qui l'ha
# gia' fatto una volta, e lo riconosce.
#
# Il gettone non compare in nessuna di queste risposte. Torna indietro chi ha
# autorizzato e se e' lui a tenere la repository: quello serve a disegnare la
# finestra, il gettone no.


@websocket_api.websocket_command({vol.Required("type"): TYPE_TICKET_AUTH_START})
@websocket_api.async_response
async def async_ticket_auth_start(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Chiedi a GitHub il codice da mostrare."""
    if not _authorized(hass, connection, None):
        _deny(connection, msg)
        return
    try:
        avvio = await async_begin_auth(hass)
    except GitHubError as errore:
        connection.send_error(msg["id"], errore.code, str(errore))
        return
    connection.send_result(msg["id"], avvio)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_TICKET_AUTH_POLL,
        vol.Required("device_code"): vol.All(str, vol.Length(min=1, max=256)),
    }
)
@websocket_api.async_response
async def async_ticket_auth_poll(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Vedi se l'utente ha finito di autorizzare.

    ``pending`` non e' un guasto ed e' la risposta normale delle prime volte:
    torna col suo codice e con l'attesa che GitHub stesso ha chiesto, cosi' la
    finestra non insiste piu' in fretta di quanto le sia concesso.
    """
    if not _authorized(hass, connection, None):
        _deny(connection, msg)
        return
    try:
        account = await async_finish_auth(
            hass, user_id=_caller_id(connection), device_code=msg["device_code"]
        )
    except DevicePending as attesa:
        connection.send_result(
            msg["id"], {"pending": True, "interval": attesa.interval}
        )
        return
    except GitHubError as errore:
        connection.send_error(msg["id"], errore.code, str(errore))
        return
    # Collegato: le bozze rimaste indietro partono adesso, senza aspettare il
    # giro di mezz'ora. Chi ha appena autorizzato sta guardando.
    delivered = await async_deliver_pending(hass, user_id=_caller_id(connection))
    connection.send_result(
        msg["id"], {"pending": False, "account": account, "delivered": delivered}
    )


@websocket_api.websocket_command({vol.Required("type"): TYPE_TICKET_AUTH_FORGET})
@websocket_api.async_response
async def async_ticket_auth_forget(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Scollega l'account da questo Home Assistant.

    Toglie il gettone di qui, e non lo revoca su GitHub: quello si fa su
    GitHub, ed e' la finestra a doverlo dire invece di lasciar credere che una
    cosa sola ne faccia due.
    """
    if not _authorized(hass, connection, None):
        _deny(connection, msg)
        return
    removed = await async_forget_auth(hass, _caller_id(connection))
    connection.send_result(msg["id"], {"removed": removed})


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
        async_list_tickets,
        async_create_ticket,
        async_delete_ticket,
        async_sync_tickets,
        async_ticket_queue,
        async_answer_ticket_command,
        async_ticket_thread,
        async_reply_ticket_command,
        async_take_ticket_command,
        async_ticket_auth_start,
        async_ticket_auth_poll,
        async_ticket_auth_forget,
    ):
        websocket_api.async_register_command(hass, command)
    domain_data[DATA_WEBSOCKET_REGISTERED] = True
