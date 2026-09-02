"""La consegna delle segnalazioni, e il ritorno delle risposte.

Una segnalazione aperta dalla plancia diventa una issue di questa stessa
repository, aperta a nome di chi l'ha scritta. Il manutentore risponde dalla
sua plancia, la risposta e' un commento sotto la issue, e chi ha segnalato se
la ritrova nella propria: lo stesso filo, percorso nei due sensi.

Il mestiere sta qui, in Python, e non nel browser, per una ragione che il
progetto ha gia' incontrato: la plancia gira in un iframe `about:srcdoc` e non
possiede nessun token — le sue chiamate REST tornavano 401, ed e' il motivo per
cui anche il caricamento delle foto passa dal WebSocket. Ma qui c'e' una
seconda ragione, piu' forte: **il gettone GitHub non deve mai arrivare al
browser**. Sta nel deposito del backend e viaggia solo verso api.github.com.

Niente di tutto questo e' necessario perche' la plancia funzioni. Senza
autorizzazione le segnalazioni si scrivono, si conservano e si rileggono in
casa, e la plancia lo dice invece di far finta di aver spedito.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from . import github_client
from .const import (
    DOMAIN,
    EVENT_TICKET_MESSAGE,
    OPTION_TICKETS_ENABLED,
    TICKET_SYNC_BATCH,
)
from .github_client import GitHubError
from .github_tokens import async_get_token_store
from .ticket_store import MAX_REPLY, STATE_DRAFT, async_get_ticket_store
from .ticket_watch import async_get_watch

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DATA_TICKET_UNSUB = "ticket_sync_unsub"
DATA_WATCH_UNSUB = "ticket_watch_unsub"


def _primary_options(hass: HomeAssistant) -> Mapping[str, Any]:
    """Le opzioni della plancia che risponde per l'integrazione.

    Le segnalazioni sono dell'installazione, non della singola plancia: chi ne
    ha due non ha due code. Vale quindi l'opzione della primaria, la stessa
    regola gia' scelta per il controllo aggiornamenti.
    """
    from . import _primary_entry

    for entry in hass.config_entries.async_entries(DOMAIN):
        if _primary_entry(hass, entry):
            return entry.options
    return {}


def enabled(hass: HomeAssistant) -> bool:
    """Se questa installazione parla con GitHub per le segnalazioni."""
    if not _primary_options(hass).get(OPTION_TICKETS_ENABLED, True):
        return False
    return github_client.configured()


# ─── L'autorizzazione ────────────────────────────────────────────────────────


async def async_begin_auth(hass: HomeAssistant) -> dict[str, Any]:
    """Chiedi il codice che l'utente andra' a digitare su github.com."""
    if not enabled(hass):
        raise GitHubError("disabled", "Le segnalazioni sono spente su questa plancia.")
    return await github_client.async_start_device_flow(hass)


async def async_finish_auth(
    hass: HomeAssistant, *, user_id: str, device_code: str
) -> dict[str, Any]:
    """Ritira il gettone e ricordalo. Solleva ``DevicePending`` se non e' pronto."""
    if not enabled(hass):
        raise GitHubError("disabled", "Le segnalazioni sono spente su questa plancia.")
    token = await github_client.async_poll_device_flow(hass, device_code)
    chi = await github_client.async_whoami(hass, token)
    store = await async_get_token_store(hass)
    return await store.async_remember(
        user_id, token=token, login=chi["login"], maintainer=chi["maintainer"]
    )


async def async_forget_auth(hass: HomeAssistant, user_id: str) -> bool:
    """Dimentica il gettone di questo utente."""
    store = await async_get_token_store(hass)
    return await store.async_forget(user_id)


# ─── La consegna ─────────────────────────────────────────────────────────────


