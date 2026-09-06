"""La casa che sembra abitata quando non c'e' nessuno.

«E' possibile creare un cruscotto per emulare la presenza in casa quando si e'
via? Io l'ho creata chiamandola Presenza in Casa e funziona cosi': quando
l'allarme e' inserito e dopo che il sole tramonta, le tapparelle si abbassano
random e idem le luci, dove si accendono per random secondi in casa, cosi' da
simulare la nostra presenza in casa.» (#290)

Una simulazione della presenza non puo' vivere nel browser: chi e' via la
plancia non ce l'ha aperta. Vive qui, in Home Assistant, e si accende con un
interruttore — «Presenza simulata» — che si mette dove si vuole: fra le azioni
rapide della plancia, in un'automazione, in una scena di partenza.

Le luci e le tapparelle non si configurano una seconda volta: sono quelle che
la plancia ha gia', lette dal negozio condiviso. Chi cambia casa nella plancia
cambia casa anche qui.

Le regole, tutte scritte perche' una casa finta che si comporta male e' peggio
di una casa spenta:

- si muove solo di sera, dal buio fino all'ora in cui si va a dormire: una luce
  che si accende alle quattro del mattino non dice «c'e' qualcuno», dice «c'e'
  un computer»;
- accende poche luci per volta, una alla volta, e le tiene accese per un tempo
  che cambia — quello che fa una persona che gira per casa;
- spegne SOLO le luci che ha acceso lei. Se qualcuno e' in casa e accende la
  cucina, la cucina resta accesa: la simulazione non litiga con le persone;
- le tapparelle le chiude al buio, una per giro, e riapre al mattino soltanto
  quelle che ha chiuso lei;
- quando si spegne — a mano, o all'ora di dormire — rimette tutto com'era.

Il modulo e' fatto di due pezzi: le decisioni, che sono funzioni pure e si
provano senza Home Assistant, e il motore, che le esegue.
"""

from __future__ import annotations

import json
import logging
import random
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

# Le chiavi della plancia da cui si leggono le stanze illuminate e le
# tapparelle: sono le stesse che l'editor scrive, non una copia.
CHIAVE_LUCI = "cd_luci"
CHIAVE_TAPPARELLE = "cd_tapparelle"

# Ogni quanto la casa decide se fare qualcosa. Cinque minuti sono il passo di
# una persona che si sposta da una stanza all'altra; piu' fitto sarebbe una
# discoteca, piu' rado una casa che lampeggia una volta a sera.
GIRO = timedelta(minutes=5)

# Quante luci puo' tenere accese insieme, e per quanto. Tre stanze illuminate
# sono una famiglia in casa; dieci sono una vetrina.
ACCESE_INSIEME = 3
MINIMO_ACCESA = timedelta(minutes=8)
MASSIMO_ACCESA = timedelta(minutes=35)

# Quante volte, su un giro, la casa si muove davvero. Meno di uno perche' una
# casa vera non cambia stanza ogni cinque minuti esatti.
PROBABILITA = 0.45

# L'ora in cui la casa va a dormire, e quella in cui si sveglia: fra le due la
# simulazione non tocca niente e lascia tutto spento.
ORA_DI_DORMIRE = 23
ORA_DELLA_SVEGLIA = 7


def _elenco(valori: Mapping[str, Any], chiave: str) -> Any:
    """Il valore di una chiave della plancia, che e' scritto come testo JSON."""
    grezzo = valori.get(chiave)
    if isinstance(grezzo, (dict, list)):
        return grezzo
    if not isinstance(grezzo, str) or not grezzo.strip():
        return None
    try:
        return json.loads(grezzo)
    except ValueError:
        return None


def _entita(valore: Any) -> str:
    testo = str(valore or "").strip()
    return testo if "." in testo else ""


