"""Le segnalazioni aperte da chi la plancia la usa.

Una segnalazione nasce qui, in casa, e solo dopo prova a partire. L'ordine e'
voluto e non e' un dettaglio implementativo: la consegna e' una chiamata verso
un servizio che puo' essere spento, irraggiungibile o semplicemente non
configurato, e chi scrive alle due di notte non deve perdere quello che ha
scritto perche' dall'altra parte non rispondeva nessuno. Il ticket resta in
stato ``bozza`` finche' non se ne va davvero, e la consegna si riprova.

Tre scelte reggono il resto del file.

* **La diagnostica e' una lista chiusa.** Non un dizionario raccolto a runtime
  e spedito com'e': le chiavi ammesse stanno scritte qui, e tutto il resto
  viene buttato via prima di toccare il disco. Un campo che nessuno ha
  dichiarato non puo' finire in un ticket per distrazione — e da un ticket
  esce di casa.
* **L'identificativo dell'installazione non deriva da niente.** E' un numero
  casuale generato una volta sola. Non e' l'``entry_id``, non e' l'utente di
  Home Assistant, non e' un'impronta della rete: serve a raggruppare i ticket
  della stessa persona per poterle rispondere, e a contare le richieste per
  fermare gli abusi. Nient'altro, e da nient'altro si puo' risalire.
* **Lo store ha un fondo.** Cento ticket, e quando sono pieni cede per primi
  quelli gia' chiusi. Un difetto che aprisse segnalazioni in un ciclo
  troverebbe un tetto invece del disco pieno.
"""

from __future__ import annotations

# `Mapping` serve a tempo di esecuzione, non solo al controllo dei tipi: il
# filtro della diagnostica lo usa in un `isinstance`, ed e' il punto in cui si
# decide cosa esce di casa. Sotto `TYPE_CHECKING` quel controllo sollevava un
# NameError alla prima segnalazione scritta.
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from collections.abc import Iterable

    from homeassistant.core import HomeAssistant

STORAGE_KEY = f"{DOMAIN}.tickets"
STORAGE_VERSION = 1
DATA_TICKET_STORE = "ticket_store"

#: Le tre cose che un utente vuole dire. La terza non e' una variante delle
#: altre due: una richiesta di assistenza porta il nome delle stanze e gli
#: entity_id dell'impianto, ed e' il materiale che in un tracker pubblico non
#: ci va. Il tipo decide dove il ticket puo' finire, non solo come si chiama.
TYPE_BUG = "bug"
TYPE_FEATURE = "feature"
TYPE_SUPPORT = "assistenza"
TICKET_TYPES = frozenset({TYPE_BUG, TYPE_FEATURE, TYPE_SUPPORT})

#: Lo stato locale. ``bozza`` e' scritto ma non ancora partito; gli altri
#: arrivano dalla console del manutentore e tornano indietro con la sync.
STATE_DRAFT = "bozza"
STATE_SENT = "inviato"
STATE_TRIAGED = "in-carico"
STATE_RESOLVED = "risolto"
STATE_CLOSED = "chiuso"
REMOTE_STATES = frozenset({STATE_SENT, STATE_TRIAGED, STATE_RESOLVED, STATE_CLOSED})
TICKET_STATES = REMOTE_STATES | {STATE_DRAFT}

#: Gli stati in cui un ticket e' considerato finito: sono i primi a cedere il
#: posto quando lo store e' pieno.
CLOSED_STATES = frozenset({STATE_RESOLVED, STATE_CLOSED})

MAX_TITLE = 120
MAX_BODY = 4000
MAX_REPLY = 4000
MAX_TICKETS = 100

#: Le sei per ora non sono un limite d'uso — nessuno scrive sei segnalazioni
#: in un'ora a mano — ma il tetto che trasforma un ciclo difettoso in un
#: rifiuto invece che in un disco pieno.
MAX_PER_HOUR = 6
HOUR_MS = 60 * 60 * 1000

#: La diagnostica che un ticket puo' portarsi dietro, per intero. Sono le cose
#: che la plancia sa e l'utente no — le stesse tre domande che i template su
#: GitHub fanno per prime, piu' la lingua in cui l'ha vista. Fuori da questa
#: lista non passa niente: non l'URL di Home Assistant, non le entita', non
#: l'utente, non la rete.
DIAGNOSTIC_KEYS = frozenset(
    {
        "integration_version",
        "ha_version",
        "installation_method",
        "locale",
        "panel_section",
        "user_agent",
    }
)
MAX_DIAGNOSTIC_VALUE = 190