async def async_deliver_pending(hass: HomeAssistant, *, user_id: str = "") -> int:
    """Apri le issue delle bozze. Torna quante ne sono partite.

    Ognuno consegna le proprie: la issue nasce a nome di chi l'ha scritta, e
    non del primo utente della casa che si e' autorizzato. Una bozza di chi non
    ha ancora autorizzato resta bozza — non e' un guasto, e' che manca la firma.

    Un fallimento non e' un errore da registro: la rete di casa va e viene, e
    ripetere lo stesso avviso ogni mezz'ora e' rumore. Resta scritto sul
    ticket, dove chi l'ha aperto lo puo' leggere.
    """
    if not enabled(hass):
        return 0
    tickets = await async_get_ticket_store(hass)
    gettoni = await async_get_token_store(hass)
    partiti = 0
    for ticket in tickets.pending():
        autore = str(ticket.get("opened_by") or "")
        if user_id and autore != user_id:
            continue
        token = gettoni.token(autore)
        if not token:
            await tickets.async_mark_failed(
                ticket["id"], "Collega GitHub per inviare questa segnalazione."
            )
            continue
        try:
            aperta = await github_client.async_create_issue(hass, token, ticket)
        except GitHubError as errore:
            await tickets.async_mark_failed(ticket["id"], str(errore))
            continue
        await tickets.async_mark_sent(
            ticket["id"], str(aperta["number"]), issue_url=aperta["url"]
        )
        partiti += 1
    return partiti


async def async_sync_states(hass: HomeAssistant) -> int:
    """Vai a vedere che fine hanno fatto le segnalazioni gia' aperte."""
    if not enabled(hass):
        return 0
    tickets = await async_get_ticket_store(hass)
    numeri = tickets.remote_ids()[:TICKET_SYNC_BATCH]
    if not numeri:
        return 0
    gettoni = await async_get_token_store(hass)
    token = gettoni.any_token()
    aggiornamenti: list[dict[str, Any]] = []
    for numero in numeri:
        try:
            letta = await github_client.async_read_issue(hass, int(numero), token=token)
        except (GitHubError, ValueError):
            # Una issue cancellata o irraggiungibile non ferma le altre.
            continue
        aggiornamenti.append({**letta, "remote_id": str(letta["number"])})
    return await tickets.async_merge_remote(aggiornamenti)


# ─── La console ──────────────────────────────────────────────────────────────


async def async_console_token(hass: HomeAssistant, user_id: str) -> str:
    """Il gettone di chi apre la console, se ha i permessi per averla.

    Non basta amministrare Home Assistant: bisogna poter scrivere sulla
    repository, e quello lo dice GitHub. Cosi' la console si accende da sola
    sulla plancia giusta, senza nessuna chiave da incollare da nessuna parte.
    """
    gettoni = await async_get_token_store(hass)
    if not gettoni.is_maintainer(user_id):
        raise GitHubError("not_console", "Questa installazione non e' la console.")
    return gettoni.token(user_id)


async def async_queue(hass: HomeAssistant, user_id: str) -> list[dict[str, Any]]:
    """Le segnalazioni nate dalla plancia, viste da chi tiene la repository."""
    token = await async_console_token(hass, user_id)
    return await github_client.async_queue(hass, token)


async def async_thread(
    hass: HomeAssistant, user_id: str, number: int
) -> dict[str, Any]:
    """Il filo intero di una segnalazione: testo, commenti, allegati.

    Una richiesta sola, e solo quando qualcuno apre quella segnalazione:
    chiedere i commenti di tutte e cinquanta in un colpo vorrebbe dire
    cinquanta chiamate per guardarne una.

    Lo leggono in due, e per due ragioni diverse. Il manutentore lo apre dalla
    coda, su qualunque segnalazione. Chi ha segnalato lo apre sulle **sue**,
    per vedere la risposta senza uscire dalla plancia: prima quel «vedi la
    discussione» lo portava su github.com, cioe' fuori proprio dal posto che
    questa finestra esiste per non fargli lasciare.

    Il gettone e' quello di chi chiede, quando ce l'ha, e serve solo al limite
    orario: la repository e' pubblica e le issue si leggono comunque. Chi non
    ha collegato niente legge lo stesso — leggere non chiede permessi.
    """
    gettoni = await async_get_token_store(hass)
    filo = await github_client.async_issue_thread(
        hass, gettoni.token(user_id), int(number)
    )
    # Aprirlo e' averlo letto, e il segno si toglie qui invece che nel browser
    # perche' le plance sono piu' di una: chi legge la risposta dal telefono e
    # poi passa davanti al tablet in cucina non deve ritrovare lo stesso
    # pallino ad aspettarlo.
    await (await async_get_watch(hass)).async_letta(int(number))
    return filo


