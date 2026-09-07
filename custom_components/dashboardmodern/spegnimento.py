"""Lo spegnimento programmato del clima: il conto alla rovescia sta in casa.

«Vorrei uno slider per decidere il tempo che un condizionatore debba restare
acceso dal momento che gli do l'on, utile spesso di notte o per accensioni a
spot» (#364).

La parte che conta non e' lo slider, e' **dove vive il conto alla rovescia**.
Un timer nel browser muore chiudendo la pagina, e chi accende il condizionatore
per due ore prima di dormire la pagina la chiude sempre: resterebbe acceso tutta
la notte, cioe' esattamente il contrario di quello che ha chiesto. Il timer
quindi lo tiene Home Assistant.

Tre scelte reggono il file.

* **La scadenza si scrive sul disco.** Un riavvio di Home Assistant nel mezzo
  della notte non deve lasciare acceso un condizionatore: all'avvio le scadenze
  si rileggono e si riarmano. Quelle gia' passate mentre era spento si eseguono
  subito — meglio spegnere in ritardo che non spegnere.
* **Lo spegnimento e' `homeassistant.turn_off`.** Un clima si spegne con
  `climate.turn_off`, ma nella casella dell'unita' puo' esserci anche uno
  `switch` o un `input_boolean` — e chiamare il servizio sbagliato vuol dire
  un timer che scade e non fa niente. `homeassistant.turn_off` sceglie da se'
  il dominio giusto, che e' la stessa cosa che fa il resto della plancia.
* **Il timer si annulla da solo quando l'unita' viene spenta a mano.** Chi
  spegne prima non deve ritrovarsi un timer appeso che, due ore dopo, spegne
  un'unita' che nel frattempo qualcun altro aveva riacceso.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

STORAGE_KEY = f"{DOMAIN}.spegnimenti"
STORAGE_VERSION = 1
DATA_SPEGNIMENTO = "spegnimento"

#: Il piu' corto e il piu' lungo che si possano chiedere, in minuti. Sono gli
#: stessi estremi dello slider in plancia: un valore fuori scala e' un errore
#: di chi chiama, non una richiesta da esaudire.
MIN_MINUTI = 1
MAX_MINUTI = 720

#: Quanti timer possono stare appesi insieme. Uno per unita' climatica, e le
#: unita' sono una decina: cento e' un fondo, non un limite che si tocca.
MAX_TIMER = 100


def _adesso(hass: HomeAssistant) -> float:
    """L'ora di Home Assistant, in millisecondi come la plancia li conta."""
    from homeassistant.util import dt as dt_util

    return dt_util.utcnow().timestamp() * 1000


