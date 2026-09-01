"""Il device flow di GitHub, e le issue che ne nascono.

Chi ha questa plancia installata ha gia' un account GitHub e ha gia' fatto
questo identico giro: HACS chiede la stessa autorizzazione, con lo stesso
codice da digitare su github.com/login/device. E' il motivo per cui le
segnalazioni non hanno bisogno di un servizio di mezzo — le persone da
raggiungere su GitHub ci sono gia' tutte.

Tre cose che questo file tratta con cura.

* **Il gettone non esce mai da Home Assistant.** Nasce qui, resta nel deposito
  del backend, e viaggia solo verso api.github.com. Il browser non lo vede in
  nessun momento: chiede «apri una segnalazione», non «apri una segnalazione
  con questo gettone».
* **Il device flow ha i suoi tempi, e vanno rispettati.** GitHub dice ogni
  quanto interrogarlo e risponde `slow_down` a chi insiste: l'attesa e' quella
  che dice lui, non una scelta nostra.
* **Le risposte hanno un tetto.** Un servizio raggiungibile da fuori casa non
  deve poter decidere quanta memoria occupa dentro casa, e vale anche per
  GitHub.
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    GITHUB_API,
    GITHUB_CLIENT_ID,
    GITHUB_DEVICE_CODE_URL,
    GITHUB_DEVICE_TOKEN_URL,
    GITHUB_SCOPE,
    REPOSITORY,
    TICKET_MARKER,
)

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

_TIMEOUT = 20
_MAX_RESPONSE_BYTES = 512 * 1024

#: Il numero di issue che si rileggono in una volta sola, e quante risposte si
#: guardano dentro ognuna. Chi ha scritto quaranta commenti sotto la stessa
#: segnalazione non deve far crescere il giro senza fine.
MAX_COMMENTS = 30

#: Chi conta come «il manutentore» quando si cerca la risposta. GitHub lo dice
#: da solo su ogni commento, e non serve nessuna chiamata in piu' per saperlo.
MAINTAINER_ASSOCIATIONS = frozenset({"OWNER", "MEMBER", "COLLABORATOR"})


class GitHubError(RuntimeError):
    """GitHub non ha risposto, o ha risposto di no."""

    def __init__(self, code: str, message: str) -> None:
        """Tieni il codice: il frontend sceglie cosa dire in base a quello."""
        super().__init__(message)
        self.code = code


class DevicePending(GitHubError):  # noqa: N818 - non e' un guasto, e' un'attesa
    """Chi autorizza non ha ancora finito. Non e' un errore, e' un'attesa."""

    def __init__(self, interval: int = 5) -> None:
        """Ricorda fra quanto ha senso richiedere."""
        super().__init__("pending", "Autorizzazione non ancora completata.")
        self.interval = interval


def configured() -> bool:
    """Se questa copia dell'integrazione sa a chi chiedere l'autorizzazione."""
    return bool(GITHUB_CLIENT_ID)