def luci_della_plancia(valori: Mapping[str, Any]) -> list[str]:
    """Le luci configurate nella plancia, in ordine.

    L'editor le tiene come una mappa «entita' → nome»; chi ha messo un
    interruttore al posto di una lampadina lo trova qui accanto alle altre,
    ed e' giusto cosi': per la simulazione una luce e' tutto cio' che si
    accende e si vede da fuori.
    """
    mappa = _elenco(valori, CHIAVE_LUCI)
    if isinstance(mappa, dict):
        return [chiave for chiave in mappa if _entita(chiave)]
    if isinstance(mappa, list):
        return [
            _entita(voce.get("entity") if isinstance(voce, dict) else voce)
            for voce in mappa
            if _entita(voce.get("entity") if isinstance(voce, dict) else voce)
        ]
    return []


def tapparelle_della_plancia(valori: Mapping[str, Any]) -> list[str]:
    """Le tapparelle configurate nella plancia, in ordine."""
    elenco = _elenco(valori, CHIAVE_TAPPARELLE)
    if not isinstance(elenco, list):
        return []
    return [
        _entita(voce.get("entity") if isinstance(voce, dict) else voce)
        for voce in elenco
        if _entita(voce.get("entity") if isinstance(voce, dict) else voce)
    ]


@dataclass(frozen=True)
class Mossa:
    """Una cosa sola da fare adesso: nessuna casa fa due gesti insieme."""

    azione: str  # accendi | spegni | chiudi | apri
    entity: str


def e_sera(adesso: datetime, buio: bool) -> bool:
    """Se questa e' l'ora in cui una casa abitata si vede da fuori."""
    if not buio:
        return False
    return ORA_DELLA_SVEGLIA <= adesso.hour < ORA_DI_DORMIRE


def durata_accensione(caso: random.Random) -> timedelta:
    """Per quanto resta accesa questa luce: un tempo che non si ripete."""
    minimo = int(MINIMO_ACCESA.total_seconds())
    massimo = int(MASSIMO_ACCESA.total_seconds())
    return timedelta(seconds=caso.randint(minimo, massimo))


def prossima_mossa(
    *,
    luci_spente: list[str],
    accese: Mapping[str, datetime],
    tapparelle_aperte: list[str],
    chiuse_da_noi: Mapping[str, datetime],
    adesso: datetime,
    buio: bool,
    caso: random.Random,
) -> Mossa | None:
    """La mossa di questo giro, o niente.

    L'ordine non e' un dettaglio: prima si rimette a posto quello che e'
    scaduto, poi si fa qualcosa di nuovo. Al contrario la casa accumulerebbe
    luci accese fino al tetto e non le spegnerebbe mai.
    """
    # Giorno, o notte fonda: la casa dorme e quello che ha acceso lo spegne.
    if not e_sera(adesso, buio):
        scaduta = next(iter(sorted(accese)), None)
        if scaduta:
            return Mossa("spegni", scaduta)
        # Le tapparelle chiuse dalla simulazione si riaprono col giorno, non
        # nel cuore della notte: una casa che apre alle tre non e' abitata.
        if not buio and chiuse_da_noi:
            return Mossa("apri", next(iter(sorted(chiuse_da_noi))))
        return None

    scaduta = next(
        (entity for entity, fino in sorted(accese.items()) if fino <= adesso), None
    )
    if scaduta:
        return Mossa("spegni", scaduta)

    if caso.random() > PROBABILITA:
        return None

    # Le tapparelle si chiudono per prime, come farebbe chi rientra al buio.
    if tapparelle_aperte:
        return Mossa("chiudi", caso.choice(sorted(tapparelle_aperte)))

    if len(accese) >= ACCESE_INSIEME or not luci_spente:
        return None
    return Mossa("accendi", caso.choice(sorted(luci_spente)))


