"""La consegna delle segnalazioni, e il ritorno delle risposte.

Il mestiere e' tutto qui e non nel browser, per un motivo che il progetto ha
gia' incontrato: la plancia gira dentro un iframe `about:srcdoc` e non
possiede nessun token: le sue chiamate REST tornavano 401, ed e' la ragione
per cui anche il caricamento delle foto e' passato dal WebSocket. Una chiamata
verso l'esterno partita da li' dovrebbe passare la CSP di Home Assistant e il
CORS di chi la riceve; partita da qui non incontra ne' l'una ne' l'altro, e in
piu' la chiave del manutentore resta dove sta — dentro le opzioni del config
entry, mai dentro un bundle JavaScript che chiunque puo' aprire.

Niente di tutto questo e' necessario perche' la plancia funzioni. Senza un
indirizzo configurato non parte una sola richiesta: le segnalazioni si
scrivono, si conservano e si rileggono in casa, e la plancia lo dice invece di
far finta di aver spedito.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    DOMAIN,
    OPTION_MAINTAINER_TOKEN,
    OPTION_TICKET_ENDPOINT,
    OPTION_TICKETS_ENABLED,
    TICKET_RELAY_URL,
)
from .ticket_store import STATE_DRAFT, async_get_ticket_store

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

#: Venti secondi: la stessa pazienza che il controllo aggiornamenti concede a
#: GitHub. Oltre, chi ha aperto la segnalazione ha gia' smesso di guardare.
_TIMEOUT = 20

#: Il tetto sulla risposta del relay. Non e' diffidenza verso il proprio
#: servizio: e' che un servizio raggiungibile da fuori casa non deve poter
#: decidere quanta memoria occupa dentro casa.
_MAX_RESPONSE_BYTES = 256 * 1024

DATA_TICKET_UNSUB = "ticket_sync_unsub"


class RelayUnavailable(RuntimeError):
    """Il relay non e' configurato, e' spento o non ha risposto."""


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


def relay_endpoint(hass: HomeAssistant) -> str:
    """L'indirizzo del relay, o stringa vuota se non se ne parla."""
    options = _primary_options(hass)
    if not options.get(OPTION_TICKETS_ENABLED, True):
        return ""
    endpoint = str(options.get(OPTION_TICKET_ENDPOINT) or TICKET_RELAY_URL or "")
    endpoint = endpoint.strip().rstrip("/")
    # Solo HTTPS. Un endpoint in chiaro porterebbe fuori casa, su una rete che
    # non e' la propria, quello che l'utente ha scritto pensando di scriverlo a
    # una persona sola.
    if not endpoint.startswith("https://"):
        return ""
    return endpoint


def maintainer_token(hass: HomeAssistant) -> str:
    """La chiave della console, se questa installazione e' quella di chi scrive."""
    return str(_primary_options(hass).get(OPTION_MAINTAINER_TOKEN) or "").strip()


async def _post(
    hass: HomeAssistant,
    path: str,
    payload: dict[str, Any],
    *,
    token: str = "",
) -> dict[str, Any]:
    """Una richiesta al relay, con la risposta letta come JSON e con un tetto."""
    endpoint = relay_endpoint(hass)
    if not endpoint:
        raise RelayUnavailable("Nessun indirizzo configurato per le segnalazioni.")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    session = async_get_clientsession(hass)
    try:
        async with session.post(
            f"{endpoint}{path}", json=payload, headers=headers, timeout=_TIMEOUT
        ) as answer:
            corpo = await answer.content.read(_MAX_RESPONSE_BYTES + 1)
            if len(corpo) > _MAX_RESPONSE_BYTES:
                raise RelayUnavailable("Risposta troppo grande.")
            if answer.status == 429:
                raise RelayUnavailable("Troppe segnalazioni: riprova piu' tardi.")
            if answer.status >= 400:
                raise RelayUnavailable(f"Il servizio ha risposto {answer.status}.")
            import json

            try:
                letta = json.loads(corpo or b"{}")
            except ValueError as errore:
                raise RelayUnavailable("Risposta illeggibile.") from errore
            return letta if isinstance(letta, dict) else {}
    except RelayUnavailable:
        raise
    except Exception as errore:  # noqa: BLE001 - rete: ogni guasto e' lo stesso
        raise RelayUnavailable("Servizio non raggiungibile.") from errore


async def async_deliver_pending(hass: HomeAssistant) -> int:
    """Prova a consegnare le bozze. Torna quante ne sono partite.

    Un fallimento non e' un errore da registro: la rete di casa va e viene, e
    ripetere lo stesso avviso ogni mezz'ora e' rumore. Resta scritto sul
    ticket, dove chi l'ha aperto lo puo' leggere.
    """
    if not relay_endpoint(hass):
        return 0
    store = await async_get_ticket_store(hass)
    partiti = 0
    for ticket in store.pending():
        payload = {
            "installation": store.installation_id,
            "type": ticket["type"],
            "title": ticket["title"],
            "body": ticket["body"],
            "contact": ticket["contact"],
            "diagnostics": ticket["diagnostics"],
        }
        try:
            risposta = await _post(hass, "/ticket", payload)
        except RelayUnavailable as errore:
            await store.async_mark_failed(ticket["id"], str(errore))
            continue
        remote_id = str(risposta.get("id") or "")
        if not remote_id:
            await store.async_mark_failed(ticket["id"], "Il servizio non ha risposto.")
            continue
        await store.async_mark_sent(ticket["id"], remote_id)
        partiti += 1
    return partiti


async def async_sync_states(hass: HomeAssistant) -> int:
    """Chiedi che fine hanno fatto i ticket gia' partiti. Torna quanti sono cambiati."""
    if not relay_endpoint(hass):
        return 0
    store = await async_get_ticket_store(hass)
    identificativi = store.remote_ids()
    if not identificativi:
        return 0
    try:
        risposta = await _post(
            hass,
            "/sync",
            {"installation": store.installation_id, "ids": identificativi},
        )
    except RelayUnavailable:
        return 0
    aggiornamenti = risposta.get("tickets")
    if not isinstance(aggiornamenti, list):
        return 0
    return await store.async_merge_remote(aggiornamenti)


async def async_fetch_queue(hass: HomeAssistant) -> list[dict[str, Any]]:
    """La coda del manutentore. Senza chiave non si chiede nemmeno."""
    token = maintainer_token(hass)
    if not token:
        raise RelayUnavailable("Questa installazione non e' la console.")
    risposta = await _post(hass, "/queue", {}, token=token)
    coda = risposta.get("tickets")
    return coda if isinstance(coda, list) else []


async def async_answer_ticket(
    hass: HomeAssistant,
    *,
    remote_id: str,
    state: str = "",
    reply: str = "",
    promote: bool = False,
) -> dict[str, Any]:
    """Rispondi, cambia stato, o promuovi a issue pubblica. Solo dalla console."""
    token = maintainer_token(hass)
    if not token:
        raise RelayUnavailable("Questa installazione non e' la console.")
    return await _post(
        hass,
        "/answer",
        {
            "remote_id": remote_id,
            "state": state,
            "reply": reply,
            "promote": bool(promote),
        },
        token=token,
    )


async def _async_tick(hass: HomeAssistant) -> None:
    """Il giro periodico: prima le bozze arretrate, poi le risposte."""
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
    "RelayUnavailable",
    "async_answer_ticket",
    "async_deliver_pending",
    "async_fetch_queue",
    "async_setup_tickets",
    "async_sync_states",
    "maintainer_token",
    "relay_endpoint",
]
