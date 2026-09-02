"""Il campanello: qualcuno ha scritto, e lo si viene a sapere subito.

Il filo di una segnalazione e' gia' una conversazione nei due sensi — chi
segnala scrive, il manutentore risponde dalla console, la risposta torna dentro
la plancia di chi ha segnalato. Quello che mancava e' il campanello. Senza, la
conversazione funziona solo finche' uno dei due tiene la dashboard aperta e la
guarda: una domanda scritta alle nove resta muta fino a quando al manutentore
viene in mente di controllare, e la risposta scritta a mezzogiorno resta non
letta fino a quando chi ha chiesto ripassa di li'. Un canale che chiede di
essere sorvegliato a vista non e' un canale: e' una bacheca.

Qui c'e' il campanello, e sono tre scelte.

* **Una richiesta ogni cinque minuti, non venti.** Rileggere una per una le
  segnalazioni aperte sarebbe stato duecentoquaranta richieste all'ora per
  sentirsi dire quasi sempre «non e' cambiato niente». L'elenco filtrato per
  `since` costa dodici richieste all'ora in tutto e porta gia' il numero dei
  commenti: se e' cresciuto, qualcuno ha scritto.

* **Il taccuino sta su disco.** Quanti commenti si erano gia' visti, per ogni
  segnalazione. Tenerlo in memoria avrebbe voluto dire che ogni riavvio di
  Home Assistant suonava di nuovo per messaggi gia' letti — e Home Assistant
  si riavvia a ogni aggiornamento, cioe' spesso.

* **I propri messaggi non suonano.** Quando la plancia scrive un commento — la
  risposta del manutentore, il messaggio di chi ha segnalato — alza il segno
  di uno da se'. Il campanello e' per quello che scrivono gli altri: sentire
  suonare per una frase appena battuta sarebbe stato l'unico modo sicuro di
  farlo spegnere a tutti.

Quello che il campanello suona e' doppio, apposta. Un evento sul bus per chi
vuole decidersi da se' cosa succede — il telefono, un altoparlante, una luce
che cambia colore — e una notifica di Home Assistant, quella della campanella,
per chi automazioni non ne scrive e la vuole lo stesso.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

    from homeassistant.core import HomeAssistant

STORAGE_KEY = f"{DOMAIN}.messages"
STORAGE_VERSION = 1
DATA_WATCH = "ticket_watch"

#: Quante segnalazioni restano nel taccuino. Il numero di una issue cresce
#: sempre, quindi «le piu' recenti» sono «le piu' alte» e non serve nessuna
#: data per sfoltire: si tengono quelle, e le vecchie escono. Una segnalazione
#: caduta fuori dal taccuino che ricevesse un commento suona una volta di
#: troppo, ed e' il verso giusto in cui sbagliare.
MAX_SEGNI = 300

#: Quante conversazioni non lette si tengono in elenco. Cinquanta e' gia' una
#: giornata storta: oltre, il numero smette di dire qualcosa e comincia solo a
#: crescere.
MAX_NON_LETTE = 50


class TicketWatch:
    """Il taccuino di quello che si e' gia' letto."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Aggancia il taccuino al deposito di Home Assistant."""
        from homeassistant.helpers.storage import Store

        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"since": "", "seen": {}, "nuovi": {}}
        self._loaded = False

    async def async_load(self) -> None:
        """Leggi il file una volta sola."""
        if self._loaded:
            return
        stored = await self._store.async_load()
        if isinstance(stored, dict):
            seen = stored.get("seen")
            nuovi = stored.get("nuovi")
            self._data = {
                "since": str(stored.get("since") or ""),
                "seen": {
                    str(numero): int(quanti or 0)
                    for numero, quanti in (
                        seen.items() if isinstance(seen, dict) else ()
                    )
                    if str(numero).isdigit()
                },
                "nuovi": {
                    str(numero): voce
                    for numero, voce in (
                        nuovi.items() if isinstance(nuovi, dict) else ()
                    )
                    if str(numero).isdigit() and isinstance(voce, dict)
                },
            }
        self._loaded = True

    async def _async_save(self) -> None:
        await self._store.async_save(self._data)

    @property
    def since(self) -> str:
        """Il momento da cui chiedere. Vuoto la primissima volta."""
        return str(self._data.get("since") or "")

    @property
    def acceso(self) -> bool:
        """Se il campanello ha gia' fatto almeno un giro.

        Il primo giro non suona mai: chiede senza `since`, quindi si porta a
        casa le segnalazioni aperte com'e' giusto, ma sono tutte cose gia'
        successe. Suonare li' avrebbe voluto dire venti notifiche in fila al
        primo avvio, per messaggi di settimane prima.
        """
        return bool(self.since)

    def _seen(self) -> dict[str, int]:
        seen = self._data.setdefault("seen", {})
        if not isinstance(seen, dict):  # pragma: no cover - file manomesso
            seen = {}
            self._data["seen"] = seen
        return seen

    def nuovi(
        self, righe: Iterable[Mapping[str, Any]], *, mie: set[str] | None
    ) -> list[dict[str, Any]]:
        """Cosa e' arrivato, fra le righe che GitHub ha appena elencato.

        ``mie`` e' l'elenco delle segnalazioni che riguardano chi guarda:
        ``None`` vuol dire «tutte», ed e' il caso del manutentore, che la
        repository la tiene lui. Chi invece la plancia la usa e basta sente
        suonare solo per le proprie — le altre sono conversazioni fra
        sconosciuti, e riceverle sarebbe stato ricevere lo spam di un tracker.

        Non tocca il taccuino. Segnare cosa si e' visto e' un gesto separato,
        e succede dopo, perche' fra il leggere e lo scrivere ci sta una
        chiamata che puo' fallire: se fallisse dopo aver segnato, il messaggio
        risulterebbe letto senza che nessuno l'abbia sentito.
        """
        seen = self._seen()
        acceso = self.acceso
        fuori: list[dict[str, Any]] = []
        for riga in righe:
            numero = str(riga.get("number") or "")
            if not numero.isdigit() or numero == "0":
                continue
            if mie is not None and numero not in mie:
                continue
            quanti = int(riga.get("comments") or 0)
            prima = seen.get(numero)
            if prima is None:
                # Mai vista. Al primo giro non e' una novita' — e' il passato —
                # e dopo lo e': una segnalazione appena aperta, oppure una
                # vecchia che il taccuino aveva lasciato cadere.
                if not acceso:
                    continue
                arrivati = quanti or 1
                apertura = quanti == 0
            elif quanti > prima:
                arrivati = quanti - prima
                apertura = False
            else:
                continue
            fuori.append(
                {
                    "number": int(numero),
                    "title": str(riga.get("title") or ""),
                    "issue_url": str(riga.get("issue_url") or ""),
                    "state": str(riga.get("state") or "open"),
                    "author": str(riga.get("author") or ""),
                    "origin": str(riga.get("origin") or ""),
                    "messages": arrivati,
                    # Se la novita' e' la segnalazione stessa o un messaggio
                    # sotto una che c'era gia'. Chi legge la notifica vuole
                    # sapere questo prima di tutto il resto.
                    "opened": apertura,
                }
            )
        return fuori

    async def async_ricorda(
        self, righe: Iterable[Mapping[str, Any]], *, adesso: str = ""
    ) -> None:
        """Segna quello che si e' visto, e da dove ripartire il giro dopo.

        Il momento da cui ripartire e' il piu' recente fra quelli che GitHub ha
        appena mandato, non l'ora di casa: gli orologi non sono d'accordo, e
        un orologio avanti di un minuto avrebbe saltato tutto quello che
        succede in quel minuto. Se non e' arrivato niente resta quello di
        prima; se non c'e' nemmeno quello — la primissima accensione senza
        nessuna segnalazione — vale ``adesso``, che serve solo ad accendere il
        campanello per il giro successivo.
        """
        seen = self._seen()
        piu_recente = self.since
        for riga in righe:
            numero = str(riga.get("number") or "")
            if not numero.isdigit() or numero == "0":
                continue
            seen[numero] = int(riga.get("comments") or 0)
            quando = str(riga.get("updated_at") or "")
            if quando > piu_recente:
                piu_recente = quando
        self._data["since"] = piu_recente or adesso
        self._sfoltisci()
        await self._async_save()

    def _nuovi(self) -> dict[str, Any]:
        nuovi = self._data.setdefault("nuovi", {})
        if not isinstance(nuovi, dict):  # pragma: no cover - file manomesso
            nuovi = {}
            self._data["nuovi"] = nuovi
        return nuovi

    def non_lette(self) -> list[dict[str, Any]]:
        """Le conversazioni dove qualcuno ha scritto e nessuno ha ancora letto.

        Il campanello suona e passa: e' un evento, e un evento non si puo'
        guardare mezz'ora dopo. Questo invece resta, ed e' quello che il widget
        mostra a chi apre la plancia dopo che il telefono ha vibrato — o dopo
        che il telefono non era in tasca.

        In ordine, la piu' recente per ultima: e' l'ordine di una
        conversazione, non di una classifica.
        """
        voci = [
            {
                "number": int(numero),
                "title": str(voce.get("title") or ""),
                "messages": int(voce.get("messages") or 1),
                "at": str(voce.get("at") or ""),
                "opened": bool(voce.get("opened")),
            }
            for numero, voce in self._nuovi().items()
        ]
        return sorted(voci, key=lambda voce: (voce["at"], voce["number"]))

    async def async_segna_nuovi(
        self, nuovi: Iterable[Mapping[str, Any]], *, quando: str = ""
    ) -> None:
        """Metti in elenco quello per cui il campanello ha appena suonato.

        Due messaggi sotto la stessa segnalazione fanno una riga sola, con il
        conto che sale: chi guarda vuole sapere quante **conversazioni** lo
        aspettano, non quante frasi. Sono due domande diverse, e la seconda la
        risponde il filo quando lo si apre.
        """
        elenco = self._nuovi()
        cambiato = False
        for voce in nuovi:
            numero = str(int(voce.get("number") or 0))
            if numero == "0":
                continue
            gia = elenco.get(numero)
            quanti = int(voce.get("messages") or 1)
            elenco[numero] = {
                "title": str(voce.get("title") or ""),
                "messages": (int(gia.get("messages") or 0) if gia else 0) + quanti,
                "at": quando or str(voce.get("at") or ""),
                "opened": bool(voce.get("opened")) or bool(gia and gia.get("opened")),
            }
            cambiato = True
        if not cambiato:
            return
        if len(elenco) > MAX_NON_LETTE:
            tenute = sorted(elenco, key=int, reverse=True)[:MAX_NON_LETTE]
            self._data["nuovi"] = {numero: elenco[numero] for numero in tenute}
        await self._async_save()

    async def async_letta(self, number: int) -> bool:
        """Il filo e' stato aperto: quella conversazione non e' piu' da leggere.

        Si segna qui e non nel browser perche' le plance sono piu' di una: chi
        legge la risposta dal telefono e poi passa davanti al tablet in cucina
        non deve ritrovare lo stesso pallino ad aspettarlo.
        """
        if self._nuovi().pop(str(int(number)), None) is None:
            return False
        await self._async_save()
        return True

    async def async_ho_scritto(self, number: int) -> None:
        """Il messaggio l'ho scritto io: alza il segno, cosi' non suona.

        Uno, e non «quanti ne sono adesso»: saperlo vorrebbe dire rileggere la
        segnalazione, cioe' una richiesta in piu' per ogni risposta scritta. Se
        nello stesso istante avesse scritto anche qualcun altro, quel messaggio
        non suona — ma il prossimo si', e nel frattempo il filo e' aperto
        davanti agli occhi di chi ha appena risposto.
        """
        numero = str(int(number))
        seen = self._seen()
        seen[numero] = seen.get(numero, 0) + 1
        self._sfoltisci()
        await self._async_save()

    def _sfoltisci(self) -> None:
        """Tieni il taccuino sotto il tetto: restano i numeri piu' alti."""
        seen = self._seen()
        if len(seen) <= MAX_SEGNI:
            return
        tenuti = sorted(seen, key=int, reverse=True)[:MAX_SEGNI]
        self._data["seen"] = {numero: seen[numero] for numero in tenuti}


async def async_get_watch(hass: HomeAssistant) -> TicketWatch:
    """Il taccuino del campanello, caricato una volta sola."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    watch = domain_data.get(DATA_WATCH)
    if watch is None:
        watch = TicketWatch(hass)
        domain_data[DATA_WATCH] = watch
    await watch.async_load()
    return watch