class SimulazionePresenza:
    """Il motore: legge la casa, chiede la mossa, la esegue.

    Tiene per se' solo quello che ha fatto — le luci che ha acceso e le
    tapparelle che ha chiuso — perche' e' l'unica cosa che gli da' il diritto
    di rimetterle a posto.
    """

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.attiva = False
        self._ferma_il_giro: Any = None
        self._accese: dict[str, datetime] = {}
        self._chiuse: dict[str, datetime] = {}
        self._caso = random.Random()

    async def _valori(self) -> Mapping[str, Any]:
        """La configurazione della plancia, com'e' salvata adesso."""
        from .config_store import async_get_config_store

        store = await async_get_config_store(self.hass)
        risposta = await store.async_get("", entry_id=self.entry_id)
        snapshot = risposta.get("snapshot") or {}
        valori = snapshot.get("values")
        return valori if isinstance(valori, dict) else {}

    def _buio(self) -> bool:
        """Se il sole e' sotto l'orizzonte, come lo dice Home Assistant.

        Senza l'entita' del sole — capita in prova — si guarda l'orologio: fra
        le nove di sera e le sette del mattino e' buio dappertutto.
        """
        sole = self.hass.states.get("sun.sun")
        if sole is not None:
            return str(sole.state) == "below_horizon"
        ora = dt_util.now().hour
        return ora >= 21 or ora < ORA_DELLA_SVEGLIA

    def _stato(self, entity: str) -> str:
        stato = self.hass.states.get(entity)
        return str(stato.state) if stato else ""

    async def async_accendi(self) -> None:
        """Da qui in poi la casa si muove da sola."""
        if self.attiva:
            return
        self.attiva = True
        self._ferma_il_giro = async_track_time_interval(
            self.hass, self._async_giro, GIRO
        )
        # Il primo giro si fa subito: chi accende la simulazione uscendo di
        # casa non deve aspettare cinque minuti per vedere che funziona.
        await self._async_giro(dt_util.now())

    async def async_spegni(self) -> None:
        """Si torna com'era: si spegne quello che si e' acceso."""
        if self._ferma_il_giro is not None:
            self._ferma_il_giro()
            self._ferma_il_giro = None
        self.attiva = False
        await self._async_rimetti_a_posto()

    async def _async_rimetti_a_posto(self) -> None:
        for entity in sorted(self._accese):
            await self._async_servizio(entity, "turn_off")
        self._accese.clear()
        for entity in sorted(self._chiuse):
            await self._async_servizio(entity, "open_cover")
        self._chiuse.clear()

    async def _async_servizio(self, entity: str, servizio: str) -> None:
        dominio = entity.split(".", 1)[0]
        try:
            await self.hass.services.async_call(
                dominio, servizio, {"entity_id": entity}, blocking=False
            )
        except Exception:  # noqa: BLE001 - un'entita' sparita non ferma la casa
            _LOGGER.debug("presenza simulata: %s su %s non riuscito", servizio, entity)

    async def _async_giro(self, adesso: datetime | None = None) -> None:
        """Un giro: si guarda la casa, si chiede la mossa, si esegue."""
        if not self.attiva:
            return
        momento = adesso or dt_util.now()
        valori = await self._valori()
        luci = luci_della_plancia(valori)
        tapparelle = tapparelle_della_plancia(valori)
        # Quello che qualcun altro ha spento nel frattempo non e' piu' nostro:
        # riaccenderlo sarebbe litigare con chi e' in casa.
        for entity in list(self._accese):
            if self._stato(entity) != "on":
                self._accese.pop(entity, None)
        mossa = prossima_mossa(
            luci_spente=[
                entity
                for entity in luci
                if entity not in self._accese and self._stato(entity) in ("off", "")
            ],
            accese=self._accese,
            tapparelle_aperte=[
                entity
                for entity in tapparelle
                if entity not in self._chiuse and self._stato(entity) == "open"
            ],
            chiuse_da_noi=self._chiuse,
            adesso=momento,
            buio=self._buio(),
            caso=self._caso,
        )
        if mossa is None:
            return
        if mossa.azione == "accendi":
            self._accese[mossa.entity] = momento + durata_accensione(self._caso)
            await self._async_servizio(mossa.entity, "turn_on")
        elif mossa.azione == "spegni":
            self._accese.pop(mossa.entity, None)
            await self._async_servizio(mossa.entity, "turn_off")
        elif mossa.azione == "chiudi":
            self._chiuse[mossa.entity] = momento
            await self._async_servizio(mossa.entity, "close_cover")
        elif mossa.azione == "apri":
            self._chiuse.pop(mossa.entity, None)
            await self._async_servizio(mossa.entity, "open_cover")
