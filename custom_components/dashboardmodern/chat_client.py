"""Il filo verso il centralino: chiedere, e sentirsi rispondere.

Il centralino e' il punto d'incontro fra due case che altrimenti non si
parlerebbero — la casa di chi chiede aiuto e quella di chi la plancia la
mantiene. Sta in `centralino/`, il progetto in `docs/CHAT.md`.

Tre cose che questo file tratta con cura, e sono le stesse tre di
`github_client.py`, perche' sono le stesse tre di ogni chiamata verso fuori.

* **Il segreto della casa non esce mai dal backend.** Nasce nel deposito, viene
  scritto in un'intestazione, e il browser non lo vede in nessun momento: la
  plancia chiede «manda questo messaggio», non «manda questo messaggio con
  questo segreto».
* **Le risposte hanno un tetto.** Un servizio raggiungibile da fuori casa non
  deve poter decidere quanta memoria occupa dentro casa. Vale per GitHub e vale
  per il centralino, che pure e' nostro: il giorno che qualcuno si mette in
  mezzo, il tetto c'e' gia'.
* **Un guasto di rete e' un guasto solo.** Chi chiama non deve distinguere fra
  DNS, TLS e timeout per decidere cosa scrivere sullo schermo.
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CHAT_CENTRALINO, CHAT_MAX_TESTO

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

_TIMEOUT = 20
_MAX_RESPONSE_BYTES = 512 * 1024
_CHUNK_BYTES = 64 * 1024


class ChatError(RuntimeError):
    """Il centralino non ha risposto, o ha risposto di no."""

    def __init__(self, code: str, message: str) -> None:
        """Tieni il codice: la plancia sceglie cosa dire in base a quello."""
        super().__init__(message)
        self.code = code


def configurato() -> bool:
    """Se un centralino c'e'.

    Finche' l'indirizzo resta vuoto la chat non esiste, e la plancia non
    disegna la porta: meglio nessuna porta che una porta che non si apre.
    """
    return bool(str(CHAT_CENTRALINO or "").strip())


def _base() -> str:
    return str(CHAT_CENTRALINO or "").strip().rstrip("/")


def _guasto(stato: int, corpo: bytes) -> ChatError:
    """Il codice di ritorno tradotto in qualcosa che si possa mostrare."""
    motivo = ""
    try:
        letto = json.loads(corpo or b"{}")
        if isinstance(letto, dict):
            motivo = str(letto.get("errore") or "")
    except ValueError:
        motivo = ""
    coda = f" {motivo}" if motivo else ""
    if stato in (401, 403):
        return ChatError("forbidden", f"Il centralino ha rifiutato.{coda}")
    if stato == 404:
        return ChatError("not_found", f"Conversazione sconosciuta.{coda}")
    if stato == 429:
        return ChatError(
            "too_many",
            "Hai scritto molti messaggi in poco tempo: riprova fra un po'.",
        )
    return ChatError("http", f"Il centralino ha risposto {stato}.{coda}")


async def _leggi_col_tetto(flusso: Any) -> bytes:
    """Il corpo intero, o un guasto — mai un pezzo spacciato per il tutto."""
    pezzi: list[bytes] = []
    quanti = 0
    async for pezzo in flusso.iter_chunked(_CHUNK_BYTES):
        quanti += len(pezzo)
        if quanti > _MAX_RESPONSE_BYTES:
            raise ChatError("too_large", "Risposta troppo grande.")
        pezzi.append(pezzo)
    return b"".join(pezzi)


async def _chiama(
    hass: HomeAssistant,
    metodo: str,
    via: str,
    *,
    chiave: str,
    intestazioni: Mapping[str, str] | None = None,
    corpo: Mapping[str, Any] | None = None,
) -> Any:
    """Una chiamata al centralino, letta come JSON e con un tetto."""
    if not configurato():
        raise ChatError("not_configured", "La chat non e' configurata.")
    testate = {
        "Accept": "application/json",
        "User-Agent": "dashboardmodern",
        "Authorization": f"Bearer {chiave}",
    }
    for nome, valore in (intestazioni or {}).items():
        if valore:
            testate[nome] = valore
    session = async_get_clientsession(hass)
    try:
        async with session.request(
            metodo, f"{_base()}{via}", headers=testate, json=corpo, timeout=_TIMEOUT
        ) as risposta:
            letto = await _leggi_col_tetto(risposta.content)
            if risposta.status >= 400:
                raise _guasto(risposta.status, letto)
            try:
                return json.loads(letto or b"{}")
            except ValueError as errore:
                raise ChatError("unreadable", "Risposta illeggibile.") from errore
    except ChatError:
        raise
    except Exception as errore:  # noqa: BLE001 - rete: ogni guasto e' lo stesso
        raise ChatError("unreachable", "Centralino non raggiungibile.") from errore


async def _note(
    hass: HomeAssistant, *, nome: str = "", lingua: str = ""
) -> dict[str, str]:
    """Le tre cose che partono insieme al messaggio, e nessuna in piu'.

    Versione della plancia, versione di Home Assistant, lingua: servono a capire
    una domanda senza doverle chiedere, e sono le uniche tre che chi risponde
    riceve senza che nessuno le abbia scritte. Nessuna entita', nessuno stato,
    nessun indirizzo, nessun identificativo di questo Home Assistant.

    La versione della plancia si chiede al manifest e non a una costante
    scritta a mano: una costante da aggiornare a ogni rilascio e' una costante
    che un giorno dice la versione di sei mesi fa, e chi risponde perde mezz'ora
    a cercare un difetto gia' corretto.
    """
    from homeassistant.const import __version__ as versione_ha
    from homeassistant.loader import async_get_integration

    from .const import DOMAIN

    try:
        integrazione = await async_get_integration(hass, DOMAIN)
        versione = str(integrazione.version or "")
    except Exception:  # noqa: BLE001 - senza versione si scrive lo stesso
        versione = ""
    return {
        "X-Versione": versione,
        "X-Ha": str(versione_ha or ""),
        "X-Lingua": str(lingua or getattr(hass.config, "language", "") or ""),
        "X-Nome": str(nome or ""),
    }


# ─── Lo sportello della casa ─────────────────────────────────────────────────


async def async_manda(
    hass: HomeAssistant,
    identita: Mapping[str, str],
    testo: str,
    *,
    nome: str = "",
    lingua: str = "",
) -> dict[str, Any]:
    """Manda un messaggio. Il primo apre la conversazione."""
    pulito = str(testo or "").strip()[:CHAT_MAX_TESTO]
    if not pulito:
        raise ChatError("empty", "Non c'e' niente da mandare.")
    risposta = await _chiama(
        hass,
        "POST",
        "/casa/messaggi",
        chiave=str(identita.get("segreto") or ""),
        intestazioni={
            "X-Casa": str(identita.get("casa") or ""),
            **await _note(hass, nome=nome, lingua=lingua),
        },
        corpo={"testo": pulito, "nome": str(nome or "")},
    )
    messaggio = risposta.get("messaggio")
    return messaggio if isinstance(messaggio, dict) else {}


async def async_leggi(
    hass: HomeAssistant, identita: Mapping[str, str], *, dopo: int = 0
) -> list[dict[str, Any]]:
    """I messaggi arrivati dopo quello che si aveva gia'.

    Si chiede «dopo il numero N» e non «tutti»: una conversazione lunga
    tornerebbe intera dodici volte all'ora per dire quasi sempre che non e'
    cambiato niente.
    """
    risposta = await _chiama(
        hass,
        "GET",
        f"/casa/messaggi?dopo={int(dopo) or 0}",
        chiave=str(identita.get("segreto") or ""),
        intestazioni={"X-Casa": str(identita.get("casa") or ""), **await _note(hass)},
    )
    righe = risposta.get("messaggi")
    return (
        [riga for riga in righe if isinstance(riga, dict)]
        if isinstance(righe, list)
        else []
    )


async def async_cancella(hass: HomeAssistant, identita: Mapping[str, str]) -> bool:
    """Cancella la conversazione dal centralino, non solo da questa casa."""
    risposta = await _chiama(
        hass,
        "DELETE",
        "/casa/messaggi",
        chiave=str(identita.get("segreto") or ""),
        intestazioni={"X-Casa": str(identita.get("casa") or "")},
    )
    return bool(risposta.get("cancellata"))


# ─── Lo sportello della console ──────────────────────────────────────────────
#
# La chiave sta nelle opzioni di un Home Assistant solo al mondo. Non e' un
# ruolo che si deduce: e' una chiave, e chi non ce l'ha da qui non vede niente.


async def async_conversazioni(hass: HomeAssistant, chiave: str) -> list[dict[str, Any]]:
    """L'elenco delle linee aperte, con i non letti e l'ultima cosa detta."""
    risposta = await _chiama(hass, "GET", "/console/conversazioni", chiave=chiave)
    righe = risposta.get("conversazioni")
    return (
        [riga for riga in righe if isinstance(riga, dict)]
        if isinstance(righe, list)
        else []
    )


async def async_filo(
    hass: HomeAssistant, chiave: str, linea: str, *, dopo: int = 0
) -> list[dict[str, Any]]:
    """Una conversazione, dal punto in cui si era rimasti."""
    risposta = await _chiama(
        hass,
        "GET",
        f"/console/conversazioni/{str(linea or '')}?dopo={int(dopo) or 0}",
        chiave=chiave,
    )
    righe = risposta.get("messaggi")
    return (
        [riga for riga in righe if isinstance(riga, dict)]
        if isinstance(righe, list)
        else []
    )


async def async_rispondi(
    hass: HomeAssistant, chiave: str, linea: str, testo: str
) -> dict[str, Any]:
    """Rispondi a una casa."""
    pulito = str(testo or "").strip()[:CHAT_MAX_TESTO]
    if not pulito:
        raise ChatError("empty", "Non c'e' niente da mandare.")
    risposta = await _chiama(
        hass,
        "POST",
        f"/console/conversazioni/{str(linea or '')}",
        chiave=chiave,
        corpo={"testo": pulito},
    )
    messaggio = risposta.get("messaggio")
    return messaggio if isinstance(messaggio, dict) else {}


__all__ = [
    "ChatError",
    "async_cancella",
    "async_conversazioni",
    "async_filo",
    "async_leggi",
    "async_manda",
    "async_rispondi",
    "configurato",
]
