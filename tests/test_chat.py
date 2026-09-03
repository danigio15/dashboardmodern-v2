"""La chat di assistenza: privata, anonima, e che non suona per se' stessa.

Cinque cose sono facili da sbagliare qui, e sono tutte cose che si scoprirebbero
solo in casa d'altri.

* **L'identita' nasce quando serve, e non prima.** Chi la chat non l'ha mai
  aperta non deve aver lasciato niente da nessuna parte.
* **Il segreto non esce di casa.** Fuori ne va l'impronta, e il browser non lo
  vede in nessun momento — di qui passa la domanda, non la chiave.
* **Il campanello suona per gli altri.** La propria frase, appena battuta, non
  deve far suonare niente: e' il modo sicuro di farlo spegnere a tutti.
* **Cancellare cancella davvero**, anche dal centralino: e' scritto nella
  plancia prima che qualcuno scriva la prima riga.
* **Chi non ha la chiave non risponde a nessuno.** La console della chat non si
  deduce, si ha o non si ha.

Il centralino non viene mai chiamato davvero: al suo posto c'e' `_chiama`.
"""

from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import chat
from custom_components.dashboardmodern.chat_client import ChatError
from custom_components.dashboardmodern.chat_store import async_get_chat_store
from custom_components.dashboardmodern.const import (
    DOMAIN,
    EVENT_CHAT_MESSAGE,
    OPTION_CHAT_CONSOLE_KEY,
)

CENTRALINO = "https://centralino.esempio.workers.dev"


class FintoCentralino:
    """Il centralino, senza rete: tiene le linee e i messaggi in memoria.

    Risponde come quello vero — gli stessi corpi, gli stessi codici — perche' a
    dover essere provato e' il giro intero, non che le funzioni si chiamino fra
    loro.
    """

    def __init__(self) -> None:
        self.linee: dict[str, list[dict[str, Any]]] = {}
        self.segreti: dict[str, str] = {}
        self.note: dict[str, dict[str, str]] = {}
        self.chiamate: list[tuple[str, str]] = []
        self.prossimo = 1
        # Quanti ne da' per volta, come il centralino vero.
        self.pagina = 100
        self.guasto: ChatError | None = None

    async def __call__(
        self,
        hass: Any,
        metodo: str,
        via: str,
        *,
        chiave: str,
        intestazioni: Any = None,
        corpo: Any = None,
    ) -> Any:
        self.chiamate.append((metodo, via))
        if self.guasto is not None:
            raise self.guasto
        testate = dict(intestazioni or {})
        if via.startswith("/casa/"):
            return await self._casa(metodo, via, chiave, testate, corpo or {})
        return await self._console(metodo, via, chiave, corpo or {})

    async def _casa(
        self, metodo: str, via: str, segreto: str, testate: dict, corpo: dict
    ) -> Any:
        casa = str(testate.get("X-Casa") or "")
        if casa in self.segreti and self.segreti[casa] != segreto:
            raise ChatError("forbidden", "Il centralino ha rifiutato.")
        if metodo == "POST":
            if casa not in self.segreti:
                self.segreti[casa] = segreto
                self.linee[casa] = []
            self.note[casa] = {k: v for k, v in testate.items() if k.startswith("X-")}
            messaggio = {
                "id": self.prossimo,
                "da": "casa",
                "testo": str(corpo.get("testo") or ""),
                "scritto_il": 1000 + self.prossimo,
            }
            self.prossimo += 1
            self.linee[casa].append(messaggio)
            return {"messaggio": messaggio}
        if metodo == "DELETE":
            self.linee.pop(casa, None)
            self.segreti.pop(casa, None)
            return {"cancellata": True}
        if casa not in self.segreti:
            return {"messaggi": [], "aperta": False}
        dopo = int(via.split("dopo=")[-1] or 0)
        return {
            "messaggi": [m for m in self.linee[casa] if m["id"] > dopo],
            "aperta": True,
        }

    async def _console(self, metodo: str, via: str, chiave: str, corpo: dict) -> Any:
        pezzi = via.split("?")[0].strip("/").split("/")
        if len(pezzi) == 2:
            return {
                "conversazioni": [
                    {
                        "id": casa,
                        "non_letti": len(righe),
                        "ultimo": righe[-1]["testo"] if righe else "",
                    }
                    for casa, righe in self.linee.items()
                ]
            }
        linea = pezzi[2]
        if metodo == "POST":
            messaggio = {
                "id": self.prossimo,
                "da": "console",
                "testo": str(corpo.get("testo") or ""),
                "scritto_il": 1000 + self.prossimo,
            }
            self.prossimo += 1
            self.linee.setdefault(linea, []).append(messaggio)
            return {"messaggio": messaggio}
        dopo = int(via.split("dopo=")[-1] or 0) if "dopo=" in via else 0
        righe = [m for m in self.linee.get(linea, []) if m["id"] > dopo]
        return {"messaggi": righe[: self.pagina]}

    # ── comodita' per le prove ───────────────────────────────────────────
    def risponde(self, casa: str, testo: str) -> None:
        """Come se il manutentore avesse scritto dalla sua parte."""
        messaggio = {
            "id": self.prossimo,
            "da": "console",
            "testo": testo,
            "scritto_il": 1000 + self.prossimo,
        }
        self.prossimo += 1
        self.linee.setdefault(casa, []).append(messaggio)


