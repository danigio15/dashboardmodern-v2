"""La memoria della chat: chi e' questa casa, e cosa si sono detti.

Tre cose su disco, e nessuna di piu'.

* **L'identita' della casa.** Un identificativo di 128 bit e un segreto di 256,
  fabbricati qui la prima volta che serve la chat e mai piu' toccati. Non
  vengono da nessun account e non dicono niente di nessuno: il centralino sa
  che la linea `casa_9f3a…` ha scritto, e non ha modo di sapere altro.

  Il segreto non finisce nel browser e non finisce nell'archivio del
  centralino, dove ne resta solo l'impronta. Ma **viaggia**: ogni richiesta lo
  porta come `Authorization: Bearer`, ed e' li' che viene confrontato. Dentro
  TLS, e verso il servizio a cui si sta scrivendo — ma ci va, e dire il
  contrario sarebbe piu' comodo che vero.

* **La copia della conversazione.** Il filo vero sta nel centralino; questa e'
  la copia locale, quella che si legge senza rete e che sopravvive al riavvio
  di Home Assistant — che succede a ogni aggiornamento, cioe' spesso. Senza,
  riaprire la chat vorrebbe dire una schermata vuota finche' la rete non
  risponde.

* **Il segnalibro.** Fin dove si era letto, per sapere cosa e' nuovo. E' la
  stessa scelta del campanello delle segnalazioni: tenerlo in memoria avrebbe
  voluto dire risuonare a ogni riavvio per messaggi gia' letti.

Quello che qui **non** si scrive e' altrettanto deciso: nessuna entita',
nessuno stato, nessun gettone, nessun indirizzo. Il progetto sta in
`docs/CHAT.md`.
"""

from __future__ import annotations

import secrets
from typing import TYPE_CHECKING, Any

from homeassistant.helpers.storage import Store

from .const import CHAT_MAX_STORIA, DOMAIN

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

    from homeassistant.core import HomeAssistant

STORAGE_KEY = f"{DOMAIN}.chat"
STORAGE_VERSION = 1
DATA_CHAT_STORE = "chat_store"


def _nuova_identita() -> dict[str, str]:
    """Un nome e un segreto, presi dal caso e da nient'altro.

    `token_hex(16)` sono 128 bit: il nome della casa non si indovina, e non c'e'
    niente da cui possa essere derivato — non l'installazione, non l'ora, non
    la rete. Il segreto e' il doppio, e serve a dimostrare al centralino che
    chi bussa e' la stessa casa di ieri.
    """
    return {
        "casa": f"casa_{secrets.token_hex(16)}",
        "segreto": secrets.token_hex(32),
    }