class TicketRejected(ValueError):
    """Il ticket non e' accettabile: troppo lungo, vuoto o troppo frequente."""

    def __init__(self, code: str, message: str) -> None:
        """Tieni il codice, che il frontend usa per scegliere cosa dire."""
        super().__init__(message)
        self.code = code


def _clean(value: Any, limit: int) -> str:
    """Una riga di testo dell'utente, tagliata e senza caratteri di controllo."""
    if not isinstance(value, str):
        return ""
    # I caratteri di controllo non servono a niente in un titolo e rendono
    # illeggibile la console. Il ritorno a capo sopravvive solo nel corpo, che
    # ha il suo giro qui sotto.
    testo = "".join(ch for ch in value if ch >= " " or ch == "\n")
    return testo.strip()[:limit]


def normalize_diagnostics(raw: Mapping[str, Any] | None) -> dict[str, str]:
    """Tieni della diagnostica solo quello che e' stato dichiarato.

    Il filtro e' sulle chiavi, non sui valori: quello che nessuno ha previsto
    non passa, anche se arriva da un frontend piu' nuovo del backend. E' la
    direzione giusta in cui sbagliare, perche' questi dati escono di casa.
    """
    if not isinstance(raw, Mapping):
        return {}
    pulita: dict[str, str] = {}
    for chiave in sorted(DIAGNOSTIC_KEYS):
        if chiave not in raw:
            continue
        valore = _clean(raw[chiave], MAX_DIAGNOSTIC_VALUE).replace("\n", " ")
        if valore:
            pulita[chiave] = valore
    return pulita


def public_ticket(ticket: Mapping[str, Any]) -> dict[str, Any]:
    """Il ticket come lo vede la plancia di chi l'ha aperto.

    ``opened_by`` c'e' e resta in casa. Serve a due cose — mostrare a ognuno le
    proprie segnalazioni, e far vedere all'amministratore chi ha scritto cosa —
    e non compare da nessuna parte nel corpo che parte: ``tickets.py`` elenca i
    campi che spedisce uno per uno, e questo non e' fra quelli.
    """
    return {
        "id": ticket.get("id", ""),
        "opened_by": ticket.get("opened_by", ""),
        "type": ticket.get("type", TYPE_BUG),
        "title": ticket.get("title", ""),
        "body": ticket.get("body", ""),
        "state": ticket.get("state", STATE_DRAFT),
        "created_at": int(ticket.get("created_at", 0) or 0),
        "updated_at": int(ticket.get("updated_at", 0) or 0),
        "remote_id": ticket.get("remote_id", ""),
        "reply": ticket.get("reply", ""),
        "issue_url": ticket.get("issue_url", ""),
        "delivery_error": ticket.get("delivery_error", ""),
        "diagnostics": dict(ticket.get("diagnostics", {})),
    }


def _now_ms() -> int:
    from homeassistant.util import dt as dt_util

    return int(dt_util.utcnow().timestamp() * 1000)


