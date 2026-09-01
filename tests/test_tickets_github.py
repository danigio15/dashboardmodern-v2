"""La consegna su GitHub, col device flow e le issue simulati.

Quello che si prova qui e' il contratto verso GitHub: cosa parte — e
soprattutto cosa non parte — chi puo' aprire la console, e come lo stato di
una issue diventa lo stato che la plancia mostra.

GitHub non viene mai chiamato davvero: al suo posto c'e' `_request`, l'unica
porta da cui questo modulo esce. Sostituirla li' invece che a valle vuol dire
che tutto il resto — intestazioni, tetti, percorsi — resta il codice vero.
"""

from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import github_client, tickets
from custom_components.dashboardmodern.const import (
    DOMAIN,
    OPTION_TICKETS_ENABLED,
    TICKET_MARKER,
)
from custom_components.dashboardmodern.github_client import DevicePending, GitHubError
from custom_components.dashboardmodern.github_tokens import async_get_token_store
from custom_components.dashboardmodern.ticket_store import (
    STATE_CLOSED,
    STATE_DRAFT,
    STATE_RESOLVED,
    STATE_SENT,
    STATE_TRIAGED,
    TYPE_BUG,
    async_get_ticket_store,
)


def _entry(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, data={"name": "Plancia", "primary": True}, options=options
    )
    entry.add_to_hass(hass)
    return entry


class FakeGitHub:
    """Prende il posto di ``github_client._request``.

    Registra ogni chiamata — metodo, indirizzo, gettone, corpo — e risponde
    quello che le si e' detto di rispondere per quell'indirizzo.
    """

    def __init__(self) -> None:
        """Nessuna risposta preparata, nessuna chiamata ricevuta."""
        self.calls: list[dict[str, Any]] = []
        self.answers: dict[str, Any] = {}
        self.raises: Exception | None = None

    def answer(self, frammento: str, risposta: Any) -> None:
        """Rispondi cosi' agli indirizzi che contengono questo frammento."""
        self.answers[frammento] = risposta

    async def __call__(
        self,
        hass: HomeAssistant,
        method: str,
        url: str,
        *,
        token: str = "",
        payload: Any = None,
        accept: str = "",
    ) -> Any:
        """La chiamata che il modulo crede di fare verso GitHub."""
        self.calls.append(
            {"method": method, "url": url, "token": token, "payload": payload}
        )
        if self.raises is not None:
            raise self.raises
        for frammento, risposta in self.answers.items():
            if frammento in url:
                return risposta
        return {}


@pytest.fixture
def github(monkeypatch: pytest.MonkeyPatch) -> FakeGitHub:
    """Sostituisci la sola porta verso la rete, e accendi l'autorizzazione."""
    finto = FakeGitHub()
    monkeypatch.setattr(github_client, "_request", finto)
    monkeypatch.setattr(github_client, "GITHUB_CLIENT_ID", "Iv1.finto")
    monkeypatch.setattr(github_client, "configured", lambda: True)
    return finto


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


async def _bozza(hass: HomeAssistant, **kwargs: Any) -> dict[str, Any]:
    store = await async_get_ticket_store(hass)
    campi: dict[str, Any] = {
        "ticket_type": TYPE_BUG,
        "title": "Le tapparelle non si fermano",
        "body": "Premo stop e continuano a scendere.",
        "contact": "anna@example.com",
        "diagnostics": {"ha_version": "2026.8.0"},
        "opened_by": "anna",
    }
    campi.update(kwargs)
    return await store.async_create(**campi)


# ─── L'autorizzazione ────────────────────────────────────────────────────────