async def _request(
    hass: HomeAssistant,
    method: str,
    url: str,
    *,
    token: str = "",
    payload: Mapping[str, Any] | None = None,
    accept: str = "application/vnd.github+json",
) -> Any:
    """Una chiamata a GitHub, con la risposta letta come JSON e con un tetto."""
    headers = {"Accept": accept, "User-Agent": "dashboardmodern"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    session = async_get_clientsession(hass)
    try:
        async with session.request(
            method, url, headers=headers, json=payload, timeout=_TIMEOUT
        ) as answer:
            corpo = await answer.content.read(_MAX_RESPONSE_BYTES + 1)
            if len(corpo) > _MAX_RESPONSE_BYTES:
                raise GitHubError("too_large", "Risposta troppo grande.")
            if answer.status == 401:
                raise GitHubError("unauthorized", "Autorizzazione GitHub scaduta.")
            if answer.status == 403:
                raise GitHubError(
                    "forbidden", "GitHub ha rifiutato: permessi o limite orario."
                )
            if answer.status == 404:
                raise GitHubError("not_found", "Non trovato su GitHub.")
            if answer.status >= 400:
                raise GitHubError("http", f"GitHub ha risposto {answer.status}.")
            try:
                return json.loads(corpo or b"{}")
            except ValueError as errore:
                raise GitHubError("unreadable", "Risposta illeggibile.") from errore
    except GitHubError:
        raise
    except Exception as errore:  # noqa: BLE001 - rete: ogni guasto e' lo stesso
        raise GitHubError("unreachable", "GitHub non raggiungibile.") from errore


# ─── Il device flow ──────────────────────────────────────────────────────────


async def async_start_device_flow(hass: HomeAssistant) -> dict[str, Any]:
    """Chiedi a GitHub il codice che l'utente andra' a digitare."""
    if not configured():
        raise GitHubError("not_configured", "Autorizzazione GitHub non configurata.")
    payload: dict[str, Any] = {"client_id": GITHUB_CLIENT_ID}
    if GITHUB_SCOPE:
        payload["scope"] = GITHUB_SCOPE
    risposta = await _request(
        hass,
        "POST",
        GITHUB_DEVICE_CODE_URL,
        payload=payload,
        accept="application/json",
    )
    codice = str(risposta.get("device_code") or "")
    utente = str(risposta.get("user_code") or "")
    if not codice or not utente:
        raise GitHubError("no_code", "GitHub non ha dato un codice.")
    return {
        "device_code": codice,
        "user_code": utente,
        "verification_uri": str(
            risposta.get("verification_uri") or "https://github.com/login/device"
        ),
        # L'attesa la decide GitHub, non noi: chi insiste si prende `slow_down`.
        "interval": max(int(risposta.get("interval") or 5), 1),
        "expires_in": int(risposta.get("expires_in") or 900),
    }


async def async_poll_device_flow(hass: HomeAssistant, device_code: str) -> str:
    """Ritira il gettone, o di' che l'utente non ha ancora finito.

    Solleva ``DevicePending`` finche' l'autorizzazione e' in corso: e' la
    risposta normale delle prime volte, non un guasto, e chi chiama la
    riconosce dal tipo invece che dal testo.
    """
    risposta = await _request(
        hass,
        "POST",
        GITHUB_DEVICE_TOKEN_URL,
        payload={
            "client_id": GITHUB_CLIENT_ID,
            "device_code": device_code,
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
        },
        accept="application/json",
    )
    gettone = str(risposta.get("access_token") or "")
    if gettone:
        return gettone
    errore = str(risposta.get("error") or "")
    if errore == "authorization_pending":
        raise DevicePending()
    if errore == "slow_down":
        raise DevicePending(int(risposta.get("interval") or 10))
    if errore == "expired_token":
        raise GitHubError("expired", "Il codice e' scaduto: chiedine un altro.")
    if errore == "access_denied":
        raise GitHubError("denied", "Autorizzazione rifiutata.")
    raise GitHubError("no_token", "GitHub non ha dato un gettone.")


async def async_whoami(hass: HomeAssistant, token: str) -> dict[str, Any]:
    """Chi e' che ha autorizzato, e se e' lui a tenere la repository."""
    utente = await _request(hass, "GET", f"{GITHUB_API}/user", token=token)
    login = str(utente.get("login") or "")
    permessi = await _async_push_access(hass, token)
    return {"login": login, "maintainer": permessi}


async def _async_push_access(hass: HomeAssistant, token: str) -> bool:
    """Se chi ha autorizzato puo' scrivere su questa repository.

    E' la domanda che accende la console, e la risposta la da' GitHub: non una
    lista di nomi scritta da qualche parte, che si sarebbe scordata di essere
    aggiornata il giorno in cui la repository cambia mano.
    """
    try:
        repository = await _request(
            hass, "GET", f"{GITHUB_API}/repos/{REPOSITORY}", token=token
        )
    except GitHubError:
        return False
    permessi = repository.get("permissions")
    if not isinstance(permessi, dict):
        return False
    return bool(
        permessi.get("push") or permessi.get("maintain") or permessi.get("admin")
    )


# ─── Gli allegati ────────────────────────────────────────────────────────────
#
# GitHub non ha un'API per allegare file a una issue, quindi la foto la mette
# chi segnala, dalla pagina della segnalazione. Da qui pero' si puo' vedere che
# c'e': una volta allegata, vive nel testo del commento come un indirizzo, e
# quel testo l'API lo restituisce.
#
# Gli indirizzi hanno due forme, una moderna e una vecchia, e nessuna delle due
# porta l'estensione del file: da `…/assets/<uuid>` non si capisce se sia una
# foto o un video. A dirlo e' la sintassi che gli sta intorno — `![](…)` e'
# un'immagine, un indirizzo nudo lo diventa quando GitHub lo disegna — quindi
# quello che non e' dichiarato immagine resta «allegato» e basta, senza
# inventare una faccia che non si conosce.

_HOST_ALLEGATI = (
    "https://github.com/user-attachments/assets/",
    "https://user-images.githubusercontent.com/",
    "https://private-user-images.githubusercontent.com/",
)

#: `![didascalia](indirizzo)` — la forma che GitHub scrive quando trascini
#: un'immagine nel riquadro.
_IMMAGINE = re.compile(r"!\[([^\]]*)\]\((https?://[^)\s]+)\)")

#: Un indirizzo nudo su una riga sua: e' come GitHub scrive un video.
_INDIRIZZO = re.compile(r"https?://[^\s<>()\[\]\"']+")

MAX_ALLEGATI = 20


def attachments_in(text: str) -> list[dict[str, str]]:
    """Gli allegati citati in un testo, nell'ordine in cui compaiono.

    Il doppione non si conta due volte: GitHub scrive lo stesso indirizzo sia
    dentro `![](…)` sia, in certi casi, subito accanto, e chi legge la coda
    vedrebbe due allegati dove ce n'e' uno.
    """
    if not isinstance(text, str) or not text:
        return []
    trovati: dict[str, dict[str, str]] = {}
    for didascalia, indirizzo in _IMMAGINE.findall(text):
        if indirizzo not in trovati:
            trovati[indirizzo] = {
                "url": indirizzo,
                "kind": "image",
                "name": didascalia.strip()[:120],
            }
    for indirizzo in _INDIRIZZO.findall(text):
        pulito = indirizzo.rstrip(".,;:")
        if pulito in trovati or not pulito.startswith(_HOST_ALLEGATI):
            continue
        # Non dichiarato immagine: puo' essere un video o un file, e non si
        # tira a indovinare.
        trovati[pulito] = {"url": pulito, "kind": "file", "name": ""}
    return list(trovati.values())[:MAX_ALLEGATI]


def _senza_allegati(text: str) -> str:
    """Il testo senza gli indirizzi degli allegati, che li mostra la coda."""
    ripulito = _IMMAGINE.sub("", text or "")
    for indirizzo in _INDIRIZZO.findall(ripulito):
        if indirizzo.startswith(_HOST_ALLEGATI):
            ripulito = ripulito.replace(indirizzo, "")
    return "\n".join(riga.rstrip() for riga in ripulito.splitlines()).strip()


# ─── Le issue ────────────────────────────────────────────────────────────────


def issue_body(ticket: Mapping[str, Any]) -> str:
    """Il corpo della issue: quello che l'utente ha scritto, piu' la diagnostica.

    Il contatto non c'e', e non e' una dimenticanza: una issue e' una pagina
    pubblica, e chi ha scritto il proprio indirizzo lo ha scritto a una
    persona. Resta in casa, dove il manutentore lo legge dalla console.
    """
    righe = [str(ticket.get("body") or ""), ""]
    diagnostica = ticket.get("diagnostics") or {}
    voci = [(chiave, valore) for chiave, valore in diagnostica.items() if valore]
    if voci:
        righe += ["<details><summary>Diagnostica</summary>", ""]
        righe += [f"- **{chiave}**: {valore}" for chiave, valore in sorted(voci)]
        righe += ["", "</details>", ""]
    righe.append(TICKET_MARKER)
    return "\n".join(righe)


def issue_title(ticket: Mapping[str, Any]) -> str:
    """Il titolo, col prefisso che i moduli su GitHub gia' usano."""
    prefissi = {"feature": "[Feature]", "assistenza": "[Aiuto]"}
    prefisso = prefissi.get(str(ticket.get("type")), "[Bug]")
    return f"{prefisso}: {ticket.get('title') or ''}"[:240]


async def async_create_issue(
    hass: HomeAssistant, token: str, ticket: Mapping[str, Any]
) -> dict[str, Any]:
    """Apri la issue a nome di chi ha scritto la segnalazione.

    Senza etichette, e non per dimenticanza: GitHub le scarta quando a
    scriverle e' qualcuno che sulla repository non ha i permessi, cioe'
    esattamente chi apre le segnalazioni. Le mette il manutentore dalla
    console, che i permessi ce li ha.
    """
    creata = await _request(
        hass,
        "POST",
        f"{GITHUB_API}/repos/{REPOSITORY}/issues",
        token=token,
        payload={"title": issue_title(ticket), "body": issue_body(ticket)},
    )
    numero = creata.get("number")
    if not isinstance(numero, int):
        raise GitHubError("no_issue", "GitHub non ha aperto la segnalazione.")
    return {"number": numero, "url": str(creata.get("html_url") or "")}


def _state_from_issue(issue: Mapping[str, Any], risposta: str) -> str:
    """Lo stato che la plancia mostra, dedotto dalla issue.

    Non c'e' uno stato da tenere allineato a mano fra due posti: GitHub sa gia'
    se e' aperta, se e' chiusa e come, e la presenza di una risposta del
    manutentore dice il resto.
    """
    from .ticket_store import STATE_CLOSED, STATE_RESOLVED, STATE_SENT, STATE_TRIAGED

    if str(issue.get("state")) == "closed":
        motivo = str(issue.get("state_reason") or "")
        return STATE_CLOSED if motivo == "not_planned" else STATE_RESOLVED
    return STATE_TRIAGED if risposta else STATE_SENT


async def async_read_issue(
    hass: HomeAssistant, number: int, *, token: str = ""
) -> dict[str, Any]:
    """Che fine ha fatto una segnalazione, e cosa ha risposto il manutentore.

    Il gettone e' facoltativo: la repository e' pubblica e le issue si leggono
    anche senza. Averlo cambia solo il limite orario — sessanta richieste
    contro cinquemila — e a questo giro conviene.
    """
    issue = await _request(
        hass,
        "GET",
        f"{GITHUB_API}/repos/{REPOSITORY}/issues/{int(number)}",
        token=token,
    )
    risposta = ""
    if int(issue.get("comments") or 0) > 0:
        commenti = await _request(
            hass,
            "GET",
            f"{GITHUB_API}/repos/{REPOSITORY}/issues/{int(number)}"
            f"/comments?per_page={MAX_COMMENTS}",
            token=token,
        )
        if isinstance(commenti, list):
            for commento in reversed(commenti[-MAX_COMMENTS:]):
                if not isinstance(commento, dict):
                    continue
                if str(commento.get("author_association")) in MAINTAINER_ASSOCIATIONS:
                    risposta = str(commento.get("body") or "")
                    break
    return {
        "number": int(issue.get("number") or number),
        "state": _state_from_issue(issue, risposta),
        "reply": risposta,
        "issue_url": str(issue.get("html_url") or ""),
    }


async def async_issue_thread(
    hass: HomeAssistant, token: str, number: int
) -> dict[str, Any]:
    """Tutto quello che sta sotto una segnalazione: il testo e i commenti.

    E' quello che serve alla console per non dover uscire: chi ha allegato una
    foto l'ha allegata in un commento, e senza leggere i commenti la coda
    mostrerebbe una segnalazione che sembra nuda mentre non lo e'.

    Gli allegati si riportano separati dal testo. Lasciarli dentro vorrebbe
    dire mostrare un indirizzo di quaranta caratteri in mezzo a una frase, e
    nasconderli senza elencarli vorrebbe dire perderli.
    """
    issue = await _request(
        hass,
        "GET",
        f"{GITHUB_API}/repos/{REPOSITORY}/issues/{int(number)}",
        token=token,
    )
    corpo = str(issue.get("body") or "").replace(TICKET_MARKER, "")
    commenti: list[dict[str, Any]] = []
    if int(issue.get("comments") or 0) > 0:
        grezzi = await _request(
            hass,
            "GET",
            f"{GITHUB_API}/repos/{REPOSITORY}/issues/{int(number)}"
            f"/comments?per_page={MAX_COMMENTS}",
            token=token,
        )
        if isinstance(grezzi, list):
            for commento in grezzi[-MAX_COMMENTS:]:
                if not isinstance(commento, dict):
                    continue
                testo = str(commento.get("body") or "")
                commenti.append(
                    {
                        "id": str(commento.get("id") or ""),
                        "author": str((commento.get("user") or {}).get("login") or ""),
                        "maintainer": str(commento.get("author_association"))
                        in MAINTAINER_ASSOCIATIONS,
                        "at": str(commento.get("created_at") or ""),
                        "body": _senza_allegati(testo),
                        "attachments": attachments_in(testo),
                    }
                )
    return {
        "number": int(issue.get("number") or number),
        "body": _senza_allegati(corpo),
        "attachments": attachments_in(corpo),
        "comments": commenti,
        "issue_url": str(issue.get("html_url") or ""),
        "state": _state_from_issue(
            issue,
            next(
                (uno["body"] for uno in reversed(commenti) if uno["maintainer"]),
                "",
            ),
        ),
    }


async def async_comment(
    hass: HomeAssistant, token: str, number: int, body: str
) -> dict[str, Any]:
    """Rispondi sotto la segnalazione. Da qui, e la risposta e' anche su GitHub."""
    creato = await _request(
        hass,
        "POST",
        f"{GITHUB_API}/repos/{REPOSITORY}/issues/{int(number)}/comments",
        token=token,
        payload={"body": body},
    )
    return {"url": str(creato.get("html_url") or "")}


async def async_close_issue(
    hass: HomeAssistant, token: str, number: int, *, planned: bool = True
) -> None:
    """Chiudi la segnalazione: risolta, oppure archiviata senza intervento."""
    await _request(
        hass,
        "PATCH",
        f"{GITHUB_API}/repos/{REPOSITORY}/issues/{int(number)}",
        token=token,
        payload={
            "state": "closed",
            "state_reason": "completed" if planned else "not_planned",
        },
    )


async def async_queue(hass: HomeAssistant, token: str) -> list[dict[str, Any]]:
    """Le segnalazioni nate dalla plancia, per la console del manutentore.

    Si riconoscono dalla riga invisibile nel corpo, non da un'etichetta: chi le
    apre non ha i permessi per etichettare, e GitHub gliele scarterebbe.
    """
    issues = await _request(
        hass,
        "GET",
        f"{GITHUB_API}/repos/{REPOSITORY}/issues?state=all&per_page=50&sort=created"
        "&direction=desc",
        token=token,
    )
    if not isinstance(issues, list):
        return []
    coda: list[dict[str, Any]] = []
    for issue in issues:
        if not isinstance(issue, dict) or "pull_request" in issue:
            continue
        corpo = str(issue.get("body") or "")
        if TICKET_MARKER not in corpo:
            continue
        allegati = attachments_in(corpo)
        coda.append(
            {
                "number": int(issue.get("number") or 0),
                "title": str(issue.get("title") or ""),
                "body": _senza_allegati(corpo.replace(TICKET_MARKER, "")),
                "state": _state_from_issue(issue, ""),
                "issue_url": str(issue.get("html_url") or ""),
                "author": str((issue.get("user") or {}).get("login") or ""),
                # Quanti ce ne sono si sa dall'elenco, senza aprire niente: e'
                # il segno che dice quali valga la pena guardare.
                "comments": int(issue.get("comments") or 0),
                "attachments": len(allegati),
            }
        )
    return coda