async def async_answer(
    hass: HomeAssistant,
    *,
    user_id: str,
    number: int,
    reply: str = "",
    close: str = "",
) -> dict[str, Any]:
    """Rispondi sotto la segnalazione, e se serve chiudila.

    La risposta e' un commento su GitHub: la vede chi ha segnalato, dentro la
    sua plancia al primo giro di sync, e la vede chiunque passi dalla issue.
    Un posto solo, non due da tenere allineati.
    """
    token = await async_console_token(hass, user_id)
    fatto: dict[str, Any] = {"commented": False, "closed": False}
    if reply.strip():
        await github_client.async_comment(hass, token, number, reply.strip())
        fatto["commented"] = True
        # Il campanello non suona per quello che si e' appena scritto.
        await (await async_get_watch(hass)).async_ho_scritto(int(number))
    if close in {"risolto", "chiuso"}:
        await github_client.async_close_issue(
            hass, token, number, planned=close == "risolto"
        )
        fatto["closed"] = True
    return fatto


async def async_take(
    hass: HomeAssistant, *, user_id: str, number: int, take: bool = True
) -> dict[str, Any]:
    """Prendi in carico una segnalazione, o lasciala.

    «Presa in carico» su GitHub ha gia' un gesto suo, e si chiama assegnazione:
    la issue compare fra le tue, l'elenco la mostra con la tua faccia accanto,
    e chi passa dalla pagina lo vede senza che nessuno glielo scriva. Inventare
    un'etichetta apposta avrebbe voluto dire un segno che esiste solo dentro
    questa plancia, e una repository che dice una cosa diversa da quello che il
    cruscotto mostra.

    Non lascia commenti. Prendere in carico e' un gesto di chi organizza il
    lavoro, non un messaggio a chi ha segnalato: notificare a ogni presa in
    carico avrebbe voluto dire far vibrare un telefono per dire «l'ho vista».
    """
    token = await async_console_token(hass, user_id)
    gettoni = await async_get_token_store(hass)
    chi = gettoni.describe(user_id).get("login") or ""
    if not chi:
        raise GitHubError("no_login", "Manca il nome dell'account GitHub.")
    await github_client.async_assign_issue(
        hass, token, int(number), login=str(chi), take=take
    )
    return {"taken": bool(take), "assignee": str(chi) if take else ""}


async def async_reply(
    hass: HomeAssistant, *, user_id: str, number: int, message: str
) -> dict[str, Any]:
    """Scrivi sotto una segnalazione tua, senza uscire dalla plancia.

    E' la meta' che mancava. Fino a qui il filo si poteva leggere ma non
    scrivere: chi aveva segnalato leggeva la risposta del manutentore dentro la
    propria plancia e poi, per dire «ho provato, non funziona lo stesso»,
    doveva aprire github.com — cioe' uscire proprio dal posto che quella
    finestra esiste per non fargli lasciare. Con questo il filo si percorre
    davvero nei due sensi, e la conversazione e' una conversazione.

    Il commento parte **a nome di chi scrive**, con il suo gettone, come la
    segnalazione. Non c'e' nessun modo per cui il messaggio di un utente della
    casa risulti scritto dal manutentore.

    E si scrive solo sotto le proprie. Non e' riservatezza — la issue e' una
    pagina pubblica e chiunque abbia un account GitHub ci puo' commentare — ma
    e' che questa finestra mostra a ognuno le sue segnalazioni: farci partire
    un commento su una che non compare da nessuna parte sarebbe stato un tasto
    che agisce su qualcosa che non si vede.
    """
    testo = message.strip()
    if not testo:
        raise GitHubError("empty", "Il messaggio e' vuoto.")
    if not enabled(hass):
        raise GitHubError("disabled", "Le segnalazioni sono spente su questa plancia.")
    gettoni = await async_get_token_store(hass)
    token = gettoni.token(user_id)
    if not token:
        raise GitHubError(
            "no_token", "Collega GitHub per scrivere sotto la tua segnalazione."
        )
    if not gettoni.is_maintainer(user_id):
        tickets = await async_get_ticket_store(hass)
        if not tickets.owns_remote(user_id, str(int(number))):
            raise GitHubError("not_yours", "Questa segnalazione non e' tua.")
    await github_client.async_comment(hass, token, int(number), testo[:MAX_REPLY])
    await (await async_get_watch(hass)).async_ho_scritto(int(number))
    return {"sent": True}


