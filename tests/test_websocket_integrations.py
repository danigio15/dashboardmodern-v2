"""Il catalogo delle integrazioni arriva sul WebSocket.

Un elettrodomestico moderno e' un *dispositivo* di un'integrazione, con dentro
venti entita'. Il comando le legge dai registri di Home Assistant e le rimette
nella forma di un menu: integrazioni, dispositivi, e — per i dispositivi
chiesti — le entita'. Qui si guida il gestore registrato, con una connessione
finta che raccoglie le risposte, come per gli altri comandi.
"""

from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.components import websocket_api
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    MockModule,
    mock_integration,
)

from custom_components.dashboardmodern.config_flow import OPTION_ADMIN_ONLY
from custom_components.dashboardmodern.const import DOMAIN
from custom_components.dashboardmodern.websocket_api import (
    TYPE_INTEGRATIONS_CATALOG,
    async_register_websocket_api,
)


class SimpleUser:
    """Un utente collegato, amministratore o no."""

    def __init__(self, *, is_admin: bool) -> None:
        """Solo quello che un controllo di permesso legge."""
        self.id = "user-1"
        self.is_admin = is_admin


class StubConnection:
    """La superficie di ActiveConnection che questi comandi usano davvero."""

    def __init__(self, hass: HomeAssistant, *, is_admin: bool = True) -> None:
        """Chi e' collegato, e dove finiscono le risposte."""
        self.hass = hass
        self.user = SimpleUser(is_admin=is_admin)
        self.results: dict[int, Any] = {}
        self.errors: dict[int, tuple[str, str]] = {}

    def send_result(self, message_id: int, result: Any = None) -> None:
        """Raccoglie una risposta riuscita."""
        self.results[message_id] = result

    def send_error(self, message_id: int, code: str, message: str) -> None:
        """Raccoglie un errore."""
        self.errors[message_id] = (code, message)


async def _comando(
    hass: HomeAssistant,
    connection: StubConnection,
    payload: dict[str, Any],
    message_id: int = 1,
) -> dict[str, Any]:
    """Valida ed esegue un comando, restituendo il risultato."""
    handler, schema = hass.data[websocket_api.const.DOMAIN][payload["type"]]
    message = schema({"id": message_id, **payload})
    await handler.__wrapped__(hass, connection, message)
    assert message_id not in connection.errors, connection.errors[message_id]
    return connection.results[message_id]


@pytest.fixture(autouse=True)
def _comandi(hass: HomeAssistant) -> None:
    """Registra i comandi della plancia."""
    hass.data.setdefault(websocket_api.const.DOMAIN, {})
    async_register_websocket_api(hass)