class ChatStore:
    """Il quaderno della chat, su disco."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._dati: dict[str, Any] = {}

    async def async_load(self) -> None:
        dati = await self._store.async_load()
        if not isinstance(dati, dict):
            dati = {}
        dati.setdefault("identita", {})
        dati.setdefault("messaggi", [])
        dati.setdefault("letto", 0)
        dati.setdefault("nome", "")
        self._dati = dati

    async def _async_salva(self) -> None:
        await self._store.async_save(self._dati)

    # ── L'identita' ──────────────────────────────────────────────────────

    async def async_identita(self) -> dict[str, str]:
        """Chi e' questa casa. Alla prima chiamata se lo inventa e se lo tiene.

        Nasce qui e non alla configurazione della plancia perche' una casa che
        non ha mai aperto la chat non ha nessun motivo di avere un'identita':
        cosi' chi la chat non la usa non lascia niente da nessuna parte.
        """
        identita = self._dati.get("identita")
        if (
            isinstance(identita, dict)
            and identita.get("casa")
            and identita.get("segreto")
        ):
            return {"casa": str(identita["casa"]), "segreto": str(identita["segreto"])}
        nuova = _nuova_identita()
        self._dati["identita"] = nuova
        await self._async_salva()
        return nuova

    def aperta(self) -> bool:
        """Se questa casa la chat l'ha gia' aperta almeno una volta."""
        identita = self._dati.get("identita")
        return bool(isinstance(identita, dict) and identita.get("casa"))

    # ── Come si fa chiamare ──────────────────────────────────────────────

    def nome(self) -> str:
        return str(self._dati.get("nome") or "")

    async def async_chiamami(self, nome: str) -> None:
        """Il nome e' un campo libero e non si chiede: lo scrive chi vuole."""
        self._dati["nome"] = str(nome or "").strip()[:60]
        await self._async_salva()

    # ── La conversazione ─────────────────────────────────────────────────

    def messaggi(self) -> list[dict[str, Any]]:
        righe = self._dati.get("messaggi")
        return list(righe) if isinstance(righe, list) else []

    def ultimo(self) -> int:
        """Il numero dell'ultimo messaggio in copia: da li' si chiede il resto."""
        righe = self.messaggi()
        return max((int(riga.get("id") or 0) for riga in righe), default=0)

    async def async_aggiungi(
        self, nuovi: Iterable[Mapping[str, Any]]
    ) -> list[dict[str, Any]]:
        """Mette in copia i messaggi arrivati, senza doppioni.

        Il centralino li da' gia' in ordine e gia' scremati, ma la stessa
        richiesta puo' partire due volte — un riavvio nel mezzo, due schede
        aperte — e un messaggio scritto due volte nella copia si vedrebbe due
        volte sullo schermo. Il numero e' quello del centralino e non si
        ripete: basta lui.
        """
        conosciuti = {int(riga.get("id") or 0) for riga in self.messaggi()}
        aggiunti: list[dict[str, Any]] = []
        for riga in nuovi:
            numero = int(riga.get("id") or 0)
            if not numero or numero in conosciuti:
                continue
            conosciuti.add(numero)
            aggiunti.append(
                {
                    "id": numero,
                    "da": "console" if str(riga.get("da")) == "console" else "casa",
                    "testo": str(riga.get("testo") or ""),
                    "scritto_il": int(riga.get("scritto_il") or 0),
                }
            )
        if not aggiunti:
            return []
        righe = [*self.messaggi(), *aggiunti]
        righe.sort(key=lambda riga: int(riga.get("id") or 0))
        # La copia non e' un archivio: la conversazione vera sta nel centralino,
        # che tiene lo stesso numero di righe.
        self._dati["messaggi"] = righe[-CHAT_MAX_STORIA:]
        await self._async_salva()
        return aggiunti

    async def async_dimentica(self) -> None:
        """Cancella la conversazione da questa casa.

        L'identita' resta: cancellarla vorrebbe dire che il messaggio dopo
        arriva a chi risponde come una persona nuova, e la conversazione
        ripartirebbe da capo senza che nessuno l'abbia chiesto. Chi vuole
        sparire davvero passa dal centralino, e quel giro cancella tutti e due.
        """
        self._dati["messaggi"] = []
        self._dati["letto"] = 0
        await self._async_salva()

    async def async_azzera(self) -> None:
        """Via tutto, identita' compresa: la prossima volta e' un'altra casa."""
        self._dati = {"identita": {}, "messaggi": [], "letto": 0, "nome": ""}
        await self._async_salva()

    # ── Il segnalibro ────────────────────────────────────────────────────

    def non_letti(self) -> list[dict[str, Any]]:
        """I messaggi di chi risponde che nessuno ha ancora aperto."""
        letto = int(self._dati.get("letto") or 0)
        return [
            riga
            for riga in self.messaggi()
            if riga.get("da") == "console" and int(riga.get("id") or 0) > letto
        ]

    async def async_letto(self) -> None:
        """Aprire la chat e' averla letta."""
        self._dati["letto"] = self.ultimo()
        await self._async_salva()


async def async_get_chat_store(hass: HomeAssistant) -> ChatStore:
    """Il quaderno, uno solo per installazione."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    store = domain_data.get(DATA_CHAT_STORE)
    if store is None:
        store = ChatStore(hass)
        await store.async_load()
        domain_data[DATA_CHAT_STORE] = store
    return store