class SpegnimentoStore:
    """Le scadenze appese, e i loro allarmi."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Aggancia lo store al deposito di Home Assistant."""
        from homeassistant.helpers.storage import Store

        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        #: entity_id -> scadenza in millisecondi.
        self._scadenze: dict[str, float] = {}
        #: entity_id -> la funzione che disarma l'allarme.
        self._allarmi: dict[str, Any] = {}
        #: La funzione che smette di seguire gli stati, quando c'e' da seguire.
        self._ascolto: Any = None
        self._caricato = False

    # ── memoria ─────────────────────────────────────────────────────────────

    async def async_load(self) -> None:
        """Rileggi le scadenze e rimetti in piedi gli allarmi."""
        if self._caricato:
            return
        self._caricato = True
        stored = await self._store.async_load()
        if isinstance(stored, dict):
            grezze = stored.get("scadenze")
            if isinstance(grezze, dict):
                for entita, scadenza in grezze.items():
                    if not isinstance(entita, str) or "." not in entita:
                        continue
                    try:
                        self._scadenze[entita] = float(scadenza)
                    except (TypeError, ValueError):
                        continue
        for entita in list(self._scadenze):
            self._arma(entita)
        self._ascolta()

    def _salva(self) -> None:
        """Scrivi con ritardo: una raffica di tocchi non e' una raffica di file."""
        self._store.async_delay_save(lambda: {"scadenze": dict(self._scadenze)}, 5)

    # ── allarmi ─────────────────────────────────────────────────────────────

    def _disarma(self, entita: str) -> None:
        """Togli l'allarme di quell'entita', se ce n'e' uno."""
        annulla = self._allarmi.pop(entita, None)
        if annulla is not None:
            annulla()

    def _arma(self, entita: str) -> None:
        """Metti l'allarme per la scadenza di quell'entita'.

        Una scadenza gia' passata — il riavvio nel mezzo della notte — non si
        butta: si esegue subito. Meglio spegnere in ritardo che non spegnere.
        """
        from homeassistant.helpers.event import async_call_later

        self._disarma(entita)
        scadenza = self._scadenze.get(entita)
        if scadenza is None:
            return
        fra = max(0.0, (scadenza - _adesso(self.hass)) / 1000)

        async def _scatta(_ora: Any) -> None:
            self._allarmi.pop(entita, None)
            await self.async_spegni(entita)

        self._allarmi[entita] = async_call_later(self.hass, fra, _scatta)

    # ── quello che la plancia chiede ────────────────────────────────────────

    def scadenze(self) -> dict[str, float]:
        """Le scadenze appese, cosi' come stanno."""
        return dict(self._scadenze)

    async def async_programma(self, entita: str, minuti: int) -> float | None:
        """Programma lo spegnimento di quell'entita' fra quei minuti.

        Zero minuti vuol dire «togli il timer»: e' come si annulla, e torna
        ``None`` perche' non c'e' nessuna scadenza da mostrare.
        """
        await self.async_load()
        if minuti <= 0:
            return await self.async_annulla(entita)
        minuti = max(MIN_MINUTI, min(int(minuti), MAX_MINUTI))
        if entita not in self._scadenze and len(self._scadenze) >= MAX_TIMER:
            # Il fondo: prima cede la scadenza piu' lontana, che e' quella che
            # ha ancora piu' tempo per essere rimessa.
            piu_lontana = max(self._scadenze, key=self._scadenze.__getitem__)
            self._disarma(piu_lontana)
            self._scadenze.pop(piu_lontana, None)
        self._scadenze[entita] = _adesso(self.hass) + minuti * 60_000
        self._arma(entita)
        self._salva()
        self._ascolta()
        return self._scadenze[entita]

    async def async_annulla(self, entita: str) -> None:
        """Togli il timer di quell'entita', senza toccare l'entita'."""
        await self.async_load()
        self._disarma(entita)
        if self._scadenze.pop(entita, None) is not None:
            self._salva()
            self._ascolta()
        return None

    async def async_spegni(self, entita: str) -> None:
        """La scadenza e' arrivata: spegni, e togli il timer.

        `homeassistant.turn_off` sceglie il dominio giusto da se': nella casella
        dell'unita' puo' esserci un `climate`, ma anche uno `switch` o un
        `input_boolean`, e un servizio sbagliato sarebbe un timer che scade
        senza spegnere niente.
        """
        self._disarma(entita)
        c_era = self._scadenze.pop(entita, None) is not None
        if c_era:
            self._salva()
            self._ascolta()
        stato = self.hass.states.get(entita)
        if stato is None:
            return
        await self.hass.services.async_call(
            "homeassistant", "turn_off", {"entity_id": entita}, blocking=False
        )

    # ── chi spegne a mano si porta via anche il timer ───────────────────────

    def _ascolta(self) -> None:
        """Segui le entita' che hanno un timer, e nessun'altra.

        Senza questo restava appeso un allarme che, due ore dopo, spegneva
        un'unita' che nel frattempo qualcun altro aveva riacceso: il timer
        appartiene a QUELLA accensione, e con lei finisce.
        """
        from homeassistant.helpers.event import async_track_state_change_event

        if self._ascolto is not None:
            self._ascolto()
            self._ascolto = None
        if not self._scadenze:
            return

        async def _cambiata(evento: Any) -> None:
            entita = evento.data.get("entity_id")
            nuovo_stato = evento.data.get("new_state")
            if entita not in self._scadenze:
                return
            # `None` e' l'entita' sparita, non spenta: un'integrazione che si
            # ricarica non deve buttare il timer di chi sta dormendo.
            if nuovo_stato is None or nuovo_stato.state in ("unknown", "unavailable"):
                return
            if nuovo_stato.state == "off":
                await self.async_annulla(entita)

        self._ascolto = async_track_state_change_event(
            self.hass, list(self._scadenze), _cambiata
        )


async def async_get_spegnimento_store(hass: HomeAssistant) -> SpegnimentoStore:
    """Lo store di questa installazione, caricato una volta sola."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    store = domain_data.get(DATA_SPEGNIMENTO)
    if store is None:
        store = SpegnimentoStore(hass)
        domain_data[DATA_SPEGNIMENTO] = store
    await store.async_load()
    return store
