"""L'interruttore della presenza simulata.

Uno solo, dell'installazione: la casa e' una, e la simulazione anche. Sta qui e
non nella plancia perche' deve funzionare col browser chiuso — chi e' via non
ha la plancia aperta — e perche' cosi' si mette dove si vuole: fra le azioni
rapide della plancia, in un'automazione che lo accende quando si inserisce
l'allarme, in una scena di partenza.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, NAME
from .presenza import SimulazionePresenza


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Aggiunge l'interruttore alla plancia che porta anche l'aggiornamento."""
    async_add_entities([InterruttorePresenza(hass, entry)])


class InterruttorePresenza(SwitchEntity):
    """Acceso: la casa si muove da sola. Spento: torna com'era."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:home-account"
    _attr_entity_category = EntityCategory.CONFIG
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self._simulazione = SimulazionePresenza(hass, entry.entry_id)
        self._attr_unique_id = f"{DOMAIN}_presenza_simulata"
        # Il nome lo dicono i quindici file delle traduzioni, come per ogni
        # entita' di Home Assistant: qui si dice solo quale chiave leggere.
        self._attr_translation_key = "presenza_simulata"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
            "name": entry.title or NAME,
            "manufacturer": "DashboardModern",
        }

    @property
    def is_on(self) -> bool:
        """Se la simulazione sta girando."""
        return self._simulazione.attiva

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Si parte: il primo giro si fa subito."""
        await self._simulazione.async_accendi()
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Si smette, e quello che la simulazione aveva acceso si spegne."""
        await self._simulazione.async_spegni()
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        """Togliere l'entita' non lascia in giro il timer ne' le luci accese."""
        await self._simulazione.async_spegni()
