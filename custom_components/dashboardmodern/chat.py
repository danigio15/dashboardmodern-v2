"""La chat di assistenza: una porta diretta, che non passa da GitHub.

Le segnalazioni diventano issue pubbliche, ed e' giusto che sia cosi': un
difetto deve restare scritto e ritrovabile. Chiedere aiuto e' un'altra cosa —
chi chiede aiuto incolla un pezzo di configurazione, il nome delle proprie
entita', a volte una foto di casa sua, e non gli si puo' chiedere di farlo su
una pagina pubblica con un account che magari non ha.

Qui c'e' il lato Home Assistant di quella porta: l'identita' anonima della
casa, il giro dei cinque minuti che va a vedere se e' arrivata una risposta, e
il campanello — lo stesso doppio campanello delle segnalazioni, un evento sul
bus per chi le automazioni le scrive e una notifica per chi non le scrive.

Il punto d'incontro sta altrove ed e' il centralino (`centralino/`); il
progetto intero in `docs/CHAT.md`.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from .chat_client import (
    ChatError,
    async_cancella,
    async_conversazioni,
    async_filo,
    async_leggi,
    async_manda,
    async_rispondi,
    configurato,
)
from .chat_store import async_get_chat_store
from .const import (
    CHAT_WATCH_INTERVAL,
    DOMAIN,
    EVENT_CHAT_MESSAGE,
    OPTION_CHAT_CONSOLE_KEY,
    OPTION_CHAT_ENABLED,
)

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DATA_CHAT_UNSUB = "chat_unsub"


# ─── Se la chat c'e' ─────────────────────────────────────────────────────────


def _entry(hass: HomeAssistant) -> Any:
    voci = list(hass.config_entries.async_entries(DOMAIN))
    return voci[0] if voci else None


def accesa(hass: HomeAssistant) -> bool:
    """Se la chat e' disponibile su questa plancia.

    Due condizioni, e servono entrambe: che un centralino esista — senza, la
    porta non si apre e mostrarla sarebbe una bugia — e che chi tiene questa
    casa non l'abbia spenta. Chi non vuole che la plancia parli con nessuno
    fuori di casa spegne questa come spegne le segnalazioni.
    """
    voce = _entry(hass)
    if voce is None:
        return False
    return configurato() and bool(voce.options.get(OPTION_CHAT_ENABLED, True))


def chiave_console(hass: HomeAssistant) -> str:
    """La chiave con cui si leggono tutte le conversazioni, se c'e'.

    Sta nelle opzioni di un Home Assistant solo al mondo. Non e' un ruolo che
    si deduce da qualcosa — come la console delle segnalazioni, che GitHub
    dichiara — perche' il centralino non conosce nessuno: sa distinguere solo
    chi ha la chiave da chi non ce l'ha.
    """
    voce = _entry(hass)
    if voce is None:
        return ""
    return str(voce.options.get(OPTION_CHAT_CONSOLE_KEY) or "").strip()


def e_la_console(hass: HomeAssistant) -> bool:
    """Se da questa casa si risponde alle altre."""
    return bool(configurato() and chiave_console(hass))


# ─── Il lato di chi chiede ───────────────────────────────────────────────────


async def async_stato(hass: HomeAssistant) -> dict[str, Any]:
    """Come sta la chat, per chi la deve disegnare.

    Non esce di casa: e' quello che serve a decidere se mostrare la porta, se
    c'e' un pallino, e sotto che nome si sta scrivendo. La conversazione si
    chiede a parte, quando qualcuno la apre davvero.
    """
    store = await async_get_chat_store(hass)
    return {
        "enabled": accesa(hass),
        "console": e_la_console(hass),
        "opened": store.aperta(),
        "name": store.nome(),
        "unread": len(store.non_letti()),
        "messages": len(store.messaggi()),
    }


async def async_conversazione(
    hass: HomeAssistant, *, zitta: bool = False
) -> dict[str, Any]:
    """La conversazione di questa casa, riletta dal centralino.

    La copia locale risponde subito, anche senza rete: si mostra quella, e
    intanto si chiede al centralino solo quello che manca. Aprire la chat e'
    averla letta, quindi il segnalibro si sposta qui.

    `zitta` e' per il giro automatico: se il centralino non risponde non c'e'
    niente da dire a chi non ha chiesto niente.
    """
    store = await async_get_chat_store(hass)
    if not accesa(hass):
        return {"enabled": False, "messages": []}
    if store.aperta():
        identita = await store.async_identita()
        try:
            arrivati = await async_leggi(hass, identita, dopo=store.ultimo())
            await store.async_aggiungi(arrivati)
        except ChatError:
            if not zitta:
                raise
            _LOGGER.debug("Chat: rilettura non riuscita", exc_info=True)
    if not zitta:
        await store.async_letto()
    return {
        "enabled": True,
        "opened": store.aperta(),
        "name": store.nome(),
        "messages": store.messaggi(),
    }


async def async_scrivi(
    hass: HomeAssistant, testo: str, *, nome: str = ""
) -> dict[str, Any]:
    """Manda un messaggio a chi mantiene la plancia.

    Il primo messaggio apre la conversazione: prima di quello questa casa non
    esiste per il centralino, e chi la chat non l'ha mai usata non ha lasciato
    niente da nessuna parte.
    """
    if not accesa(hass):
        raise ChatError("disabled", "La chat non e' disponibile su questa plancia.")
    store = await async_get_chat_store(hass)
    if nome:
        await store.async_chiamami(nome)
    identita = await store.async_identita()
    messaggio = await async_manda(hass, identita, testo, nome=store.nome())
    await store.async_aggiungi([messaggio])
    # Scrivere e' aver letto: il pallino non si accende per la propria frase.
    await store.async_letto()
    return messaggio


async def async_dimentica(hass: HomeAssistant) -> bool:
    """Cancella la conversazione, di qua e di la'.

    «Puoi cancellare la conversazione quando vuoi» e' scritto nella plancia
    prima che qualcuno scriva la prima riga, e una promessa del genere si
    mantiene tutta: cancellare solo la copia locale lascerebbe il filo intero
    nel centralino e sarebbe cancellare lo schermo, non la conversazione.
    """
    store = await async_get_chat_store(hass)
    if store.aperta():
        identita = await store.async_identita()
        try:
            await async_cancella(hass, identita)
        except ChatError:
            # La copia locale si cancella comunque: il centralino butta da solo
            # le linee ferme da sei mesi, e lasciare i messaggi sullo schermo di
            # chi ha appena chiesto di non vederli piu' sarebbe la cosa peggiore
            # delle due.
            _LOGGER.debug(
                "Chat: cancellazione sul centralino non riuscita", exc_info=True
            )
    await store.async_dimentica()
    return True


# ─── Il lato di chi risponde ─────────────────────────────────────────────────


async def async_coda(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Le conversazioni aperte, per chi risponde."""
    chiave = chiave_console(hass)
    if not chiave:
        raise ChatError("forbidden", "Questa plancia non risponde alle chat.")
    return await async_conversazioni(hass, chiave)