async def _casa(
    hass: HomeAssistant,
    device_registry: dr.DeviceRegistry,
    entity_registry: er.EntityRegistry,
    area_registry: ar.AreaRegistry,
) -> tuple[dr.DeviceEntry, dr.DeviceEntry]:
    """Una lavatrice di hOn (HACS) e una presa Shelly (ufficiale).

    La lavatrice ha tre entita' accese e una disabilitata; un secondo
    dispositivo di hOn non ha entita' e non deve comparire.
    """
    # Da HACS: sta in `custom_components`, e il catalogo lo deve dire.
    mock_integration(
        hass, MockModule("hon", partial_manifest={"name": "hOn"}), built_in=False
    )
    mock_integration(hass, MockModule("shelly", partial_manifest={"name": "Shelly"}))
    hon = MockConfigEntry(domain="hon", title="Hoover di casa", entry_id="hon-1")
    hon.add_to_hass(hass)
    shelly = MockConfigEntry(domain="shelly", title="Presa", entry_id="shelly-1")
    shelly.add_to_hass(hass)

    lavanderia = area_registry.async_get_or_create("Lavanderia")
    lavatrice = device_registry.async_get_or_create(
        config_entry_id="hon-1",
        identifiers={("hon", "wm-1")},
        manufacturer="Hoover",
        model="H-WASH 500",
        name="Lavatrice",
    )
    device_registry.async_update_device(lavatrice.id, area_id=lavanderia.id)
    presa = device_registry.async_get_or_create(
        config_entry_id="shelly-1",
        identifiers={("shelly", "plug-1")},
        manufacturer="Shelly",
        model="Plus Plug S",
        name="Presa frigo",
    )
    device_registry.async_get_or_create(
        config_entry_id="hon-1", identifiers={("hon", "vuoto")}, name="Vuoto"
    )

    entity_registry.async_get_or_create(
        "sensor",
        "hon",
        "wm-1-remaining",
        suggested_object_id="lavatrice_remaining_time",
        device_id=lavatrice.id,
        config_entry=hon,
        original_name="Remaining time",
        translation_key="remaining_time",
        unit_of_measurement="min",
    )
    entity_registry.async_get_or_create(
        "sensor",
        "hon",
        "wm-1-power",
        suggested_object_id="lavatrice_power",
        device_id=lavatrice.id,
        config_entry=hon,
        original_name="Power",
    )
    entity_registry.async_get_or_create(
        "switch",
        "hon",
        "wm-1-wash",
        suggested_object_id="lavatrice_wash",
        device_id=lavatrice.id,
        config_entry=hon,
        original_name="Wash",
        translation_key="wash",
    )
    entity_registry.async_get_or_create(
        "sensor",
        "hon",
        "wm-1-rssi",
        suggested_object_id="lavatrice_rssi",
        device_id=lavatrice.id,
        config_entry=hon,
        original_name="RSSI",
        entity_category=EntityCategory.DIAGNOSTIC,
        disabled_by=er.RegistryEntryDisabler.INTEGRATION,
    )
    entity_registry.async_get_or_create(
        "switch",
        "shelly",
        "plug-1",
        suggested_object_id="presa_frigo",
        device_id=presa.id,
        config_entry=shelly,
    )
    hass.states.async_set(
        "sensor.lavatrice_power",
        "1900",
        {
            "unit_of_measurement": "W",
            "device_class": "power",
            "friendly_name": "Lavatrice Power",
        },
    )
    hass.states.async_set(
        "switch.presa_frigo", "on", {"friendly_name": "Presa frigo interruttore"}
    )
    return lavatrice, presa


async def test_il_catalogo_elenca_integrazioni_e_dispositivi(
    hass: HomeAssistant,
    device_registry: dr.DeviceRegistry,
    entity_registry: er.EntityRegistry,
    area_registry: ar.AreaRegistry,
) -> None:
    """Le integrazioni con i loro dispositivi, e chi viene da HACS lo dice."""
    lavatrice, presa = await _casa(
        hass, device_registry, entity_registry, area_registry
    )

    catalogo = await _comando(
        hass, StubConnection(hass), {"type": TYPE_INTEGRATIONS_CATALOG}
    )

    assert [item["domain"] for item in catalogo["integrations"]] == ["hon", "shelly"]
    hon, shelly = catalogo["integrations"]
    assert hon["name"] == "hOn"
    assert hon["custom"] is True
    assert hon["devices"] == 1
    assert hon["entries"] == [
        {"entry_id": "hon-1", "title": "Hoover di casa", "state": "not_loaded"}
    ]
    assert shelly["custom"] is False
    assert shelly["devices"] == 1

    assert [item["name"] for item in catalogo["devices"]] == [
        "Lavatrice",
        "Presa frigo",
    ]
    prima = catalogo["devices"][0]
    assert prima["id"] == lavatrice.id
    assert prima["manufacturer"] == "Hoover"
    assert prima["model"] == "H-WASH 500"
    assert prima["integration"] == "hon"
    assert prima["integrations"] == ["hon"]
    assert prima["area"] == "Lavanderia"
    # Tre accese: quella disabilitata non conta nel numero che il menu mostra.
    assert prima["entities"] == 3
    assert prima["disabled"] is False
    assert catalogo["devices"][1]["id"] == presa.id
    # Senza `device_ids` le entita' non viaggiano: sono migliaia in una casa.
    assert catalogo["entities"] == []


