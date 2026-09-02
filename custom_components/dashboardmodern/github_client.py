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

# `Mapping` serve a tempo di esecuzione, non solo al controllo dei tipi: la
# lettura delle etichette lo usa in un `isinstance`. Sotto `TYPE_CHECKING`
# quella riga sollevava un NameError alla prima coda aperta dalla console.
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

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
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

_TIMEOUT = 20
_MAX_RESPONSE_BYTES = 512 * 1024
_CHUNK_BYTES = 64 * 1024

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


#: Quanto del messaggio di GitHub si riporta. Sono frasi corte; il tetto c'e'
#: perche' quel testo finisce dritto sotto la segnalazione di chi ha scritto.
_MAX_MOTIVO = 200


def _motivo(corpo: bytes) -> str:
    """Cosa dice GitHub del rifiuto, se lo dice.

    Con ogni 4xx GitHub manda un `message` che il piu' delle volte e' esatto —
    «Resource not accessible by integration» quando l'App non e' installata
    sulla repository, «API rate limit exceeded» quando si e' insistito troppo.
    Buttarlo via voleva dire mostrare «permessi o limite orario» e lasciare a
    chi legge il compito di indovinare quale dei due: due strade opposte dietro
    la stessa frase, una che si risolve con un'installazione e una aspettando.
    """
    try:
        letto = json.loads(corpo or b"{}")
    except ValueError:
        return ""
    if not isinstance(letto, dict):
        return ""
    return str(letto.get("message") or "")[:_MAX_MOTIVO].strip()


def _guasto(status: int, corpo: bytes) -> GitHubError:
    """Il guasto da sollevare per una risposta che non e' andata bene."""
    motivo = _motivo(corpo)
    coda = f" GitHub dice: {motivo}" if motivo else ""
    if status == 401:
        return GitHubError("unauthorized", f"Autorizzazione GitHub scaduta.{coda}")
    if status == 403:
        return GitHubError("forbidden", f"GitHub ha rifiutato.{coda}")
    if status == 404:
        return GitHubError("not_found", f"Non trovato su GitHub.{coda}")
    return GitHubError("http", f"GitHub ha risposto {status}.{coda}")


async def _leggi_col_tetto(flusso: Any) -> bytes:
    """Il corpo intero, o un guasto — mai un pezzo spacciato per il tutto.

    `StreamReader.read(n)` non legge n byte: aspetta che il buffer non sia
    vuoto e restituisce quello che ci trova, cioe' il primo pezzo arrivato.
    Su una risposta lunga — l'elenco delle issue di una repository viva — il
    corpo tornava mozzato a meta', `json.loads` falliva, e la console diceva
    «Risposta illeggibile» su una risposta che GitHub aveva mandato intera.

    Qui si legge fino alla fine, un pezzo per volta, e il tetto si controlla
    mentre si legge: chi supera il limite lo sente dire, e non si ritrova un
    troncamento travestito da JSON rotto.
    """
    pezzi: list[bytes] = []
    quanti = 0
    async for pezzo in flusso.iter_chunked(_CHUNK_BYTES):
        quanti += len(pezzo)
        if quanti > _MAX_RESPONSE_BYTES:
            raise GitHubError("too_large", "Risposta troppo grande.")
        pezzi.append(pezzo)
    return b"".join(pezzi)


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
            corpo = await _leggi_col_tetto(answer.content)
            if answer.status >= 400:
                raise _guasto(answer.status, corpo)
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


def _owner() -> str:
    """Il proprietario della repository, come lo scrive `REPOSITORY`."""
    return REPOSITORY.split("/", 1)[0].casefold()