async def async_unread(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Le conversazioni con messaggi nuovi che nessuno ha ancora aperto.

    Non chiede niente a GitHub: e' quello che il campanello ha gia' visto
    passare, e chiederlo di nuovo a ogni ridisegno della Home vorrebbe dire
    una richiesta ogni volta che si guarda una tessera.
    """
    if not enabled(hass):
        return []
    return (await async_get_watch(hass)).non_lette()


# ─── Il campanello ───────────────────────────────────────────────────────────


def _suona(hass: HomeAssistant, riga: Mapping[str, Any], *, console: bool) -> None:
    """Un messaggio nuovo: sul bus e sulla campanella di Home Assistant.

    Due strade e non una, perche' servono a due persone diverse. L'evento e'
    per chi le automazioni le scrive — il telefono, l'altoparlante della
    cucina, la luce che cambia colore — e non impone niente a nessuno. La
    notifica e' per chi automazioni non ne scrive e vuole lo stesso sapere che
    qualcuno ha scritto: c'e' di suo, senza configurare niente, ed e' quella
    che si vede aprendo Home Assistant.

    L'identificativo della notifica porta il numero della segnalazione: due
    messaggi sotto la stessa non fanno due campanelle da chiudere una per una,
    e due segnalazioni diverse restano due avvisi diversi.
    """
    from homeassistant.components import persistent_notification

    numero = int(riga.get("number") or 0)
    titolo = str(riga.get("title") or "").strip() or f"#{numero}"
    indirizzo = str(riga.get("issue_url") or "")
    quanti = int(riga.get("messages") or 1)
    hass.bus.async_fire(
        EVENT_TICKET_MESSAGE,
        {
            "number": numero,
            "title": titolo,
            "messages": quanti,
            "opened": bool(riga.get("opened")),
            "author": str(riga.get("author") or ""),
            "origin": str(riga.get("origin") or ""),
            "state": str(riga.get("state") or "open"),
            "issue_url": indirizzo,
            "console": console,
        },
    )
    if riga.get("opened"):
        testo = f"Nuova segnalazione: «{titolo}»."
    elif quanti > 1:
        testo = f"{quanti} messaggi nuovi sulla segnalazione «{titolo}»."
    else:
        testo = f"Nuovo messaggio sulla segnalazione «{titolo}»."
    dove = (
        "Aprila dal Cruscotto della plancia."
        if console
        else "Aprila da Segnalazioni, nella plancia."
    )
    persistent_notification.async_create(
        hass,
        f"{testo} {dove}",
        title="DashboardModern — segnalazioni",
        notification_id=f"{DOMAIN}_messaggio_{numero}",
    )


async def async_watch_messages(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Un giro del campanello. Torna i messaggi per cui ha suonato.

    Il gettone e' obbligatorio, e non per autenticarsi: la repository e'
    pubblica e queste righe si leggerebbero anche senza. E' per il limite
    orario. Dodici richieste all'ora contro le sessanta che GitHub concede a
    chi non si presenta — e che il controllo aggiornamenti e la sincronia gia'
    consumano — vorrebbe dire un campanello che verso sera smette di suonare
    per esaurimento, cioe' peggio di uno che non c'e'. Con un gettone il tetto
    e' cinquemila e la domanda non si pone.

    Chi tiene la repository sente tutto: e' il suo mestiere, ed e' quello che
    il cruscotto mostra. Chi la plancia la usa e basta sente solo le proprie —
    le altre sono conversazioni fra sconosciuti.
    """
    if not enabled(hass):
        return []
    gettoni = await async_get_token_store(hass)
    token = gettoni.any_token()
    if not token:
        return []
    console = bool(gettoni.maintainer_token())
    mie: set[str] | None = None
    if not console:
        tickets = await async_get_ticket_store(hass)
        mie = set(tickets.remote_ids(every=True))
        if not mie:
            return []
    watch = await async_get_watch(hass)
    try:
        righe = await github_client.async_updated_since(hass, token, since=watch.since)
    except GitHubError:
        # Come il resto del giro periodico: la rete di casa va e viene, e un
        # campanello che si lamenta nel registro ogni cinque minuti e' rumore.
        _LOGGER.debug("Giro del campanello non riuscito", exc_info=True)
        return []
    nuovi = watch.nuovi(righe, mie=mie)
    await watch.async_ricorda(righe, adesso=_adesso())
    # Il campanello suona e passa: e' un evento, e un evento non lo si puo'
    # guardare mezz'ora dopo. Quello che resta e' questo elenco, ed e' quello
    # che la plancia mostra a chi la apre dopo che il telefono ha vibrato — o
    # dopo che il telefono non era in tasca.
    await watch.async_segna_nuovi(nuovi, quando=_adesso())
    for riga in nuovi:
        _suona(hass, riga, console=console)
    if nuovi and not console:
        # Una risposta appena arrivata la si vuole leggere adesso, non alla
        # mezz'ora: la notifica dice «c'e' un messaggio», e se aprendo la
        # plancia non ci fosse ancora sarebbe una bugia con trenta minuti di
        # scadenza. Solo per chi ha segnalato: la console GitHub la rilegge da
        # sola ogni volta che si apre.
        await async_sync_states(hass)
    return nuovi


def _adesso() -> str:
    """L'ora di casa nel formato che GitHub usa. Serve solo al primo giro."""
    from datetime import UTC, datetime

    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


# ─── Il giro periodico ───────────────────────────────────────────────────────


async def _async_tick(hass: HomeAssistant) -> None:
    """Prima le bozze arretrate, poi le risposte."""
    try:
        await async_deliver_pending(hass)
        await async_sync_states(hass)
    except Exception:  # noqa: BLE001 - un giro andato male non ferma i prossimi
        _LOGGER.debug("Giro delle segnalazioni non riuscito", exc_info=True)


async def async_setup_tickets(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Avvia il giro periodico, una volta sola per installazione."""
    from datetime import timedelta

    from homeassistant.helpers.event import async_track_time_interval

    from .const import TICKET_SYNC_INTERVAL, TICKET_WATCH_INTERVAL

    await async_get_ticket_store(hass)
    await async_get_token_store(hass)
    await async_get_watch(hass)
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_TICKET_UNSUB) is not None:
        return

    async def _periodico(_now: Any) -> None:
        await _async_tick(hass)

    async def _campanello(_now: Any) -> None:
        try:
            await async_watch_messages(hass)
        except Exception:  # noqa: BLE001 - un giro andato male non ferma i prossimi
            _LOGGER.debug("Giro del campanello non riuscito", exc_info=True)

    unsub = async_track_time_interval(
        hass, _periodico, timedelta(seconds=TICKET_SYNC_INTERVAL)
    )
    domain_data[DATA_TICKET_UNSUB] = unsub
    # Due giri e non uno, perche' fanno due mestieri di costo diverso. Quello
    # da mezz'ora rilegge una per una le segnalazioni aperte e riprova le
    # consegne: pesa, e a farlo ogni cinque minuti sarebbero centinaia di
    # richieste all'ora. Quello da cinque minuti e' una richiesta sola e serve
    # solo a sapere se qualcuno ha scritto — che e' la cosa che non puo'
    # aspettare mezz'ora.
    domain_data[DATA_WATCH_UNSUB] = async_track_time_interval(
        hass, _campanello, timedelta(seconds=TICKET_WATCH_INTERVAL)
    )
    entry.async_on_unload(lambda: _async_teardown(hass))


def _async_teardown(hass: HomeAssistant) -> None:
    """Stacca il giro quando la plancia che lo teneva se ne va."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    for chiave in (DATA_TICKET_UNSUB, DATA_WATCH_UNSUB):
        unsub = domain_data.pop(chiave, None)
        if unsub is not None:
            unsub()


__all__ = [
    "STATE_DRAFT",
    "GitHubError",
    "async_answer",
    "async_begin_auth",
    "async_deliver_pending",
    "async_finish_auth",
    "async_forget_auth",
    "async_queue",
    "async_reply",
    "async_setup_tickets",
    "async_sync_states",
    "async_take",
    "async_thread",
    "async_unread",
    "async_watch_messages",
    "enabled",
]