async def test_le_entita_si_chiedono_per_dispositivo(
    hass: HomeAssistant,
    device_registry: dr.DeviceRegistry,
    entity_registry: er.EntityRegistry,
    area_registry: ar.AreaRegistry,
) -> None:
    """Le entita' di un dispositivo, con unita' e classe anche da chi e' spento."""
    lavatrice, _ = await _casa(hass, device_registry, entity_registry, area_registry)

    catalogo = await _comando(
        hass,
        StubConnection(hass),
        {"type": TYPE_INTEGRATIONS_CATALOG, "device_ids": [lavatrice.id]},
    )

    per_id = {item["entity_id"]: item for item in catalogo["entities"]}
    assert list(per_id) == [
        "sensor.lavatrice_power",
        "sensor.lavatrice_remaining_time",
        "sensor.lavatrice_rssi",
        "switch.lavatrice_wash",
    ]
    potenza = per_id["sensor.lavatrice_power"]
    # Il registro non sa l'unita': la dice lo stato.
    assert potenza["unit"] == "W"
    assert potenza["device_class"] == "power"
    assert potenza["name"] == "Power"
    assert potenza["device_id"] == lavatrice.id
    assert potenza["platform"] == "hon"
    rimanente = per_id["sensor.lavatrice_remaining_time"]
    assert rimanente["translation_key"] == "remaining_time"
    assert rimanente["unit"] == "min"
    assert rimanente["disabled"] is False
    assert rimanente["category"] == ""
    rssi = per_id["sensor.lavatrice_rssi"]
    assert rssi["disabled"] is True
    assert rssi["category"] == "diagnostic"
    assert per_id["switch.lavatrice_wash"]["translation_key"] == "wash"


async def test_il_nome_lascia_fuori_quello_del_dispositivo(
    hass: HomeAssistant,
    device_registry: dr.DeviceRegistry,
    entity_registry: er.EntityRegistry,
    area_registry: ar.AreaRegistry,
) -> None:
    """Senza nome proprio nel registro, il nome viene dallo stato senza prefisso."""
    _, presa = await _casa(hass, device_registry, entity_registry, area_registry)

    catalogo = await _comando(
        hass,
        StubConnection(hass),
        {"type": TYPE_INTEGRATIONS_CATALOG, "device_ids": [presa.id]},
    )

    assert [item["name"] for item in catalogo["entities"]] == ["interruttore"]


async def test_la_plancia_non_elenca_se_stessa(
    hass: HomeAssistant,
    device_registry: dr.DeviceRegistry,
    entity_registry: er.EntityRegistry,
) -> None:
    """Le entita' di DashboardModern non sono di nessun elettrodomestico."""
    plancia = MockConfigEntry(domain=DOMAIN, entry_id="dm-1")
    plancia.add_to_hass(hass)
    device = device_registry.async_get_or_create(
        config_entry_id="dm-1", identifiers={(DOMAIN, "dm")}, name="DashboardModern"
    )
    entity_registry.async_get_or_create(
        "update",
        DOMAIN,
        "aggiornamento",
        device_id=device.id,
        config_entry=plancia,
        original_name="Aggiornamento",
    )

    catalogo = await _comando(
        hass, StubConnection(hass), {"type": TYPE_INTEGRATIONS_CATALOG}
    )

    assert catalogo == {"integrations": [], "devices": [], "entities": []}


async def test_chi_non_puo_usare_la_plancia_non_legge_il_catalogo(
    hass: HomeAssistant,
) -> None:
    """Stesso permesso degli altri comandi: chi non puo' usarla non legge."""
    riservata = MockConfigEntry(
        domain=DOMAIN, entry_id="dm-1", options={OPTION_ADMIN_ONLY: True}
    )
    riservata.add_to_hass(hass)
    fuori = StubConnection(hass, is_admin=False)
    handler, schema = hass.data[websocket_api.const.DOMAIN][TYPE_INTEGRATIONS_CATALOG]
    await handler.__wrapped__(
        hass, fuori, schema({"id": 1, "type": TYPE_INTEGRATIONS_CATALOG})
    )

    assert fuori.errors[1][0] == websocket_api.const.ERR_UNAUTHORIZED
    assert 1 not in fuori.results
