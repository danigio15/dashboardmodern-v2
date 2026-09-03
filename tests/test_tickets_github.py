"""La consegna su GitHub, col device flow e le issue simulati.

Quello che si prova qui e' il contratto verso GitHub: cosa parte — e
soprattutto cosa non parte — chi puo' aprire la console, e come lo stato di
una issue diventa lo stato che la plancia mostra.

GitHub non viene mai chiamato davvero: al suo posto c'e' `_request`, l'unica
porta da cui questo modulo esce. Sostituirla li' invece che a valle vuol dire
che tutto il resto — intestazioni, tetti, percorsi — resta il codice vero.
"""

from __future__ import annotations

import json
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
from custom_components.dashboardmodern.github_client import (
    DevicePending,
    GitHubError,
    attachments_in,
)
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


async def test_il_proprietario_e_il_manutentore_anche_senza_permissions(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """La risposta «sola lettura pubblica» non gli toglie la sua coda.

    Un gettone di GitHub App su una repository dove l'App non e' installata
    riceve un oggetto senza il campo `permissions`: se contasse solo quello,
    chi tiene la repository si ritroverebbe senza console per una ragione che
    con i suoi permessi non c'entra niente.
    """
    _entry(hass)
    github.answer("oauth/access_token", {"access_token": "gho_segreto"})
    github.answer("/user", {"login": "danigio15"})
    github.answer("/repos/", {})
    account = await tickets.async_finish_auth(hass, user_id="dani", device_code="dc-1")
    assert account["maintainer"] is True


async def test_il_proprietario_si_riconosce_a_prescindere_dalle_maiuscole(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """I nomi su GitHub non distinguono maiuscole e minuscole."""
    _entry(hass)
    github.answer("oauth/access_token", {"access_token": "gho_segreto"})
    github.answer("/user", {"login": "DaniGio15"})
    github.answer("/repos/", {})
    account = await tickets.async_finish_auth(hass, user_id="dani", device_code="dc-1")
    assert account["maintainer"] is True


async def test_un_collaboratore_resta_manutentore_per_i_permessi(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Non solo il proprietario: chi puo' scrivere lo dice GitHub."""
    _entry(hass)
    github.answer("oauth/access_token", {"access_token": "gho_segreto"})
    github.answer("/user", {"login": "una-collaboratrice"})
    github.answer("/repos/", {"permissions": {"push": True}})
    account = await tickets.async_finish_auth(hass, user_id="lei", device_code="dc-1")
    assert account["maintainer"] is True


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


async def test_un_recapito_non_si_chiede_e_non_si_conserva(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Il campo «come ricontattarti» non esiste piu', a nessun livello.

    C'era, e diceva il vero: restava in casa, e nella pagina pubblica non
    finiva. Solo che in casa non lo leggeva nessuno — la console del
    manutentore legge GitHub — e chiedere un indirizzo e-mail per poi non farne
    niente e' la peggiore delle tre strade: si conserva un dato personale, non
    serve a nessuno, e chi lo scrive crede di essere raggiungibile.
    """
    _entry(hass)
    await _collega(hass, "anna")
    github.answer(
        "/issues", {"number": 7, "html_url": "https://github.com/x/y/issues/7"}
    )
    with pytest.raises(TypeError):
        await _bozza(hass, contact="anna@example.com")

    ticket = await _bozza(hass)
    assert "contact" not in ticket
    await tickets.async_deliver_pending(hass)
    corpo = github.calls[0]["payload"]
    assert "2026.8.0" in corpo["body"]
    assert TICKET_MARKER in corpo["body"]


async def test_i_recapiti_gia_scritti_spariscono_dal_disco(
    hass: HomeAssistant,
) -> None:
    """Toglierlo dal modulo non basta: quello che c'e' gia' sta sul disco.

    Chi la plancia ce l'ha da mesi si porta dietro i recapiti scritti dalle
    versioni precedenti, e senza questo resterebbero li' finche' quei ticket
    non cadono dal fondo dello store.
    """
    from homeassistant.helpers.storage import Store

    from custom_components.dashboardmodern.ticket_store import (
        STORAGE_KEY,
        STORAGE_VERSION,
        TicketStore,
    )

    deposito: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    await deposito.async_save(
        {
            "installation_id": "abc",
            "tickets": [
                {
                    "id": "t1",
                    "opened_by": "anna",
                    "type": TYPE_BUG,
                    "title": "vecchia",
                    "body": "x",
                    "contact": "anna@example.com",
                    "state": STATE_DRAFT,
                    "created_at": 1,
                    "updated_at": 1,
                }
            ],
        }
    )

    store = TicketStore(hass)
    await store.async_load()
    assert "contact" not in store.list(opened_by="anna")[0]

    # E sparisce davvero dal file, non solo da quello che si legge.
    rimasto = await Store(hass, STORAGE_VERSION, STORAGE_KEY).async_load()
    assert "contact" not in rimasto["tickets"][0]


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


async def test_la_coda_mostra_tutto_e_dice_da_dove_viene(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Anche le issue aperte a mano su GitHub: sono la maggioranza."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues?state=open",
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
    assert [voce["number"] for voce in coda] == [1, 2]
    assert [voce["origin"] for voce in coda] == ["plancia", "github"]
    # La riga invisibile non si mostra a chi legge la coda.
    assert TICKET_MARKER not in coda[0]["body"]


async def test_gli_aperti_e_i_chiusi_si_chiedono_separati(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Una pagina sola nasconderebbe gli aperti vecchi senza dirlo."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues?state=open",
        [{"number": 9, "title": "[Bug]: viva", "body": "x", "state": "open"}],
    )
    github.answer(
        "/issues?state=closed",
        [
            {
                "number": 4,
                "title": "[Feature]: fatta",
                "body": "x",
                "state": "closed",
                "state_reason": "completed",
            },
        ],
    )
    coda = await tickets.async_queue(hass, "dani")
    assert [(voce["number"], voce["state"]) for voce in coda] == [
        (9, "inviato"),
        (4, "risolto"),
    ]
    # Gli aperti si chiedono tutti; i chiusi sono storia e bastano i freschi.
    quante = github_client._PER_PAGINA
    indirizzi = [chiamata["url"] for chiamata in github.calls]
    assert any(f"state=open&per_page={quante}" in url for url in indirizzi)
    assert any(f"state=closed&per_page={quante}" in url for url in indirizzi)


async def test_il_tipo_arriva_dal_prefisso_o_dall_etichetta(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Due posti che su questa repository esistono da prima della plancia."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues?state=open",
        [
            {"number": 1, "title": "[Bug]: rotto", "body": "x", "state": "open"},
            {"number": 2, "title": "[Feature]: idea", "body": "x", "state": "open"},
            {"number": 3, "title": "[Aiuto]: come si fa", "body": "x", "state": "open"},
            {
                "number": 4,
                "title": "Senza prefisso",
                "body": "x",
                "state": "open",
                "labels": [{"name": "enhancement"}],
            },
            {"number": 5, "title": "Niente di niente", "body": "x", "state": "open"},
        ],
    )
    coda = await tickets.async_queue(hass, "dani")
    assert [voce["type"] for voce in coda] == [
        "bug",
        "feature",
        "assistenza",
        "feature",
        # Nessun segno: meglio vuoto che sceglierne uno a caso.
        "",
    ]
    # Il prefisso sparisce dal titolo: accanto c'e' gia' la pastiglia del tipo.
    assert [voce["title"] for voce in coda][:3] == ["rotto", "idea", "come si fa"]


async def test_un_titolo_di_solo_prefisso_resta_intero(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """C'e' chi apre la issue e il titolo lo lascia al modulo."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues?state=open",
        [{"number": 1, "title": "[Feature]:", "body": "x", "state": "open"}],
    )
    coda = await tickets.async_queue(hass, "dani")
    assert coda[0]["title"] == "[Feature]:"
    assert coda[0]["type"] == "feature"


async def test_in_lavorazione_e_quella_presa_in_carico(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """«In lavorazione» e' l'assegnazione, non il fatto che qualcuno abbia parlato.

    Prima lo si deduceva dai commenti, perche' un segno vero non c'era, e la
    deduzione sbagliava nel verso peggiore: una domanda di chiarimento faceva
    risultare presa in carico una segnalazione che nessuno aveva guardato.
    Adesso il segno c'e' — lo scrive il tasto «Prendo in carico» — e i commenti
    tornano a essere quello che sono: commenti.
    """
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues?state=open",
        [
            {
                "number": 1,
                "title": "parlata ma di nessuno",
                "body": "x",
                "state": "open",
                "comments": 2,
            },
            {
                "number": 2,
                "title": "presa in carico",
                "body": "x",
                "state": "open",
                "comments": 0,
                "assignees": [{"login": "danigio15"}],
            },
        ],
    )
    coda = await tickets.async_queue(hass, "dani")
    assert [voce["state"] for voce in coda] == ["inviato", "in-carico"]
    assert [voce["assignees"] for voce in coda] == [[], ["danigio15"]]


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


# ─── Allegati e filo dei commenti ────────────────────────────────────────────


def test_una_foto_trascinata_si_riconosce() -> None:
    """GitHub scrive `![](…)` quando trascini un'immagine nel riquadro."""
    allegati = attachments_in(
        "Ecco cosa vedo:\n\n"
        "![Schermata](https://github.com/user-attachments/assets/abc-123)"
    )
    assert allegati == [
        {
            "url": "https://github.com/user-attachments/assets/abc-123",
            "kind": "image",
            "name": "Schermata",
        }
    ]


def test_un_indirizzo_nudo_e_un_allegato_di_cui_non_si_sa_la_faccia() -> None:
    """Da `…/assets/<uuid>` non si capisce se sia un video o un file.

    Non si tira a indovinare: si dice che c'e', e chi guarda apre.
    """
    allegati = attachments_in(
        "Il video:\nhttps://github.com/user-attachments/assets/def-456"
    )
    assert [voce["kind"] for voce in allegati] == ["file"]


def test_lo_stesso_indirizzo_non_si_conta_due_volte() -> None:
    """GitHub a volte lo scrive due volte, e chi legge vedrebbe due allegati."""
    url = "https://github.com/user-attachments/assets/abc-123"
    assert len(attachments_in(f"![foto]({url})\n\n{url}")) == 1


def test_le_foto_vecchie_si_riconoscono_ancora() -> None:
    """Le segnalazioni di due anni fa usano l'altro dominio."""
    allegati = attachments_in(
        "![vecchia](https://user-images.githubusercontent.com/1/x.png)"
    )
    assert allegati[0]["kind"] == "image"


def test_un_link_qualunque_non_e_un_allegato() -> None:
    """Il rimando alla documentazione non deve accendere la graffetta."""
    assert attachments_in("Vedi https://www.home-assistant.io/docs/") == []


def test_un_testo_senza_niente_non_produce_niente() -> None:
    assert attachments_in("") == []
    assert attachments_in(None) == []  # type: ignore[arg-type]


async def test_il_filo_porta_commenti_e_allegati(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Quello che serve alla console per non dover uscire."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues/42/comments",
        [
            {
                "id": 1,
                "user": {"login": "anna-g"},
                "author_association": "NONE",
                "created_at": "2026-09-01T10:00:00Z",
                "body": "Ecco la schermata:\n"
                "![vista](https://github.com/user-attachments/assets/aaa)",
            },
            {
                "id": 2,
                "user": {"login": "danigio15"},
                "author_association": "OWNER",
                "created_at": "2026-09-01T11:00:00Z",
                "body": "Riprodotta.",
            },
        ],
    )
    github.answer(
        "/issues/42",
        {
            "number": 42,
            "state": "open",
            "comments": 2,
            "body": f"Il corpo.\n{TICKET_MARKER}",
            "html_url": "https://github.com/x/y/issues/42",
        },
    )
    filo = await tickets.async_thread(hass, "dani", 42)
    assert filo["body"] == "Il corpo."
    assert len(filo["comments"]) == 2
    primo = filo["comments"][0]
    assert primo["author"] == "anna-g"
    assert primo["maintainer"] is False
    assert primo["attachments"][0]["kind"] == "image"
    # L'indirizzo lungo esce dal testo e va nell'elenco: dentro la frase
    # sarebbe illeggibile, tolto e basta sarebbe perso.
    assert "user-attachments" not in primo["body"]
    assert primo["body"] == "Ecco la schermata:"
    assert filo["comments"][1]["maintainer"] is True


async def test_il_filo_deduce_lo_stato_dal_commento_del_manutentore(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Una segnalazione con una risposta e' «presa in carico», qui come altrove."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues/42/comments",
        [
            {
                "id": 1,
                "user": {"login": "danigio15"},
                "author_association": "OWNER",
                "created_at": "2026-09-01T11:00:00Z",
                "body": "Ci sto lavorando.",
            }
        ],
    )
    github.answer(
        "/issues/42", {"number": 42, "state": "open", "comments": 1, "body": "x"}
    )
    assert (await tickets.async_thread(hass, "dani", 42))["state"] == STATE_TRIAGED


async def test_il_filo_lo_legge_anche_chi_non_tiene_la_coda(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Chi ha segnalato apre il filo sulla sua, per leggere la risposta qui.

    Prima quel «vedi la discussione» lo portava su github.com, cioe' fuori
    proprio dal posto che questa finestra esiste per non fargli lasciare. Non
    c'e' niente da proteggere: la issue e' una pagina pubblica.
    """
    _entry(hass)
    await _collega(hass, "anna", maintainer=False)
    github.answer("/issues/42", {"number": 42, "body": "x", "state": "open"})
    filo = await tickets.async_thread(hass, "anna", 42)
    assert filo["number"] == 42
    # Col suo gettone, che serve solo al limite orario: leggere non lo chiede.
    assert github.calls[0]["token"] == "gho_anna"


async def test_il_filo_si_legge_anche_senza_aver_collegato_niente(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Leggere non chiede permessi, e la repository e' pubblica."""
    _entry(hass)
    github.answer("/issues/42", {"number": 42, "body": "x", "state": "open"})
    filo = await tickets.async_thread(hass, "senza-gettone", 42)
    assert filo["number"] == 42
    assert github.calls[0]["token"] == ""


async def test_la_coda_dice_quanti_allegati_ci_sono(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Senza aprire niente: e' il segno che dice quali guardare."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer(
        "/issues?state=open",
        [
            {
                "number": 1,
                "title": "Con la foto",
                "body": "testo "
                "![x](https://github.com/user-attachments/assets/aaa) "
                f"{TICKET_MARKER}",
                "state": "open",
                "comments": 3,
                "user": {"login": "anna-g"},
            },
            {
                "number": 2,
                "title": "Senza",
                "body": f"solo testo {TICKET_MARKER}",
                "state": "open",
                "comments": 0,
                "user": {"login": "luca-t"},
            },
        ],
    )
    coda = await tickets.async_queue(hass, "dani")
    assert [(voce["attachments"], voce["comments"]) for voce in coda] == [
        (1, 3),
        (0, 0),
    ]
    # E l'indirizzo lungo non sporca il testo che la coda mostra.
    assert "user-attachments" not in coda[0]["body"]


def _aperte(numeri: list[int], *, pr: int = 0) -> list[dict[str, Any]]:
    """Una pagina finta: tante issue, e tante pull request che rubano posto."""
    voci: list[dict[str, Any]] = [
        {"number": n, "title": f"[Bug]: {n}", "body": "x", "state": "open"}
        for n in numeri
    ]
    voci += [
        {
            "number": 9000 + i,
            "title": "una PR",
            "body": "x",
            "state": "open",
            "pull_request": {"url": "..."},
        }
        for i in range(pr)
    ]
    return voci


async def test_gli_aperti_si_chiedono_a_pagine_fino_in_fondo(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Una pagina per volta non basta a dire «tutti».

    Quell'indirizzo di GitHub restituisce anche le pull request, che di qui si
    scartano ma la loro riga in pagina se la prendono. Chi contasse le sole
    issue rimaste vedrebbe una pagina non piena e si fermerebbe, mentre dietro
    c'e' dell'altro.
    """
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    quante = github_client._PER_PAGINA
    pr = 10
    issue = quante - pr
    # I chiusi per primi: il loro indirizzo contiene anche «page=1», e il
    # doppione risponde al primo frammento che combacia.
    github.answer("state=closed", [])
    github.answer(
        f"per_page={quante}&sort=created&direction=desc&page=1",
        _aperte(list(range(1, issue + 1)), pr=pr),
    )
    github.answer(
        f"per_page={quante}&sort=created&direction=desc&page=2",
        _aperte([200, 201]),
    )
    coda = await tickets.async_queue(hass, "dani")
    assert len(coda) == issue + 2
    assert [voce["number"] for voce in coda][-2:] == [200, 201]


async def test_una_pagina_non_piena_e_l_ultima(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Non si chiedono dieci pagine quando la prima gia' finisce l'elenco."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer("state=closed", [])
    github.answer("state=open", _aperte([1, 2, 3]))
    await tickets.async_queue(hass, "dani")
    aperti = [c for c in github.calls if "state=open" in c["url"]]
    assert len(aperti) == 1, "ha chiesto pagine oltre la fine dell'elenco"


# ─── La lettura della risposta ───────────────────────────────────────────────
#
# Tutte le prove qui sopra sostituiscono `_request` in blocco, che e' giusto:
# provano cosa il modulo chiede a GitHub e cosa ne fa. Ma cosi' la lettura del
# corpo non viene mai percorsa, ed e' proprio li' che si nascondeva il guasto
# che svuotava la console. Queste due la percorrono davvero.


class _Flusso:
    """Un corpo che arriva a pezzi, come arriva sul filo davvero."""

    def __init__(self, pezzi: list[bytes]) -> None:
        self._pezzi = pezzi

    async def iter_chunked(self, _quanti: int) -> Any:
        for pezzo in self._pezzi:
            yield pezzo


class _Risposta:
    def __init__(self, pezzi: list[bytes], status: int = 200) -> None:
        self.content = _Flusso(pezzi)
        self.status = status

    async def __aenter__(self) -> _Risposta:
        return self

    async def __aexit__(self, *_: Any) -> bool:
        return False


class _Sessione:
    def __init__(self, risposta: _Risposta) -> None:
        self._risposta = risposta

    def request(self, *_args: Any, **_kwargs: Any) -> _Risposta:
        return self._risposta


async def test_una_risposta_lunga_si_legge_intera(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Il corpo arriva a pezzi, e va ricomposto tutto prima di leggerlo.

    `StreamReader.read(n)` non legge n byte: aspetta che il buffer non sia
    vuoto e restituisce quello che ci trova, cioe' il primo pezzo. Sull'elenco
    delle issue di una repository viva il corpo tornava mozzato, `json.loads`
    falliva, e la console diceva «Risposta illeggibile» su una risposta che
    GitHub aveva mandato intera.
    """
    atteso = [{"number": n, "title": "x" * 200} for n in range(50)]
    grezzo = json.dumps(atteso).encode()
    # A pezzi, come sul filo: nessuno di questi da solo e' JSON valido.
    pezzi = [grezzo[i : i + 1024] for i in range(0, len(grezzo), 1024)]
    assert len(pezzi) > 1, "la prova non sta spezzando niente"
    monkeypatch.setattr(
        github_client,
        "async_get_clientsession",
        lambda _hass: _Sessione(_Risposta(pezzi)),
    )
    letto = await github_client._request(hass, "GET", "https://api.github.com/x")
    assert letto == atteso


async def test_una_risposta_oltre_il_tetto_lo_dice(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Il tetto si controlla mentre si legge, e chi lo supera lo sente dire.

    Un troncamento silenzioso travestito da JSON rotto e' il modo peggiore di
    superarlo: manda a cercare il guasto dove non e'.
    """
    troppo = github_client._MAX_RESPONSE_BYTES + 1
    pezzi = [b"x" * 65536] * (troppo // 65536 + 1)
    monkeypatch.setattr(
        github_client,
        "async_get_clientsession",
        lambda _hass: _Sessione(_Risposta(pezzi)),
    )
    with pytest.raises(GitHubError) as guasto:
        await github_client._request(hass, "GET", "https://api.github.com/x")
    assert guasto.value.code == "too_large"


async def test_la_coda_porta_quando_e_stata_aperta(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Il giorno lo decide il browser, ma la data gliela deve dare qualcuno."""
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    github.answer("state=closed", [])
    github.answer(
        "state=open",
        [
            {
                "number": 1,
                "title": "[Bug]: x",
                "body": "x",
                "state": "open",
                "created_at": "2026-09-02T08:15:00Z",
            },
            # Senza data non si inventa niente: resta vuota, e chi conta i
            # giorni la salta invece di contarla come «oggi».
            {"number": 2, "title": "[Bug]: y", "body": "y", "state": "open"},
        ],
    )
    coda = await tickets.async_queue(hass, "dani")
    assert [voce["created_at"] for voce in coda] == ["2026-09-02T08:15:00Z", ""]


async def test_il_rifiuto_di_github_riporta_quello_che_github_dice(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """«Permessi o limite orario» sono due strade opposte dietro una frase sola.

    Una si risolve installando l'App sulla repository, l'altra aspettando. Il
    `message` di GitHub lo dice, e buttarlo via lasciava a chi legge il compito
    di indovinare.
    """
    corpo = json.dumps({"message": "Resource not accessible by integration"}).encode()
    monkeypatch.setattr(
        github_client,
        "async_get_clientsession",
        lambda _hass: _Sessione(_Risposta([corpo], status=403)),
    )
    with pytest.raises(GitHubError) as guasto:
        await github_client._request(hass, "POST", "https://api.github.com/x")
    assert guasto.value.code == "forbidden"
    assert "Resource not accessible by integration" in str(guasto.value)


async def test_un_rifiuto_muto_resta_leggibile(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Senza `message` non si attacca una coda vuota alla frase."""
    monkeypatch.setattr(
        github_client,
        "async_get_clientsession",
        lambda _hass: _Sessione(_Risposta([b"non e' json"], status=404)),
    )
    with pytest.raises(GitHubError) as guasto:
        await github_client._request(hass, "GET", "https://api.github.com/x")
    assert str(guasto.value) == "Non trovato su GitHub."


async def test_la_diagnostica_torna_come_dati_non_come_markup(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """Su GitHub e' una scheda che si apre; dentro la plancia era testo crudo.

    «<details><summary>Diagnostica</summary>» e cinque righe di asterischi
    finivano in mezzo a quello che l'utente aveva scritto, e la parte che conta
    annegava in quella che il programma ha aggiunto.
    """
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    corpo = (
        "Test versione 1.4.5 beta 9\n\n"
        "<details><summary>Diagnostica</summary>\n\n"
        "- **ha_version**: 2026.8.3\n"
        "- **integration_version**: 1.4.5-beta.9\n"
        "- **locale**: it\n\n"
        "</details>\n"
        f"{TICKET_MARKER}"
    )
    github.answer("state=closed", [])
    github.answer(
        "state=open",
        [{"number": 280, "title": "[Bug]: Prova", "body": corpo, "state": "open"}],
    )
    coda = await tickets.async_queue(hass, "dani")
    assert coda[0]["body"] == "Test versione 1.4.5 beta 9"
    assert coda[0]["diagnostics"] == {
        "ha_version": "2026.8.3",
        "integration_version": "1.4.5-beta.9",
        "locale": "it",
    }


def test_un_corpo_senza_diagnostica_resta_intero() -> None:
    """Una issue aperta a mano su GitHub non ha nessuna scheda da togliere."""
    testo, voci = github_client.diagnostica_in("si richiede di separare le aperture")
    assert testo == "si richiede di separare le aperture"
    assert voci == {}


async def test_il_filo_legge_gli_ultimi_commenti_non_i_primi(
    hass: HomeAssistant, github: FakeGitHub
) -> None:
    """GitHub li da' dal primo in poi, trenta per pagina.

    Chiedere la prima pagina e basta voleva dire che dal trentunesimo commento
    in poi la risposta piu' recente non si vedeva mai: il campanello suonava
    per un messaggio che il filo non mostrava, e lo stato dedotto dal commento
    del manutentore restava fermo a settimane prima.
    """
    _entry(hass)
    await _collega(hass, "dani", maintainer=True)
    vecchi = [
        {
            "id": numero,
            "body": f"commento {numero}",
            "user": {"login": "anna-g"},
            "author_association": "NONE",
            "created_at": "2026-09-01T10:00:00Z",
        }
        for numero in range(1, 31)
    ]
    ultimo = {
        "id": 31,
        "body": "L'ultima risposta.",
        "user": {"login": "danigio15"},
        "author_association": "OWNER",
        "created_at": "2026-09-02T10:00:00Z",
    }
    github.answer("page=2", [ultimo])
    github.answer("page=1", vecchi)
    github.answer(
        "/issues/42",
        {
            "number": 42,
            "state": "open",
            "comments": 31,
            "body": "Il corpo.",
            "html_url": "https://github.com/x/y/issues/42",
        },
    )
    filo = await tickets.async_thread(hass, "dani", 42)
    assert filo["comment_count"] == 31
    assert len(filo["comments"]) == 30
    assert filo["comments"][-1]["body"] == "L'ultima risposta."
    assert filo["comments"][0]["body"] == "commento 2"
    pagine = [
        chiamata["url"].rsplit("page=", 1)[-1]
        for chiamata in github.calls
        if "/comments" in chiamata["url"]
    ]
    assert pagine == ["2", "1"]

    # E la sincronia vede quella risposta, non una di trenta commenti fa.
    letta = await github_client.async_read_issue(hass, 42, token="gho_dani")
    assert letta["reply"] == "L'ultima risposta."


async def test_la_sincronia_gira_su_tutte_le_segnalazioni(
    hass: HomeAssistant, github: FakeGitHub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Venti per giro, ma il giro dopo riparte da dove si era fermato.

    Prendere sempre le prime venti voleva dire che con ventuno aperte la
    ventunesima non veniva riletta mai, finche' una delle altre non si
    chiudeva.
    """
    _entry(hass)
    await _collega(hass, "anna")
    store = await async_get_ticket_store(hass)
    # Venticinque in fila: il freno sulle segnalazioni troppo frequenti qui
    # non c'entra, e si toglie.
    monkeypatch.setattr(type(store), "_too_frequent", lambda _self, _now: False)
    for numero in range(1, 26):
        bozza = await _bozza(hass, title=f"la {numero}")
        await store.async_mark_sent(bozza["id"], str(numero))
    github.answer("/issues/", {"state": "open", "comments": 0})

    await tickets.async_sync_states(hass)
    primi = [chiamata["url"].rsplit("/", 1)[-1] for chiamata in github.calls]
    github.calls.clear()
    await tickets.async_sync_states(hass)
    secondi = [chiamata["url"].rsplit("/", 1)[-1] for chiamata in github.calls]

    assert len(primi) == 20 and len(secondi) == 20
    assert secondi[:5] == ["21", "22", "23", "24", "25"]
    assert set(primi) | set(secondi) == {str(numero) for numero in range(1, 26)}
