"""Una voce, un dispositivo.

«In fase di inserimento dell'integrazione ne crea gia' 2»: la finestra «Nomina
e assegna» di Home Assistant, aperta appena finito il config flow, mostrava due
schede — «Casa 3.0» e «DashboardModern v2» — con un'entita' per una, e le stesse
due restavano poi in Impostazioni → Dispositivi e servizi.

Non erano due integrazioni: era una voce sola con due dispositivi. L'interruttore
della presenza simulata si e' sempre attaccato a `(DOMAIN, entry_id)`; l'avviso di
aggiornamento si attaccava a `(DOMAIN, "dashboardmodern")`, una stringa fissa. Per
Home Assistant un identificativo diverso e' un dispositivo diverso, e due entita'
con due identificativi diversi fanno due schede.

Qui si tiene fermo che il dispositivo e' uno, che e' quello della voce, e che a
chi aggiorna la scheda vecchia non resta in mezzo ai piedi.
"""

from __future__ import annotations

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import DISPOSITIVO_VECCHIO
from custom_components.dashboardmodern.const import DOMAIN, OPTION_CHECK_UPDATES


async def _avvia(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch, **opzioni: object
) -> MockConfigEntry:
    """Una plancia avviata davvero, senza uscire di casa.

    Il pannello e la prima occhiata a GitHub non c'entrano con i dispositivi:
    il primo scrive su disco, la seconda va in rete. Restano fuori, e tutto il
    resto — le piattaforme, il registro — e' quello vero.
    """
    import custom_components.dashboardmodern.frontend as frontend_module
    import custom_components.dashboardmodern.update as update_module

    async def niente(*_argomenti: object, **_chiavi: object) -> None:
        return None

    monkeypatch.setattr(frontend_module, "async_register_frontend", niente)
    monkeypatch.setattr(
        update_module.DashboardModernReleaseCoordinator, "async_refresh", niente
    )

    entry = MockConfigEntry(
        domain=DOMAIN,
        entry_id="entry-1",
        title="Casa 3.0",
        data={"name": "Casa 3.0", "primary": True},
        options=opzioni,
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id) is True
    await hass.async_block_till_done()
    return entry


@pytest.mark.asyncio
async def test_una_voce_fa_un_dispositivo_solo(
    hass: HomeAssistant,
    enable_custom_integrations: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Le due entita' della voce stanno sulla stessa scheda."""
    entry = await _avvia(hass, monkeypatch, **{OPTION_CHECK_UPDATES: True})

    registro = dr.async_get(hass)
    schede = dr.async_entries_for_config_entry(registro, entry.entry_id)
    assert len(schede) == 1, [scheda.name for scheda in schede]
    scheda = schede[0]
    # Il dispositivo e' quello della voce, e porta il nome che la plancia ha
    # scelto: chi ne ha due le distingue dall'elenco.
    assert scheda.identifiers == {(DOMAIN, entry.entry_id)}
    assert scheda.name == "Casa 3.0"

    entita = er.async_get(hass)
    sopra = er.async_entries_for_device(
        entita, scheda.id, include_disabled_entities=True
    )
    domini = sorted(voce.domain for voce in sopra)
    assert domini == ["switch", "update"], domini

    # E la pagina Aggiornamenti non ci rimette il nome: quello lo dice
    # `_attr_title`, non il dispositivo, cosi' resta «DashboardModern v2»
    # comunque si chiami la plancia.
    avviso = hass.states.get(
        next(voce.entity_id for voce in sopra if voce.domain == "update")
    )
    assert avviso is not None
    assert avviso.attributes["title"] == "DashboardModern v2"
    assert avviso.attributes["friendly_name"] == "Casa 3.0"


@pytest.mark.asyncio
async def test_la_scheda_vecchia_se_ne_va_a_chi_aggiorna(
    hass: HomeAssistant,
    enable_custom_integrations: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Chi arriva dalla 1.4.19 ha gia' la scheda di troppo scritta nel registro.

    Correggere l'identificativo sposta l'entita', ma la scheda vuota resta
    nell'elenco — col nome dell'integrazione accanto, come se ci fosse ancora
    qualcosa dentro. Va tolta, e va tolta da sola.
    """
    entry = MockConfigEntry(
        domain=DOMAIN,
        entry_id="entry-1",
        title="Casa 3.0",
        data={"name": "Casa 3.0", "primary": True},
        options={OPTION_CHECK_UPDATES: True},
    )
    entry.add_to_hass(hass)
    registro = dr.async_get(hass)
    vecchia = registro.async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(DOMAIN, DISPOSITIVO_VECCHIO)},
        name="DashboardModern v2",
        manufacturer="DashboardModern",
    )
    assert registro.async_get_device(identifiers={(DOMAIN, DISPOSITIVO_VECCHIO)})

    import custom_components.dashboardmodern.frontend as frontend_module
    import custom_components.dashboardmodern.update as update_module

    async def niente(*_argomenti: object, **_chiavi: object) -> None:
        return None

    monkeypatch.setattr(frontend_module, "async_register_frontend", niente)
    monkeypatch.setattr(
        update_module.DashboardModernReleaseCoordinator, "async_refresh", niente
    )
    assert await hass.config_entries.async_setup(entry.entry_id) is True
    await hass.async_block_till_done()

    assert (
        registro.async_get_device(identifiers={(DOMAIN, DISPOSITIVO_VECCHIO)}) is None
    )
    assert registro.async_get(vecchia.id) is None
    schede = dr.async_entries_for_config_entry(registro, entry.entry_id)
    assert len(schede) == 1, [scheda.name for scheda in schede]


@pytest.mark.asyncio
async def test_chi_ha_spento_l_avviso_non_resta_con_la_scheda_vuota(
    hass: HomeAssistant,
    enable_custom_integrations: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Senza l'avviso di aggiornamento non c'e' un'entita' che si sposta.

    L'opzione si spegne dalle opzioni della plancia: allora l'entita' non nasce
    proprio, e la scheda vecchia non verrebbe svuotata da nessuno. Deve andarsene
    lo stesso, portandosi via la riga rimasta nel registro delle entita'.
    """
    entry = MockConfigEntry(
        domain=DOMAIN,
        entry_id="entry-1",
        title="Casa 3.0",
        data={"name": "Casa 3.0", "primary": True},
        options={OPTION_CHECK_UPDATES: False},
    )
    entry.add_to_hass(hass)
    registro = dr.async_get(hass)
    vecchia = registro.async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(DOMAIN, DISPOSITIVO_VECCHIO)},
        name="DashboardModern v2",
    )
    entita = er.async_get(hass)
    entita.async_get_or_create(
        "update",
        DOMAIN,
        f"{DOMAIN}_release",
        config_entry=entry,
        device_id=vecchia.id,
    )

    import custom_components.dashboardmodern.frontend as frontend_module

    async def niente(*_argomenti: object, **_chiavi: object) -> None:
        return None

    monkeypatch.setattr(frontend_module, "async_register_frontend", niente)
    assert await hass.config_entries.async_setup(entry.entry_id) is True
    await hass.async_block_till_done()

    assert registro.async_get(vecchia.id) is None
    assert entita.async_get_entity_id("update", DOMAIN, f"{DOMAIN}_release") is None
