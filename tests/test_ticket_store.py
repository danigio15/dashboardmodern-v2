"""Lo store delle segnalazioni: cosa accetta, cosa taglia, cosa non spedisce."""

from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant

from custom_components.dashboardmodern.ticket_store import (
    DIAGNOSTIC_KEYS,
    MAX_BODY,
    MAX_PER_HOUR,
    MAX_TICKETS,
    MAX_TITLE,
    STATE_CLOSED,
    STATE_DRAFT,
    STATE_SENT,
    STATE_TRIAGED,
    TYPE_BUG,
    TYPE_FEATURE,
    TYPE_SUPPORT,
    TicketRejected,
    TicketStore,
    async_get_ticket_store,
    normalize_diagnostics,
)


async def _store(hass: HomeAssistant) -> TicketStore:
    store = TicketStore(hass)
    await store.async_load()
    return store


async def _bug(store: TicketStore, **kwargs: Any) -> dict[str, Any]:
    campi: dict[str, Any] = {
        "ticket_type": TYPE_BUG,
        "title": "Le tapparelle non si fermano",
        "body": "Premo stop e continuano a scendere.",
    }
    campi.update(kwargs)
    return await store.async_create(**campi)


async def test_una_segnalazione_nasce_in_casa(hass: HomeAssistant) -> None:
    """Nasce bozza: la consegna e' un secondo momento che puo' fallire."""
    store = await _store(hass)
    ticket = await _bug(store)
    assert ticket["state"] == STATE_DRAFT
    assert ticket["remote_id"] == ""
    assert store.pending() and store.pending()[0]["id"] == ticket["id"]


async def test_i_tre_tipi_e_nessun_altro(hass: HomeAssistant) -> None:
    """Bug, funzionalita', assistenza. Un quarto tipo non entra."""
    store = await _store(hass)
    for tipo in (TYPE_BUG, TYPE_FEATURE, TYPE_SUPPORT):
        assert (await _bug(store, ticket_type=tipo))["type"] == tipo
    with pytest.raises(TicketRejected) as rifiuto:
        await _bug(store, ticket_type="reclamo")
    assert rifiuto.value.code == "invalid_type"


async def test_titolo_e_corpo_non_possono_essere_vuoti(hass: HomeAssistant) -> None:
    """Uno spazio non e' un titolo, e va detto prima di scrivere sul disco."""
    store = await _store(hass)
    with pytest.raises(TicketRejected) as senza_titolo:
        await _bug(store, title="   ")
    assert senza_titolo.value.code == "empty_title"
    with pytest.raises(TicketRejected) as senza_corpo:
        await _bug(store, body="\n\n")
    assert senza_corpo.value.code == "empty_body"


async def test_il_testo_viene_tagliato_alla_misura(hass: HomeAssistant) -> None:
    """I tetti valgono sul contenuto salvato, non solo sullo schema del WS."""
    store = await _store(hass)
    ticket = await _bug(store, title="t" * 400, body="c" * (MAX_BODY + 500))
    assert len(ticket["title"]) == MAX_TITLE
    assert len(ticket["body"]) == MAX_BODY


async def test_il_titolo_resta_una_riga_sola(hass: HomeAssistant) -> None:
    """Un a capo nel titolo sfascia la console: non ci arriva."""
    store = await _store(hass)
    ticket = await _bug(store, title="prima\nseconda")
    assert "\n" not in ticket["title"]


async def test_la_diagnostica_e_una_lista_chiusa(hass: HomeAssistant) -> None:
    """Quello che nessuno ha dichiarato non parte, anche se arriva."""
    pulita = normalize_diagnostics(
        {
            "ha_version": "2026.8.0",
            "integration_version": "1.0.0-beta.20",
            # Le tre cose che non devono uscire di casa, per quanto vengano
            # offerte con nomi innocui.
            "ha_url": "https://casa.example.com",
            "token": "abc123",
            "entities": "light.salotto, light.cucina",
        }
    )
    assert set(pulita) == {"ha_version", "integration_version"}
    assert set(pulita) <= DIAGNOSTIC_KEYS


async def test_la_diagnostica_sopravvive_al_salvataggio(hass: HomeAssistant) -> None:
    """Il filtro sta nello store, non solo nell'aiutante."""
    store = await _store(hass)
    ticket = await _bug(store, diagnostics={"ha_version": "2026.8.0", "token": "x"})
    assert ticket["diagnostics"] == {"ha_version": "2026.8.0"}


async def test_chi_apre_vede_le_sue_e_l_amministratore_tutte(
    hass: HomeAssistant,
) -> None:
    """In una casa con quattro utenti, l'assistenza di uno non e' lettura per tre."""
    store = await _store(hass)
    await _bug(store, opened_by="anna", title="Quella di Anna")
    await _bug(store, opened_by="bruno", title="Quella di Bruno")
    mie = [ticket["title"] for ticket in store.list(opened_by="anna")]
    assert mie == ["Quella di Anna"]
    assert len(store.list(every=True)) == 2


async def test_nessuno_cancella_la_segnalazione_di_un_altro(
    hass: HomeAssistant,
) -> None:
    """E il rifiuto non rivela che quella segnalazione esiste."""
    store = await _store(hass)
    ticket = await _bug(store, opened_by="anna")
    assert await store.async_delete(ticket["id"], opened_by="bruno") is False
    assert len(store.list(every=True)) == 1
    assert await store.async_delete(ticket["id"], opened_by="anna") is True
    assert store.list(every=True) == []