class TicketStore:
    """Le segnalazioni di questa installazione, e il loro stato."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Aggancia lo store al deposito di Home Assistant."""
        from homeassistant.helpers.storage import Store

        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"installation_id": "", "tickets": []}
        self._loaded = False

    async def async_load(self) -> None:
        """Leggi il file una volta sola, e assegna l'identificativo se manca."""
        if self._loaded:
            return
        stored = await self._store.async_load()
        if isinstance(stored, dict):
            tickets = stored.get("tickets")
            self._data = {
                "installation_id": str(stored.get("installation_id") or ""),
                "tickets": tickets if isinstance(tickets, list) else [],
            }
        self._loaded = True
        buttato = self._butta_i_recapiti()
        if not self._data["installation_id"]:
            import uuid

            self._data["installation_id"] = uuid.uuid4().hex
            buttato = True
        if buttato:
            await self._async_save()

    def _butta_i_recapiti(self) -> bool:
        """Cancella dal disco i recapiti scritti dalle versioni precedenti.

        Il campo «come ricontattarti» c'era ma non lo leggeva nessuno: restava
        in casa — questo era vero — e la console del manutentore legge GitHub,
        dove il recapito non arriva. Chiedere un indirizzo e-mail per poi non
        farne niente e' la cosa peggiore fra le tre possibili: si conserva un
        dato personale, non serve a nessuno, e chi lo scrive crede di essere
        raggiungibile.

        Toglierlo dal modulo non basta: quello che e' gia' stato scritto sta
        sul disco di chi la plancia ce l'ha da mesi, e resterebbe li' finche'
        quel ticket non cade dal fondo dello store. Qui sparisce alla prima
        accensione della versione che l'ha tolto.
        """
        buttato = False
        for ticket in self._tickets():
            if "contact" in ticket:
                del ticket["contact"]
                buttato = True
        return buttato

    async def _async_save(self) -> None:
        await self._store.async_save(self._data)

    @property
    def installation_id(self) -> str:
        """L'identificativo casuale di questa installazione."""
        return str(self._data.get("installation_id") or "")

    def _tickets(self) -> list[dict[str, Any]]:
        tickets = self._data.setdefault("tickets", [])
        if not isinstance(tickets, list):  # pragma: no cover - file manomesso
            tickets = []
            self._data["tickets"] = tickets
        return tickets

    def _find(self, ticket_id: str) -> dict[str, Any] | None:
        for ticket in self._tickets():
            if ticket.get("id") == ticket_id:
                return ticket
        return None

    def list(self, *, opened_by: str = "", every: bool = False) -> list[dict[str, Any]]:
        """I ticket, dal piu' recente al piu' vecchio.

        Ognuno vede i propri; l'amministratore, che e' chi la plancia la
        governa, li vede tutti. In una casa con un utente solo non cambia
        niente; in una con quattro, la richiesta di assistenza di uno non e'
        materiale di lettura per gli altri tre.
        """
        scelti = [
            ticket
            for ticket in self._tickets()
            if every or ticket.get("opened_by", "") == opened_by
        ]
        ordinati = sorted(
            scelti,
            key=lambda ticket: int(ticket.get("created_at", 0) or 0),
            reverse=True,
        )
        return [public_ticket(ticket) for ticket in ordinati]

    def pending(self) -> list[dict[str, Any]]:
        """I ticket scritti che non sono ancora partiti."""
        return [
            public_ticket(ticket)
            for ticket in self._tickets()
            if ticket.get("state") == STATE_DRAFT
        ]

    def remote_ids(self, *, every: bool = False) -> list[str]:
        """Gli identificativi remoti di cui ha senso chiedere lo stato.

        Un ticket gia' chiuso non si richiede piu': la console non lo
        riaprira', e ogni giro di sync costa una richiesta.

        Con ``every`` ci sono anche i chiusi, e serve al campanello. Li' la
        domanda e' un'altra — non «cosa devo rileggere», ma «quali
        conversazioni sono mie» — e una risposta arrivata sotto una
        segnalazione chiusa la settimana prima e' esattamente il messaggio che
        non si vuole perdere. Non costa niente: quel giro e' una richiesta
        sola, e questo elenco serve solo a scartare le righe degli altri.
        """
        return [
            str(ticket.get("remote_id"))
            for ticket in self._tickets()
            if ticket.get("remote_id")
            and (every or ticket.get("state") not in CLOSED_STATES)
        ]

    def owns_remote(self, opened_by: str, remote_id: str) -> bool:
        """Se questa segnalazione, su GitHub, l'ha aperta proprio questo utente."""
        return any(
            str(ticket.get("remote_id")) == str(remote_id)
            and ticket.get("opened_by", "") == opened_by
            for ticket in self._tickets()
        )

    def _make_room(self) -> None:
        """Tieni lo store sotto il tetto, cedendo prima i ticket gia' chiusi."""
        tickets = self._tickets()
        if len(tickets) <= MAX_TICKETS:
            return

        # I chiusi piu' vecchi per primi; se non bastano, i piu' vecchi e basta.
        def eta(ticket: dict[str, Any]) -> tuple[int, int]:
            chiuso = 0 if ticket.get("state") in CLOSED_STATES else 1
            return (chiuso, int(ticket.get("created_at", 0) or 0))

        tickets.sort(key=eta)
        del tickets[: len(tickets) - MAX_TICKETS]

    def _too_frequent(self, now: int) -> bool:
        recenti = [
            ticket
            for ticket in self._tickets()
            if now - int(ticket.get("created_at", 0) or 0) < HOUR_MS
        ]
        return len(recenti) >= MAX_PER_HOUR

    async def async_create(
        self,
        *,
        ticket_type: str,
        title: str,
        body: str,
        diagnostics: Mapping[str, Any] | None = None,
        opened_by: str = "",
    ) -> dict[str, Any]:
        """Scrivi una segnalazione nuova, in stato ``bozza``."""
        if ticket_type not in TICKET_TYPES:
            raise TicketRejected("invalid_type", "Tipo di segnalazione sconosciuto.")
        titolo = _clean(title, MAX_TITLE).replace("\n", " ")
        corpo = _clean(body, MAX_BODY)
        if not titolo:
            raise TicketRejected("empty_title", "Il titolo non puo' essere vuoto.")
        if not corpo:
            raise TicketRejected("empty_body", "La descrizione non puo' essere vuota.")
        now = _now_ms()
        if self._too_frequent(now):
            raise TicketRejected(
                "too_frequent",
                "Troppe segnalazioni in poco tempo: riprova fra un'ora.",
            )
        import uuid

        ticket = {
            "id": uuid.uuid4().hex,
            "opened_by": _clean(opened_by, 64).replace("\n", ""),
            "type": ticket_type,
            "title": titolo,
            "body": corpo,
            "state": STATE_DRAFT,
            "created_at": now,
            "updated_at": now,
            "remote_id": "",
            "reply": "",
            "issue_url": "",
            "delivery_error": "",
            "diagnostics": normalize_diagnostics(diagnostics),
        }
        self._tickets().append(ticket)
        self._make_room()
        await self._async_save()
        return public_ticket(ticket)

    async def async_mark_sent(
        self, ticket_id: str, remote_id: str, *, issue_url: str = ""
    ) -> bool:
        """Segna che il ticket e' arrivato dall'altra parte.

        ``remote_id`` e' il numero della issue, e ``issue_url`` il suo
        indirizzo: si sanno tutti e due nello stesso istante, quando GitHub
        risponde, e tenerli separati vorrebbe dire una seconda scrittura per
        un dato che era gia' in mano.
        """
        ticket = self._find(ticket_id)
        if ticket is None:
            return False
        ticket["remote_id"] = str(remote_id or "")
        if issue_url.startswith("https://github.com/"):
            ticket["issue_url"] = issue_url[:400]
        ticket["state"] = STATE_SENT
        ticket["delivery_error"] = ""
        ticket["updated_at"] = _now_ms()
        await self._async_save()
        return True

    async def async_mark_failed(self, ticket_id: str, error: str) -> bool:
        """Registra perche' la consegna non e' riuscita, senza perdere il testo."""
        ticket = self._find(ticket_id)
        if ticket is None:
            return False
        ticket["delivery_error"] = _clean(error, 190).replace("\n", " ")
        ticket["updated_at"] = _now_ms()
        await self._async_save()
        return True

    async def async_merge_remote(self, updates: Iterable[Mapping[str, Any]]) -> int:
        """Porta a casa lo stato deciso dalla console. Torna quanti sono cambiati.

        Il rimando remoto puo' cambiare tre cose e nessun'altra: lo stato, la
        risposta del manutentore e il link alla issue pubblica se il ticket e'
        stato promosso. Titolo e corpo restano di chi li ha scritti — un
        servizio esterno non riscrive quello che c'e' nella plancia di casa.
        """
        per_remote = {
            str(ticket.get("remote_id")): ticket
            for ticket in self._tickets()
            if ticket.get("remote_id")
        }
        cambiati = 0
        for update in updates:
            if not isinstance(update, Mapping):
                continue
            ticket = per_remote.get(str(update.get("remote_id") or ""))
            if ticket is None:
                continue
            prima = (ticket.get("state"), ticket.get("reply"), ticket.get("issue_url"))
            stato = update.get("state")
            if stato in REMOTE_STATES:
                ticket["state"] = stato
            if "reply" in update:
                ticket["reply"] = _clean(update.get("reply"), MAX_REPLY)
            issue_url = update.get("issue_url")
            if isinstance(issue_url, str) and issue_url.startswith(
                "https://github.com/"
            ):
                ticket["issue_url"] = issue_url[:400]
            if prima != (ticket.get("state"), ticket.get("reply"), ticket["issue_url"]):
                ticket["updated_at"] = _now_ms()
                cambiati += 1
        if cambiati:
            await self._async_save()
        return cambiati

    async def async_delete(
        self, ticket_id: str, *, opened_by: str = "", every: bool = False
    ) -> bool:
        """Butta via un ticket: e' di chi l'ha scritto, e puo' ripensarci.

        Di chi l'ha scritto, per l'appunto: senza ``every`` nessuno cancella la
        segnalazione di un altro, e il rifiuto e' indistinguibile da «non
        esiste» — cosi' non si scopre nemmeno che c'e'.
        """
        tickets = self._tickets()
        rimasti = [
            ticket
            for ticket in tickets
            if ticket.get("id") != ticket_id
            or not (every or ticket.get("opened_by", "") == opened_by)
        ]
        if len(rimasti) == len(tickets):
            return False
        self._data["tickets"] = rimasti
        await self._async_save()
        return True


async def async_get_ticket_store(hass: HomeAssistant) -> TicketStore:
    """Lo store dei ticket di questa installazione, caricato una volta sola."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    store = domain_data.get(DATA_TICKET_STORE)
    if store is None:
        store = TicketStore(hass)
        domain_data[DATA_TICKET_STORE] = store
    await store.async_load()
    return store
