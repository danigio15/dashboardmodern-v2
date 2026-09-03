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
    async_cestina,
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
    """La plancia che tiene le opzioni della chat.

    La chat e' dell'installazione, non della singola plancia, e le sue opzioni
    stanno sulla voce primaria — la stessa che tiene le segnalazioni e il
    controllo aggiornamenti. Prendere la prima dell'elenco funziona finche' le
    plance sono una o due; con tre, dopo aver cancellato l'originale, la
    primaria si ricalcola per identificativo minimo e puo' non essere la prima:
    li' spegnere la chat non avrebbe effetto e la chiave della console non si
    troverebbe.
    """
    from . import _primary_entry

    for voce in hass.config_entries.async_entries(DOMAIN):
        if _primary_entry(hass, voce):
            return voce
    return None


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
    guasto = ""
    if store.aperta():
        identita = await store.async_identita()
        try:
            arrivati = await async_leggi(hass, identita, dopo=store.ultimo())
            await store.async_aggiungi(arrivati)
        except ChatError as errore:
            # Il centralino giu' non deve voler dire una schermata vuota: la
            # copia locale esiste apposta, e chi apre la chat la vede lo stesso.
            # Il guasto si dice, ma accanto alla conversazione, non al posto suo:
            # sollevare qui buttava via anche quello che c'era gia' letto.
            guasto = str(errore)
            _LOGGER.debug("Chat: rilettura non riuscita", exc_info=True)
    if not zitta:
        await store.async_letto()
    return {
        "enabled": True,
        "opened": store.aperta(),
        "name": store.nome(),
        "messages": store.messaggi(),
        "error": guasto,
    }