async def async_apri(hass: HomeAssistant, linea: str) -> list[dict[str, Any]]:
    """Una conversazione intera, per chi risponde."""
    chiave = chiave_console(hass)
    if not chiave:
        raise ChatError("forbidden", "Questa plancia non risponde alle chat.")
    return await async_filo(hass, chiave, linea)


async def async_replica(hass: HomeAssistant, linea: str, testo: str) -> dict[str, Any]:
    """Rispondi a una casa."""
    chiave = chiave_console(hass)
    if not chiave:
        raise ChatError("forbidden", "Questa plancia non risponde alle chat.")
    return await async_rispondi(hass, chiave, linea, testo)


# ─── Il campanello ───────────────────────────────────────────────────────────


def _suona(hass: HomeAssistant, quanti: int, ultimo: Mapping[str, Any]) -> None:
    """E' arrivata una risposta: sul bus e sulla campanella.

    Le stesse due strade del campanello delle segnalazioni, e un evento suo
    invece dello stesso: un'automazione puo' voler suonare per una risposta
    dell'assistenza e stare zitta per un commento su una issue, e con un evento
    solo quella distinzione non si potrebbe fare.

    Un identificativo solo per la notifica: la chat e' una conversazione sola,
    e tre risposte di fila non devono lasciare tre campanelle da chiudere una
    per una.
    """
    from homeassistant.components import persistent_notification

    anteprima = str(ultimo.get("testo") or "").strip()
    hass.bus.async_fire(
        EVENT_CHAT_MESSAGE,
        {
            "messages": int(quanti),
            "text": anteprima,
            "written_at": int(ultimo.get("scritto_il") or 0),
        },
    )
    testo = (
        f"{quanti} messaggi nuovi dall'assistenza."
        if quanti > 1
        else "Hai una risposta dall'assistenza."
    )
    persistent_notification.async_create(
        hass,
        f"{testo} Aprila da Assistenza, nella plancia.",
        title="DashboardModern — assistenza",
        notification_id=f"{DOMAIN}_chat",
    )


async def async_guarda(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Il giro dei cinque minuti: e' arrivata una risposta?

    Una richiesta sola, e solo per le case che la chat l'hanno aperta davvero:
    chi non ha mai scritto non ha niente da chiedere, e non chiede.
    """
    if not accesa(hass):
        return []
    store = await async_get_chat_store(hass)
    if not store.aperta():
        return []
    identita = await store.async_identita()
    arrivati = await async_leggi(hass, identita, dopo=store.ultimo())
    aggiunti = await store.async_aggiungi(arrivati)
    dalla_console = [riga for riga in aggiunti if riga.get("da") == "console"]
    if dalla_console:
        _suona(hass, len(dalla_console), dalla_console[-1])
    return dalla_console


# ─── Il giro periodico ───────────────────────────────────────────────────────


async def async_setup_chat(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Avvia il giro della chat, una volta sola per installazione."""
    from datetime import timedelta

    from homeassistant.helpers.event import async_track_time_interval

    await async_get_chat_store(hass)
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_CHAT_UNSUB) is not None:
        return

    async def _campanello(_now: Any) -> None:
        try:
            await async_guarda(hass)
        except Exception:  # noqa: BLE001 - un giro andato male non ferma i prossimi
            _LOGGER.debug("Giro della chat non riuscito", exc_info=True)

    domain_data[DATA_CHAT_UNSUB] = async_track_time_interval(
        hass, _campanello, timedelta(seconds=CHAT_WATCH_INTERVAL)
    )
    entry.async_on_unload(lambda: _async_teardown(hass))


def _async_teardown(hass: HomeAssistant) -> None:
    """Stacca il giro quando la plancia che lo teneva se ne va."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    unsub = domain_data.pop(DATA_CHAT_UNSUB, None)
    if unsub is not None:
        unsub()


__all__ = [
    "ChatError",
    "accesa",
    "async_apri",
    "async_coda",
    "async_conversazione",
    "async_dimentica",
    "async_guarda",
    "async_replica",
    "async_scrivi",
    "async_setup_chat",
    "async_stato",
    "e_la_console",
]