async def async_whoami(hass: HomeAssistant, token: str) -> dict[str, Any]:
    """Chi e' che ha autorizzato, e se e' lui a tenere la repository.

    Due strade per la stessa domanda, e ne basta una.

    La prima e' quella buona: GitHub dice quali permessi ha chi chiede, e vale
    anche per un collaboratore che ieri non c'era. La seconda e' il nome: chi
    ha autorizzato e' il proprietario della repository, e allora la console
    gli spetta comunque.

    Serve tutte e due perche' la prima puo' tacere. Un gettone di GitHub App
    su una repository dove l'App non e' installata riceve la risposta nella
    forma «sola lettura pubblica», che il campo `permissions` non ce l'ha —
    e il proprietario si ritroverebbe senza la sua coda per una ragione che
    con i suoi permessi non c'entra niente.
    """
    utente = await _request(hass, "GET", f"{GITHUB_API}/user", token=token)
    login = str(utente.get("login") or "")
    if login.casefold() == _owner():
        return {"login": login, "maintainer": True}
    return {"login": login, "maintainer": await _async_push_access(hass, token)}


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

    Un recapito non c'e' — non nel corpo e non altrove — e non e' una
    dimenticanza. Il modulo lo chiedeva, «resta in casa», ed era vero: non
    finiva nella pagina pubblica. Solo che in casa non lo leggeva nessuno,
    perche' la console del manutentore legge GitHub. Chiedere un indirizzo
    e-mail per poi non farne niente e' la peggiore delle tre strade possibili:
    si conserva un dato personale, non serve a nessuno, e chi lo scrive crede
    di essere raggiungibile. La risposta arriva sotto la segnalazione, dove il
    filo si legge e si scrive nei due sensi.
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


# Il tipo di una segnalazione non e' un campo di GitHub. Sta in due posti che
# su questa repository esistono da prima della plancia: il prefisso del titolo,
# che i moduli di GitHub mettono da soli, e l'etichetta, che il manutentore
# mette a mano. Si guardano tutti e due, in quest'ordine, e se nessuno dei due
# dice niente il tipo resta vuoto — che e' meglio di sceglierne uno a caso.
_PREFISSI_TIPO = {
    "[bug]": "bug",
    "[feature]": "feature",
    "[aiuto]": "assistenza",
    "[help]": "assistenza",
}
_ETICHETTE_TIPO = {
    "bug": "bug",
    "difetto": "bug",
    "enhancement": "feature",
    "feature": "feature",
    "feature request": "feature",
    "question": "assistenza",
    "help wanted": "assistenza",
    "support": "assistenza",
}


#: Il blocco che `issue_body` scrive, riletto al contrario. Su GitHub quelle
#: righe sono una scheda che si apre; dentro la plancia erano testo crudo —
#: «<details><summary>Diagnostica</summary>» e cinque righe di asterischi —
#: buttate in mezzo a quello che l'utente aveva scritto. Chi legge la coda si
#: trovava la parte che conta annegata nella parte che il programma ha aggiunto.
_DIAGNOSTICA = re.compile(
    r"<details>\s*<summary>\s*Diagnostica\s*</summary>(.*?)</details>",
    re.IGNORECASE | re.DOTALL,
)
_VOCE_DIAGNOSTICA = re.compile(r"^\s*-\s*\*\*(.+?)\*\*:\s*(.*)$", re.MULTILINE)

#: Quanto si tiene di un valore. Lo `user_agent` di un browser moderno arriva a
#: duecento caratteri, e nella riga della coda vale quanto il resto insieme.
_MAX_VALORE = 300


def diagnostica_in(corpo: str) -> tuple[str, dict[str, str]]:
    """Il testo dell'utente, e la diagnostica come dati invece che come markup.

    Torna i due pezzi separati: quello che la persona ha scritto — che e' la
    ragione per cui la segnalazione esiste — e le voci che la plancia ha
    aggiunto, che restano utili ma non devono coprirlo.
    """
    if not isinstance(corpo, str) or not corpo:
        return "", {}
    trovato = _DIAGNOSTICA.search(corpo)
    if not trovato:
        return corpo.strip(), {}
    voci = {
        chiave.strip()[:80]: valore.strip()[:_MAX_VALORE]
        for chiave, valore in _VOCE_DIAGNOSTICA.findall(trovato.group(1))
        if chiave.strip()
    }
    resto = corpo[: trovato.start()] + corpo[trovato.end() :]
    return "\n".join(riga.rstrip() for riga in resto.splitlines()).strip(), voci