@pytest.fixture
def centralino(monkeypatch: pytest.MonkeyPatch) -> FintoCentralino:
    """La porta finta verso il centralino, e un indirizzo che lo accende."""
    from custom_components.dashboardmodern import chat_client

    finto = FintoCentralino()
    monkeypatch.setattr(chat_client, "_chiama", finto)
    monkeypatch.setattr(chat_client, "CHAT_CENTRALINO", CENTRALINO)
    monkeypatch.setattr(chat_client, "configurato", lambda: True)
    monkeypatch.setattr(chat, "configurato", lambda: True)
    return finto


def _entry(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, data={"name": "Plancia", "primary": True}, options=options
    )
    entry.add_to_hass(hass)
    return entry


def _ascolta(hass: HomeAssistant) -> list[dict[str, Any]]:
    suonate: list[dict[str, Any]] = []
    hass.bus.async_listen(
        EVENT_CHAT_MESSAGE, lambda evento: suonate.append(evento.data)
    )
    return suonate


def _campanelle(hass: HomeAssistant) -> list[str]:
    avvisi = persistent_notification._async_get_or_create_notifications(hass)
    return sorted(avvisi)


# ─── L'identita' della casa ──────────────────────────────────────────────────


async def test_chi_non_ha_mai_scritto_non_ha_nessuna_identita(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """L'identita' nasce col primo messaggio, non con l'installazione."""
    _entry(hass)
    store = await async_get_chat_store(hass)
    assert store.aperta() is False
    stato = await chat.async_stato(hass)
    assert stato["opened"] is False
    assert centralino.chiamate == []


async def test_l_identita_nasce_una_volta_sola_e_non_dice_niente_di_nessuno(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    _entry(hass)
    await chat.async_scrivi(hass, "ciao")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    assert identita["casa"].startswith("casa_")
    # 128 bit di caso: `casa_` piu' trentadue cifre esadecimali.
    assert len(identita["casa"]) == len("casa_") + 32
    assert len(identita["segreto"]) == 64
    await chat.async_scrivi(hass, "di nuovo")
    assert (await store.async_identita()) == identita


async def test_il_segreto_di_una_casa_non_apre_quella_di_un_altra(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """La prova che il centralino distingue davvero le case."""
    _entry(hass)
    await chat.async_scrivi(hass, "la mia")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    from custom_components.dashboardmodern import chat_client

    with pytest.raises(ChatError):
        await chat_client.async_leggi(
            hass, {"casa": identita["casa"], "segreto": "un-altro-segreto"}
        )


# ─── Scrivere e leggere ──────────────────────────────────────────────────────


async def test_il_primo_messaggio_apre_la_conversazione(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    _entry(hass)
    await chat.async_scrivi(hass, "non mi si vede la temperatura")
    filo = await chat.async_conversazione(hass)
    assert [riga["testo"] for riga in filo["messages"]] == [
        "non mi si vede la temperatura"
    ]


async def test_la_risposta_arriva_dentro_la_plancia(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    _entry(hass)
    await chat.async_scrivi(hass, "come faccio?")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    centralino.risponde(identita["casa"], "dalla scheda Stanze")
    filo = await chat.async_conversazione(hass)
    assert [(r["da"], r["testo"]) for r in filo["messages"]] == [
        ("casa", "come faccio?"),
        ("console", "dalla scheda Stanze"),
    ]


async def test_un_invio_senza_rilettura_non_scavalca_il_segnalibro(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Il ramo del guasto non rimette il difetto che l'altro ha tolto.

    Se il messaggio parte e la rilettura subito dopo non riesce, mettere in
    copia la sola frase appena scritta sposterebbe il segnalibro oltre una
    risposta ancora da leggere: lo stesso buco, nel ramo dove nessuno guarda.
    Meglio non scrivere niente e lasciare che il giro dei cinque minuti porti
    indietro tutto quanto, nell'ordine giusto.
    """
    _entry(hass)
    await chat.async_scrivi(hass, "prima")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    segnalibro = store.ultimo()
    centralino.risponde(identita["casa"], "una risposta in sospeso")

    # L'invio riesce, la rilettura no: si rompe solo la seconda.
    vera = centralino.__call__

    async def rompi_la_rilettura(casa: Any, metodo: str, via: str, **resto: Any) -> Any:
        if metodo == "GET":
            raise ChatError("unreachable", "Centralino non raggiungibile.")
        return await vera(casa, metodo, via, **resto)

    from custom_components.dashboardmodern import chat_client

    chat_client._chiama = rompi_la_rilettura
    try:
        await chat.async_scrivi(hass, "seconda")
    finally:
        chat_client._chiama = vera

    assert store.ultimo() == segnalibro, "il segnalibro e' avanzato al buio"
    filo = await chat.async_conversazione(hass)
    assert [riga["testo"] for riga in filo["messages"]] == [
        "prima",
        "una risposta in sospeso",
        "seconda",
    ]


async def test_la_copia_si_legge_anche_senza_rete(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Il centralino giu' non deve voler dire una schermata vuota.

    La conversazione vera sta di la', ma quella gia' letta sta qui: e' la
    ragione per cui la copia esiste. Vale sul giro **interattivo** — quello di
    chi apre la finestra adesso — e non solo su quello automatico: la prima
    stesura sollevava il guasto prima di costruire la risposta, e chi apriva la
    chat con la rete giu' vedeva un errore sopra una conversazione vuota, con la
    copia intatta sul disco a mezzo metro di distanza.

    Il guasto si dice lo stesso, ma accanto ai messaggi, non al posto loro.
    """
    _entry(hass)
    await chat.async_scrivi(hass, "una domanda")
    centralino.guasto = ChatError("unreachable", "Centralino non raggiungibile.")
    filo = await chat.async_conversazione(hass)
    assert [riga["testo"] for riga in filo["messages"]] == ["una domanda"]
    assert filo["error"]


async def test_un_messaggio_arrivato_due_volte_si_vede_una(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Due schede aperte, o un riavvio nel mezzo: la copia non raddoppia."""
    _entry(hass)
    await chat.async_scrivi(hass, "domanda")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    centralino.risponde(identita["casa"], "risposta")
    await chat.async_conversazione(hass)
    # La stessa riga, riproposta come se fosse nuova.
    await store.async_aggiungi(centralino.linee[identita["casa"]])
    assert len(store.messaggi()) == 2


# ─── Il campanello ───────────────────────────────────────────────────────────


async def test_il_campanello_suona_per_la_risposta(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    _entry(hass)
    suonate = _ascolta(hass)
    await chat.async_scrivi(hass, "aiuto")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    centralino.risponde(identita["casa"], "eccomi")
    nuovi = await chat.async_guarda(hass)
    await hass.async_block_till_done()
    assert [riga["testo"] for riga in nuovi] == ["eccomi"]
    assert [evento["text"] for evento in suonate] == ["eccomi"]
    assert f"{DOMAIN}_chat" in _campanelle(hass)


async def test_il_campanello_non_suona_per_la_propria_frase(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Sentire suonare per quello che si e' appena battuto e' il modo sicuro
    di far spegnere il campanello a tutti."""
    _entry(hass)
    suonate = _ascolta(hass)
    await chat.async_scrivi(hass, "scrivo io")
    assert await chat.async_guarda(hass) == []
    await hass.async_block_till_done()
    assert suonate == []
    assert f"{DOMAIN}_chat" not in _campanelle(hass)


async def test_non_suona_per_le_proprie_frasi_riscaricate(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Il campanello guarda CHI ha scritto, non se la riga e' nuova per la copia.

    Il caso c'e' davvero, ed e' quello scritto in `async_dimentica`: se la
    cancellazione sul centralino non riesce, la copia locale si svuota lo stesso
    e il filo di la' resta intero. Il giro dopo riscarica tutto — anche le frasi
    di chi abita qui — e senza il filtro la campanella suonerebbe per parole che
    ha battuto lui.

    Questa e' la prova che il filtro serve: senza `da == "console"` la prova
    qui sopra passerebbe lo stesso, perche' li' non c'e' niente da riscaricare.
    """
    _entry(hass)
    await chat.async_scrivi(hass, "una domanda mia")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    # La copia locale si svuota e il filo di la' resta: succede quando la copia
    # si perde — un ripristino, un profilo nuovo, un magazzino azzerato — e il
    # giro dopo riscarica tutto, comprese le frasi di chi abita qui.
    await store.async_dimentica()

    suonate = _ascolta(hass)
    riscaricati = await chat.async_guarda(hass)
    await hass.async_block_till_done()
    assert riscaricati == []
    assert suonate == []
    assert f"{DOMAIN}_chat" not in _campanelle(hass)
    # La frase e' tornata nella copia: e' il campanello che ha taciuto, non la
    # rilettura che non e' avvenuta.
    assert [riga["testo"] for riga in store.messaggi()] == ["una domanda mia"]
    assert identita["casa"] in centralino.linee


async def test_lo_stesso_messaggio_non_suona_due_volte(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Il segnalibro sta su disco apposta: Home Assistant si riavvia a ogni
    aggiornamento, cioe' spesso."""
    _entry(hass)
    await chat.async_scrivi(hass, "aiuto")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    centralino.risponde(identita["casa"], "eccomi")
    assert len(await chat.async_guarda(hass)) == 1
    suonate = _ascolta(hass)
    assert await chat.async_guarda(hass) == []
    assert suonate == []


async def test_chi_non_ha_aperto_la_chat_non_chiede_niente(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Il giro dei cinque minuti non deve costare una richiesta alle case che
    la chat non l'hanno mai usata — cioe' quasi tutte."""
    _entry(hass)
    assert await chat.async_guarda(hass) == []
    assert centralino.chiamate == []


# ─── Cancellare ──────────────────────────────────────────────────────────────


async def test_cancellare_cancella_anche_dal_centralino(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """«Puoi cancellare la conversazione quando vuoi» e' scritto nella plancia
    prima che qualcuno scriva: una promessa cosi' si mantiene tutta."""
    _entry(hass)
    await chat.async_scrivi(hass, "poi ho risolto da solo")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    assert await chat.async_dimentica(hass) is True
    assert store.messaggi() == []
    assert identita["casa"] not in centralino.linee


async def test_una_cancellazione_non_riuscita_si_dice(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """«Cancellato» non si dice se non e' cancellato.

    La prima stesura, quando il centralino non rispondeva, cancellava lo stesso
    la copia locale e tornava `True`: la plancia scriveva «conversazione
    cancellata» e il filo restava intero di la' — con dentro quello che una
    persona aveva appena chiesto di far sparire — e il giro dei cinque minuti se
    lo riportava in casa poco dopo. Una cancellazione promessa, una finta fatta,
    e i messaggi che tornano.

    Adesso il guasto arriva a chi ha premuto, e non si tocca niente: la copia
    resta com'e' rimasto il filo. Riprovare si puo'; credere di aver cancellato
    no.
    """
    _entry(hass)
    await chat.async_scrivi(hass, "cancellami")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()
    centralino.guasto = ChatError("unreachable", "Centralino non raggiungibile.")

    with pytest.raises(ChatError):
        await chat.async_dimentica(hass)

    assert [riga["testo"] for riga in store.messaggi()] == ["cancellami"]
    assert identita["casa"] in centralino.linee


async def test_una_risposta_arrivata_mentre_si_scriveva_non_si_perde(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Il segnalibro non scavalca quello che non ha ancora letto.

    Fra un giro e l'altro passano cinque minuti, e in quei cinque minuti ci sta
    benissimo che l'assistenza risponda mentre chi ha chiesto sta ancora
    scrivendo. Il numero che il centralino da' al messaggio nuovo e' piu' alto
    di quella risposta: mettendolo in copia e basta, il segnalibro la
    scavalcava, e da li' in poi si chiedeva sempre «dopo» un numero che l'aveva
    gia' superata.

    Quella risposta non sarebbe stata chiesta mai piu': persa, in silenzio, per
    sempre — e chi aspettava avrebbe continuato ad aspettare una frase gia'
    scritta.
    """
    _entry(hass)
    await chat.async_scrivi(hass, "come faccio?")
    store = await async_get_chat_store(hass)
    identita = await store.async_identita()

    # L'assistenza risponde adesso, prima del prossimo giro dei cinque minuti.
    centralino.risponde(identita["casa"], "guarda nella scheda Stanze")
    # E chi ha chiesto, senza saperlo, scrive ancora.
    await chat.async_scrivi(hass, "sono ancora qui")

    filo = await chat.async_conversazione(hass)
    assert [riga["testo"] for riga in filo["messages"]] == [
        "come faccio?",
        "guarda nella scheda Stanze",
        "sono ancora qui",
    ]


async def test_senza_chiave_non_si_risponde_a_nessuno(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """La console della chat non si deduce: si ha la chiave o non la si ha."""
    _entry(hass)
    assert chat.e_la_console(hass) is False
    with pytest.raises(ChatError):
        await chat.async_coda(hass)
    with pytest.raises(ChatError):
        await chat.async_replica(hass, "casa_x", "ciao")


async def test_con_la_chiave_si_vede_la_coda_e_si_risponde(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    _entry(hass, **{OPTION_CHAT_CONSOLE_KEY: "chiave-vera"})
    assert chat.e_la_console(hass) is True
    await chat.async_scrivi(hass, "una domanda")
    coda = await chat.async_coda(hass)
    assert len(coda) == 1
    linea = coda[0]["id"]
    await chat.async_replica(hass, linea, "una risposta")
    filo = await chat.async_apri(hass, linea)
    assert [riga["testo"] for riga in filo] == ["una domanda", "una risposta"]


# ─── Spegnerla ───────────────────────────────────────────────────────────────


async def test_la_console_legge_anche_oltre_la_prima_pagina(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Il centralino ne da' cento per volta e ne conserva duecento.

    Chiedere la prima pagina e fermarsi vorrebbe dire che dalla centunesima in
    poi non si leggono mai — nemmeno riaprendo la conversazione, perche' si
    riaprirebbe sulle stesse cento — mentre la coda continua a segnalarle come
    non lette. Chi risponde vedrebbe un pallino su messaggi che non riesce a
    raggiungere.
    """
    _entry(hass, **{OPTION_CHAT_CONSOLE_KEY: "chiave-vera"})
    centralino.pagina = 10
    await chat.async_scrivi(hass, "la prima")
    store = await async_get_chat_store(hass)
    linea = (await store.async_identita())["casa"]
    for i in range(24):
        centralino.risponde(linea, f"risposta {i}")

    filo = await chat.async_apri(hass, linea)
    assert len(filo) == 25
    assert filo[0]["testo"] == "la prima"
    assert filo[-1]["testo"] == "risposta 23"
    # E nessuna riga contata due volte.
    assert len({riga["id"] for riga in filo}) == 25


async def test_con_la_chat_spenta_non_si_risponde_nemmeno(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Spegnere promette che non esce niente di casa, e vale anche per chi
    risponde.

    I comandi della console guardavano solo se la chiave ci fosse. Con
    l'interruttore su spento la tessera sparisce al ridisegno, ma una finestra
    gia' aperta — o una chiamata diretta ai comandi — avrebbe continuato a
    parlare col centralino: la promessa dell'opzione valeva per meta'.
    """
    _entry(hass, chat_enabled=False, **{OPTION_CHAT_CONSOLE_KEY: "chiave-vera"})
    with pytest.raises(ChatError):
        await chat.async_coda(hass)
    with pytest.raises(ChatError):
        await chat.async_apri(hass, "casa_x")
    with pytest.raises(ChatError):
        await chat.async_replica(hass, "casa_x", "ciao")
    assert centralino.chiamate == []


async def test_spenta_non_esce_niente_di_casa(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    _entry(hass, chat_enabled=False)
    assert chat.accesa(hass) is False
    with pytest.raises(ChatError):
        await chat.async_scrivi(hass, "ciao")
    assert await chat.async_guarda(hass) == []
    assert centralino.chiamate == []


async def test_senza_centralino_la_porta_non_si_disegna(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Meglio nessuna porta che una porta che non si apre."""
    _entry(hass)
    monkeypatch.setattr(chat, "configurato", lambda: False)
    assert chat.accesa(hass) is False
    stato = await chat.async_stato(hass)
    assert stato["enabled"] is False
