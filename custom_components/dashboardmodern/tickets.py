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
from .const import DOMAIN, OPTION_TICKETS_ENABLED, TICKET_SYNC_BATCH
from .github_client import GitHubError
from .github_tokens import async_get_token_store
from .ticket_store import STATE_DRAFT, async_get_ticket_store

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DATA_TICKET_UNSUB = "ticket_sync_unsub"


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
    return await github_client.async_issue_thread(
        hass, gettoni.token(user_id), int(number)
    )


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
    if close in {"risolto", "chiuso"}:
        await github_client.async_close_issue(
            hass, token, number, planned=close == "risolto"
        )
        fatto["closed"] = True
    return fatto


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

    from .const import TICKET_SYNC_INTERVAL

    await async_get_ticket_store(hass)
    await async_get_token_store(hass)
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_TICKET_UNSUB) is not None:
        return

    async def _periodico(_now: Any) -> None:
        await _async_tick(hass)

    unsub = async_track_time_interval(
        hass, _periodico, timedelta(seconds=TICKET_SYNC_INTERVAL)
    )
    domain_data[DATA_TICKET_UNSUB] = unsub
    entry.async_on_unload(lambda: _async_teardown(hass))


def _async_teardown(hass: HomeAssistant) -> None:
    """Stacca il giro quando la plancia che lo teneva se ne va."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    unsub = domain_data.pop(DATA_TICKET_UNSUB, None)
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
    "async_setup_tickets",
    "async_sync_states",
    "async_thread",
    "enabled",
]
