"""Il catalogo di integrazioni, dispositivi ed entita' di Home Assistant.

Un elettrodomestico moderno arriva in Home Assistant da un'integrazione — hOn
per Hoover, Candy e Haier, Home Connect per Bosch e Siemens, Miele, LG ThinQ,
SmartThings — come un *dispositivo* con dentro venti o trenta entita': il
programma, la fase, il tempo che manca, la temperatura, l'energia del ciclo,
l'oblo', l'interruttore d'avvio. La plancia sapeva soltanto di entita' prese
una per una: chi voleva la lavatrice intera doveva scriverle a mano, e una
alla volta.

Questo modulo legge i registri di Home Assistant e li rimette nella forma che
serve a un menu: le integrazioni installate — ufficiali o messe con HACS, e lo
dice — i dispositivi di ognuna e le entita' di ogni dispositivo. Legge e
basta: non scrive niente e non tiene niente in memoria.

Le entita' si chiedono per dispositivo e non tutte insieme: una casa grande
ne ha migliaia, e il menu ne vuole vedere venti alla volta.
"""

from __future__ import annotations

from collections import Counter
from typing import TYPE_CHECKING, Any

from homeassistant import loader
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

# Piu' di cosi' non e' un menu: e' un'esportazione.
MAX_DEVICE_IDS = 200


def _testo(value: Any) -> str:
    """Una stringa pulita, o niente."""
    if value is None:
        return ""
    return str(getattr(value, "value", value)).strip()


def _nome_entita(entry: er.RegistryEntry, state: Any, device_name: str) -> str:
    """Il nome dell'entita' senza quello del dispositivo davanti.

    Un'integrazione moderna compone «Lavatrice Tempo rimanente» dal nome del
    dispositivo e da quello suo: nel menu del dispositivo la prima meta' e'
    gia' scritta in cima, e ripeterla venti volte non aiuta a leggere.
    """
    proprio = _testo(entry.name) or _testo(entry.original_name)
    if proprio:
        return proprio
    friendly = _testo(getattr(state, "attributes", {}).get("friendly_name"))
    if friendly and device_name and friendly.lower().startswith(device_name.lower()):
        resto = friendly[len(device_name) :].strip(" -:·")
        if resto:
            return resto
    if friendly:
        return friendly
    return entry.entity_id.split(".", 1)[-1].replace("_", " ")


def _entita(hass: HomeAssistant, entry: er.RegistryEntry, device_name: str) -> dict:
    """Una riga del catalogo per un'entita'."""
    state = hass.states.get(entry.entity_id)
    attributes = getattr(state, "attributes", {}) or {}
    return {
        "entity_id": entry.entity_id,
        "device_id": entry.device_id or "",
        "platform": entry.platform,
        "name": _nome_entita(entry, state, device_name),
        "translation_key": _testo(entry.translation_key),
        "device_class": _testo(entry.device_class)
        or _testo(entry.original_device_class)
        or _testo(attributes.get("device_class")),
        "unit": _testo(entry.unit_of_measurement)
        or _testo(attributes.get("unit_of_measurement")),
        "state_class": _testo(attributes.get("state_class")),
        "category": _testo(entry.entity_category),
        "disabled": entry.disabled_by is not None,
        "hidden": entry.hidden_by is not None,
    }


def _integrazione(domain: str, found: Any, entries: list[Any]) -> dict[str, Any]:
    """Una riga del catalogo per un'integrazione.

    ``custom`` e' vero per un'integrazione che sta in ``custom_components`` —
    da HACS o copiata a mano — falso per una di Home Assistant, e ``None``
    quando il caricatore non la trova piu': le sue entita' restano nei
    registri anche dopo che qualcuno l'ha tolta.
    """
    if isinstance(found, loader.Integration):
        name = _testo(found.name) or domain
        custom: bool | None = not found.is_built_in
    else:
        name = domain
        custom = None
    return {
        "domain": domain,
        "name": name,
        "custom": custom,
        "entries": [
            {
                "entry_id": entry.entry_id,
                "title": _testo(entry.title),
                "state": _testo(entry.state),
            }
            for entry in entries
        ],
        "devices": 0,
    }


async def async_build_catalog(
    hass: HomeAssistant, *, device_ids: list[str] | None = None
) -> dict[str, Any]:
    """Integrazioni, dispositivi e — per i dispositivi chiesti — le entita'.

    Un dispositivo senza entita' non compare: non c'e' niente da mostrare. La
    plancia stessa nemmeno: le sue entita' non sono di nessun elettrodomestico.
    """
    device_registry = dr.async_get(hass)
    entity_registry = er.async_get(hass)
    area_registry = ar.async_get(hass)

    per_dispositivo: dict[str, list[er.RegistryEntry]] = {}
    for entry in entity_registry.entities.values():
        if entry.platform == DOMAIN or not entry.device_id:
            continue
        per_dispositivo.setdefault(entry.device_id, []).append(entry)

    dominio_della_voce = {
        entry.entry_id: entry.domain for entry in hass.config_entries.async_entries()
    }

    devices: list[dict[str, Any]] = []
    domini: set[str] = set()
    for device in device_registry.devices.values():
        entita = per_dispositivo.get(device.id)
        if not entita:
            continue
        piattaforme = Counter(entry.platform for entry in entita)
        principale = ""
        if device.primary_config_entry:
            principale = dominio_della_voce.get(device.primary_config_entry, "")
        if not principale:
            principale = piattaforme.most_common(1)[0][0]
        integrazioni = sorted(
            {
                *piattaforme,
                *(
                    dominio_della_voce[entry_id]
                    for entry_id in device.config_entries
                    if entry_id in dominio_della_voce
                ),
            }
            - {DOMAIN}
        )
        if not integrazioni:
            continue
        if principale not in integrazioni:
            principale = integrazioni[0]
        domini.update(integrazioni)
        area = area_registry.async_get_area(device.area_id) if device.area_id else None
        devices.append(
            {
                "id": device.id,
                "name": _testo(device.name_by_user) or _testo(device.name),
                "manufacturer": _testo(device.manufacturer),
                "model": _testo(device.model) or _testo(device.model_id),
                "integration": principale,
                "integrations": integrazioni,
                "area_id": device.area_id or "",
                "area": _testo(getattr(area, "name", "")),
                "entities": sum(1 for entry in entita if entry.disabled_by is None),
                "disabled": device.disabled_by is not None,
            }
        )
    devices.sort(key=lambda item: (item["name"].casefold(), item["id"]))

    trovate = await loader.async_get_integrations(hass, domini)
    integrations = [
        _integrazione(
            domain, trovate.get(domain), hass.config_entries.async_entries(domain)
        )
        for domain in sorted(domini)
    ]
    conteggio = Counter(device["integration"] for device in devices)
    for integrazione in integrations:
        integrazione["devices"] = conteggio.get(integrazione["domain"], 0)
    integrations.sort(key=lambda item: item["name"].casefold())

    entities: list[dict[str, Any]] = []
    if device_ids:
        nomi = {device["id"]: device["name"] for device in devices}
        for device_id in device_ids[:MAX_DEVICE_IDS]:
            for entry in sorted(
                per_dispositivo.get(device_id, []), key=lambda item: item.entity_id
            ):
                entities.append(_entita(hass, entry, nomi.get(device_id, "")))

    return {"integrations": integrations, "devices": devices, "entities": entities}