async def test_l_amministratore_puo_cancellare(hass: HomeAssistant) -> None:
    """Chi governa la plancia governa anche la sua coda."""
    store = await _store(hass)
    ticket = await _bug(store, opened_by="anna")
    assert await store.async_delete(ticket["id"], every=True) is True


async def test_un_ciclo_difettoso_trova_un_tetto(hass: HomeAssistant) -> None:
    """Sei all'ora: non un limite d'uso, il fondo che evita il disco pieno."""
    store = await _store(hass)
    for indice in range(MAX_PER_HOUR):
        await _bug(store, title=f"numero {indice}")
    with pytest.raises(TicketRejected) as rifiuto:
        await _bug(store, title="la settima")
    assert rifiuto.value.code == "too_frequent"


async def test_lo_store_cede_prima_i_ticket_chiusi(hass: HomeAssistant) -> None:
    """Quando e' pieno, se ne va quello che nessuno rileggera'."""
    store = await _store(hass)
    # Riempito a mano: il tetto orario esiste apposta per impedire di
    # arrivarci passando dalla porta.
    tickets = store._tickets()  # noqa: SLF001 - si prova il fondo, non la porta
    for indice in range(MAX_TICKETS):
        tickets.append(
            {
                "id": f"vecchio-{indice}",
                "state": STATE_CLOSED if indice < 3 else STATE_SENT,
                "created_at": 1000 + indice,
                "title": f"vecchio {indice}",
            }
        )
    await _bug(store, title="la nuova")
    rimasti = {ticket["id"] for ticket in store.list(every=True)}
    assert "vecchio-0" not in rimasti
    assert "vecchio-50" in rimasti
    assert len(rimasti) == MAX_TICKETS


async def test_lo_stato_torna_indietro_dalla_console(hass: HomeAssistant) -> None:
    """La sync porta a casa stato, risposta e link alla issue."""
    store = await _store(hass)
    ticket = await _bug(store)
    await store.async_mark_sent(ticket["id"], "R-42")
    cambiati = await store.async_merge_remote(
        [
            {
                "remote_id": "R-42",
                "state": STATE_TRIAGED,
                "reply": "Riprodotta, ci sto lavorando.",
                "issue_url": "https://github.com/danigio15/dashboardmodern-v2/issues/9",
            }
        ]
    )
    assert cambiati == 1
    aggiornato = store.list(every=True)[0]
    assert aggiornato["state"] == STATE_TRIAGED
    assert aggiornato["reply"] == "Riprodotta, ci sto lavorando."
    assert aggiornato["issue_url"].endswith("/issues/9")


async def test_il_servizio_non_riscrive_quello_che_c_e_in_casa(
    hass: HomeAssistant,
) -> None:
    """Titolo e corpo sono di chi li ha scritti, anche se il relay ne manda altri."""
    store = await _store(hass)
    ticket = await _bug(store)
    await store.async_mark_sent(ticket["id"], "R-1")
    await store.async_merge_remote(
        [{"remote_id": "R-1", "title": "riscritto", "body": "riscritto"}]
    )
    aggiornato = store.list(every=True)[0]
    assert aggiornato["title"] == ticket["title"]
    assert aggiornato["body"] == ticket["body"]


async def test_un_link_che_non_e_una_issue_non_passa(hass: HomeAssistant) -> None:
    """Il relay non decide dove mandare chi legge la propria segnalazione."""
    store = await _store(hass)
    ticket = await _bug(store)
    await store.async_mark_sent(ticket["id"], "R-1")
    await store.async_merge_remote(
        [{"remote_id": "R-1", "issue_url": "https://esca.example.com/paga"}]
    )
    assert store.list(every=True)[0]["issue_url"] == ""


async def test_un_ticket_chiuso_non_si_richiede_piu(hass: HomeAssistant) -> None:
    """Ogni giro di sync costa a chi ospita il relay: non si spreca."""
    store = await _store(hass)
    aperto = await _bug(store, title="aperta")
    chiuso = await _bug(store, title="chiusa")
    await store.async_mark_sent(aperto["id"], "R-aperta")
    await store.async_mark_sent(chiuso["id"], "R-chiusa")
    await store.async_merge_remote([{"remote_id": "R-chiusa", "state": STATE_CLOSED}])
    assert store.remote_ids() == ["R-aperta"]


async def test_la_consegna_fallita_non_perde_il_testo(hass: HomeAssistant) -> None:
    """Chi scrive alle due di notte non paga il servizio spento."""
    store = await _store(hass)
    ticket = await _bug(store)
    await store.async_mark_failed(ticket["id"], "Servizio non raggiungibile.")
    rimasto = store.list(every=True)[0]
    assert rimasto["state"] == STATE_DRAFT
    assert rimasto["body"] == ticket["body"]
    assert rimasto["delivery_error"] == "Servizio non raggiungibile."


async def test_l_identificativo_non_deriva_da_niente(hass: HomeAssistant) -> None:
    """Casuale, stabile, e senza rapporto con l'utente o con la casa."""
    store = await async_get_ticket_store(hass)
    primo = store.installation_id
    assert len(primo) == 32
    assert (await async_get_ticket_store(hass)).installation_id == primo


async def test_lo_store_e_uno_solo_per_installazione(hass: HomeAssistant) -> None:
    """Chi ha due plance non ha due code."""
    assert await async_get_ticket_store(hass) is await async_get_ticket_store(hass)
