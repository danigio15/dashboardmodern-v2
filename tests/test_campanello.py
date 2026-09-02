"""Il campanello suona per i messaggi degli altri, e una volta sola.

Quattro cose sono facili da sbagliare qui, e sono tutte cose che si scoprono
solo in casa d'altri: suonare al primo avvio per messaggi di settimane prima,
risuonare a ogni riavvio di Home Assistant, suonare per la frase che si e'
appena battuta, e far arrivare a chi la plancia la usa e basta le
conversazioni di sconosciuti. Ognuna ha la sua prova qui sotto.

GitHub non viene mai chiamato davvero: al suo posto c'e' `_request`, come nelle
altre prove delle segnalazioni.
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

from custom_components.dashboardmodern import tickets
from custom_components.dashboardmodern.const import DOMAIN, EVENT_TICKET_MESSAGE
from custom_components.dashboardmodern.github_client import GitHubError
from custom_components.dashboardmodern.github_tokens import async_get_token_store
from custom_components.dashboardmodern.ticket_store import (
    TYPE_BUG,
    async_get_ticket_store,
)
from custom_components.dashboardmodern.ticket_watch import (
    MAX_SEGNI,
    TicketWatch,
    async_get_watch,
)

from .test_tickets_github import FakeGitHub


@pytest.fixture
def github(monkeypatch: pytest.MonkeyPatch) -> FakeGitHub:
    """La stessa porta finta delle altre prove: `github_client._request`.

    La classe si prende in prestito da `test_tickets_github`; l'aggancio no.
    Importare anche la fixture avrebbe voluto dire, in ogni prova qui sotto, un
    parametro che nasconde il nome importato — funziona, e a leggerlo sembra un
    errore.
    """
    from custom_components.dashboardmodern import github_client

    finto = FakeGitHub()
    monkeypatch.setattr(github_client, "_request", finto)
    monkeypatch.setattr(github_client, "GITHUB_CLIENT_ID", "Iv1.finto")
    monkeypatch.setattr(github_client, "configured", lambda: True)
    return finto


def _entry(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, data={"name": "Plancia", "primary": True}, options=options
    )
    entry.add_to_hass(hass)
    return entry


async def _collega(
    hass: HomeAssistant, user_id: str = "anna", *, maintainer: bool = False
) -> None:
    store = await async_get_token_store(hass)
    await store.async_remember(
        user_id,
        token=f"gho_{user_id}",
        login=f"{user_id}-hub",
        maintainer=maintainer,
    )


def _riga(numero: int, *, commenti: int = 0, quando: str = "") -> dict[str, Any]:
    return {
        "number": numero,
        "title": f"segnalazione {numero}",
        "body": "x",
        "state": "open",
        "comments": commenti,
        "updated_at": quando or f"2026-09-0{numero}T10:00:00Z",
        "html_url": f"https://github.com/danigio15/dashboardmodern-v2/issues/{numero}",
        "user": {"login": "anna-hub"},
    }


def _ascolta(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Raccogli gli eventi del campanello finche' dura la prova."""
    suonate: list[dict[str, Any]] = []
    hass.bus.async_listen(
        EVENT_TICKET_MESSAGE, lambda evento: suonate.append(evento.data)
    )
    return suonate


async def _mia(hass: HomeAssistant, numero: int, *, opened_by: str = "anna") -> None:
    """Una segnalazione gia' partita, di questo utente."""
    store = await async_get_ticket_store(hass)
    ticket = await store.async_create(
        ticket_type=TYPE_BUG,
        title=f"la mia {numero}",
        body="Non funziona.",
        opened_by=opened_by,
    )
    await store.async_mark_sent(ticket["id"], str(numero))


# ─── Il primo giro, e i riavvii ──────────────────────────────────────────────