async def test_il_codice_da_digitare_arriva_da_github(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Lo stesso giro che HACS fa gia' fare: un codice e un indirizzo."""
    _entry(hass)
    github.answer(
        "login/device/code",
        {
            "device_code": "dc-1",
            "user_code": "ABCD-1234",
            "verification_uri": "https://github.com/login/device",
            "interval": 5,
            "expires_in": 900,
        },
    )
    avvio = await tickets.async_begin_auth(hass)
    assert avvio["user_code"] == "ABCD-1234"
    assert avvio["verification_uri"] == "https://github.com/login/device"


async def test_chi_non_ha_ancora_finito_non_e_un_guasto(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """`authorization_pending` e' la risposta normale delle prime volte."""
    _entry(hass)
    github.answer("oauth/access_token", {"error": "authorization_pending"})
    with pytest.raises(DevicePending) as attesa:
        await tickets.async_finish_auth(hass, user_id="anna", device_code="dc-1")
    assert attesa.value.interval >= 1


async def test_slow_down_allunga_l_attesa_che_chiede_github(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """L'attesa la decide GitHub, non la plancia."""
    _entry(hass)
    github.answer("oauth/access_token", {"error": "slow_down", "interval": 15})
    with pytest.raises(DevicePending) as attesa:
        await tickets.async_finish_auth(hass, user_id="anna", device_code="dc-1")
    assert attesa.value.interval == 15


async def test_un_codice_scaduto_lo_dice_col_suo_codice(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Il frontend sceglie cosa dire in base al codice, non al testo."""
    _entry(hass)
    github.answer("oauth/access_token", {"error": "expired_token"})
    with pytest.raises(GitHubError) as errore:
        await tickets.async_finish_auth(hass, user_id="anna", device_code="dc-1")
    assert errore.value.code == "expired"


async def test_collegarsi_ricorda_chi_e_e_cosa_puo_fare(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Chi tiene la repository lo dice GitHub, non una lista scritta a mano."""
    _entry(hass)
    github.answer("oauth/access_token", {"access_token": "gho_segreto"})
    github.answer("/user", {"login": "anna-hub"})
    github.answer("/repos/", {"permissions": {"push": True}})
    account = await tickets.async_finish_auth(hass, user_id="anna", device_code="dc-1")
    assert account == {"connected": True, "login": "anna-hub", "maintainer": True}


async def test_chi_non_puo_scrivere_non_e_il_manutentore(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Un utente qualunque autorizza e apre segnalazioni, e basta."""
    _entry(hass)
    github.answer("oauth/access_token", {"access_token": "gho_segreto"})
    github.answer("/user", {"login": "bruno-hub"})
    github.answer("/repos/", {"permissions": {"push": False}})
    account = await tickets.async_finish_auth(hass, user_id="bruno", device_code="dc-1")
    assert account["maintainer"] is False


async def test_il_gettone_non_esce_mai_dal_deposito(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Da qui esce chi ha autorizzato. Il gettone lo legge solo chi chiama GitHub."""
    _entry(hass)
    await _collega(hass, "anna")
    store = await async_get_token_store(hass)
    assert "gho_anna" not in repr(store.describe("anna"))


async def test_scollegare_toglie_il_gettone(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Meta' del gesto: qui sparisce, su GitHub si revoca da GitHub."""
    _entry(hass)
    await _collega(hass, "anna")
    assert await tickets.async_forget_auth(hass, "anna") is True
    store = await async_get_token_store(hass)
    assert store.describe("anna")["connected"] is False


# ─── La consegna ─────────────────────────────────────────────────────────────


async def test_una_segnalazione_diventa_una_issue(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Consegnata: numero e indirizzo restano scritti sul ticket."""
    _entry(hass)
    await _collega(hass, "anna")
    github.answer(
        "/issues",
        {
            "number": 42,
            "html_url": "https://github.com/danigio15/dashboardmodern-v2/issues/42",
        },
    )
    await _bozza(hass)
    assert await tickets.async_deliver_pending(hass) == 1
    store = await async_get_ticket_store(hass)
    consegnata = store.list(every=True)[0]
    assert consegnata["state"] == STATE_SENT
    assert consegnata["remote_id"] == "42"
    assert consegnata["issue_url"].endswith("/issues/42")


async def test_la_issue_nasce_col_gettone_di_chi_ha_scritto(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """A nome suo, non del primo utente della casa che si e' autorizzato."""
    _entry(hass)
    await _collega(hass, "anna")
    await _collega(hass, "bruno")
    github.answer(
        "/issues", {"number": 7, "html_url": "https://github.com/x/y/issues/7"}
    )
    await _bozza(hass, opened_by="bruno")
    await tickets.async_deliver_pending(hass)
    assert github.calls[0]["token"] == "gho_bruno"


async def test_il_contatto_non_finisce_nella_pagina_pubblica(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Una issue e' pubblica. Chi ha scritto il proprio indirizzo lo ha
    scritto a una persona, e resta in casa per la console."""
    _entry(hass)
    await _collega(hass, "anna")
    github.answer(
        "/issues", {"number": 7, "html_url": "https://github.com/x/y/issues/7"}
    )
    await _bozza(hass, contact="anna@example.com")
    await tickets.async_deliver_pending(hass)
    corpo = github.calls[0]["payload"]
    assert "anna@example.com" not in repr(corpo)
    assert "2026.8.0" in corpo["body"]
    assert TICKET_MARKER in corpo["body"]


async def test_la_issue_nasce_senza_etichette(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """GitHub le scarterebbe: chi apre la segnalazione non ha i permessi."""
    _entry(hass)
    await _collega(hass, "anna")
    github.answer(
        "/issues", {"number": 7, "html_url": "https://github.com/x/y/issues/7"}
    )
    await _bozza(hass)
    await tickets.async_deliver_pending(hass)
    assert "labels" not in github.calls[0]["payload"]


async def test_senza_account_collegato_la_bozza_resta_bozza(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Non e' un guasto: manca la firma, e il testo non si perde."""
    _entry(hass)
    await _bozza(hass)
    assert await tickets.async_deliver_pending(hass) == 0
    assert github.calls == []
    store = await async_get_ticket_store(hass)
    rimasta = store.list(every=True)[0]
    assert rimasta["state"] == STATE_DRAFT
    assert "Collega GitHub" in rimasta["delivery_error"]


async def test_ognuno_consegna_le_proprie(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Il comando di chi scrive non spedisce le bozze di un altro."""
    _entry(hass)
    await _collega(hass, "anna")
    await _collega(hass, "bruno")
    github.answer(
        "/issues", {"number": 7, "html_url": "https://github.com/x/y/issues/7"}
    )
    await _bozza(hass, opened_by="anna", title="Di Anna")
    await _bozza(hass, opened_by="bruno", title="Di Bruno")
    assert await tickets.async_deliver_pending(hass, user_id="anna") == 1
    assert len(github.calls) == 1


async def test_github_muto_non_perde_la_segnalazione(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Resta bozza, con scritto perche'; al giro dopo riparte da sola."""
    _entry(hass)
    await _collega(hass, "anna")
    github.raises = GitHubError("unreachable", "GitHub non raggiungibile.")
    await _bozza(hass)
    assert await tickets.async_deliver_pending(hass) == 0
    store = await async_get_ticket_store(hass)
    assert store.list(every=True)[0]["state"] == STATE_DRAFT

    github.raises = None
    github.answer(
        "/issues", {"number": 9, "html_url": "https://github.com/x/y/issues/9"}
    )
    assert await tickets.async_deliver_pending(hass) == 1
    assert store.list(every=True)[0]["state"] == STATE_SENT


async def test_spegnendole_non_parte_niente(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """L'interruttore vale davvero, autorizzazione o no."""
    _entry(hass, **{OPTION_TICKETS_ENABLED: False})
    await _collega(hass, "anna")
    await _bozza(hass)
    assert await tickets.async_deliver_pending(hass) == 0
    assert github.calls == []


# ─── Il ritorno ──────────────────────────────────────────────────────────────


async def _consegnata(hass: HomeAssistant, github: FakeGitHub) -> None:
    await _collega(hass, "anna")
    github.answer(
        "/issues", {"number": 42, "html_url": "https://github.com/x/y/issues/42"}
    )
    await _bozza(hass)
    await tickets.async_deliver_pending(hass)
    github.answers.clear()


async def test_una_risposta_del_manutentore_torna_a_casa(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Chi ha segnalato vede «presa in carico» senza chiedere niente."""
    _entry(hass)
    await _consegnata(hass, github)
    github.answer(
        "/issues/42/comments",
        [{"body": "Riprodotta, ci sto lavorando.", "author_association": "OWNER"}],
    )
    github.answer(
        "/issues/42",
        {
            "number": 42,
            "state": "open",
            "comments": 1,
            "html_url": "https://github.com/x/y/issues/42",
        },
    )
    assert await tickets.async_sync_states(hass) == 1
    store = await async_get_ticket_store(hass)
    aggiornata = store.list(every=True)[0]
    assert aggiornata["state"] == STATE_TRIAGED
    assert aggiornata["reply"] == "Riprodotta, ci sto lavorando."


async def test_il_commento_di_un_passante_non_e_una_risposta(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Chi conta lo dice GitHub su ogni commento, senza una chiamata in piu'."""
    _entry(hass)
    await _consegnata(hass, github)
    github.answer(
        "/issues/42/comments",
        [{"body": "Capita anche a me!", "author_association": "NONE"}],
    )
    github.answer(
        "/issues/42",
        {
            "number": 42,
            "state": "open",
            "comments": 1,
            "html_url": "https://github.com/x/y/issues/42",
        },
    )
    await tickets.async_sync_states(hass)
    store = await async_get_ticket_store(hass)
    aggiornata = store.list(every=True)[0]
    assert aggiornata["reply"] == ""
    assert aggiornata["state"] == STATE_SENT


async def test_una_issue_chiusa_e_risolta(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Lo stato non si tiene allineato a mano: lo sa gia' GitHub."""
    _entry(hass)
    await _consegnata(hass, github)
    github.answer(
        "/issues/42",
        {"number": 42, "state": "closed", "state_reason": "completed", "comments": 0},
    )
    await tickets.async_sync_states(hass)
    store = await async_get_ticket_store(hass)
    assert store.list(every=True)[0]["state"] == STATE_RESOLVED


async def test_una_issue_chiusa_senza_intervento_e_archiviata(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """`not_planned` non e' «risolta», e la differenza si vede in plancia."""
    _entry(hass)
    await _consegnata(hass, github)
    github.answer(
        "/issues/42",
        {"number": 42, "state": "closed", "state_reason": "not_planned", "comments": 0},
    )
    await tickets.async_sync_states(hass)
    store = await async_get_ticket_store(hass)
    assert store.list(every=True)[0]["state"] == STATE_CLOSED


async def test_una_issue_sparita_non_ferma_le_altre(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Il giro periodico non si pianta su una segnalazione cancellata."""
    _entry(hass)
    await _consegnata(hass, github)
    github.raises = GitHubError("not_found", "Non trovato su GitHub.")
    assert await tickets.async_sync_states(hass) == 0


# ─── La console ──────────────────────────────────────────────────────────────


async def test_la_console_chiede_i_permessi_sulla_repository(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Non basta amministrare casa propria per tenere la coda di tutti."""
    _entry(hass)
    await _collega(hass, "anna", maintainer=False)
    with pytest.raises(GitHubError) as errore:
        await tickets.async_queue(hass, "anna")
    assert errore.value.code == "not_console"
    assert github.calls == []


async def test_la_coda_mostra_solo_le_segnalazioni_nate_dalla_plancia(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Si riconoscono dalla riga invisibile, non da un'etichetta."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues?",
        [
            {
                "number": 1,
                "title": "Dalla plancia",
                "body": f"testo\n{TICKET_MARKER}",
                "state": "open",
                "comments": 0,
                "user": {"login": "anna-hub"},
            },
            {
                "number": 2,
                "title": "Aperta a mano su GitHub",
                "body": "testo",
                "state": "open",
                "comments": 0,
                "user": {"login": "tizio"},
            },
        ],
    )
    coda = await tickets.async_queue(hass, "dani")
    assert [voce["number"] for voce in coda] == [1]
    # La riga invisibile non si mostra a chi legge la coda.
    assert TICKET_MARKER not in coda[0]["body"]


async def test_una_pull_request_non_e_una_segnalazione(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """L'elenco delle issue di GitHub contiene anche le PR: si scartano."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues?",
        [
            {
                "number": 3,
                "title": "Una PR",
                "body": TICKET_MARKER,
                "state": "open",
                "comments": 0,
                "pull_request": {"url": "..."},
                "user": {"login": "x"},
            },
        ],
    )
    assert await tickets.async_queue(hass, "dani") == []


async def test_rispondere_scrive_un_commento_su_github(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Un posto solo, non due da tenere allineati."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer("/comments", {"html_url": "https://github.com/x/y/issues/1#c"})
    fatto = await tickets.async_answer(
        hass, user_id="dani", number=1, reply="Riprodotta."
    )
    assert fatto["commented"] is True
    chiamata = github.calls[0]
    assert chiamata["payload"] == {"body": "Riprodotta."}
    assert chiamata["token"] == "gho_dani"


async def test_chiudere_come_risolta_e_come_archiviata(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Le due chiusure di GitHub, dette dalla console."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    await tickets.async_answer(hass, user_id="dani", number=1, close="risolto")
    assert github.calls[-1]["payload"]["state_reason"] == "completed"
    await tickets.async_answer(hass, user_id="dani", number=2, close="chiuso")
    assert github.calls[-1]["payload"]["state_reason"] == "not_planned"


async def test_una_risposta_vuota_non_scrive_niente(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Uno spazio non e' una risposta, e un commento vuoto e' rumore."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    fatto = await tickets.async_answer(hass, user_id="dani", number=1, reply="   ")
    assert fatto == {"commented": False, "closed": False}
    assert github.calls == []
