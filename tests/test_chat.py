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
        return {"messaggi": self.linee.get(linea, [])}

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


async def test_la_copia_si_legge_anche_senza_rete(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Il centralino giu' non deve voler dire una schermata vuota.

    La conversazione vera sta di la', ma quella che si e' gia' letta sta qui: e'
    la ragione per cui la copia esiste.
    """
    _entry(hass)
    await chat.async_scrivi(hass, "una domanda")
    centralino.guasto = ChatError("unreachable", "Centralino non raggiungibile.")
    filo = await chat.async_conversazione(hass, zitta=True)
    assert [riga["testo"] for riga in filo["messages"]] == ["una domanda"]


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
    # La cancellazione non arriva al centralino: la copia si svuota, il filo no.
    centralino.guasto = ChatError("unreachable", "Centralino non raggiungibile.")
    await chat.async_dimentica(hass)
    centralino.guasto = None

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


async def test_cancellare_pulisce_lo_schermo_anche_se_il_centralino_e_giu(
    hass: HomeAssistant, centralino: FintoCentralino
) -> None:
    """Lasciare i messaggi sotto gli occhi di chi ha appena chiesto di non
    vederli piu' sarebbe la peggiore delle due meta'."""
    _entry(hass)
    await chat.async_scrivi(hass, "cancellami")
    centralino.guasto = ChatError("unreachable", "Centralino non raggiungibile.")
    assert await chat.async_dimentica(hass) is True
    store = await async_get_chat_store(hass)
    assert store.messaggi() == []


# ─── Chi risponde ────────────────────────────────────────────────────────────


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