async def test_il_primo_giro_non_suona_ma_prende_nota(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Alla prima accensione tutto quello che c'e' e' gia' successo.

    Suonare li' avrebbe voluto dire venti notifiche in fila al primo avvio, per
    messaggi di settimane prima: il modo piu' rapido per far spegnere una
    funzione il giorno stesso in cui la si accende.
    """
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer("/issues?", [_riga(1, commenti=3), _riga(2)])

    assert await tickets.async_watch_messages(hass) == []

    watch = await async_get_watch(hass)
    assert watch.since == "2026-09-02T10:00:00Z"
    assert watch.acceso


async def test_dopo_il_primo_giro_un_commento_nuovo_suona(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Il numero dei commenti e' cresciuto: qualcuno ha scritto."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    suonate = _ascolta(hass)

    github.answer("/issues?", [_riga(1, commenti=1)])
    await tickets.async_watch_messages(hass)

    github.answer("/issues?", [_riga(1, commenti=3, quando="2026-09-05T08:00:00Z")])
    nuovi = await tickets.async_watch_messages(hass)
    await hass.async_block_till_done()

    assert [voce["number"] for voce in nuovi] == [1]
    assert nuovi[0]["messages"] == 2
    assert nuovi[0]["opened"] is False
    assert [evento["number"] for evento in suonate] == [1]
    assert suonate[0]["console"] is True

    # E la campanella di Home Assistant, per chi automazioni non ne scrive.
    campanelle = persistent_notification._async_get_or_create_notifications(hass)
    campanella = campanelle["dashboardmodern_messaggio_1"]
    assert "2 messaggi nuovi" in campanella["message"]
    assert "Cruscotto" in campanella["message"]


async def test_lo_stesso_messaggio_non_suona_due_volte(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Il giro dopo trova lo stesso numero: non e' successo niente di nuovo."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer("/issues?", [_riga(1, commenti=1)])
    await tickets.async_watch_messages(hass)
    github.answer("/issues?", [_riga(1, commenti=2, quando="2026-09-05T08:00:00Z")])
    assert len(await tickets.async_watch_messages(hass)) == 1
    assert await tickets.async_watch_messages(hass) == []


async def test_il_taccuino_sopravvive_al_riavvio(hass: HomeAssistant) -> None:
    """Home Assistant si riavvia a ogni aggiornamento: il segno resta scritto.

    Tenerlo in memoria avrebbe voluto dire un campanello che risuona per
    messaggi gia' letti ogni volta che si installa una versione nuova, cioe'
    spesso.
    """
    watch = TicketWatch(hass)
    await watch.async_load()
    await watch.async_ricorda([_riga(7, commenti=2)])

    dopo = TicketWatch(hass)
    await dopo.async_load()
    assert dopo.since == "2026-09-07T10:00:00Z"
    assert dopo.nuovi([_riga(7, commenti=2)], mie=None) == []
    assert len(dopo.nuovi([_riga(7, commenti=3)], mie=None)) == 1


# ─── I propri messaggi ───────────────────────────────────────────────────────


async def test_la_risposta_della_console_non_si_fa_suonare_addosso(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Sentire il campanello per la frase appena battuta e' il modo di spegnerlo."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer("/issues?", [_riga(4, commenti=1)])
    await tickets.async_watch_messages(hass)

    await tickets.async_answer(
        hass, user_id="dani", number=4, reply="Provo a guardare."
    )

    github.answer("/issues?", [_riga(4, commenti=2, quando="2026-09-09T09:00:00Z")])
    assert await tickets.async_watch_messages(hass) == []


async def test_il_messaggio_di_chi_ha_segnalato_non_gli_torna_indietro(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Vale nei due sensi: chi scrive non si sente suonare la propria riga."""
    _entry(hass)
    await _collega(hass, "anna")
    await _mia(hass, 4)
    github.answer("/issues?", [_riga(4, commenti=1)])
    await tickets.async_watch_messages(hass)

    await tickets.async_reply(hass, user_id="anna", number=4, message="Ho provato.")

    github.answer("/issues?", [_riga(4, commenti=2, quando="2026-09-09T09:00:00Z")])
    assert await tickets.async_watch_messages(hass) == []


# ─── Chi sente cosa ──────────────────────────────────────────────────────────


async def test_chi_usa_la_plancia_sente_solo_le_sue(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Le altre sono conversazioni fra sconosciuti: sarebbero lo spam di un tracker."""
    _entry(hass)
    await _collega(hass, "anna")
    await _mia(hass, 4)
    github.answer("/issues?", [_riga(4, commenti=1), _riga(9, commenti=1)])
    await tickets.async_watch_messages(hass)

    github.answer(
        "/issues?",
        [
            _riga(4, commenti=2, quando="2026-09-09T09:00:00Z"),
            _riga(9, commenti=5, quando="2026-09-09T09:30:00Z"),
        ],
    )
    nuovi = await tickets.async_watch_messages(hass)
    assert [voce["number"] for voce in nuovi] == [4]


async def test_una_risposta_su_una_gia_chiusa_arriva_lo_stesso(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """La sync i chiusi li salta, il campanello no.

    Sono due domande diverse: «cosa devo rileggere» e «quali conversazioni sono
    mie». Una risposta arrivata sotto una segnalazione chiusa la settimana
    prima e' esattamente il messaggio che non si vuole perdere.
    """
    _entry(hass)
    await _collega(hass, "anna")
    store = await async_get_ticket_store(hass)
    ticket = await store.async_create(
        ticket_type=TYPE_BUG, title="vecchia", body="x", opened_by="anna"
    )
    await store.async_mark_sent(ticket["id"], "4")
    await store.async_merge_remote([{"remote_id": "4", "state": "risolto"}])
    assert store.remote_ids() == []

    github.answer("/issues?", [_riga(4, commenti=1)])
    await tickets.async_watch_messages(hass)
    github.answer("/issues?", [_riga(4, commenti=2, quando="2026-09-09T09:00:00Z")])
    assert [voce["number"] for voce in await tickets.async_watch_messages(hass)] == [4]


async def test_una_segnalazione_appena_aperta_suona_al_manutentore(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Zero commenti e mai vista: la novita' e' la segnalazione stessa."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer("/issues?", [_riga(1, commenti=1)])
    await tickets.async_watch_messages(hass)

    github.answer(
        "/issues?",
        [_riga(1, commenti=1), _riga(2, commenti=0, quando="2026-09-09T09:00:00Z")],
    )
    nuovi = await tickets.async_watch_messages(hass)
    assert [(voce["number"], voce["opened"]) for voce in nuovi] == [(2, True)]


async def test_senza_gettone_il_campanello_non_esce_di_casa(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Dodici richieste l'ora su un tetto di sessanta e' un campanello che tace.

    Il gettone non serve a farsi riconoscere — la repository e' pubblica — ma
    porta il tetto a cinquemila. Senza, il giro non parte proprio.
    """
    _entry(hass)
    assert await tickets.async_watch_messages(hass) == []
    assert github.calls == []


async def test_chi_non_ha_segnalato_niente_non_chiede_niente(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Nessuna segnalazione propria: non c'e' niente da sorvegliare."""
    _entry(hass)
    await _collega(hass, "anna")
    assert await tickets.async_watch_messages(hass) == []
    assert github.calls == []


async def test_una_richiesta_andata_male_non_ferma_il_giro_dopo(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """La rete di casa va e viene: il campanello non si rompe, salta un giro."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.raises = GitHubError("offline", "Niente rete.")
    assert await tickets.async_watch_messages(hass) == []
    github.raises = None
    github.answer("/issues?", [_riga(1, commenti=1)])
    assert await tickets.async_watch_messages(hass) == []


async def test_una_richiesta_sola_per_giro(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Venti segnalazioni aperte non fanno venti chiamate: e' il punto del giro."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer("/issues?", [_riga(numero, commenti=1) for numero in range(1, 10)])
    await tickets.async_watch_messages(hass)
    assert len(github.calls) == 1
    assert "since=" not in github.calls[0]["url"]

    await tickets.async_watch_messages(hass)
    assert len(github.calls) == 2
    assert "since=2026-09-09T10%3A00%3A00Z" in github.calls[1]["url"]


async def test_il_taccuino_non_cresce_senza_fine(hass: HomeAssistant) -> None:
    """Il numero di una issue cresce sempre: restano i piu' alti."""
    watch = TicketWatch(hass)
    await watch.async_load()
    await watch.async_ricorda(
        [
            _riga(numero, commenti=1, quando="2026-09-01T00:00:00Z")
            for numero in range(1, MAX_SEGNI + 51)
        ]
    )
    segni = watch._data["seen"]
    assert len(segni) == MAX_SEGNI
    assert min(int(numero) for numero in segni) == 51


# ─── Rispondere, e prendere in carico ────────────────────────────────────────


async def test_chi_ha_segnalato_risponde_col_proprio_gettone(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Il commento parte a nome suo, come la segnalazione. Mai a nome della console."""
    _entry(hass)
    await _collega(hass, "anna")
    await _collega(hass, "dani", maintainer=True)
    await _mia(hass, 12)

    assert await tickets.async_reply(
        hass, user_id="anna", number=12, message="  Ho provato, niente.  "
    ) == {"sent": True}
    scritta = github.calls[-1]
    assert scritta["method"] == "POST"
    assert scritta["url"].endswith("/issues/12/comments")
    assert scritta["token"] == "gho_anna"
    assert scritta["payload"] == {"body": "Ho provato, niente."}


async def test_non_si_scrive_sotto_la_segnalazione_di_un_altro(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """La finestra mostra a ognuno le sue: un tasto che agisce altrove sarebbe cieco."""
    _entry(hass)
    await _collega(hass, "anna")
    await _mia(hass, 12, opened_by="marco")
    with pytest.raises(GitHubError) as errore:
        await tickets.async_reply(hass, user_id="anna", number=12, message="ciao")
    assert errore.value.code == "not_yours"
    assert github.calls == []


async def test_un_messaggio_vuoto_non_parte(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Uno spazio non e' un messaggio."""
    _entry(hass)
    await _collega(hass, "anna")
    await _mia(hass, 12)
    with pytest.raises(GitHubError) as errore:
        await tickets.async_reply(hass, user_id="anna", number=12, message="   ")
    assert errore.value.code == "empty"
    assert github.calls == []


async def test_senza_collegamento_non_si_risponde(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Scrivere chiede una firma, e la firma e' il collegamento a GitHub."""
    _entry(hass)
    with pytest.raises(GitHubError) as errore:
        await tickets.async_reply(hass, user_id="anna", number=12, message="ciao")
    assert errore.value.code == "no_token"


async def test_prendere_in_carico_e_l_assegnazione_di_github(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Il gesto esiste gia' su GitHub: si usa quello, non un'etichetta inventata."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    assert await tickets.async_take(hass, user_id="dani", number=8) == {
        "taken": True,
        "assignee": "dani-hub",
    }
    scritta = github.calls[-1]
    assert scritta["method"] == "PATCH"
    assert scritta["url"].endswith("/issues/8")
    assert scritta["payload"] == {"assignees": ["dani-hub"]}


async def test_lasciarla_svuota_l_elenco(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Ci si puo' ripensare, e «nessuno» si scrive con l'elenco vuoto."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    assert await tickets.async_take(hass, user_id="dani", number=8, take=False) == {
        "taken": False,
        "assignee": "",
    }
    assert github.calls[-1]["payload"] == {"assignees": []}


async def test_prendere_in_carico_e_della_console(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Assegnare chiede di poter scrivere sulla repository."""
    _entry(hass)
    await _collega(hass, "anna")
    with pytest.raises(GitHubError) as errore:
        await tickets.async_take(hass, user_id="anna", number=8)
    assert errore.value.code == "not_console"
    assert github.calls == []
