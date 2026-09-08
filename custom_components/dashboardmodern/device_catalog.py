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

# Le entita' chieste per nome in una volta sola. Piu' alto del tetto dei
# dispositivi perche' la domanda e' un'altra: non «mostrami questo menu» ma
# «di chi sono queste entita' che ho gia' in mano» — e i binary_sensor con una
# certa classe, in una casa grande, sono qualche centinaio.
MAX_ENTITY_IDS = 500


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


def _entita_del_dispositivo(hass: HomeAssistant, device_id: str) -> list[dict]:
    """Le entita' di un dispositivo, lette dall'indice del registro.

    Il registro delle entita' tiene un indice per dispositivo: si chiede
    quello, e non si passa tutta la casa. Le entita' della plancia restano
    fuori come nel menu — non sono di nessun elettrodomestico.
    """
    device = dr.async_get(hass).async_get(device_id)
    nome = ""
    if device is not None:
        nome = _testo(device.name_by_user) or _testo(device.name)
    entries = er.async_entries_for_device(
        er.async_get(hass), device_id, include_disabled_entities=True
    )
    return [
        _entita(hass, entry, nome)
        for entry in sorted(entries, key=lambda item: item.entity_id)
        if entry.platform != DOMAIN
    ]


def _entita_per_nome(hass: HomeAssistant, entity_ids: list[str]) -> list[dict]:
    """Le righe del catalogo per le entita' chieste per nome.

    Serve a rispondere a una domanda sola: di quale integrazione e' questa
    entita'. Lo stato non lo dice — `device_class: connectivity` ce l'hanno il
    router, la stampante e ogni telefono — e senza saperlo una sezione che si
    riempie da se' si riempie di tutta la casa. Il registro lo sa, ed e' l'unico
    che lo sa.

    Chi non e' nel registro non c'e': un'entita' inventata non diventa vera per
    essere stata chiesta.
    """
    registro = er.async_get(hass)
    registro_dispositivi = dr.async_get(hass)
    nomi: dict[str, str] = {}
    righe: list[dict] = []
    for entity_id in dict.fromkeys(entity_ids[:MAX_ENTITY_IDS]):
        entry = registro.async_get(entity_id)
        if entry is None or entry.platform == DOMAIN:
            continue
        nome = ""
        if entry.device_id:
            if entry.device_id not in nomi:
                device = registro_dispositivi.async_get(entry.device_id)
                nomi[entry.device_id] = (
                    _testo(device.name_by_user) or _testo(device.name) if device else ""
                )
            nome = nomi[entry.device_id]
        righe.append(_entita(hass, entry, nome))
    return righe


async def async_build_catalog(
    hass: HomeAssistant,
    *,
    device_ids: list[str] | None = None,
    entity_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Integrazioni e dispositivi — o, per i dispositivi chiesti, le entita'.

    Sono due domande diverse, e si rispondono in due modi diversi. Senza
    ``device_ids`` si compone il menu: tutte le integrazioni con i loro
    dispositivi, passando i registri per intero. Un dispositivo senza entita'
    non compare: non c'e' niente da mostrare. La plancia stessa nemmeno: le
    sue entita' non sono di nessun elettrodomestico.

    Con ``entity_ids`` la domanda e' ancora un'altra — di chi sono queste
    entita' — e la risposta porta le stesse righe, cercate per nome invece che
    per dispositivo.

    Con ``device_ids`` si vogliono le entita' di quei dispositivi e basta, e
    la risposta porta solo ``entities``. Il menu non si ricompone: la plancia
    le chiede per ogni elettrodomestico collegato, e rileggere ogni volta
    integrazioni e dispositivi di tutta la casa — nel loop — era lavoro
    buttato, una volta per apparecchio a ogni apertura.
    """
    if entity_ids:
        return {"entities": _entita_per_nome(hass, entity_ids)}
    if device_ids:
        # Senza doppioni e nell'ordine chiesto: lo stesso dispositivo due
        # volte sarebbero le stesse righe due volte.
        return {
            "entities": [
                entita
                for device_id in dict.fromkeys(device_ids[:MAX_DEVICE_IDS])
                for entita in _entita_del_dispositivo(hass, device_id)
            ]
        }
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
    # Un dispositivo che arriva da due integrazioni si conta in tutte e due:
    # e' quello che la plancia mostra nel menu, e un numero che dice meno di
    # quello che si vede e' un numero che confonde.
    conteggio = Counter(
        dominio for device in devices for dominio in device["integrations"]
    )
    for integrazione in integrations:
        integrazione["devices"] = conteggio.get(integrazione["domain"], 0)
    integrations.sort(key=lambda item: item["name"].casefold())

    return {"integrations": integrations, "devices": devices, "entities": []}