def _tipo_e_titolo(issue: Mapping[str, Any]) -> tuple[str, str]:
    """Il tipo della segnalazione, e il titolo ripulito dal prefisso.

    Il prefisso si toglie perche' accanto al titolo la console disegna gia' la
    pastiglia del tipo: lasciarlo vorrebbe dire scrivere «difetto» due volte
    sulla stessa riga. Si toglie pero' solo quando dopo resta qualcosa: c'e'
    chi apre la issue e il titolo lo lascia al prefisso, e in quel caso una
    riga vuota sarebbe peggio di una riga ridondante.
    """
    titolo = str(issue.get("title") or "").strip()
    piatto = titolo.casefold()
    for prefisso, tipo in _PREFISSI_TIPO.items():
        if piatto.startswith(prefisso):
            resto = titolo[len(prefisso) :].lstrip(" :").strip()
            return tipo, resto or titolo
    for etichetta in issue.get("labels") or []:
        nome = etichetta.get("name") if isinstance(etichetta, Mapping) else etichetta
        tipo = _ETICHETTE_TIPO.get(str(nome or "").strip().casefold())
        if tipo:
            return tipo, titolo
    return "", titolo


async def async_create_issue(
    hass: HomeAssistant, token: str, ticket: Mapping[str, Any]
) -> dict[str, Any]:
    """Apri la issue a nome di chi ha scritto la segnalazione.

    Senza etichette, e non per dimenticanza: GitHub le scarta quando a
    scriverle e' qualcuno che sulla repository non ha i permessi, cioe'
    esattamente chi apre le segnalazioni. Mandarle sarebbe stato scrivere una
    riga che non arriva, e credere di averla scritta.

    Le mette invece `.github/workflows/label-issues.yml`, che gira con il
    gettone della repository e i permessi ce li ha: legge il prefisso del
    titolo — `[Bug]`, `[Feature]`, `[Aiuto]`, gli stessi che i moduli di GitHub
    usano da sempre — e applica l'etichetta. Succede subito, per tutti, e senza
    dipendere dall'avere una dashboard accesa da qualche parte.
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


def _incaricati(issue: Mapping[str, Any]) -> list[str]:
    """I nomi di chi ha preso in carico la segnalazione, se qualcuno l'ha fatto."""
    grezzi = issue.get("assignees")
    if not isinstance(grezzi, list):
        # GitHub manda `assignee` singolo accanto ad `assignees` per compatibilita'
        # con la sua API di dieci anni fa. Quando la lista manca, quello resta.
        uno = issue.get("assignee")
        grezzi = [uno] if isinstance(uno, Mapping) else []
    nomi: list[str] = []
    for voce in grezzi:
        if not isinstance(voce, Mapping):
            continue
        nome = str(voce.get("login") or "").strip()
        if nome and nome not in nomi:
            nomi.append(nome)
    return nomi


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
    testo, diagnostica = diagnostica_in(_senza_allegati(corpo))
    return {
        "number": int(issue.get("number") or number),
        "body": testo,
        "diagnostics": diagnostica,
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


async def async_assign_issue(
    hass: HomeAssistant, token: str, number: int, *, login: str, take: bool = True
) -> None:
    """Prendi in carico la segnalazione, o lasciala. E' l'assegnazione di GitHub.

    Si scrive l'elenco intero invece di aggiungere e togliere un nome:
    l'indirizzo che aggiunge e quello che toglie sono due, e in una casa con
    un manutentore solo «chi ce l'ha in carico» e' una cosa sola. Scrivere
    l'elenco dice esattamente quello che si vuole — o lui, o nessuno — e non
    lascia mai due assegnatari per una svista.

    Assegnare chiede di poter scrivere sulla repository, e infatti questo lo
    puo' fare solo la console. GitHub, a chi non ne ha il diritto, l'elenco lo
    scarta in silenzio — come fa con le etichette — quindi il permesso va
    verificato prima di qui, non dedotto da una risposta che torna comunque
    verde.
    """
    await _request(
        hass,
        "PATCH",
        f"{GITHUB_API}/repos/{REPOSITORY}/issues/{int(number)}",
        token=token,
        payload={"assignees": [login] if take else []},
    )


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


# Quante issue per pagina. Cinquanta e non cento, che pure GitHub accetterebbe:
# una issue nell'elenco pesa qualche kilobyte fra indirizzi, autore, etichette
# e reazioni, e cento sfiorano il tetto dei 512 KB che questo client si e'
# dato. Sfiorarlo vorrebbe dire una console che il giorno delle centouno issue
# smette di aprirsi, per un motivo che con le segnalazioni non c'entra niente.
# Il numero di pagine non e' un limite a cosa si vede: il ciclo va fino in
# fondo, e una pagina piccola costa una richiesta in piu', non una riga in meno.
_PER_PAGINA = 50

# Quante pagine si arriva a chiedere per gli aperti. Cinquanta per venti fanno
# mille: oltre quella soglia il problema di chi tiene la repository non e' piu'
# la paginazione. Il tetto c'e' perche' un ciclo che si fida di dove finisce
# l'elenco altrui e' un ciclo che un giorno non finisce.
_PAGINE_MAX = 20


async def _async_issues_page(
    hass: HomeAssistant, token: str, *, stato: str, quante: int, per: str, pagina: int
) -> tuple[list[dict[str, Any]], int]:
    """Una pagina di issue, gia' ridotta a quello che la console mostra.

    Torna anche quante righe grezze ha mandato GitHub, e serve: le pull request
    si scartano qui dentro, quindi la lunghezza dell'elenco ridotto non dice se
    la pagina era piena. Senza quel numero, una pagina di cento fatta di
    novantanove PR sembrerebbe la fine dell'elenco.
    """
    from .ticket_store import STATE_SENT, STATE_TRIAGED

    issues = await _request(
        hass,
        "GET",
        f"{GITHUB_API}/repos/{REPOSITORY}/issues?state={stato}&per_page={quante}"
        f"&sort={per}&direction=desc&page={pagina}",
        token=token,
    )
    if not isinstance(issues, list):
        return [], 0
    coda: list[dict[str, Any]] = []
    for issue in issues:
        if not isinstance(issue, dict) or "pull_request" in issue:
            continue
        corpo = str(issue.get("body") or "")
        testo, diagnostica = diagnostica_in(
            _senza_allegati(corpo.replace(TICKET_MARKER, ""))
        )
        tipo, titolo = _tipo_e_titolo(issue)
        # Quanti commenti ci sono si sa dall'elenco, senza aprire niente: e' il
        # segno che dice quali valga la pena guardare.
        commenti = int(issue.get("comments") or 0)
        incaricati = _incaricati(issue)
        voce_stato = _state_from_issue(issue, "")
        if voce_stato == STATE_SENT and incaricati:
            # «In lavorazione» adesso ha un segno vero: l'assegnazione, che il
            # tasto «Prendo in carico» scrive su GitHub e che l'elenco riporta
            # senza chiedere niente in piu'.
            #
            # Prima lo si deduceva dai commenti — una aperta su cui si era gia'
            # parlato era in lavorazione — perche' un segno vero non c'era. Era
            # una supposizione, e sbagliava nel verso peggiore: bastava una
            # domanda di chiarimento per far risultare presa in carico una
            # segnalazione che nessuno aveva ancora guardato.
            voce_stato = STATE_TRIAGED
        coda.append(
            {
                "number": int(issue.get("number") or 0),
                "title": titolo,
                "body": testo,
                "diagnostics": diagnostica,
                "type": tipo,
                "state": voce_stato,
                # Da dove viene: la riga invisibile nel corpo la mette solo la
                # plancia. Non cambia cosa si puo' fare — si risponde e si
                # chiude allo stesso modo — ma dice se chi ha scritto la
                # risposta se la ritrovera' anche dentro la sua dashboard.
                "origin": "plancia" if TICKET_MARKER in corpo else "github",
                "issue_url": str(issue.get("html_url") or ""),
                "author": str((issue.get("user") or {}).get("login") or ""),
                # Quando e' stata aperta, come GitHub la scrive (ISO 8601, UTC).
                # Il giorno lo decide il browser, che e' l'unico a sapere in che
                # fuso sta chi guarda: «oggi» a Roma e «oggi» a Auckland non
                # sono lo stesso intervallo, e deciderlo qui sarebbe deciderlo
                # nel fuso del server.
                "created_at": str(issue.get("created_at") or ""),
                "comments": commenti,
                # Chi l'ha presa in carico, se qualcuno l'ha fatto. Il
                # cruscotto ne ha bisogno per sapere se il tasto va disegnato
                # premuto, e per dire il nome quando i manutentori sono due.
                "assignees": incaricati,
                "attachments": len(attachments_in(corpo)),
            }
        )
    return coda, len(issues)


async def async_queue(hass: HomeAssistant, token: str) -> list[dict[str, Any]]:
    """Tutta la coda del manutentore: quello che c'e' sulla repository.

    Non piu' le sole segnalazioni nate dalla plancia. Chi tiene la repository
    ha un posto solo da guardare, e le issue aperte a mano su GitHub — che oggi
    sono la maggioranza, e lo resteranno per un pezzo — non possono essere
    proprio quelle che spariscono. Da dove viene ognuna lo dice `origin`.

    Gli aperti e i chiusi si chiedono separati, e non per distrazione:
    `state=all` su una pagina sola vuol dire che, appena i chiusi passano il
    centinaio, gli aperti piu' vecchi escono dall'elenco senza che nessuno lo
    dica.

    E gli aperti si chiedono **a pagine**, fino in fondo. Cento per volta non
    basta a dire «tutti»: quell'indirizzo di GitHub restituisce anche le pull
    request, che di qui si scartano ma la loro riga in pagina se la prendono,
    quindi il centinaio si esaurisce prima di quanto sembri. Fermarsi alla
    prima pagina avrebbe rifatto, un po' piu' in la', lo stesso danno che
    `state=all` faceva subito.

    I chiusi restano una pagina sola: sono storia, e bastano i piu' freschi.
    """
    aperte: list[dict[str, Any]] = []
    for pagina in range(1, _PAGINE_MAX + 1):
        voci, grezze = await _async_issues_page(
            hass, token, stato="open", quante=_PER_PAGINA, per="created", pagina=pagina
        )
        aperte += voci
        # Una pagina non piena e' l'ultima. E' l'unico segnale che si ha senza
        # leggere l'intestazione `Link`, che questo client non conserva.
        if grezze < _PER_PAGINA:
            break
    chiuse, _ = await _async_issues_page(
        hass, token, stato="closed", quante=_PER_PAGINA, per="updated", pagina=1
    )
    return [*aperte, *chiuse]


# Quante righe si guardano in un giro del campanello. Cinquanta segnalazioni
# toccate in cinque minuti non succede: il tetto c'e' perche' la prima
# accensione, che chiede senza `since`, non si porti dietro l'intera storia
# della repository per poi buttarla via.
_PER_PAGINA_AVVISI = 50


async def async_updated_since(
    hass: HomeAssistant, token: str, *, since: str = ""
) -> list[dict[str, Any]]:
    """Cosa si e' mosso da un certo momento in poi. Una richiesta, non venti.

    E' il giro del campanello, e la forma conta piu' del contenuto. Rileggere
    una per una le segnalazioni aperte per scoprire se qualcuno ha scritto
    sarebbe stato venti richieste ogni cinque minuti — duecentoquaranta all'ora
    — per sentirsi rispondere quasi sempre «no». GitHub un modo per chiederlo
    in una volta ce l'ha: `since`, che restituisce solo quello che e' cambiato
    dopo quel momento, e nell'elenco c'e' gia' il numero dei commenti.

    Quel numero e' tutto quello che serve. Non dice **chi** ha scritto — per
    saperlo bisognerebbe aprire i commenti, cioe' tornare a una chiamata per
    riga — ma dice **quanti**, e chi tiene il conto di quanti ne aveva visti
    sa che ne sono arrivati di nuovi. Chi li ha scritti si legge aprendo il
    filo, che e' esattamente il gesto che il campanello serve a provocare.

    L'ordine e' `updated` decrescente: se un giorno le righe non ci stessero in
    una pagina, quelle che restano fuori sono le meno recenti, non a caso.
    """
    query = [
        "state=all",
        "sort=updated",
        "direction=desc",
        f"per_page={_PER_PAGINA_AVVISI}",
    ]
    if since:
        query.append(f"since={quote(since, safe='')}")
    righe = await _request(
        hass,
        "GET",
        f"{GITHUB_API}/repos/{REPOSITORY}/issues?{'&'.join(query)}",
        token=token,
    )
    if not isinstance(righe, list):
        return []
    fuori: list[dict[str, Any]] = []
    for riga in righe:
        if not isinstance(riga, dict) or "pull_request" in riga:
            continue
        numero = int(riga.get("number") or 0)
        if not numero:
            continue
        _, titolo = _tipo_e_titolo(riga)
        fuori.append(
            {
                "number": numero,
                "title": titolo,
                "comments": int(riga.get("comments") or 0),
                "state": str(riga.get("state") or "open"),
                "updated_at": str(riga.get("updated_at") or ""),
                "issue_url": str(riga.get("html_url") or ""),
                "author": str((riga.get("user") or {}).get("login") or ""),
                "origin": (
                    "plancia"
                    if TICKET_MARKER in str(riga.get("body") or "")
                    else "github"
                ),
            }
        )
    return fuori