async def async_scrivi(
    hass: HomeAssistant, testo: str, *, nome: str = "", lingua: str = ""
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
    # Da dove eravamo rimasti, PRIMA di scrivere. Il numero che il centralino
    # da' al messaggio nuovo e' piu' alto di tutti, quindi metterlo in copia e
    # basta sposterebbe il segnalibro oltre una risposta arrivata nel frattempo
    # — nei cinque minuti fra un giro e l'altro ci sta benissimo — e quella
    # risposta non verrebbe chiesta mai piu': persa, in silenzio, per sempre.
    prima = store.ultimo()
    messaggio = await async_manda(
        hass, identita, testo, nome=store.nome(), lingua=lingua
    )
    try:
        # Il centralino rida' anche il messaggio appena scritto, quindi questa
        # rilettura porta indietro sia le risposte in sospeso sia la propria
        # frase, in ordine: il segnalibro avanza di uno per volta e non salta.
        await store.async_aggiungi(await async_leggi(hass, identita, dopo=prima))
    except ChatError:
        # Il messaggio e' partito: quello che non e' riuscito e' rileggere.
        #
        # E qui non si mette niente in copia, per la stessa ragione per cui la
        # rilettura esiste: la propria frase ha il numero piu' alto di tutti, e
        # metterla da sola sposterebbe il segnalibro oltre una risposta ancora
        # da leggere — cioe' rifarebbe, nel ramo del guasto, il difetto che
        # questa funzione e' stata riscritta per togliere.
        #
        # Non comparira' subito sullo schermo, e va bene: la finestra rilegge
        # dopo ogni invio, e comunque il giro dei cinque minuti ripassa di li'
        # e porta indietro sia la frase sia quello che c'era prima.
        _LOGGER.debug("Chat: rilettura dopo l'invio non riuscita", exc_info=True)
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
        # Se il centralino non risponde, il guasto si dice e non si tocca
        # niente. La prima stesura cancellava lo stesso la copia locale e
        # rispondeva «fatto»: era la peggiore delle risposte possibili, perche'
        # il filo restava intero di la' — con dentro quello che una persona
        # aveva appena chiesto di far sparire — e il giro dei cinque minuti se
        # lo riportava in casa poco dopo. Detto altrimenti: si prometteva una
        # cancellazione, se ne faceva una finta, e i messaggi tornavano.
        await async_cancella(hass, identita)
    await store.async_dimentica()
    return True


# ─── Il lato di chi risponde ─────────────────────────────────────────────────


def _chiave_di_chi_risponde(hass: HomeAssistant) -> str:
    """La chiave, e il permesso di usarla.

    Due domande e non una. La prima e' se questa plancia risponda alle chat, e
    la dice la chiave. La seconda e' se la chat sia accesa: spegnerla promette
    che «non esce niente di casa», e la promessa vale anche per chi risponde —
    senza questo controllo un amministratore con una finestra gia' aperta, o
    una chiamata diretta ai comandi, avrebbe continuato a parlare col
    centralino con l'interruttore su spento.
    """
    if not accesa(hass):
        raise ChatError("disabled", "La chat non e' disponibile su questa plancia.")
    chiave = chiave_console(hass)
    if not chiave:
        raise ChatError("forbidden", "Questa plancia non risponde alle chat.")
    return chiave


async def async_coda(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Le conversazioni aperte, per chi risponde."""
    return await async_conversazioni(hass, _chiave_di_chi_risponde(hass))


#: Quante pagine si e' disposti a chiedere per una conversazione sola. Il
#: centralino ne tiene duecento messaggi e ne da' cento per volta: due giri
#: bastano, il terzo e' il margine perche' quei due numeri non si tocchino.
MAX_PAGINE = 4


async def async_apri(hass: HomeAssistant, linea: str) -> list[dict[str, Any]]:
    """Una conversazione intera, per chi risponde.

    Intera davvero: il centralino ne da' cento per volta e ne conserva
    duecento, quindi chiedere la prima pagina e fermarsi vorrebbe dire che
    dalla centunesima in poi non si leggono mai — nemmeno riaprendo, perche' si
    riaprirebbe sulle stesse cento. Si chiede una pagina dopo l'altra finche'
    una non porta piu' niente di nuovo.
    """
    chiave = _chiave_di_chi_risponde(hass)
    filo: list[dict[str, Any]] = []
    dopo = 0
    for _giro in range(MAX_PAGINE):
        pagina = await async_filo(hass, chiave, linea, dopo=dopo)
        # Si tiene solo quello che viene davvero dopo il segnalibro. Chiedere
        # «dopo N» e fidarsi che la risposta lo rispetti basterebbe finche' i due
        # lati restano d'accordo; il giorno che non lo fossero, il filo si
        # riempirebbe di righe doppie e nessuno saprebbe perche'.
        avanti = [riga for riga in pagina if int(riga.get("id") or 0) > dopo]
        if not avanti:
            break
        filo.extend(avanti)
        dopo = max(int(riga.get("id") or 0) for riga in avanti)
    return filo


async def async_replica(hass: HomeAssistant, linea: str, testo: str) -> dict[str, Any]:
    """Rispondi a una casa."""
    return await async_rispondi(hass, _chiave_di_chi_risponde(hass), linea, testo)


async def async_butta(hass: HomeAssistant, linea: str) -> bool:
    """Butta via una conversazione, dalla coda di chi risponde.

    La casa la propria puo' cancellarla da sempre; chi risponde non poteva
    cancellare niente, e una coda dove non si butta via nulla si riempie di
    prove, di domande gia' risolte e di righe aperte per sbaglio, finche'
    quella vera non si trova piu'.

    Cancella davvero, e per tutti e due: la linea sparisce dal centralino e con
    lei quello che si erano detti. Sparisce anche dalla plancia di quella casa
    — la conversazione era finita — ed e' il verso giusto della promessa
    scritta prima della prima riga: quello che si scrive li' non resta in giro
    per sempre.
    """
    return await async_cestina(hass, _chiave_di_chi_risponde(hass), linea)


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
    "async_butta",
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
